/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

//////////////////////////////////////////////////////////////////////////////
// SETUP /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

const { app, BrowserWindow, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const settings = require("../../shared/main/settings");
const history = require("../../shared/main/history");
const i18n = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const themes = require("../../shared/main/themes");
const menuBar = require("../../shared/main/menu-bar");
const appUtils = require("../../shared/main/app-utils");
const forkUtils = require("../../shared/main/fork-utils");
const temp = require("../../shared/main/temp");
const tools = require("../../shared/main/tools");
const { _ } = require("../../shared/main/i18n");
const reader = require("../../reader/main");
const systemMonitor = require("../../tools/system-monitor/main");
const timers = require("../../shared/main/timers");

let g_mainWindow;
let g_launchInfo;
let g_isLoaded = false;
let g_updatesWorker;
let core, sendIpcToCoreRenderer, sendIpcToPreload;

//////////////////////////////////////////////////////////////////////////////
// WINDOW ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.createWindow = function (_core, launchInfo) {
  core = _core;
  sendIpcToCoreRenderer = core.sendIpcToCoreRenderer;
  sendIpcToPreload = core.sendIpcToPreload;

  g_launchInfo = launchInfo;
  g_launchInfo.quittingPhase = 0;
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
  settings.capScreenSizes(g_launchInfo.screenWidth, g_launchInfo.screenHeight);
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
    icon: path.join(__dirname, "../../assets/images/icon_256x256.png"),
    show: false,
    webPreferences: {
      sandbox: false, // needed for the custom-title-bar to work
      preload: path.join(__dirname, "../preload.js"),
    },
  });
  g_mainWindow.loadFile(path.join(__dirname, "../index.html"));
  // win events
  g_mainWindow.webContents.on("did-finish-load", async function () {
    g_isLoaded = true;
    let tempFolderPath = settings.getValue("tempFolderPath");
    if (!tempFolderPath) {
      log.error("Temp folder path is undefined");
    }
    if (!path.isAbsolute(tempFolderPath)) {
      tempFolderPath = path.resolve(
        appUtils.getExeFolderPath(),
        tempFolderPath,
      );
    }
    temp.init(tempFolderPath);
    appUtils.generateExternalFilesFolder();
    tools.init();
    history.init(settings.getValue("history_capacity"));
    i18n.init(g_launchInfo.isDev);
    themes.init();
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    menuBar.init(g_mainWindow);
    // add extra divs after menuBar init, so its container is already created
    sendIpcToCoreRenderer("append-structure-divs");
    onLanguageChanged();
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
      await reader.init(undefined, false);
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
      await reader.init(undefined, false);
      // start tool
      tools.switchTool("tool-convert-comics", {
        mode: 0,
        inputFilePaths: inputFilePaths,
      });
    } else {
      // start reader, open file if available
      await reader.init(
        inputFileAndFolderPaths.length > 0
          ? inputFileAndFolderPaths[0]
          : undefined,
        true,
      );
    }
    systemMonitor.init(g_mainWindow, "system-monitor-container");
    showSystemMonitor(settings.getValue("showSystemMonitor"));
    startUpCheckForUpdates();
    // show window
    g_mainWindow.center();
    const forceMultimonitorSize = settings.getValue(
      "experimentalForceMultimonitorSize",
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
    log.debug(`start-up time: ${timers.stop("startup").toFixed(2)}s`);
  });

  g_mainWindow.on("resize", function () {
    if (g_isLoaded && g_mainWindow.isNormal()) {
      let width = g_mainWindow.getSize()[0];
      let height = g_mainWindow.getSize()[1];
      settings.setValue("width", width);
      settings.setValue("height", height);
    }
    renderTitle();
    reader.onResize();
    if (tools.getCurrentToolName() !== "reader") {
      tools.getCurrentTool().onResize?.();
    }
  });

  g_mainWindow.on("maximize", function () {
    settings.setValue("maximize", true);
    reader.onMaximize();
    if (tools.getCurrentToolName() !== "reader")
      tools.getCurrentTool().onMaximize?.();
  });

  g_mainWindow.on("unmaximize", function () {
    settings.setValue("maximize", false);
  });

  // don't allow opening windows from the renderer
  g_mainWindow.webContents.setWindowOpenHandler(() => {
    // ref: https://www.electronjs.org/docs/latest/api/window-open
    return { action: "deny" };
  });

  // let tools save renderer data before closing
  // UGLY 'HACK' but using beforeunload in the renderer was unreliable
  g_mainWindow.on("close", function (event) {
    try {
      // log.test("g_launchInfo.quittingPhase: " + g_launchInfo.quittingPhase);
      if (g_launchInfo.quittingPhase === 0) {
        event.preventDefault();
        g_launchInfo.quittingPhase = 1;
        tools.getTools()["media-player"].saveAndQuit();
      } else if (g_launchInfo.quittingPhase === 1) {
        event.preventDefault();
        // waiting for media player data
      } else if (
        tools.getCurrentToolName() !== "reader" &&
        tools.getCurrentTool()?.saveAndQuit
      ) {
        if (g_launchInfo.quittingPhase < 4) {
          event.preventDefault();
          if (g_launchInfo.quittingPhase === 2) {
            tools.getCurrentTool().saveAndQuit?.();
            g_launchInfo.quittingPhase = 3;
          }
        }
      }
    } catch (error) {}
  });
  // g_mainWindow.on("close", function (event) {
  //   if (
  //     tools.getCurrentToolName() !== "reader" &&
  //     tools.getCurrentTool()?.saveAndQuit
  //   ) {
  //     if (g_launchInfo.quittingPhase !== 2) {
  //       event.preventDefault();
  //       if (g_launchInfo.quittingPhase === 0) {
  //         tools.getCurrentTool().saveAndQuit?.();
  //         g_launchInfo.quittingPhase = 1;
  //       }
  //     }
  //   }
  // });

  return g_mainWindow;
};

//////////////////////////////////////////////////////////////////////////////
// MENU MSGS /////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.onMenuPreferences = function (...args) {
  tools.switchTool("tool-preferences", ...args);
  sendIpcToPreload("update-menubar");
};

function onMenuOpenHistoryManager() {
  tools.switchTool("tool-history");
  sendIpcToPreload("update-menubar");
}
exports.onMenuOpenHistoryManager = onMenuOpenHistoryManager;

function onMenuQuit() {
  // app.quit();
  g_mainWindow.close();
}
exports.onMenuQuit = onMenuQuit;

exports.onMenuCloseTool = function () {
  if (
    tools.getCurrentToolName() !== "reader" &&
    tools.getCurrentTool()?.saveAndClose
  ) {
    tools.getCurrentTool().saveAndClose();
  } else {
    tools.switchTool("reader");
    sendIpcToPreload("update-menubar");
  }
};

/////////////

function onMenuToggleMediaPlayer() {
  reader.showMediaPlayer(!settings.getValue("showAudioPlayer"));
  sendIpcToPreload("update-menubar");
}
exports.onMenuToggleMediaPlayer = onMenuToggleMediaPlayer;

function onMenuToggleSystemMonitor() {
  showSystemMonitor(!settings.getValue("showSystemMonitor"));
  sendIpcToPreload("update-menubar");
}
exports.onMenuToggleSystemMonitor = onMenuToggleSystemMonitor;

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

exports.onMenuToolFileBrowser = function () {
  tools.switchTool("tool-file-browser", reader.getFileData());
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolRssReader = function (options) {
  tools.switchTool("tool-rss", options);
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolExtractComics = function () {
  tools.switchTool("tool-convert-comics", { mode: 2 });
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

exports.onMenuToolRadio = function (section) {
  tools.switchTool("tool-radio", section);
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolTemplateMaker = function () {
  tools.switchTool("tool-template-maker");
  sendIpcToPreload("update-menubar");
};

exports.onMenuToolDrawingStudio = function () {
  tools.switchTool("tool-drawing");
  sendIpcToPreload("update-menubar");
};

//////////////////

exports.onMenuToggleDevTools = function () {
  toggleDevTools();
};

exports.onMenuAbout = function () {
  const licensesPath = app.isPackaged
    ? path.join(process.resourcesPath, "licenses")
    : path.join(__dirname, "../../../licenses");
  log.debug(licensesPath);
  sendIpcToCoreRenderer(
    "show-modal-about",
    "ACBR Comic Book Reader",
    `<div id="about-modal-div">${i18n._(
      "ui-modal-info-version",
    )}: <span id="about-modal-version">${app.getVersion()}</span>\n© Álvaro García\n<span id="about-modal-link" title="${i18n._(
      "tool-shared-ui-search-item-open-browser",
    )}">www.binarynonsense.com</span>
      </div>`,
    i18n._("ui-modal-prompt-button-ok"),
    i18n._("ui-modal-info-licenses"),
    licensesPath,
  );
};

exports.onMenuCheckUpdates = function () {
  let texts = {
    titleUpToDate: i18n._("ui-modal-title-versionuptodate"),
    titleUpdateAvailable: i18n._("ui-modal-title-versionavailable"),
    titleSearching: i18n._("tool-shared-modal-title-searching"),
    titleError: i18n._("tool-shared-modal-title-error"),
    infoUpToDate: i18n._("ui-modal-info-updateavailable-no"),
    infoUpdateAvailable: i18n._("ui-modal-info-updateavailable-yes"),
    infoCurrentVersion: i18n._("ui-modal-info-currentversion"),
    infoLatestVersion: i18n._("ui-modal-info-lateststableversion"),
    infoNetworkError: i18n._("tool-shared-ui-search-network-error"),
    buttonOpen: i18n._("ui-modal-prompt-button-open"),
    buttonClose: i18n._("tool-shared-ui-close"),
  };
  sendIpcToCoreRenderer("show-modal-checkversion", app.getVersion(), texts);
};

//////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ///////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.onIpcMenuAcceleratorPressed = function (id) {
  switch (id) {
    case "fullscreen":
      toggleFullScreen();
      break;
    case "quit":
      onMenuQuit();
      break;
    case "media-player":
      onMenuToggleMediaPlayer();
      break;
    case "history":
      onMenuOpenHistoryManager();
      break;
    case "open-file":
      reader.onMenuOpenFile();
      break;
    case "scrollbar":
      reader.onMenuToggleScrollBar();
      break;
    case "toolbar":
      reader.onMenuToggleToolBar();
      break;
    case "pagenum":
      reader.onMenuTogglePageNumber();
      break;
    case "clock":
      reader.onMenuToggleClock();
      break;
    case "battery":
      reader.onMenuToggleBattery();
      break;
  }
};

//////////////////////////////////////////////////////////////////////////////
// HELPERS ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function cleanUpOnQuit() {
  g_mainWindow = undefined;
  systemMonitor.quit();
  if (g_updatesWorker !== undefined) {
    g_updatesWorker.kill();
    g_updatesWorker = undefined;
  }
  if (tools.getCurrentToolName() !== "reader")
    tools.getCurrentTool().onQuit?.();
  reader.onQuit();
  settings.save();
  history.save();
  if (settings.getValue("logToFile"))
    log.saveLogFile(
      path.join(appUtils.getConfigFolder(), "acbr.log"),
      path.join(appUtils.getConfigFolder(), "acbr-prev.log"),
      appUtils.getAppVersion(),
    );
  // clean up
  log.info("cleaning up...");
  temp.cleanUp();
  appUtils.cleanUpUserDataFolder();
}
exports.cleanUpOnQuit = cleanUpOnQuit;

function toggleDevTools() {
  g_mainWindow.toggleDevTools();
}
exports.toggleDevTools = toggleDevTools;

function toggleFullScreen() {
  const newState = !g_mainWindow.isFullScreen();
  reader.setFullScreen(newState);
  if (tools.getCurrentToolName() !== "reader") {
    tools.getCurrentTool().onToggleFullScreen?.(newState);
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

  sendIpcToPreload(
    "update-window-buttons",
    {
      minimize: i18n._("menubar-buttons-minimize"),
      maximize: i18n._("menubar-buttons-maximize"),
      restoreDown: i18n._("menubar-buttons-restoredown"),
      close: i18n._("menubar-buttons-close"),
    },
    g_mainWindow.isMaximized(),
  );

  sendIpcToPreload("update-tools-common", {
    scrollToTop: i18n._("tool-shared-tooltip-scrolltotop"),
  });
}
exports.onLanguageChanged = onLanguageChanged;

function renderTitle() {
  let title = "ACBR";
  if (tools.getCurrentToolName() === "reader") {
    title = reader.generateTitle();
  } else {
  }
  g_mainWindow.setTitle(title);
  sendIpcToPreload("update-title", title);
}
exports.renderTitle = renderTitle;

function startUpCheckForUpdates() {
  try {
    let doCheck = false;
    if (settings.getValue("checkUpdatesOnStart") > 0) {
      if (settings.getValue("checkUpdatesOnStart") === 1) {
        doCheck = true;
      } else {
        const lastDate = new Date(settings.getValue("checkUpdatesLastDate"));
        const daysPassed = Math.floor(
          Math.abs(new Date() - lastDate) / (1000 * 60 * 60 * 24),
        );
        log.debug("days since last update check: " + daysPassed);
        if (settings.getValue("checkUpdatesOnStart") === 2) {
          if (daysPassed >= 1) doCheck = true;
        } else if (settings.getValue("checkUpdatesOnStart") === 3) {
          if (daysPassed >= 7) doCheck = true;
        } else if (settings.getValue("checkUpdatesOnStart") === 4) {
          if (daysPassed >= 30) doCheck = true;
        }
      }
    }

    if (doCheck) {
      log.debug("checking for updates");
      if (g_updatesWorker === undefined) {
        g_updatesWorker = forkUtils.fork(
          path.join(__dirname, "worker-updates.js"),
        );
        g_updatesWorker.on("message", (message) => {
          const newVersion = message[1];
          g_updatesWorker.kill(); // kill it after one use
          if (message[0] === true) {
            log.debug("update available: " + newVersion);
            if (
              settings.getValue("checkUpdatesNotify") === 0 ||
              newVersion !== settings.getValue("checkUpdatesLastVersionFound")
            ) {
              sendIpcToCoreRenderer(
                "show-toast-update-available",
                _("ui-modal-title-versionavailable"),
              );
            }
            settings.setValue("checkUpdatesLastDate", new Date().toJSON());
            return;
          } else {
            if (newVersion) {
              log.debug("no update available");
              settings.setValue("checkUpdatesLastDate", new Date().toJSON());
              settings.setValue("checkUpdatesLastVersionFound", newVersion);
            } else {
              log.debug("couldn't retrieve the updates info");
            }
            return;
          }
        });
      }
      // send to worker
      g_updatesWorker.postMessage([g_launchInfo, app.getVersion()]);
    }
  } catch (error) {
    log.editorError(error);
  }
}

function showSystemMonitor(isVisible, updateMenuBar) {
  settings.setValue("showSystemMonitor", isVisible);
  systemMonitor.open(isVisible);
  menuBar.setSystemMonitor(isVisible);
  if (updateMenuBar) sendIpcToPreload("update-menubar");
}
exports.showSystemMonitor = showSystemMonitor;

function showToast(text, duration) {
  sendIpcToCoreRenderer("show-toast", text, duration);
}
exports.showToast = showToast;
