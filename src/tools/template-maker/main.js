/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { clipboard } = require("electron");
const shell = require("electron").shell;
const fs = require("node:fs");
const path = require("node:path");
const core = require("../../core/main");
const { _, getKeys } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");
const themes = require("../../shared/main/themes");

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

exports.open = function (filePath) {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());

  sendIpcToRenderer("show", themes.getData(), getIframeLocalization());

  updateLocalizedText();
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide");
};

exports.saveAndQuit = function () {
  sendIpcToRenderer("save-and-quit-request");
};

exports.saveAndClose = function () {
  sendIpcToRenderer("save-and-close-request");
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
  core.sendIpcToRenderer("tool-template-maker", ...args);
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

  on("quit", () => {
    core.forceQuit();
  });

  on("reset-quit", () => {
    core.resetQuit();
  });

  on("binaryLinkClicked", () => {
    shell.openExternal("https://www.binarynonsense.com/");
  });

  // on("show-context-menu", (params) => {
  //   contextMenu.show("copy-select", params, onCloseClicked);
  // });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    getLocalization(),
    getIframeLocalization(),
  );
}

function getLocalization() {
  const localization = { texts: [], modals: {} };
  localization.texts = [
    {
      id: "tool-template-maker-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
  ];
  localization.modals["closeTitle"] = _("tool-shared-modal-title-warning");
  localization.modals["closeMessage"] = _("tool-tm-back-warning");
  localization.modals["closeOk"] = _("ui-modal-prompt-button-ok").toUpperCase();
  localization.modals["closeCancel"] = _(
    "ui-modal-prompt-button-cancel",
  ).toUpperCase();
  return localization;
}

function getIframeLocalization() {
  const keys = getKeys();
  const localization = { texts: [], titles: [] };
  // TODO: do all this more efficiently
  keys.forEach((key) => {
    if (key.startsWith("tool-tm-")) {
      if (key.endsWith("-tagtitle")) {
        localization.titles.push({
          id: key.replace("tool-tm-", "").replace("-tagtitle", ""),
          text: _(key),
          //text: "** " + _(key),
        });
      } else {
        localization.texts.push({
          id: key.replace("tool-tm-", ""),
          text: _(key),
          //text: "** " + _(key),
        });
      }
    }
  });
  return localization;
}
