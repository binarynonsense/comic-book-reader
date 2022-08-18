const { ipcRenderer } = require("electron");
const shell = require("electron").shell;
const axios = require("axios").default;

let g_ipcChannel = "tool-dcm--";

let g_publishersSelect = document.querySelector("#publishers-select");
let g_titlesSelect = document.querySelector("#titles-select");
let g_comicsSelect = document.querySelector("#comics-select");
let g_openSelectedInACBRButton = document.querySelector(
  "#button-open-selected-acbr"
);
let g_openSelectedInBrowserButton = document.querySelector(
  "#button-open-selected-browser"
);
let g_dcmUrlInput = document.querySelector("#dcm-url-input");
let g_openInputInACBR = document.querySelector("#button-open-input-url-acbr");
let g_openInputInBrowser = document.querySelector(
  "#button-open-input-url-browser"
);

let g_selectedComicData;
let g_selectPublisherString;
let g_selectTitleString;
let g_selectComicString;

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (
    event,
    title,
    selectPublisherString,
    selectTitleString,
    selectComicString,
    localization
  ) => {
    g_selectPublisherString = selectPublisherString;
    g_selectTitleString = selectTitleString;
    g_selectComicString = selectComicString;
    document.title = title; // + "  (" + (navigator.onLine ? "online" : "offline") + ")";
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
    await fillPublishers();
    checkValidData();
  })(); // async
});

////////////////////////////////////////////////////////////////////

function cleanUpSelected(
  cleanPublishers = true,
  cleanTitles = true,
  cleanComics = true
) {
  if (cleanPublishers) g_publishersSelect.innerHTML = "";
  if (cleanTitles) g_titlesSelect.innerHTML = "";
  if (cleanComics) {
    g_comicsSelect.innerHTML = "";
    g_selectedComicData = undefined;
    checkValidData();
  }
}

function checkValidData() {
  if (g_selectedComicData) {
    g_openSelectedInBrowserButton.classList.remove("disabled");
    g_openSelectedInACBRButton.classList.remove("disabled");
  } else {
    g_openSelectedInBrowserButton.classList.add("disabled");
    g_openSelectedInACBRButton.classList.add("disabled");
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
    g_publishersSelect.innerHTML += `<option value="-1">${g_selectPublisherString}</option>`;
    for (let index = 0; index < publisherElements.length; index++) {
      let aElement = publisherElements[index].getElementsByTagName("a")[0];
      let parts = aElement.href.split("cid=");
      g_publishersSelect.innerHTML += `<option value="${parts[1]}">${aElement.innerHTML}</option>`;
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
    g_titlesSelect.innerHTML += `<option value="-1">${g_selectTitleString}</option>`;
    for (let index = 1; index < data.length; index++) {
      g_titlesSelect.innerHTML += `<option value="${data[index].optionValue}">${data[index].optionDisplay}</option>`;
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
    g_comicsSelect.innerHTML += `<option value="-1">${g_selectComicString}</option>`;
    for (let index = 1; index < data.length; index++) {
      let parts = data[index].optionValue.split("did=");
      g_comicsSelect.innerHTML += `<option value="${parts[1]}">${data[index].optionDisplay}</option>`;
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
  g_comicsSelect.innerHTML = "";
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
      comicId: comicId,
      name: selectObject.options[selectObject.selectedIndex].text,
      pageUrl: page.url,
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

exports.onComicUrlInputChanged = function (inputElement) {
  if (
    inputElement.value.startsWith(
      "https://digitalcomicmuseum.com/preview/index.php?did="
    )
  ) {
    g_openInputInACBR.classList.remove("disabled");
    g_openInputInBrowser.classList.remove("disabled");
  } else {
    g_openInputInACBR.classList.add("disabled");
    g_openInputInBrowser.classList.add("disabled");
  }
};

// ref: https://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
function isValidComicId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

exports.onOpenComicUrlInACBR = function () {
  let url = g_dcmUrlInput.value;
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "digitalcomicmuseum.com") {
    // e.g. https://digitalcomicmuseum.com/preview/index.php?did=32771
    let comicId;
    let parts = url.split("did=");
    if (parts.length === 2 && isValidComicId(parts[1])) {
      comicId = parts[1];
    }
    if (!comicId) return;
    (async () => {
      let page = await getFirstPageInfo(comicId, 1);
      let comicData = {
        comicId: comicId,
        name: page.name,
        pageUrl: page.url,
        numPages: page.numPages,
      };
      if (page.url) {
        ipcRenderer.send(g_ipcChannel + "open", comicData);
      }
    })(); // async
  }
};

exports.onOpenComicUrlInBrowser = function () {
  let url = g_dcmUrlInput.value;
  openDCMLink(url);
};
