/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const settings = require("../shared/main/settings");
const history = require("../shared/main/history");
const i18n = require("../shared/main/i18n");
const themes = require("../shared/main/themes");
const menuBar = require("../shared/main/menu-bar");
const fileUtils = require("../shared/main/file-utils");
const reader = require("../reader/main");
const audioPlayer = require("../audio-player/main");
const toolPreferences = require("../tools/preferences/main");
const toolHistory = require("../tools/history/main");
const toolConvertComics = require("../tools/convert-comics/main");

let g_mainWindow;
let g_isLoaded = false;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const createWindow = () => {
  g_mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    frame: false,
    icon: path.join(__dirname, "assets/images/icon_256x256.png"),
    show: false,
    webPreferences: {
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
      nodeIntegrationInWorker: true, // for webworker
    },
  });
  // NOTE: 'sandbox: false' is needed for the custom-title-bar module to work
  g_mainWindow.loadFile(path.join(__dirname, "index.html"));

  g_mainWindow.webContents.on("did-finish-load", function () {
    g_isLoaded = true;
    // if (isDev()) g_mainWindow.webContents.openDevTools();
    settings.init();
    history.init(settings.getValue("history_capacity"));
    i18n.init();
    themes.init();
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    menuBar.init(g_mainWindow);
    // add extra divs after menuBar init, so its container is already created
    sendIpcToCoreRenderer("append-structure-divs");
    reader.init();
    g_mainWindow.setSize(
      settings.getValue("width"),
      settings.getValue("height")
    );
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
  fileUtils.cleanUpUserDataFolder();
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
  return process.argv[2] == "--dev";
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
  switchTool("tool-convert-comics");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolCreateComic = function () {
  const tool = require("./tools/create-comic/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolCreateQR = function () {
  const tool = require("./tools/create-qr/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolConvertImages = function () {
  const tool = require("./tools/convert-imgs/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractText = function () {
  const tool = require("./tools/extract-text/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractQR = function () {
  const tool = require("./tools/extract-qr/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractPalette = function () {
  const tool = require("./tools/extract-palette/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractComics = function () {
  const tool = require("./tools/extract-comics/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolDCM = function () {
  const tool = require("./tools/dcm/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolIArchive = function () {
  const tool = require("./tools/internet-archive/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolGutenberg = function () {
  const tool = require("./tools/gutenberg/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolXkcd = function () {
  const tool = require("./tools/xkcd/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolLibrivox = function () {
  const tool = require("./tools/librivox/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolWiktionary = function () {
  const tool = require("./tools/wiktionary/main");
  tool.showWindow(core.getMainWindow());
  sendIpcToPreload("update-menubar");
};

//////////////////

exports.onMenuToggleDevTools = function () {
  toggleDevTools();
};

exports.onMenuAbout = function () {
  // TODO: don't use reader modal?
  sendIpcToCoreRenderer(
    "show-modal-info",
    "ACBR",
    "ACBR Comic Book Reader\n" +
      i18n._("ui-modal-info-version") +
      ": " +
      app.getVersion() +
      "\n(c) Álvaro García\nwww.binarynonsense.com",
    i18n._("ui-modal-prompt-button-ok")
  );
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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
