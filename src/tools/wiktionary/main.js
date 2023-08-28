/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const shell = require("electron").shell;

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

function onCloseClicked() {
  core.switchTool("reader");
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
    // ref: https://github.com/electron/electron/issues/4068#issuecomment-274159726
    const { selectionText, isEditable } = params;
    const commonEntries = [
      {
        label: _("tool-shared-ui-back-to-reader"),
        click() {
          onCloseClicked();
        },
      },
      {
        label: _("menu-view-togglefullscreen"),
        accelerator: "F11",
        click() {
          core.onMenuToggleFullScreen();
        },
      },
    ];
    if (isEditable && selectionText && selectionText.trim() !== "") {
      Menu.buildFromTemplate([
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        { role: "selectall" },
        { type: "separator" },
        ...commonEntries,
      ]).popup(core.getMainWindow(), params.x, params.y);
    } else if (isEditable) {
      Menu.buildFromTemplate([
        { role: "paste" },
        { type: "separator" },
        { role: "selectall" },
        { type: "separator" },
        ...commonEntries,
      ]).popup(core.getMainWindow(), params.x, params.y);
    } else {
      Menu.buildFromTemplate([...commonEntries]).popup(
        core.getMainWindow(),
        params.x,
        params.y
      );
    }
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
      text: _("tool-wik-title").toUpperCase(),
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
      id: "tool-wik-about-3-text",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "tool-wik-open-wik-browser-button-text",
      text: _("tool-wik-button-open-wik-browser").toUpperCase(),
    },
    {
      id: "tool-wik-open-donate-browser-button-text",
      text: _("tool-iab-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-wik-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
