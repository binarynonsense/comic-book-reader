const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const FileType = require("file-type");
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
let g_pdfCreationMethod = "metadata";
let g_imageFormat = FileExtension.NOT_SET;

// hack to allow this at least for files from File>Convert...
let g_initialPassword = "";

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow, fileData) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
  let [width, height] = parentWindow.getSize();
  height = (90 * height) / 100;
  if (height < 700) height = 700;
  width = 1024;

  let filePath, fileType;
  if (fileData !== undefined) {
    filePath = fileData.path;
    fileType = fileData.type;
    g_initialPassword = fileData.password;
  }

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
      _("tool-cc-title"),
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

ipcMain.on(g_ipcChannel + "choose-file", (event, defaultPath) => {
  try {
    let allowMultipleSelection = true;
    let allowedFileTypesName = "Comic Book Files";
    let allowedFileTypesList = [
      FileExtension.CBZ,
      FileExtension.CBR,
      FileExtension.CB7,
      FileExtension.PDF,
      FileExtension.EPUB,
    ];
    let filePathsList = fileUtils.chooseOpenFiles(
      g_window,
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
          } else if (
            fileExtension === "." + FileExtension.SEVENZIP ||
            fileExtension === "." + FileExtension.CB7
          ) {
            fileType = FileDataType.SEVENZIP;
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

ipcMain.on(g_ipcChannel + "set-image-format", (event, format) => {
  g_imageFormat = format;
});

ipcMain.on(g_ipcChannel + "set-pdf-creation-method", (event, method) => {
  g_pdfCreationMethod = method;
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
    _("tool-shared-modal-log-resizing-page") +
      ": " +
      pageNum +
      " / " +
      totalNumPages
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
        _("tool-shared-modal-title-conversion-finished")
      );

      if (numErrors > 0) {
        g_window.webContents.send(
          g_ipcChannel + "update-info-text",
          _(
            "tool-shared-modal-info-conversion-error-num-files",
            numErrors,
            numFiles
          )
        );
      } else {
        g_window.webContents.send(
          g_ipcChannel + "update-info-text",
          _("tool-shared-modal-info-conversion-success-num-files", numFiles)
        );
      }
    } else {
      g_window.webContents.send(
        g_ipcChannel + "update-title-text",
        _("tool-shared-modal-title-conversion-canceled")
      );
      g_window.webContents.send(
        g_ipcChannel + "update-info-text",
        _(
          "tool-shared-modal-info-conversion-results",
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

function stopError(error) {
  g_window.webContents.send(g_ipcChannel + "update-log-text", error);
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-conversion-error")
  );
  g_window.webContents.send(g_ipcChannel + "finished-error");
}

function stopCancel() {
  fileUtils.cleanUpTempFolder();
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-conversion-canceled")
  );
  g_window.webContents.send(g_ipcChannel + "finished-canceled");
}

function start(inputFilePath, inputFileType, fileNum, totalFilesNum) {
  g_cancel = false;

  g_window.webContents.send(
    g_ipcChannel + "update-title-text",
    _("tool-shared-modal-title-converting") +
      (totalFilesNum > 1 ? " (" + fileNum + "/" + totalFilesNum + ")" : "")
  );
  g_window.webContents.send(
    g_ipcChannel + "update-info-text",
    fileUtils.reducePathString(inputFilePath)
  );
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-title-converting")
  );
  g_window.webContents.send(g_ipcChannel + "update-log-text", inputFilePath);

  let tempFolderPath = fileUtils.createTempFolder();
  // extract to temp folder
  if (
    inputFileType === FileDataType.ZIP ||
    inputFileType === FileDataType.RAR ||
    inputFileType === FileDataType.SEVENZIP ||
    inputFileType === FileDataType.EPUB
  ) {
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-shared-modal-log-extracting-pages") + "..."
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
    g_worker.send([
      "extract",
      inputFilePath,
      inputFileType,
      tempFolderPath,
      g_initialPassword,
    ]);
  } else if (inputFileType === FileDataType.PDF) {
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-shared-modal-log-extracting-pages") + "..."
    );
    g_window.webContents.send(
      g_ipcChannel + "extract-pdf-images",
      tempFolderPath,
      _("tool-shared-modal-log-extracting-page") + ": ",
      g_initialPassword
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
    outputScale = parseInt(outputScale);
    outputQuality = parseInt(outputQuality);

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
    imgFilePaths.sort(fileUtils.compare);

    // resize
    if (g_cancel === true) {
      stopCancel();
      return;
    }
    if (outputScale < 100) {
      g_window.webContents.send(
        g_ipcChannel + "update-log-text",
        _("tool-shared-modal-log-resizing-images") + "..."
      );
      sharp.cache(false);
      for (let index = 0; index < imgFilePaths.length; index++) {
        if (g_cancel === true) {
          stopCancel();
          return;
        }
        g_window.webContents.send(
          g_ipcChannel + "update-log-text",
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
    if (
      outputFormat === FileExtension.PDF ||
      g_imageFormat != FileExtension.NOT_SET
    ) {
      g_window.webContents.send(
        g_ipcChannel + "update-log-text",
        _("tool-shared-modal-log-converting-images") + "..."
      );
      sharp.cache(false); // avoid EBUSY error on windows
      for (let index = 0; index < imgFilePaths.length; index++) {
        if (g_cancel === true) {
          stopCancel();
          return;
        }
        g_window.webContents.send(
          g_ipcChannel + "update-log-text",
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
              !fileFormats.hasPdfKitCompatibleImageExtension(filePath))
          ) {
            imageFormat = FileExtension.JPG;
          }
        }
        if (imageFormat != FileExtension.NOT_SET) {
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
    createFileFromImages(imgFilePaths, outputFormat, outputFilePath);
  } catch (error) {
    stopError(error);
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
      _("tool-shared-modal-log-generating-new-file") + "..."
    );
    g_window.webContents.send(g_ipcChannel + "update-log-text", outputFilePath);

    if (outputFormat === FileExtension.PDF) {
      // TODO: doesn't work in the worker, why?
      await fileFormats.createPdfFromImages(
        imgFilePaths,
        outputFilePath,
        g_pdfCreationMethod
      );
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
      text: _("tool-shared-tooltip-output-scale"),
    },
    {
      id: "tooltip-output-folder",
      text: _("tool-shared-tooltip-output-folder"),
    },
    {
      id: "tooltip-remove-from-list",
      text: _("tool-shared-tooltip-remove-from-list"),
    },
    {
      id: "tooltip-pdf-extraction",
      text: _("tool-shared-ui-pdf-extraction-tooltip"),
    },
    {
      id: "tooltip-pdf-creation",
      text: _("tool-shared-ui-pdf-creation-tooltip"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "text-input-files",
      text: _("tool-shared-ui-input-files"),
    },
    {
      id: "button-add-file",
      text: _("tool-shared-ui-add").toUpperCase(),
    },
    {
      id: "text-output-options",
      text: _("tool-shared-ui-output-options"),
    },
    {
      id: "text-scale",
      text: _("tool-shared-ui-output-options-scale"),
    },
    {
      id: "text-format",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "text-image-format",
      text: _("tool-shared-ui-output-options-image-format"),
    },
    {
      id: "text-quality",
      text: _("tool-shared-ui-output-options-image-quality"),
    },
    {
      id: "text-advanced-options",
      text: _("tool-shared-ui-advanced-options"),
    },
    {
      id: "text-pdf-extraction",
      text: _("tool-shared-ui-pdf-extraction"),
    },
    {
      id: "text-pdf-extraction-o1",
      text: _("tool-shared-ui-pdf-extraction-o1"),
    },
    {
      id: "text-pdf-extraction-o2",
      text: _("tool-shared-ui-pdf-extraction-o2"),
    },
    {
      id: "text-pdf-extraction-o3",
      text: _("tool-shared-ui-pdf-extraction-o3"),
    },
    {
      id: "text-pdf-creation",
      text: _("tool-shared-ui-pdf-creation"),
    },
    {
      id: "text-pdf-creation-o1",
      text: _("tool-shared-ui-pdf-creation-o1"),
    },
    {
      id: "text-pdf-creation-o2",
      text: _("tool-shared-ui-pdf-creation-o2"),
    },
    {
      id: "text-pdf-creation-o3",
      text: _("tool-shared-ui-pdf-creation-o3"),
    },
    {
      id: "text-output-folder",
      text: _("tool-shared-ui-output-folder"),
    },
    {
      id: "button-change-folder",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "button-start",
      text: _("tool-shared-ui-convert").toUpperCase(),
    },
    {
      id: "button-modal-close",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "button-modal-cancel",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "keep-format",
      text: _("tool-shared-ui-output-options-format-keep"),
    },
  ];
}
