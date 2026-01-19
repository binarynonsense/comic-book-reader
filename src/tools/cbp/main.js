/**
 * @license
 * Copyright 2024-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const reader = require("../../reader/main");
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");
const search = require("../../shared/main/tools-search");
const appUtils = require("../../shared/main/app-utils");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_bgWindow;
let g_bgWindowTimeOut;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();
  sendIpcToRenderer("show");
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up
  cleanUpBgWindow();
};

exports.onResize = function () {
  sendIpcToRenderer("update-window");
};

exports.onMaximize = function () {
  sendIpcToRenderer("update-window");
};

exports.onToggleFullScreen = function () {
  sendIpcToRenderer("update-window");
};

function onCloseClicked() {
  tools.switchTool("reader");
}

function cleanUpBgWindow() {
  if (g_bgWindow) {
    g_bgWindow.destroy();
    g_bgWindow = undefined;
  }
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-cbp", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}

function sendIpcToAudioPlayerRenderer(...args) {
  core.sendIpcToRenderer("audio-player", ...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};

exports.onIpcFromRenderer = function (...args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
};

function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("close", () => {
    onCloseClicked();
  });

  on("show-context-menu", (params) => {
    contextMenu.show("edit", params, onCloseClicked);
  });

  on("open", (comicData) => {
    reader.openBookFromCallback(comicData, getPageCallback);
    onCloseClicked();
  });

  on("open-audio", (url, title, playlistOption) => {
    reader.showAudioPlayer(true, false);
    if (playlistOption === 0) {
      let files = [{ url, title, duration: -1 }];
      sendIpcToAudioPlayerRenderer("add-to-playlist", files, true, false);
    } else {
      let playlist = {
        id: title,
        source: "cbp",
        files: [{ url, duration: -1, title }],
      };
      sendIpcToAudioPlayerRenderer("open-playlist", playlist);
    }
    // onCloseClicked();
  });

  // TODO: 2026 disroot and duckduckgo no longer work, I disabled the
  // option to choose search engines for now

  on("search-window", (data) => {
    try {
      const { BrowserWindow } = require("electron");
      g_bgWindow = new BrowserWindow({
        parent: core.getMainWindow(),
        center: true,
        minWidth: 800,
        minHeight: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          preload: path.join(
            __dirname,
            "../../shared/main/tools-bg-window-preload.js",
          ),
        },
      });
      // g_bgWindow.webContents.openDevTools();
      let url;
      if (data.engine === "cbp") {
        url = `https://comicbookplus.com/search/?q=${encodeURIComponent(
          data.query,
        )}#gsc.tab=0&gsc.q=${encodeURIComponent(data.query)}&gsc.page=${
          data.pageNum
        }`;
      } else if (data.engine === "disroot") {
        url = `https://search.disroot.org/search?q=${encodeURIComponent(
          data.query,
        )}&pageno=${
          data.pageNum
        }&language=en-US&time_range=&safesearch=1&categories=general`;
      } else if (data.engine === "duckduckgo") {
        if (data.url) {
          url = data.url;
        } else {
          url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(
            data.query,
          )}`;
          data.url = url;
          data.firstUrl = url;
        }
      } else {
        throw "Unknown engine";
      }
      g_bgWindow.loadURL(url);
      g_bgWindowTimeOut = setTimeout(() => {
        // cancel if dom-ready takes too long
        onIpcFromBgWindow(data);
      }, 15000);
      g_bgWindow.webContents.on("dom-ready", function () {
        clearTimeout(g_bgWindowTimeOut);
        if (data.engine === "cbp") {
          g_bgWindow.send("getCbpResultsWhenReady", "tool-cbp", data);
        } else {
          g_bgWindow.send("getHtml", "tool-cbp", data);
        }
      });
    } catch (error) {
      log.error(error);
      onIpcFromBgWindow(data);
    }
  });

  function onIpcFromBgWindow(data) {
    cleanUpBgWindow();
    let results = data;
    results.links = [];
    if (!data || !data.html) {
      sendIpcToRenderer(
        "update-results",
        results,
        "⚠ " + _("tool-shared-ui-search-network-error", "comicbookplus.com"),
      );
    } else {
      const jsdom = require("jsdom");
      const { JSDOM } = jsdom;
      const dom = new JSDOM(data.html);
      if (data.engine === "cbp") {
        try {
          const gsWebResults =
            dom.window.document.querySelectorAll(".gs-webResult");
          if (gsWebResults && gsWebResults.length > 0) {
            gsWebResults.forEach((gsWebResult) => {
              const gsTitle = gsWebResult.querySelector("a.gs-title");
              if (gsTitle && gsTitle.href && gsTitle.href.includes("dlid")) {
                let comicId;
                let parts = gsTitle.href.split("dlid=");
                if (parts.length === 2) {
                  comicId = parts[1];
                }
                if (comicId) {
                  let type;
                  let breadCrumb = gsWebResult.querySelector(
                    ".gs-visibleUrl-breadcrumb",
                  )?.textContent;
                  const snippet =
                    gsWebResult.querySelector(".gs-snippet")?.textContent;
                  let summary;
                  if (breadCrumb && snippet) {
                    summary = breadCrumb;
                    breadCrumb = breadCrumb.toLowerCase();
                    if (
                      breadCrumb.includes("books") ||
                      breadCrumb.includes("comics") ||
                      breadCrumb.includes("magazines") ||
                      breadCrumb.includes("british story papers") ||
                      breadCrumb.includes("dime novels") ||
                      breadCrumb.includes("comic strips")
                    ) {
                      type = "book";
                    } else if (breadCrumb.includes("radio")) {
                      type = "audio";
                    } else if (breadCrumb.includes("movies")) {
                      type = "skip";
                    } else if (breadCrumb.includes("odds and ends")) {
                      type = "skip";
                    }
                    summary += "\n" + snippet;
                  }
                  if (type !== "skip") {
                    results.links.push({
                      name: gsTitle.textContent.replace(
                        " - Comic Book Plus",
                        "",
                      ),
                      summary,
                      id: comicId,
                      type,
                    });
                  }
                }
              }
            });
          }
          // TODO: maybe check if the gsc-cursor-box has 10 children
          results.hasNext = results.pageNum < 10;
          results.hasPrev = results.pageNum > 1;
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-item-open-acbr"),
            _("tool-shared-ui-search-item-open-browser"),
          );
          if (results.links.length === 0) {
            throw "0 results";
          }
        } catch (error) {
          if (error !== "0 results") log.error(error);
          results = data;
          results.links = [];
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-nothing-found"),
          );
        }
      } else if (data.engine === "disroot") {
        try {
          results = search.searchDisroot(
            results,
            dom,
            "dlid",
            " - Comic Book Plus",
          );
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-item-open-acbr"),
            _("tool-shared-ui-search-item-open-browser"),
          );
        } catch (error) {
          if (error !== "0 results") log.error(error);
          results = data;
          results.links = [];
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-nothing-found"),
          );
        }
      } else if (data.engine === "duckduckgo") {
        try {
          results = search.searchDDG(
            results,
            data.html,
            dom,
            "dlid",
            " - Comic Book Plus",
          );
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-item-open-acbr"),
            _("tool-shared-ui-search-item-open-browser"),
          );
        } catch (error) {
          if (error !== "0 results") log.error(error);
          results = data;
          results.links = [];
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-nothing-found"),
          );
        }
      }
    }
  }
  exports.onIpcFromBgWindow = onIpcFromBgWindow;

  on("search", async (inputData) => {});

  on("open-url-in-browser", (url) => {
    appUtils.openURLInBrowser(url);
  });
}

// HANDLE

let g_handleIpcCallbacks = {};

async function handleIpcFromRenderer(...args) {
  const callback = g_handleIpcCallbacks[args[0]];
  if (callback) return await callback(...args.slice(1));
  return;
}
exports.handleIpcFromRenderer = handleIpcFromRenderer;

function handle(id, callback) {
  g_handleIpcCallbacks[id] = callback;
}

function initHandleIpcCallbacks() {}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pageCallbackLastComicId, g_pageCallbackLastImageUrlRoot;

async function getPageCallback(pageNum, fileData) {
  try {
    const axios = require("axios").default;
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    let comicData = fileData.data;

    if (
      !g_pageCallbackLastComicId ||
      g_pageCallbackLastComicId != comicData.comicId
    ) {
      const response = await axios.get(
        `https://comicbookplus.com/?dlid=${comicData.comicId}`,
        { timeout: 15000 },
      );
      const dom = new JSDOM(response.data);
      let imageUrl = dom.window.document.getElementById("maincomic").src;
      let imageUrlRoot = imageUrl.substring(0, imageUrl.lastIndexOf("/"));

      g_pageCallbackLastComicId = comicData.comicId;
      g_pageCallbackLastImageUrlRoot = imageUrlRoot;
    }

    let imageUrl = `${g_pageCallbackLastImageUrlRoot}/${pageNum - 1}.jpg`;
    return { pageImgSrc: imageUrl, pageImgUrl: imageUrl };
  } catch (error) {
    // console.error(error);
    return undefined;
  }
}
exports.getPageCallback = getPageCallback;

function isValidBookId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    _("tool-shared-ui-search-placeholder"),
    _("tool-shared-modal-title-loading"),
    _("tool-shared-modal-title-searching"),
    _("tool-shared-ui-close"), // TODO: not used?
    _("tool-shared-ui-cancel"),
    _("ui-modal-prompt-button-open-in-audioplayer"),
    _("ui-modal-prompt-button-add-to-playlist"),
    _("ui-modal-prompt-button-start-new-playlist"),
    getLocalization(),
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-cbp-title-text",
      text: _("menu-tools-cbp").toUpperCase(),
    },
    {
      id: "tool-cbp-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-cbp-section-1-text",
      text: _("tool-shared-tab-openurl"),
    },
    {
      id: "tool-cbp-section-2-text",
      text: _("tool-shared-tab-options"),
    },
    {
      id: "tool-cbp-section-3-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-cbp-section-4-text",
      text: _("tool-shared-tab-donate"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-cbp-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-cbp-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-cbp-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-url-text",
      text: _("tool-cbp-url-text"),
    },
    {
      id: "tool-cbp-open-input-url-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-cbp-open-input-url-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-search-options-text",
      text: _("tool-shared-ui-search-options"),
    },
    {
      id: "tool-cbp-options-search-engine-text",
      text: _("tool-gut-text-options-search-engine"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-cbp-about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-comicbooks-audio"),
        _("menu-tools-cbp"),
      ),
    },
    {
      id: "tool-cbp-about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-cbp-open-cbp-browser-button-text",
      text: _(
        "tool-shared-ui-button-open-websitename-in-browser",
        _("menu-tools-cbp"),
      ).toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-donate-text",
      text: _("tool-shared-ui-donateto-website", _("menu-tools-cbp")),
    },
    {
      id: "tool-cbp-donate-1-text",
      text: _("tool-shared-ui-donate-text", _("menu-tools-cbp")),
    },
    {
      id: "tool-cbp-open-donate-browser-button-text",
      text: _("tool-shared-ui-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-cbp-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "tool-cbp-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
