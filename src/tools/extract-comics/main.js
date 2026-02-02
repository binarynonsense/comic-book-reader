/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { BrowserWindow, clipboard, utilityProcess } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const localization = require("./main/localization");

const { FileExtension, FileDataType } = require("../../shared/main/constants");
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const utils = require("../../shared/main/utils");
const contextMenu = require("../../shared/main/tools-menu-context");
const log = require("../../shared/main/logger");
const temp = require("../../shared/main/temp");
const tools = require("../../shared/main/tools");
const settings = require("../../shared/main/settings");
const menuBar = require("../../shared/main/menu-bar");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_cancel = false;
let g_worker;
let g_workerWindow;

// hack to allow this at least for files from File>Convert...
let g_initialPassword = "";
let g_tempSubFolderPath;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }

  g_initialPassword = "";
}

exports.open = function (fileData) {
  // called by switchTool when opening tool
  init();
  let filePath, fileType;
  if (fileData !== undefined) {
    filePath = fileData.path;
    fileType = fileData.type;
    g_initialPassword = fileData.password;
  }
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());

  updateLocalizedText();

  let loadedOptions = settings.loadToolOptions(`tool-ec`);
  sendIpcToRenderer(
    "show",
    // filePath !== undefined
    //   ? path.dirname(filePath)
    //   : appUtils.getDesktopFolderPath(),
    appUtils.getDesktopFolderPath(),
    loadedOptions,
  );

  updateLocalizedText();

  if (filePath !== undefined && fileType !== undefined)
    sendIpcToRenderer("add-file", filePath, fileType);
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up

  g_cancel = false;

  if (g_workerWindow !== undefined) {
    g_workerWindow.destroy();
    g_workerWindow = undefined;
  }

  killWorker();

  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
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
  core.sendIpcToRenderer("tool-extract-comics", ...args);
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

  on("click-reset-options", () => {
    sendIpcToRenderer(
      "show-reset-options-modal",
      _("tool-shared-modal-title-warning"),
      _("tool-shared-ui-settings-reset-warning"),
      _("ui-modal-prompt-button-yes"),
      _("ui-modal-prompt-button-cancel"),
    );
  });

  on("save-settings-options", (options, forceQuit) => {
    settings.updateToolOptions(
      `tool-ec`,
      options["tool-ec-setting-remember-checkbox"] ? options : undefined,
    );
    if (forceQuit) {
      core.forceQuit();
    }
  });

  on("choose-file", async (lastFilePath) => {
    let defaultPath;
    if (lastFilePath) defaultPath = path.dirname(lastFilePath);
    try {
      let allowMultipleSelection = true;
      let allowedFileTypesName = _("dialog-file-types-comics");
      let allowedFileTypesList = [
        FileExtension.CBZ,
        FileExtension.CBR,
        FileExtension.CB7,
        FileExtension.PDF,
        FileExtension.EPUB,
      ];
      let filePathsList = appUtils.chooseFiles(
        core.getMainWindow(),
        defaultPath,
        allowedFileTypesName,
        allowedFileTypesList,
        allowMultipleSelection,
      );
      if (filePathsList === undefined) {
        return;
      }
      for (let index = 0; index < filePathsList.length; index++) {
        const filePath = filePathsList[index];
        await addFile(filePath);
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

  on("open-path-in-file-browser", (path) => {
    appUtils.openPathInFileBrowser(path);
  });

  on("dragged-files", async (filePaths) => {
    for (let index = 0; index < filePaths.length; index++) {
      const filePath = filePaths[index];
      await addFile(filePath);
    }
  });

  on("tooltip-button-clicked", (text) => {
    sendIpcToRenderer(
      "show-modal-info",
      _("tool-shared-modal-title-info"),
      text,
      _("tool-shared-ui-close").toUpperCase(),
    );
  });

  /////////////////////////

  on("cancel", () => {
    if (!g_cancel) {
      g_cancel = true;
      if (g_workerWindow) {
        g_workerWindow.webContents.send("cancel");
      }
      if (g_worker) {
        log.editor("[EC] sending cancel to worker");
        g_worker.postMessage([core.getLaunchInfo(), "cancel"]);
      } else {
        log.editor("[EC] can't send cancel to worker, no g_worker");
      }
    }
  });

  on(
    "start",
    (
      inputFilePath,
      inputFileType,
      fileNum,
      totalFilesNum,
      pdfExtractionMethod,
      pdfExtractionLib,
    ) => {
      menuBar.setCloseTool(false);
      sendIpcToPreload("update-menubar");
      start(
        inputFilePath,
        inputFileType,
        fileNum,
        totalFilesNum,
        pdfExtractionMethod,
        pdfExtractionLib,
      );
    },
  );

  on("stop-error", (err) => {
    stopError(err);
  });

  on(
    "resize-images",
    (
      inputFilePath,
      outputScaleParams,
      outputFormatParams,
      outputFormat,
      outputFolderPath,
    ) => {
      resizeImages(
        inputFilePath,
        outputScaleParams,
        outputFormatParams,
        outputFormat,
        outputFolderPath,
      );
    },
  );

  on("resizing-error", (err) => {
    stopError(err);
  });

  on(
    "create-file-from-images",
    (imgFilePaths, outputFormat, outputFilePath) => {
      createFolderWithImages(imgFilePaths, outputFilePath); // outputFilePath is really outputFolderPath
    },
  );

  on("end", (wasCanceled, numFiles, numErrors, numAttempted) => {
    if (!wasCanceled) {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-extraction-finished"),
      );

      if (numErrors > 0) {
        sendIpcToRenderer(
          "update-info-text",
          _(
            "tool-shared-modal-info-extraction-error-num-files",
            numErrors,
            numFiles,
          ),
        );
      } else {
        sendIpcToRenderer(
          "update-info-text",
          _("tool-shared-modal-info-extraction-success-num-files", numFiles),
        );
      }
    } else {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-extraction-canceled"),
      );
      sendIpcToRenderer(
        "update-info-text",
        _(
          "tool-shared-modal-info-extraction-results",
          numAttempted - numErrors,
          numErrors,
          numFiles - numAttempted,
        ),
      );
    }

    menuBar.setCloseTool(true);
    sendIpcToPreload("update-menubar");
    sendIpcToRenderer("show-result", _("tool-shared-modal-log-failed-files"));
  });

  on("copy-text-to-clipboard", (text) => {
    clipboard.writeText(text);
    core.showToast(_("ui-modal-prompt-button-copy-log-notification"), 3000);
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

async function addFile(filePath) {
  let stats = fs.statSync(filePath);
  if (!stats.isFile()) return; // avoid folders accidentally getting here
  let fileType;
  let fileExtension = path.extname(filePath).toLowerCase();

  let _fileType = fileUtils.getFileTypeFromPath(filePath);
  if (_fileType !== undefined) {
    fileExtension = "." + _fileType;
  }
  if (fileExtension === "." + FileExtension.PDF) {
    fileType = FileDataType.PDF;
  } else if (fileExtension === "." + FileExtension.EPUB) {
    fileType = FileDataType.EPUB_COMIC;
  } else {
    if (
      fileExtension === "." + FileExtension.RAR ||
      fileExtension === "." + FileExtension.CBR
    ) {
      fileType = FileDataType.RAR;
    } else if (
      fileExtension === "." + FileExtension.ZIP ||
      fileExtension === "." + FileExtension.CBZ
    ) {
      fileType = FileDataType.ZIP;
    } else if (
      fileExtension === "." + FileExtension.SEVENZIP ||
      fileExtension === "." + FileExtension.CB7
    ) {
      fileType = FileDataType.SEVENZIP;
    } else {
      return;
    }
  }
  sendIpcToRenderer("add-file", filePath, fileType);
}

function stopError(error) {
  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
  sendIpcToRenderer("update-log-text", error);
  sendIpcToRenderer(
    "update-log-text",
    _("tool-shared-modal-log-extraction-error"),
  );
  sendIpcToRenderer("finished-error");
}

function stopCancel() {
  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
  sendIpcToRenderer(
    "update-log-text",
    _("tool-shared-modal-log-extraction-canceled"),
  );
  sendIpcToRenderer("finished-canceled");
}

function start(
  inputFilePath,
  inputFileType,
  fileNum,
  totalFilesNum,
  pdfExtractionMethod,
  pdfExtractionLib,
) {
  if (fileNum === 1) g_cancel = false;
  if (fileNum !== 1) sendIpcToRenderer("update-log-text", "");
  sendIpcToRenderer(
    "modal-update-title-text",
    _("tool-shared-modal-title-extracting") +
      (totalFilesNum > 1 ? " (" + fileNum + "/" + totalFilesNum + ")" : ""),
  );
  sendIpcToRenderer(
    "update-info-text",
    utils.reduceStringFrontEllipsis(inputFilePath),
  );
  sendIpcToRenderer("update-log-text", _("tool-shared-modal-title-extracting"));
  sendIpcToRenderer("update-log-text", inputFilePath);

  g_tempSubFolderPath = temp.createSubFolder();
  // extract to temp folder
  if (
    inputFileType === FileDataType.ZIP ||
    inputFileType === FileDataType.RAR ||
    inputFileType === FileDataType.SEVENZIP ||
    inputFileType === FileDataType.EPUB_COMIC ||
    (inputFileType === FileDataType.PDF && pdfExtractionLib === "pdfium")
  ) {
    sendIpcToRenderer(
      "update-log-text",
      _("tool-shared-modal-log-extracting-pages") + "...",
    );
    if (core.isDev() && inputFileType === FileDataType.PDF)
      updateModalLogText("[DEV] pdfium");

    killWorker();
    if (g_worker === undefined) {
      log.editor("[EC] starting worker");
      // strip null form env to avoid exception
      const safeEnv = Object.fromEntries(
        Object.entries(process.env).filter(
          ([_, value]) => typeof value === "string" && !value.includes("\0"),
        ),
      );
      const worker = utilityProcess.fork(
        path.join(__dirname, "../../shared/main/tools-worker.js"),
        {
          env: safeEnv,
          // enable manual GC and set a 3GB hard cap so the worker crashes
          // instead the OS hanging if it uses too much memory, like on large
          // PDFs with pdfium
          execArgv: ["--js-flags=--expose-gc", "--max-old-space-size=3072"],
        },
      );
      worker.on("message", (message) => {
        if (message.type === "testLog") {
          log.test(message.log);
          return;
        } else if (message.type === "editorLog") {
          log.editor("[EC] " + message.log);
          return;
        } else if (message.type === "extraction-progress") {
          sendIpcToRenderer(
            "update-log-text",
            `${_("tool-shared-modal-log-extracting-pages")}: ${message.current} / ${message.total}`,
          );
          return;
        } else {
          // success or failure
          killWorker(); // kill it after one use
          if (message.success) {
            log.debug("file extracted in: " + message.time);
            if (g_cancel === true) {
              stopCancel();
              return;
            }
            sendIpcToRenderer("images-extracted");
            return;
          } else {
            log.error(message.error);
            stopError("Couldn't extract the file");
            return;
          }
        }
      });
      worker.on("error", (error) => {
        log.editor(`[EC] worker error: ${error}`);
      });
      worker.on("exit", (code) => {
        if (g_worker === worker) g_worker = undefined;
        if (code !== 0) {
          stopError(undefined, `worker crashed with code ${code}`);
        }
      });
      worker.postMessage([
        core.getLaunchInfo(),
        "extract",
        inputFilePath,
        inputFileType,
        g_tempSubFolderPath,
        g_initialPassword,
        { pdfExtractionMethod: pdfExtractionMethod },
      ]);
      g_worker = worker;
    }
  }
  // pdfjs
  else if (inputFileType === FileDataType.PDF) {
    sendIpcToRenderer(
      "update-log-text",
      _("tool-shared-modal-log-extracting-pages") + "...",
    );
    if (core.isDev()) updateModalLogText("[DEV] pdfjs");
    /////////////////////////
    // use a hidden window for better performance and node api access
    if (g_workerWindow !== undefined) {
      // shouldn't happen
      g_workerWindow.destroy();
      g_workerWindow = undefined;
    }
    g_workerWindow = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false },
      parent: core.getMainWindow(),
    });
    g_workerWindow.loadFile(
      `${__dirname}/../../shared/renderer/tools-bg-worker.html`,
    );

    g_workerWindow.webContents.on("did-finish-load", function () {
      //g_resizeWindow.webContents.openDevTools();
      g_workerWindow.webContents.send(
        "extract-pdf",
        "tool-extract-comics",
        inputFilePath,
        g_tempSubFolderPath,
        pdfExtractionMethod,
        _("tool-shared-modal-log-extracting-page") + ": ",
        g_initialPassword,
        core.isDev(),
        pdfExtractionLib,
      );
    });
  } else {
    stopError("start: invalid file type");
  }
}

exports.onIpcFromToolsWorkerRenderer = function (...args) {
  switch (args[0]) {
    case "update-log-text":
      sendIpcToRenderer("update-log-text", args[1]);
      break;
    case "pdf-images-extracted":
      g_workerWindow.destroy();
      g_workerWindow = undefined;
      if (!args[1]) sendIpcToRenderer("images-extracted");
      else stopCancel();
      break;
    case "stop-error":
      g_workerWindow.destroy();
      g_workerWindow = undefined;
      stopError(args[1]);
      break;
  }
};

async function resizeImages(
  inputFilePath,
  outputScaleParams,
  outputFormatParams,
  outputFormat,
  outputFolderPath,
) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    const sharp = require("sharp");

    let fileName = path.basename(inputFilePath, path.extname(inputFilePath));
    let subFolderPath = path.join(outputFolderPath, fileName);
    let i = 1;
    while (fs.existsSync(subFolderPath)) {
      i++;
      subFolderPath = path.join(outputFolderPath, fileName + "(" + i + ")");
    }

    let imgFilePaths =
      fileUtils.getImageFilesInFolderRecursive(g_tempSubFolderPath);
    if (imgFilePaths === undefined || imgFilePaths.length === 0) {
      stopError("imgFiles === undefined || imgFiles.length === 0");
      return;
    }
    imgFilePaths.sort(utils.compare);

    // resize
    if (g_cancel === true) {
      stopCancel();
      return;
    }
    if (
      outputScaleParams.option !== "0" ||
      parseInt(outputScaleParams.value) < 100
    ) {
      sendIpcToRenderer(
        "update-log-text",
        _("tool-shared-modal-log-resizing-images") + "...",
      );
      sharp.cache(false);
      for (let index = 0; index < imgFilePaths.length; index++) {
        if (g_cancel === true) {
          stopCancel();
          return;
        }
        sendIpcToRenderer(
          "update-log-text",
          _("tool-shared-modal-log-resizing-image") +
            ": " +
            (index + 1) +
            " / " +
            imgFilePaths.length,
        );
        let filePath = imgFilePaths[index];
        let fileFolderPath = path.dirname(filePath);
        let fileName = path.basename(filePath, path.extname(filePath));
        let tmpFilePath = path.join(
          fileFolderPath,
          fileName + "." + FileExtension.TMP,
        );
        if (outputScaleParams.option === "1") {
          await sharp(filePath)
            .withMetadata()
            .resize({
              height: parseInt(outputScaleParams.value),
              withoutEnlargement: true,
            })
            .toFile(tmpFilePath);
        } else if (outputScaleParams.option === "2") {
          await sharp(filePath)
            .withMetadata()
            .resize({
              width: parseInt(outputScaleParams.value),
              withoutEnlargement: true,
            })
            .toFile(tmpFilePath);
        } else {
          // scale
          let data = await sharp(filePath).metadata();
          await sharp(filePath)
            .withMetadata()
            .resize(
              Math.round(
                data.width * (parseInt(outputScaleParams.value) / 100),
              ),
            )
            .toFile(tmpFilePath);
        }

        fs.unlinkSync(filePath);
        fileUtils.moveFile(tmpFilePath, filePath);
      }
    }

    // change image format
    if (g_cancel === true) {
      stopCancel();
      return;
    }
    if (outputFormat != FileExtension.NOT_SET) {
      sendIpcToRenderer(
        "update-log-text",
        _("tool-shared-modal-log-converting-images") + "...",
      );
      sharp.cache(false); // avoid EBUSY error on windows
      for (let index = 0; index < imgFilePaths.length; index++) {
        if (g_cancel === true) {
          stopCancel();
          return;
        }
        sendIpcToRenderer(
          "update-log-text",
          _("tool-shared-modal-log-converting-image") +
            ": " +
            (index + 1) +
            " / " +
            imgFilePaths.length,
        );
        let filePath = imgFilePaths[index];
        let fileFolderPath = path.dirname(filePath);
        let fileName = path.basename(filePath, path.extname(filePath));
        let tmpFilePath = path.join(
          fileFolderPath,
          fileName + "." + FileExtension.TMP,
        );
        if (outputFormat === FileExtension.JPG) {
          await sharp(filePath)
            .withMetadata()
            .jpeg({
              quality: parseInt(outputFormatParams.jpgQuality),
              mozjpeg: outputFormatParams.jpgMozjpeg,
            })
            .toFile(tmpFilePath);
        } else if (outputFormat === FileExtension.PNG) {
          if (parseInt(outputFormatParams.pngQuality) < 100) {
            await sharp(filePath)
              .withMetadata()
              .png({
                quality: parseInt(outputFormatParams.pngQuality),
              })
              .toFile(tmpFilePath);
          } else {
            await sharp(filePath).withMetadata().png().toFile(tmpFilePath);
          }
        } else if (outputFormat === FileExtension.WEBP) {
          await sharp(filePath)
            .withMetadata()
            .webp({
              quality: parseInt(outputFormatParams.webpQuality),
            })
            .toFile(tmpFilePath);
        } else if (outputFormat === FileExtension.AVIF) {
          await sharp(filePath)
            .withMetadata()
            .avif({
              quality: parseInt(outputFormatParams.avifQuality),
            })
            .toFile(tmpFilePath);
        }
        let newFilePath = path.join(
          fileFolderPath,
          fileName + "." + outputFormat,
        );
        fs.unlinkSync(filePath);
        fileUtils.moveFile(tmpFilePath, newFilePath);
        imgFilePaths[index] = newFilePath;
      }
    }
    createFolderWithImages(imgFilePaths, subFolderPath);
  } catch (error) {
    stopError(error);
  }
}

async function createFolderWithImages(imgFilePaths, outputFolderPath) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    sendIpcToRenderer(
      "update-log-text",
      _("tool-ec-modal-log-extracting-to") + ":",
    );
    sendIpcToRenderer("update-log-text", outputFolderPath);
    // create subFolderPath
    if (!fs.existsSync(outputFolderPath)) {
      fs.mkdirSync(outputFolderPath);
      for (let index = 0; index < imgFilePaths.length; index++) {
        let oldPath = imgFilePaths[index];
        let newPath = path.join(outputFolderPath, path.basename(oldPath));
        fileUtils.moveFile(oldPath, newPath);
      }
      temp.deleteSubFolder(g_tempSubFolderPath);
      g_tempSubFolderPath = undefined;
      sendIpcToRenderer("finished-ok");
    } else {
      stopError("tool-ec folder shouldn't exist");
    }
  } catch (err) {
    stopError(err);
  }
}

///////////////////////////////////////////////////////////////////////////////
// WORKER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function killWorker() {
  if (g_worker !== undefined) {
    log.editor("[EC] killing worker");
    g_worker?.kill();
    g_worker = undefined;
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOG ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateModalLogText(inputText, append = true) {
  sendIpcToRenderer("update-log-text", inputText, append);
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    localization.getLocalization(),
    localization.getTooltipsLocalization(),
    localization.getLocalizedTexts(),
  );
}
exports.updateLocalizedText = updateLocalizedText;
