const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const fileUtils = require("../../file-utils");
const mainProcess = require("../../main");
const { FileExtension, FileDataType } = require("../../constants");
const sharp = require("sharp");

let g_window;
let g_cancel = false;
let g_worker;
let g_resizeWindow;
let g_ipcChannel = "tool-ci--";

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
      _("tool-ci-title"),
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
      FileExtension.AVIF,
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
        fileType = FileDataType.IMG;
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

ipcMain.on(
  g_ipcChannel + "start",
  (
    event,
    inputFiles,
    outputScale,
    outputQuality,
    outputFormat,
    outputFolderPath
  ) => {
    start(
      inputFiles,
      outputScale,
      outputQuality,
      outputFormat,
      outputFolderPath
    );
  }
);

ipcMain.on(g_ipcChannel + "stop-error", (event, error) => {
  stopError(error);
});

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

function stopError(err) {
  g_window.webContents.send(g_ipcChannel + "update-log-text", err);
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-conversion-error")
  );
  g_window.webContents.send(g_ipcChannel + "finished-error");
}

function stopCancel(numAttempted) {
  fileUtils.cleanUpTempFolder();
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-conversion-canceled")
  );
  g_window.webContents.send(g_ipcChannel + "finished-canceled", numAttempted);
}

async function start(
  imgFiles,
  outputScale,
  outputQuality,
  outputFormat,
  outputFolderPath
) {
  try {
    g_cancel = false;
    outputScale = parseInt(outputScale);
    outputQuality = parseInt(outputQuality);
    let numErrors = 0;
    let numFiles = imgFiles.length;

    g_window.webContents.send(
      g_ipcChannel + "update-title-text",
      _("tool-shared-modal-title-converting")
    );
    g_window.webContents.send(g_ipcChannel + "update-info-text", "");
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-shared-modal-log-converting-images") + "..."
    );

    let tempFolderPath = fileUtils.createTempFolder();
    // avoid EBUSY error on windows
    // ref: https://stackoverflow.com/questions/41289173/node-js-module-sharp-image-processor-keeps-source-file-open-unable-to-unlink
    sharp.cache(false);
    for (let index = 0; index < imgFiles.length; index++) {
      try {
        if (g_cancel === true) {
          stopCancel(index);
          return;
        }
        let originalFilePath = imgFiles[index].path;
        let filePath = path.join(
          tempFolderPath,
          path.basename(imgFiles[index].path)
        );
        fs.copyFileSync(imgFiles[index].path, filePath);
        let fileName = path.basename(filePath, path.extname(filePath));
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
        // resize first if needed
        if (outputScale < 100) {
          if (g_cancel === true) {
            stopCancel(index);
            return;
          }
          g_window.webContents.send(
            g_ipcChannel + "update-log-text",
            _("tool-shared-modal-log-resizing-image") + ": " + originalFilePath
          );
          let tmpFilePath = path.join(
            tempFolderPath,
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
        // convert
        g_window.webContents.send(
          g_ipcChannel + "update-log-text",
          _("tool-shared-modal-log-converting-image") + ": " + originalFilePath
        );
        g_window.webContents.send(
          g_ipcChannel + "update-log-text",
          _("tool-ec-modal-log-extracting-to") + ": " + outputFilePath
        );
        if (outputFormat === FileExtension.JPG) {
          await sharp(filePath)
            .withMetadata()
            .jpeg({
              quality: outputQuality,
            })
            .toFile(outputFilePath);
        } else if (outputFormat === FileExtension.PNG) {
          if (outputQuality < 100) {
            await sharp(filePath)
              .withMetadata()
              .png({
                quality: outputQuality,
              })
              .toFile(outputFilePath);
          } else {
            await sharp(filePath).png().toFile(outputFilePath);
          }
        } else if (outputFormat === FileExtension.WEBP) {
          await sharp(filePath)
            .withMetadata()
            .webp({
              quality: outputQuality,
            })
            .toFile(outputFilePath);
        } else if (outputFormat === FileExtension.AVIF) {
          await sharp(filePath)
            .withMetadata()
            .avif({
              quality: outputQuality,
            })
            .toFile(outputFilePath);
        }
        fs.unlinkSync(filePath);
      } catch (err) {
        g_window.webContents.send(g_ipcChannel + "update-log-text", err);
        numErrors++;
      }
    }
    // DONE /////////////////////
    fileUtils.cleanUpTempFolder();
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
    g_window.show();
    g_window.webContents.send(g_ipcChannel + "show-result");
  } catch (err) {
    conversionStopError(err);
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
  ];
}
