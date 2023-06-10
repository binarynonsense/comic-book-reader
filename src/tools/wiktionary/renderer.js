const { ipcRenderer } = require("electron");
const shell = require("electron").shell;
const axios = require("axios").default;

const g_ipcChannel = "tool-wik--";

const g_inputSearch = document.querySelector("#input-search");
const g_buttonSearch = document.querySelector("#button-search");
const g_divSearchResults = document.querySelector("#div-search-results");

const selectLanguage = document.getElementById("select-options-language");

let g_modalTitle = document.querySelector("#modal-title");

let g_modalInstance;
exports.initModal = function (instance) {
  g_modalInstance = instance;
};

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

ipcRenderer.on(g_ipcChannel + "init", (event) => {
  g_inputSearch.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (g_inputSearch.value) {
        onSearch();
      }
    }
  });
  g_inputSearch.focus();
});

ipcRenderer.on(g_ipcChannel + "update-results", (event, content) => {
  g_divSearchResults.innerHTML = content;
  g_modalInstance.close();
});

///////////////////////////////////////////////////////////////

function openWikLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (
    tmp.host === "www.wiktionary.org" ||
    tmp.host === "donate.wikimedia.org"
  ) {
    shell.openExternal(url);
  }
}

/////////////////////////////////////////////////////////////////////////

exports.onSearchInputChanged = function (input) {
  if (g_inputSearch.value !== "") {
    g_buttonSearch.classList.remove("disabled");
  } else {
    g_buttonSearch.classList.add("disabled");
  }
};

function onSearch(inputValue = undefined) {
  if (!inputValue) inputValue = g_inputSearch.value;
  g_modalInstance.open();
  window.scrollTo(0, 0);
  ipcRenderer.send(g_ipcChannel + "search", inputValue, selectLanguage.value);
}
exports.onSearch = onSearch;

exports.onOpenLink = function (url) {
  openWikLink(url);
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
