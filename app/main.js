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

let mainWindow;
let currentPages = [];
let currentPageIndex = 0;
let currentFolder;
let currentFileName = "";

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  fileUtils.cleanUpTempFolder();
});

app.on("ready", () => {
  mainWindow = new BrowserWindow({
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
  });

  appMenu.AddApplicationMenu();
  //mainWindow.removeMenu();

  mainWindow.maximize();

  mainWindow.loadFile(`${__dirname}/index.html`);

  mainWindow.webContents.on("did-finish-load", function () {
    //openTestCbz();
    //openTestCbr();
  });
});

function openFile() {
  let filePath = fileUtils.chooseFile(mainWindow)[0];
  `${currentPageIndex + 1}/${currentPages.length}`;
  console.log("open file request:" + filePath);
  let fileExtension = path.extname(filePath);
  if (fileExtension === ".cbr") {
    currentFolder = fileUtils.extractRar(filePath);
  } else if (fileExtension === ".cbz") {
    currentFolder = fileUtils.extractZip(filePath);
  } else {
    console.log("not a valid file");
    return;
  }

  currentPages = fileUtils.getImageFilesInFolderRecursive(currentFolder);

  currentFileName = path.basename(filePath);

  if (currentPages !== undefined && currentPages.length > 0) {
    currentPageIndex = 0;
    goToFirstPage();
  }
}
exports.openFile = openFile;

function openTestCbr() {
  let filePath = path.join(app.getPath("desktop"), "testComic2.cbr");
  currentPageIndex = 0;
  currentFolder = fileUtils.extractRar(filePath);
  currentPages = fileUtils.getImageFilesInFolderRecursive(currentFolder);
  if (currentPages !== undefined && currentPages.length > 0) {
    goToFirstPage();
  }
}

function openTestCbz() {
  let filePath = path.join(app.getPath("desktop"), "testComic.cbz");
  currentPageIndex = 0;
  currentFolder = fileUtils.extractZip(filePath);
  currentPages = fileUtils.getImageFilesInFolderRecursive(currentFolder);
  if (currentPages !== undefined && currentPages.length > 0) {
    goToFirstPage();
  }
}

function openTestFolder() {
  currentFolder = path.join(app.getPath("desktop"), "testComic");
  currentPageIndex = 0;
  currentPages = fileUtils.getImageFilesInFolder(currentFolder);
  if (currentPages !== undefined && currentPages.length > 0) {
    goToFirstPage();
  }
}

// Renderer

function openImageFileInRenderer(filePath) {
  if (!path.isAbsolute(filePath)) {
    // FIXME: mae it absolute somehow?
    return;
  }
  // console.log(filePath);
  // console.log(path.extname(filePath));

  let data64 = fs.readFileSync(filePath).toString("base64");
  let img64 = "data:image/jpeg;base64," + data64;
  mainWindow.webContents.send("show-img", img64);
  mainWindow.setTitle(
    `${currentPageIndex + 1}/${currentPages.length} - ${currentFileName}`
  );
}

// Nav / Input / Shortcuts

ipcMain.on("escape-pressed", (event) => {
  if (mainWindow.isFullScreen()) {
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
  if (currentPages.length >= 0) {
    //openImageFileInRenderer(path.join(currentFolder, currentPages[0]));
    openImageFileInRenderer(currentPages[0]);
  }
}

function goToNextPage() {
  if (currentPageIndex + 1 < currentPages.length) {
    currentPageIndex++;
    openImageFileInRenderer(currentPages[currentPageIndex]);
  }
}

function goToPreviousPage() {
  if (currentPageIndex - 1 >= 0) {
    currentPageIndex--;
    openImageFileInRenderer(currentPages[currentPageIndex]);
  }
}

function setFullScreen(value) {
  mainWindow.setFullScreen(value);
  mainWindow.webContents.send("show-menu-bar", !value);
}

function toggleFullScreen() {
  setFullScreen(!mainWindow.isFullScreen());
}
exports.toggleFullScreen = toggleFullScreen;

let isScrollBarVisible = true;
function toggleScrollBar() {
  isScrollBarVisible = !isScrollBarVisible;
  mainWindow.webContents.send("set-scrollbar", isScrollBarVisible);
}
exports.toggleScrollBar = toggleScrollBar;

function toggleDevTools() {
  mainWindow.toggleDevTools();
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

function updateMenu() {
  console.log("updateMEnu");
  //mainWindow.webContents.send("update-menu", appMenu.getMenu());
}
exports.updateMenu = updateMenu;

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
