const { ipcRenderer } = require("electron");
const shell = require("electron").shell;
const axios = require("axios").default;

const g_ipcChannel = "tool-vox--";

const g_inputSearch = document.querySelector("#search-input");
const g_buttonSearch = document.querySelector("#search-button");
const g_divSearchResults = document.querySelector("#div-search-results");

let g_modalTitle = document.querySelector("#modal-title");

let g_modalInstance;
exports.initModal = function (instance) {
  g_modalInstance = instance;
};

let g_lastSearchResults;

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

ipcRenderer.on(
  g_ipcChannel + "update-results",
  (event, content, searchResults) => {
    g_lastSearchResults = searchResults;
    g_divSearchResults.innerHTML = content;
    g_modalInstance.close();
  }
);

///////////////////////////////////////////////////////////////

async function getBookPagesInfo(comicData) {
  /*
    https://archive.org/download/theworksofplato01platiala/page/n12/mode/1up
    https://archive.org/metadata/theworksofplato01platiala
    https://api.archivelab.org/books/theworksofplato01platiala/pages
    https://api.archivelab.org/books/theworksofplato01platiala/pages/1  -> ERROR
  */
  try {
    const response = await axios.get(
      `https://api.archivelab.org/books/${comicData.comicId}/pages`,
      { timeout: 10000 }
    );
    return response.data.pages.length;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

function openLvxLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "archive.org" || tmp.host === "librivox.org") {
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

function onSearch(pageNum = 1, inputValue = undefined) {
  if (!inputValue) inputValue = g_inputSearch.value;
  g_modalInstance.open();
  window.scrollTo(0, 0);
  ipcRenderer.send(g_ipcChannel + "search", inputValue, pageNum);
}
exports.onSearch = onSearch;

exports.onSearchResultClicked = function (index, mode) {
  if (!g_lastSearchResults) return;
  const bookData = g_lastSearchResults.response.docs[index];
  if (mode === 0) {
    (async () => {
      try {
        const downloadsUrl = `https://archive.org/download/${bookData.identifier}`;
        const response = await axios.get(downloadsUrl, { timeout: 10000 });
        const parser = new DOMParser().parseFromString(
          response.data,
          "text/html"
        );
        const fileUrls = [];
        const aElements = parser.getElementsByTagName("a");
        for (let index = 0; index < aElements.length; index++) {
          const aElement = aElements[index];
          if (aElement.getAttribute("href")?.endsWith("64kb.mp3")) {
            fileUrls.push(downloadsUrl + "/" + aElement.getAttribute("href"));
          }
        }
        if (fileUrls.length > 0) {
          ipcRenderer.send(
            g_ipcChannel + "open",
            bookData.identifier,
            fileUrls
          );
        }
      } catch (error) {
        console.log(error);
      }
    })(); // async
  } else {
    let url = `https://archive.org/details/${bookData.identifier}`;
    openLvxLink(url);
  }
};

exports.onOpenLink = function (url) {
  openLvxLink(url);
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
