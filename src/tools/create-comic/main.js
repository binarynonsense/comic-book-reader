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

const { FileExtension } = require("../../shared/main/constants");
const { fork } = require("child_process");
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const fileFormats = require("../../shared/main/file-formats");
const settings = require("../../shared/main/settings");
const utils = require("../../shared/main/utils");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_cancel = false;
let g_worker;
let g_outputPageOrder = "byPosition";
let g_pdfCreationMethod = "metadata";

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

  sendIpcToRenderer(
    "show",
    appUtils.getDesktopFolderPath(),
    settings.canEditRars()
  );

  updateLocalizedText();
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up

  if (g_worker !== undefined) {
    g_worker.kill();
    g_worker = undefined;
  }
  fileUtils.cleanUpTempFolder();
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
  core.sendIpcToRenderer("tool-create-comic", ...args);
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

  on("choose-file", (defaultPath) => {
    try {
      let allowMultipleSelection = true;
      let allowedFileTypesName = "Image Files";
      let allowedFileTypesList = [
        FileExtension.JPG,
        FileExtension.JPEG,
        FileExtension.PNG,
        FileExtension.WEBP,
        FileExtension.BMP,
        FileExtension.AVIF,
      ];
      let filePathsList = appUtils.chooseOpenFiles(
        core.getMainWindow(),
        defaultPath,
        allowedFileTypesName,
        allowedFileTypesList,
        allowMultipleSelection
      );
      if (filePathsList === undefined) {
        return;
      }
      for (let index = 0; index < filePathsList.length; index++) {
        const filePath = filePathsList[index];
        let stats = fs.statSync(filePath);
        if (!stats.isFile()) continue; // avoid folders accidentally getting here
        sendIpcToRenderer("add-file", filePath);
      }
    } catch (err) {
      // TODO: do something?
    }
  });

  on("choose-folder", (inputFilePath, outputFolderPath) => {
    let defaultPath;
    if (outputFolderPath !== undefined) {
      defaultPath = outputFolderPath;
    } else if (inputFilePath !== undefined) {
      defaultPath = path.dirname(inputFilePath);
    }
    let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
    if (folderList === undefined) {
      return;
    }
    let folderPath = folderList[0];
    if (folderPath === undefined || folderPath === "") return;

    sendIpcToRenderer("change-output-folder", folderPath);
  });

  /////////////////////////

  on("cancel", () => {
    if (!g_cancel) {
      g_cancel = true;
    }
  });

  on("set-pdf-creation-method", (method) => {
    g_pdfCreationMethod = method;
  });

  on("set-page-order", (order) => {
    g_outputPageOrder = order;
  });

  on("start", (inputFiles) => {
    start(inputFiles);
  });

  on("stop-error", (err) => {
    stopError(err);
  });

  on("create-file-from-images", (...args) => {
    createFileFromImages(...args);
  });

  on("end", (wasCanceled, numFiles, numErrors, numAttempted) => {
    if (!wasCanceled) {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-creation-finished")
      );

      if (numErrors > 0) {
        sendIpcToRenderer(
          "update-info-text",
          _(
            "tool-shared-modal-info-creation-error-num-files",
            numErrors,
            numFiles
          )
        );
      } else {
        sendIpcToRenderer(
          "update-info-text",
          _("tool-shared-modal-info-creation-success-num-files", numFiles)
        );
      }
    } else {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-creation-canceled")
      );
      sendIpcToRenderer(
        "update-info-text",
        _(
          "tool-shared-modal-info-creation-results",
          numAttempted - numErrors,
          numErrors,
          numFiles - numAttempted
        )
      );
    }

    sendIpcToRenderer("show-result");
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

function initHandleIpcCallbacks() {
  // handle(
  //   "pdf-save-dataurl-to-file",
  //   async (dataUrl, dpi, folderPath, pageNum) => {
  //     try {
  //       const { changeDpiDataUrl } = require("changedpi");
  //       let img = changeDpiDataUrl(dataUrl, dpi);
  //       let data = img.replace(/^data:image\/\w+;base64,/, "");
  //       let buf = Buffer.from(data, "base64");
  //       let filePath = path.join(folderPath, pageNum + "." + FileExtension.JPG);
  //       fs.writeFileSync(filePath, buf, "binary");
  //       return undefined;
  //     } catch (error) {
  //       return error;
  //     }
  //   }
  // );
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function stopError(error) {
  fileUtils.cleanUpTempFolder();
  sendIpcToRenderer("update-log-text", error);
  sendIpcToRenderer(
    "update-log-text",
    _("tool-shared-modal-log-creation-error")
  );
  sendIpcToRenderer("finished-error");
}

function stopCancel() {
  fileUtils.cleanUpTempFolder();
  sendIpcToRenderer(
    "update-log-text",
    _("tool-shared-modal-log-creation-canceled")
  );
  sendIpcToRenderer("finished-canceled");
}

function start(inputFiles) {
  g_cancel = false;
  try {
    sendIpcToRenderer(
      "modal-update-title-text",
      _("tool-shared-modal-title-creating")
    );
    sendIpcToRenderer("update-info-text", "");

    // copy to temp folder
    let tempFolderPath = fileUtils.createTempFolder();
    let imgFilePaths = [];
    for (let index = 0; index < inputFiles.length; index++) {
      const inPath = inputFiles[index].path;
      let outName = path.basename(inPath);
      if (g_outputPageOrder === "byPosition") {
        const extension = path.extname(inPath);
        outName = index + extension;
      }
      const outPath = path.join(tempFolderPath, outName);
      fs.copyFileSync(inPath, outPath, fs.constants.COPYFILE_EXCL);
      imgFilePaths.push(outPath);
    }
    sendIpcToRenderer("images-extracted");
  } catch (err) {
    stopError(err);
  }
}

async function createFileFromImages(
  outputFileName,
  outputFormat,
  outputFolderPath
) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    let tempFolderPath = fileUtils.getTempFolderPath();
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    if (imgFilePaths === undefined || imgFilePaths.length === 0) {
      stopError("imgFiles === undefined || imgFiles.length === 0");
      return;
    }
    imgFilePaths.sort(utils.compare);

    // change imgs' format if needed (for pdf creation or resizing)
    if (outputFormat === FileExtension.PDF) {
      const sharp = require("sharp");
      // avoid EBUSY error on windows
      // ref: https://stackoverflow.com/questions/41289173/node-js-module-sharp-image-processor-keeps-source-file-open-unable-to-unlink
      sharp.cache(false);
      for (let index = 0; index < imgFilePaths.length; index++) {
        if (g_cancel === true) {
          stopCancel();
          return;
        }
        let filePath = imgFilePaths[index];
        if (!fileUtils.hasPdfKitCompatibleImageExtension(filePath)) {
          let fileFolderPath = path.dirname(filePath);
          let fileName = path.basename(filePath, path.extname(filePath));
          let tmpFilePath = path.join(
            fileFolderPath,
            fileName + "." + FileExtension.TMP
          );
          let newFilePath = path.join(
            fileFolderPath,
            fileName + "." + FileExtension.JPG
          );

          sendIpcToRenderer(
            "update-log-text",
            _("tool-shared-modal-log-page-to-compatible-format", index + 1)
          );
          await sharp(filePath).withMetadata().jpeg().toFile(tmpFilePath);

          fs.unlinkSync(filePath);
          fileUtils.moveFile(tmpFilePath, newFilePath);
          imgFilePaths[index] = newFilePath;
        }
      }
    }

    // compress to output folder
    try {
      sendIpcToRenderer(
        "update-log-text",
        _("tool-shared-modal-log-generating-new-file") + "..."
      );
      if (g_worker !== undefined) {
        // kill it after one use
        g_worker.kill();
        g_worker = undefined;
      }
      if (g_worker === undefined) {
        g_worker = fork(
          path.join(__dirname, "../../shared/main/tools-worker.js")
        );
        g_worker.on("message", (message) => {
          g_worker.kill(); // kill it after one use
          if (message[0] === "success") {
            fileUtils.cleanUpTempFolder();
            message[1].forEach((element) => {
              sendIpcToRenderer("update-log-text", element);
            });
            sendIpcToRenderer("finished-ok");
            return;
          } else {
            stopError(message[0]);
            return;
          }
        });
      }
      let extraData = undefined;
      if (outputFormat === FileExtension.CBR) {
        extraData = {
          rarExePath: utils.getRarCommand(
            settings.getValue("rarExeFolderPath")
          ),
          workingDir: fileUtils.getTempFolderPath(),
        };
      } else if (outputFormat === FileExtension.PDF) {
        extraData = g_pdfCreationMethod;
      }
      g_worker.send([
        "create",
        outputFileName,
        outputFolderPath,
        1,
        imgFilePaths,
        undefined, // comicinfoxml
        outputFormat,
        fileUtils.getTempFolderPath(),
        undefined, // password
        extraData,
      ]);
    } catch (error) {}
  } catch (err) {
    stopError(err);
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    getLocalization(),
    getTooltipsLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getTooltipsLocalization() {
  return [
    {
      id: "tool-cr-tooltip-output-folder",
      text: _("tool-shared-tooltip-output-folder"),
    },
    {
      id: "tool-cr-tooltip-remove-from-list",
      text: _("tool-shared-tooltip-remove-from-list"),
    },
    {
      id: "tool-cr-tooltip-pdf-extraction",
      text: _("tool-shared-ui-pdf-extraction-tooltip"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "tool-cr-title-text",
      text: _("tool-cr-title").toUpperCase(),
    },
    {
      id: "tool-cr-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-cr-start-button-text",
      text: _("tool-shared-ui-create").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cr-section-general-options-text",
      text: _("tool-shared-ui-general-options"),
    },
    {
      id: "tool-cr-section-advanced-options-text",
      text: _("tool-shared-ui-advanced-options"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cr-input-options-text",
      text: _("tool-shared-ui-input-options"),
    },
    {
      id: "tool-cr-input-files-text",
      text: _("tool-shared-ui-input-files"),
    },
    {
      id: "tool-cr-add-file-button-text",
      text: _("tool-shared-ui-add").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cr-output-options-text",
      text: _("tool-shared-ui-output-options"),
    },
    {
      id: "tool-cr-output-format-text",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "tool-cr-output-page-order-text",
      text: _("tool-shared-ui-output-options-page-order"),
    },
    {
      id: "tool-cr-output-page-order-o1-text",
      text: _("tool-shared-ui-output-options-page-order-o1"),
    },
    {
      id: "tool-cr-output-page-order-o2-text",
      text: _("tool-shared-ui-output-options-page-order-o2"),
    },
    {
      id: "tool-cr-output-name-text",
      text: _("tool-shared-ui-output-name"),
    },
    {
      id: "tool-cr-output-folder-text",
      text: _("tool-shared-ui-output-folder"),
    },
    {
      id: "tool-cr-change-folder-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cr-advanced-output-options-text",
      text: _("tool-shared-ui-advanced-output-options"),
    },
    {
      id: "tool-cr-pdf-creation-text",
      text: _("tool-shared-ui-pdf-creation"),
    },
    {
      id: "tool-cr-pdf-creation-o1-text",
      text: _("tool-shared-ui-pdf-creation-o1"),
    },
    {
      id: "tool-cr-pdf-creation-o2-text",
      text: _("tool-shared-ui-pdf-creation-o2"),
    },
    {
      id: "tool-cr-pdf-creation-o3-text",
      text: _("tool-shared-ui-pdf-creation-o3"),
    },

    //////////////////////////////////////////////

    {
      id: "tool-cr-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-cr-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
  ];
}
