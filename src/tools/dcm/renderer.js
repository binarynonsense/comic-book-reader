const { ipcRenderer } = require("electron");
const shell = require("electron").shell;
const axios = require("axios").default;

const g_ipcChannel = "tool-dcm--";

const g_selectPublishers = document.querySelector("#publishers-select");
const g_selectTitles = document.querySelector("#titles-select");
const g_selectComics = document.querySelector("#comics-select");
const g_buttonOpenSelectedInACBR = document.querySelector(
  "#button-open-selected-acbr"
);
const g_buttonOpenSelectedInBrowser = document.querySelector(
  "#button-open-selected-browser"
);

const g_inputSearch = document.querySelector("#input-search");
const g_buttonSearch = document.querySelector("#button-search");
const g_divSearchResults = document.querySelector("#div-search-results");

const g_inputDcmUrl = document.querySelector("#dcm-url-input");
const g_buttonOpenInputInACBR = document.querySelector(
  "#button-open-input-url-acbr"
);
const g_buttonOpenInputInBrowser = document.querySelector(
  "#button-open-input-url-browser"
);

const g_modalTitle = document.querySelector("#modal-title");

let g_modalInstance;
exports.initModal = function (instance) {
  g_modalInstance = instance;
};

let g_selectedComicData;
let g_selectPublisherString;
let g_selectTitleString;
let g_selectComicString;

let g_activeTab = "tab-1";

exports.onShowTabs = function (tab) {
  g_activeTab = tab.id;
  if (tab.id === "tab-2") {
    if (g_selectPublishers.innerHTML == "") {
      (async () => {
        await fillPublishers();
        checkValidData();
      })(); // async
    }
  } else if (tab.id === "tab-1") {
    g_inputSearch.focus();
  }
};

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (
    event,
    title,
    searchPlaceHolder,
    selectPublisherString,
    selectTitleString,
    selectComicString,
    localization
  ) => {
    document.title = title;
    g_inputSearch.placeholder = searchPlaceHolder;
    g_selectPublisherString = selectPublisherString;
    g_selectTitleString = selectTitleString;
    g_selectComicString = selectComicString;
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
    if (event.key === "Enter" && g_activeTab === "tab-1") {
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

////////////////////////////////////////////////////////////////////

function cleanUpSelected(
  cleanPublishers = true,
  cleanTitles = true,
  cleanComics = true
) {
  if (cleanPublishers) g_selectPublishers.innerHTML = "";
  if (cleanTitles) g_selectTitles.innerHTML = "";
  if (cleanComics) {
    g_selectComics.innerHTML = "";
    g_selectedComicData = undefined;
    checkValidData();
  }
}

function checkValidData() {
  if (g_selectedComicData) {
    g_buttonOpenSelectedInBrowser.classList.remove("disabled");
    g_buttonOpenSelectedInACBR.classList.remove("disabled");
  } else {
    g_buttonOpenSelectedInBrowser.classList.add("disabled");
    g_buttonOpenSelectedInACBR.classList.add("disabled");
  }
}

async function fillPublishers() {
  cleanUpSelected();
  try {
    const response = await axios.get(
      "https://digitalcomicmuseum.com/preview/index.php"
    );
    const parser = new DOMParser().parseFromString(response.data, "text/html");
    //e.g. <div class='pull-left'><a href='category.php?cid=98'>Ace Magazines</a>
    const publisherElements = parser.querySelectorAll(".pull-left");
    g_selectPublishers.innerHTML += `<option value="-1">${g_selectPublisherString}</option>`;
    for (let index = 0; index < publisherElements.length; index++) {
      let aElement = publisherElements[index].getElementsByTagName("a")[0];
      let parts = aElement.href.split("cid=");
      g_selectPublishers.innerHTML += `<option value="${parts[1]}">${aElement.innerHTML}</option>`;
    }
  } catch (error) {
    console.log(error);
  }
}

async function fillTitles(publisherId) {
  cleanUpSelected(false);
  try {
    const response = await axios.get(
      `https://digitalcomicmuseum.com/preview/select.php?id=${publisherId}`
    );
    //e.g. [ {"optionValue": "98", "optionDisplay": "Please Select a Comic Title"},{"optionValue": "289", "optionDisplay": "All Love"},...
    let data = response.data;
    g_selectTitles.innerHTML += `<option value="-1">${g_selectTitleString}</option>`;
    for (let index = 1; index < data.length; index++) {
      g_selectTitles.innerHTML += `<option value="${data[index].optionValue}">${data[index].optionDisplay}</option>`;
    }
  } catch (error) {
    console.log(error);
  }
}

async function fillComics(titleId) {
  cleanUpSelected(false, false);
  try {
    const response = await axios.get(
      `https://digitalcomicmuseum.com/preview/select.php?cid=${titleId}`
    );
    //e.g. [ {"optionValue": "0", "optionDisplay": "Please Select a Comic Book"},{"optionValue": "https://digitalcomicmuseum.com/preview/index.php?did=7793", "optionDisplay": "World War III #01 (inc)"},...
    let data = response.data;
    g_selectComics.innerHTML += `<option value="-1">${g_selectComicString}</option>`;
    for (let index = 1; index < data.length; index++) {
      let parts = data[index].optionValue.split("did=");
      g_selectComics.innerHTML += `<option value="${parts[1]}">${data[index].optionDisplay}</option>`;
    }
  } catch (error) {
    console.log(error);
  }
}

async function getFirstPageInfo(comicId) {
  try {
    const response = await axios.get(
      `https://digitalcomicmuseum.com/preview/index.php?did=${comicId}&page=${1}`
    );
    const parser = new DOMParser().parseFromString(response.data, "text/html");
    //e.g. <a href="https://digitalcomicmuseum.com/preview/index.php?did=21376&page=2" alt="Comic Page - ZIP"><img src='https://cdn.digitalcomicmuseum.com/preview/cache/21376/ff153p00fc-hag.jpg' width='100%' alt='Comic Page'/><br /></a>
    let images = parser.getElementsByTagName("img");
    let imageUrl;
    for (let i = 0; i < images.length; i++) {
      if (images[i].alt === "Comic Page") {
        imageUrl = images[i].src;
        continue;
      }
    }
    //num pages
    const thumbs = parser.querySelectorAll(".slick-slide");
    let numPages = thumbs.length;
    // title
    let title = parser.title;
    title = title.substring(
      title.lastIndexOf("Digital Comic Museum Viewer: ") +
        "Digital Comic Museum Viewer: ".length,
      title.lastIndexOf(" - ")
    );

    return { url: imageUrl, numPages: numPages, name: title };
  } catch (error) {
    console.error(error);
  }
}

function openDCMLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "digitalcomicmuseum.com") {
    shell.openExternal(url);
  }
}

///////////////////////////////////////////////////////////////////////////////

exports.onPublishersChanged = function (selectObject) {
  if (selectObject.value == -1) {
    cleanUpSelected(false);
    return;
  }
  g_selectComics.innerHTML = "";
  fillTitles(selectObject.value);
};

exports.onTitlesChanged = function (selectObject) {
  if (selectObject.value == -1) {
    cleanUpSelected(false, false);
    return;
  }
  fillComics(selectObject.value);
};

exports.onComicsChanged = function (selectObject) {
  if (selectObject.value == -1) {
    return;
  }
  (async () => {
    let comicId = selectObject.value;
    let page = await getFirstPageInfo(comicId, 1);
    g_selectedComicData = {
      source: "dcm",
      comicId: comicId,
      name: selectObject.options[selectObject.selectedIndex].text,
      numPages: page.numPages,
    };
    checkValidData();
  })(); // async
};

exports.onOpenSelectedComicInACBR = function () {
  if (g_selectedComicData) {
    ipcRenderer.send(g_ipcChannel + "open", g_selectedComicData);
  }
};

exports.onOpenSelectedComicInBrowser = function () {
  if (g_selectedComicData) {
    let url = `https://digitalcomicmuseum.com/preview/index.php?did=${g_selectedComicData.comicId}`;
    openDCMLink(url);
  }
};

exports.onOpenLink = function (url) {
  openDCMLink(url);
};

/////////////////////////////////////////////////////////////////////////

exports.onInputChangedSearch = function (input) {
  if (g_inputSearch.value !== "") {
    g_buttonSearch.classList.remove("disabled");
  } else {
    g_buttonSearch.classList.add("disabled");
  }
};

async function onSearch() {
  let inputValue = g_inputSearch.value;
  g_modalInstance.open();
  window.scrollTo(0, 0);
  try {
    const formData = new FormData();
    formData.append("terms", inputValue);
    const response = await axios.post(
      "https://digitalcomicmuseum.com/index.php?ACT=dosearch",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    ipcRenderer.send(g_ipcChannel + "search", response.data);
  } catch (error) {
    console.log(error);
    g_modalInstance.close();
  }
}
exports.onSearch = onSearch;

exports.onSearchResultClicked = function (dlid, openWith) {
  if (openWith === 0) {
    (async () => {
      try {
        let infoUrl = `https://digitalcomicmuseum.com/?dlid=${dlid}`;
        const response = await axios.get(infoUrl);
        const parser = new DOMParser().parseFromString(
          response.data,
          "text/html"
        );
        const links = parser.getElementsByTagName("a");
        for (let index = 0; index < links.length; index++) {
          const link = links[index];
          // e.g. '/preview/index.php?did=15192'
          const href = link.getAttribute("href");
          if (href && href.startsWith("/preview/index.php?did=")) {
            const parts = href.split("did=");
            if (parts.length === 2 && isValidId(parts[1])) {
              const url = `https://digitalcomicmuseum.com/preview/index.php?did=${parts[1]}`;
              onOpenComicUrlInACBR(url);
              return;
            }
          }
        }
      } catch (error) {
        console.log(error);
      }
    })(); // async
  } else {
    let url = `https://digitalcomicmuseum.com/?dlid=${dlid}`;
    openDCMLink(url);
  }
};

/////////////////////////////////////////////////////////////////////////

exports.onComicUrlInputChanged = function (inputElement) {
  if (
    inputElement.value.startsWith(
      "https://digitalcomicmuseum.com/preview/index.php?did="
    )
  ) {
    g_buttonOpenInputInACBR.classList.remove("disabled");
    g_buttonOpenInputInBrowser.classList.remove("disabled");
  } else {
    g_buttonOpenInputInACBR.classList.add("disabled");
    g_buttonOpenInputInBrowser.classList.add("disabled");
  }
};

// ref: https://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
function isValidId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

function onOpenComicUrlInACBR(url) {
  if (!url) url = g_inputDcmUrl.value;
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "digitalcomicmuseum.com") {
    // e.g. https://digitalcomicmuseum.com/preview/index.php?did=32771
    let comicId;
    let parts = url.split("did=");
    if (parts.length === 2 && isValidId(parts[1])) {
      comicId = parts[1];
    }
    if (!comicId) return;
    (async () => {
      let page = await getFirstPageInfo(comicId, 1);
      let comicData = {
        source: "dcm",
        comicId: comicId,
        name: page.name,
        numPages: page.numPages,
      };
      if (page.url) {
        ipcRenderer.send(g_ipcChannel + "open", comicData);
      }
    })(); // async
  }
}
exports.onOpenComicUrlInACBR = onOpenComicUrlInACBR;

exports.onOpenComicUrlInBrowser = function () {
  let url = g_inputDcmUrl.value;
  openDCMLink(url);
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
