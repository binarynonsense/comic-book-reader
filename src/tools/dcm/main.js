/**
 * @license
 * Copyright 2020-2025 Álvaro García
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
const utils = require("../../shared/main/utils");

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
  core.sendIpcToRenderer("tool-dcm", ...args);
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

  on("search", async (data) => {
    let results = data;
    results.links = [];
    try {
      const formData = new FormData();
      formData.append("terms", data.query);
      const axios = require("axios").default;
      const response = await axios.post(
        "https://digitalcomicmuseum.com/index.php?ACT=dosearch",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 15000,
        }
      );
      data.html = response.data;
    } catch (error) {
      log.error(error);
    }
    if (!data || !data.html) {
      results = data;
      results.links = [];
      sendIpcToRenderer(
        "update-results",
        results,
        "⚠ " +
          _("tool-shared-ui-search-network-error", "digitalcomicmuseum.com")
      );
    } else {
      try {
        const jsdom = require("jsdom");
        const { JSDOM } = jsdom;
        const dom = new JSDOM(data.html);
        const table = dom.window.document.querySelector("#search-results");
        const links = table?.getElementsByTagName("a");
        if (links && links.length > 0) {
          for (let index = 0; index < links.length; index++) {
            const link = links[index];
            // e.g. index.php?dlid=33252
            if (link.href.startsWith("index.php?dlid=")) {
              const name = link.innerHTML;
              const parts = link.href.split("dlid=");
              if (parts.length === 2 && isValidBookId(parts[1])) {
                let result = {
                  name: name,
                  id: parts[1],
                };
                results.links.push(result);
              }
            }
          }
        }
        if (results.links.length === 0) throw "0 results";
        sendIpcToRenderer(
          "update-results",
          results,
          _("tool-shared-ui-search-item-open-acbr"),
          _("tool-shared-ui-search-item-open-browser")
        );
      } catch (error) {
        if (error !== "0 results") log.error(error);
        results = data;
        results.links = [];
        sendIpcToRenderer(
          "update-results",
          results,
          _("tool-shared-ui-search-nothing-found")
        );
      }
    }
  });

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
            "../../shared/main/tools-bg-window-preload.js"
          ),
        },
      });
      // g_bgWindow.webContents.openDevTools();
      let url;
      if (data.engine === "disroot") {
        url = `https://search.disroot.org/search?q=${encodeURIComponent(
          data.query
        )}&pageno=${
          data.pageNum
        }&language=en-US&time_range=&safesearch=1&categories=general`;
      } else if (data.engine === "duckduckgo") {
        if (data.url) {
          url = data.url;
        } else {
          url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(
            data.query
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
        g_bgWindow.send("getHtml", "tool-dcm", data);
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
        "⚠ " +
          _("tool-shared-ui-search-network-error", "digitalcomicmuseum.com")
      );
    } else {
      const jsdom = require("jsdom");
      const { JSDOM } = jsdom;
      const dom = new JSDOM(data.html);
      if (data.engine === "disroot") {
        try {
          results = search.searchDisroot(
            results,
            dom,
            "dlid",
            " - Comic Book Plus"
          );
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-item-open-acbr"),
            _("tool-shared-ui-search-item-open-browser")
          );
        } catch (error) {
          if (error !== "0 results") log.error(error);
          results = data;
          results.links = [];
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-nothing-found")
          );
        }
      } else if (data.engine === "duckduckgo") {
        try {
          results = search.searchDDG(
            results,
            data.html,
            dom,
            "dlid",
            " - Comic Book Plus"
          );
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-item-open-acbr"),
            _("tool-shared-ui-search-item-open-browser")
          );
        } catch (error) {
          if (error !== "0 results") log.error(error);
          results = data;
          results.links = [];
          sendIpcToRenderer(
            "update-results",
            results,
            _("tool-shared-ui-search-nothing-found")
          );
        }
      }
    }
  }
  exports.onIpcFromBgWindow = onIpcFromBgWindow;

  on("open-url-in-browser", (url) => {
    utils.openURL(url);
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

async function getPageCallback(pageNum, fileData) {
  try {
    const axios = require("axios").default;
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    let comicData = fileData.data;
    const response = await axios.get(
      `https://digitalcomicmuseum.com/preview/index.php?did=${comicData.comicId}&page=${pageNum}`,
      { timeout: 15000 }
    );
    const dom = new JSDOM(response.data);
    let images = dom.window.document.getElementsByTagName("img");

    let imageUrl;
    for (let i = 0; i < images.length; i++) {
      if (images[i].alt === "Comic Page") {
        imageUrl = images[i].src;
        continue;
      }
    }
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
    _("tool-dcm-select-publisher-text"),
    _("tool-dcm-select-title-text"),
    _("tool-dcm-select-comic-text"),
    _("tool-shared-modal-title-loading"),
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
      id: "tool-dcm-title-text",
      text: _("menu-tools-dcm").toUpperCase(),
    },
    {
      id: "tool-dcm-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-dcm-start-button-text",
      text: _("tool-shared-ui-convert").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-dcm-section-1-text",
      text: _("tool-shared-tab-catalog"),
    },
    {
      id: "tool-dcm-section-2-text",
      text: _("tool-shared-tab-openurl"),
    },
    {
      id: "tool-dcm-section-3-text",
      text: _("tool-shared-tab-options"),
    },
    {
      id: "tool-dcm-section-4-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-dcm-section-5-text",
      text: _("tool-shared-tab-donate"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-dcm-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-dcm-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-dcm-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-catalog-text",
      text: _("tool-shared-tab-catalog"),
    },
    {
      id: "tool-dcm-catalog-error-message-text",
      text:
        "⚠ " +
        _("tool-shared-ui-search-network-error", "digitalcomicmuseum.com"),
    },
    {
      id: "tool-dcm-publishers-text",
      text: _("tool-dcm-publishers-text"),
    },
    {
      id: "tool-dcm-titles-text",
      text: _("tool-dcm-titles-text"),
    },
    {
      id: "tool-dcm-comics-text",
      text: _("tool-dcm-comics-text"),
    },
    {
      id: "tool-dcm-open-selected-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-dcm-open-selected-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-url-text",
      text: _("tool-dcm-dcm-url-text"),
    },
    {
      id: "tool-dcm-open-input-url-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-dcm-open-input-url-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-search-options-text",
      text: _("tool-shared-ui-search-options"),
    },
    {
      id: "tool-dcm-options-search-engine-text",
      text: _("tool-gut-text-options-search-engine"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-dcm-about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-comicbooks"),
        "Digital Comic Museum"
      ),
    },
    {
      id: "tool-dcm-about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-dcm-open-dcm-browser-button-text",
      text: _(
        "tool-shared-ui-button-open-websitename-in-browser",
        "DCM"
      ).toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-donate-text",
      text: _("tool-shared-ui-donateto-website", _("menu-tools-dcm")),
    },
    {
      id: "tool-dcm-donate-1-text",
      text: _("tool-shared-ui-donate-text", _("menu-tools-dcm")),
    },
    {
      id: "tool-dcm-open-donate-browser-button-text",
      text: _("tool-shared-ui-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-dcm-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "tool-dcm-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
