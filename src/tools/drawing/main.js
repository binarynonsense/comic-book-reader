/**
 * @license
 * Copyright 2026 Álvaro García
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
  sendIpcToRenderer("show");
  //   updateLocalizedText();
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide");
};

function onCloseClicked() {
  tools.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-drawing", ...args);
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

  // on("show-context-menu", (params) => {
  //   contextMenu.show("copy-select", params, onCloseClicked);
  // });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
