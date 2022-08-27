const { ipcRenderer } = require("electron");
const fs = require("fs");
const shell = require("electron").shell;

const g_ipcChannel = "tool-gut--";

const g_inputSearch = document.querySelector("#input-search");
const g_buttonSearch = document.querySelector("#button-search");
const g_divSearchResults = document.querySelector("#div-search-results");

const g_inputUrl = document.querySelector("#input-url");
const g_buttonOpenUrlInACBR = document.querySelector("#button-url-open-acbr");
const g_buttonOpenUrlInBrowser = document.querySelector(
  "#button-url-open-browser"
);

const g_mirrorsSelect = document.querySelector("#select-options-mirrors");
const g_inputCacheFolder = document.querySelector(
  "#input-options-cache-folder"
);
const g_checkboxCacheDownloads = document.querySelector(
  "#checkbox-options-cache-downloads"
);
const g_buttonOpenCacheFolder = document.querySelector(
  "#button-options-open-cache-folder"
);

const g_modalTitle = document.querySelector("#modal-title");

let g_modalInstance;
exports.initModal = function (instance) {
  g_modalInstance = instance;
};

let g_portableCacheFolderPath;

let g_activeTab = "tab-1";

exports.onShowTabs = function (tab) {
  g_activeTab = tab.id;
  if (tab.id === "tab-1") {
    g_inputSearch.focus();
  }
};

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (event, title, searchPlaceHolder, localization) => {
    document.title = title;
    g_inputSearch.placeholder = searchPlaceHolder;
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
  }
);

ipcRenderer.on(
  g_ipcChannel + "init",
  (event, mirrorsContent, portableCacheFolderPath, settingsUseCache) => {
    g_mirrorsSelect.innerHTML = mirrorsContent;

    g_portableCacheFolderPath = portableCacheFolderPath;
    g_inputCacheFolder.value = g_portableCacheFolderPath;
    if (fs.existsSync(g_portableCacheFolderPath)) {
      g_buttonOpenCacheFolder.classList.remove("disabled");
    } else {
      g_buttonOpenCacheFolder.classList.add("disabled");
    }

    if (settingsUseCache) {
      g_checkboxCacheDownloads.checked = true;
    } else {
      g_checkboxCacheDownloads.checked = false;
    }

    g_inputSearch.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (g_inputSearch.value) {
          onSearch();
        }
      }
    });
    g_inputSearch.focus();
  }
);

ipcRenderer.on(g_ipcChannel + "update-results", (event, content) => {
  g_divSearchResults.innerHTML = content;
  g_modalInstance.close();
});

/////////////////////////////////////////////////////////////////////////

exports.onInputChangedSearch = function (input) {
  if (g_inputSearch.value !== "") {
    g_buttonSearch.classList.remove("disabled");
  } else {
    g_buttonSearch.classList.add("disabled");
  }
};

function onSearch(pageNum = 1, inputValue = undefined) {
  if (!inputValue) inputValue = g_inputSearch.value;
  g_modalInstance.open();
  window.scrollTo(0, 0);
  ipcRenderer.send(g_ipcChannel + "search", inputValue, pageNum);
}
exports.onSearch = onSearch;

exports.onSearchResultClicked = function (bookId, openWith) {
  if (openWith === 0) {
    ipcRenderer.send(g_ipcChannel + "open-id", bookId, g_mirrorsSelect.value);
  } else {
    let url = `https://www.gutenberg.org/ebooks/${bookId}`;
    openGutLink(url);
  }
};

////////////////////////////////////////////////////////////////

exports.onInputChangedUrl = function (inputElement) {
  if (inputElement.value.startsWith("https://www.gutenberg.org/ebooks/")) {
    g_buttonOpenUrlInACBR.classList.remove("disabled");
    g_buttonOpenUrlInBrowser.classList.remove("disabled");
  } else {
    g_buttonOpenUrlInACBR.classList.add("disabled");
    g_buttonOpenUrlInBrowser.classList.add("disabled");
  }
};

function isValidBookId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

exports.onOpenUrlInACBR = function () {
  let url = g_inputUrl.value;
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "www.gutenberg.org") {
    // e.g. https://www.gutenberg.org/ebooks/35
    let bookId;
    let parts = url.split("ebooks/");
    if (parts.length === 2 && isValidBookId(parts[1])) {
      bookId = parts[1];
    }
    if (!bookId) return;
    ipcRenderer.send(g_ipcChannel + "open-id", bookId, g_mirrorsSelect.value);
  }
};

exports.onOpenUrlInBrowser = function () {
  let url = g_inputUrl.value;
  openGutLink(url);
};

////////////////////////////////////////////////////////////////

exports.onOpenLink = function (url) {
  openGutLink(url);
};

function openGutLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "www.gutenberg.org") {
    shell.openExternal(url);
  }
}

////////////////////////////////////////////////////////////////

exports.onOpenCacheFolder = function () {
  shell.openPath(g_portableCacheFolderPath);
};

exports.onUseCacheChanged = function (checkbox) {
  ipcRenderer.send(g_ipcChannel + "update-use-cache", checkbox.checked);
};

////////////////////////////////////////////////////////////////

ipcRenderer.on(g_ipcChannel + "modal-open", (event) => {
  g_modalInstance.open();
});

ipcRenderer.on(g_ipcChannel + "modal-close", (event) => {
  g_modalInstance.close();
});

ipcRenderer.on(g_ipcChannel + "modal-update-title", (event, text) => {
  g_modalTitle.innerHTML = text;
});
