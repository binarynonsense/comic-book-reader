const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const fileUtils = require("./file-utils");
const appMenu = require("./app-menu");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_mainWindow;
let g_resizeEventCounter;
let g_settings = {
  fit_mode: 0, // 0: width, 1: height
  page_mode: 0, // 0: single-page, 1: double-page
  isMaximized: false,
  showMenuBar: true,
  showToolBar: true,
  showScrollBar: true,
  lastFilePath: "",
  lastPageIndex: -1,
};

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  fileUtils.cleanUpTempFolder();
});

app.on("ready", () => {
  g_mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 250,
    minHeight: 200,
    resizable: true,
    frame: false,
    icon: path.join(__dirname, "assets/images/icon_256x256.png"),
    //autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
    },
    show: false,
  });

  appMenu.buildApplicationMenu();
  //mainWindow.removeMenu();
  //g_mainWindow.maximize();
  g_mainWindow.loadFile(`${__dirname}/index.html`);

  g_mainWindow.once("ready-to-show", () => {
    g_mainWindow.show();
  });

  g_mainWindow.webContents.on("did-finish-load", function () {
    // if I put the things below inside ready-to-show they aren't called
    renderTitle();
    renderPageInfo();
    if (g_settings.fit_mode === 0) {
      setFitToWidth();
    } else {
      setFitToHeight();
    }
    showScrollBar(g_settings.showScrollBar);
  });

  g_mainWindow.on("resize", function () {
    renderTitle();
    if (
      g_fileData.type === FileDataType.PDF &&
      g_fileData.state === FileDataState.LOADED
    ) {
      // avoid too much pdf resizing
      clearTimeout(g_resizeEventCounter);
      g_resizeEventCounter = setTimeout(onResizeEventFinished, 500);
    }
  });
});

function onResizeEventFinished() {
  g_mainWindow.webContents.send("refresh-pdf-page");
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
// IPC RECEIVED ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

ipcMain.on("pdf-loaded", (event, loadedCorrectly, filePath, numPages) => {
  g_fileData.state = FileDataState.LOADED;
  // TODO double check loaded on is the one loading?
  g_fileData.numPages = numPages;
  renderPageInfo();
});

ipcMain.on("escape-pressed", (event) => {
  if (g_mainWindow.isFullScreen()) {
    setFullScreen(false);
  }
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

ipcMain.on("toolbar-button-clicked", (event, name) => {
  switch (name) {
    case "toolbar-button-next":
      goToNextPage();
      break;
    case "toolbar-button-prev":
      goToPreviousPage();
      break;
    case "toolbar-button-fit-width":
      setFitToWidth();
      break;
    case "toolbar-button-fit-height":
      setFitToHeight();
      break;
    case "toolbar-button-fullscreen":
      toggleFullScreen();
      break;
  }
});

ipcMain.on("toolbar-slider-changed", (event, value) => {
  value -= 1; // from 1 based to 0 based
  if (g_fileData.state === FileDataState.LOADED) {
    if (value !== g_fileData.currentPageIndex) {
      goToPage(value);
      return;
    }
  }
  renderPageInfo();
});

///////////////////////////////////////////////////////////////////////////////
// MENU MSGS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function onMenuFitToWidth() {
  setFitToWidth();
}
exports.onMenuFitToWidth = onMenuFitToWidth;

function onMenuFitToHeight() {
  setFitToHeight();
}
exports.onMenuFitToHeight = onMenuFitToHeight;

function onMenuToggleScrollBar() {
  toggleScrollBar();
}
exports.onMenuToggleScrollBar = onMenuToggleScrollBar;

function onMenuToggleFullScreen() {
  toggleFullScreen();
}
exports.onMenuToggleFullScreen = onMenuToggleFullScreen;

function onMenuToggleDevTools() {
  toggleDevTools();
}
exports.onMenuToggleDevTools = onMenuToggleDevTools;

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
};

let g_fileData = {
  state: FileDataState.NOT_SET,
  type: FileDataType.NOT_SET,
  filePath: "",
  fileName: "",
  imgsFolderPath: "",
  pagesPaths: [],
  numPages: 0,
  currentPageIndex: 0,
};

function openFile() {
  let filePath = fileUtils.chooseFile(g_mainWindow)[0];
  //`${currentPageIndex + 1}/${currentPages.length}`;
  console.log("open file request:" + filePath);

  let fileExtension = path.extname(filePath);
  if (fileExtension === ".pdf") {
    g_fileData.state = FileDataState.LOADING;
    g_fileData.type = FileDataType.PDF;
    g_fileData.filePath = filePath;
    g_fileData.fileName = path.basename(filePath);
    g_fileData.imgsFolderPath = "";
    g_fileData.pagesPaths = [];
    g_fileData.numPages = 0;
    g_fileData.currentPageIndex = 0;
    g_mainWindow.webContents.send("load-pdf", filePath);
    renderTitle();
  } else {
    let imgsFolderPath = undefined;
    if (fileExtension === ".cbr") {
      //imgsFolderPath = fileUtils.extractRar(filePath);
      let pagesPaths = fileUtils.getRarEntriesList(filePath);
      if (pagesPaths !== undefined && pagesPaths.length > 0) {
        g_fileData.state = FileDataState.LOADED;
        g_fileData.type = FileDataType.RAR;
        g_fileData.filePath = filePath;
        g_fileData.fileName = path.basename(filePath);
        g_fileData.pagesPaths = pagesPaths;
        g_fileData.imgsFolderPath = "";
        g_fileData.numPages = pagesPaths.length;
        g_fileData.currentPageIndex = 0;
        goToFirstPage();
      }
    } else if (fileExtension === ".cbz") {
      //imgsFolderPath = fileUtils.extractZip(filePath);
      let pagesPaths = fileUtils.getZipEntriesList(filePath);
      if (pagesPaths !== undefined && pagesPaths.length > 0) {
        g_fileData.state = FileDataState.LOADED;
        g_fileData.type = FileDataType.ZIP;
        g_fileData.filePath = filePath;
        g_fileData.fileName = path.basename(filePath);
        g_fileData.pagesPaths = pagesPaths;
        g_fileData.imgsFolderPath = "";
        g_fileData.numPages = pagesPaths.length;
        g_fileData.currentPageIndex = 0;
        goToFirstPage();
      }
      return;
    } else {
      console.log("not a valid file");
      return;
    }
    if (imgsFolderPath === undefined) return;

    let pagesPaths = fileUtils.getImageFilesInFolderRecursive(imgsFolderPath);
    if (pagesPaths !== undefined && pagesPaths.length > 0) {
      g_fileData.state = FileDataState.LOADED;
      g_fileData.type = FileDataType.IMGS;
      g_fileData.filePath = filePath;
      g_fileData.fileName = path.basename(filePath);
      g_fileData.pagesPaths = pagesPaths;
      g_fileData.imgsFolderPath = imgsFolderPath;
      g_fileData.numPages = pagesPaths.length;
      g_fileData.currentPageIndex = 0;
      goToFirstPage();
    }
  }
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

function renderPageInfo(pageNum, numPages) {
  g_mainWindow.webContents.send(
    "render-page-info",
    g_fileData.currentPageIndex,
    g_fileData.numPages
  );
}

function renderImageFile(filePath) {
  if (!path.isAbsolute(filePath)) {
    // FIXME: mae it absolute somehow?
    return;
  }
  renderTitle();
  let data64 = fs.readFileSync(filePath).toString("base64");
  let img64 =
    "data:image/" + fileUtils.getMimeType(filePath) + ";base64," + data64;
  g_mainWindow.webContents.send("render-img", img64, 0);
}

function renderZipEntry(zipPath, entryName) {
  renderTitle();
  let data64 = fileUtils
    .extractZipEntryData(zipPath, entryName)
    .toString("base64");
  let img64 =
    "data:image/" + fileUtils.getMimeType(entryName) + ";base64," + data64;
  g_mainWindow.webContents.send("render-img", img64, 0);
}

function renderRarEntry(rarPath, entryName) {
  renderTitle();
  let data64 = fileUtils
    .extractRarEntryData(rarPath, entryName)
    .toString("base64");
  let img64 =
    "data:image/" + fileUtils.getMimeType(entryName) + ";base64," + data64;
  g_mainWindow.webContents.send("render-img", img64, 0);
}

function renderPdfPage(pageNum) {
  renderTitle();
  g_mainWindow.webContents.send("render-pdf-page", pageNum + 1); // pdf.j counts from 1
}

/////////////////////////////////////////////////

function generateTitle() {
  let title = "---";
  if (g_fileData.state === FileDataState.NOT_SET) {
    title = "Comic Book Reader - ACBR";
  } else if (g_mainWindow.getSize()[0] <= 800) {
    title = "ACBR";
  } else {
    title = `${g_fileData.fileName}`;
    var length = 50;
    title =
      title.length > length
        ? title.substring(0, length - 3) + "..."
        : title.substring(0, length);
    title += " - ACBR";
  }
  return title;
}

///////////////////////////////////////////////////////////////////////////////
// PAGE NAVIGATION ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function goToPage(pageNum) {
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    return;
  }
  if (pageNum < 0 || pageNum >= g_fileData.numPages) return;
  g_fileData.currentPageIndex = pageNum;
  if (g_fileData.type === FileDataType.IMGS) {
    renderImageFile(g_fileData.pagesPaths[g_fileData.currentPageIndex]);
  } else if (g_fileData.type === FileDataType.PDF) {
    renderPdfPage(g_fileData.currentPageIndex);
  } else if (g_fileData.type === FileDataType.ZIP) {
    renderZipEntry(
      g_fileData.filePath,
      g_fileData.pagesPaths[g_fileData.currentPageIndex]
    );
  } else if (g_fileData.type === FileDataType.RAR) {
    renderRarEntry(
      g_fileData.filePath,
      g_fileData.pagesPaths[g_fileData.currentPageIndex]
    );
  }
  renderPageInfo();
}

function goToFirstPage() {
  goToPage(0);
}

function goToNextPage() {
  if (g_fileData.currentPageIndex + 1 < g_fileData.numPages) {
    g_fileData.currentPageIndex++;
    goToPage(g_fileData.currentPageIndex);
  }
}

function goToPreviousPage() {
  if (g_fileData.currentPageIndex - 1 >= 0) {
    g_fileData.currentPageIndex--;
    goToPage(g_fileData.currentPageIndex);
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
}

function toggleScrollBar() {
  showScrollBar(!g_settings.showScrollBar);
}

function toggleFullScreen() {
  setFullScreen(!g_mainWindow.isFullScreen());
}

function setFullScreen(value) {
  g_mainWindow.setFullScreen(value);
  g_mainWindow.webContents.send("set-menubar-visibility", !value);
}

function toggleDevTools() {
  g_mainWindow.toggleDevTools();
}

function setFitToWidth() {
  appMenu.setFitToWidth();
  g_mainWindow.webContents.send("set-fit-to-width");
}

function setFitToHeight() {
  appMenu.setFitToHeight();
  g_mainWindow.webContents.send("set-fit-to-height");
}

function setSinglePage() {}

function setDoublePage() {}

///////////////////////////////////////////////////////////////////////////////
// GLOBAL SHORTCUTS ///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// let shortcut = "PageDown";
// const ret = globalShortcut.register(shortcut, () => {
//   console.log("page down");
// });

// if (!ret) {
//   console.log("error adding global shortcut");
// } else {
//   console.log("global shortcut added: " + shortcut);
// }
