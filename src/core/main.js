/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const timers = require("../shared/main/timers");
timers.start("startup");

const { app, BrowserWindow, ipcMain } = require("electron");
const os = require("os");
const fs = require("fs");
const path = require("path");

const settings = require("../shared/main/settings");
const history = require("../shared/main/history");
const i18n = require("../shared/main/i18n");
const log = require("../shared/main/logger");
const themes = require("../shared/main/themes");
const menuBar = require("../shared/main/menu-bar");
const appUtils = require("../shared/main/app-utils");
const fileFormats = require("../shared/main/file-formats");
const temp = require("../shared/main/temp");

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
const toolFileBrowser = require("../tools/file-browser/main");

let g_mainWindow;
let g_isLoaded = false;
let g_launchInfo = {};

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
g_tools["tool-file-browser"] = toolFileBrowser;

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

g_launchInfo = {
  platform: os.platform(),
  release: os.release(),
  hostName: os.hostname(),
  isSteamDeck: false,
  isGameScope: false,
  isDev: false,
  isRelease: app.isPackaged,
  parsedArgs: {},
};
exports.getLaunchInfo = function () {
  return g_launchInfo;
};

// steam deck detection
if (
  (g_launchInfo.platform =
    "linux" &&
    (g_launchInfo.hostName === "steamdeck" ||
      g_launchInfo.release.includes("valve")))
) {
  g_launchInfo.isSteamDeck = true;
  if (process.env.SteamDeck == 1) {
    // the environment variable "SteamDeck" is set to 1 in gamescope,
    // and it's not present in desktop mode.
    // not sure if this is official and will always be so.
    g_launchInfo.isGameScope = true;
  }
}
// parse command line arguments
g_launchInfo.parsedArgs = require("minimist")(
  process.argv.slice(g_launchInfo.isRelease ? 1 : 2),
  { boolean: ["dev"], string: ["tool", "output-format", "output-folder"] }
);
g_launchInfo.isDev = g_launchInfo.parsedArgs["dev"] === true;
// start logging
log.init(g_launchInfo);
log.info("starting ACBR");
log.debug("dev mode: " + g_launchInfo.isDev);
log.debug("release version: " + g_launchInfo.isRelease);
// show vips warnings from sharp only in dev mode
if (!g_launchInfo.isDev) process.env.VIPS_WARNING = 1;
// init window
const createWindow = () => {
  // get screen size
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  g_launchInfo.screenWidth = primaryDisplay.workAreaSize.width;
  g_launchInfo.screenHeight = primaryDisplay.workAreaSize.height;
  if (
    !g_launchInfo.screenWidth ||
    !Number.isInteger(g_launchInfo.screenWidth) ||
    g_launchInfo.screenWidth <= 0
  )
    g_launchInfo.screenWidth = 800;
  if (
    !g_launchInfo.screenHeight ||
    !Number.isInteger(g_launchInfo.screenHeight) ||
    g_launchInfo.screenHeight <= 0
  )
    g_launchInfo.screenHeight = 600;
  // init before win creation
  settings.init(g_launchInfo);
  menuBar.empty();
  if (g_launchInfo.isSteamDeck && g_launchInfo.isGameScope) {
    settings.setValue("width", 1280);
    settings.setValue("height", 800);
  }
  // log size data
  log.debug("work area width: " + g_launchInfo.screenWidth);
  log.debug("work area height: " + g_launchInfo.screenHeight);
  log.debug("starting width: " + settings.getValue("width"));
  log.debug("starting height: " + settings.getValue("height"));
  log.debug("maximized: " + settings.getValue("maximize"));
  log.debug("full screen: " + settings.getValue("fullScreen"));
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
    temp.init(tempFolderPath);
    fileFormats.init(g_launchInfo.isRelease);
    history.init(settings.getValue("history_capacity"));
    i18n.init();
    themes.init();
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    menuBar.init(g_mainWindow);
    // add extra divs after menuBar init, so its container is already created
    sendIpcToCoreRenderer("append-structure-divs");
    // check command line args and setup initial state
    let inputFilePaths = [];
    let inputFileAndFolderPaths = [];
    g_launchInfo.parsedArgs["_"].forEach((path) => {
      if (fs.existsSync(path)) {
        inputFileAndFolderPaths.push(path);
        if (!fs.lstatSync(path).isDirectory()) {
          // TODO: add only valid formats?
          inputFilePaths.push(path);
        }
      }
    });
    const isValidTool = (name) => {
      if (name && typeof name === "string") {
        const validValues = ["cc"];
        for (let index = 0; index < validValues.length; index++) {
          if (validValues[index] === name) return true;
        }
      }
      return false;
    };
    const isValidFormat = (name) => {
      if (name && typeof name === "string") {
        const validValues = ["cbz", "cb7", "epub", "pdf"];
        if (settings.canEditRars()) validValues.push("cbr");
        for (let index = 0; index < validValues.length; index++) {
          if (validValues[index] === name) return true;
        }
      }
      return false;
    };
    if (
      g_launchInfo.parsedArgs["tool"] &&
      isValidTool(g_launchInfo.parsedArgs["tool"])
    ) {
      // start reader with no file open
      reader.init(undefined, false);
      // start tool
      switch (g_launchInfo.parsedArgs["tool"]) {
        case "cc":
          {
            let options = { mode: 0, inputFilePaths: inputFilePaths };
            const outputFolderPath = g_launchInfo.parsedArgs["output-folder"];
            if (
              outputFolderPath &&
              typeof outputFolderPath === "string" &&
              fs.existsSync(outputFolderPath) &&
              fs.lstatSync(outputFolderPath).isDirectory()
            ) {
              options.outputFolderPath = outputFolderPath;
            }
            const outputFormat = g_launchInfo.parsedArgs["output-format"];
            if (
              outputFormat &&
              typeof outputFormat === "string" &&
              isValidFormat(outputFormat)
            ) {
              options.outputFormat = outputFormat;
            }
            switchTool("tool-convert-comics", options);
          }
          break;
      }
    } else if (inputFilePaths.length > 1) {
      // start reader with no file open
      reader.init(undefined, false);
      // start tool
      switchTool("tool-convert-comics", {
        mode: 0,
        inputFilePaths: inputFilePaths,
      });
    } else {
      // start reader, open file if available
      reader.init(
        inputFileAndFolderPaths.length > 0
          ? inputFileAndFolderPaths[0]
          : undefined,
        true
      );
    }
    // show window
    g_mainWindow.center();
    if (settings.getValue("maximize")) {
      g_mainWindow.maximize();
    }
    if (settings.getValue("fullScreen")) {
      toggleFullScreen();
    }
    g_mainWindow.webContents.on("context-menu", function (e, params) {
      sendIpcToCoreRenderer("show-context-menu", params);
    });
    g_mainWindow.show();
    log.debug(`start-up time: ${timers.stop("startup")}s`);
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
  log.info("cleaning up...");
  temp.cleanUp();
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
  return g_launchInfo.isDev;
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
  const newState = !g_mainWindow.isFullScreen();
  reader.setFullScreen(newState);
  if (g_currentTool !== "reader") {
    g_tools[g_currentTool]?.onToggleFullScreen(newState);
  }
  settings.setValue("fullScreen", newState);
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

exports.onMenuQuit = function () {
  app.quit();
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
  switchTool("tool-convert-comics", { mode: 0 });
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolCreateComic = function () {
  switchTool("tool-convert-comics", { mode: 1 });
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
// NOTE: (2024/03/09) tried 0.33.2, still having different types of random
// crashes (GLib-GObject-CRITICAL, ***MEMORY-ERROR***, SIGSEGV, SIGABRT...).

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
