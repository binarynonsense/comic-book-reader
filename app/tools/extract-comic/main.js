const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const FileType = require("file-type");
const naturalCompare = require("natural-compare-lite");
const fileUtils = require("../../file-utils");
const fileFormats = require("../../file-formats");
const mainProcess = require("../../main");
const { FileExtension, FileDataType } = require("../../constants");
const sharp = require("sharp");

let g_window;
let g_cancel = false;
let g_worker;
let g_resizeWindow;
let g_ipcChannel = "tool-cc--";

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow, filePath, fileType) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
  let [width, height] = parentWindow.getSize();
  height = (90 * height) / 100;
  if (height < 700) height = 700;
  width = 1024;

  g_window = new BrowserWindow({
    width: parseInt(width),
    height: parseInt(height),
    icon: path.join(__dirname, "../../assets/images/icon_256x256.png"),
    resizable: true,
    backgroundColor: "white",
    parent: parentWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  g_window.menuBarVisible = false;
  g_window.loadFile(`${__dirname}/index.html`);

  g_window.on("closed", () => {
    g_window = undefined;
    if (g_worker !== undefined) {
      g_worker.kill();
      g_worker = undefined;
    }
    fileUtils.cleanUpTempFolder();
  });

  g_window.webContents.on("did-finish-load", function () {
    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("tool-convert-files-title"),
      getLocalization(),
      getTooltipsLocalization()
    );

    g_window.webContents.send(
      g_ipcChannel + "init",
      filePath !== undefined ? path.dirname(filePath) : app.getPath("desktop")
    );

    if (filePath !== undefined && fileType !== undefined)
      g_window.webContents.send(g_ipcChannel + "add-file", filePath, fileType);
  });

  //if (isDev()) g_window.toggleDevTools();
};

///////////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "choose-file", (event) => {
  try {
    let allowMultipleSelection = true;
    let allowedFileTypesName = "Comic Book Files";
    let allowedFileTypesList = [
      FileExtension.CBZ,
      FileExtension.CBR,
      FileExtension.PDF,
      FileExtension.EPUB,
    ];
    let filePathsList = fileUtils.chooseOpenFiles(
      g_window,
      undefined,
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
          fileType = FileDataType.EPUB;
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
          } else {
            return;
          }
        }
        g_window.webContents.send(
          g_ipcChannel + "add-file",
          filePath,
          fileType
        );
      })();
    }
  } catch (err) {
    // TODO: do something?
  }
});

ipcMain.on(
  g_ipcChannel + "choose-folder",
  (event, inputFilePath, outputFolderPath) => {
    let defaultPath;
    if (outputFolderPath !== undefined) {
      defaultPath = outputFolderPath;
    } else if (inputFilePath !== undefined) {
      defaultPath = path.dirname(inputFilePath);
    }
    let folderList = fileUtils.chooseFolder(g_window, defaultPath);
    if (folderList === undefined) {
      return;
    }
    let folderPath = folderList[0];
    if (folderPath === undefined || folderPath === "") return;

    g_window.webContents.send(
      g_ipcChannel + "change-output-folder",
      folderPath
    );
  }
);

/////////////////////////

ipcMain.on(g_ipcChannel + "cancel", (event) => {
  g_cancel = true;
  if (g_resizeWindow !== undefined) {
    g_resizeWindow.webContents.send("bgr--cancel-resize");
  }
});

ipcMain.on(
  g_ipcChannel + "start",
  (event, inputFilePath, inputFileType, fileNum, totalFilesNum) => {
    start(inputFilePath, inputFileType, fileNum, totalFilesNum);
  }
);

ipcMain.on(g_ipcChannel + "stop-error", (event, err) => {
  stopError(err);
});

ipcMain.on(g_ipcChannel + "pdf-images-extracted", (event, canceled) => {
  if (!canceled) g_window.webContents.send(g_ipcChannel + "images-extracted");
  else stopCancel();
});

ipcMain.on(
  g_ipcChannel + "resize-images",
  (
    event,
    inputFilePath,
    outputScale,
    outputQuality,
    outputFormat,
    outputFolderPath
  ) => {
    resizeImages(
      inputFilePath,
      outputScale,
      outputQuality,
      outputFormat,
      outputFolderPath
    );
  }
);

ipcMain.on(g_ipcChannel + "resizing-image", (event, pageNum, totalNumPages) => {
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-convert-modal-log-resizing-page") + pageNum + " / " + totalNumPages
  );
});

ipcMain.on(g_ipcChannel + "resizing-canceled", (event) => {
  if (g_cancel === false) stopCancel();
});

ipcMain.on(g_ipcChannel + "resizing-error", (event, err) => {
  stopError(err);
});

ipcMain.on(
  g_ipcChannel + "create-file-from-images",
  (event, imgFilePaths, outputFormat, outputFilePath) => {
    if (g_resizeWindow !== undefined) {
      g_resizeWindow.destroy();
      g_resizeWindow = undefined;
    }
    createFileFromImages(imgFilePaths, outputFormat, outputFilePath);
  }
);

ipcMain.on(
  g_ipcChannel + "end",
  (event, wasCanceled, numFiles, numErrors, numAttempted) => {
    if (!wasCanceled) {
      g_window.webContents.send(
        g_ipcChannel + "update-title-text",
        _("tool-convert-modal-title-conversion-finished")
      );

      if (numErrors > 0) {
        if (numFiles > 1) {
          g_window.webContents.send(
            g_ipcChannel + "update-info-text",
            _(
              "tool-convert-modal-info-error-num-files-not-converted",
              numErrors,
              numFiles
            )
          );
        } else {
          g_window.webContents.send(
            g_ipcChannel + "update-info-text",
            _("tool-convert-modal-info-error-file-not-converted")
          );
        }
      } else {
        if (numFiles > 1) {
          g_window.webContents.send(
            g_ipcChannel + "update-info-text",
            _("tool-convert-modal-info-success-num-files-converted", numFiles)
          );
        } else {
          g_window.webContents.send(
            g_ipcChannel + "update-info-text",
            _("tool-convert-modal-info-success-file-converted")
          );
        }
      }
    } else {
      g_window.webContents.send(
        g_ipcChannel + "update-title-text",
        _("tool-convert-modal-title-conversion-canceled")
      );
      g_window.webContents.send(
        g_ipcChannel + "update-info-text",
        _(
          "tool-convert-modal-info-conversion-results",
          numAttempted - numErrors,
          numErrors,
          numFiles - numAttempted
        )
      );
    }

    g_window.show();
    g_window.webContents.send(g_ipcChannel + "show-result");
  }
);

///////////////////////////////////////////////////////////////////////////////

function stopError(err) {
  g_window.webContents.send(g_ipcChannel + "update-log-text", err);
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-convert-modal-log-conversion-error")
  );
  g_window.webContents.send(g_ipcChannel + "finished-error");
}

function stopCancel() {
  fileUtils.cleanUpTempFolder();
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-convert-modal-log-conversion-canceled")
  );
  g_window.webContents.send(g_ipcChannel + "finished-canceled");
}

function start(inputFilePath, inputFileType, fileNum, totalFilesNum) {
  g_cancel = false;

  g_window.webContents.send(
    g_ipcChannel + "update-title-text",
    _("tool-modal-title-converting") +
      (totalFilesNum > 1 ? " (" + fileNum + "/" + totalFilesNum + ")" : "")
  );
  g_window.webContents.send(
    g_ipcChannel + "update-info-text",
    fileUtils.reducePathString(inputFilePath)
  );
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-modal-title-converting")
  );
  g_window.webContents.send(g_ipcChannel + "update-log-text", inputFilePath);

  let tempFolderPath = fileUtils.createTempFolder();
  // extract to temp folder
  if (
    inputFileType === FileDataType.ZIP ||
    inputFileType === FileDataType.RAR ||
    inputFileType === FileDataType.EPUB
  ) {
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-convert-modal-log-extracting-pages")
    );
    // ref: https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html
    if (g_worker !== undefined) {
      // kill it after one use
      g_worker.kill();
      g_worker = undefined;
    }
    if (g_worker === undefined) {
      g_worker = fork(path.join(__dirname, "../shared/worker.js"));
      g_worker.on("message", (message) => {
        g_worker.kill(); // kill it after one use
        if (message === "success") {
          if (g_cancel === true) {
            stopCancel();
            return;
          }
          g_window.webContents.send(g_ipcChannel + "images-extracted");
          return;
        } else {
          stopError(message);
          return;
        }
      });
    }
    g_worker.send(["extract", inputFilePath, inputFileType, tempFolderPath]);
  } else if (inputFileType === FileDataType.PDF) {
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-convert-modal-log-extracting-pages")
    );
    g_window.webContents.send(
      g_ipcChannel + "extract-pdf-images",
      tempFolderPath,
      _("tool-convert-modal-log-extracting-page")
    );
  } else {
    stopError("start: invalid file type");
  }
}

async function resizeImages(
  inputFilePath,
  outputScale,
  outputQuality,
  outputFormat,
  outputFolderPath
) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    let fileName = path.basename(inputFilePath, path.extname(inputFilePath));
    let outputFilePath = path.join(
      outputFolderPath,
      fileName + "." + outputFormat
    );
    let i = 1;
    while (fs.existsSync(outputFilePath)) {
      i++;
      outputFilePath = path.join(
        outputFolderPath,
        fileName + "(" + i + ")." + outputFormat
      );
    }

    let tempFolderPath = fileUtils.getTempFolderPath();
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    if (imgFilePaths === undefined || imgFilePaths.length === 0) {
      stopError("imgFiles === undefined || imgFiles.length === 0");
      return;
    }
    // ref: https://www.npmjs.com/package/natural-compare-lite
    imgFilePaths.sort(naturalCompare);
    // change imgs' format if needed (for pdf creation or resizing)
    if (outputScale < 100 || outputFormat === FileExtension.PDF) {
      // pdfkit only works with png and jpg image formats
      // same for native image? (used for resizing)

      // avoid EBUSY error on windows
      // ref: https://stackoverflow.com/questions/41289173/node-js-module-sharp-image-processor-keeps-source-file-open-unable-to-unlink
      sharp.cache(false);

      for (let index = 0; index < imgFilePaths.length; index++) {
        let filePath = imgFilePaths[index];
        if (!fileFormats.hasNativeImageCompatibleImageExtension(filePath)) {
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

          g_window.webContents.send(
            g_ipcChannel + "update-log-text",
            _("tool-convert-modal-log-page-to-compatible-format", index + 1)
          );
          await sharp(filePath).jpeg().toFile(tmpFilePath);

          fs.unlinkSync(filePath);
          fs.renameSync(tmpFilePath, newFilePath);
          imgFilePaths[index] = newFilePath;
        }
      }
    }

    // resize imgs if needed
    outputScale = parseInt(outputScale);
    outputQuality = parseInt(outputQuality);
    if (outputScale < 100) {
      // can't do it using a forked process, because I need nativeImage,
      // so I use a hidden window
      if (g_resizeWindow !== undefined) {
        // shouldn't happen
        g_resizeWindow.destroy();
        g_resizeWindow = undefined;
      }
      g_resizeWindow = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
        parent: g_window,
      });
      g_resizeWindow.loadFile(`${__dirname}/../shared/bg-resize.html`);

      g_resizeWindow.webContents.on("did-finish-load", function () {
        //g_resizeWindow.webContents.openDevTools();
        g_resizeWindow.webContents.send("bgr--init", g_ipcChannel);
        g_resizeWindow.webContents.send(
          "bgr--resize-images",
          imgFilePaths,
          outputScale,
          outputQuality,
          outputFormat,
          outputFilePath
        );
      });
    } else {
      createFileFromImages(imgFilePaths, outputFormat, outputFilePath);
    }
  } catch (err) {
    stopError(err);
  }
}

async function createFileFromImages(
  imgFilePaths,
  outputFormat,
  outputFilePath
) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    // compress to output folder
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-convert-modal-log-generating-new-file")
    );
    g_window.webContents.send(g_ipcChannel + "update-log-text", outputFilePath);

    if (outputFormat === FileExtension.PDF) {
      // TODO: doesn't work in the worker, why?
      fileFormats.createPdfFromImages(imgFilePaths, outputFilePath);
      fileUtils.cleanUpTempFolder();
      g_window.webContents.send(g_ipcChannel + "finished-ok");
    } else {
      if (g_worker !== undefined) {
        // kill it after one use
        g_worker.kill();
        g_worker = undefined;
      }
      if (g_worker === undefined) {
        g_worker = fork(path.join(__dirname, "../shared/worker.js"));
        g_worker.on("message", (message) => {
          g_worker.kill(); // kill it after one use
          if (message === "success") {
            fileUtils.cleanUpTempFolder();
            g_window.webContents.send(g_ipcChannel + "finished-ok");
            return;
          } else {
            stopError(message);
            return;
          }
        });
      }
      g_worker.send([
        "create",
        imgFilePaths,
        outputFormat,
        outputFilePath,
        fileUtils.getTempFolderPath(),
      ]);
    }
  } catch (err) {
    stopError(err);
  }
}

///////////////////////////////////////////////////////////////////////////////
function getTooltipsLocalization() {
  return [
    {
      id: "tooltip-output-size",
      text: _("tool-convert-tooltip-output-size"),
    },
    {
      id: "tooltip-output-folder",
      text: _("tool-convert-tooltip-output-folder"),
    },
    {
      id: "tooltip-remove-from-list",
      text: _("tool-convert-tooltip-remove-from-list"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "text-input-files",
      text: _("tool-convert-ui-input-files"),
    },
    {
      id: "button-add-file",
      text: _("tool-convert-ui-add").toUpperCase(),
    },
    {
      id: "text-output-size",
      text: _("tool-convert-ui-output-size"),
    },
    {
      id: "text-scale",
      text: _("tool-convert-ui-scale"),
    },
    {
      id: "text-quality",
      text: _("tool-convert-ui-quality"),
    },
    {
      id: "text-output-format",
      text: _("tool-convert-ui-output-format"),
    },
    {
      id: "text-output-folder",
      text: _("tool-convert-ui-output-folder"),
    },
    {
      id: "button-change-folder",
      text: _("tool-convert-ui-change").toUpperCase(),
    },
    {
      id: "button-start",
      text: _("tool-convert-ui-convert").toUpperCase(),
    },
    {
      id: "button-modal-close",
      text: _("tool-convert-ui-close").toUpperCase(),
    },
    {
      id: "button-modal-cancel",
      text: _("tool-convert-ui-cancel").toUpperCase(),
    },
  ];
}
