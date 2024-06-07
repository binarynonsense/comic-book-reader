/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const history = require("../../shared/main/history");
const reader = require("../../reader/main");
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function (showFocus) {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();
  sendIpcToRenderer("show", getHistory(), showFocus);
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
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
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getHistory() {
  let historyCopy = [...history.get()];
  historyCopy.forEach((fileInfo) => {
    if (fileInfo.data && fileInfo.data.source) {
      fileInfo.isOnline = true;
      if (fileInfo.data.name) {
        fileInfo.fileName = fileInfo.data.name;
      } else {
        fileInfo.fileName = fileInfo.filePath;
      }
    } else {
      fileInfo.fileName = path.basename(fileInfo.filePath);
      if (fs.existsSync(fileInfo.filePath)) {
        fileInfo.fileExists = true;
        if (fs.lstatSync(fileInfo.filePath).isDirectory()) {
          fileInfo.isDirectory = true;
        }
      }
    }
  });
  return historyCopy;
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-history", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}

function sendIpcToPreload(...args) {
  core.sendIpcToPreload(...args);
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
    contextMenu.show("minimal", params, onCloseClicked);
  });

  on("remove-all", () => {
    history.clear();
    reader.rebuildMenuAndToolBars();
    sendIpcToRenderer("build-list", getHistory());
  });

  on("remove-item", (itemIndex) => {
    history.removeIndex(itemIndex);
    reader.rebuildMenuAndToolBars();
    sendIpcToRenderer("build-list", getHistory());
  });

  on("open-item", (itemIndex) => {
    reader.tryOpen(
      history.getIndex(itemIndex).filePath,
      undefined,
      history.getIndex(itemIndex)
    );
    onCloseClicked();
  });
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    getLocalization(),
    getExtraLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-hst-title-text",
      text: _("tool-hst-title").toUpperCase(),
    },
    {
      id: "tool-hst-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-hst-clear-all-button-text",
      text: _("tool-hst-button-clear-all").toUpperCase(),
    },
  ];
}

function getExtraLocalization() {
  return [
    {
      id: "tool-hst-tooltip-remove-from-list",
      text: _("tool-hst-tooltip-remove-from-list"),
    },
    {
      id: "tool-hst-tooltip-open-from-list",
      text: _("tool-hst-tooltip-open-from-list"),
    },

    {
      id: "tool-hst-modal-clearall-title",
      text: _("tool-hst-button-clear-all"),
    },
    {
      id: "tool-hst-modal-clearall-message",
      text: _("tool-hst-modal-clearall-message"),
    },
    {
      id: "tool-hst-modal-clearall-ok",
      text: _("ui-modal-prompt-button-yes"),
    },
    {
      id: "tool-hst-modal-clearall-cancel",
      text: _("ui-modal-prompt-button-cancel"),
    },
  ];
}
