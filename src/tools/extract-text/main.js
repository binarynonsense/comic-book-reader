/**
 * @license
 * Copyright 2020-2023 Álvaro García
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
const contextMenu = require("../../shared/main/tools-menu-context");
const { createWorker } = require("tesseract.js");
const temp = require("../../shared/main/temp");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_ocrWorker;
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
  cleanUpOcrWorker();
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
  core.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-extract-text", ...args);
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
      let filePathsList = appUtils.chooseOpenFiles(
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

  on("start", (inputBase64Img, language, offline) => {
    try {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-extracting").toUpperCase()
      );
      sendIpcToRenderer(
        "modal-update-info-text",
        _("tool-et-modal-info").toUpperCase()
      );
      let base64 = inputBase64Img;
      let options;
      if (offline) {
        options = {
          langPath: path.join(__dirname, "../../assets/ocr-data"),
          cachePath: path.join(__dirname, "../../assets/ocr-data"),
          cacheMethod: "none",
          //gzip: false,
          logger: (m) => {
            sendIpcToRenderer("modal-update-log-text", m.status);
          },
        };
      } else {
        options = {
          cacheMethod: "none",
          logger: (m) => {
            sendIpcToRenderer("modal-update-log-text", m.status);
          },
        };
      }

      cleanUpOcrWorker();
      g_ocrWorker = createWorker(options);
      (async () => {
        await g_ocrWorker.load();
        await g_ocrWorker.loadLanguage(language);
        await g_ocrWorker.initialize(language);
        const {
          data: { text },
        } = await g_ocrWorker.recognize(base64);
        sendIpcToRenderer("modal-update-log-text", "done");
        sendIpcToRenderer("modal-close");
        sendIpcToRenderer("fill-textarea", text);
        await g_ocrWorker.terminate();
        g_ocrWorker = undefined;
      })();
    } catch (error) {
      cleanUpOcrWorker();
      log.error(error);
    }
  });

  on("cancel-extraction", () => {
    cleanUpOcrWorker();
    sendIpcToRenderer("modal-close");
  });

  on("copy-text-to-clipboard", (text) => {
    clipboard.writeText(text);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function cleanUpOcrWorker() {
  if (g_ocrWorker !== undefined) {
    g_ocrWorker.terminate();
    g_ocrWorker = undefined;
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
      id: "tool-et-title-text",
      text: _("tool-et-title").toUpperCase(),
    },
    {
      id: "tool-et-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-et-start-button-text",
      text: _("tool-et-button-extract-text").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-et-section-general-options-text",
      text: _("tool-shared-ui-input-output"),
    },
    {
      id: "tool-et-section-advanced-options-text",
      text: _("tool-shared-tab-options"),
    },
    //////////////////////////////////////////////

    {
      id: "tool-et-input-file-text",
      text: _("tool-et-header-input-file"),
    },
    {
      id: "tool-et-add-file-button-text",
      text: _("tool-et-button-add-file").toUpperCase(),
    },
    {
      id: "tool-et-advanced-output-options-text",
      text: _("tool-shared-ui-output-options"),
    },
    {
      id: "tool-et-header-output-text",
      text: _("tool-et-header-output-text"),
    },
    {
      id: "tool-et-copy-text-button-text",
      text: _("tool-et-button-copy-text").toUpperCase(),
    },
    {
      id: "tool-et-header-language-text",
      text: _("tool-et-header-language"),
    },
    {
      id: "tool-et-span-language-checkbox-info-text",
      text: _("tool-et-span-language-checkbox-info"),
    },

    //////////////////////////////////////////////

    {
      id: "tool-et-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
  ];
}
