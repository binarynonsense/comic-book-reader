const { Menu, BrowserWindow, ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const mainProcess = require("../../main");
const fileUtils = require("../../file-utils");
const { FileExtension } = require("../../constants");
const palette = require("./palette");

let g_window;
let g_worker;
let g_ipcChannel = "tool-ep--";
let g_currentPalette;

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

const selectionMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { type: "separator" },
  { role: "selectall" },
]);

exports.showWindow = function (parentWindow, filePath) {
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

  //if (isDev()) g_window.toggleDevTools();

  g_window.on("closed", () => {
    g_window = undefined;
    g_currentPalette = undefined;
    if (g_worker !== undefined) {
      g_worker.kill();
      g_worker = undefined;
    }
    fileUtils.cleanUpTempFolder();
  });

  g_window.webContents.on("did-finish-load", function () {
    if (filePath) {
      let stats = fs.statSync(filePath);
      if (!stats.isFile()) return; // avoid folders accidentally getting here
      g_window.webContents.send(g_ipcChannel + "update-image", filePath);
    }

    g_window.webContents.send(
      g_ipcChannel + "update-palette",
      g_currentPalette
    );

    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("tool-ep-title"),
      getLocalization()
    );
  });

  // ref: https://github.com/electron/electron/issues/4068#issuecomment-274159726
  g_window.webContents.on("context-menu", (e, props) => {
    const { selectionText } = props;
    if (selectionText && selectionText.trim() !== "") {
      selectionMenu.popup(g_window);
    }
  });
};

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "choose-file", (event) => {
  try {
    let allowMultipleSelection = false;
    let allowedFileTypesName = "Image Files";
    let allowedFileTypesList = [
      FileExtension.JPG,
      FileExtension.JPEG,
      FileExtension.PNG,
      FileExtension.BMP,
      FileExtension.WEBP,
      FileExtension.AVIF,
    ];
    let filePathsList = fileUtils.chooseOpenFiles(
      g_window,
      undefined,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection
    );
    if (filePathsList === undefined || filePathsList.length === 0) {
      return;
    }
    const filePath = filePathsList[0];
    let stats = fs.statSync(filePath);
    if (!stats.isFile()) return; // avoid folders accidentally getting here
    g_window.webContents.send(g_ipcChannel + "update-image", filePath);
  } catch (error) {
    console.log(error);
  }
});

ipcMain.on(
  g_ipcChannel + "start",
  (event, data, distanceMethod, distanceThreshold, maxQuantizationDepth) => {
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-extracting").toUpperCase()
    );
    g_currentPalette = palette.getPaletteFromCanvasData(
      data,
      distanceMethod,
      distanceThreshold,
      maxQuantizationDepth
    );
    g_window.webContents.send(g_ipcChannel + "modal-close");
    g_window.webContents.send(
      g_ipcChannel + "update-palette",
      g_currentPalette
    );

    // NOTE: sending the data to a child process seems too slow, I'll leave this
    // here in case I want to give it a try again later
    // if (g_worker !== undefined) {
    //   // kill it after one use
    //   g_worker.kill();
    //   g_worker = undefined;
    // }
    // if (g_worker === undefined) {
    //   g_worker = fork(path.join(__dirname, "../shared/worker.js"));
    //   g_worker.on("message", (message) => {
    //     g_worker.kill(); // kill it after one use
    //     if (message[0] === "success") {
    //       g_window.webContents.send(g_ipcChannel + "modal-close");
    //       g_window.webContents.send(g_ipcChannel + "update-palette", message[1]);
    //       return;
    //     } else {
    //       stopError(message);
    //       return;
    //     }
    //   });
    // }
    // g_worker.send(["palette", data]);
  }
);

// ipcMain.on(g_ipcChannel + "cancel", (event) => {
//   stopCancel();
// });

ipcMain.on(g_ipcChannel + "export-to-file", (event, format) => {
  try {
    if (
      g_currentPalette === undefined ||
      g_currentPalette.rgbColors.length <= 0
    ) {
      return;
    }

    let defaultPath = app.getPath("desktop");
    let folderList = fileUtils.chooseFolder(g_window, defaultPath);
    if (folderList === undefined) {
      return;
    }
    let outputFolderPath = folderList[0];
    if (outputFolderPath === undefined || outputFolderPath === "") return;

    let dateString = new Date().toJSON(); //.slice(0, 10);
    dateString = dateString.replaceAll("-", "");
    dateString = dateString.replaceAll(":", "");
    dateString = dateString.replaceAll("T", "_");
    dateString = dateString.split(".")[0];

    let fileName = "acbr_palette_" + dateString;
    let fileExtension = `.${format}`;
    let outputFilePath = path.join(outputFolderPath, fileName + fileExtension);
    let i = 1;
    while (fs.existsSync(outputFilePath)) {
      i++;
      outputFilePath = path.join(
        outputFolderPath,
        fileName + "(" + i + ")" + fileExtension
      );
    }

    if (format === "gpl") {
      // GIMP
      const gpl = require("./gpl");
      let paletteName = "ACBR Palette " + dateString;
      if (gpl.createFile(outputFilePath, g_currentPalette, paletteName)) {
        g_window.webContents.send(
          g_ipcChannel + "export-file-created",
          _("tool-ep-modal-title-exported"),
          fileUtils.reducePathString(outputFilePath, 50)
        );
      } else {
        g_window.webContents.send(
          g_ipcChannel + "export-file-error",
          _("tool-ep-modal-title-exporting-error"),
          fileUtils.reducePathString(outputFilePath, 50)
        );
      }
    } else if (format === "aco") {
      // Adobe PS
      const aco = require("./aco");
      let paletteName = "ACBR Palette " + dateString;
      if (aco.createFile(outputFilePath, g_currentPalette)) {
        g_window.webContents.send(
          g_ipcChannel + "export-file-created",
          _("tool-ep-modal-title-exported"),
          fileUtils.reducePathString(outputFilePath, 50)
        );
      } else {
        g_window.webContents.send(
          g_ipcChannel + "export-file-error",
          _("tool-ep-modal-title-exporting-error"),
          fileUtils.reducePathString(outputFilePath, 50)
        );
      }
    }
  } catch (error) {}
});

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "header-input-file",
      text: _("tool-ep-header-input-file"),
    },
    {
      id: "header-output-palette",
      text: _("tool-ep-header-output-palette"),
    },
    {
      id: "button-add-file",
      text: _("tool-ep-button-add-file").toUpperCase(),
    },
    {
      id: "button-export-to-file",
      text: _("tool-ep-button-export-to-file").toUpperCase(),
    },
    {
      id: "button-start",
      text: _("tool-ep-button-start").toUpperCase(),
    },
    {
      id: "text-advanced-options",
      text: _("tool-shared-ui-advanced-options"),
    },
    {
      id: "text-export-format",
      text: _("tool-ep-export-format"),
    },
    {
      id: "text-max-num-colors",
      text: _("tool-ep-max-num-colors"),
    },
    {
      id: "text-distance-method",
      text: _("tool-ep-distance-method"),
    },
    {
      id: "text-distance-deltae-threshold",
      text: _("tool-ep-distance-deltae-threshold"),
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
