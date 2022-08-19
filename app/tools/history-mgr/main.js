const { BrowserWindow, ipcMain } = require("electron");

const path = require("path");
const mainProcess = require("../../main");

let g_window, g_parentWindow;
let g_ipcChannel = "mgr-hist--";

let g_history;

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow, history) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
  let [width, height] = parentWindow.getSize();
  height = (90 * height) / 100;
  if (height < 700) height = 700;
  width = 1024;

  g_parentWindow = parentWindow;
  g_history = history;

  g_window = new BrowserWindow({
    width: parseInt(width),
    height: parseInt(height),
    icon: path.join(__dirname, "../../assets/images/icon_256x256.png"),
    resizable: true,
    backgroundColor: "white",
    parent: parentWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  g_window.menuBarVisible = false;
  g_window.loadFile(`${__dirname}/index.html`);

  g_window.on("closed", () => {
    g_window = undefined;
  });

  g_window.on("minimize", () => {
    g_parentWindow.minimize();
  });

  g_window.webContents.on("did-finish-load", function () {
    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("mgr-hist-title"),
      getLocalization(),
      getTooltipsLocalization()
    );
    g_window.webContents.send(g_ipcChannel + "build-list", g_history);
  });

  // if (isDev()) g_window.toggleDevTools();
};

///////////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "remove-all", (event, itemIndex) => {
  g_history = [];
  mainProcess.onReplaceHistory(g_history);
  g_window.webContents.send(g_ipcChannel + "build-list", g_history);
});

ipcMain.on(g_ipcChannel + "remove-item", (event, itemIndex) => {
  g_history.splice(itemIndex, 1);
  mainProcess.onReplaceHistory(g_history);
  g_window.webContents.send(g_ipcChannel + "build-list", g_history);
});

ipcMain.on(g_ipcChannel + "open-item", (event, itemIndex) => {
  mainProcess.onMenuOpenFile(g_history[itemIndex]);
  g_window.close();
});

///////////////////////////////////////////////////////////////////////////////

function getTooltipsLocalization() {
  return [
    {
      id: "tooltip-remove-from-list",
      text: _("mgr-hist-tooltip-remove-from-list"),
    },
    {
      id: "tooltip-open-from-list",
      text: _("mgr-hist-tooltip-open-from-list"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "button-clear-all",
      text: _("mgr-hist-button-clear-all").toUpperCase(),
    },
  ];
}
