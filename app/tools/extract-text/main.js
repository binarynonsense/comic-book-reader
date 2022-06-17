const { Menu, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const mainProcess = require("../../main");
const fileUtils = require("../../file-utils");
const { FileExtension } = require("../../constants");

const { createWorker } = require("tesseract.js");

let g_window;
let g_ipcChannel = "tool-et--";

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
      _("tool-ocr-title"),
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
  (event, inputBase64Img, language, offline) => {
    try {
      g_window.webContents.send(
        g_ipcChannel + "modal-update-title",
        _("tool-modal-title-extracting").toUpperCase()
      );
      g_window.webContents.send(
        g_ipcChannel + "modal-update-info",
        _("tool-ocr-modal-info")
      );
      let base64 = inputBase64Img;
      let options;
      if (offline) {
        options = {
          langPath: path.join(__dirname, "../../assets/ocr-data"),
          cachePath: path.join(__dirname, "../../assets/ocr-data"),
          cacheMethod: "none",
          //gzip: false,
          logger: (m) => {
            g_window.webContents.send(
              g_ipcChannel + "modal-update-log",
              m.status
            );
          },
        };
      } else {
        options = {
          cacheMethod: "none",
          logger: (m) => {
            g_window.webContents.send(
              g_ipcChannel + "modal-update-log",
              m.status
            );
          },
        };
      }

      const worker = createWorker(options);
      (async () => {
        await worker.load();
        await worker.loadLanguage(language);
        await worker.initialize(language);
        const {
          data: { text },
        } = await worker.recognize(base64);
        g_window.webContents.send(g_ipcChannel + "modal-update-log", "done");
        g_window.webContents.send(g_ipcChannel + "modal-close");
        g_window.webContents.send(g_ipcChannel + "fill-textarea", text);
        await worker.terminate();
      })();
    } catch (error) {
      console.log(error);
    }
  }
);

ipcMain.on(g_ipcChannel + "cancel-extraction", (event) => {
  g_window.webContents.send(g_ipcChannel + "close-modal");
});

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "header-input-file",
      text: _("tool-ocr-header-input-file"),
    },
    {
      id: "header-output-text",
      text: _("tool-ocr-header-output-text"),
    },
    {
      id: "button-add-file",
      text: _("tool-ocr-button-add-file").toUpperCase(),
    },
    {
      id: "button-copy-text",
      text: _("tool-ocr-button-copy-text").toUpperCase(),
    },
    {
      id: "button-extract-text",
      text: _("tool-ocr-button-extract-text").toUpperCase(),
    },
    {
      id: "header-language",
      text: _("tool-ocr-header-language"),
    },
    {
      id: "span-language-checkbox-info",
      text: _("tool-ocr-span-language-checkbox-info"),
    },
    {
      id: "button-modal-cancel",
      text: _("tool-ocr-modal-button-cancel").toUpperCase(),
    },
  ];
}
