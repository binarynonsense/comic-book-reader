const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mainProcess = require("../../main");

let g_window;
const g_ipcChannel = "tool-xkcd--";

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow) {
  if (g_window !== undefined) return;
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
      _("tool-xkcd-title"),
      _("tool-xkcd-select-catalog-number-default"),
      getLocalization()
    );

    g_window.webContents.send(g_ipcChannel + "init");
  });
};

exports.getPageCallback = async function getPageCallback(pageNum, fileData) {
  try {
    const axios = require("axios").default;
    const response = await axios.get(
      `https://xkcd.com/${pageNum}/info.0.json`,
      {
        timeout: 10000,
      }
    );
    const imageUrl = response?.data?.img;
    return {
      pageImgSrc: imageUrl,
      pageImgUrl: imageUrl,
      tempData: { title: response?.data?.alt },
    };
  } catch (error) {
    // console.error(error);
    return undefined;
  }
};

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "open", (event, comicData, pageNum) => {
  mainProcess.openBookFromCallback(
    comicData,
    this.getPageCallback,
    pageNum - 1
  );
  g_window.close();
});

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "text-tab-1",
      text: _("tool-shared-tab-catalog").toUpperCase(),
    },
    {
      id: "text-tab-2",
      text: _("tool-shared-tab-about").toUpperCase(),
    },

    {
      id: "text-catalog-number",
      text: _("tool-xkcd-text-catalog-number"),
    },
    {
      id: "button-catalog-open-acbr",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "button-catalog-open-browser",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },

    {
      id: "text-about-1",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-webcomics"),
        "xkcd"
      ),
    },
    {
      id: "text-about-2",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "button-open-website-browser",
      text: _("tool-xkcd-button-open-website-browser").toUpperCase(),
    },
  ];
}
