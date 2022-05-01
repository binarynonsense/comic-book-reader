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
const convertTool = require("./tools/convert-main");
const themes = require("./themes");

function isDev() {
  return process.argv[2] == "--dev";
}

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
  fit_mode: 0, // 0: width, 1: height
  page_mode: 0, // 0: single-page, 1: double-page
  hotspots_mode: 1, // 0: disabled, 1: 2-columns, 2: 3-columns
  maximize: false,
  width: 800,
  height: 600,
  on_quit_state: 0, // 0: no file, 1: reading file

  showMenuBar: true,
  showToolBar: true,
  showScrollBar: true,
  showPageNumber: true,
  showClock: false,

  loadLastOpened: true,
  autoOpen: 0, // 0: disabled, 1: next file, 2: next and previous files

  locale: undefined,
  theme: undefined,
};

function sanitizeSettings() {
  if (
    !Number.isInteger(g_settings.fit_mode) ||
    g_settings.fit_mode < 0 ||
    g_settings.fit_mode > 1
  ) {
    g_settings.fit_mode = 0;
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
}

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

  // FIX: ugly hack: since I wait to show the window on did-finish-load, if I started it
  // unmaximized the resize controls did nothing until I maximized and unmaximized it... ?? :(
  // so I do it programmatically at the start, hopefully it's not noticeable
  g_mainWindow.maximize();
  g_mainWindow.unmaximize();

  g_mainWindow.loadFile(`${__dirname}/index.html`);

  g_mainWindow.once("ready-to-show", () => {
    g_mainWindow.show();
  });

  g_mainWindow.webContents.on("did-finish-load", function () {
    g_isLoaded = true;

    g_settings = fileUtils.loadSettings(g_settings);
    sanitizeSettings();
    g_history = fileUtils.loadHistory();

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

    if (g_settings.fit_mode === 0) {
      setFitToWidth();
    } else {
      setFitToHeight();
    }

    showScrollBar(g_settings.showScrollBar);
    showToolBar(g_settings.showToolBar);
    showPageNumber(g_settings.showPageNumber);
    initClock();
    showClock(g_settings.showClock);

    g_mainWindow.setSize(g_settings.width, g_settings.height);
    g_mainWindow.center();
    if (g_settings.maximize) {
      g_mainWindow.maximize();
    }

    // if program called from os' 'open with' of file association
    // TODO: if mac version implement on open-file event?
    if (process.argv.length >= 2) {
      let filePath = process.argv[1];
      if (
        fs.existsSync(filePath) &&
        !fs.lstatSync(filePath).isDirectory() &&
        fileFormats.hasCompatibleExtension(filePath)
      ) {
        openFile(filePath, 0);
        return;
      }
    }

    if (g_history.length > 0 && g_settings.on_quit_state === 1) {
      let entry = g_history[g_history.length - 1];
      if (
        fs.existsSync(entry.filePath) &&
        !fs.lstatSync(entry.filePath).isDirectory() &&
        fileFormats.hasCompatibleExtension(entry.filePath)
      ) {
        openFile(entry.filePath, entry.pageIndex);
        return;
      }
    }

    g_mainWindow.webContents.send("update-loading", false);
  });

  g_mainWindow.webContents.on("context-menu", function (e, params) {
    contextMenu.buildContextMenu();
    contextMenu.getContextMenu().popup(g_mainWindow, params.x, params.y);
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
    _("Open File..."),
    _("Previous Page"),
    _("Next Page"),
    _("Fit to Width"),
    _("Fit to Height"),
    _("Rotate Counterclockwise"),
    _("Rotate Clockwise"),
    _("Toggle Full Screen")
  );
  g_mainWindow.webContents.send(
    "update-centered-block-text",
    _("To open a file use the menu or press <i>Ctrl+O</i>")
  );
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
  let currentFilePath = g_fileData.path;
  let currentPageIndex = g_fileData.pageIndex;
  if (currentFilePath !== "") {
    let foundIndex = getHistoryIndex(currentFilePath);
    if (foundIndex !== undefined) {
      g_history.splice(foundIndex, 1); // remove, to update and put last
    }
    let newEntry = { filePath: currentFilePath, pageIndex: currentPageIndex };
    g_history.push(newEntry);
    // limit how many are remembered
    if (g_history.length > 10) {
      g_history.splice(0, g_history.length - 10);
    }
  }
  if (updateMenu) rebuildMenuBar();
}

function clearHistory() {
  g_history = [];
  rebuildMenuBar();
}

function getHistoryIndex(filePath) {
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

ipcMain.on("page-loaded", (event, scrollBarPos) => {
  g_fileData.state = FileDataState.LOADED;
  g_mainWindow.webContents.send("update-loading", false);
  g_mainWindow.webContents.send("set-scrollbar-position", scrollBarPos);
  renderPageInfo();
  renderTitle();
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on(
  "epub-loaded",
  (event, loadedCorrectly, filePath, pageIndex, imageIDs) => {
    g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
    g_fileData.type = FileDataType.EPUB;
    g_fileData.path = filePath;
    g_fileData.name = path.basename(filePath);
    g_fileData.imgsFolderPath = "";
    g_fileData.pagesPaths = imageIDs; // not really paths
    g_fileData.numPages = imageIDs.length;
    g_fileData.pageIndex = pageIndex;
    addCurrentToHistory();
    updateMenuItemsState();
    setPageRotation(0, false);
    goToPage(pageIndex);
    renderPageInfo();
    renderTitle();
  }
);

ipcMain.on("epub-load-failed", (event) => {
  g_fileData.state = FileDataState.LOADED;
  g_mainWindow.webContents.send(
    "show-modal-info",
    _("File Error"),
    _("Couldn't open the EPUB file")
  );
});

ipcMain.on("epub-page-loaded", (event) => {
  g_fileData.state = FileDataState.LOADED;
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on(
  "pdf-loaded",
  (event, loadedCorrectly, filePath, pageIndex, numPages) => {
    g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
    // TODO double check loaded is the one loading?
    // TODO change only if correct
    g_fileData.type = FileDataType.PDF;
    g_fileData.path = filePath;
    g_fileData.name = path.basename(filePath);
    g_fileData.imgsFolderPath = "";
    g_fileData.pagesPaths = [];
    g_fileData.numPages = 0;
    g_fileData.pageIndex = pageIndex;
    addCurrentToHistory();
    updateMenuItemsState();
    setPageRotation(0, false);
    g_fileData.numPages = numPages;
    goToPage(pageIndex);
    renderPageInfo();
    renderTitle();
  }
);

ipcMain.on("pdf-load-failed", (event) => {
  g_fileData.state = FileDataState.LOADED;
  g_mainWindow.webContents.send(
    "show-modal-info",
    _("File Error"),
    _("Couldn't open the PDF file")
  );
});

ipcMain.on(
  "pdf-page-buffer-extracted",
  (event, error, buf, outputFolderPath) => {
    if (error !== undefined) {
      exportPageError(error);
    } else {
      exportPageSaveBuffer(buf, outputFolderPath);
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
  goToPage(0);
});

ipcMain.on("end-pressed", (event) => {
  goToPage(g_fileData.numPages - 1);
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
  value -= 1; // from 1 based to 0 based
  if (g_fileData.state === FileDataState.LOADED) {
    if (value !== g_fileData.pageIndex) {
      goToPage(value);
      return;
    }
  }
  renderPageInfo();
});

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("open-file", (event, filePath) => {
  if (
    fs.existsSync(filePath) &&
    !fs.lstatSync(filePath).isDirectory() &&
    fileFormats.hasCompatibleExtension(filePath)
  ) {
    openFile(filePath); // it checks if valid path
  }
});

ipcMain.on("go-to-page", (event, value) => {
  if (!isNaN(value)) {
    pageIndex = value - 1;
    if (pageIndex >= 0 && pageIndex < g_fileData.numPages) {
      goToPage(pageIndex);
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

exports.onMenuRotationValue = function (value) {
  setPageRotation(value, true);
};

exports.onMenuRotateClockwise = onMenuRotateClockwise = function () {
  setPageRotation(g_fileData.pageRotation + 90, true);
};

exports.onMenuRotateCounterclockwise = onMenuRotateCounterclockwise =
  function () {
    setPageRotation(g_fileData.pageRotation - 90, true);
  };

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

exports.onMenuToggleFullScreen = function () {
  toggleFullScreen();
};

exports.onMenuOpenFile = onMenuOpenFile = function (filePath) {
  g_mainWindow.webContents.send("update-menubar");
  if (filePath === undefined) {
    let defaultPath = "";
    if (g_fileData.path !== "") {
      defaultPath = g_fileData.path;
    } else if (g_history.length > 0) {
      defaultPath = g_history[g_history.length - 1].filePath;
    }

    let allowMultipleSelection = false;
    let allowedFileTypesName = "Comic Book Files";
    let allowedFileTypesList = ["cbz", "cbr", "pdf", "epub"];
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
    filePath = fileList[0];
  }
  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    g_mainWindow.webContents.send(
      "show-modal-info",
      _("File Not Found"),
      filePath
    );
    return;
  }
  console.log("open file request:" + filePath);
  openFile(filePath);
};

exports.onMenuClearHistory = function () {
  g_mainWindow.webContents.send("update-menubar");
  clearHistory();
};

exports.onMenuCloseFile = function () {
  addCurrentToHistory(); // add the one I'm closing to history

  g_fileData.state = FileDataState.NOT_SET;
  g_fileData.type = FileDataType.NOT_SET;
  g_fileData.path = "";
  g_fileData.name = "";
  g_fileData.imgsFolderPath = "";
  g_fileData.pagesPaths = [];
  g_fileData.numPages = 0;
  g_fileData.pageIndex = 0;
  g_fileData.pageRotation = 0;

  updateMenuItemsState();
  renderTitle();

  g_mainWindow.webContents.send("file-closed");
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuExportPage = function () {
  exportPageStart();
};

const ToolType = {
  CONVERT: "convert",
  BATCH_CONVERT: "batch_convert",
  CREATE: "create",
};

exports.onMenuConvertFile = function () {
  if (g_fileData.path !== undefined) {
    convertTool.showWindow(
      ToolType.CONVERT,
      g_mainWindow,
      g_fileData.path,
      g_fileData.type
    );
  }
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuBatchConvert = function () {
  convertTool.showWindow(ToolType.BATCH_CONVERT, g_mainWindow);
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuCreateFile = function () {
  convertTool.showWindow(ToolType.CREATE, g_mainWindow);
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
      _("version") +
      ": " +
      app.getVersion() +
      "\n(c) Álvaro García\nwww.binarynonsense.com"
  );
};

exports.onGoToPageDialog = function () {
  g_mainWindow.webContents.send("update-menubar");
  let question = `${_("Page Number")} (1-${g_fileData.numPages}):`;
  g_mainWindow.webContents.send(
    "show-modal-prompt",
    question,
    "" + (g_fileData.pageIndex + 1)
  );
};

exports.onGoToPageFirst = function () {
  g_mainWindow.webContents.send("update-menubar");
  goToPage(0);
};

exports.onGoToPageLast = function () {
  g_mainWindow.webContents.send("update-menubar");
  goToPage(g_fileData.numPages - 1);
};

///////////////////////////////////////////////////////////////////////////////
// FILES //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const FileDataState = {
  NOT_SET: "not set",
  LOADING: "loading",
  LOADED: "loaded",
};

const FileDataType = {
  NOT_SET: "not set",
  PDF: "pdf",
  IMGS: "imgs",
  ZIP: "zip",
  RAR: "rar",
  EPUB: "epub",
};

let g_fileData = {
  state: FileDataState.NOT_SET,
  type: FileDataType.NOT_SET,
  path: "",
  name: "",
  imgsFolderPath: "",
  pagesPaths: [],
  numPages: 0,
  pageIndex: 0,
  pageRotation: 0,
};

function openFile(filePath, pageIndex = 0) {
  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    return;
  }

  g_mainWindow.webContents.send("update-loading", true);

  let fileExtension = path.extname(filePath).toLowerCase();

  (async () => {
    let fileType = await FileType.fromFile(filePath);
    if (fileType !== undefined) {
      // ref: file-type -> https://www.npmjs.com/package/file-type
      // e.g. {ext: 'png', mime: 'image/png'}
      fileExtension = "." + fileType.ext;
    }
    if (g_fileData.path !== "") addCurrentToHistory(); // add the one I'm closing to history
    // if in history: open saved position:
    let historyIndex = getHistoryIndex(filePath);
    if (historyIndex !== undefined) {
      pageIndex = g_history[historyIndex].pageIndex;
      if (pageIndex === undefined) pageIndex = 0; // just in case
    }

    if (fileExtension === ".pdf") {
      g_fileData.state = FileDataState.LOADING;
      g_mainWindow.webContents.send("load-pdf", filePath, pageIndex);
    } else if (fileExtension === ".epub") {
      g_fileData.state = FileDataState.LOADING;
      g_mainWindow.webContents.send("load-epub", filePath, pageIndex);
    } else {
      if (fileExtension === ".rar" || fileExtension === ".cbr") {
        let pagesPaths = fileFormats.getRarEntriesList(filePath);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.RAR;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.imgsFolderPath = "";
          g_fileData.numPages = pagesPaths.length;
          g_fileData.pageIndex = pageIndex;
          addCurrentToHistory();
          updateMenuItemsState();
          setPageRotation(0, false);
          goToPage(pageIndex);
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("File Error"),
            _("Couldn't open the CBR file")
          );
          g_mainWindow.webContents.send("update-loading", false);
        }
      } else if (fileExtension === ".zip" || fileExtension === ".cbz") {
        let pagesPaths = fileFormats.getZipEntriesList(filePath);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.ZIP;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.imgsFolderPath = "";
          g_fileData.numPages = pagesPaths.length;
          g_fileData.pageIndex = pageIndex;
          addCurrentToHistory();
          updateMenuItemsState();
          setPageRotation(0, false);
          goToPage(pageIndex);
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("File Error"),
            _("Couldn't open the CBZ file")
          );
          g_mainWindow.webContents.send("update-loading", false);
        }
      } else {
        g_mainWindow.webContents.send(
          "show-modal-info",
          _("File Error"),
          _("Not a valid file format")
        );
        g_mainWindow.webContents.send("update-loading", false);
        return;
      }
    }
  })(); // async
}
exports.openFile = openFile;

function tryOpeningAdjacentFile(next) {
  // next true -> try next, next false -> try prev
  const fileName = path.basename(g_fileData.path);
  const folderPath = path.dirname(g_fileData.path);
  let allFiles = fs.readdirSync(folderPath);
  let comicFiles = [];
  allFiles.forEach((file) => {
    if (fileFormats.hasCompatibleExtension(file)) {
      comicFiles.push(file);
    }
  });
  // comicFiles.sort(function (a, b) {
  //   return naturalCompare(a.toLowerCase(), b.toLowerCase());
  // });
  comicFiles.sort(function (a, b) {
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
  for (let index = 0; index < comicFiles.length; index++) {
    if (comicFiles[index] === fileName) {
      if (next) {
        if (index < comicFiles.length - 1) {
          let nextFileName = path.join(folderPath, comicFiles[index + 1]);
          openFile(nextFileName);
          return;
        }
      } else {
        if (index > 0) {
          let prevFileName = path.join(folderPath, comicFiles[index - 1]);
          openFile(prevFileName);
          return;
        }
      }
      break;
    }
  }
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
  g_mainWindow.webContents.send(
    "render-page-info",
    g_fileData.pageIndex,
    g_fileData.numPages
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
      g_fileData.type === FileDataType.ZIP
    ) {
      g_mainWindow.webContents.send(
        "refresh-img-page",
        g_fileData.pageRotation
      );
    } else if (g_fileData.type === FileDataType.EPUB) {
      g_mainWindow.webContents.send(
        "refresh-epub-image",
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
  updateMenuItemsState();
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
  // 0 top - 1 bottom
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    return;
  }

  g_mainWindow.webContents.send("update-loading", true);

  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) return;
  g_fileData.pageIndex = pageIndex;

  if (
    g_fileData.type === FileDataType.ZIP ||
    g_fileData.type === FileDataType.RAR ||
    g_fileData.type === FileDataType.EPUB
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
          console.log(message[1]);
          return;
        }
      });
    }
    g_workerPage.send([
      g_fileData.type,
      g_fileData.path,
      g_fileData.pagesPaths[g_fileData.pageIndex],
      scrollBarPos,
    ]);
  } else if (g_fileData.type === FileDataType.PDF) {
    g_fileData.state = FileDataState.LOADING;
    g_mainWindow.webContents.send(
      "render-pdf-page",
      g_fileData.pageIndex,
      g_fileData.pageRotation,
      scrollBarPos
    );
  } // else if (g_fileData.type === FileDataType.IMGS) {
  //   renderImageFile(g_fileData.pagesPaths[g_fileData.pageIndex]);
  // }
}

function goToNextPage() {
  if (g_fileData.pageIndex + 1 < g_fileData.numPages) {
    goToPage(g_fileData.pageIndex + 1);
  } else if (g_settings.autoOpen === 1 || g_settings.autoOpen === 2) {
    tryOpeningAdjacentFile(true);
  }
}

function goToPreviousPage() {
  if (g_fileData.pageIndex - 1 >= 0) {
    goToPage(g_fileData.pageIndex - 1, 1);
  } else if (g_settings.autoOpen === 2) {
    tryOpeningAdjacentFile(false);
  }
}

///////////////////////////////////////////////////////////////////////////////
// EXPORT /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function exportPageStart() {
  let defaultPath = app.getPath("desktop");
  let folderList = fileUtils.chooseFolder(g_mainWindow, defaultPath);
  if (folderList === undefined) {
    return;
  }
  let outputFolderPath = folderList[0];
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
        outputFolderPath
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
          if (message[0] === true) {
            g_mainWindow.webContents.send("update-loading", false);
            g_mainWindow.webContents.send(
              "show-modal-info",
              "",
              _("Image file saved to:") +
                "\n" +
                fileUtils.reducePathString(message[1], 85)
            );
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
      });
    }
  } catch (err) {
    exportPageError(err);
  }
}

function exportPageSaveBuffer(buf, outputFolderPath) {
  if (buf !== undefined) {
    try {
      (async () => {
        let fileType = await FileType.fromBuffer(buf);
        let fileExtension = ".jpg";
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

        g_mainWindow.webContents.send(
          "show-modal-info",
          "",
          _("Image file saved to:") +
            "\n" +
            fileUtils.reducePathString(outputFilePath, 85)
        );
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
    _("Error: Couldn't export the page")
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
}

function showToolBar(isVisible) {
  g_settings.showToolBar = isVisible;
  g_mainWindow.webContents.send(
    "set-toolbar-visibility",
    g_settings.showToolBar
  );
  menuBar.setToolBar(isVisible);
}

function toggleToolBar() {
  showToolBar(!g_settings.showToolBar);
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
}

function showClock(isVisible) {
  g_settings.showClock = isVisible;
  g_mainWindow.webContents.send("set-clock-visibility", g_settings.showClock);
  menuBar.setClock(isVisible);
}

function toggleClock() {
  showClock(!g_settings.showClock);
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
}

function setFitToHeight() {
  g_settings.fit_mode = 1;
  menuBar.setFitToHeight();
  g_mainWindow.webContents.send("update-menubar");
  g_mainWindow.webContents.send("set-fit-to-height");
  renderPageRefresh();
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

function updateMenuItemsState() {
  if (g_fileData.filePath !== "") {
    if (
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.EPUB ||
      g_fileData.type === FileDataType.PDF
    ) {
      menuBar.setCloseFile(true);
      menuBar.setConvertFile(true);
      menuBar.setExportPage(true);
    } else {
      menuBar.setCloseFile(false);
      menuBar.setConvertFile(false);
      menuBar.setExportPage(false);
    }
  }
}
