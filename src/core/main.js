/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

//////////////////////////////////////////////////////////////////////////////
// SETUP /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

require("../shared/main/env-utils").setSafeEnvironment("[CORE] ");
require("../shared/main/env-utils").setGlobalErrorHandlers();

const timers = require("../shared/main/timers");
timers.start("startup");

const { app, ipcMain } = require("electron");
const os = require("node:os");
const fs = require("node:fs");

const settings = require("../shared/main/settings");
const log = require("../shared/main/logger");
const tools = require("../shared/main/tools");
const reader = require("../reader/main");
const appUtils = require("../shared/main/app-utils");
const binUtils = require("../shared/main/bin-utils");

let g_mainWindow;
let g_launchInfo = {};

// app.commandLine.appendSwitch("js-flags", "--expose-gc");
// process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
// // 0 = INFO
// // 1 = WARNING
// // 2 = ERROR
// // 3 = FATAL
// // 4 = NUM_SEVERITIES
// app.commandLine.appendSwitch("log-level", "3");
// app.commandLine.appendSwitch("silent-debugger-extension-api");
// if (app.isPackaged) {
// }

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
if (g_launchInfo.platform === "linux" && process.env.container) {
  // process.env.container is set by flatpak
  g_launchInfo.isFlatpak = true;
}

// parse command line arguments
// ref: https://nodejs.org/api/util.html#utilparseargsconfig
const { parseArgs } = require("node:util");
g_launchInfo.defaultParsingOptions = {
  dev: { type: "boolean" },
  cli: { type: "boolean" },
  player: { type: "boolean" }, //, short: "p" },
  transparent: { type: "string" },
  tool: { type: "string" },
  help: { type: "boolean" },
};
const options = {
  "output-format": { type: "string" },
  "output-folder": { type: "string" },
  ...g_launchInfo.defaultParsingOptions,
};
const { values, positionals } = parseArgs({
  args: process.argv.slice(g_launchInfo.isRelease ? 1 : 2),
  options,
  strict: false,
  allowPositionals: true,
});
g_launchInfo.parsedArgs = {
  ...values,
  _: positionals,
};

g_launchInfo.isDev = g_launchInfo.parsedArgs["dev"] === true;
g_launchInfo.isPlayerMode = g_launchInfo.parsedArgs["player"] === true;

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
  return;
}

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
log.debug("dev mode: " + g_launchInfo.isDev);
log.debug("release version: " + g_launchInfo.isRelease);
log.debug("electron version: " + process.versions.electron);
log.debug("chrome version: " + process.versions.chrome);
log.debug("node version: " + process.versions.node);
log.editor("acbr env: " + process.env.acbrenv);
if (g_launchInfo.isAppImage) {
  log.debug("is AppImage");
}
if (g_launchInfo.isFlatpak) {
  log.debug("is Flatpak");
}
// load settings
settings.init();
// check g_slice
log.debug("checking environment");
// ensure defaultPath works when opening dialogs on linux
if (g_launchInfo.platform === "linux") {
  // ref: https://www.electronjs.org/docs/latest/api/dialog
  app.commandLine.appendSwitch("xdg-portal-required-version", "4");
  // force x11 for now as wayland support in electron < 41 has issues
  // users can still use the --ozone-platform=wayland to override it
  app.commandLine.appendSwitch("ozone-platform", "x11");
}
// show vips warnings from sharp only in dev mode
if (!g_launchInfo.isDev) process.env.VIPS_WARNING = 1;

let windowManager;
if (g_launchInfo.parsedArgs["cli"] === true) {
  windowManager = require("./main/core-cli");
} else {
  log.info("starting ACBR");
  windowManager = require("./main/core-gui");
}

// init window
app.whenReady().then(() => {
  // security checks
  // if (g_launchInfo.isDev && !g_launchInfo.isRelease) {
  //   binUtils.printAllBinHashes();
  // }
  const checkResult = binUtils.checkBinHashes(g_launchInfo);
  if (!checkResult.passed) {
    // TODO: stop with dialog instead of just warning?
    // const { dialog } = require("electron");
    // dialog.showErrorBox("Security Error", checkResult.errorInfo + "\nThe app will now close");
    // app.quit();
    // return;
    log.warning(checkResult.errorInfo);
  }
  // create window
  g_mainWindow = windowManager.createWindow(this, g_launchInfo);
  if (g_mainWindow) {
    // macos
    // app.on("activate", () => {
    //   if (BrowserWindow.getAllWindows().length === 0) g_mainWindow = acbrGui.createWindow(this, g_launchInfo);
    // });

    // header fixes for the video player's youtube support
    // avoids errors 153 and 152-4
    // ref: https://www.electronjs.org/docs/latest/api/web-request
    const originalUA = g_mainWindow.webContents.getUserAgent();
    g_mainWindow.webContents.setUserAgent(
      originalUA.replace(/Electron\/[0-9\.]+\s/g, ""),
    );
    const { session } = require("electron");
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ["<all_urls>"] },
      (details, callback) => {
        if (
          details.url.includes("youtube") ||
          details.url.includes("googlevideo")
        ) {
          details.requestHeaders["Referer"] =
            "https://www.youtube-nocookie.com";
          details.requestHeaders["Origin"] = "https://www.youtube-nocookie.com";
          delete details.requestHeaders["Sec-Fetch-Site"];
          delete details.requestHeaders["Sec-Fetch-Mode"];
          delete details.requestHeaders["Sec-Fetch-Dest"];
        }
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      },
    );

    // NOTE: potential fix for youtube playing in the media player.
    // it wasn't needed in the end but I'm keeping it for now for reference.
    // session.defaultSession.webRequest.onHeadersReceived(
    //   { urls: ["https://www.youtube-nocookie.com*"] },
    //   (details, callback) => {
    //     details.responseHeaders["Access-Control-Allow-Origin"] = ["*"];
    //     delete details.responseHeaders["X-Frame-Options"];
    //     delete details.responseHeaders["Content-Security-Policy"];
    //     callback({ cancel: false, responseHeaders: details.responseHeaders });
    //   },
    // );

    // NOTE: potential fix for old radio streams that don't send headers to
    // inject CORS headers to prevent chromium from muting cross-origin media
    // when connected to the spectrum visualizer.
    // session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    //   if (details.resourceType === "media") {
    //     const responseHeaders = { ...details.responseHeaders };
    //     responseHeaders["access-control-allow-origin"] = ["*"];
    //     responseHeaders["access-control-expose-headers"] = ["*"];
    //     return callback({ responseHeaders });
    //   }
    //   callback({ responseHeaders: details.responseHeaders });
    // });
  }
});

app.on("will-quit", () => {
  windowManager.cleanUpOnQuit();
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
// HELPERS ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.restartApp = function () {
  windowManager.cleanUpOnQuit();
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
};

exports.getLaunchOptions = function () {
  return g_launchInfo;
};

exports.isDev = function () {
  return g_launchInfo.isDev;
};

exports.isRelease = function () {
  return g_launchInfo.isRelease;
};

exports.getMainWindow = function () {
  return g_mainWindow;
};

exports.startToolsQuit = function () {
  log.editor("startToolsQuit");
  g_launchInfo.quittingPhase = 2;
  g_mainWindow.close();
};

exports.requestQuit = function () {
  log.editor("requestQuit");
  app.quit();
};

exports.forceQuit = function () {
  log.editor("forceQuit");
  g_launchInfo.quittingPhase = 4;
  g_mainWindow.close();
};

exports.resetQuit = function () {
  log.editor("resetQuit");
  g_launchInfo.quittingPhase = 0;
};

exports.isToolOpen = function () {
  return tools.getCurrentToolName() !== "reader";
};

exports.getCurrentToolLocalizedName = function () {
  return tools.getCurrentToolLocalizedName();
};

//////////////////////////////////////////////////////////////////////////////
// IPC SEND //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  if (g_mainWindow && !g_mainWindow.isDestroyed()) {
    g_mainWindow?.webContents?.send("renderer", args);
  }
}
exports.sendIpcToRenderer = sendIpcToRenderer;

function sendIpcToPreload(...args) {
  if (g_mainWindow && !g_mainWindow.isDestroyed()) {
    g_mainWindow?.webContents?.send("preload", args);
  }
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
  if (args[0] === "menu-accelerator-pressed") {
    windowManager.onIpcMenuAcceleratorPressed(args[1]);
  } else if (args[0] === "resize-player-mode") {
    if (g_launchInfo.isPlayerMode && g_mainWindow) {
      if (args[3]) {
        if (!g_mainWindow.isFullScreen()) {
          tools.getTools()["media-player"].updateLastPosition();
          g_mainWindow.setResizable(true);
          g_mainWindow.setFullScreen(true);
        }
      } else {
        if (g_mainWindow.isFullScreen()) {
          g_mainWindow.setFullScreen(false);
        }
        g_mainWindow.setMinimumSize(args[1], args[2]);
        let extra = { x: 0, y: 0 };
        if (g_launchInfo.transparentWindow) extra = { x: 20, y: 20 };
        g_mainWindow.setSize(args[1] + extra.x, args[2] + extra.y);
      }
    }
  } else if (args[0] === "open-path-in-browser") {
    appUtils.openPathInFileBrowser(args[1]);
  } else {
    tools.getTools()[args[0]]?.onIpcFromRenderer(...args.slice(1));
  }
});

ipcMain.handle("main", async (event, ...args) => {
  return tools.getTools()[args[0]]?.handleIpcFromRenderer(...args.slice(1));
});

ipcMain.on("tools-worker", (event, ...args) => {
  tools.getTools()[args[0]]?.onIpcFromToolsWorkerRenderer(...args.slice(1));
});

ipcMain.on("tools-bg-window", (event, ...args) => {
  tools.getTools()[args[0]]?.onIpcFromBgWindow(...args.slice(1));
});

///////////////////////////////////////////////////////////////////////////////
// EXPORTS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const {
  createWindow,
  onIpcMenuAcceleratorPressed,
  cleanUpOnQuit,
  ...publicExports
} = windowManager;
Object.assign(module.exports, publicExports);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: (2026/06/19) I'm using v39.8.8 of electron as tested v41.2.1 and
// - broke the youtube player due to changes in header security and I
//   wasn't able to fix it for now.
// - dialogs ignore defaultPath.
// Also, I'm forcing x11 as wayland support had problems before 41+ from what
// I read (can't test it right now as my dev system is x11) and I want to set
// the flatpak args to support wayland so it doesn't have a warning on Flathub.
// Would like to update to 41+ when dialogs are fixed even if that means
// losing youtube url playback, to among other things get good wayland support.
// TODO: Keep trying to find solutions / learn more / test newer versions.

// NOTE: (2026/05/25) Only use sharp inside a utility process to avoid crashes
// due to glib conflicts

// NOTE: (2023/08/02) I'm using v3.x of the tesseract.js module as v4.x
// was giving errors.
// TODO: Try newer versions & investigate further.

// NOTE: Command to test the memory cage when running the dev script 'npm run
// start:safe':
// systemctl show --user --property=MemoryMax,MemorySwapMax run-*.scope

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
