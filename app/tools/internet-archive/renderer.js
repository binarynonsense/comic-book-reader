const { ipcRenderer } = require("electron");
const shell = require("electron").shell;
const axios = require("axios").default;

const g_ipcChannel = "tool-iab--";

const g_searchInput = document.querySelector("#search-input");
const g_searchButton = document.querySelector("#search-button");
const g_searchResultsDiv = document.querySelector("#div-search-results");

let g_collectionSelect = document.querySelector("#options-collections-select");
let g_availabilitySelect = document.querySelector(
  "#options-availability-select"
);

let g_modalTitle = document.querySelector("#modal-title");

let g_modalInstance;
exports.initModal = function (instance) {
  g_modalInstance = instance;
};

let g_lastSearchResults;

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (event, title, searchPlaceHolder, localization) => {
    document.title = title; // + "  (" + (navigator.onLine ? "online" : "offline") + ")";
    g_searchInput.placeholder = searchPlaceHolder;
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
  (event, collectionsContent, availabilityContent) => {
    g_collectionSelect.innerHTML = collectionsContent;
    g_availabilitySelect.innerHTML = availabilityContent;
    g_searchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        onSearch();
      }
    });
    g_searchInput.focus();
  }
);

ipcRenderer.on(
  g_ipcChannel + "update-results",
  (event, content, searchResults) => {
    g_lastSearchResults = searchResults;
    g_searchResultsDiv.innerHTML = content;
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
      { timeout: 5000 }
    );
    return response.data.pages.length;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

function openIALink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "archive.org") {
    shell.openExternal(url);
  }
}

/////////////////////////////////////////////////////////////////////////

exports.onSearchInputChanged = function (input) {
  if (g_searchInput.value !== "") {
    g_searchButton.classList.remove("disabled");
  } else {
    g_searchButton.classList.add("disabled");
  }
};

exports.onSearch = onSearch = function (pageNum = 1, inputValue = undefined) {
  if (!inputValue) inputValue = g_searchInput.value;
  g_modalInstance.open();
  ipcRenderer.send(
    g_ipcChannel + "search",
    inputValue,
    pageNum,
    g_collectionSelect.value,
    g_availabilitySelect.value
  );
};

exports.onSearchResultClicked = function (index, mode) {
  if (!g_lastSearchResults) return;
  const bookData = g_lastSearchResults.response.docs[index];
  let selectedComicData = {
    comicId: bookData.identifier,
    name: bookData.title,
    numPages: bookData.imagecount,
  };
  if (mode === 0) {
    (async () => {
      try {
        if (!bookData.imagecount) {
          let numPages = await getBookPagesInfo(selectedComicData);
          if (numPages) selectedComicData.numPages = numPages + 1; // some times it's one more, others not???, not sure
        }
        ipcRenderer.send(g_ipcChannel + "open", selectedComicData);
      } catch (error) {}
    })(); // async
  } else {
    let url = `https://archive.org/details/${selectedComicData.comicId}`;
    openIALink(url);
  }
};

exports.onOpenLink = function (url) {
  openIALink(url);
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
