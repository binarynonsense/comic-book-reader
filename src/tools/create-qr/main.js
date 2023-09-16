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
const log = require("../../shared/main/logger");
const { FileExtension } = require("../../shared/main/constants");
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const utils = require("../../shared/main/utils");
const QRCode = require("qrcode");
const contextMenu = require("../../shared/main/tools-menu-context");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_imgBase64;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());

  sendIpcToRenderer("show");

  updateLocalizedText();
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up
  fileUtils.cleanUpTempFolder();
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
  core.sendIpcToRenderer("tool-create-qr", ...args);
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

  on("start", (text) => {
    try {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-creating").toUpperCase()
      );

      QRCode.toDataURL(text, {
        type: "image/jpeg",
      })
        .then((base64Img) => {
          if (base64Img) {
            g_imgBase64 = base64Img;
            sendIpcToRenderer("update-image", g_imgBase64);
            sendIpcToRenderer("modal-close");
          } else {
            throw {
              name: "GenericError",
              message: "the generated image is empty",
            };
          }
        })
        .catch((error) => {
          if (error?.message.includes("big to be stored")) {
            error = {
              name: "GenericError",
              message: _("tool-cq-modal-alert-msg-toomuchdata"),
            };
          }
          if (error?.name !== "GenericError") {
            log.error(error);
          }
          sendIpcToRenderer("modal-close");
          sendIpcToRenderer(
            "show-modal-alert",
            _("tool-cq-modal-alert-title-errorcreating"),
            error.message,
            true
          );
        });
    } catch (error) {
      log.error(error);
      sendIpcToRenderer("modal-close");
      sendIpcToRenderer(
        "show-modal-alert",
        _("tool-cq-modal-alert-title-errorcreating"),
        error.message,
        true
      );
    }
  });

  on("export-to-file", () => {
    let outputFilePath;
    try {
      let defaultPath = appUtils.getDesktopFolderPath();
      let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
      if (folderList === undefined) {
        return;
      }
      let outputFolderPath = folderList[0];
      if (outputFolderPath === undefined || outputFolderPath === "") return;

      let fileName = "acbr_qr_code";
      let fileExtension = `.${FileExtension.JPG}`;
      outputFilePath = path.join(outputFolderPath, fileName + fileExtension);
      let i = 1;
      while (fs.existsSync(outputFilePath)) {
        i++;
        outputFilePath = path.join(
          outputFolderPath,
          fileName + "(" + i + ")" + fileExtension
        );
      }
      if (!g_imgBase64) {
        throw { name: "GenericError", message: "base64 data is null" };
      }
      let data = g_imgBase64.replace(/^data:image\/\w+;base64,/, "");
      let buf = Buffer.from(data, "base64");
      fs.writeFileSync(outputFilePath, buf, "binary");
      sendIpcToRenderer(
        "show-modal-alert",
        _("tool-cq-modal-alert-title-successexporting"),
        utils.reduceStringFrontEllipsis(outputFilePath, 50),
        false
      );
    } catch (error) {
      log.error(error);
      sendIpcToRenderer(
        "show-modal-alert",
        _("tool-cq-modal-alert-title-errorexporting"),
        error.message,
        true
      );
    }
  });

  // on("copy-text-to-clipboard", (text) => {
  //   clipboard.writeText(text);
  // });
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
      id: "tool-cq-title-text",
      text: _("tool-cq-title").toUpperCase(),
    },
    {
      id: "tool-cq-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-cq-start-button-text",
      text: _("tool-cq-button-start").toUpperCase(),
    },

    //////////////////////////////////////////////

    {
      id: "tool-cq-section-general-options-text",
      text: _("tool-shared-ui-input-output"),
    },

    //////////////////////////////////////////////

    {
      id: "tool-cq-header-input-text",
      text: _("tool-cq-header-input-text"),
    },
    {
      id: "tool-cq-header-output-text",
      text: _("tool-cq-header-output-text"),
    },
    {
      id: "tool-cq-clear-button-text",
      text: _("tool-cq-button-clear").toUpperCase(),
    },
    {
      id: "tool-cq-export-button-text",
      text: _("tool-cq-button-export").toUpperCase(),
    },

    //////////////////////////////////////////////

    {
      id: "tool-cq-modal-close-button-text",
      text: _("tool-shared-ui-ok").toUpperCase(),
    },
  ];
}
