const { ipcRenderer } = require("electron");
const shell = require("electron").shell;
const axios = require("axios").default;

const g_ipcChannel = "tool-xkcd--";

const g_selectCatalogNumber = document.querySelector("#select-catalog-number");
const g_buttonOpenCatalogInACBR = document.querySelector(
  "#button-catalog-open-acbr"
);
const g_buttonOpenCatalogInBrowser = document.querySelector(
  "#button-catalog-open-browser"
);

let g_activeTab = "tab-1";

exports.onShowTabs = function (tab) {
  g_activeTab = tab.id;
};

let g_selectNumberLocalizedText;
let g_totalNumComics;

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (event, title, selectNumberText, localization) => {
    document.title = title;
    g_selectNumberLocalizedText = selectNumberText;
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
  }
);

ipcRenderer.on(g_ipcChannel + "init", (event) => {
  (async () => {
    let selectNumberContent = `<option value="-1">${g_selectNumberLocalizedText}</option>`;
    try {
      const response = await axios.get("https://xkcd.com/info.0.json", {
        timeout: 10000,
      });
      g_totalNumComics = response?.data?.num;
      if (g_totalNumComics) {
        for (let index = g_totalNumComics; index > 0; index--) {
          selectNumberContent += `<option value="${index}">${index}</option>`;
        }
      }
      g_selectCatalogNumber.innerHTML = selectNumberContent;
    } catch (error) {
      g_selectCatalogNumber.innerHTML = selectNumberContent;
    }
  })(); // async
});

/////////////////////////////////////////////////////////////////////////

exports.onSelectNumberChanged = function (selectObject) {
  if (selectObject.value == -1) {
    g_buttonOpenCatalogInACBR.classList.add("disabled");
    g_buttonOpenCatalogInBrowser.classList.add("disabled");
  } else {
    g_buttonOpenCatalogInACBR.classList.remove("disabled");
    g_buttonOpenCatalogInBrowser.classList.remove("disabled");
  }
};

exports.onOpenCatalogInACBR = function () {
  const number = g_selectCatalogNumber.value;
  if (!number || number == -1) return;

  let comicData = {
    source: "xkcd",
    name: "xkcd",
    numPages: g_totalNumComics,
  };
  ipcRenderer.send(g_ipcChannel + "open", comicData, number);
};

exports.onOpenCatalogInBrowser = function () {
  const number = g_selectCatalogNumber.value;
  if (!number || number == "-1") return;
  (async () => {
    try {
      const response = await axios.get(
        `https://xkcd.com/${number}/info.0.json`,
        {
          timeout: 10000,
        }
      );
      const url = response?.data?.img;
      if (url) openXkcdLink(url);
    } catch (error) {}
  })(); // async
};

////////////////////////////////////////////////////////////////

exports.onOpenLink = function (url) {
  openXkcdLink(url);
};

function openXkcdLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "imgs.xkcd.com" || tmp.host === "xkcd.com") {
    shell.openExternal(url);
  }
}
