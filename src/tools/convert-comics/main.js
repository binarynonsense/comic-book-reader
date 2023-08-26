/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");

const { FileExtension, FileDataType } = require("../../shared/main/constants");
const { fork } = require("child_process");
const FileType = require("file-type");
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const settings = require("../../shared/main/settings");
const utils = require("../../shared/main/utils");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_mode = 0; // 0 = convert, 1 = create
let g_imageIndex = 0;

let g_cancel = false;
let g_worker;
let g_workerWindow;
let g_outputPageOrder = "byPosition";
let g_pdfCreationMethod = "metadata";
let g_epubCreationImageFormat = "keep-selected";
let g_epubCreationImageStorage = "files";
let g_imageFormat = FileExtension.NOT_SET;
let g_outputFileBaseName;

// hack to allow this at least for files from File>Convert...
let g_initialPassword = "";
let g_creationTempFolderPath;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function (mode, fileData) {
  // called by switchTool when opening tool
  g_mode = mode;
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

  sendIpcToRenderer(
    "show",
    g_mode,
    filePath !== undefined
      ? path.dirname(filePath)
      : appUtils.getDesktopFolderPath(),
    settings.canEditRars()
  );

  updateLocalizedText();

  if (filePath !== undefined && fileType !== undefined)
    sendIpcToRenderer("add-file", filePath, fileType);
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up

  if (g_workerWindow !== undefined) {
    g_workerWindow.destroy();
    g_workerWindow = undefined;
  }

  if (g_worker !== undefined) {
    g_worker.kill();
    g_worker = undefined;
  }
  fileUtils.cleanUpTempFolder();
  fileUtils.cleanUpTempFolder(g_creationTempFolderPath);
  g_creationTempFolderPath = undefined;
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
  on("close", () => {
    onCloseClicked();
  });

  on("choose-file", (lastFilePath) => {
    let defaultPath;
    if (lastFilePath) defaultPath = path.dirname(lastFilePath);
    try {
      let allowMultipleSelection = true;
      let allowedFileTypesName;
      let allowedFileTypesList;
      if (g_mode === 0) {
        allowedFileTypesName = _("dialog-file-types-comics");
        allowedFileTypesList = [
          FileExtension.CBZ,
          FileExtension.CBR,
          FileExtension.CB7,
          FileExtension.PDF,
          FileExtension.EPUB,
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
        ];
      }
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
        let fileType;
        let fileExtension = path.extname(filePath).toLowerCase();
        (async () => {
          let _fileType = await FileType.fromFile(filePath);
          if (_fileType !== undefined) {
            fileExtension = "." + _fileType.ext;
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
            } else if (
              g_mode === 1 &&
              (fileExtension === "." + FileExtension.JPG ||
                fileExtension === "." + FileExtension.JPEG ||
                fileExtension === "." + FileExtension.PNG ||
                fileExtension === "." + FileExtension.WEBP ||
                fileExtension === "." + FileExtension.BMP ||
                fileExtension === "." + FileExtension.AVIF)
            ) {
              fileType = FileDataType.IMG;
            } else {
              return;
            }
          }
          sendIpcToRenderer("add-file", filePath, fileType);
        })();
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
      if (g_workerWindow) {
        g_workerWindow.webContents.send("cancel");
      }
    }
  });

  on("set-page-order", (order) => {
    g_outputPageOrder = order;
  });

  on("set-image-format", (format) => {
    g_imageFormat = format;
  });

  on("set-pdf-creation-method", (method) => {
    g_pdfCreationMethod = method;
  });

  on("set-epub-creation-image-format", (format) => {
    g_epubCreationImageFormat = format;
  });

  on("set-epub-creation-image-storage", (selection) => {
    g_epubCreationImageStorage = selection;
  });

  on("start", (...args) => {
    start(...args);
  });

  on("start-file", (...args) => {
    startFile(...args);
  });

  on("stop-error", (err) => {
    stopError(err);
  });

  on("resize-images", (...args) => {
    resizeImages(...args);
  });

  on("resizing-canceled", () => {
    if (g_cancel === false) stopCancel();
  });

  on("resizing-error", (err) => {
    stopError(err);
  });

  on("end", (wasCanceled, numFiles, numErrors, numAttempted) => {
    if (!wasCanceled) {
      if (g_mode === 0) {
        sendIpcToRenderer(
          "modal-update-title-text",
          _("tool-shared-modal-title-conversion-finished")
        );

        if (numErrors > 0) {
          sendIpcToRenderer(
            "update-info-text",
            _(
              "tool-shared-modal-info-conversion-error-num-files",
              numErrors,
              numFiles
            )
          );
        } else {
          sendIpcToRenderer(
            "update-info-text",
            _("tool-shared-modal-info-conversion-success-num-files", numFiles)
          );
        }
      } else {
        if (numErrors > 0) {
          sendIpcToRenderer(
            "modal-update-title-text",
            _("tool-shared-modal-title-creation-failed")
          );
          sendIpcToRenderer("update-info-text", "");
        } else {
          sendIpcToRenderer(
            "modal-update-title-text",
            _("tool-shared-modal-title-creation-finished")
          );
        }
      }
    } else {
      sendIpcToRenderer(
        "modal-update-title-text",
        g_mode === 0
          ? _("tool-shared-modal-title-conversion-canceled")
          : _("tool-shared-modal-title-creation-canceled")
      );
      sendIpcToRenderer(
        "update-info-text",
        g_mode === 0
          ? _(
              "tool-shared-modal-info-conversion-results",
              numAttempted - numErrors,
              numErrors,
              numFiles - numAttempted
            )
          : ""
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
  fileUtils.cleanUpTempFolder(g_creationTempFolderPath);
  g_creationTempFolderPath = undefined;
  sendIpcToRenderer("update-log-text", error);
  sendIpcToRenderer(
    "update-log-text",
    g_mode === 0
      ? _("tool-shared-modal-log-conversion-error")
      : _("tool-shared-modal-log-creation-error")
  );
  sendIpcToRenderer("file-finished-error");
}

function stopCancel() {
  fileUtils.cleanUpTempFolder();
  fileUtils.cleanUpTempFolder(g_creationTempFolderPath);
  g_creationTempFolderPath = undefined;
  sendIpcToRenderer(
    "update-log-text",
    g_mode === 0
      ? _("tool-shared-modal-log-conversion-canceled")
      : _("tool-shared-modal-log-creation-canceled")
  );
  sendIpcToRenderer("file-finished-canceled");
}

function start(inputFiles, outputFileBaseName) {
  g_outputFileBaseName = outputFileBaseName;
  g_imageIndex = 0;
  if (g_mode === 0) {
    sendIpcToRenderer("start-first-file");
  } else {
    let tempFolderPath = fileUtils.createTempFolder();
    // check types
    let areAllImages = true;
    for (let index = 0; index < inputFiles.length; index++) {
      const inputFile = inputFiles[index];
      if (inputFile.type !== FileDataType.IMG) {
        areAllImages = false;
        break;
      }
    }
    if (areAllImages) {
      sendIpcToRenderer(
        "modal-update-title-text",
        _("tool-shared-modal-title-creating")
      );
      for (let index = 0; index < inputFiles.length; index++) {
        const inputFilePath = inputFiles[index].path;
        let outName = path.basename(inputFilePath);
        if (g_outputPageOrder === "byPosition") {
          const extension = path.extname(inputFilePath);
          outName = g_imageIndex++ + extension;
        }
        const outPath = path.join(tempFolderPath, outName);
        fs.copyFileSync(inputFilePath, outPath, fs.constants.COPYFILE_EXCL);
      }
      sendIpcToRenderer("file-images-extracted");
    } else {
      sendIpcToRenderer("start-first-file");
    }
  }
}

function startFile(
  inputFilePath,
  inputFileType,
  fileNum,
  totalFilesNum,
  pdfExtractionMethod
) {
  g_cancel = false;

  sendIpcToRenderer(
    "modal-update-title-text",
    g_mode === 0
      ? _("tool-shared-modal-title-converting")
      : _("tool-shared-modal-title-adding") +
          (totalFilesNum > 1 ? " (" + fileNum + "/" + totalFilesNum + ")" : "")
  );
  sendIpcToRenderer(
    "update-info-text",
    utils.reduceStringFrontEllipsis(inputFilePath)
  );
  sendIpcToRenderer(
    "update-log-text",
    g_mode === 0
      ? _("tool-shared-modal-title-converting")
      : _("tool-shared-modal-title-adding")
  );
  sendIpcToRenderer("update-log-text", inputFilePath);

  let tempFolderPath;
  if (g_mode === 0) {
    tempFolderPath = fileUtils.createTempFolder();
  } else {
    // tempFolderPath was created on start
    tempFolderPath = fileUtils.getTempFolderPath();
    g_creationTempFolderPath = fileUtils.createTempFolder(false);
  }
  // extract to temp folder
  if (inputFileType === FileDataType.IMG) {
    const extension = path.extname(inputFilePath);
    let outName = g_imageIndex++ + extension;
    const outPath = path.join(tempFolderPath, outName);
    fs.copyFileSync(inputFilePath, outPath, fs.constants.COPYFILE_EXCL);
    fileUtils.cleanUpTempFolder(g_creationTempFolderPath);
    sendIpcToRenderer("file-images-extracted");
  } else if (
    inputFileType === FileDataType.ZIP ||
    inputFileType === FileDataType.RAR ||
    inputFileType === FileDataType.SEVENZIP ||
    inputFileType === FileDataType.EPUB_COMIC
  ) {
    sendIpcToRenderer(
      "update-log-text",
      _("tool-shared-modal-log-extracting-pages") + "..."
    );
    // ref: https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html
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
        if (message === "success") {
          if (g_cancel === true) {
            stopCancel();
            return;
          }
          if (g_mode === 1) {
            copyImagesToTempFolder();
          }
          sendIpcToRenderer("file-images-extracted");
          return;
        } else {
          stopError(message);
          return;
        }
      });
    }
    g_worker.send([
      "extract",
      inputFilePath,
      inputFileType,
      g_mode === 0 ? tempFolderPath : g_creationTempFolderPath,
      g_initialPassword,
    ]);
  } else if (inputFileType === FileDataType.PDF) {
    sendIpcToRenderer(
      "update-log-text",
      _("tool-shared-modal-log-extracting-pages") + "..."
    );
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
      `${__dirname}/../../shared/renderer/tools-bg-worker.html`
    );

    g_workerWindow.webContents.on("did-finish-load", function () {
      //g_resizeWindow.webContents.openDevTools();
      g_workerWindow.webContents.send(
        "extract-pdf",
        "tool-convert-comics",
        inputFilePath,
        g_mode === 0 ? tempFolderPath : g_creationTempFolderPath,
        pdfExtractionMethod,
        _("tool-shared-modal-log-extracting-page") + ": ",
        g_initialPassword
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
      if (!args[1]) {
        if (g_mode === 1) {
          copyImagesToTempFolder();
        }
        sendIpcToRenderer("file-images-extracted");
      } else stopCancel();
      break;
    case "stop-error":
      g_workerWindow.destroy();
      g_workerWindow = undefined;
      stopError(args[1]);
      break;
  }
};

function copyImagesToTempFolder() {
  let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(
    g_creationTempFolderPath
  );
  let tempFolderPath = fileUtils.getTempFolderPath();
  if (imgFilePaths !== undefined && imgFilePaths.length > 0) {
    imgFilePaths.sort(utils.compare);
    imgFilePaths.forEach((imgFilePath) => {
      const extension = path.extname(imgFilePath);
      let outName = g_imageIndex++ + extension;
      const outPath = path.join(tempFolderPath, outName);
      fs.copyFileSync(imgFilePath, outPath, fs.constants.COPYFILE_EXCL);
    });
  }
  fileUtils.cleanUpTempFolder(g_creationTempFolderPath);
  g_creationTempFolderPath = undefined;
}

async function resizeImages(
  inputFilePath,
  outputScale,
  outputQuality,
  outputFormat,
  outputFolderPath,
  outputSplitNumFiles,
  password
) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    const sharp = require("sharp");
    outputScale = parseInt(outputScale);
    outputQuality = parseInt(outputQuality);

    let tempFolderPath = fileUtils.getTempFolderPath();
    let comicInfoFilePath =
      g_mode === 0
        ? fileUtils.getComicInfoFileInFolderRecursive(tempFolderPath)
        : undefined;
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
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
    let didResize = false;
    if (outputScale < 100) {
      didResize = true;
      sendIpcToRenderer(
        "update-log-text",
        _("tool-shared-modal-log-resizing-images") + "..."
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
            imgFilePaths.length
        );
        let filePath = imgFilePaths[index];
        let fileFolderPath = path.dirname(filePath);
        let fileName = path.basename(filePath, path.extname(filePath));
        let tmpFilePath = path.join(
          fileFolderPath,
          fileName + "." + FileExtension.TMP
        );
        let data = await sharp(filePath).metadata();
        await sharp(filePath)
          .withMetadata()
          .resize(Math.round(data.width * (outputScale / 100)))
          .toFile(tmpFilePath);

        fs.unlinkSync(filePath);
        fileUtils.moveFile(tmpFilePath, filePath);
      }
    }

    // change image format if requested or pdfkit incompatible (not jpg or png)
    if (g_cancel === true) {
      stopCancel();
      return;
    }
    let didChangeFormat = false;
    if (
      outputFormat === FileExtension.PDF ||
      outputFormat === FileExtension.EPUB ||
      g_imageFormat != FileExtension.NOT_SET
    ) {
      sendIpcToRenderer(
        "update-log-text",
        _("tool-shared-modal-log-converting-images") + "..."
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
            imgFilePaths.length
        );
        let filePath = imgFilePaths[index];
        let fileFolderPath = path.dirname(filePath);
        let fileName = path.basename(filePath, path.extname(filePath));
        let imageFormat = g_imageFormat;
        if (outputFormat === FileExtension.PDF) {
          // change to a format compatible with pdfkit if needed
          if (
            imageFormat === FileExtension.WEBP ||
            imageFormat === FileExtension.AVIF ||
            (imageFormat === FileExtension.NOT_SET &&
              !fileUtils.hasPdfKitCompatibleImageExtension(filePath))
          ) {
            imageFormat = FileExtension.JPG;
          }
        }
        if (
          outputFormat === FileExtension.EPUB &&
          g_epubCreationImageFormat === "core-media-types-only"
        ) {
          // change to a format supported by the epub specification if needed
          if (
            imageFormat === FileExtension.WEBP ||
            imageFormat === FileExtension.AVIF ||
            (imageFormat === FileExtension.NOT_SET &&
              !fileUtils.hasEpubSupportedImageExtension(filePath))
          ) {
            imageFormat = FileExtension.JPG;
          }
        }
        if (imageFormat != FileExtension.NOT_SET) {
          didChangeFormat = true;
          let tmpFilePath = path.join(
            fileFolderPath,
            fileName + "." + FileExtension.TMP
          );
          if (imageFormat === FileExtension.JPG) {
            await sharp(filePath)
              .withMetadata()
              .jpeg({
                quality: outputQuality,
              })
              .toFile(tmpFilePath);
          } else if (imageFormat === FileExtension.PNG) {
            if (outputQuality < 100) {
              await sharp(filePath)
                .withMetadata()
                .png({
                  quality: outputQuality,
                })
                .toFile(tmpFilePath);
            } else {
              await sharp(filePath).withMetadata().png().toFile(tmpFilePath);
            }
          } else if (imageFormat === FileExtension.WEBP) {
            await sharp(filePath)
              .withMetadata()
              .webp({
                quality: outputQuality,
              })
              .toFile(tmpFilePath);
          } else if (imageFormat === FileExtension.AVIF) {
            await sharp(filePath)
              .withMetadata()
              .avif({
                quality: outputQuality,
              })
              .toFile(tmpFilePath);
          }
          let newFilePath = path.join(
            fileFolderPath,
            fileName + "." + imageFormat
          );
          fs.unlinkSync(filePath);
          fileUtils.moveFile(tmpFilePath, newFilePath);
          imgFilePaths[index] = newFilePath;
        }
      }
    }
    // update comicbook.xml if available, needs changing and the output format is right
    if (
      comicInfoFilePath &&
      (outputFormat === FileExtension.CBZ ||
        outputFormat === FileExtension.CB7) &&
      (didChangeFormat || didResize)
    ) {
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
          sendIpcToRenderer(
            "update-log-text",
            _("tool-shared-modal-log-updating-comicinfoxml")
          );

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
          "Warning: couldn't update the contents of ComicInfo.xml: " + error
        );
        sendIpcToRenderer(
          "update-log-text",
          _("tool-shared-modal-log-warning-comicinfoxml")
        );
        sendIpcToRenderer("update-log-text", error);
      }
    }
    let baseFileName = g_outputFileBaseName
      ? g_outputFileBaseName
      : path.basename(inputFilePath, path.extname(inputFilePath));
    createFilesFromImages(
      baseFileName,
      outputFolderPath,
      imgFilePaths,
      outputFormat,
      comicInfoFilePath,
      outputSplitNumFiles,
      password
    );
  } catch (error) {
    stopError(error);
  }
}

async function createFilesFromImages(
  baseFileName,
  outputFolderPath,
  imgFilePaths,
  outputFormat,
  comicInfoFilePath,
  outputSplitNumFiles,
  password
) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    sendIpcToRenderer(
      "update-log-text",
      outputSplitNumFiles > 1
        ? _("tool-shared-modal-log-generating-new-files") + "..."
        : _("tool-shared-modal-log-generating-new-file") + "..."
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
          sendIpcToRenderer("file-finished-ok");
          return;
        } else {
          stopError(message[0]);
          return;
        }
      });
    }
    let extraData = undefined;
    if (outputFormat === FileExtension.EPUB) {
      extraData = g_epubCreationImageStorage;
    } else if (outputFormat === FileExtension.CBR) {
      extraData = {
        rarExePath: utils.getRarCommand(settings.getValue("rarExeFolderPath")),
        workingDir: fileUtils.getTempFolderPath(),
      };
    } else if (outputFormat === FileExtension.PDF) {
      extraData = g_pdfCreationMethod;
    }
    g_worker.send([
      "create",
      baseFileName,
      outputFolderPath,
      outputSplitNumFiles,
      imgFilePaths,
      comicInfoFilePath,
      outputFormat,
      fileUtils.getTempFolderPath(),
      password,
      extraData,
    ]);
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
      id: "tool-cc-tooltip-output-size",
      text: _("tool-shared-tooltip-output-scale"),
    },
    {
      id: "tool-cc-tooltip-output-page-order",
      text: _("tool-shared-tooltip-output-page-order"),
    },
    {
      id: "tool-cc-tooltip-output-folder",
      text: _("tool-shared-tooltip-output-folder"),
    },
    {
      id: "tool-cc-tooltip-remove-from-list",
      text: _("tool-shared-tooltip-remove-from-list"),
    },
    {
      id: "tool-cc-tooltip-move-up-in-list",
      text: _("tool-shared-tooltip-move-up-in-list"),
    },
    {
      id: "tool-cc-tooltip-move-down-in-list",
      text: _("tool-shared-tooltip-move-down-in-list"),
    },
    {
      id: "tool-cc-tooltip-pdf-extraction",
      text: _("tool-shared-ui-pdf-extraction-tooltip"),
    },
    {
      id: "tool-cc-tooltip-password",
      text: _("tool-shared-ui-creation-password-tooltip", "cbz, cb7, cbr, pdf"),
    },
    {
      id: "tool-cc-tooltip-pdf-creation",
      text: _("tool-shared-ui-pdf-creation-tooltip"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "tool-cc-title-text",
      text:
        g_mode === 0
          ? _("tool-cc-title").toUpperCase()
          : _("tool-cr-title").toUpperCase(),
    },
    {
      id: "tool-cc-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-cc-start-button-text",
      text:
        g_mode === 0
          ? _("tool-shared-ui-convert").toUpperCase()
          : _("tool-shared-ui-create").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-section-general-options-text",
      text: _("tool-shared-ui-general-options"),
    },
    {
      id: "tool-cc-section-advanced-options-text",
      text: _("tool-shared-ui-advanced-options"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-input-options-text",
      text: _("tool-shared-ui-input-options"),
    },
    {
      id: "tool-cc-input-files-text",
      text: _("tool-shared-ui-input-files"),
    },
    {
      id: "tool-cc-add-file-button-text",
      text: _("tool-shared-ui-add").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-output-options-text",
      text: _("tool-shared-ui-output-options"),
    },
    {
      id: "tool-cc-output-format-text",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "tool-cc-output-page-order-text",
      text: _("tool-shared-ui-output-options-page-order"),
    },
    {
      id: "tool-cc-output-page-order-o1-text",
      text: _("tool-shared-ui-output-options-page-order-o1"),
    },
    {
      id: "tool-cc-output-page-order-o2-text",
      text: _("tool-shared-ui-output-options-page-order-o2"),
    },
    {
      id: "tool-cc-output-image-scale-text",
      text: _("tool-shared-ui-output-options-scale"),
    },
    {
      id: "tool-cc-output-format-text",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "tool-cc-output-image-format-text",
      text: _("tool-shared-ui-output-options-image-format"),
    },
    {
      id: "tool-cc-output-image-quality-text",
      text: _("tool-shared-ui-output-options-image-quality"),
    },
    {
      id: "tool-cc-output-folder-text",
      text: _("tool-shared-ui-output-folder"),
    },
    {
      id: "tool-cc-change-folder-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-advanced-input-options-text",
      text: _("tool-shared-ui-advanced-input-options"),
    },
    {
      id: "tool-cc-pdf-extraction-text",
      text: _("tool-shared-ui-pdf-extraction"),
    },
    {
      id: "tool-cc-pdf-extraction-o1-text",
      text: _("tool-shared-ui-pdf-extraction-o1"),
    },
    {
      id: "tool-cc-pdf-extraction-o2-text",
      text: _("tool-shared-ui-pdf-extraction-o2"),
    },
    {
      id: "tool-cc-pdf-extraction-o3-text",
      text: _("tool-shared-ui-pdf-extraction-o3"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-advanced-output-options-text",
      text: _("tool-shared-ui-advanced-output-options"),
    },
    {
      id: "tool-cc-split-num-files-text",
      text: _("tool-sc-number"),
    },
    {
      id: "tool-cc-password-text",
      text: _("tool-shared-ui-creation-password"),
    },
    {
      id: "tool-cc-pdf-creation-text",
      text: _("tool-shared-ui-pdf-creation"),
    },
    {
      id: "tool-cc-pdf-creation-o1-text",
      text: _("tool-shared-ui-pdf-creation-o1"),
    },
    {
      id: "tool-cc-pdf-creation-o2-text",
      text: _("tool-shared-ui-pdf-creation-o2"),
    },
    {
      id: "tool-cc-pdf-creation-o3-text",
      text: _("tool-shared-ui-pdf-creation-o3"),
    },

    {
      id: "tool-cc-epub-creation-text",
      text: _("tool-shared-ui-epub-creation"),
    },
    {
      id: "tool-cc-epub-creation-image-format-o1-text",
      text: _("tool-shared-ui-epub-creation-image-format-o1"),
    },
    {
      id: "tool-cc-epub-creation-image-format-o2-text",
      text: _("tool-shared-ui-epub-creation-image-format-o2"),
    },
    {
      id: "tool-cc-epub-creation-image-storage-o1-text",
      text: _("tool-shared-ui-epub-creation-image-storage-o1"),
    },
    {
      id: "tool-cc-epub-creation-image-storage-o2-text",
      text: _("tool-shared-ui-epub-creation-image-storage-o2"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-keep-format-text",
      text: _("tool-shared-ui-output-options-format-keep"),
    },

    {
      id: "tool-cc-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-cc-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
  ];
}
