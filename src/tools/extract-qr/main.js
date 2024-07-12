/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { clipboard } = require("electron");
const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const { FileExtension } = require("../../shared/main/constants");
const appUtils = require("../../shared/main/app-utils");
const jsQR = require("jsqr");
const contextMenu = require("../../shared/main/tools-menu-context");
const temp = require("../../shared/main/temp");
const tools = require("../../shared/main/tools");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_initialFilePath;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function (filePath) {
  // called by switchTool when opening tool
  g_initialFilePath = filePath;
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());

  if (filePath) {
    let stats = fs.statSync(filePath);
    if (!stats.isFile()) filePath = undefined; // avoid folders accidentally getting here
  }
  sendIpcToRenderer("show", filePath);

  updateLocalizedText();
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide");
  // clean up
  if (g_initialFilePath) temp.deleteSubFolder(path.dirname(g_initialFilePath));
  g_initialFilePath = undefined;
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
  core.sendIpcToRenderer("tool-extract-qr", ...args);
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
    contextMenu.show("copy-select", params, onCloseClicked);
  });

  on("choose-file", () => {
    try {
      let allowMultipleSelection = false;
      let allowedFileTypesName = _("dialog-file-types-images");
      let allowedFileTypesList = [
        FileExtension.JPG,
        FileExtension.JPEG,
        FileExtension.PNG,
        FileExtension.BMP,
        FileExtension.WEBP,
        FileExtension.AVIF,
      ];
      let filePathsList = appUtils.chooseFiles(
        core.getMainWindow(),
        undefined,
        allowedFileTypesName,
        allowedFileTypesList,
        allowMultipleSelection
      );
      if (filePathsList === undefined || filePathsList.length === 0) {
        return;
      }
      const filePath = filePathsList[0];
      let stats = fs.statSync(filePath);
      if (!stats.isFile()) return; // avoid folders accidentally getting here
      sendIpcToRenderer("update-image", filePath);
    } catch (error) {
      log.error(error);
    }
  });

  on("start", (imgData, imgWidth, imgHeight) => {
    try {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-extracting").toUpperCase()
      );
      const code = jsQR(imgData, imgWidth, imgHeight);
      if (code && code.data) {
        sendIpcToRenderer("fill-textarea", code.data);
        sendIpcToRenderer("modal-close");
      } else {
        sendIpcToRenderer("fill-textarea", "");
        throw {
          name: "GenericError",
          message: _("tool-eq-modal-alert-msg-errornodatafound"),
        };
      }
    } catch (error) {
      if (error?.name !== "GenericError") log.error(error);
      cancelExtraction(error);
    }
  });

  on("cancel-extraction", (erro) => {
    cancelExtraction(error);
  });

  on("copy-text-to-clipboard", (text) => {
    clipboard.writeText(text);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function cancelExtraction(error) {
  sendIpcToRenderer("modal-close");
  if (error) {
    sendIpcToRenderer(
      "show-modal-alert",
      _("tool-eq-modal-alert-title-errorextracting"),
      error.message,
      true
    );
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer("update-localization", getLocalization());
}

function getLocalization() {
  return [
    {
      id: "tool-eq-title-text",
      text: _("tool-eq-title").toUpperCase(),
    },
    {
      id: "tool-eq-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-eq-start-button-text",
      text: _("tool-et-button-extract-text").toUpperCase(),
    },

    //////////////////////////////////////////////

    {
      id: "tool-eq-section-general-options-text",
      text: _("tool-shared-ui-input-output"),
    },

    //////////////////////////////////////////////

    {
      id: "tool-eq-input-file-text",
      text: _("tool-et-header-input-file"),
    },
    {
      id: "tool-eq-add-file-button-text",
      text: _("tool-et-button-add-file").toUpperCase(),
    },
    {
      id: "tool-eq-header-output-text",
      text: _("tool-et-header-output-text"),
    },
    {
      id: "tool-eq-copy-text-button-text",
      text: _("tool-et-button-copy-text").toUpperCase(),
    },
  ];
}
