const { Menu, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const mainProcess = require("../../main");
const fileUtils = require("../../file-utils");
const { FileExtension } = require("../../constants");
const jsQR = require("jsqr");

let g_window;
let g_ipcChannel = "tool-eq--";

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

  // if (isDev()) g_window.toggleDevTools();

  g_window.on("closed", () => {
    g_window = undefined;
    fileUtils.cleanUpTempFolder();
  });

  g_window.webContents.on("did-finish-load", function () {
    if (filePath) {
      let stats = fs.statSync(filePath);
      if (!stats.isFile()) return; // avoid folders accidentally getting here
      g_window.webContents.send(g_ipcChannel + "update-image", filePath);
    }

    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("tool-eq-title"),
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

ipcMain.on(g_ipcChannel + "start", (event, imgData, imgWidth, imgHeight) => {
  try {
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-extracting").toUpperCase()
    );
    const code = jsQR(imgData, imgWidth, imgHeight);
    if (code && code.data) {
      g_window.webContents.send(g_ipcChannel + "fill-textarea", code.data);
      g_window.webContents.send(g_ipcChannel + "modal-close");
    } else {
      g_window.webContents.send(g_ipcChannel + "fill-textarea", "");
      throw {
        name: "GenericError",
        message: _("tool-eq-modal-alert-msg-errornodatafound"),
      };
    }
  } catch (error) {
    console.log(error);
    cancelExtraction(error);
  }
});

ipcMain.on(g_ipcChannel + "cancel-extraction", (event, error) => {
  cancelExtraction(error);
});

///////////////////////////////////////////////////////////////////////////////

function cancelExtraction(error) {
  if (error) {
    g_window.webContents.send(
      g_ipcChannel + "show-modal-alert",
      _("tool-eq-modal-alert-title-errorextracting"),
      error.message
    );
  }
  g_window.webContents.send(g_ipcChannel + "modal-close");
}

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "header-input-file",
      text: _("tool-et-header-input-file"),
    },
    {
      id: "header-output-text",
      text: _("tool-et-header-output-text"),
    },
    {
      id: "button-add-file",
      text: _("tool-et-button-add-file").toUpperCase(),
    },
    {
      id: "button-copy-text",
      text: _("tool-et-button-copy-text").toUpperCase(),
    },
    {
      id: "button-extract-text",
      text: _("tool-et-button-extract-text").toUpperCase(),
    },
    {
      id: "header-language",
      text: _("tool-et-header-language"),
    },
    {
      id: "span-language-checkbox-info",
      text: _("tool-et-span-language-checkbox-info"),
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
