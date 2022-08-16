const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mainProcess = require("../../main");

let g_window;
let g_ipcChannel = "tool-dcm--";

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
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
      _("tool-dcm-title"),
      _("tool-dcm-select-publisher-text"),
      _("tool-dcm-select-title-text"),
      _("tool-dcm-select-comic-text"),
      getLocalization()
    );
    g_window.webContents.send(g_ipcChannel + "init");
  });
};

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "open", (event, comicData) => {
  mainProcess.openWWWComicBook(comicData, async (pageNum) => {
    //////////////
    const axios = require("axios").default;
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    try {
      const response = await axios.get(
        `https://digitalcomicmuseum.com/preview/index.php?did=${comicData.comicId}&page=${pageNum}`,
        { timeout: 5000 }
      );
      const dom = new JSDOM(response.data);
      let images = dom.window.document.getElementsByTagName("img");

      let imageUrl;
      for (let i = 0; i < images.length; i++) {
        if (images[i].alt === "Comic Page") {
          imageUrl = images[i].src;
          continue;
        }
      }
      return imageUrl;
    } catch (error) {
      // console.error(error);
      return undefined;
    }
    //////////////
  });
  g_window.close();
});

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "tab-1-text",
      text: _("tool-dcm-tab-1-text").toUpperCase(),
    },
    {
      id: "tab-2-text",
      text: _("tool-dcm-tab-2-text").toUpperCase(),
    },
    {
      id: "tab-3-text",
      text: _("tool-dcm-tab-3-text").toUpperCase(),
    },
    {
      id: "publishers-text",
      text: _("tool-dcm-publishers-text"),
    },
    {
      id: "titles-text",
      text: _("tool-dcm-titles-text"),
    },
    {
      id: "comics-text",
      text: _("tool-dcm-comics-text"),
    },
    {
      id: "button-open-selected-acbr",
      text: _("tool-dcm-button-open-selected-acbr").toUpperCase(),
    },
    {
      id: "button-open-selected-browser",
      text: _("tool-dcm-button-open-selected-browser").toUpperCase(),
    },
    {
      id: "dcm-url-text",
      text: _("tool-dcm-dcm-url-text"),
    },
    {
      id: "button-open-input-url-acbr",
      text: _("tool-dcm-button-open-input-url-acbr").toUpperCase(),
    },
    {
      id: "button-open-input-url-browser",
      text: _("tool-dcm-button-open-input-url-browser").toUpperCase(),
    },
    {
      id: "about-text-1",
      text: _("tool-dcm-about-text-1"),
    },
    {
      id: "about-text-2",
      text: _("tool-dcm-about-text-2"),
    },
    {
      id: "about-text-3",
      text: _("tool-dcm-about-text-3"),
    },
    {
      id: "button-open-dcm-browser",
      text: _("tool-dcm-button-open-dcm-browser").toUpperCase(),
    },
    {
      id: "button-open-donate-browser",
      text: _("tool-dcm-button-open-donate-browser").toUpperCase(),
    },
  ];
}
