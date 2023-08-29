/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const os = require("os");
const path = require("path");

const settings = require("../shared/main/settings");
const history = require("../shared/main/history");
const i18n = require("../shared/main/i18n");
const log = require("../shared/main/logger");
const themes = require("../shared/main/themes");
const menuBar = require("../shared/main/menu-bar");
const fileUtils = require("../shared/main/file-utils");
const appUtils = require("../shared/main/app-utils");
const fileFormats = require("../shared/main/file-formats");

const reader = require("../reader/main");
const audioPlayer = require("../audio-player/main");
const toolPreferences = require("../tools/preferences/main");
const toolHistory = require("../tools/history/main");
const toolConvertComics = require("../tools/convert-comics/main");
const toolExtractComics = require("../tools/extract-comics/main");
const toolConvertImgs = require("../tools/convert-imgs/main");
const toolExtractPalette = require("../tools/extract-palette/main");
const toolExtractText = require("../tools/extract-text/main");
const toolCreateQr = require("../tools/create-qr/main");
const toolExtractQr = require("../tools/extract-qr/main");
const toolDcm = require("../tools/dcm/main");
const toolInternetArchive = require("../tools/internet-archive/main");
const toolGutenberg = require("../tools/gutenberg/main");
const toolXkcd = require("../tools/xkcd/main");
const toolLibrivox = require("../tools/librivox/main");
const toolWiktionary = require("../tools/wiktionary/main");
const toolComicInfoXml = require("../tools/comicinfoxml/main");

let g_mainWindow;
let g_isLoaded = false;
let g_systemInfo = {};

///////////////////////////////////////////////////////////////////////////////
// TOOLS //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentTool = "reader";
let g_tools = {};
g_tools["reader"] = reader;
g_tools["audio-player"] = audioPlayer;
g_tools["tool-preferences"] = toolPreferences;
g_tools["tool-history"] = toolHistory;
g_tools["tool-convert-comics"] = toolConvertComics;
g_tools["tool-extract-comics"] = toolExtractComics;
g_tools["tool-convert-imgs"] = toolConvertImgs;
g_tools["tool-extract-palette"] = toolExtractPalette;
g_tools["tool-extract-text"] = toolExtractText;
g_tools["tool-create-qr"] = toolCreateQr;
g_tools["tool-extract-qr"] = toolExtractQr;
g_tools["tool-dcm"] = toolDcm;
g_tools["tool-internet-archive"] = toolInternetArchive;
g_tools["tool-gutenberg"] = toolGutenberg;
g_tools["tool-xkcd"] = toolXkcd;
g_tools["tool-librivox"] = toolLibrivox;
g_tools["tool-wiktionary"] = toolWiktionary;
g_tools["tool-comicinfoxml"] = toolComicInfoXml;

function getTools() {
  return g_tools;
}
exports.getTools = getTools;

function switchTool(tool, ...args) {
  if (g_currentTool !== tool) {
    if (g_tools[g_currentTool].close) g_tools[g_currentTool].close();
    g_currentTool = tool;
    sendIpcToCoreRenderer("show-tool", tool);
    g_tools[tool].open(...args);
  }
}
exports.switchTool = switchTool;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const createWindow = () => {
  // gather system info
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  let isDev = false;
  for (let index = 1; index < process.argv.length; index++) {
    if (process.argv[index] === "--dev") {
      isDev = true;
      break;
    }
  }
  g_systemInfo = {
    platform: os.platform(),
    release: os.release(),
    hostname: os.hostname(),
    isSteamDeck: false,
    isGameScope: false,
    screenWidth: primaryDisplay.workAreaSize.width,
    screenHeight: primaryDisplay.workAreaSize.height,
    isDev: isDev,
  };
  if (
    !g_systemInfo.screenWidth ||
    !Number.isInteger(g_systemInfo.screenWidth) ||
    g_systemInfo.screenWidth <= 0
  )
    g_systemInfo.screenWidth = 800;
  if (
    !g_systemInfo.screenHeight ||
    !Number.isInteger(g_systemInfo.screenHeight) ||
    g_systemInfo.screenHeight <= 0
  )
    g_systemInfo.screenHeight = 600;
  // init before win creation
  log.init(g_systemInfo);
  settings.init(g_systemInfo);
  menuBar.empty();
  // steam deck detection
  if (
    (g_systemInfo.platform =
      "linux" &&
      (g_systemInfo.hostname === "steamdeck" ||
        g_systemInfo.release.includes("valve")))
  ) {
    log.debug("is steam deck");
    g_systemInfo.isSteamDeck = true;
    if (process.env.SteamDeck == 1) {
      log.debug("is gaming mode");
      // the environment variable "SteamDeck" is set to 1 in gamescope,
      // and it's not present in desktop mode.
      // not sure if this is official and will always be so.
      g_systemInfo.isGameScope = true;
      settings.setValue("width", 1280);
      settings.setValue("height", 800);
    }
  }
  // log system data
  log.debug("dev mode: " + g_systemInfo.isDev);
  log.debug("release version: " + app.isPackaged);
  log.debug("work area width: " + g_systemInfo.screenWidth);
  log.debug("work area height: " + g_systemInfo.screenHeight);
  log.debug("starting width: " + settings.getValue("width"));
  log.debug("starting height: " + settings.getValue("height"));
  log.debug("maximized: " + settings.getValue("maximize"));
  // win creation
  g_mainWindow = new BrowserWindow({
    width: settings.getValue("width"),
    height: settings.getValue("height"),
    resizable: true,
    frame: false,
    icon: path.join(__dirname, "../assets/images/icon_256x256.png"),
    show: false,
    webPreferences: {
      sandbox: false, // needed for the custom-title-bar to work
      preload: path.join(__dirname, "preload.js"),
    },
  });
  // init after win creation
  // load html
  if (settings.getValue("pdfReadingLib") === 1) {
    g_mainWindow.loadFile(path.join(__dirname, "index-2.html"));
  } else {
    g_mainWindow.loadFile(path.join(__dirname, "index-1.html"));
  }
  // win events
  g_mainWindow.webContents.on("did-finish-load", function () {
    g_isLoaded = true;
    let tempFolderPath = settings.getValue("tempFolderPath");
    if (!tempFolderPath) {
      log.error("Temp folder path is undefined");
    }
    if (!path.isAbsolute(tempFolderPath)) {
      tempFolderPath = path.resolve(
        appUtils.getExeFolderPath(),
        tempFolderPath
      );
    }
    fileUtils.setTempFolderParentPath(tempFolderPath);
    fileFormats.init(app.isPackaged);
    history.init(settings.getValue("history_capacity"));
    i18n.init();
    themes.init();
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    menuBar.init(g_mainWindow);
    // add extra divs after menuBar init, so its container is already created
    sendIpcToCoreRenderer("append-structure-divs");
    reader.init();
    g_mainWindow.center();
    if (settings.getValue("maximize")) {
      g_mainWindow.maximize();
    }
    g_mainWindow.webContents.on("context-menu", function (e, params) {
      sendIpcToCoreRenderer("show-context-menu", params);
    });
    g_mainWindow.show();
  });

  g_mainWindow.on("resize", function () {
    if (g_isLoaded && g_mainWindow.isNormal()) {
      let width = g_mainWindow.getSize()[0];
      let height = g_mainWindow.getSize()[1];
      settings.setValue("width", width);
      settings.setValue("height", height);
    }
    reader.onResize();
    if (g_currentTool !== "reader") g_tools[g_currentTool]?.onResize();
  });

  g_mainWindow.on("maximize", function () {
    settings.setValue("maximize", true);
    reader.onMaximize();
    if (g_currentTool !== "reader") g_tools[g_currentTool]?.onMaximize();
  });

  g_mainWindow.on("unmaximize", function () {
    settings.setValue("maximize", false);
  });
};

app.whenReady().then(() => {
  createWindow();
  // macos
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  reader.onQuit();
  settings.save();
  history.save();
  // clean up
  fileUtils.cleanUpTempFolder();
  appUtils.cleanUpUserDataFolder();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("web-contents-created", (event, contents) => {
  // ref: https://www.electronjs.org/docs/latest/tutorial/security
  contents.on("will-navigate", (event, navigationUrl) => {
    event.preventDefault();
  });
  contents.on("new-window", async (event, navigationUrl) => {
    event.preventDefault();
  });
});

// TODO in case I decide to allow only one instance
// ref: https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
// const gotTheLock = app.requestSingleInstanceLock()
// if (!gotTheLock) {
//   app.quit()
// } else {
//   app.on('second-instance', (event, commandLine, workingDirectory) => {
//     // Someone tried to run a second instance, we should focus our window.
//     if (myWindow) {
//       if (myWindow.isMinimized()) myWindow.restore()
//       myWindow.focus()
//     }
//   })
// }

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  g_mainWindow.webContents.send("renderer", args);
}
exports.sendIpcToRenderer = sendIpcToRenderer;

function sendIpcToPreload(...args) {
  g_mainWindow.webContents.send("preload", args);
}
exports.sendIpcToPreload = sendIpcToPreload;

function sendIpcToCoreRenderer(...args) {
  sendIpcToRenderer("core", ...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

ipcMain.on("main", (event, args) => {
  g_tools[args[0]]?.onIpcFromRenderer(...args.slice(1));
});

ipcMain.handle("main", async (event, args) => {
  g_tools[args[0]]?.handleIpcFromRenderer(...args.slice(1));
});

ipcMain.on("tools-worker", (event, ...args) => {
  g_tools[args[0]]?.onIpcFromToolsWorkerRenderer(...args.slice(1));
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function isDev() {
  return g_systemInfo.isDev;
}
exports.isDev = isDev;

exports.getMainWindow = function () {
  return g_mainWindow;
};

function toggleDevTools() {
  g_mainWindow.toggleDevTools();
}
exports.toggleDevTools = toggleDevTools;

function toggleFullScreen() {
  reader.setFullScreen(!g_mainWindow.isFullScreen());
}
exports.toggleFullScreen = toggleFullScreen;

///////////////////////////////////////////////////////////////////////////////
// MENU MSGS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.onMenuPreferences = function () {
  switchTool("tool-preferences");
  sendIpcToPreload("update-menubar");
};

exports.onMenuOpenHistoryManager = function () {
  switchTool("tool-history");
  sendIpcToPreload("update-menubar");
};

/////////////

exports.onMenuToggleAudioPlayer = function () {
  reader.showAudioPlayer(!settings.getValue("showAudioPlayer"));
  sendIpcToPreload("update-menubar");
};

exports.onMenuToggleFullScreen = function () {
  toggleFullScreen();
};

// TOOLS /////////////

exports.onMenuToolConvertComics = function () {
  switchTool("tool-convert-comics", 0);
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolCreateComic = function () {
  switchTool("tool-convert-comics", 1);
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolCreateQR = function () {
  switchTool("tool-create-qr");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolConvertImages = function () {
  switchTool("tool-convert-imgs");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractText = function () {
  switchTool("tool-extract-text");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractQR = function () {
  switchTool("tool-extract-qr");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractPalette = function () {
  switchTool("tool-extract-palette");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractComics = function () {
  switchTool("tool-extract-comics");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolDCM = function () {
  switchTool("tool-dcm");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolIArchive = function () {
  switchTool("tool-internet-archive");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolGutenberg = function () {
  switchTool("tool-gutenberg");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolXkcd = function () {
  switchTool("tool-xkcd");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolLibrivox = function () {
  switchTool("tool-librivox");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolWiktionary = function () {
  switchTool("tool-wiktionary");
  sendIpcToPreload("update-menubar");
};

//////////////////

exports.onMenuToggleDevTools = function () {
  toggleDevTools();
};

exports.onMenuAbout = function () {
  sendIpcToCoreRenderer(
    "show-modal-info",
    "ACBR",
    `ACBR Comic Book Reader\n${i18n._(
      "ui-modal-info-version"
    )}: ${app.getVersion()}\n(c) Álvaro García\nwww.binarynonsense.com`,
    i18n._("ui-modal-prompt-button-ok")
  );
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: (2023/08/02) I'm using v3.x of the tesseract.js module as v4.x
// was giving errors.
// TODO: try newer versions & investigate further.

// NOTE: (2023/07/31) I'm freezing the sharp module version to 0.31.3 as
// 0.32.4 was crashing the app when resizing and previous versions didn't
// work with the current electron version I'm using.
// TODO: try newer versions of sharp when available & investigate further.

// NOTE: I'm freezing the epubjs module version to 0.3.93 as I'm customizing
// some of its functions from my code and later versions may break things.
// TODO: test newer versions when available if needed.

// NOTE: I'm freezing the music-metadata module version to 7.13.4 as later
// versions require projects to be ESM.
// https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

// NOTE: I'm freezing the file-type module version to 14.7.1 as later
// versions require projects to be ESM.
// https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
