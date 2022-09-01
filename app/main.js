const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const FileType = require("file-type");
const fileUtils = require("./file-utils");
const fileFormats = require("./file-formats");
const i18n = require("./i18n");
const menuBar = require("./menu-bar");
const contextMenu = require("./menu-context");
const themes = require("./themes");
const {
  FileExtension,
  FileDataState,
  FileDataType,
  BookType,
} = require("./constants");
const audioPlayer = require("./audio-player/main");

const {
  setupTitlebar,
  attachTitlebarToWindow,
} = require("custom-electron-titlebar/main");

setupTitlebar();

function isDev() {
  return process.argv[2] == "--dev";
}
exports.isDev = isDev;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_mainWindow;
let g_resizeEventCounter;
let g_isLoaded = false;

let g_workerExport;
let g_workerPage;

let g_history = [];
let g_settings = {
  version: app.getVersion(),
  date: "",
  fit_mode: 0, // 0: width, 1: height, 2: scale height
  zoom_scale: 100,
  page_mode: 0, // 0: single-page, 1: double-page
  hotspots_mode: 1, // 0: disabled, 1: 2-columns, 2: 3-columns
  maximize: false,
  width: 800,
  height: 600,
  history_capacity: 30,
  on_quit_state: 0, // 0: no file, 1: reading file

  showMenuBar: true,
  showToolBar: true,
  showScrollBar: true,
  showPageNumber: true,
  showClock: false,
  showAudioPlayer: false,

  loadLastOpened: true,
  autoOpen: 0, // 0: disabled, 1: next file, 2: next and previous files
  cursorVisibility: 0, // 0: always visible, 1: hide when inactive
  zoomDefault: 2, // 0: width, 1: height, 2: last used
  zoomFileLoading: 0, // 0: use default, 1: use history
  loadingIndicatorBG: 1, // 0: transparent, 1: slightly opaque
  loadingIndicatorIconSize: 0, // 0: small, 1: big
  loadingIndicatorIconPos: 0, // 0: top left, 1: center
  layoutClock: 2, // 0 top left, 1 top center, 2 top right .... 5 bottom right
  layoutPageNum: 4, // 0 top left, 1 top center, 2 top right .... 5 bottom right
  layoutAudioPlayer: 0, // 0 top left, 3 bootom left - for now
  epubOpenAs: 0, // 0 ask and remember, 1 always ask

  locale: undefined,
  theme: undefined,

  // TOOLS

  toolGutUseCache: true,
};

function sanitizeSettings() {
  if (
    !Number.isInteger(g_settings.fit_mode) ||
    g_settings.fit_mode < 0 ||
    g_settings.fit_mode > 2
  ) {
    g_settings.fit_mode = 0;
  }
  if (
    !Number.isInteger(g_settings.zoom_scale) ||
    g_settings.zoom_scale < g_scaleToHeightMin ||
    g_settings.zoom_scale > g_scaleToHeightMax
  ) {
    g_settings.zoom_scale = 100;
  }
  if (
    !Number.isInteger(g_settings.page_mode) ||
    g_settings.page_mode < 0 ||
    g_settings.page_mode > 1
  ) {
    g_settings.page_mode = 0;
  }
  if (
    !Number.isInteger(g_settings.hotspots_mode) ||
    g_settings.hotspots_mode < 0 ||
    g_settings.hotspots_mode > 2
  ) {
    g_settings.hotspots_mode = 1;
  }
  if (
    !Number.isInteger(g_settings.epubOpenAs) ||
    g_settings.epubOpenAs < 0 ||
    g_settings.epubOpenAs > 1
  ) {
    g_settings.epubOpenAs = 0;
  }
  if (typeof g_settings.maximize !== "boolean") {
    g_settings.maximize = false;
  }
  if (
    !Number.isInteger(g_settings.width) ||
    !Number.isInteger(g_settings.height)
  ) {
    g_settings.width = 800;
    g_settings.height = 600;
  }
  if (
    !Number.isInteger(g_settings.history_capacity) ||
    g_settings.history_capacity < 10 ||
    g_settings.history_capacity > 100
  ) {
    g_settings.history_capacity = 30;
  }
  if (
    !Number.isInteger(g_settings.on_quit_state) ||
    g_settings.on_quit_state < 0 ||
    g_settings.on_quit_state > 1
  ) {
    g_settings.on_quit_state = 0;
  }

  if (typeof g_settings.showMenuBar !== "boolean") {
    g_settings.showMenuBar = true;
  }
  if (typeof g_settings.showToolBar !== "boolean") {
    g_settings.showToolBar = true;
  }
  if (typeof g_settings.showPageNumber !== "boolean") {
    g_settings.showPageNumber = true;
  }
  if (typeof g_settings.showClock !== "boolean") {
    g_settings.showClock = false;
  }
  if (typeof g_settings.showScrollBar !== "boolean") {
    g_settings.showScrollBar = true;
  }
  if (typeof g_settings.showAudioPlayer !== "boolean") {
    g_settings.showAudioPlayer = false;
  }
  if (typeof g_settings.loadLastOpened !== "boolean") {
    g_settings.loadLastOpened = true;
  }
  if (
    !Number.isInteger(g_settings.autoOpen) ||
    g_settings.autoOpen < 0 ||
    g_settings.autoOpen > 2
  ) {
    g_settings.autoOpen = 0;
  }
  if (
    !Number.isInteger(g_settings.cursorVisibility) ||
    g_settings.cursorVisibility < 0 ||
    g_settings.cursorVisibility > 1
  ) {
    g_settings.cursorVisibility = 0;
  }
  if (
    !Number.isInteger(g_settings.zoomDefault) ||
    g_settings.zoomDefault < 0 ||
    g_settings.zoomDefault > 2
  ) {
    g_settings.zoomDefault = 2;
  }
  if (
    !Number.isInteger(g_settings.zoomFileLoading) ||
    g_settings.zoomFileLoading < 0 ||
    g_settings.zoomFileLoading > 1
  ) {
    g_settings.zoomFileLoading = 0;
  }
  // loading indicator
  if (
    !Number.isInteger(g_settings.loadingIndicatorBG) ||
    g_settings.loadingIndicatorBG < 0 ||
    g_settings.loadingIndicatorBG > 1
  ) {
    g_settings.loadingIndicatorBG = 1;
  }
  if (
    !Number.isInteger(g_settings.loadingIndicatorIconSize) ||
    g_settings.loadingIndicatorIconSize < 0 ||
    g_settings.loadingIndicatorIconSize > 1
  ) {
    g_settings.loadingIndicatorIconSize = 0;
  }
  if (
    !Number.isInteger(g_settings.loadingIndicatorIconPos) ||
    g_settings.loadingIndicatorIconPos < 0 ||
    g_settings.loadingIndicatorIconPos > 1
  ) {
    g_settings.loadingIndicatorIconPos = 0;
  }
  if (
    !Number.isInteger(g_settings.layoutClock) ||
    g_settings.layoutClock < 0 ||
    g_settings.layoutClock > 5
  ) {
    g_settings.layoutClock = 2;
  }
  if (
    !Number.isInteger(g_settings.layoutPageNum) ||
    g_settings.layoutPageNum < 0 ||
    g_settings.layoutPageNum > 5
  ) {
    g_settings.layoutPageNum = 2;
  }
  if (
    !Number.isInteger(g_settings.layoutAudioPlayer) ||
    (g_settings.layoutAudioPlayer != 0 && g_settings.layoutAudioPlayer != 3)
  ) {
    g_settings.layoutAudioPlayer = 0;
  }

  /////////////////////
  if (typeof g_settings.locale === "string") {
    g_settings.locale = g_settings.locale
      .replace(/[^a-z0-9_\-]/gi, "_")
      .toLowerCase();
  } else {
    g_settings.locale = undefined;
  }
  if (typeof g_settings.theme === "string") {
    g_settings.theme = g_settings.theme
      .replace(/[^a-z0-9_\-]/gi, "_")
      .toLowerCase();
  } else {
    g_settings.theme = undefined;
  }
  // TOOLS ///////////
  if (typeof g_settings.toolGutUseCache !== "boolean") {
    g_settings.toolGutUseCache = true;
  }
}

exports.getSettingsProperty = function (name) {
  return g_settings[name];
};

exports.setSettingsProperty = function (name, value) {
  g_settings[name] = value;
};

///////////////////////////////////////////////////////////////////////////////
// APP ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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

app.on("will-quit", () => {
  clearTimeout(g_clockTimeout);
  g_settings.on_quit_state = g_fileData.path === "" ? 0 : 1;
  saveSettings();
  saveHistory(false);
  globalShortcut.unregisterAll();
  fileUtils.cleanUpTempFolder();
  if (g_workerExport !== undefined) {
    g_workerExport.kill();
    g_workerExport = undefined;
  }
  if (g_workerPage !== undefined) {
    g_workerPage.kill();
    g_workerPage = undefined;
  }
});

app.on("ready", () => {
  g_mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    frame: false,
    icon: path.join(__dirname, "assets/images/icon_256x256.png"),
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false,
    },
    show: false,
  });

  menuBar.buildEmptyMenu();

  g_mainWindow.loadFile(`${__dirname}/index.html`);

  g_mainWindow.once("ready-to-show", () => {
    g_mainWindow.show();
  });

  g_mainWindow.webContents.on("did-finish-load", function () {
    g_isLoaded = true;

    g_settings = fileUtils.loadSettings(g_settings);
    sanitizeSettings();
    g_history = fileUtils.loadHistory(g_settings.history_capacity);

    i18n.setUserDataLocalesPath(path.join(app.getPath("userData"), "i18n/"));
    if (g_settings.locale === undefined) {
      g_settings.locale = i18n.loadLocale(app.getLocale());
    } else {
      g_settings.locale = i18n.loadLocale(g_settings.locale);
    }

    rebuildTranslatedTexts(false); // false to not create the menu bar yet

    g_settings.theme = themes.loadTheme(g_settings.theme);
    g_mainWindow.webContents.send("update-colors", themes.getLoadedThemeData());
    rebuildMenuBar();

    // if I put the things below inside ready-to-show they aren't called
    renderTitle();

    attachTitlebarToWindow(g_mainWindow);

    if (g_settings.fit_mode === 0) {
      setFitToWidth();
    } else if (g_settings.fit_mode === 1) {
      setFitToHeight();
    } else {
      setScaleToHeight(g_settings.zoom_scale);
    }

    updateLoadingIndicator();
    updateLayoutClock();
    updateLayoutPageNum();
    updateLayoutAudioPlayer();

    g_mainWindow.webContents.send(
      "set-hide-inactive-mouse-cursor",
      g_settings.cursorVisibility === 1
    );

    showScrollBar(g_settings.showScrollBar);
    showToolBar(g_settings.showToolBar);
    showPageNumber(g_settings.showPageNumber);
    initClock();
    showClock(g_settings.showClock);
    audioPlayer.init(g_mainWindow, "audio-player-container", _);
    showAudioPlayer(g_settings.showAudioPlayer);

    g_mainWindow.setSize(g_settings.width, g_settings.height);
    g_mainWindow.center();
    if (g_settings.maximize) {
      g_mainWindow.maximize();
    }

    // if program called from os' 'open with' of file association
    if (process.argv.length >= 2) {
      if (app.isPackaged) {
        let filePath = process.argv[1];
        if (tryOpen(filePath)) {
          return;
        }
      }
    }

    if (g_history.length > 0 && g_settings.on_quit_state === 1) {
      const entry = g_history[g_history.length - 1];
      tryOpen(entry.filePath, undefined, entry);
      return;
    }

    g_mainWindow.webContents.send("update-loading", false);
  });

  g_mainWindow.webContents.on("context-menu", function (e, params) {
    contextMenu
      .getContextMenu(g_fileData)
      .popup(g_mainWindow, params.x, params.y);
  });

  g_mainWindow.on("resize", function () {
    // if I don't use the isLoaded var the first mazimize @ start is recorded as normal resize !???
    if (g_isLoaded && g_mainWindow.isNormal()) {
      let width = g_mainWindow.getSize()[0];
      let height = g_mainWindow.getSize()[1];
      g_settings.width = width;
      g_settings.height = height;
    }
    renderTitle();
    if (g_fileData.state === FileDataState.LOADED) {
      // avoid too much pdf resizing
      clearTimeout(g_resizeEventCounter);
      g_resizeEventCounter = setTimeout(onResizeEventFinished, 500);
    }
  });

  g_mainWindow.on("maximize", function () {
    renderPageRefresh();
    g_settings.maximize = true;
  });

  g_mainWindow.on("unmaximize", function () {
    g_settings.maximize = false;
  });
});

function onResizeEventFinished() {
  renderPageRefresh();
}

// Security
// ref: https://www.electronjs.org/docs/tutorial/security
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    event.preventDefault();
  });
});

app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", async (event, navigationUrl) => {
    event.preventDefault();

    //const URL = require('url').URL
    // const parsedUrl = new URL(navigationUrl)
    // if (parsedUrl.origin !== 'https://example.com') {
    //   event.preventDefault()
    // }
  });
});

///////////////////////////////////////////////////////////////////////////////
// CLOCK //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
let g_clockTimeout;

function initClock() {
  let today = new Date();
  let h = today.getHours();
  let m = today.getMinutes();
  if (m < 10) {
    m = "0" + m;
  }
  let s = today.getSeconds();
  if (s < 10) {
    s = "0" + s;
  }
  let time = h + ":" + m; // + ":" + s;
  g_mainWindow.webContents.send("update-clock", time);
  g_clockTimeout = setTimeout(initClock, 500);
}

///////////////////////////////////////////////////////////////////////////////
// I18N ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function rebuildTranslatedTexts(rebuildMenu = true) {
  if (rebuildMenu) rebuildMenuBar();

  g_mainWindow.webContents.send(
    "update-toolbar-tooltips",
    _("ctxmenu-openfile"),
    _("ctxmenu-prevpage"),
    _("ctxmenu-nextpage"),
    _("menu-view-zoom-fitwidth"),
    _("menu-view-zoom-fitheight"),
    _("toolbar-rotate-counterclockwise"),
    _("toolbar-rotate-clockwise"),
    _("menu-view-togglefullscreen")
  );
  g_mainWindow.webContents.send("update-bg-text", _("ui-bg-msg"));
}

function _(...args) {
  return i18n._.apply(null, args);
}
exports.i18n_ = _;

///////////////////////////////////////////////////////////////////////////////
// SETTINGS / HISTORY /////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function saveSettings() {
  fileUtils.saveSettings(g_settings);
}

function addCurrentToHistory(updateMenu = true) {
  if (
    g_fileData.type === FileDataType.NOT_SET ||
    g_fileData.state !== FileDataState.LOADED
  )
    return;
  let currentFilePath = g_fileData.path;
  let currentPageIndex = g_fileData.pageIndex;
  if (currentFilePath !== "") {
    let foundIndex = getHistoryIndex(currentFilePath);
    if (foundIndex !== undefined) {
      // remove, to update and put last
      g_history.splice(foundIndex, 1);
    }
    let newEntry = {
      filePath: currentFilePath,
      pageIndex: currentPageIndex,
      fitMode: g_settings.fit_mode,
      zoomScale: g_settings.zoom_scale,
    };
    if (g_fileData.data) {
      newEntry.data = g_fileData.data;
      if (newEntry.data.tempData) delete newEntry.data.tempData;
    }
    g_history.push(newEntry);
    if (g_history.length > g_settings.history_capacity) {
      g_history.splice(0, g_history.length - g_settings.history_capacity);
    }
  }
  if (updateMenu) rebuildMenuBar();
}

function clearHistory() {
  g_history = [];
  rebuildMenuBar();
}

function getHistoryIndex(filePath) {
  if (!filePath) return undefined;
  let foundIndex;
  for (let index = 0; index < g_history.length; index++) {
    const element = g_history[index];
    if (element.filePath === filePath) {
      foundIndex = index;
      break;
    }
  }
  return foundIndex;
}

function saveHistory(updateMenu = true) {
  addCurrentToHistory(updateMenu);
  fileUtils.saveHistory(g_history, g_fileData.path, g_fileData.pageIndex);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVED ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

ipcMain.on("page-loaded", (event, data) => {
  g_fileData.state = FileDataState.LOADED;
  g_mainWindow.webContents.send("update-loading", false);
  if (data) {
    if (data.error) {
      // TODO: handle errors loading pages
    } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      if (data.percentage) {
        g_fileData.pageIndex = Number(data.percentage).toFixed(2);
      } else {
        // shouldn't happen?
      }
    }
  }
  renderPageInfo();
  renderTitle();
  if (g_fileData?.data?.source === "xkcd") {
    g_mainWindow.webContents.send(
      "update-title",
      `${g_fileData.data.name} #${g_fileData.pageIndex + 1}`
    );
    if (g_fileData.data?.tempData?.title)
      g_mainWindow.webContents.send(
        "update-img-page-title",
        g_fileData.data.tempData.title
      );
  }
});

ipcMain.on("password-entered", (event, password) => {
  if (
    g_fileData.type === FileDataType.PDF ||
    g_fileData.type === FileDataType.RAR ||
    g_fileData.type === FileDataType.ZIP ||
    g_fileData.type === FileDataType.SEVENZIP
  ) {
    let filePath = g_fileData.path;
    let pageIndex = g_fileData.pageIndex;
    openComicBookFromPath(filePath, pageIndex, password);
  }
});

ipcMain.on("password-canceled", (event) => {
  if (
    g_fileData.type === FileDataType.PDF ||
    g_fileData.type === FileDataType.RAR ||
    g_fileData.type === FileDataType.ZIP ||
    g_fileData.type === FileDataType.SEVENZIP
  ) {
    closeCurrentFile();
  }
});

ipcMain.on("booktype-entered", (event, filePath, bookType) => {
  tryOpen(filePath, bookType);
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("epub-comic-loaded", (event, filePath, pageIndex, imageIDs) => {
  g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
  g_fileData.type = FileDataType.EPUB_COMIC;
  g_fileData.path = filePath;
  g_fileData.name = path.basename(filePath);
  g_fileData.pagesPaths = imageIDs; // not really paths
  g_fileData.numPages = imageIDs.length;
  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
  g_fileData.pageIndex = pageIndex;
  g_fileData.data = { bookType: BookType.COMIC };
  updateMenuAndToolbarItems();
  setPageRotation(0, false);
  setInitialZoom(filePath);
  addCurrentToHistory();
  goToPage(pageIndex);
  renderPageInfo();
  renderTitle();
});

ipcMain.on("epub-comic-load-failed", (event) => {
  // unrecoverable error
  closeCurrentFile();
  g_mainWindow.webContents.send(
    "show-modal-info",
    _("ui-modal-info-fileerror"),
    _("ui-modal-info-couldntopen-epub"),
    _("ui-modal-prompt-button-ok")
  );
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("epub-ebook-loaded", (event, filePath, percentage) => {
  g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
  g_fileData.type = FileDataType.EPUB_EBOOK;
  if (percentage < 0 || percentage >= 100) percentage = 0;
  g_fileData.pageIndex = percentage;
  updateMenuAndToolbarItems();
  setPageRotation(0, false);
  setInitialZoom(filePath);
  addCurrentToHistory();
  goToPercentage(g_fileData.pageIndex);
  renderPageInfo();
  renderTitle();
});

ipcMain.on("epub-ebook-load-failed", (event, error) => {
  // unrecoverable error
  g_mainWindow.webContents.send("update-loading", false);
  console.log(error.message);
  g_mainWindow.webContents.send(
    "show-modal-info",
    _("ui-modal-info-fileerror"),
    _("ui-modal-info-couldntopen-epub"),
    _("ui-modal-prompt-button-ok")
  );
  closeCurrentFile(false);
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("pdf-loaded", (event, filePath, pageIndex, numPages) => {
  g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
  // TODO double check loaded is the one loading?
  // TODO change only if correct
  g_fileData.type = FileDataType.PDF;
  g_fileData.path = filePath;
  g_fileData.name = path.basename(filePath);
  g_fileData.pagesPaths = [];
  g_fileData.numPages = numPages;
  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
  g_fileData.pageIndex = pageIndex;
  updateMenuAndToolbarItems();
  setPageRotation(0, false);
  setInitialZoom(filePath);
  g_fileData.numPages = numPages;
  addCurrentToHistory();
  goToPage(pageIndex);
  renderPageInfo();
  renderTitle();
});

ipcMain.on("pdf-load-failed", (event, error) => {
  if (
    error !== undefined &&
    error.name !== undefined &&
    error.name === "PasswordException"
  ) {
    if (error.code === 1) {
      // { message: 'No password given', name: 'PasswordException', code: 1 }
      g_mainWindow.webContents.send(
        "show-modal-prompt-password",
        _("ui-modal-prompt-enterpassword"),
        path.basename(g_fileData.path),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else if (error.code === 2) {
      // { message: 'Incorrect Password', name: 'PasswordException', code: 2 }
      g_mainWindow.webContents.send(
        "show-modal-prompt-password",
        _("ui-modal-prompt-enterpassword"),
        path.basename(g_fileData.path),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    }
  } else {
    // unrecoverable error
    closeCurrentFile();
    g_mainWindow.webContents.send(
      "show-modal-info",
      _("ui-modal-info-fileerror"),
      _("ui-modal-info-couldntopen-pdf"),
      _("ui-modal-prompt-button-ok")
    );
  }
});

ipcMain.on(
  "pdf-page-buffer-extracted",
  (event, error, buf, outputFolderPath, sendToTool) => {
    if (error !== undefined) {
      exportPageError(error);
    } else {
      exportPageSaveBuffer(buf, outputFolderPath, sendToTool);
    }
  }
);

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("escape-pressed", (event) => {
  if (g_mainWindow.isFullScreen()) {
    setFullScreen(false);
  }
});

ipcMain.on("dev-tools-pressed", (event) => {
  if (isDev()) toggleDevTools();
});

ipcMain.on("home-pressed", (event) => {
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPercentage(0);
  } else {
    goToPage(0);
  }
});

ipcMain.on("end-pressed", (event) => {
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPercentage(100);
  } else {
    goToPage(g_fileData.numPages - 1);
  }
});

ipcMain.on("mouse-click", (event, mouseX, bodyX) => {
  if (g_settings.hotspots_mode === 1) {
    if (mouseX > bodyX / 2) {
      goToNextPage();
    } else {
      goToPreviousPage();
    }
  } else if (g_settings.hotspots_mode === 2) {
    const columnWidth = bodyX / 3;
    if (mouseX < columnWidth) {
      goToPreviousPage();
    } else if (mouseX > 2 * columnWidth) {
      goToNextPage();
    }
  }
});

ipcMain.on("zoom-in-pressed", (event) => {
  processZoomInput(1);
});

ipcMain.on("zoom-out-pressed", (event) => {
  processZoomInput(-1);
});

ipcMain.on("zoom-reset-pressed", (event) => {
  processZoomInput(0);
});

ipcMain.on("set-scale-mode", (event, scale) => {
  // called from renderer try-zoom-scale-from-width which is called from main process zoom
  // it's a bit convoluted :)
  setScaleToHeight(scale);
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("toolbar-button-clicked", (event, name) => {
  switch (name) {
    case "toolbar-button-next":
      goToNextPage();
      break;
    case "toolbar-button-prev":
      goToPreviousPage();
      break;
    case "toolbar-button-fit-to-width":
      setFitToWidth();
      break;
    case "toolbar-button-fit-to-height":
      setFitToHeight();
      break;
    case "toolbar-button-fullscreen-enter":
      toggleFullScreen();
      break;
    case "toolbar-button-fullscreen-exit":
      toggleFullScreen();
      break;
    case "toolbar-button-open":
      onMenuOpenFile();
      break;
    case "toolbar-button-rotate-clockwise":
      this.onMenuRotateClockwise();
      break;
    case "toolbar-button-rotate-counterclockwise":
      this.onMenuRotateCounterclockwise();
      break;
  }
});

ipcMain.on("toolbar-slider-changed", (event, value) => {
  if (g_fileData.state === FileDataState.LOADED) {
    if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      goToPercentage(value);
      return;
    } else {
      value -= 1; // from 1 based to 0 based
      if (value !== g_fileData.pageIndex) {
        goToPage(value);
        return;
      }
    }
  }
  renderPageInfo();
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("open-file", (event, filePath) => {
  tryOpen(filePath);
});

ipcMain.on("go-to-page", (event, value) => {
  if (!isNaN(value)) {
    let pageIndex = value - 1;
    if (pageIndex >= 0 && pageIndex < g_fileData.numPages) {
      goToPage(pageIndex);
    }
  }
});

ipcMain.on("enter-scale-value", (event, value) => {
  if (!isNaN(value)) {
    let scale = value;
    if (scale < g_scaleToHeightMin || scale > g_scaleToHeightMax) return;
    setScaleToHeight(scale);
  }
});

ipcMain.on("go-to-percentage", (event, value) => {
  if (!isNaN(value)) {
    if (value >= 0 && value <= 100) {
      goToPercentage(value);
    }
  }
});

///////////////////////////////////////////////////////////////////////////////
// MENU MSGS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.onMenuChangeHotspotsMode = function (mode) {
  if (mode === g_settings.hotspots_mode || mode < 0 || mode > 2)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.hotspots_mode = mode;
    menuBar.setHotspotsMode(mode);
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeEpubOpenAs = function (mode) {
  if (mode === g_settings.epubOpenAs || mode < 0 || mode > 1)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.epubOpenAs = mode;
    menuBar.setEpubOpenAs(mode);
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeLanguage = function (locale) {
  if (locale === i18n.getLoadedLocale())
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.locale = i18n.loadLocale(locale);
    rebuildTranslatedTexts();
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeTheme = function (theme) {
  g_settings.theme = themes.loadTheme(theme);
  g_mainWindow.webContents.send("update-colors", themes.getLoadedThemeData());
  rebuildMenuBar();
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuChangeAutoOpen = function (mode) {
  if (mode === g_settings.autoOpen || mode < 0 || mode > 2)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.autoOpen = mode;
    menuBar.setAutoOpen(mode);
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeMouseCursorVisibility = function (mode) {
  if (mode === g_settings.cursorVisibility || mode < 0 || mode > 1)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.cursorVisibility = mode;
    menuBar.setMouseCursorMode(mode);
    g_mainWindow.webContents.send("set-hide-inactive-mouse-cursor", mode === 1);
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeZoomDefault = function (mode) {
  if (mode === g_settings.zoomDefault || mode < 0 || mode > 2)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.zoomDefault = mode;
    menuBar.setZoomDefault(mode);
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeZoomFileLoading = function (mode) {
  if (mode === g_settings.zoomFileLoading || mode < 0 || mode > 1)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.zoomFileLoading = mode;
    menuBar.setZoomFileLoading(mode);
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeLoadingIndicatorBG = function (value) {
  if (value === g_settings.loadingIndicatorBG || value < 0 || value > 1)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.loadingIndicatorBG = value;
    menuBar.setLoadingIndicatorBG(value);
    updateLoadingIndicator();
    g_mainWindow.webContents.send("update-menubar");
  }
};
exports.onMenuChangeLoadingIndicatorIconSize = function (value) {
  if (value === g_settings.loadingIndicatorIconSize || value < 0 || value > 1)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.loadingIndicatorIconSize = value;
    menuBar.setLoadingIndicatorIconSize(value);
    updateLoadingIndicator();
    g_mainWindow.webContents.send("update-menubar");
  }
};
exports.onMenuChangeLoadingIndicatorIconPos = function (value) {
  if (value === g_settings.loadingIndicatorIconPos || value < 0 || value > 1)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.loadingIndicatorIconPos = value;
    menuBar.setLoadingIndicatorIconPos(value);
    updateLoadingIndicator();
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuChangeLayoutClock = function (value) {
  if (value === g_settings.layoutClock || value < 0 || value > 5)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.layoutClock = value;
    menuBar.setLayoutClock(value);
    updateLayoutClock();
    g_mainWindow.webContents.send("update-menubar");
  }
};
exports.onMenuChangeLayoutPageNum = function (value) {
  if (value === g_settings.layoutPageNum || value < 0 || value > 5)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.layoutPageNum = value;
    menuBar.setLayoutPageNum(value);
    updateLayoutPageNum();
    g_mainWindow.webContents.send("update-menubar");
  }
};
exports.onMenuChangeLayoutAudioPlayer = function (value) {
  if (value === g_settings.layoutAudioPlayer || value < 0 || value > 5)
    g_mainWindow.webContents.send("update-menubar");
  else {
    g_settings.layoutAudioPlayer = value;
    menuBar.setLayoutAudioPlayer(value);
    updateLayoutAudioPlayer();
    g_mainWindow.webContents.send("update-menubar");
  }
};

exports.onMenuNextPage = function () {
  goToNextPage();
};

exports.onMenuPreviousPage = function () {
  goToPreviousPage();
};

exports.onMenuNextPage = function () {
  goToNextPage();
};

exports.onMenuFitToWidth = function () {
  setFitToWidth();
};

exports.onMenuFitToHeight = function () {
  setFitToHeight();
};

exports.onMenuScaleToHeight = function (scale) {
  setScaleToHeight(scale);
};

exports.onMenuScaleToHeightZoomInput = function (input) {
  // now handled by renderer
  //processZoomInput(input);
};

exports.onMenuScaleToHeightEnter = function () {
  g_mainWindow.webContents.send("update-menubar");
  let question = `${_(
    "ui-modal-prompt-scalevalue"
  )} (${g_scaleToHeightMin}-${g_scaleToHeightMax}%):`;
  g_mainWindow.webContents.send(
    "show-modal-prompt",
    question,
    "" + g_settings.zoom_scale,
    _("ui-modal-prompt-button-ok"),
    _("ui-modal-prompt-button-cancel"),
    1
  );
};

exports.onMenuRotationValue = function (value) {
  setPageRotation(value, true);
};

exports.onMenuRotateClockwise = onMenuRotateClockwise;
function onMenuRotateClockwise() {
  setPageRotation(g_fileData.pageRotation + 90, true);
}

exports.onMenuRotateCounterclockwise = onMenuRotateCounterclockwise;
function onMenuRotateCounterclockwise() {
  setPageRotation(g_fileData.pageRotation - 90, true);
}

exports.onMenuToggleScrollBar = function () {
  toggleScrollBar();
};

exports.onMenuToggleToolBar = function () {
  toggleToolBar();
};

exports.onMenuTogglePageNumber = function () {
  togglePageNumber();
};

exports.onMenuToggleClock = function () {
  toggleClock();
};

exports.onMenuToggleAudioPlayer = function () {
  toggleAudioPlayer();
};

exports.onMenuToggleFullScreen = function () {
  toggleFullScreen();
};

exports.onMenuOpenFile = onMenuOpenFile;
function onMenuOpenFile() {
  g_mainWindow.webContents.send("update-menubar");

  let defaultPath;
  if (g_fileData.path !== "") {
    defaultPath = path.dirname(g_fileData.path);
  } else if (g_history.length > 0 && !g_history[g_history.length - 1].data) {
    defaultPath = path.dirname(g_history[g_history.length - 1].filePath);
  }
  if (defaultPath && !fs.existsSync(defaultPath)) defaultPath = undefined;

  let allowMultipleSelection = false;
  let allowedFileTypesName = "Comics, Books & Images";
  let allowedFileTypesList = [
    FileExtension.CBZ,
    FileExtension.CBR,
    FileExtension.CB7,
    FileExtension.PDF,
    FileExtension.EPUB,

    FileExtension.JPG,
    FileExtension.JPEG,
    FileExtension.PNG,
    FileExtension.WEBP,
    FileExtension.BMP,
    FileExtension.AVIF,
  ];
  let fileList = fileUtils.chooseOpenFiles(
    g_mainWindow,
    defaultPath,
    allowedFileTypesName,
    allowedFileTypesList,
    allowMultipleSelection
  );
  if (fileList === undefined) {
    return;
  }
  let filePath = fileList[0];

  tryOpen(filePath);
}

exports.onMenuClearHistory = function () {
  g_mainWindow.webContents.send("update-menubar");
  clearHistory();
};

exports.onMenuOpenHistoryManager = function () {
  const manager = require("./tools/history-mgr/main");
  manager.showWindow(g_mainWindow, g_history);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuCloseFile = function () {
  closeCurrentFile();
};

exports.onMenuPageExport = function () {
  exportPageStart(0);
};

exports.onMenuPageExtractText = function () {
  exportPageStart(1);
};

exports.onMenuPageExtractPalette = function () {
  exportPageStart(2);
};

exports.onMenuPageExtractQR = function () {
  exportPageStart(3);
};

exports.onMenuConvertFile = function () {
  if (g_fileData.path !== undefined) {
    const tool = require("./tools/convert-comics/main");
    tool.showWindow(g_mainWindow, g_fileData);
  }
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuExtractFile = function () {
  if (g_fileData.path !== undefined) {
    const tool = require("./tools/extract-comics/main");
    tool.showWindow(g_mainWindow, g_fileData);
  }
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolConvertComics = function () {
  const tool = require("./tools/convert-comics/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolCreateComic = function () {
  const tool = require("./tools/create-comic/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolCreateQR = function () {
  const tool = require("./tools/create-qr/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolConvertImages = function () {
  const tool = require("./tools/convert-imgs/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolExtractText = function () {
  const tool = require("./tools/extract-text/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolExtractQR = function () {
  const tool = require("./tools/extract-qr/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolExtractPalette = function () {
  const tool = require("./tools/extract-palette/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolExtractComics = function () {
  const tool = require("./tools/extract-comics/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolDCM = function () {
  const tool = require("./tools/dcm/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolIArchive = function () {
  const tool = require("./tools/internet-archive/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolGutenberg = function () {
  const tool = require("./tools/gutenberg/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolXkcd = function () {
  const tool = require("./tools/xkcd/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolLibrivox = function () {
  const tool = require("./tools/librivox/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToolWiktionary = function () {
  const tool = require("./tools/wiktionary/main");
  tool.showWindow(g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuToggleDevTools = function () {
  toggleDevTools();
};

exports.onMenuAbout = function () {
  g_mainWindow.webContents.send(
    "show-modal-info",
    "ACBR",
    "ACBR Comic Book Reader\n" +
      _("ui-modal-info-version") +
      ": " +
      app.getVersion() +
      "\n(c) Álvaro García\nwww.binarynonsense.com",
    _("ui-modal-prompt-button-ok")
  );
};

exports.onGoToPageDialog = function () {
  g_mainWindow.webContents.send("update-menubar");
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    let question = `${_("ui-modal-prompt-pagepercentage")} (0-100):`;
    g_mainWindow.webContents.send(
      "show-modal-prompt",
      question,
      "" + g_fileData.pageIndex,
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel"),
      2
    );
  } else {
    let question = `${_("ui-modal-prompt-pagenumber")} (1-${
      g_fileData.numPages
    }):`;
    g_mainWindow.webContents.send(
      "show-modal-prompt",
      question,
      "" + (g_fileData.pageIndex + 1),
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel")
    );
  }
};

exports.onGoToPageFirst = function () {
  g_mainWindow.webContents.send("update-menubar");
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPercentage(0);
  } else {
    goToPage(0);
  }
};

exports.onGoToPageLast = function () {
  g_mainWindow.webContents.send("update-menubar");
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPercentage(100);
  } else {
    goToPage(g_fileData.numPages - 1);
  }
};

////////////////////////////////////////////////////////////////////////////////

exports.onReplaceHistory = function (newHistory) {
  g_history = newHistory;
  rebuildMenuBar();
};

///////////////////////////////////////////////////////////////////////////////
// FILES //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_fileData = {
  state: FileDataState.NOT_SET,
  type: FileDataType.NOT_SET,
  path: "",
  name: "",
  pagesPaths: [],
  numPages: 0,
  pageIndex: 0,
  pageRotation: 0,
  password: "",
  getPageCallback: undefined,
  data: undefined,
};

function cleanUpFileData() {
  g_fileData.state = FileDataState.NOT_SET;
  g_fileData.type = FileDataType.NOT_SET;
  g_fileData.path = "";
  g_fileData.name = "";
  g_fileData.pagesPaths = [];
  g_fileData.numPages = 0;
  g_fileData.pageIndex = 0;
  g_fileData.pageRotation = 0;
  g_fileData.password = "";
  g_fileData.getPageCallback = undefined;
  g_fileData.data = undefined;
}

function tryOpen(filePath, bookType, historyEntry) {
  g_mainWindow.webContents.send("update-menubar"); // in case coming from menu
  closeCurrentFile();
  if (!bookType) bookType = BookType.NOT_SET;
  let pageIndex;

  if (!historyEntry) {
    let historyIndex = getHistoryIndex(filePath);
    if (historyIndex !== undefined) {
      historyEntry = g_history[historyIndex];
    }
  }

  if (historyEntry) {
    pageIndex = historyEntry.pageIndex;
    if (historyEntry.data && historyEntry.data.source) {
      if (
        historyEntry.data.source === "dcm" ||
        historyEntry.data.source === "iab" ||
        historyEntry.data.source === "xkcd"
      ) {
        return tryOpenWWW(pageIndex, historyEntry);
      } else if (historyEntry.data.source === "gut") {
        return tryOpenPath(filePath, pageIndex, BookType.EBOOK, historyEntry);
      }
    }
    if (bookType === BookType.NOT_SET && historyEntry?.data?.bookType) {
      if (g_settings.epubOpenAs === 0) bookType = historyEntry.data.bookType;
    }
  }

  if (fileFormats.hasEpubExtension(filePath) && bookType === BookType.NOT_SET) {
    // Special case, as epub can be opened as comic or ebook
    g_mainWindow.webContents.send(
      "show-modal-question-openas",
      _("ui-modal-question-ebookorcomic", "Epub"),
      filePath,
      _("ui-modal-question-button-comicbook"),
      _("ui-modal-question-button-ebook"),
      filePath
    );
    return true;
  }

  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    g_mainWindow.webContents.send(
      "show-modal-info",
      _("ui-modal-info-filenotfound"),
      filePath,
      _("ui-modal-prompt-button-ok")
    );
    return false;
  }
  return tryOpenPath(filePath, pageIndex, bookType, historyEntry);
}
exports.tryOpen = tryOpen;

function tryOpenPath(filePath, pageIndex, bookType, historyEntry) {
  if (bookType === BookType.EBOOK) {
    if (fileFormats.hasEpubExtension(filePath)) {
      openEbookFromPath(filePath, pageIndex, historyEntry);
      return true;
    } else {
      // ERROR ??????
    }
  } else {
    if (fs.lstatSync(filePath).isDirectory()) {
      openImageFolder(filePath, undefined, pageIndex);
      return true;
    } else if (fileFormats.hasComicBookExtension(filePath)) {
      openComicBookFromPath(filePath, pageIndex, "", historyEntry);
      return true;
    } else if (fileFormats.hasImageExtension(filePath)) {
      openImageFile(filePath);
      return true;
    }
  }
  return false;
}

function tryOpenWWW(pageIndex, historyEntry) {
  const data = historyEntry.data;
  if (data.source === "dcm") {
    const tool = require("./tools/dcm/main");
    openBookFromCallback(data, tool.getPageCallback, pageIndex);
    return true;
  } else if (data.source === "iab") {
    const tool = require("./tools/internet-archive/main");
    openBookFromCallback(data, tool.getPageCallback, pageIndex);
    return true;
  } else if (data.source === "xkcd") {
    const tool = require("./tools/xkcd/main");
    openBookFromCallback(data, tool.getPageCallback, pageIndex);
    return true;
  }
  return false;
}

function openImageFile(filePath) {
  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    g_mainWindow.webContents.send("update-bg", true);
    g_mainWindow.webContents.send("update-loading", false);
    return;
  }
  openImageFolder(path.dirname(filePath), filePath);
}

function openImageFolder(folderPath, filePath, pageIndex) {
  g_mainWindow.webContents.send("update-bg", false);
  if (
    folderPath === undefined ||
    folderPath === "" ||
    !fs.existsSync(folderPath)
  ) {
    g_mainWindow.webContents.send("update-bg", true);
    g_mainWindow.webContents.send("update-loading", false);
    return;
  }

  let pagesPaths = fileUtils.getImageFilesInFolder(folderPath);
  if (pagesPaths.length <= 0) {
    g_mainWindow.webContents.send("update-bg", true);
    g_mainWindow.webContents.send("update-loading", false);
    return;
  }
  pagesPaths.sort(fileUtils.compare);

  if (pageIndex === undefined) {
    if (filePath !== undefined && filePath !== "") {
      for (let index = 0; index < pagesPaths.length; index++) {
        if (pagesPaths[index] === path.basename(filePath)) {
          pageIndex = index;
          break;
        }
      }
    } else {
      let historyIndex = getHistoryIndex(folderPath);
      if (historyIndex !== undefined) {
        pageIndex = g_history[historyIndex].pageIndex;
      }
    }
  }
  if (pageIndex === undefined) pageIndex = 0;

  g_fileData.state = FileDataState.LOADED;
  g_fileData.type = FileDataType.IMGS_FOLDER;
  g_fileData.path = folderPath;
  g_fileData.name = path.basename(folderPath);
  g_fileData.pagesPaths = pagesPaths;
  g_fileData.numPages = pagesPaths.length;
  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
  g_fileData.pageIndex = pageIndex;
  updateMenuAndToolbarItems();
  setPageRotation(0, false);
  setInitialZoom(g_fileData.path);
  goToPage(pageIndex);
}

function openComicBookFromPath(filePath, pageIndex, password, historyEntry) {
  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    return;
  }

  g_mainWindow.webContents.send("update-loading", true);
  g_mainWindow.webContents.send("update-bg", false);

  let fileExtension = path.extname(filePath).toLowerCase();
  if (!pageIndex) pageIndex = 0;
  if (!password) password = "";

  (async () => {
    let fileType = await FileType.fromFile(filePath);
    if (fileType !== undefined) {
      // ref: file-type -> https://www.npmjs.com/package/file-type
      // e.g. {ext: 'png', mime: 'image/png'}
      fileExtension = "." + fileType.ext;
    }

    if (fileExtension === "." + FileExtension.PDF) {
      if (g_fileData.state !== FileDataState.LOADING) {
        cleanUpFileData();
        g_fileData.type = FileDataType.PDF;
        g_fileData.state = FileDataState.LOADING;
        g_fileData.pageIndex = pageIndex;
        g_fileData.path = filePath;
      }
      g_fileData.password = password;
      g_mainWindow.webContents.send("load-pdf", filePath, pageIndex, password);
    } else if (fileExtension === "." + FileExtension.EPUB) {
      cleanUpFileData();
      g_fileData.type = FileDataType.EPUB_COMIC;
      g_fileData.state = FileDataState.LOADING;
      g_fileData.pageIndex = pageIndex;
      g_fileData.path = filePath;
      g_fileData.password = password;
      g_mainWindow.webContents.send("load-epub-comic", filePath, pageIndex);
    } else {
      if (
        fileExtension === "." + FileExtension.RAR ||
        fileExtension === "." + FileExtension.CBR
      ) {
        let rarData = await fileFormats.getRarEntriesList(filePath, password);
        if (rarData.result === "password required") {
          if (g_fileData.state !== FileDataState.LOADING) {
            cleanUpFileData();
            g_fileData.state = FileDataState.LOADING;
            g_fileData.type = FileDataType.RAR;
            g_fileData.path = filePath;
            g_fileData.pageIndex = pageIndex;
          }
          g_fileData.password = password;
          g_mainWindow.webContents.send(
            "show-modal-prompt-password",
            _("ui-modal-prompt-enterpassword"),
            path.basename(g_fileData.path),
            _("ui-modal-prompt-button-ok"),
            _("ui-modal-prompt-button-cancel")
          );
          return;
        } else if (rarData.result === "other error") {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("ui-modal-info-fileerror"),
            _("ui-modal-info-couldntopen-rar"),
            _("ui-modal-prompt-button-ok")
          );
          g_mainWindow.webContents.send("update-bg", true);
          g_mainWindow.webContents.send("update-loading", false);
          return;
        }
        let pagesPaths = rarData.paths;
        pagesPaths.sort(fileUtils.compare);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.RAR;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.numPages = pagesPaths.length;
          if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
          g_fileData.pageIndex = pageIndex;
          g_fileData.password = password;
          updateMenuAndToolbarItems();
          setPageRotation(0, false);
          setInitialZoom(filePath);
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("ui-modal-info-fileerror"),
            _("ui-modal-info-couldntopen-rar"),
            _("ui-modal-prompt-button-ok")
          );
          g_mainWindow.webContents.send("update-bg", true);
          g_mainWindow.webContents.send("update-loading", false);
        }
      } else if (
        fileExtension === "." + FileExtension.ZIP ||
        fileExtension === "." + FileExtension.CBZ
      ) {
        let zipData = fileFormats.getZipEntriesList(filePath, password);
        if (zipData.result === "password required") {
          if (g_fileData.state !== FileDataState.LOADING) {
            cleanUpFileData();
            g_fileData.state = FileDataState.LOADING;
            g_fileData.type = FileDataType.ZIP;
            g_fileData.path = filePath;
            g_fileData.pageIndex = pageIndex;
          }
          g_fileData.password = password;
          g_mainWindow.webContents.send(
            "show-modal-prompt-password",
            _("ui-modal-prompt-enterpassword"),
            path.basename(g_fileData.path),
            _("ui-modal-prompt-button-ok"),
            _("ui-modal-prompt-button-cancel")
          );
          return;
        } else if (zipData.result === "other error") {
          if (zipData.extra == "aes") {
            g_mainWindow.webContents.send(
              "show-modal-info",
              _("ui-modal-info-fileerror"),
              _("ui-modal-info-couldntopen-zip-aes"),
              _("ui-modal-prompt-button-ok")
            );
          } else {
            g_mainWindow.webContents.send(
              "show-modal-info",
              _("ui-modal-info-fileerror"),
              _("ui-modal-info-couldntopen-zip"),
              _("ui-modal-prompt-button-ok")
            );
          }
          g_mainWindow.webContents.send("update-bg", true);
          g_mainWindow.webContents.send("update-loading", false);
          return;
        }
        let pagesPaths = zipData.paths;
        pagesPaths.sort(fileUtils.compare);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.ZIP;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.numPages = pagesPaths.length;
          if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
          g_fileData.pageIndex = pageIndex;
          g_fileData.password = password;
          updateMenuAndToolbarItems();
          setPageRotation(0, false);
          setInitialZoom(filePath);
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("ui-modal-info-fileerror"),
            _("ui-modal-info-couldntopen-zip"),
            _("ui-modal-prompt-button-ok")
          );
          g_mainWindow.webContents.send("update-bg", true);
          g_mainWindow.webContents.send("update-loading", false);
        }
      } else if (
        fileExtension === "." + FileExtension.SEVENZIP ||
        fileExtension === "." + FileExtension.CB7
      ) {
        let sevenData = await fileFormats.get7ZipEntriesList(
          filePath,
          password
        );
        if (sevenData.result === "password required") {
          if (g_fileData.state !== FileDataState.LOADING) {
            cleanUpFileData();
            g_fileData.state = FileDataState.LOADING;
            g_fileData.type = FileDataType.SEVENZIP;
            g_fileData.path = filePath;
            g_fileData.pageIndex = pageIndex;
          }
          g_fileData.password = password;
          g_mainWindow.webContents.send(
            "show-modal-prompt-password",
            _("ui-modal-prompt-enterpassword"),
            path.basename(g_fileData.path),
            _("ui-modal-prompt-button-ok"),
            _("ui-modal-prompt-button-cancel")
          );
          return;
        } else if (sevenData.result === "other error") {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("ui-modal-info-fileerror"),
            _("ui-modal-info-couldntopen-7z"),
            _("ui-modal-prompt-button-ok")
          );
          g_mainWindow.webContents.send("update-bg", true);
          g_mainWindow.webContents.send("update-loading", false);
          return;
        }
        let pagesPaths = sevenData.paths;
        pagesPaths.sort(fileUtils.compare);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.SEVENZIP;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.numPages = pagesPaths.length;
          if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
          g_fileData.pageIndex = pageIndex;
          g_fileData.password = password;
          updateMenuAndToolbarItems();
          setPageRotation(0, false);
          setInitialZoom(filePath);
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("ui-modal-info-fileerror"),
            _("ui-modal-info-couldntopen-7z"),
            _("ui-modal-prompt-button-ok")
          );
          g_mainWindow.webContents.send("update-bg", true);
          g_mainWindow.webContents.send("update-loading", false);
        }
      } else {
        g_mainWindow.webContents.send(
          "show-modal-info",
          _("ui-modal-info-fileerror"),
          _("ui-modal-info-invalidformat"),
          _("ui-modal-prompt-button-ok")
        );
        g_mainWindow.webContents.send("update-bg", true);
        g_mainWindow.webContents.send("update-loading", false);
        return;
      }
    }
  })(); // async
}

async function openEbookFromPath(filePath, pageIndex, historyEntry) {
  if (filePath === undefined || filePath === "") {
    return;
  }
  closeCurrentFile(); // in case coming from tool and bypassing tryopen
  let fileExtension = path.extname(filePath).toLowerCase();
  if (fileExtension === "." + FileExtension.EPUB) {
    let data;
    let cachedPath;
    let name = path.basename(filePath);
    if (historyEntry?.data?.source === "gut") {
      data = historyEntry.data;
      if (data.name && data.name != "") name = data.name;
      // cached file
      if (filePath.startsWith("http")) {
        if (g_settings.toolGutUseCache) {
          g_mainWindow.webContents.send("update-loading", true);
          g_mainWindow.webContents.send("update-bg", false);
          const url = filePath;
          const tool = require("./tools/gutenberg/main");
          const cacheFolder = tool.getPortableCacheFolder();
          const fileName = path.basename(filePath);
          cachedPath = path.join(cacheFolder, fileName);

          if (!fs.existsSync(cachedPath)) {
            try {
              // download it
              const axios = require("axios").default;
              const response = await axios.get(url, {
                responseType: "arraybuffer",
                timeout: 10000,
              });

              if (!response?.data) {
                throw {
                  name: "GenericError",
                  message: "Invalid response data",
                };
              }
              if (!fs.existsSync(cacheFolder)) {
                fs.mkdirSync(cacheFolder, { recursive: true });
              }
              fs.writeFileSync(cachedPath, response.data, { flag: "w" });
            } catch (error) {
              console.log(error?.message);
              // couldn't download file -> abort
              g_mainWindow.webContents.send("update-loading", false);
              g_mainWindow.webContents.send("update-bg", true);
              return;
            }
          }
        }
      } else if (!fs.existsSync(filePath)) {
        return;
      }
    } else if (!fs.existsSync(filePath)) {
      return;
    }

    g_mainWindow.webContents.send("update-loading", true);
    g_mainWindow.webContents.send("update-bg", false);
    cleanUpFileData();

    g_fileData.type = FileDataType.EPUB_EBOOK;
    g_fileData.state = FileDataState.LOADING;
    g_fileData.path = filePath;
    g_fileData.name = name;
    if (!pageIndex || pageIndex < 0 || pageIndex >= 100) pageIndex = 0;
    g_fileData.pageIndex = pageIndex;
    g_fileData.numPages = 100;
    if (data) {
      g_fileData.data = data;
    } else {
      g_fileData.data = { bookType: BookType.EBOOK };
    }

    g_mainWindow.webContents.send(
      "load-epub-ebook",
      filePath,
      pageIndex,
      cachedPath
    );
  } else {
    g_mainWindow.webContents.send("update-loading", false);
    g_mainWindow.webContents.send("update-bg", true);
  }
}
exports.openEbookFromPath = openEbookFromPath;

function openBookFromCallback(comicData, getPageCallback, pageIndex = 0) {
  g_mainWindow.webContents.send("update-bg", false);
  g_mainWindow.webContents.send("update-loading", true);
  cleanUpFileData();
  g_fileData.state = FileDataState.LOADED;
  g_fileData.type = FileDataType.WWW;
  g_fileData.path = comicData.name;
  g_fileData.name = comicData.name;
  g_fileData.pagesPaths = [];
  g_fileData.numPages = comicData.numPages;
  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
  g_fileData.pageIndex = pageIndex;
  g_fileData.getPageCallback = getPageCallback;
  g_fileData.data = comicData;
  updateMenuAndToolbarItems();
  setPageRotation(0, false);
  setInitialZoom(g_fileData.path);
  goToPage(g_fileData.pageIndex);
}
exports.openBookFromCallback = openBookFromCallback;

///////////////////////////////////////////////////////////////////////////////

function tryOpeningAdjacentFile(next) {
  // next true -> try next, next false -> try prev
  if (g_fileData.type === FileDataType.IMGS_FOLDER) return;
  const fileName = path.basename(g_fileData.path);
  const folderPath = path.dirname(g_fileData.path);
  let allFiles = fs.readdirSync(folderPath);
  let comicFiles = [];
  allFiles.forEach((file) => {
    if (fileFormats.hasComicBookExtension(file)) {
      comicFiles.push(file);
    }
  });
  comicFiles.sort(fileUtils.compare);
  for (let index = 0; index < comicFiles.length; index++) {
    if (comicFiles[index] === fileName) {
      if (next) {
        if (index < comicFiles.length - 1) {
          let nextFileName = path.join(folderPath, comicFiles[index + 1]);
          tryOpen(nextFileName);
          return;
        }
      } else {
        if (index > 0) {
          let prevFileName = path.join(folderPath, comicFiles[index - 1]);
          tryOpen(prevFileName);
          return;
        }
      }
      break;
    }
  }
}

function closeCurrentFile(addToHistory = true) {
  if (g_fileData.type === FileDataType.NOT_SET) return;
  if (addToHistory) addCurrentToHistory(); // add the one I'm closing to history
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    g_mainWindow.webContents.send("close-epub-ebook");
  }
  cleanUpFileData();
  updateMenuAndToolbarItems();
  renderTitle();
  g_mainWindow.webContents.send("file-closed");
  g_mainWindow.webContents.send("update-menubar");
  g_mainWindow.webContents.send("update-loading", false);
}

///////////////////////////////////////////////////////////////////////////////
// RENDER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function renderTitle() {
  let title = generateTitle();
  g_mainWindow.setTitle(title);
  g_mainWindow.webContents.send("update-title", title);
}

function renderPageInfo() {
  let isPercentage = g_fileData.type === FileDataType.EPUB_EBOOK;
  g_mainWindow.webContents.send(
    "render-page-info",
    g_fileData.pageIndex,
    g_fileData.numPages,
    isPercentage
  );
}

function renderPageRefresh() {
  if (g_fileData.state === FileDataState.LOADED) {
    if (g_fileData.type === FileDataType.PDF) {
      g_mainWindow.webContents.send(
        "refresh-pdf-page",
        g_fileData.pageRotation
      );
    } else if (
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.SEVENZIP ||
      g_fileData.type === FileDataType.IMGS_FOLDER ||
      g_fileData.type === FileDataType.WWW
    ) {
      g_mainWindow.webContents.send(
        "refresh-img-page",
        g_fileData.pageRotation
      );
    } else if (g_fileData.type === FileDataType.EPUB_COMIC) {
      g_mainWindow.webContents.send(
        "refresh-epub-comic-page",
        g_fileData.pageRotation
      );
    } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      g_mainWindow.webContents.send(
        "refresh-epub-ebook-page",
        g_fileData.pageRotation
      );
    }
  }
}

function rebuildMenuBar() {
  menuBar.buildApplicationMenu(
    i18n.getLoadedLocale(),
    i18n.getAvailableLocales(),
    themes.getLoadedTheme(),
    themes.getAvailableThemes(),
    g_settings,
    g_history
  );
  updateMenuAndToolbarItems();
  g_mainWindow.webContents.send("update-menubar");
}

/////////////////////////////////////////////////

function generateTitle() {
  let title = "---";
  let blankSpace = "           ";
  if (g_fileData.state === FileDataState.NOT_SET) {
    title = "Comic Book Reader - ACBR" + blankSpace;
  } else if (g_mainWindow.getSize()[0] < 600) {
    title = "ACBR" + blankSpace;
  } else {
    title = `${g_fileData.name}`;
    let length = 50;
    if (g_mainWindow.getSize()[0] > 1500) length = 120;
    else if (g_mainWindow.getSize()[0] >= 1280) length = 100;
    title =
      title.length > length
        ? title.substring(0, length - 3) + "..."
        : title.substring(0, length);
    title += " - ACBR" + blankSpace;
  }
  return title;
}

///////////////////////////////////////////////////////////////////////////////
// PAGE NAVIGATION ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function goToPage(pageIndex, scrollBarPos = 0) {
  // scrollbar: 0 top - 1 bottom
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    g_mainWindow.webContents.send("update-bg", true);
    g_mainWindow.webContents.send("update-loading", false);
    return;
  }

  g_mainWindow.webContents.send("update-loading", true);
  if (g_fileData.type !== FileDataType.EPUB_EBOOK) {
    if (pageIndex < 0 || pageIndex >= g_fileData.numPages) return;
    g_fileData.pageIndex = pageIndex;
  }

  if (
    g_fileData.type === FileDataType.ZIP ||
    g_fileData.type === FileDataType.RAR ||
    g_fileData.type === FileDataType.SEVENZIP ||
    g_fileData.type === FileDataType.EPUB_COMIC ||
    g_fileData.type === FileDataType.IMGS_FOLDER
  ) {
    g_fileData.state = FileDataState.LOADING;
    if (g_workerPage !== undefined) {
      // kill it after one use
      g_workerPage.kill();
      g_workerPage = undefined;
    }
    if (g_workerPage === undefined) {
      g_workerPage = fork(path.join(__dirname, "worker-page.js"));
      g_workerPage.on("message", (message) => {
        g_workerPage.kill(); // kill it after one use
        if (message[0] === true) {
          g_mainWindow.webContents.send(
            "render-img-page",
            message[1], //img64,
            g_fileData.pageRotation,
            message[2]
          );
          return;
        } else {
          // TODO: handle error
          console.log("worker error");
          console.log(message[1]);
          g_mainWindow.webContents.send("update-loading", false);
          return;
        }
      });
    }
    g_workerPage.send([
      g_fileData.type,
      g_fileData.path,
      g_fileData.pagesPaths[g_fileData.pageIndex],
      scrollBarPos,
      g_fileData.password,
    ]);
  } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    if (pageIndex > 0) {
      g_fileData.state = FileDataState.LOADING;
      g_mainWindow.webContents.send("render-epub-ebook-page-next");
    } else if (pageIndex < 0) {
      g_fileData.state = FileDataState.LOADING;
      g_mainWindow.webContents.send("render-epub-ebook-page-prev");
    }
  } else if (g_fileData.type === FileDataType.PDF) {
    g_fileData.state = FileDataState.LOADING;
    g_mainWindow.webContents.send(
      "render-pdf-page",
      g_fileData.pageIndex,
      g_fileData.pageRotation,
      scrollBarPos
    );
  } else if (g_fileData.type === FileDataType.WWW) {
    (async () => {
      const calledFunc = g_fileData.getPageCallback;
      let response = await g_fileData.getPageCallback(
        g_fileData.pageIndex + 1,
        g_fileData
      );
      if (calledFunc !== g_fileData.getPageCallback) {
        // getPageCallback changed while downloading
        return;
      }
      if (!response || !response.pageImgSrc) {
        // TODO: handle error
        console.log("download error");
        g_mainWindow.webContents.send("update-loading", false);
        return;
      }
      g_fileData.pagesPaths = [response.pageImgUrl];
      if (response.tempData) {
        if (g_fileData.data) {
          g_fileData.data.tempData = response.tempData;
        }
      }
      g_mainWindow.webContents.send(
        "render-img-page",
        response.pageImgSrc,
        g_fileData.pageRotation,
        scrollBarPos
      );
    })(); // async
  }
}

function goToNextPage() {
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPage(1);
  } else {
    if (g_fileData.pageIndex + 1 < g_fileData.numPages) {
      goToPage(g_fileData.pageIndex + 1);
    } else if (g_settings.autoOpen === 1 || g_settings.autoOpen === 2) {
      tryOpeningAdjacentFile(true);
    }
  }
}

function goToPreviousPage() {
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPage(-1);
  } else {
    if (g_fileData.pageIndex - 1 >= 0) {
      goToPage(g_fileData.pageIndex - 1, 1);
    } else if (g_settings.autoOpen === 2) {
      tryOpeningAdjacentFile(false);
    }
  }
}

function goToPercentage(percentage) {
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    g_mainWindow.webContents.send("update-bg", true);
    g_mainWindow.webContents.send("update-loading", false);
    return;
  }
  g_mainWindow.webContents.send("update-loading", true);

  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    if (percentage < 0 || percentage > 100) return;
    g_fileData.pageIndex = percentage;
    g_fileData.state = FileDataState.LOADING;
    g_mainWindow.webContents.send(
      "render-epub-ebook-page-percentage",
      percentage
    );
  }
}

///////////////////////////////////////////////////////////////////////////////
// EXPORT /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function exportPageStart(sendToTool = 0) {
  let outputFolderPath;
  if (sendToTool !== 0) {
    outputFolderPath = fileUtils.createTempFolder();
  } else {
    let defaultPath = app.getPath("desktop");
    let folderList = fileUtils.chooseFolder(g_mainWindow, defaultPath);
    if (folderList === undefined) {
      return;
    }
    outputFolderPath = folderList[0];
  }

  if (
    g_fileData.filePath === "" ||
    outputFolderPath === undefined ||
    outputFolderPath === ""
  )
    return;

  g_mainWindow.webContents.send("update-loading", true);
  try {
    if (g_fileData.type === FileDataType.PDF) {
      g_mainWindow.webContents.send(
        "extract-pdf-image-buffer",
        g_fileData.path,
        g_fileData.pageIndex + 1,
        outputFolderPath,
        g_fileData.password,
        sendToTool
      );
      return;
    } else {
      if (g_workerExport !== undefined) {
        // kill it after one use
        g_workerExport.kill();
        g_workerExport = undefined;
      }
      if (g_workerExport === undefined) {
        g_workerExport = fork(path.join(__dirname, "worker-export.js"));
        g_workerExport.on("message", (message) => {
          g_workerExport.kill(); // kill it after one use
          if (message[0]) {
            g_mainWindow.webContents.send("update-loading", false);
            if (message[2] === 1) {
              const extractTextTool = require("./tools/extract-text/main");
              extractTextTool.showWindow(g_mainWindow, message[1]);
              g_mainWindow.webContents.send("update-menubar");
            } else if (message[2] === 2) {
              const extractPaletteTool = require("./tools/extract-palette/main");
              extractPaletteTool.showWindow(g_mainWindow, message[1]);
              g_mainWindow.webContents.send("update-menubar");
            } else if (message[2] === 3) {
              const extractQRTool = require("./tools/extract-qr/main");
              extractQRTool.showWindow(g_mainWindow, message[1]);
              g_mainWindow.webContents.send("update-menubar");
            } else {
              g_mainWindow.webContents.send(
                "show-modal-info",
                "",
                _("ui-modal-info-imagesavedto") +
                  "\n" +
                  fileUtils.reducePathString(message[1], 85),
                _("ui-modal-prompt-button-ok")
              );
            }
            return;
          } else {
            exportPageError(message[1]);
            return;
          }
        });
      }
      g_workerExport.send({
        data: g_fileData,
        outputFolderPath: outputFolderPath,
        sendToTool: sendToTool,
      });
    }
  } catch (err) {
    exportPageError(err);
  }
}

function exportPageSaveBuffer(buf, outputFolderPath, sendToTool) {
  if (buf !== undefined) {
    try {
      (async () => {
        let fileType = await FileType.fromBuffer(buf);
        let fileExtension = "." + FileExtension.JPG;
        if (fileType !== undefined) {
          fileExtension = "." + fileType.ext;
        }
        let fileName =
          path.basename(g_fileData.name, path.extname(g_fileData.name)) +
          "_page_" +
          (g_fileData.pageIndex + 1);

        let outputFilePath = path.join(
          outputFolderPath,
          fileName + fileExtension
        );
        let i = 1;
        while (fs.existsSync(outputFilePath)) {
          i++;
          outputFilePath = path.join(
            outputFolderPath,
            fileName + "(" + i + ")" + fileExtension
          );
        }
        fs.writeFileSync(outputFilePath, buf, "binary");

        if (sendToTool === 1) {
          const extractTextTool = require("./tools/extract-text/main");
          extractTextTool.showWindow(g_mainWindow, outputFilePath);
          g_mainWindow.webContents.send("update-menubar");
        } else if (sendToTool === 2) {
          const extractPaletteTool = require("./tools/extract-palette/main");
          extractPaletteTool.showWindow(g_mainWindow, outputFilePath);
          g_mainWindow.webContents.send("update-menubar");
        } else if (sendToTool === 3) {
          const extractQRTool = require("./tools/extract-qr/main");
          extractQRTool.showWindow(g_mainWindow, outputFilePath);
          g_mainWindow.webContents.send("update-menubar");
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            "",
            _("ui-modal-info-imagesavedto") +
              "\n" +
              fileUtils.reducePathString(outputFilePath, 85),
            _("ui-modal-prompt-button-ok")
          );
        }
      })();
      g_mainWindow.webContents.send("update-loading", false);
    } catch (err) {
      exportPageError("");
    }
  } else {
    exportPageError("");
  }
}

function exportPageError(err) {
  console.log(err);
  g_mainWindow.webContents.send("update-loading", false);
  g_mainWindow.webContents.send(
    "show-modal-info",
    "",
    _("ui-modal-info-errorexportingpage"),
    _("ui-modal-prompt-button-ok")
  );
}

///////////////////////////////////////////////////////////////////////////////
// MODIFIERS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showScrollBar(isVisible) {
  g_settings.showScrollBar = isVisible;
  g_mainWindow.webContents.send(
    "set-scrollbar-visibility",
    g_settings.showScrollBar
  );
  menuBar.setScrollBar(isVisible);
}

function toggleScrollBar() {
  showScrollBar(!g_settings.showScrollBar);
  g_mainWindow.webContents.send("update-menubar");
}

function showToolBar(isVisible) {
  g_settings.showToolBar = isVisible;
  g_mainWindow.webContents.send(
    "set-toolbar-visibility",
    g_settings.showToolBar
  );
  menuBar.setToolBar(isVisible);
  renderPageRefresh();
}

function toggleToolBar() {
  showToolBar(!g_settings.showToolBar);
  g_mainWindow.webContents.send("update-menubar");
}

function showPageNumber(isVisible) {
  g_settings.showPageNumber = isVisible;
  g_mainWindow.webContents.send(
    "set-page-number-visibility",
    g_settings.showPageNumber
  );
  menuBar.setPageNumber(isVisible);
}

function togglePageNumber() {
  showPageNumber(!g_settings.showPageNumber);
  g_mainWindow.webContents.send("update-menubar");
}

function showClock(isVisible) {
  g_settings.showClock = isVisible;
  g_mainWindow.webContents.send("set-clock-visibility", g_settings.showClock);
  menuBar.setClock(isVisible);
}

function toggleClock() {
  showClock(!g_settings.showClock);
  g_mainWindow.webContents.send("update-menubar");
}

exports.showAudioPlayer = showAudioPlayer;
function showAudioPlayer(isVisible, updateMenuBar) {
  g_settings.showAudioPlayer = isVisible;
  audioPlayer.show(isVisible);
  menuBar.setAudioPlayer(isVisible);
  if (updateMenuBar) g_mainWindow.webContents.send("update-menubar");
}

function toggleAudioPlayer() {
  showAudioPlayer(!g_settings.showAudioPlayer);
  g_mainWindow.webContents.send("update-menubar");
}

function toggleFullScreen() {
  setFullScreen(!g_mainWindow.isFullScreen());
}

function setFullScreen(value) {
  g_mainWindow.setFullScreen(value);
  if (value) {
    g_mainWindow.webContents.send("set-scrollbar-visibility", false);
    g_mainWindow.webContents.send("set-menubar-visibility", false);
    g_mainWindow.webContents.send("set-toolbar-visibility", false);
    g_mainWindow.webContents.send("set-fullscreen-ui", true);
  } else {
    g_mainWindow.webContents.send(
      "set-scrollbar-visibility",
      g_settings.showScrollBar
    );
    g_mainWindow.webContents.send("set-menubar-visibility", true);
    g_mainWindow.webContents.send(
      "set-toolbar-visibility",
      g_settings.showToolBar
    );
    g_mainWindow.webContents.send("set-fullscreen-ui", false);
  }
}

function toggleDevTools() {
  g_mainWindow.toggleDevTools();
}

function setFitToWidth() {
  g_settings.fit_mode = 0;
  menuBar.setFitToWidth();
  g_mainWindow.webContents.send("update-menubar");
  g_mainWindow.webContents.send("set-fit-to-width");
  renderPageRefresh();
  rebuildMenuBar();
}

function setFitToHeight() {
  g_settings.fit_mode = 1;
  menuBar.setFitToHeight();
  g_mainWindow.webContents.send("update-menubar");
  g_mainWindow.webContents.send("set-fit-to-height");
  renderPageRefresh();
  rebuildMenuBar();
}

let g_scaleToHeightMin = 25;
let g_scaleToHeightMax = 500;

function setScaleToHeight(scale, fromMove = false) {
  g_settings.fit_mode = 2;
  if (scale < g_scaleToHeightMin) scale = g_scaleToHeightMin;
  else if (scale > g_scaleToHeightMax) scale = g_scaleToHeightMax;
  if (fromMove && g_settings.zoom_scale === scale) return;
  g_settings.zoom_scale = scale;
  menuBar.setScaleToHeight(g_settings.zoom_scale);
  g_mainWindow.webContents.send("update-menubar");
  g_mainWindow.webContents.send("set-scale-to-height", g_settings.zoom_scale);
  renderPageRefresh();
  rebuildMenuBar();
}

function processZoomInput(input) {
  if (input !== 0 && g_fileData.state !== FileDataState.LOADED) return;
  if (input > 0) {
    // zoom in
    if (g_settings.fit_mode === 2) {
      // scale mode
      setScaleToHeight(g_settings.zoom_scale + 5, true);
    } else if (g_settings.fit_mode === 1) {
      // height
      setScaleToHeight(100 + 5, true);
    } else if (g_settings.fit_mode === 0) {
      // width
      g_mainWindow.webContents.send("try-zoom-scale-from-width", 5);
    }
  } else if (input < 0) {
    // zoom out
    if (g_settings.fit_mode === 2) {
      setScaleToHeight(g_settings.zoom_scale - 5, true);
    } else if (g_settings.fit_mode === 1) {
      // height
      setScaleToHeight(100 - 5, true);
    } else if (g_settings.fit_mode === 0) {
      // width
      g_mainWindow.webContents.send("try-zoom-scale-from-width", -5);
    }
  } else {
    // 0 = reset
    if (g_settings.fit_mode === 2 || g_settings.fit_mode === 0) {
      //setScaleToHeight(100);
      setFitToHeight();
    }
  }
}

function setPageRotation(value, refreshPage) {
  if (value >= 360) value -= 360;
  else if (value < 0) value += 360;
  g_fileData.pageRotation = value;
  menuBar.setPageRotation(value);
  g_mainWindow.webContents.send("update-menubar");
  if (refreshPage) {
    renderPageRefresh();
  }
}

function setInitialZoom(filePath) {
  if (g_settings.zoomFileLoading === 1) {
    // use history
    let historyIndex = getHistoryIndex(filePath);
    if (historyIndex !== undefined) {
      let fitMode = g_history[historyIndex].fitMode;
      let zoomScale = g_history[historyIndex].zoomScale;
      if (fitMode !== undefined) {
        if (fitMode === 0) {
          setFitToWidth();
          return;
        } else if (fitMode === 1) {
          setFitToHeight();
          return;
        } else if (fitMode === 2 && zoomScale != undefined) {
          setScaleToHeight(zoomScale);
          return;
        }
      }
    }
    // not in history, use default
  }
  // use default
  if (g_settings.zoomDefault === 0) {
    setFitToWidth();
    return;
  } else if (g_settings.zoomDefault === 1) {
    setFitToHeight();
    return;
  }
  // use last used
  if (g_settings.fit_mode === 0) {
    setFitToWidth();
  } else if (g_settings.fit_mode === 1) {
    setFitToHeight();
  } else {
    setScaleToHeight(g_settings.zoom_scale);
  }
}

function updateMenuAndToolbarItems() {
  if (g_fileData.filePath !== "") {
    if (
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.SEVENZIP ||
      g_fileData.type === FileDataType.EPUB_COMIC ||
      g_fileData.type === FileDataType.PDF
    ) {
      menuBar.setComicBookOpened(true);
      g_mainWindow.webContents.send("update-toolbar-rotation-buttons", true);
      g_mainWindow.webContents.send("update-toolbar-page-buttons", true);
      g_mainWindow.webContents.send("update-toolbar-zoom-buttons", true);
    } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      menuBar.setEpubEbookOpened();
      g_mainWindow.webContents.send("update-toolbar-rotation-buttons", false);
      g_mainWindow.webContents.send("update-toolbar-page-buttons", true);
      g_mainWindow.webContents.send("update-toolbar-zoom-buttons", true);
    } else if (g_fileData.type === FileDataType.IMGS_FOLDER) {
      menuBar.setImageOpened();
      g_mainWindow.webContents.send("update-toolbar-rotation-buttons", true);
      g_mainWindow.webContents.send("update-toolbar-page-buttons", true);
      g_mainWindow.webContents.send("update-toolbar-zoom-buttons", true);
    } else if (g_fileData.type === FileDataType.WWW) {
      menuBar.setWWWOpened();
      g_mainWindow.webContents.send("update-toolbar-rotation-buttons", true);
      g_mainWindow.webContents.send("update-toolbar-page-buttons", true);
      g_mainWindow.webContents.send("update-toolbar-zoom-buttons", true);
    } else {
      menuBar.setComicBookOpened(false);
      g_mainWindow.webContents.send("update-toolbar-rotation-buttons", false);
      g_mainWindow.webContents.send("update-toolbar-page-buttons", false);
      g_mainWindow.webContents.send("update-toolbar-zoom-buttons", false);
    }
  }
}

function updateLoadingIndicator() {
  g_mainWindow.webContents.send(
    "update-loading-indicator",
    g_settings.loadingIndicatorBG,
    g_settings.loadingIndicatorIconSize,
    g_settings.loadingIndicatorIconPos
  );
}

function updateLayoutClock() {
  g_mainWindow.webContents.send(
    "update-layout-pos",
    g_settings.layoutClock,
    "#clock-bubble"
  );
}

function updateLayoutPageNum() {
  g_mainWindow.webContents.send(
    "update-layout-pos",
    g_settings.layoutPageNum,
    "#page-number-bubble"
  );
}

function updateLayoutAudioPlayer() {
  g_mainWindow.webContents.send(
    "audio-player",
    "update-layout-pos",
    g_settings.layoutAudioPlayer
  );
}
