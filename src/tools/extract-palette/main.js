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
const log = require("../../shared/main/logger");
const { FileExtension } = require("../../shared/main/constants");
const utils = require("../../shared/main/utils");
const appUtils = require("../../shared/main/app-utils");
const palette = require("./palette");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_currentPalette;

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
  sendIpcToRenderer("hide"); // clean up
  g_currentPalette = undefined;
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
  core.sendIpcToRenderer("tool-extract-palette", ...args);
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
    // show context menu only if text selected
    // ref: https://github.com/electron/electron/issues/4068#issuecomment-274159726
    const { selectionText } = params;
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
    if (selectionText && selectionText.trim() !== "") {
      Menu.buildFromTemplate([
        { label: _("ctxmenu-copy"), role: "copy" },
        { type: "separator" },
        { label: _("ctxmenu-select-all"), role: "selectall" },
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

  on(
    "start",
    (data, distanceMethod, distanceThreshold, maxQuantizationDepth) => {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-extracting").toUpperCase()
      );
      g_currentPalette = palette.getPaletteFromCanvasData(
        data,
        distanceMethod,
        distanceThreshold,
        maxQuantizationDepth
      );
      sendIpcToRenderer("modal-close");
      sendIpcToRenderer("update-palette", g_currentPalette);
      // NOTE: sending the data to a child process seems too slow
    }
  );

  on("export-to-file", (format) => {
    try {
      if (
        g_currentPalette === undefined ||
        g_currentPalette.rgbColors.length <= 0
      ) {
        return;
      }

      let defaultPath = appUtils.getDesktopFolderPath();
      let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
      if (folderList === undefined) {
        return;
      }
      let outputFolderPath = folderList[0];
      if (outputFolderPath === undefined || outputFolderPath === "") return;

      let dateString = new Date().toJSON(); //.slice(0, 10);
      dateString = dateString.replaceAll("-", "");
      dateString = dateString.replaceAll(":", "");
      dateString = dateString.replaceAll("T", "_");
      dateString = dateString.split(".")[0];

      let fileName = "acbr_palette_" + dateString;
      let fileExtension = `.${format}`;
      let outputFilePath = path.join(
        outputFolderPath,
        fileName + fileExtension
      );
      let i = 1;
      while (fs.existsSync(outputFilePath)) {
        i++;
        outputFilePath = path.join(
          outputFolderPath,
          fileName + "(" + i + ")" + fileExtension
        );
      }

      if (format === "gpl") {
        // GIMP
        const gpl = require("./gpl");
        let paletteName = "ACBR Palette " + dateString;
        if (gpl.createFile(outputFilePath, g_currentPalette, paletteName)) {
          sendIpcToRenderer(
            "export-file-created",
            _("tool-ep-modal-title-exported"),
            utils.reduceStringFrontEllipsis(outputFilePath, 50)
          );
        } else {
          sendIpcToRenderer(
            "export-file-error",
            _("tool-ep-modal-title-exporting-error"),
            utils.reduceStringFrontEllipsis(outputFilePath, 50)
          );
        }
      } else if (format === "aco") {
        // Adobe PS
        const aco = require("./aco");
        let paletteName = "ACBR Palette " + dateString;
        if (aco.createFile(outputFilePath, g_currentPalette)) {
          sendIpcToRenderer(
            "export-file-created",
            _("tool-ep-modal-title-exported"),
            utils.reduceStringFrontEllipsis(outputFilePath, 50)
          );
        } else {
          sendIpcToRenderer(
            "export-file-error",
            _("tool-ep-modal-title-exporting-error"),
            utils.reduceStringFrontEllipsis(outputFilePath, 50)
          );
        }
      }
    } catch (error) {}
  });
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
      id: "tool-ep-title-text",
      text: _("tool-ep-title").toUpperCase(),
    },
    {
      id: "tool-ep-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-ep-start-button-text",
      text: _("tool-ep-button-start").toUpperCase(),
    },
    {
      id: "tool-ep-export-to-file-button-text",
      text: _("tool-ep-button-export-to-file").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ep-section-general-options-text",
      text: _("tool-shared-ui-input-output"),
    },
    {
      id: "tool-ep-section-advanced-options-text",
      text: _("tool-shared-ui-advanced-options"),
    },
    //////////////////////////////////////////////

    {
      id: "tool-ep-input-file-text",
      text: _("tool-ep-header-input-file"),
    },
    {
      id: "tool-ep-output-palette-text",
      text: _("tool-ep-header-output-palette"),
    },
    {
      id: "tool-ep-add-file-button-text",
      text: _("tool-ep-button-add-file").toUpperCase(),
    },
    {
      id: "tool-ep-advanced-output-options-text",
      text: _("tool-shared-ui-advanced-output-options"),
    },
    {
      id: "tool-ep-export-format-text",
      text: _("tool-ep-export-format"),
    },
    {
      id: "tool-ep-max-num-colors-text",
      text: _("tool-ep-max-num-colors"),
    },
    {
      id: "tool-ep-distance-method-text",
      text: _("tool-ep-distance-method"),
    },
    {
      id: "tool-ep-distance-deltae-threshold-text",
      text: _("tool-ep-distance-deltae-threshold"),
    },

    //////////////////////////////////////////////

    {
      id: "tool-ep-modal-close-button-text",
      text: _("ui-modal-prompt-button-ok").toUpperCase(),
    },
  ];
}
