const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mainProcess = require("../../main");

let g_window;
let g_parentWindow;
const g_ipcChannel = "tool-wik--";

const g_queryPageSize = 50;

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
  g_parentWindow = parentWindow;
  let [width, height] = parentWindow.getSize();
  height = (90 * height) / 100;
  if (height < 700) height = 700;
  width = 1024;

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

  // if (isDev()) g_window.toggleDevTools();

  g_window.on("closed", () => {
    g_window = undefined;
  });

  g_window.webContents.on("did-finish-load", function () {
    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("tool-wik-title"),
      _("tool-shared-ui-search-placeholder"),
      getLocalization()
    );
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-searching").toUpperCase()
    );

    g_window.webContents.send(g_ipcChannel + "init");
  });
};

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "search", (event, text, languageId) => {
  (async () => {
    try {
      const axios = require("axios").default;
      let word = encodeURI(text.trim().split(" ")[0]);
      const response = await axios.get(
        `https://${languageId}.wiktionary.org/w/api.php?titles=${word}&action=query&prop=extracts&format=json`,
        { timeout: 10000 }
      );
      let searchResults = response.data;
      let content = Object.values(searchResults.query.pages)[0].extract;
      if (!content || content === "") throw "error";
      content = `<div>${content}</div>`;
      g_window.webContents.send(g_ipcChannel + "update-results", content);
    } catch (error) {
      content = `<div>${_("tool-shared-ui-search-nothing-found")}</div>`;
      g_window.webContents.send(g_ipcChannel + "update-results", content);
    }
  })(); // async
});

///////////////////////////////////////////////////////////////////////////////

function reduceString(input) {
  if (!input) return undefined;
  var length = 80;
  input = input.length > length ? input.substring(0, length) + "..." : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "text-tab-1",
      text: _("tool-shared-tab-search").toUpperCase(),
    },
    {
      id: "text-tab-2",
      text: _("tool-shared-tab-about").toUpperCase(),
    },
    {
      id: "button-search",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },

    {
      id: "text-about-1",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-dictionaryterms"),
        "Wiktionary"
      ),
    },
    {
      id: "text-about-2",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "text-about-3",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "button-open-wik-browser",
      text: _("tool-wik-button-open-wik-browser").toUpperCase(),
    },
    {
      id: "button-open-donate-browser",
      text: _("tool-iab-button-open-donate-browser").toUpperCase(),
    },
  ];
}
