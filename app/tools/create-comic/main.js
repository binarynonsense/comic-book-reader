const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const naturalCompare = require("natural-compare-lite");
const fileUtils = require("../../file-utils");
const fileFormats = require("../../file-formats");
const mainProcess = require("../../main");
const { FileExtension } = require("../../constants");
const sharp = require("sharp");

let g_window;
let g_cancel = false;
let g_worker;
let g_resizeWindow;
let g_ipcChannel = "tool-cr--";
let g_outputPageOrder = "byPosition";
let g_outputPdfCreationMethod = "metadata";

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow) {
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
      _("tool-cr-title"),
      getLocalization(),
      getTooltipsLocalization()
    );

    g_window.webContents.send(g_ipcChannel + "init", app.getPath("desktop"));
  });

  //if (isDev()) g_window.toggleDevTools();
};

///////////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "choose-file", (event, defaultPath) => {
  try {
    let allowMultipleSelection = true;
    let allowedFileTypesName = "Image Files";
    let allowedFileTypesList = [
      FileExtension.JPG,
      FileExtension.JPEG,
      FileExtension.PNG,
      FileExtension.WEBP,
      FileExtension.BMP,
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
      (async () => {
        g_window.webContents.send(g_ipcChannel + "add-file", filePath);
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

ipcMain.on(g_ipcChannel + "set-pdf-creation-method", (event, method) => {
  g_outputPdfCreationMethod = method;
});

ipcMain.on(g_ipcChannel + "set-page-order", (event, order) => {
  g_outputPageOrder = order;
});

ipcMain.on(g_ipcChannel + "start", (event, inputFiles) => {
  start(inputFiles);
});

ipcMain.on(g_ipcChannel + "stop-error", (event, err) => {
  stopError(err);
});

ipcMain.on(
  g_ipcChannel + "create-file-from-images",
  (event, outputFileName, outputFormat, outputFolderPath) => {
    if (g_resizeWindow !== undefined) {
      g_resizeWindow.destroy();
      g_resizeWindow = undefined;
    }
    createFileFromImages(outputFileName, outputFormat, outputFolderPath);
  }
);

ipcMain.on(
  g_ipcChannel + "end",
  (event, wasCanceled, numFiles, numErrors, numAttempted) => {
    if (!wasCanceled) {
      g_window.webContents.send(
        g_ipcChannel + "update-title-text",
        _("tool-shared-modal-title-creation-finished")
      );

      if (numErrors > 0) {
        g_window.webContents.send(
          g_ipcChannel + "update-info-text",
          _(
            "tool-shared-modal-info-creation-error-num-files",
            numErrors,
            numFiles
          )
        );
      } else {
        g_window.webContents.send(
          g_ipcChannel + "update-info-text",
          _("tool-shared-modal-info-creation-success-num-files", numFiles)
        );
      }
    } else {
      g_window.webContents.send(
        g_ipcChannel + "update-title-text",
        _("tool-shared-modal-title-creation-canceled")
      );
      g_window.webContents.send(
        g_ipcChannel + "update-info-text",
        _(
          "tool-shared-modal-info-creation-results",
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
    _("tool-shared-modal-log-creation-error")
  );
  g_window.webContents.send(g_ipcChannel + "finished-error");
}

function stopCancel() {
  fileUtils.cleanUpTempFolder();
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-creation-canceled")
  );
  g_window.webContents.send(g_ipcChannel + "finished-canceled");
}

function start(inputFiles) {
  g_cancel = false;

  try {
    g_window.webContents.send(
      g_ipcChannel + "update-title-text",
      _("tool-shared-modal-title-creating")
    );
    g_window.webContents.send(g_ipcChannel + "update-info-text", "");

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
    g_window.webContents.send(g_ipcChannel + "images-extracted");
  } catch (err) {
    conversionStopError(err);
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
    let outputFilePath = path.join(
      outputFolderPath,
      outputFileName + "." + outputFormat
    );
    let i = 1;
    while (fs.existsSync(outputFilePath)) {
      i++;
      outputFilePath = path.join(
        outputFolderPath,
        outputFileName + "(" + i + ")." + outputFormat
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
    if (outputFormat === FileExtension.PDF) {
      // avoid EBUSY error on windows
      // ref: https://stackoverflow.com/questions/41289173/node-js-module-sharp-image-processor-keeps-source-file-open-unable-to-unlink
      sharp.cache(false);
      for (let index = 0; index < imgFilePaths.length; index++) {
        if (g_cancel === true) {
          stopCancel();
          return;
        }
        let filePath = imgFilePaths[index];
        if (!fileFormats.hasPdfKitCompatibleImageExtension(filePath)) {
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
            _("tool-shared-modal-log-page-to-compatible-format", index + 1)
          );
          await sharp(filePath).withMetadata().jpeg().toFile(tmpFilePath);

          fs.unlinkSync(filePath);
          fs.renameSync(tmpFilePath, newFilePath);
          imgFilePaths[index] = newFilePath;
        }
      }
    }

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
        g_outputPdfCreationMethod
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
      id: "tooltip-output-folder",
      text: _("tool-shared-tooltip-output-folder"),
    },
    {
      id: "tooltip-remove-from-list",
      text: _("tool-shared-tooltip-remove-from-list"),
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
      text: _("tool-shared-ui-input-images"),
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
      id: "text-format",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "text-page-order",
      text: _("tool-shared-ui-output-options-page-order"),
    },
    {
      id: "text-page-order-o1",
      text: _("tool-shared-ui-output-options-page-order-o1"),
    },
    {
      id: "text-page-order-o2",
      text: _("tool-shared-ui-output-options-page-order-o2"),
    },
    {
      id: "text-advanced-options",
      text: _("tool-shared-ui-advanced-options"),
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
      id: "text-output-name",
      text: _("tool-shared-ui-output-name"),
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
      text: _("tool-shared-ui-create").toUpperCase(),
    },
    {
      id: "button-modal-close",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "button-modal-cancel",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
  ];
}
