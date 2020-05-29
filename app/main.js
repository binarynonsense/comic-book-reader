const {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Menu,
  ipcMain,
} = require("electron");

const fs = require("fs");
const path = require("path");
const fileUtils = require("./file-utils");
const appMenu = require("./app-menu");

// Setup ///////////////////////////////////

let g_mainWindow;
let g_resizeEventCounter;

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  fileUtils.cleanUpTempFolder();
});

app.on("ready", () => {
  g_mainWindow = new BrowserWindow({
    width: 500,
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

  appMenu.AddApplicationMenu();
  //mainWindow.removeMenu();
  g_mainWindow.maximize();
  g_mainWindow.loadFile(`${__dirname}/index.html`);

  g_mainWindow.webContents.on("did-finish-load", function () {
    //openTestCbz();
  });

  g_mainWindow.once("ready-to-show", () => {
    g_mainWindow.show();
  });

  g_mainWindow.on("resize", function () {
    let title = generateTitle();
    g_mainWindow.setTitle(title);
    g_mainWindow.webContents.send("update-title", title);
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

// Files ///////////////////////////////////////

const FileDataState = {
  NOT_SET: "not set",
  LOADING: "loading",
  LOADED: "loaded",
};

const FileDataType = {
  NOT_SET: "not set",
  PDF: "pdf",
  IMGS: "imgs",
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
    updateTitle();
  } else {
    let imgsFolderPath = undefined;
    if (fileExtension === ".cbr") {
      imgsFolderPath = fileUtils.extractRar(filePath);
    } else if (fileExtension === ".cbz") {
      imgsFolderPath = fileUtils.extractZip(filePath);
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
      console.log("file data loaded: " + g_fileData);
      goToFirstPage();
    }
  }
}
exports.openFile = openFile;

// Renderer

function generateTitle() {
  let title = "---";
  if (
    g_fileData.state === FileDataState.NOT_SET ||
    g_mainWindow.getSize()[0] <= 800
  ) {
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
  // `${currentPageIndex + 1}/${
  //   currentPages.length
  // } - ${currentFileName}`;
  return title;
}

function updateTitle() {
  let title = generateTitle();
  g_mainWindow.setTitle(title);
  g_mainWindow.webContents.send("update-title", title);
}

function renderImageFile(filePath) {
  if (!path.isAbsolute(filePath)) {
    // FIXME: mae it absolute somehow?
    return;
  }

  updateTitle();
  let data64 = fs.readFileSync(filePath).toString("base64");
  let img64 = "data:image/jpeg;base64," + data64;
  g_mainWindow.webContents.send("render-img", img64);
}

function renderPdfPage(pageNum) {
  updateTitle();
  g_mainWindow.webContents.send("render-pdf-page", pageNum + 1); // pdf.j counts from 1
}

ipcMain.on("pdf-loaded", (event, loadedCorrectly, filePath, numPages) => {
  g_fileData.state = FileDataState.LOADED;
  // TODO double check loaded on is the one loading?
  // g_fileData.filePath = filePath;
  // g_fileData.fileName = path.basename(filePath);
  // g_fileData.imgsFolderPath = "";
  // g_fileData.pagesPaths = [];
  g_fileData.numPages = numPages;
  // g_fileData.currentPageIndex = 0;
});

// Nav / Input / Shortcuts

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

function goToFirstPage() {
  if (g_fileData.pagesPaths.length > 0) {
    renderImageFile(g_fileData.pagesPaths[0]);
  }
}

function goToNextPage() {
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    return;
  }
  console;
  if (g_fileData.currentPageIndex + 1 < g_fileData.numPages) {
    g_fileData.currentPageIndex++;
    if (g_fileData.type === FileDataType.IMGS) {
      renderImageFile(g_fileData.pagesPaths[g_fileData.currentPageIndex]);
    } else {
      renderPdfPage(g_fileData.currentPageIndex);
    }
  }
}

function goToPreviousPage() {
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    return;
  }

  if (g_fileData.currentPageIndex - 1 >= 0) {
    g_fileData.currentPageIndex--;
    if (g_fileData.type === FileDataType.IMGS) {
      renderImageFile(g_fileData.pagesPaths[g_fileData.currentPageIndex]);
    } else {
      renderPdfPage(g_fileData.currentPageIndex);
    }
  }
}

function setFullScreen(value) {
  g_mainWindow.setFullScreen(value);
  g_mainWindow.webContents.send("show-menu-bar", !value);
}

function toggleFullScreen() {
  setFullScreen(!g_mainWindow.isFullScreen());
}
exports.toggleFullScreen = toggleFullScreen;

let isScrollBarVisible = true;
function toggleScrollBar() {
  isScrollBarVisible = !isScrollBarVisible;
  g_mainWindow.webContents.send("set-scrollbar", isScrollBarVisible);
}
exports.toggleScrollBar = toggleScrollBar;

function toggleDevTools() {
  g_mainWindow.toggleDevTools();
}
exports.toggleDevTools = toggleDevTools;

function setFitToWidth() {}
exports.setFitToWidth = setFitToWidth;

function setFitToHeight() {}
exports.setFitToHeight = setFitToHeight;

function setSinglePage() {}
exports.setSinglePage = setSinglePage;

function setDoublePage() {}
exports.setDoublePage = setDoublePage;

// function updateMenu() {
//   mainWindow.webContents.send("update-menu", appMenu.getMenu());
// }
// exports.updateMenu = updateMenu;

// let shortcut = "PageDown";
// const ret = globalShortcut.register(shortcut, () => {
//   console.log("page down");
// });

// if (!ret) {
//   console.log("error adding global shortcut");
// } else {
//   console.log("global shortcut added: " + shortcut);
// }

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
