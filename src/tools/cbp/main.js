/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const reader = require("../../reader/main");
const shell = require("electron").shell;
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");

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

  on("search-window", (inputData) => {
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
            "../../shared/main/tools-bg-window-preload.js"
          ),
        },
      });
      g_bgWindow.webContents.openDevTools();
      g_bgWindow.loadURL(
        `https://search.disroot.org/search?q=${encodeURIComponent(
          inputData.query
        )}&pageno=${
          inputData.pageNum
        }&language=en-US&time_range=&safesearch=1&categories=general`
      );
      g_bgWindowTimeOut = setTimeout(() => {
        // cancel if dom-ready takes too long
        onIpcFromBgWindow(inputData);
      }, 15000);
      g_bgWindow.webContents.on("dom-ready", function () {
        clearTimeout(g_bgWindowTimeOut);
        g_bgWindow.send("getHtml", "tool-cbp", inputData);
      });
    } catch (error) {
      log.error(error);
      onIpcFromBgWindow(inputData);
    }
  });

  function onIpcFromBgWindow(inputData) {
    cleanUpBgWindow();
    if (!inputData || !inputData.html) {
      sendIpcToRenderer(
        "update-results",
        [],
        "⚠ " + _("tool-shared-ui-search-network-error", "comicbookplus.com")
      );
    } else {
      try {
        const jsdom = require("jsdom");
        const { JSDOM } = jsdom;
        const dom = new JSDOM(inputData.html);
        let results = inputData;
        results.links = [];
        const resultWrapper = dom.window.document.querySelectorAll(".result");
        if (resultWrapper && resultWrapper.length > 0) {
          resultWrapper.forEach((element) => {
            const a = element.querySelector("h3")?.querySelector("a");
            if (a && a.href && a.href.includes("dlid")) {
              let comicId;
              let parts = a.href.split("dlid=");
              if (parts.length === 2) {
                comicId = parts[1];
              }
              if (comicId) {
                results.links.push({
                  name: a.textContent.replace(" - Comic Book Plus", ""),
                  dlid: comicId,
                });
              }
            }
          });
        }
        if (results.links.length === 0) {
          throw "0 results";
        }
        results.hasNext =
          dom.window.document.querySelector("form.next_page") !== null;
        results.hasPrev =
          dom.window.document.querySelector("form.previous_page") !== null;
        sendIpcToRenderer(
          "update-results",
          results,
          _("tool-shared-ui-search-item-open-acbr"),
          _("tool-shared-ui-search-item-open-browser")
        );
      } catch (error) {
        if (error !== "0 results") log.error(error);
        sendIpcToRenderer(
          "update-results",
          { links: [], pageNum },
          _("tool-shared-ui-search-nothing-found")
        );
      }
    }
  }
  exports.onIpcFromBgWindow = onIpcFromBgWindow;

  on("search", async (inputData) => {});

  on("open-url-in-browser", (url) => {
    shell.openExternal(url);
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
        { timeout: 15000 }
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
    _("tool-shared-modal-title-searching"),
    _("tool-shared-ui-close"), // TODO: not used?
    _("tool-shared-ui-cancel"), // TODO: not used?
    getLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-cbp-title-text",
      text: _("tool-cbp-title").toUpperCase(),
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
      text: _("tool-shared-tab-about"),
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
      id: "tool-cbp-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-cbp--about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-comicbooks"),
        _("tool-cbp-title")
      ),
    },
    {
      id: "tool-cbp--about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-cbp--about-3-text",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "tool-cbp-open-cbp-browser-button-text",
      text: _(
        "tool-shared-ui-button-open-websitename-in-browser",
        _("tool-cbp-title")
      ).toUpperCase(),
    },
    {
      id: "tool-cbp-open-donate-browser-button-text",
      text: _("tool-dcm-button-open-donate-browser").toUpperCase(),
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
