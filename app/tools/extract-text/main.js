const { Menu, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const mainProcess = require("../../main");
const fileUtils = require("../../file-utils");
const { ToolType, FileExtension } = require("../../constants");

const { createWorker } = require("tesseract.js");

let g_toolWindow;
let g_toolType = ToolType.EXTRACT_TEXT;

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

exports.showWindow = function (toolType, parentWindow, filePath) {
  if (g_toolWindow !== undefined) return; // TODO: focus the existing one?
  let [width, height] = parentWindow.getSize();
  height = (90 * height) / 100;
  if (height < 700) height = 700;
  width = 1024;

  g_toolWindow = new BrowserWindow({
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

  g_toolType = toolType;

  g_toolWindow.menuBarVisible = false;
  g_toolWindow.loadFile(`${__dirname}/index.html`);

  //if (isDev()) g_toolWindow.toggleDevTools();

  g_toolWindow.on("closed", () => {
    g_toolWindow = undefined;
    fileUtils.cleanUpTempFolder();
  });

  g_toolWindow.webContents.on("did-finish-load", function () {
    if (filePath) {
      let stats = fs.statSync(filePath);
      if (!stats.isFile()) return; // avoid folders accidentally getting here
      g_toolWindow.webContents.send("update-image", filePath);
    }

    let toolHeaderText = _("tool-ocr-title");

    g_toolWindow.webContents.send(
      "update-localization",
      toolHeaderText,
      getLocalization()
    );
  });

  // ref: https://github.com/electron/electron/issues/4068#issuecomment-274159726
  g_toolWindow.webContents.on("context-menu", (e, props) => {
    const { selectionText } = props;
    if (selectionText && selectionText.trim() !== "") {
      selectionMenu.popup(g_toolWindow);
    }
  });
};

////////////////////////////////////////////////////////////////////////

ipcMain.on("choose-file", (event) => {
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
      g_toolWindow,
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
    g_toolWindow.webContents.send("update-image", filePath);
  } catch (error) {
    console.log(error);
  }
});

ipcMain.on("ocr-base64-img", (event, inputBase64Img, language, offline) => {
  try {
    g_toolWindow.webContents.send(
      "modal-update-title",
      _("tool-ocr-modal-title").toUpperCase()
    );
    g_toolWindow.webContents.send(
      "modal-update-info",
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
          g_toolWindow.webContents.send("modal-update-log", m.status);
        },
      };
    } else {
      options = {
        cacheMethod: "none",
        logger: (m) => {
          g_toolWindow.webContents.send("modal-update-log", m.status);
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
      g_toolWindow.webContents.send("modal-update-log", "done");
      g_toolWindow.webContents.send("modal-close");
      g_toolWindow.webContents.send("fill-textarea", text);
      await worker.terminate();
    })();
  } catch (error) {
    console.log(error);
  }
});

ipcMain.on("cancel-extraction", (event) => {
  g_toolWindow.webContents.send("close-modal");
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
