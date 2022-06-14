const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const mainProcess = require("../../main");
const { FileExtension, FileDataType, ToolType } = require("../../constants");

//const Tesseract = require("tesseract.js");

let g_toolWindow;
let g_toolType = ToolType.EXTRACT_TEXT;

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (toolType, parentWindow) {
  if (g_toolWindow !== undefined) return; // TODO: focus the existing one?
  g_toolWindow = new BrowserWindow({
    width: 700,
    height: 650,
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

  g_toolWindow.on("closed", () => {});

  g_toolWindow.webContents.on("did-finish-load", function () {
    // Tesseract.recognize(
    //   "https://tesseract.projectnaptha.com/img/eng_bw.png",
    //   "eng",
    //   { logger: (m) => console.log(m) }
    // ).then(({ data: { text } }) => {
    //   console.log(text);
    // });
  });
};

///////////////////////////////////////////////////////////////////////////////
