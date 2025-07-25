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
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");
const appUtils = require("../../shared/main/app-utils");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

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

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-wiktionary", ...args);
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

  on("search", async (text, languageId) => {
    try {
      const axios = require("axios").default;
      let word = encodeURI(text.trim().split(" ")[0]);
      const response = await axios.get(
        `https://${languageId}.wiktionary.org/w/api.php?titles=${word}&action=query&prop=extracts&format=json`,
        { timeout: 10000 }
      );
      let searchResults = response.data;
      let content = Object.values(searchResults.query.pages)[0].extract;
      if (!content || content === "") throw "error";
      sendIpcToRenderer("update-results", content);
    } catch (error) {
      content = _("tool-shared-ui-search-nothing-found");
      sendIpcToRenderer("update-results", content);
    }
  });

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

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    _("tool-shared-ui-search-placeholder"),
    _("tool-shared-modal-title-searching"),
    getLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-wik-title-text",
      text: _("menu-tools-wiktionary").toUpperCase(),
    },
    {
      id: "tool-wik-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-wik-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-wik-section-1-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-wik-section-2-text",
      text: _("tool-shared-tab-donate"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-wik-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-wik-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-wik-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-wik-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-wik-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-wik-about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-dictionaryterms"),
        "Wiktionary"
      ),
    },
    {
      id: "tool-wik-about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-wik-open-wik-browser-button-text",
      text: _(
        "tool-shared-ui-button-open-websitename-in-browser",
        "Wiktionary"
      ).toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-wik-donate-text",
      text: _("tool-shared-ui-donateto-website", "Wiktionary"),
    },
    {
      id: "tool-wik-donate-1-text",
      text: _("tool-shared-ui-donate-text", "Wiktionary"),
    },
    {
      id: "tool-wik-open-donate-browser-button-text",
      text: _("tool-shared-ui-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-wik-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
