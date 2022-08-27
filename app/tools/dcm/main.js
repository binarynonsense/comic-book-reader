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
      _("tool-shared-ui-search-placeholder"),
      _("tool-dcm-select-publisher-text"),
      _("tool-dcm-select-title-text"),
      _("tool-dcm-select-comic-text"),
      getLocalization()
    );
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-searching").toUpperCase()
    );
    g_window.webContents.send(g_ipcChannel + "init");
  });
};

exports.getPageCallback = async function getPageCallback(pageNum, fileData) {
  try {
    const axios = require("axios").default;
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    let comicData = fileData.data;
    const response = await axios.get(
      `https://digitalcomicmuseum.com/preview/index.php?did=${comicData.comicId}&page=${pageNum}`,
      { timeout: 10000 }
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
    return { pageImgSrc: imageUrl, pageImgUrl: imageUrl };
  } catch (error) {
    // console.error(error);
    return undefined;
  }
};

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "open", (event, comicData) => {
  mainProcess.openBookFromCallback(comicData, this.getPageCallback);
  g_window.close();
});

ipcMain.on(g_ipcChannel + "search", (event, data) => {
  // NOTE: tried to use the form-data package but couldn't make it work so I do the
  // axios request in the renderer and send the result here
  (async () => {
    try {
      const jsdom = require("jsdom");
      const { JSDOM } = jsdom;

      let content = `<div style="margin-top: 50px !important"></div>`;
      content += `<ul class="collection">`;
      const dom = new JSDOM(data);
      const table = dom.window.document.querySelector("#search-results");
      // List
      const links = table?.getElementsByTagName("a");
      if (!links || links.length <= 0) {
        content += `<li class="collection-item"><span class="title">${_(
          "tool-shared-ui-search-nothing-found"
        )}</span></li>`;
      } else {
        for (let index = 0; index < links.length; index++) {
          const link = links[index];
          // e.g. index.php?dlid=33252
          if (link.href.startsWith("index.php?dlid=")) {
            const name = link.innerHTML;
            const parts = link.href.split("dlid=");
            if (parts.length === 2 && isValidBookId(parts[1])) {
              const dlid = parts[1];
              content += `<li class="collection-item">      
                  <span class="title"><a style="cursor: pointer; margin-right: 5px;" title="${_(
                    "tool-shared-ui-search-item-open-acbr"
                  )}" onclick="renderer.onSearchResultClicked(${dlid}, 0)"
                    ><i class="fa fa-folder-open"></i> ${reduceString(
                      name
                    )}</a></span>
                    <a
                      style="cursor: pointer"
                      onclick="renderer.onSearchResultClicked(${dlid}, 1)"
                      class="secondary-content"
                      ><i
                        class="fa fa-link" aria-hidden="true"
                        title="${_("tool-shared-ui-search-item-open-browser")}"
                      ></i
                    ></a>
                  </li>`;
            }
          }
        }
      }
      // End list

      content += `</ul>`;

      g_window.webContents.send(g_ipcChannel + "update-results", content);
    } catch (error) {
      console.log(error);
      let content = `<div style="margin-top: 50px !important"></div>`;
      content += `<ul class="collection">`;
      content += `<li class="collection-item"><span class="title">${_(
        "tool-shared-ui-search-nothing-found"
      )}</span></li>`;
      content += `</ul>`;
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

function isValidBookId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
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
      text: _("tool-shared-tab-catalog").toUpperCase(),
    },
    {
      id: "text-tab-3",
      text: _("tool-shared-tab-openurl").toUpperCase(),
    },
    {
      id: "text-tab-4",
      text: _("tool-shared-tab-about").toUpperCase(),
    },

    {
      id: "button-search",
      text: _("tool-shared-ui-search-button").toUpperCase(),
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
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "button-open-selected-browser",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },

    {
      id: "dcm-url-text",
      text: _("tool-dcm-dcm-url-text"),
    },
    {
      id: "button-open-input-url-acbr",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "button-open-input-url-browser",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },

    {
      id: "text-about-1",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-comicbooks"),
        "Digital Comic Museum"
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
      id: "button-open-dcm-browser",
      text: _("tool-dcm-button-open-dcm-browser").toUpperCase(),
    },
    {
      id: "button-open-donate-browser",
      text: _("tool-dcm-button-open-donate-browser").toUpperCase(),
    },
  ];
}
