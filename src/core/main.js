/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const timers = require("../shared/main/timers");
timers.start("startup");

const { app, BrowserWindow, ipcMain, screen } = require("electron");
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
const tools = require("../shared/main/tools");

const reader = require("../reader/main");

let g_mainWindow;
let g_isLoaded = false;
let g_launchInfo = {};

//////////////////////////////////////////////////////////////////////////////
// LAUNCH INFO ///////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

g_launchInfo = {
  platform: os.platform(),
  release: os.release(),
  hostName: os.hostname(),
  isAppImage: false,
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
  g_launchInfo.platform === "linux" &&
  (g_launchInfo.hostName === "steamdeck" ||
    g_launchInfo.release.includes("valve"))
) {
  g_launchInfo.isSteamDeck = true;
  if (process.env.SteamDeck == 1) {
    // the environment variable "SteamDeck" is set to 1 in gamescope,
    // and it's not present in desktop mode.
    // not sure if this is official and will always be so.
    g_launchInfo.isGameScope = true;
  }
}
if (process.env.APPIMAGE) {
  g_launchInfo.isAppImage = true;
}

// parse command line arguments
g_launchInfo.parsedArgs = require("minimist")(
  process.argv.slice(g_launchInfo.isRelease ? 1 : 2),
  { boolean: ["dev"], string: ["tool", "output-format", "output-folder"] }
);
g_launchInfo.isDev = g_launchInfo.parsedArgs["dev"] === true;

//////////////////////////////////////////////////////////////////////////////
// PREVENT SECOND INSTANCES //////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// NOTE: if not, cleanup would break things when an instance deletes the
// temp folder of another running one, settings changes may get lost, same
// with history...
// ref: https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
const gotTheLock = app.requestSingleInstanceLock({
  launchInfo: g_launchInfo,
});
if (!gotTheLock) {
  app.quit();
} else {
  // ref: https://www.electronjs.org/docs/latest/api/app#event-second-instance
  app.on("second-instance", (event, argv, workingDirectory, additionalData) => {
    log.debug("Tried to open a second instance of the app");
    let inputFilePaths = [];
    additionalData.launchInfo.parsedArgs["_"].forEach((path) => {
      if (fs.existsSync(path)) {
        if (!fs.lstatSync(path).isDirectory()) {
          inputFilePaths.push(path);
        }
      }
    });
    if (inputFilePaths.length > 0) {
      reader.requestOpenConfirmation(inputFilePaths[0]);
    }
    // focus on first instance window
    if (g_mainWindow) {
      if (g_mainWindow.isMinimized()) g_mainWindow.restore();
      g_mainWindow.focus();
    }
  });

  //////////////////////////////////////////////////////////////////////////////
  // SETUP /////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  // start logging
  log.init(g_launchInfo);
  log.info("starting ACBR");
  log.debug("dev mode: " + g_launchInfo.isDev);
  log.debug("release version: " + g_launchInfo.isRelease);
  log.debug("electron version: " + process.versions.electron);
  log.debug("chrome version: " + process.versions.chrome);
  log.debug("node version: " + process.versions.node);
  if (g_launchInfo.isAppImage) {
    log.debug("is AppImage");
  }
  // load settings
  settings.init();
  // check gs_slice
  log.debug("checking environment");
  if (g_launchInfo.platform === "linux" && !process.env.G_SLICE) {
    // NOTE: if G_SLICE isn't set to 'always-malloc' the app may crash
    // during conversions due to an issue with sharp
    if (g_launchInfo.isRelease) {
      if (!settings.getValue("linuxSkipGslice")) {
        log.warning(
          "The G_SLICE environment variable is undefined, setting it to 'always-malloc' and relaunching the app. You can avoid this step by launching ACBR using the ACBR.sh script",
          true
        );
        process.env.G_SLICE = "always-malloc";
        const options = { args: process.argv };
        if (process.env.APPIMAGE) {
          // ref: https://github.com/electron-userland/electron-builder/issues/1727
          options.execPath = process.env.APPIMAGE;
          options.args.unshift("--appimage-extract-and-run");
          app.relaunch(options);
          app.exit(0);
        } else {
          app.relaunch();
          app.exit(0);
        }
      } else {
        log.warning(
          "The G_SLICE environment variable is undefined and linuxSkipGslice is set to true in the settings, you may experience crashes during file conversions.",
          true
        );
      }
    } else {
      log.warning(
        "the G_SLICE environment variable is undefined, you may experience crashes during file conversions.",
        true
      );
    }
  }
  // show vips warnings from sharp only in dev mode
  if (!g_launchInfo.isDev) process.env.VIPS_WARNING = 1;

  tools.init();

  // init window
  const createWindow = () => {
    // screen size
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
    settings.capScreenSizes(
      g_launchInfo.screenWidth,
      g_launchInfo.screenHeight
    );
    if (g_launchInfo.isSteamDeck && g_launchInfo.isGameScope) {
      settings.setValue("width", 1280);
      settings.setValue("height", 800);
    }
    log.debug("work area width: " + g_launchInfo.screenWidth);
    log.debug("work area height: " + g_launchInfo.screenHeight);
    log.debug("starting width: " + settings.getValue("width"));
    log.debug("starting height: " + settings.getValue("height"));
    log.debug("maximized: " + settings.getValue("maximize"));
    log.debug("full screen: " + settings.getValue("fullScreen"));
    // win creation
    menuBar.empty();
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
      i18n.init(g_launchInfo.isDev);
      onLanguageChanged();
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
              tools.switchTool("tool-convert-comics", options);
            }
            break;
        }
      } else if (inputFilePaths.length > 1) {
        // start reader with no file open
        reader.init(undefined, false);
        // start tool
        tools.switchTool("tool-convert-comics", {
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
      const forceMultimonitorSize = settings.getValue(
        "experimentalForceMultimonitorSize"
      );
      if (
        forceMultimonitorSize != undefined &&
        forceMultimonitorSize > 0 &&
        forceMultimonitorSize < 5
      ) {
        // Special/Experimental start-up to force the window to expand to cover
        // multiple screens
        const displays = screen.getAllDisplays();
        let height = 0;
        let width = 0;
        displays.forEach((display) => {
          let displayWidth = display.workAreaSize.width;
          let displayHeight = display.workAreaSize.height;
          if (forceMultimonitorSize === 3) {
            displayWidth = display.size.width;
            displayHeight = display.size.height;
          }
          width += displayWidth;
          if (height === 0) height = displayHeight;
          else height = Math.min(height, displayHeight);
        });
        // NOTE: setSize doesn't seem to work, it limits the size to the
        // bounds of the primary display. But setMinimumSize seems to do the
        // trick. Don't know if this is a universal solution or just my case
        // so I'll leave multiple options for now.
        if (forceMultimonitorSize === 1 || forceMultimonitorSize === 3) {
          g_mainWindow.setSize(width, height);
          g_mainWindow.setMinimumSize(width, height);
        } else if (forceMultimonitorSize === 2) {
          g_mainWindow.setSize(width, height);
          g_mainWindow.setMinimumSize(width, height);
          reader.sendIpcToRenderer("set-menubar-visibility", false);
          reader.sendIpcToRenderer("set-toolbar-visibility", false);
        } else if (forceMultimonitorSize === 4) {
          g_mainWindow.setSize(width, height);
        }
      } else {
        // Normal start-up
        if (settings.getValue("maximize")) {
          g_mainWindow.maximize();
        }
        if (settings.getValue("fullScreen")) {
          toggleFullScreen();
        }
      }
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
      if (tools.getCurrentToolName() !== "reader")
        tools.getCurrentTool()?.onResize();
    });

    g_mainWindow.on("maximize", function () {
      settings.setValue("maximize", true);
      reader.onMaximize();
      if (tools.getCurrentToolName() !== "reader")
        tools.getCurrentTool()?.onMaximize();
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

  //////////////////////////////////////////////////////////////////////////////
  // IPC SEND //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

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
  exports.sendIpcToCoreRenderer = sendIpcToCoreRenderer;

  //////////////////////////////////////////////////////////////////////////////
  // IPC RECEIVE ///////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  ipcMain.on("main", (event, args) => {
    tools.getTools()[args[0]]?.onIpcFromRenderer(...args.slice(1));
  });

  ipcMain.handle("main", async (event, args) => {
    tools.getTools()[args[0]]?.handleIpcFromRenderer(...args.slice(1));
  });

  ipcMain.on("tools-worker", (event, ...args) => {
    tools.getTools()[args[0]]?.onIpcFromToolsWorkerRenderer(...args.slice(1));
  });

  ipcMain.on("tools-bg-window", (event, ...args) => {
    tools.getTools()[args[0]]?.onIpcFromBgWindow(...args.slice(1));
  });

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

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
    if (tools.getCurrentToolName() !== "reader") {
      tools.getCurrentTool()?.onToggleFullScreen(newState);
    }
    settings.setValue("fullScreen", newState);
  }
  exports.toggleFullScreen = toggleFullScreen;

  function onLanguageChanged() {
    const direction = i18n.getLoadedLocaleData()["@metadata"]["direction"];
    if (direction !== "rtl") {
      direction === "ltr";
    }
    reader.setLanguageDirection(direction);
    sendIpcToCoreRenderer("update-language-direction", direction);

    const locale = i18n.getLoadedLocaleData()["@metadata"]["locale"];
    sendIpcToCoreRenderer("update-language-locale", locale);
  }
  exports.onLanguageChanged = onLanguageChanged;

  //////////////////////////////////////////////////////////////////////////////
  // MENU MSGS /////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  exports.onMenuPreferences = function () {
    tools.switchTool("tool-preferences");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuOpenHistoryManager = function () {
    tools.switchTool("tool-history");
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
    tools.switchTool("tool-convert-comics", { mode: 0 });
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolCreateComic = function () {
    tools.switchTool("tool-convert-comics", { mode: 1 });
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolCreateQR = function () {
    tools.switchTool("tool-create-qr");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolConvertImages = function () {
    tools.switchTool("tool-convert-imgs");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolExtractText = function () {
    tools.switchTool("tool-extract-text");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolExtractQR = function () {
    tools.switchTool("tool-extract-qr");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolExtractPalette = function () {
    tools.switchTool("tool-extract-palette");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolExtractComics = function () {
    tools.switchTool("tool-extract-comics");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolDCM = function () {
    tools.switchTool("tool-dcm");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolCBP = function () {
    tools.switchTool("tool-cbp");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolIArchive = function () {
    tools.switchTool("tool-internet-archive");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolGutenberg = function () {
    tools.switchTool("tool-gutenberg");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolXkcd = function () {
    tools.switchTool("tool-xkcd");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolLibrivox = function () {
    tools.switchTool("tool-librivox");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolWiktionary = function () {
    tools.switchTool("tool-wiktionary");
    sendIpcToPreload("update-menubar");
  };

  exports.onMenuToolRadio = function () {
    tools.switchTool("tool-radio");
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
} // end of instance check if
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: (2024/05/28) I'm using v29.1.1 of electron as showOpenDialogSync was
// ignoring defaultPath parameter in 29.1.4, 30.0.6, 30.0.8 AND 31.0.0 on Linux,
// always opening in the Home folder (haven't tested Windows).
// TODO: try newer versions & investigate further.

// NOTE: (2023/08/02) I'm using v3.x of the tesseract.js module as v4.x
// was giving errors.
// TODO: try newer versions & investigate further.

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
