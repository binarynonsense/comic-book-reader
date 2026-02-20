/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { BrowserWindow, clipboard } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const localization = require("./main/localization");

const { FileExtension, FileDataType } = require("../../shared/main/constants");
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const settings = require("../../shared/main/settings");
const utils = require("../../shared/main/utils");
const contextMenu = require("../../shared/main/tools-menu-context");
const log = require("../../shared/main/logger");
const temp = require("../../shared/main/temp");
const tools = require("../../shared/main/tools");
const menuBar = require("../../shared/main/menu-bar");
const timers = require("../../shared/main/timers");
const forkUtils = require("../../shared/main/fork-utils");
const {
  processImages,
  processImagesWithWorkers,
} = require("../../shared/main/tools-process-images");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

const ToolMode = {
  CONVERT: 0,
  CREATE: 1,
  EXTRACT: 2,
};
let g_mode = ToolMode.CONVERT;

let g_cancel = false;
let g_worker;
let g_workerWindow;

// hack to allow this at least for files from File>Convert...
let g_inputPassword = "";
let g_tempSubFolderPath;
let g_creationTempSubFolderPath;

let g_uiSelectedOptions = {};
let g_imageIndex = 0;

let g_inputFiles;
let g_inputFilesIndex;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }

  g_initialPassword = "";
  g_uiSelectedOptions.outputFileBaseName = undefined;
}

exports.open = async function (options) {
  // called by switchTool when opening tool
  g_mode = options.mode;
  init();
  if (options.inputPassword) g_inputPassword = options.inputPassword;
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());

  updateLocalizedText();

  let loadedOptions = settings.loadToolOptions(`tool-cc-${g_mode}`);
  sendIpcToRenderer(
    "show",
    g_mode,
    appUtils.getDesktopFolderPath(),
    settings.canEditRars(),
    loadedOptions,
    Math.max(1, Math.floor(os.cpus().length / 2)),
  );

  updateLocalizedText();

  if (options.inputFilePaths) {
    for (let index = 0; index < options.inputFilePaths.length; index++) {
      addPathToInputList(options.inputFilePaths[index]);
    }
  }
  if (options.outputFolderPath) {
    sendIpcToRenderer("change-output-folder", options.outputFolderPath);
  }
  if (options.outputFormat) {
    sendIpcToRenderer("change-output-format", options.outputFormat);
  }
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
  temp.deleteSubFolder(g_creationTempSubFolderPath);
  g_tempSubFolderPath = undefined;
  g_creationTempSubFolderPath = undefined;
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
  core.sendIpcToRenderer("tool-convert-comics", ...args);
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
  ////////////////////////////////////////
  // UI //////////////////////////////////
  ////////////////////////////////////////

  on("close-clicked", () => {
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
      `tool-cc-${g_mode}`,
      options["tool-cc-setting-remember-checkbox"] ? options : undefined,
    );
    if (forceQuit) {
      core.forceQuit();
    }
  });

  on("add-file-clicked", async (lastFilePath) => {
    let defaultPath;
    if (lastFilePath) defaultPath = path.dirname(lastFilePath);
    try {
      let allowMultipleSelection = true;
      let allowedFileTypesName;
      let allowedFileTypesList;
      if (g_mode === ToolMode.CONVERT || g_mode === ToolMode.EXTRACT) {
        allowedFileTypesName = _("dialog-file-types-comics");
        allowedFileTypesList = [
          FileExtension.CBZ,
          FileExtension.CBR,
          FileExtension.CB7,
          FileExtension.PDF,
          FileExtension.EPUB,
          FileExtension.MOBI,
          FileExtension.FB2,
        ];
      } else {
        allowedFileTypesName = _("dialog-file-types-comics-images");
        allowedFileTypesList = [
          FileExtension.JPG,
          FileExtension.JPEG,
          FileExtension.PNG,
          FileExtension.WEBP,
          FileExtension.BMP,
          FileExtension.AVIF,
          FileExtension.CBZ,
          FileExtension.CBR,
          FileExtension.CB7,
          FileExtension.PDF,
          FileExtension.EPUB,
          FileExtension.MOBI,
          FileExtension.FB2,
        ];
      }
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
        addPathToInputList(filePath);
      }
    } catch (err) {
      // TODO: do something?
    }
  });

  on("add-folder-clicked", (lastPath) => {
    let defaultPath;
    if (lastPath !== undefined) {
      defaultPath = path.dirname(lastPath);
    }
    let folderPathsList = appUtils.chooseFolder(
      core.getMainWindow(),
      defaultPath,
      true,
    );
    if (folderPathsList === undefined) {
      return;
    }
    for (let index = 0; index < folderPathsList.length; index++) {
      const folderPath = folderPathsList[index];
      addPathToInputList(folderPath);
    }
  });

  on("change-folder-clicked", (inputFilePath, outputFolderPath) => {
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

  on("dragged-files", (filePaths) => {
    for (let index = 0; index < filePaths.length; index++) {
      const filePath = filePaths[index];
      addPathToInputList(filePath);
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

  ////////////////////////////////////////
  // CONVERSION //////////////////////////
  ////////////////////////////////////////

  on("start-clicked", async (...args) => {
    onStartClicked(...args);
  });

  on("start", (...args) => {
    menuBar.setCloseTool(false);
    sendIpcToPreload("update-menubar");
    start(...args);
  });

  on("start-file", (...args) => {
    startFile(...args);
  });

  on("process-content", (...args) => {
    processContent(...args);
  });

  /////////////////////////

  on("cancel", () => {
    log.editor("[CC] cancel received");
    if (!g_cancel) {
      g_cancel = true;
      if (g_workerWindow) {
        g_workerWindow.webContents.send("cancel");
      }
      if (g_worker) {
        log.editor("[CC] sending cancel to worker");
        g_worker.postMessage([core.getLaunchInfo(), "cancel"]);
      } else {
        log.editor("[CC] can't send cancel to worker, no g_worker");
      }
    }
  });

  on("stop-error", (errorMsg) => {
    stopError(undefined, errorMsg);
  });

  on("end", (...args) => {
    end(...args);
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
// TOOL START /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onStartClicked(inputList, selectedOptions) {
  g_inputFiles = [];

  function isAlreadyInInputList(filePath) {
    return g_inputFiles.some((e) => e.path === filePath);
  }

  g_uiSelectedOptions = structuredClone(selectedOptions);
  for (let index = 0; index < inputList.length; index++) {
    const inputListItem = inputList[index];
    if (inputListItem.type === 0) {
      // FILE
      let type = await getFileType(inputListItem.path);
      if (type != undefined && !isAlreadyInInputList(inputListItem.path)) {
        g_inputFiles.push({
          path: inputListItem.path,
          type: type,
        });
      }
    } else {
      // DIR
      if (g_uiSelectedOptions.inputFoldersContain === "images") {
        // folder content = comic book images
        if (!isAlreadyInInputList(inputListItem.path)) {
          g_inputFiles.push({
            path: inputListItem.path,
            type: FileDataType.IMGS_FOLDER,
          });
        }
      } else {
        // folder content = comic book files
        let filesInFolder = [];
        if (g_uiSelectedOptions.inputSearchFoldersRecursively) {
          filesInFolder = fileUtils.getFilesInFolderRecursive(
            inputListItem.path,
            g_uiSelectedOptions.inputSearchFoldersFormats,
          );
        } else {
          filesInFolder = fileUtils.getFilesInFolder(
            inputListItem.path,
            g_uiSelectedOptions.inputSearchFoldersFormats,
          );
        }
        if (g_uiSelectedOptions.inputSearchFoldersRecursively) {
          for (let j = 0; j < filesInFolder.length; j++) {
            const element = filesInFolder[j];
            const filePath = element;
            let type = await getFileType(filePath);
            if (type != undefined && !isAlreadyInInputList(filePath)) {
              if (
                g_uiSelectedOptions.outputKeepSubfoldersStructure &&
                g_uiSelectedOptions.inputFoldersContain === "comics"
              ) {
                let outputFolderPath = path.join(
                  g_uiSelectedOptions.outputFolderPath,
                  path.basename(inputListItem.path),
                  path.relative(inputListItem.path, path.dirname(filePath)),
                );
                g_inputFiles.push({
                  path: filePath,
                  type: type,
                  outputFolderPath,
                });
              } else {
                g_inputFiles.push({
                  path: filePath,
                  type: type,
                });
              }
            }
          }
        } else {
          for (let j = 0; j < filesInFolder.length; j++) {
            const element = filesInFolder[j];
            const filePath = path.join(inputListItem.path, element);
            let type = await getFileType(filePath);
            if (type != undefined && !isAlreadyInInputList(filePath)) {
              g_inputFiles.push({
                path: filePath,
                type: type,
              });
            }
          }
        }
      }
    }
  }
  if (g_inputFiles.length > 0)
    sendIpcToRenderer("start-accepted", g_inputFiles);
  else
    sendIpcToRenderer(
      "show-modal-info",
      _("tool-shared-modal-title-error"),
      _("tool-shared-modal-log-failed-reason-no-valid-file"),
      _("tool-shared-ui-close").toUpperCase(),
    );
}

//////////////////////

function start() {
  timers.start("convert-comics");
  g_cancel = false;
  g_imageIndex = 0;
  g_inputFilesIndex = undefined;
  if (g_mode === ToolMode.CONVERT || g_mode === ToolMode.EXTRACT) {
    g_uiSelectedOptions.outputFileBaseName = undefined;
    sendIpcToRenderer("start-first-file");
  } else {
    // ToolMode.CREATE
    g_tempSubFolderPath = temp.createSubFolder();
    // check types
    let areAllImages = true;
    for (let index = 0; index < g_inputFiles.length; index++) {
      const inputFile = g_inputFiles[index];
      if (inputFile.type !== FileDataType.IMG) {
        areAllImages = false;
        break;
      }
    }
    if (areAllImages) {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-creating"),
      );
      for (let index = 0; index < g_inputFiles.length; index++) {
        const inputFilePath = g_inputFiles[index].path;
        let outName = path.basename(inputFilePath);
        if (g_uiSelectedOptions.outputPageOrder === "byPosition") {
          const extension = path.extname(inputFilePath);
          outName = g_imageIndex++ + extension;
        }
        const outPath = path.join(g_tempSubFolderPath, outName);
        fs.copyFileSync(inputFilePath, outPath, fs.constants.COPYFILE_EXCL);
      }
      sendIpcToRenderer("file-images-extracted");
    } else {
      sendIpcToRenderer("start-first-file");
    }
  }
}

//////////////////////

function startFile(inputFileIndex, totalFilesNum) {
  try {
    g_inputFilesIndex = inputFileIndex;

    if (g_cancel === true) {
      stopCancel();
      return;
    }
    let inputFilePath = g_inputFiles[g_inputFilesIndex].path;
    let inputFileType = g_inputFiles[g_inputFilesIndex].type;
    let fileNum = g_inputFilesIndex + 1;
    if (fileNum !== 1 && g_mode === ToolMode.CREATE) updateModalLogText("");
    let updateTitle;
    if (g_mode === ToolMode.CONVERT)
      updateTitle = _("tool-shared-modal-title-converting");
    else if (g_mode === ToolMode.CREATE)
      updateTitle = _("tool-shared-modal-title-adding");
    else if (g_mode === ToolMode.EXTRACT)
      updateTitle = _("tool-shared-modal-title-extracting");
    sendIpcToRenderer(
      "modal-update-title-text",
      updateTitle +
        (totalFilesNum > 1 ? " (" + fileNum + "/" + totalFilesNum + ")" : ""),
    );
    sendIpcToRenderer(
      "update-info-text",
      utils.reduceStringFrontEllipsis(inputFilePath),
    );
    updateModalLogText(updateTitle);
    updateModalLogText(inputFilePath);
    log.debug(`[CC] ${updateTitle}: ${inputFilePath}`);

    // check if output file name exists and skip mode
    {
      if (g_uiSelectedOptions.outputFileSameName === "skip") {
        let outputFolderPath = g_uiSelectedOptions.outputFolderPath;
        if (g_inputFiles[g_inputFilesIndex].outputFolderPath) {
          outputFolderPath = g_inputFiles[g_inputFilesIndex].outputFolderPath;
        }
        if (
          g_mode === ToolMode.CONVERT &&
          g_uiSelectedOptions.outputFolderOption == "1"
        ) {
          outputFolderPath = path.dirname(inputFilePath);
        }
        let baseFileName =
          g_uiSelectedOptions.outputFileBaseName ??
          path.basename(inputFilePath, path.extname(inputFilePath));

        const outputFormat = g_uiSelectedOptions.outputFormat;
        const outputSplitNumFiles = g_uiSelectedOptions.outputSplitNumFiles;

        let skip = undefined;
        if (outputFormat === FileDataType.IMGS_FOLDER) {
          let outputSubFolderPath = path.join(outputFolderPath, baseFileName);
          if (fs.existsSync(outputSubFolderPath)) {
            skip = { path: outputSubFolderPath, isFile: false };
          }
        } else if (outputSplitNumFiles <= 1) {
          // just one file in the output folder
          let outputFilePath = path.join(
            outputFolderPath,
            baseFileName + "." + outputFormat,
          );
          if (fs.existsSync(outputFilePath)) {
            skip = { path: outputFilePath, isFile: true };
          }
        } else {
          // multiple files in a subfolder in the output folder
          let outputSubFolderPath = path.join(outputFolderPath, baseFileName);
          if (fs.existsSync(outputSubFolderPath)) {
            skip = { path: outputSubFolderPath, isFile: false };
          }
        }
        if (skip) {
          stopError(
            undefined,
            (skip.isFile
              ? _("tool-shared-modal-log-failed-reason-output-file-exists")
              : _("tool-shared-modal-log-failed-reason-output-folder-exists")) +
              "\n" +
              skip.path,
            false,
          );
          return;
        }
      }
    }
    ////////////////
    if (g_mode === ToolMode.CONVERT || g_mode === ToolMode.EXTRACT) {
      g_tempSubFolderPath = temp.createSubFolder();
    } else {
      // g_tempSubFolderPath was created on start
      g_creationTempSubFolderPath = temp.createSubFolder();
    }
    // extract to temp folder
    if (inputFileType === FileDataType.IMGS_FOLDER) {
      g_imageIndex = 0;
      copyImagesToTempFolder(
        inputFilePath,
        g_uiSelectedOptions.inputSearchFoldersRecursively,
      );
      sendIpcToRenderer("file-images-extracted");
    } else if (inputFileType === FileDataType.IMG) {
      const extension = path.extname(inputFilePath);
      let outName = g_imageIndex++ + extension;
      const outPath = path.join(g_tempSubFolderPath, outName);
      fs.copyFileSync(inputFilePath, outPath, fs.constants.COPYFILE_EXCL);
      temp.deleteSubFolder(g_creationTempSubFolderPath);
      g_creationTempSubFolderPath = undefined;
      sendIpcToRenderer("file-images-extracted");
    } else if (
      inputFileType === FileDataType.ZIP ||
      inputFileType === FileDataType.RAR ||
      inputFileType === FileDataType.SEVENZIP ||
      inputFileType === FileDataType.MOBI ||
      inputFileType === FileDataType.AZW3 ||
      inputFileType === FileDataType.FB2 ||
      inputFileType === FileDataType.EPUB_COMIC ||
      inputFileType === FileDataType.EPUB_EBOOK ||
      (inputFileType === FileDataType.PDF &&
        !g_uiSelectedOptions.inputPdfExtractionLib.startsWith("pdfjs"))
    ) {
      updateModalLogText(_("tool-shared-modal-log-extracting-pages") + "...");
      log.debug("[CC] " + _("tool-shared-modal-log-extracting-pages") + "...");
      if (core.isDev()) {
        if (inputFileType === FileDataType.PDF)
          updateModalLogText("[DEV] mupdf pdf");
        if (
          inputFileType === FileDataType.EPUB_EBOOK ||
          inputFileType === FileDataType.MOBI ||
          inputFileType === FileDataType.AZW3 ||
          inputFileType === FileDataType.FB2
        )
          updateModalLogText("[DEV] mupdf epub");
      }

      killWorker();
      if (g_worker === undefined) {
        log.editor("[CC] starting worker (extract)");
        const worker = forkUtils.fork(
          path.join(__dirname, "../../shared/main/tools-worker-process.js"),
          { exposeGC: true, memoryLimit: 3072 },
        );
        worker.on("message", (message) => {
          if (message.type === "testLog") {
            log.test(message.log);
            return;
          } else if (message.type === "editorLog") {
            log.editor("[CC] " + message.log);
            return;
          } else if (message.type === "debugLog") {
            log.debug("[CC] " + message.log);
            return;
          } else if (message.type === "extraction-progress") {
            updateModalLogText(
              `${_("tool-shared-modal-log-extracting-pages")}: ${message.current} / ${message.total}`,
            );
            return;
          } else if (message.type === undefined) {
            // success or failure
            killWorker();
            if (message.success || message.cancelled) {
              if (g_cancel === true) {
                stopCancel();
                return;
              }
              log.debug("[CC] file extracted in: " + message.time);
              if (g_mode === ToolMode.CREATE) {
                copyImagesToTempFolder(g_creationTempSubFolderPath, true);
                temp.deleteSubFolder(g_creationTempSubFolderPath);
                g_creationTempSubFolderPath = undefined;
              }
              sendIpcToRenderer("file-images-extracted");
              return;
            } else {
              if (message.error === "no_disk_space") {
                message.error =
                  _("tool-shared-modal-log-failed-reason-temp-disk-space") +
                  "\n" +
                  _("tool-shared-modal-log-failed-reason-temp-disk-space-2");
              }
              stopError(
                message.error,
                _("tool-shared-modal-log-failed-extraction"),
              );
              return;
            }
          }
        });
        worker.on("error", (error) => {
          log.editor(`[CC] worker error: ${error}`);
        });
        worker.on("exit", (code) => {
          if (g_worker === worker) g_worker = undefined;
          if (code !== 0) {
            log.editor(`[CC] worker crashed with code ${code}`);
            stopError(undefined, `worker crashed with code ${code}`);
          }
        });
        function getExtraData(inputFileType) {
          if (inputFileType === FileDataType.PDF) {
            return {
              method: g_uiSelectedOptions.inputPdfExtractionMethod,
              dpi: g_uiSelectedOptions.inputPdfExtractionDpi,
              height: g_uiSelectedOptions.inputPdfExtractionHeight,
              lib: g_uiSelectedOptions.inputPdfExtractionLib,
            };
          } else if (
            inputFileType === FileDataType.EPUB_EBOOK ||
            inputFileType === FileDataType.MOBI ||
            inputFileType === FileDataType.AZW3 ||
            inputFileType === FileDataType.FB2
          ) {
            return g_uiSelectedOptions.inputEpubExtraction;
          }
          return undefined;
        }
        worker.postMessage([
          core.getLaunchInfo(),
          "extract",
          inputFilePath,
          inputFileType,
          g_mode === ToolMode.CONVERT || g_mode === ToolMode.EXTRACT
            ? g_tempSubFolderPath
            : g_creationTempSubFolderPath,
          g_inputPassword,
          getExtraData(inputFileType),
        ]);
        g_worker = worker;
      }
    }
    // pdfjs
    else if (inputFileType === FileDataType.PDF) {
      updateModalLogText(_("tool-shared-modal-log-extracting-pages") + "...");
      log.debug("[CC] " + _("tool-shared-modal-log-extracting-pages") + "...");
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
          "tool-convert-comics",
          inputFilePath,
          g_mode === ToolMode.CONVERT || g_mode === ToolMode.EXTRACT
            ? g_tempSubFolderPath
            : g_creationTempSubFolderPath,
          _("tool-shared-modal-log-extracting-page") + ": ",
          g_inputPassword,
          core.isDev(),
          {
            method: g_uiSelectedOptions.inputPdfExtractionMethod,
            dpi: g_uiSelectedOptions.inputPdfExtractionDpi,
            height: g_uiSelectedOptions.inputPdfExtractionHeight,
            lib: g_uiSelectedOptions.inputPdfExtractionLib,
          },
        );
      });
    } else {
      stopError(undefined, "start: invalid file type");
    }
  } catch (error) {
    stopError(error);
  }
}

//////////////////////

exports.onIpcFromToolsWorkerRenderer = function (...args) {
  switch (args[0]) {
    case "update-log-text":
      updateModalLogText(args[1]);
      break;
    case "pdf-images-extracted":
      g_workerWindow.destroy();
      g_workerWindow = undefined;
      if (!args[1]) {
        if (g_mode === ToolMode.CREATE) {
          copyImagesToTempFolder(g_creationTempSubFolderPath, true);
          temp.deleteSubFolder(g_creationTempSubFolderPath);
          g_creationTempSubFolderPath = undefined;
        }
        sendIpcToRenderer("file-images-extracted");
      } else stopCancel();
      break;
    case "stop-error":
      g_workerWindow.destroy();
      g_workerWindow = undefined;
      stopError(undefined, args[1]);
      break;
  }
};

///////////////////////////////////////////////////////////////////////////////
// TOOL END ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function end(wasCanceled, numFiles, numErrors, numAttempted) {
  const conversionTime = timers.stop("convert-comics");
  log.debug(`[CC] total conversion time: ${conversionTime.toFixed(2)}s`);
  if (conversionTime >= 60) {
    const minutes = Math.floor(conversionTime / 60);
    let seconds = (conversionTime - minutes * 60).toFixed(0);
    if (seconds.length < 2) seconds = "0" + seconds;
    updateModalLogText(
      `${_("tool-shared-modal-log-total-time")}: ${minutes}m ${seconds}s`,
    );
  } else {
    updateModalLogText(
      `${_("tool-shared-modal-log-total-time")}: ${conversionTime.toFixed(0)}s`,
    );
  }
  updateModalLogText("");
  if (!wasCanceled) {
    if (g_mode === ToolMode.CONVERT) {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-conversion-finished"),
      );

      if (numErrors > 0) {
        sendIpcToRenderer(
          "update-info-text",
          _(
            "tool-shared-modal-info-conversion-error-num-files",
            numErrors,
            numFiles,
          ),
        );
      } else {
        sendIpcToRenderer(
          "update-info-text",
          _("tool-shared-modal-info-conversion-success-num-files", numFiles),
        );
      }
    } else if (g_mode === ToolMode.EXTRACT) {
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
      if (numErrors > 0) {
        sendIpcToRenderer(
          "modal-update-title-text",
          _("tool-shared-modal-title-creation-failed"),
        );
        sendIpcToRenderer("update-info-text", "");
      } else {
        sendIpcToRenderer(
          "modal-update-title-text",
          _("tool-shared-modal-title-creation-finished"),
        );
      }
    }
  } else {
    sendIpcToRenderer(
      "modal-update-title-text",
      g_mode === ToolMode.CONVERT
        ? _("tool-shared-modal-title-conversion-canceled")
        : g_mode === ToolMode.EXTRACT
          ? _("tool-shared-modal-title-extraction-canceled")
          : _("tool-shared-modal-title-creation-canceled"),
    );
    sendIpcToRenderer(
      "update-info-text",
      g_mode === ToolMode.CONVERT
        ? _(
            "tool-shared-modal-info-conversion-results",
            numAttempted - numErrors,
            numErrors,
            numFiles - numAttempted,
          )
        : g_mode === ToolMode.EXTRACT
          ? _(
              "tool-shared-modal-info-extraction-results",
              numAttempted - numErrors,
              numErrors,
              numFiles - numAttempted,
            )
          : "",
    );
  }

  menuBar.setCloseTool(true);
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("show-result", _("tool-shared-modal-log-failed-files"));
}

function stopError(error, errorMessage, nameAsError = true) {
  let uiMsg = errorMessage;
  if (error) {
    log.error(error);
    if (error.message) {
      uiMsg = (errorMessage ? errorMessage + "\n" : "") + error.message;
      log.error(uiMsg);
    } else {
      const toString = error.toString();
      if (
        toString &&
        toString !== "" &&
        !toString.includes("[object Object]")
      ) {
        uiMsg = (errorMessage ? errorMessage + "\n" : "") + toString;
        log.error(uiMsg);
      } else {
        uiMsg = (errorMessage ? errorMessage + "\n" : "") + "Unknown error";
        log.error(uiMsg);
      }
    }
  } else {
    if (!uiMsg) uiMsg = "Unknown error";
    if (nameAsError) log.error(errorMessage);
  }
  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
  temp.deleteSubFolder(g_creationTempSubFolderPath);
  g_creationTempSubFolderPath = undefined;
  if (nameAsError) {
    updateModalLogText(uiMsg);
    if (g_mode === ToolMode.CREATE) updateModalLogText("");
    updateModalLogText(
      g_mode === ToolMode.CONVERT
        ? _("tool-shared-modal-log-conversion-error")
        : g_mode === ToolMode.EXTRACT
          ? _("tool-shared-modal-log-extraction-error")
          : _("tool-shared-modal-log-creation-error"),
    );
  } else {
    // not really an error. if file is skipped, for example
    updateModalLogText(
      g_mode === ToolMode.CONVERT
        ? _("tool-shared-modal-log-failed-conversion")
        : g_mode === ToolMode.EXTRACT
          ? _("tool-shared-modal-log-failed-extraction")
          : _("tool-shared-modal-log-failed-creation"),
    );
    updateModalLogText(uiMsg);
  }

  updateModalLogText(" ");
  sendIpcToRenderer("file-finished-error");
}

function stopCancel() {
  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
  temp.deleteSubFolder(g_creationTempSubFolderPath);
  g_creationTempSubFolderPath = undefined;
  updateModalLogText(
    g_mode === ToolMode.CONVERT
      ? _("tool-shared-modal-log-conversion-canceled")
      : g_mode === ToolMode.EXTRACT
        ? _("tool-shared-modal-log-extraction-canceled")
        : _("tool-shared-modal-log-creation-canceled"),
  );
  updateModalLogText("");
  sendIpcToRenderer("file-finished-canceled");
}

///////////////////////////////////////////////////////////////////////////////
// TOOL UTILS /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function addPathToInputList(inputPath) {
  if (fs.existsSync(inputPath)) {
    let type = 0;
    if (fs.lstatSync(inputPath)?.isDirectory()) {
      type = 1;
    } else {
      if (g_mode === ToolMode.CONVERT || g_mode === ToolMode.EXTRACT) {
        if (!fileUtils.hasComicBookExtension(inputPath)) return;
      } else {
        if (
          !(
            fileUtils.hasComicBookExtension(inputPath) ||
            fileUtils.hasImageExtension(inputPath)
          )
        )
          return;
      }
    }
    sendIpcToRenderer("add-item-to-input-list", inputPath, type);
  }
}

async function getFileType(filePath) {
  let stats = fs.statSync(filePath);
  // avoid folders accidentally getting here
  if (!stats.isFile()) return undefined;
  // let fileExtension = path.extname(filePath).toLowerCase();

  let detectedFileType = await fileUtils.getFileTypeFromPath(filePath);
  log.debug("[CC] " + filePath + " detected as: " + detectedFileType);
  if (detectedFileType === undefined) {
    return undefined;
  }
  //////////
  if (detectedFileType === FileDataType.EPUB) {
    if (g_uiSelectedOptions.inputEpubExtraction.bookType === "0") {
      // autodetect
      const epubType = await fileUtils.getEpubType(filePath);
      log.debug(`[CC] epub book type autodetected as: ${epubType}`);
      return epubType === "comic"
        ? FileDataType.EPUB_COMIC
        : FileDataType.EPUB_EBOOK;
    } else if (g_uiSelectedOptions.inputEpubExtraction.bookType === "1") {
      return FileDataType.EPUB_COMIC;
    } else {
      return FileDataType.EPUB_EBOOK;
    }
  } else if (
    detectedFileType === FileDataType.PDF ||
    detectedFileType === FileDataType.RAR ||
    detectedFileType === FileDataType.ZIP ||
    detectedFileType === FileDataType.SEVENZIP ||
    detectedFileType === FileDataType.MOBI ||
    detectedFileType === FileDataType.AZW3 ||
    detectedFileType === FileDataType.FB2
  ) {
    return detectedFileType;
  } else if (
    g_mode === ToolMode.CREATE &&
    (detectedFileType === FileDataType.JPG ||
      detectedFileType === FileDataType.PNG ||
      detectedFileType === FileDataType.WEBP ||
      detectedFileType === FileDataType.BMP ||
      detectedFileType === FileDataType.AVIF)
  ) {
    return FileDataType.IMG;
  } else {
    return undefined;
  }
}

function copyImagesToTempFolder(sourceFolderPath, doRecursively) {
  if (!sourceFolderPath) return;
  let imgFilePaths;
  if (doRecursively)
    imgFilePaths = fileUtils.getImageFilesInFolderRecursive(sourceFolderPath);
  else imgFilePaths = fileUtils.getImageFilesInFolder(sourceFolderPath);
  if (imgFilePaths !== undefined && imgFilePaths.length > 0) {
    imgFilePaths.sort(utils.compare);
    imgFilePaths.forEach((imgFilePath) => {
      const extension = path.extname(imgFilePath);
      let outName = g_imageIndex++ + extension;
      const outPath = path.join(g_tempSubFolderPath, outName);
      fs.copyFileSync(imgFilePath, outPath, fs.constants.COPYFILE_EXCL);
    });
  }
}

///////////////////////////////////////////////////////////////////////////////
// IMAGE OPERATIONS ///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function processContent(inputFilePath) {
  try {
    ///////////////////////////////////////////////
    // SORT FILES /////////////////////////////////
    ///////////////////////////////////////////////
    let comicInfoFilePath =
      g_mode === ToolMode.CONVERT
        ? fileUtils.getComicInfoFileInFolderRecursive(g_tempSubFolderPath)
        : undefined;
    let imgFilePaths =
      fileUtils.getImageFilesInFolderRecursive(g_tempSubFolderPath);
    if (imgFilePaths === undefined || imgFilePaths.length === 0) {
      stopError(undefined, _("tool-shared-modal-log-error-noimagesfound"));
      return;
    }
    if (
      g_mode === ToolMode.CREATE ||
      g_inputFiles[g_inputFilesIndex].type === FileDataType.IMGS_FOLDER
    ) {
      // pad numerical names
      imgFilePaths.forEach((filePath) => {
        let fileName = path.basename(filePath, path.extname(filePath));
        let newFilePath = path.join(
          path.dirname(filePath),
          utils.padNumber(
            fileName,
            Math.max(imgFilePaths.length, g_imageIndex),
          ) + path.extname(filePath),
        );
        if (filePath !== newFilePath) {
          fileUtils.moveFile(filePath, newFilePath);
        }
      });
      imgFilePaths =
        fileUtils.getImageFilesInFolderRecursive(g_tempSubFolderPath);
    }
    imgFilePaths.sort(utils.compare);
    ///////////////////////////////////////////////
    // CHECK REQUIREMENTS /////////////////////////
    ///////////////////////////////////////////////
    let resizeNeeded = false;
    let imageOpsNeeded = false;
    let updateComicInfoNeeded =
      comicInfoFilePath &&
      (g_uiSelectedOptions.outputFormat === FileExtension.CBZ ||
        g_uiSelectedOptions.outputFormat === FileExtension.CB7) &&
      (g_uiSelectedOptions.outputImageFormat != FileExtension.NOT_SET ||
        resizeNeeded ||
        imageOpsNeeded);
    g_uiSelectedOptions.outputImageScalePercentage = parseInt(
      g_uiSelectedOptions.outputImageScalePercentage,
    );
    if (
      g_uiSelectedOptions.outputImageScaleOption !== "0" ||
      g_uiSelectedOptions.outputImageScalePercentage < 100
    ) {
      resizeNeeded = true;
    }
    if (
      g_uiSelectedOptions.outputBrightnessApply ||
      g_uiSelectedOptions.outputSaturationApply ||
      (g_uiSelectedOptions.outputCropApply &&
        g_uiSelectedOptions.outputCropValue > 0) ||
      (g_uiSelectedOptions.outputExtendApply &&
        g_uiSelectedOptions.outputExtendValue > 0)
    ) {
      imageOpsNeeded = true;
    }
    if (g_cancel === true) {
      stopCancel();
      return;
    }
    ///////////////////////////////////////////////
    // MODIFY IMAGES //////////////////////////////
    ///////////////////////////////////////////////
    if (
      resizeNeeded ||
      imageOpsNeeded ||
      g_uiSelectedOptions.outputFormat === FileExtension.PDF ||
      g_uiSelectedOptions.outputFormat === FileExtension.EPUB ||
      g_uiSelectedOptions.outputImageFormat != FileExtension.NOT_SET
    ) {
      log.debug("[CC] " + _("tool-shared-modal-log-converting-images"));
      switch (
        parseInt(g_uiSelectedOptions.imageProcessingMultithreadingMethod)
      ) {
        case 1:
          {
            const result = await processImages({
              imgFilePaths,
              resizeNeeded,
              imageOpsNeeded,
              updateModalLogText,
              modalInfoText: _("tool-shared-modal-log-converting-image"),
              uiSelectedOptions: g_uiSelectedOptions,
              getCancel: () => {
                return g_cancel;
              },
            });
            if (result.state === "error") {
              stopError(result.error);
              return;
            }
          }
          break;
        default:
          {
            const result = await processImagesWithWorkers({
              imgFilePaths,
              resizeNeeded,
              imageOpsNeeded,
              updateModalLogText,
              modalInfoText: _("tool-shared-modal-log-converting-image"),
              uiSelectedOptions: g_uiSelectedOptions,
              getCancel: () => {
                return g_cancel;
              },
            });
            if (result.state === "error") {
              stopError(result.error);
              return;
            }
          }
          break;
      }
      if (g_cancel === true) {
        stopCancel();
        return;
      }
    }
    ///////////////////////////////////////////////
    // UPDATE COMIC INFO //////////////////////////
    ///////////////////////////////////////////////
    if (updateComicInfoNeeded) {
      // update comicbook.xml if available, needs changing and the output format
      // is right
      try {
        const {
          XMLParser,
          XMLBuilder,
          XMLValidator,
        } = require("fast-xml-parser");
        const xmlFileData = fs.readFileSync(comicInfoFilePath, "utf8");
        const isValidXml = XMLValidator.validate(xmlFileData);
        if (isValidXml === true) {
          // open
          const parserOptions = {
            ignoreAttributes: false,
          };
          const parser = new XMLParser(parserOptions);
          let json = parser.parse(xmlFileData);
          // modify
          updateModalLogText(_("tool-shared-modal-log-updating-comicinfoxml"));

          if (!json["ComicInfo"]["Pages"]) {
            json["ComicInfo"]["Pages"] = {};
          }
          if (!json["ComicInfo"]["Pages"]["Page"]) {
            json["ComicInfo"]["Pages"]["Page"] = [];
          }

          json["ComicInfo"]["PageCount"] = imgFilePaths.length;
          let oldPagesArray = json["ComicInfo"]["Pages"]["Page"].slice();
          json["ComicInfo"]["Pages"]["Page"] = [];
          for (let index = 0; index < imgFilePaths.length; index++) {
            let pageData = {
              "@_Image": "",
              "@_ImageSize": "",
              "@_ImageWidth": "",
              "@_ImageHeight": "",
            };
            if (oldPagesArray.length > index) {
              pageData = oldPagesArray[index];
            }
            let filePath = imgFilePaths[index];
            pageData["@_Image"] = index;
            let fileStats = fs.statSync(filePath);
            let fileSizeInBytes = fileStats.size;
            pageData["@_ImageSize"] = fileSizeInBytes;
            const sharp = require("sharp");
            const metadata = await sharp(filePath).metadata();
            pageData["@_ImageWidth"] = metadata.width;
            pageData["@_ImageHeight"] = metadata.height;
            json["ComicInfo"]["Pages"]["Page"].push(pageData);
          }
          // rebuild
          const builderOptions = {
            ignoreAttributes: false,
            format: true,
          };
          const builder = new XMLBuilder(builderOptions);
          let outputXmlData = builder.build(json);
          fs.writeFileSync(comicInfoFilePath, outputXmlData);
        } else {
          throw "ComicInfo.xml is not a valid xml file";
        }
      } catch (error) {
        log.debug(
          "[CC] " +
            "Warning: couldn't update the contents of ComicInfo.xml: " +
            error,
        );
        updateModalLogText(_("tool-shared-modal-log-warning-comicinfoxml"));
        updateModalLogText(error);
      }
    }
    ///////////////////////////////////////////////
    // SEND TO NEXT STAGE /////////////////////////
    ///////////////////////////////////////////////
    if (g_uiSelectedOptions.outputFormat === FileDataType.IMGS_FOLDER) {
      let outputFolderPath = g_uiSelectedOptions.outputFolderPath;
      let subFolderName = path.basename(
        inputFilePath,
        path.extname(inputFilePath),
      );
      let subFolderPath = path.join(outputFolderPath, subFolderName);
      let i = 1;
      while (fs.existsSync(subFolderPath)) {
        i++;
        subFolderPath = path.join(
          outputFolderPath,
          subFolderName + "(" + i + ")",
        );
      }
      createFolderWithImages(imgFilePaths, subFolderPath);
    } else {
      let baseFileName =
        g_uiSelectedOptions.outputFileBaseName ??
        path.basename(inputFilePath, path.extname(inputFilePath));
      createFilesFromImages(
        inputFilePath,
        baseFileName,
        imgFilePaths,
        comicInfoFilePath,
      );
    }
  } catch (error) {
    stopError(error);
  }
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function createFilesFromImages(
  inputFilePath,
  baseFileName,
  imgFilePaths,
  comicInfoFilePath,
) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    if (g_mode === ToolMode.CREATE) updateModalLogText("");
    updateModalLogText(
      g_uiSelectedOptions.outputSplitNumFiles > 1
        ? _("tool-shared-modal-log-generating-new-files") + "..."
        : _("tool-shared-modal-log-generating-new-file") + "...",
    );
    log.debug(
      g_uiSelectedOptions.outputSplitNumFiles > 1
        ? "[CC] " + _("tool-shared-modal-log-generating-new-files") + "..."
        : "[CC] " + _("tool-shared-modal-log-generating-new-file") + "...",
    );
    killWorker();
    if (g_worker === undefined) {
      log.editor("[CC] starting worker (create)");
      const worker = forkUtils.fork(
        path.join(__dirname, "../../shared/main/tools-worker-process.js"),
      );
      worker.on("message", (message) => {
        if (message.type === "testLog") {
          log.test(message.log);
          return;
        } else if (message.type === "editorLog") {
          log.editor("[CC] " + message.log);
          return;
        } else if (message.type === "debugLog") {
          log.debug("[CC] " + message.log);
          return;
        } else if (message.type === "extraction-progress") {
          return;
        } else if (message.type === undefined) {
          killWorker();
          if (message.success) {
            log.debug("[CC] file/s created in: " + message.times);
            temp.deleteSubFolder(g_tempSubFolderPath);
            g_tempSubFolderPath = undefined;
            message.files.forEach((element) => {
              updateModalLogText(element);
            });
            updateModalLogText("");
            sendIpcToRenderer("file-finished-ok");
            return;
          } else {
            stopError(message.error);
            return;
          }
        }
      });
      g_worker = worker;
    }
    let extraData = undefined;
    if (g_uiSelectedOptions.outputFormat === FileExtension.EPUB) {
      extraData = g_uiSelectedOptions.outputEpubCreationImageStorage;
    } else if (g_uiSelectedOptions.outputFormat === FileExtension.CBR) {
      extraData = {
        rarExePath: utils.getRarCommand(settings.getValue("rarExeFolderPath")),
        workingDir: g_tempSubFolderPath,
      };
    } else if (g_uiSelectedOptions.outputFormat === FileExtension.PDF) {
      extraData = g_uiSelectedOptions.outputPdfCreationMethod;
    }
    let outputFolderPath = g_uiSelectedOptions.outputFolderPath;
    if (
      g_inputFilesIndex !== undefined &&
      g_inputFiles[g_inputFilesIndex].outputFolderPath
    ) {
      outputFolderPath = g_inputFiles[g_inputFilesIndex].outputFolderPath;
    }
    if (
      g_mode === ToolMode.CONVERT &&
      g_uiSelectedOptions.outputFolderOption == "1"
    ) {
      outputFolderPath = path.dirname(inputFilePath);
    }
    g_worker.postMessage([
      core.getLaunchInfo(),
      "create",
      baseFileName,
      outputFolderPath,
      g_uiSelectedOptions.outputSplitNumFiles,
      imgFilePaths,
      comicInfoFilePath,
      g_uiSelectedOptions.outputFormat,
      g_uiSelectedOptions.outputFileSameName,
      g_tempSubFolderPath,
      g_uiSelectedOptions.outputPassword,
      extraData,
    ]);
  } catch (error) {
    stopError(error);
  }
}

// async function createFolderWithImages(imgFilePaths, outputFolderPath) {
//   if (g_cancel === true) {
//     stopCancel();
//     return;
//   }
//   try {
//     sendIpcToRenderer(
//       "update-log-text",
//       _("tool-ec-modal-log-extracting-to") + ":",
//     );
//     sendIpcToRenderer("update-log-text", outputFolderPath);
//     // create subFolderPath
//     if (!fs.existsSync(outputFolderPath)) {
//       fs.mkdirSync(outputFolderPath);
//       for (let index = 0; index < imgFilePaths.length; index++) {
//         let oldPath = imgFilePaths[index];
//         log.test(oldPath);
//         let newPath = path.join(outputFolderPath, path.basename(oldPath));
//         fileUtils.moveFile(oldPath, newPath);
//       }
//       temp.deleteSubFolder(g_tempSubFolderPath);
//       g_tempSubFolderPath = undefined;
//       sendIpcToRenderer("file-finished-ok");
//     } else {
//       stopError("tool-ec folder shouldn't exist");
//     }
//   } catch (error) {
//     stopError(error);
//   }
// }

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

    if (!fs.existsSync(outputFolderPath)) {
      fs.mkdirSync(outputFolderPath, { recursive: true });
      const baseTempPath = path.normalize(g_tempSubFolderPath);
      for (let index = 0; index < imgFilePaths.length; index++) {
        const oldPath = path.normalize(imgFilePaths[index]);
        const relativePath = path.relative(baseTempPath, oldPath);
        const newPath = path.join(outputFolderPath, relativePath);
        fs.mkdirSync(path.dirname(newPath), { recursive: true });
        fileUtils.moveFile(oldPath, newPath);
      }
      temp.deleteSubFolder(g_tempSubFolderPath);
      g_tempSubFolderPath = undefined;
      sendIpcToRenderer("file-finished-ok");
    } else {
      stopError("tool-ec folder shouldn't exist");
    }
  } catch (error) {
    stopError(error);
  }
}

///////////////////////////////////////////////////////////////////////////////
// WORKER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function killWorker() {
  if (g_worker !== undefined) {
    log.editor("[CC] killing worker");
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
    localization.getLocalization(g_mode),
    localization.getTooltipsLocalization(),
    localization.getLocalizedTexts(),
  );
}
exports.updateLocalizedText = updateLocalizedText;
