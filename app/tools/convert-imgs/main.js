const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
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

ipcMain.on(g_ipcChannel + "choose-file", (event) => {
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
  (event, inputFiles, outputFormat, outputFolderPath) => {
    start(inputFiles, outputFormat, outputFolderPath);
  }
);

ipcMain.on(g_ipcChannel + "stop-error", (event, err) => {
  stopError(err);
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

function stopCancel() {
  fileUtils.cleanUpTempFolder();
  g_window.webContents.send(
    g_ipcChannel + "update-log-text",
    _("tool-shared-modal-log-conversion-canceled")
  );
  g_window.webContents.send(g_ipcChannel + "finished-canceled");
}

async function start(imgFiles, outputFormat, outputFolderPath) {
  g_cancel = false;

  try {
    g_window.webContents.send(
      g_ipcChannel + "update-title-text",
      _("tool-shared-modal-title-converting")
    );
    g_window.webContents.send(g_ipcChannel + "update-info-text", "");
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-shared-modal-title-converting")
    );

    // compress to output folder
    g_window.webContents.send(
      g_ipcChannel + "update-log-text",
      _("tool-shared-modal-log-converting-images")
    );
    let numErrors = 0;
    let numFiles = imgFiles.length;
    // avoid EBUSY error on windows
    // ref: https://stackoverflow.com/questions/41289173/node-js-module-sharp-image-processor-keeps-source-file-open-unable-to-unlink
    sharp.cache(false);

    for (let index = 0; index < imgFiles.length; index++) {
      let filePath = imgFiles[index].path;
      g_window.webContents.send(g_ipcChannel + "update-log-text", filePath);
      let fileName = path.basename(filePath, path.extname(filePath));
      let outputFilePath = path.join(
        outputFolderPath,
        fileName + "." + outputFormat
      );
      while (fs.existsSync(outputFilePath)) {
        i++;
        outputFilePath = path.join(
          outputFolderPath,
          fileName + "(" + i + ")." + outputFormat
        );
      }
      g_window.webContents.send(
        g_ipcChannel + "update-log-text",
        "-> " + outputFilePath
      );

      try {
        if (outputFormat === FileExtension.JPG) {
          await sharp(filePath).jpeg().toFile(outputFilePath);
        } else if (outputFormat === FileExtension.PNG) {
          await sharp(filePath).png().toFile(outputFilePath);
        } else if (outputFormat === FileExtension.WEBP) {
          await sharp(filePath).webp().toFile(outputFilePath);
        }
      } catch (err) {
        g_window.webContents.send(g_ipcChannel + "update-log-text", err);
        numErrors++;
      }
    }

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
      id: "text-output-size",
      text: _("tool-shared-ui-output-size"),
    },
    {
      id: "text-scale",
      text: _("tool-shared-ui-scale"),
    },
    {
      id: "text-quality",
      text: _("tool-shared-ui-quality"),
    },
    {
      id: "text-output-format",
      text: _("tool-shared-ui-output-format"),
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
