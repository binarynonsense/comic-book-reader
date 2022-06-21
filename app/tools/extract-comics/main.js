const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const FileType = require("file-type");
const naturalCompare = require("natural-compare-lite");
const fileUtils = require("../../file-utils");
const mainProcess = require("../../main");
const { FileExtension, FileDataType } = require("../../constants");
const sharp = require("sharp");

let g_window;
let g_cancel = false;
let g_worker;
let g_resizeWindow;
let g_ipcChannel = "tool-ec--";

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
      _("tool-ec-title"),
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

ipcMain.on(
  g_ipcChannel + "create-file-from-images",
  (event, imgFilePaths, outputFormat, outputFilePath) => {
    if (g_resizeWindow !== undefined) {
      g_resizeWindow.destroy();
      g_resizeWindow = undefined;
    }
    createFolderWithImages(imgFilePaths, outputFilePath); // outputFilePath is really outputFolderPath
  }
);

ipcMain.on(
  g_ipcChannel + "end",
  (event, wasCanceled, numFiles, numErrors, numAttempted) => {
    if (!wasCanceled) {
      g_window.webContents.send(
        g_ipcChannel + "update-title-text",
        _("tool-shared-modal-title-extraction-finished")
      );

      if (numErrors > 0) {
        g_window.webContents.send(
          g_ipcChannel + "update-info-text",
          _(
            "tool-shared-modal-info-extraction-error-num-files",
            numErrors,
            numFiles
          )
        );
      } else {
        g_window.webContents.send(
          g_ipcChannel + "update-info-text",
          _("tool-shared-modal-info-extraction-success-num-files", numFiles)
        );
      }
    } else {
      g_window.webContents.send(
        g_ipcChannel + "update-title-text",
        _("tool-shared-modal-title-extraction-canceled")
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

function stopError(err) {
  g_window.webContents.send(g_ipcChannel + "update-log-text", err);
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-extraction-error")
  );
  g_window.webContents.send(g_ipcChannel + "finished-error");
}

function stopCancel() {
  fileUtils.cleanUpTempFolder();
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-extraction-canceled")
  );
  g_window.webContents.send(g_ipcChannel + "finished-canceled");
}

function start(inputFilePath, inputFileType, fileNum, totalFilesNum) {
  g_cancel = false;

  g_window.webContents.send(
    g_ipcChannel + "update-title-text",
    _("tool-shared-modal-title-extracting") +
      (totalFilesNum > 1 ? " (" + fileNum + "/" + totalFilesNum + ")" : "")
  );
  g_window.webContents.send(
    g_ipcChannel + "update-info-text",
    fileUtils.reducePathString(inputFilePath)
  );
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-title-extracting") + ":"
  );
  g_window.webContents.send(g_ipcChannel + "update-log-text", inputFilePath);

  let tempFolderPath = fileUtils.createTempFolder();
  // extract to temp folder
  if (
    inputFileType === FileDataType.ZIP ||
    inputFileType === FileDataType.RAR ||
    inputFileType === FileDataType.EPUB
  ) {
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
      _("tool-shared-modal-log-extracting-pages") + "..."
    );
    g_window.webContents.send(
      g_ipcChannel + "extract-pdf-images",
      tempFolderPath,
      _("tool-shared-modal-log-extracting-page") + ": "
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
    let subFolderPath = path.join(outputFolderPath, fileName);
    let i = 1;
    while (fs.existsSync(subFolderPath)) {
      i++;
      subFolderPath = path.join(outputFolderPath, fileName + "(" + i + ")");
    }

    let tempFolderPath = fileUtils.getTempFolderPath();
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    if (imgFilePaths === undefined || imgFilePaths.length === 0) {
      stopError("imgFiles === undefined || imgFiles.length === 0");
      return;
    }
    // ref: https://www.npmjs.com/package/natural-compare-lite
    imgFilePaths.sort(naturalCompare);

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
        g_window.webContents.send(
          g_ipcChannel + "update-log-text",
          _("tool-shared-modal-log-resizing-image") +
            ": " +
            index +
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
          .resize(Math.round(data.width * (outputScale / 100)))
          .toFile(tmpFilePath);

        fs.unlinkSync(filePath);
        fs.renameSync(tmpFilePath, filePath);
      }
    }

    // change format
    if (g_cancel === true) {
      stopCancel();
      return;
    }
    if (outputFormat != FileExtension.NOTSET) {
      g_window.webContents.send(
        g_ipcChannel + "update-log-text",
        _("tool-shared-modal-log-converting-images") + "..."
      );
      // avoid EBUSY error on windows
      // ref: https://stackoverflow.com/questions/41289173/node-js-module-sharp-image-processor-keeps-source-file-open-unable-to-unlink
      sharp.cache(false);
      for (let index = 0; index < imgFilePaths.length; index++) {
        g_window.webContents.send(
          g_ipcChannel + "update-log-text",
          _("tool-shared-modal-log-converting-image") +
            ": " +
            index +
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
        if (outputFormat === FileExtension.JPG) {
          await sharp(filePath)
            .jpeg({
              quality: outputQuality,
            })
            .toFile(tmpFilePath);
        } else if (outputFormat === FileExtension.PNG) {
          if (outputQuality < 100) {
            await sharp(filePath)
              .png({
                quality: outputQuality,
              })
              .toFile(tmpFilePath);
          } else {
            await sharp(filePath).png().toFile(tmpFilePath);
          }
        } else if (outputFormat === FileExtension.WEBP) {
          await sharp(filePath)
            .webp({
              quality: outputQuality,
            })
            .toFile(tmpFilePath);
        }
        let newFilePath = path.join(
          fileFolderPath,
          fileName + "." + outputFormat
        );
        fs.unlinkSync(filePath);
        fs.renameSync(tmpFilePath, newFilePath);
        imgFilePaths[index] = newFilePath;
      }
    }

    createFolderWithImages(imgFilePaths, subFolderPath);
  } catch (err) {
    stopError(err);
  }
}

async function createFolderWithImages(imgFilePaths, outputFolderPath) {
  if (g_cancel === true) {
    stopCancel();
    return;
  }
  try {
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-ec-modal-log-extracting-to") + ":"
    );
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      outputFolderPath
    );
    // create subFolderPath
    if (!fs.existsSync(outputFolderPath)) {
      fs.mkdirSync(outputFolderPath);
      for (let index = 0; index < imgFilePaths.length; index++) {
        let oldPath = imgFilePaths[index];
        let newPath = path.join(outputFolderPath, path.basename(oldPath));
        fs.renameSync(oldPath, newPath);
      }
      g_window.webContents.send(g_ipcChannel + "finished-ok");
    } else {
      stopError("tool-ec folder shouldn't exist");
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
      text: _("tool-shared-tooltip-output-size"),
    },
    {
      id: "tooltip-output-folder",
      text: _("tool-ec-tooltip-output-folder"),
    },
    {
      id: "tooltip-remove-from-list",
      text: _("tool-shared-tooltip-remove-from-list"),
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
      id: "text-quality",
      text: _("tool-shared-ui-output-options-quality"),
    },
    {
      id: "text-format",
      text: _("tool-shared-ui-output-options-format"),
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
      text: _("tool-shared-ui-extract").toUpperCase(),
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
