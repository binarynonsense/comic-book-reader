const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  dialog,
} = require("electron");

const fs = require("fs");
const path = require("path");
const FileType = require("file-type");
const fileUtils = require("./file-utils");
const i18n = require("./i18n");
const menuBar = require("./menu-bar");
const contextMenu = require("./menu-context");
const convertTool = require("./tools/convert-main");

function isDev() {
  return process.argv[2] == "--dev";
}

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_mainWindow;
let g_resizeEventCounter;
let g_settings = {
  version: app.getVersion(),
  date: "",
  fit_mode: 0, // 0: width, 1: height
  page_mode: 0, // 0: single-page, 1: double-page
  maximize: false,
  width: 800,
  height: 600,
  showMenuBar: true,
  showToolBar: true,
  showScrollBar: true,
  locale: undefined,
};

let g_history = [];
let g_isLoaded = false;

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
  saveSettings();
  saveHistory();
  globalShortcut.unregisterAll();
  fileUtils.cleanUpTempFolder();
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
    //autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    show: false,
  });

  // g_mainWindow.removeMenu();
  // menuBar.buildApplicationMenu();

  // FIX: ugly hack: since I wait to show the window on did-finish-load, if I started it
  // unmaximized the resize controls did nothing until I maximized and unmaximized it... ?? :(
  // so I do it programmatically at the start, hopefully it's not noticeable
  g_mainWindow.maximize();
  g_mainWindow.unmaximize();

  g_mainWindow.loadFile(`${__dirname}/index.html`);

  g_mainWindow.once("ready-to-show", () => {
    g_mainWindow.show();
  });

  g_mainWindow.webContents.on("context-menu", function (e, params) {
    contextMenu.buildContextMenu();
    contextMenu.getContextMenu().popup(g_mainWindow, params.x, params.y);
  });

  g_mainWindow.webContents.on("did-finish-load", function () {
    g_isLoaded = true;

    g_settings = fileUtils.loadSettings(g_settings);
    g_history = fileUtils.loadHistory();

    if (g_settings.locale === undefined) {
      i18n.loadLocale(app.getLocale());
    } else {
      i18n.loadLocale(g_settings.locale);
    }

    rebuildTranslatedTexts(); // this also creates the menu bar

    // if I put the things below inside ready-to-show they aren't called
    renderTitle();

    if (g_settings.fit_mode === 0) {
      setFitToWidth();
    } else {
      setFitToHeight();
    }

    showScrollBar(g_settings.showScrollBar);
    showToolBar(g_settings.showToolBar);

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
        fileUtils.hasCompatibleExtension(filePath)
      ) {
        openFile(filePath, 0);
        return;
      }
    }

    if (g_history.length > 0) {
      let entry = g_history[g_history.length - 1];
      openFile(entry.filePath, entry.pageIndex);
      return;
    }
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
    if (
      //g_fileData.type === FileDataType.PDF &&
      g_fileData.state === FileDataState.LOADED
    ) {
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
// I18N ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function rebuildTranslatedTexts() {
  menuBar.buildApplicationMenu(
    i18n.getLoadedLocale(),
    i18n.getAvailableLocales()
  );
  updateMenuItemsState();

  g_mainWindow.webContents.send("update-menubar");
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

function addCurrentToHistory() {
  let currentFilePath = g_fileData.path;
  let currentPageIndex = g_fileData.pageIndex;
  if (currentFilePath != "") {
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

function saveHistory() {
  addCurrentToHistory();
  fileUtils.saveHistory(g_history, g_fileData.path, g_fileData.pageIndex);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVED ///////////////////////////////////////////////////////////////
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

ipcMain.on("pdf-page-loaded", (event) => {
  g_fileData.state = FileDataState.LOADED;
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

ipcMain.on("mouse-click", (event, arg) => {
  if (arg === true) {
    // left click
    goToNextPage();
  } else {
    // right click
    goToPreviousPage();
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
  openFile(filePath); // it checks if valid path
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

exports.onMenuChangeLanguage = function (locale) {
  if (locale === i18n.getLoadedLocale())
    g_mainWindow.webContents.send("update-menubar");
  else {
    if (i18n.loadLocale(locale, false)) {
      g_settings.locale = locale;
      rebuildTranslatedTexts();
    } else {
      g_mainWindow.webContents.send("update-menubar");
    }
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

exports.onMenuRotateCounterclockwise = onMenuRotateCounterclockwise = function () {
  setPageRotation(g_fileData.pageRotation - 90, true);
};

exports.onMenuToggleScrollBar = function () {
  toggleScrollBar();
};

exports.onMenuToggleToolBar = function () {
  toggleToolBar();
};

exports.onMenuToggleFullScreen = function () {
  toggleFullScreen();
};

exports.onMenuOpenFile = onMenuOpenFile = function () {
  let defaultPath = "";
  if (g_fileData.path !== "") {
    defaultPath = g_fileData.path;
  } else if (g_history.length > 0) {
    defaultPath = g_history[g_history.length - 1].filePath;
  }
  let fileList = fileUtils.chooseOpenFile(g_mainWindow, defaultPath);
  if (fileList === undefined) {
    return;
  }
  let filePath = fileList[0];
  console.log("open file request:" + filePath);
  openFile(filePath);
};

exports.onMenuExportPage = function () {
  exportPageStart();
};

exports.onMenuConvertFile = function () {
  if (g_fileData.path !== undefined) {
    convertTool.showWindow(g_mainWindow, g_fileData.path, g_fileData.type);
  }
  g_mainWindow.webContents.send("update-menubar");
};

exports.onMenuBatchConvert = function () {
  convertTool.showWindow(g_mainWindow);
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
  if (filePath === "" || !fs.existsSync(filePath)) return;

  let fileExtension = path.extname(filePath).toLowerCase();

  (async () => {
    let fileType = await FileType.fromFile(filePath);
    if (fileType !== undefined) {
      // ref: file-type -> https://www.npmjs.com/package/file-type
      // e.g. {ext: 'png', mime: 'image/png'}
      fileExtension = "." + fileType.ext;
    }
    addCurrentToHistory(); // add the one I'm closing to history
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
      // let imgsFolderPath = undefined;
      if (fileExtension === ".rar" || fileExtension === ".cbr") {
        //imgsFolderPath = fileUtils.extractRar(filePath);
        let pagesPaths = fileUtils.getRarEntriesList(filePath);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.RAR;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.imgsFolderPath = "";
          g_fileData.numPages = pagesPaths.length;
          g_fileData.pageIndex = pageIndex;
          updateMenuItemsState();
          setPageRotation(0, false);
          goToPage(pageIndex);
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("File Error"),
            _("Couldn't open the CBR file")
          );
        }
      } else if (fileExtension === ".zip" || fileExtension === ".cbz") {
        //imgsFolderPath = fileUtils.extractZip(filePath);
        let pagesPaths = fileUtils.getZipEntriesList(filePath);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.ZIP;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.imgsFolderPath = "";
          g_fileData.numPages = pagesPaths.length;
          g_fileData.pageIndex = pageIndex;
          updateMenuItemsState();
          setPageRotation(0, false);
          goToPage(pageIndex);
        } else {
          g_mainWindow.webContents.send(
            "show-modal-info",
            _("File Error"),
            _("Couldn't open the CBZ file")
          );
        }
      } else {
        g_mainWindow.webContents.send(
          "show-modal-info",
          _("File Error"),
          _("Not a valid file format")
        );
        return;
      }
      // if (imgsFolderPath === undefined) return;

      // let pagesPaths = fileUtils.getImageFilesInFolderRecursive(imgsFolderPath);
      // if (pagesPaths !== undefined && pagesPaths.length > 0) {
      //   g_fileData.state = FileDataState.LOADED;
      //   g_fileData.type = FileDataType.IMGS;
      //   g_fileData.filePath = filePath;
      //   g_fileData.fileName = path.basename(filePath);
      //   g_fileData.pagesPaths = pagesPaths;
      //   g_fileData.imgsFolderPath = imgsFolderPath;
      //   g_fileData.numPages = pagesPaths.length;
      //   g_fileData.pageIndex = pageIndex;
      //   setPageRotation(0, false);
      //   goToPage(pageIndex);
      // }
    }
  })(); // async
}
exports.openFile = openFile;

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

function renderEpubImg(filePath, imageID) {
  renderTitle();
  g_fileData.state = FileDataState.LOADING;
  g_mainWindow.webContents.send(
    "render-epub-image",
    filePath,
    imageID,
    g_fileData.pageRotation
  );
}

function renderImageFile(filePath) {
  if (!path.isAbsolute(filePath)) {
    // FIXME: make it absolute somehow?
    return;
  }
  renderTitle();
  let data64 = fs.readFileSync(filePath).toString("base64");
  let img64 =
    "data:image/" + fileUtils.getMimeType(filePath) + ";base64," + data64;
  g_mainWindow.webContents.send(
    "render-img-page",
    img64,
    g_fileData.pageRotation
  );
}

function renderZipEntry(zipPath, entryName) {
  renderTitle();
  let data64 = fileUtils
    .extractZipEntryData(zipPath, entryName)
    .toString("base64");
  let img64 =
    "data:image/" + fileUtils.getMimeType(entryName) + ";base64," + data64;
  g_mainWindow.webContents.send(
    "render-img-page",
    img64,
    g_fileData.pageRotation
  );
}

function renderRarEntry(rarPath, entryName) {
  renderTitle();
  let data64 = fileUtils
    .extractRarEntryData(rarPath, entryName)
    .toString("base64");
  let img64 =
    "data:image/" + fileUtils.getMimeType(entryName) + ";base64," + data64;
  g_mainWindow.webContents.send(
    "render-img-page",
    img64,
    g_fileData.pageRotation
  );
}

function renderPdfPage(pageIndex) {
  renderTitle();
  g_fileData.state = FileDataState.LOADING;
  g_mainWindow.webContents.send(
    "render-pdf-page",
    pageIndex,
    g_fileData.pageRotation
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
    var length = 50;
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

function goToPage(pageIndex) {
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    return;
  }
  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) return;
  g_fileData.pageIndex = pageIndex;
  if (g_fileData.type === FileDataType.IMGS) {
    renderImageFile(g_fileData.pagesPaths[g_fileData.pageIndex]);
  } else if (g_fileData.type === FileDataType.PDF) {
    renderPdfPage(g_fileData.pageIndex);
  } else if (g_fileData.type === FileDataType.ZIP) {
    renderZipEntry(
      g_fileData.path,
      g_fileData.pagesPaths[g_fileData.pageIndex]
    );
  } else if (g_fileData.type === FileDataType.RAR) {
    renderRarEntry(
      g_fileData.path,
      g_fileData.pagesPaths[g_fileData.pageIndex]
    );
  } else if (g_fileData.type === FileDataType.EPUB) {
    renderEpubImg(g_fileData.path, g_fileData.pagesPaths[g_fileData.pageIndex]);
  }
  renderPageInfo();
}

function goToNextPage() {
  if (g_fileData.pageIndex + 1 < g_fileData.numPages) {
    goToPage(g_fileData.pageIndex + 1);
  }
}

function goToPreviousPage() {
  if (g_fileData.pageIndex - 1 >= 0) {
    goToPage(g_fileData.pageIndex - 1);
  }
}

///////////////////////////////////////////////////////////////////////////////
// EXPORT /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function exportPageStart() {
  // let defaultPath = path.join(
  //   app.getPath("desktop"),
  //   g_fileData.name + "_page_" + (g_fileData.pageIndex + 1) + ".jpg"
  // );
  // let filePath = fileUtils.chooseSaveFile(g_mainWindow, defaultPath);
  // if (filePath === undefined) {
  //   return;
  // }
  // console.log(filePath);
  let defaultPath = app.getPath("desktop");
  let folderList = fileUtils.chooseFolder(g_mainWindow, defaultPath);
  if (folderList === undefined) {
    return;
  }
  let outputFolderPath = folderList[0];
  //console.log("select folder request:" + folderPath);
  if (outputFolderPath === undefined || outputFolderPath === "") return;

  g_mainWindow.webContents.send("update-loading", true);

  try {
    let buf;
    if (g_fileData.filePath !== "") {
      if (g_fileData.type === FileDataType.ZIP) {
        buf = fileUtils.extractZipEntryData(
          g_fileData.path,
          g_fileData.pagesPaths[g_fileData.pageIndex]
        );
      } else if (g_fileData.type === FileDataType.RAR) {
        buf = fileUtils.extractRarEntryData(
          g_fileData.path,
          g_fileData.pagesPaths[g_fileData.pageIndex]
        );
      } else if (g_fileData.type === FileDataType.EPUB) {
        buf = await fileUtils.extractEpubImageBuffer(
          g_fileData.path,
          g_fileData.pagesPaths[g_fileData.pageIndex]
        );
      } else if (g_fileData.type === FileDataType.PDF) {
        console.log("FileDataType.PDF");
        g_mainWindow.webContents.send(
          "extract-pdf-image-buffer",
          g_fileData.path,
          g_fileData.pageIndex + 1,
          outputFolderPath
        );
        return;
      }

      exportPageSaveBuffer(buf, outputFolderPath);
    }
  } catch (err) {
    exportPageError(err);
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
        //console.log(outputFilePath);

        // fs.writeFileSync(outPath, buf,"binary"... ?
        await new Promise((resolve, reject) =>
          fs.writeFile(outputFilePath, buf, "binary", (err) => {
            if (err === null) {
              resolve();
            } else {
              reject(err);
            }
          })
        );

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
  // if (g_fileData.state === FileDataState.LOADED) {
  // }
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
      menuBar.setConvertFile(true);
      menuBar.setExportPage(true);
    } else {
      menuBar.setConvertFile(false);
      menuBar.setExportPage(false);
    }
  }
}
