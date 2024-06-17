/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import axios from "../../assets/libs/axios/dist/esm/axios.js";

let g_searchInput;
let g_searchButton;

let g_publishersSelect;
let g_titlesSelect;
let g_comicsSelect;
let g_openSelectedInACBRButton;
let g_openSelectedInBrowserButton;

let g_selectPublisherString;
let g_selectTitleString;
let g_selectComicString;

let g_selectedComicData;

let g_dcmUrlInput;
let g_openInputInACBRButton;
let g_openInputInBrowserButton;

let g_localizedSearchPlaceholderText;
let g_localizedModalCancelButtonText;
let g_localizedModalCloseButtonText;
let g_localizedModalSearchingTitleText;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init() {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  // menu buttons
  document
    .getElementById("tool-dcm-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  for (let index = 0; index < 4; index++) {
    document
      .getElementById(`tool-dcm-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////

  // search
  g_searchButton = document.getElementById("tool-dcm-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-dcm-search-input");
  g_searchInput.placeholder = g_localizedSearchPlaceholderText;
  g_searchInput.addEventListener("input", function (event) {
    if (g_searchInput.value !== "") {
      g_searchButton.classList.remove("tools-disabled");
    } else {
      g_searchButton.classList.add("tools-disabled");
    }
  });
  g_searchInput.addEventListener("keypress", function (event) {
    if (
      event.key === "Enter" &&
      !document
        .getElementById("tool-search-input-div")
        .classList.contains("set-display-none")
    ) {
      event.preventDefault();
      if (g_searchInput.value) {
        onSearch();
      }
    }
  });
  g_searchInput.focus();
  // catalog
  g_publishersSelect = document.querySelector("#tool-dcm-publishers-select");
  g_titlesSelect = document.querySelector("#tool-dcm-titles-select");
  g_comicsSelect = document.querySelector("#tool-dcm-comics-select");
  g_openSelectedInACBRButton = document.querySelector(
    "#tool-dcm-open-selected-acbr-button"
  );
  g_openSelectedInBrowserButton = document.querySelector(
    "#tool-dcm-open-selected-browser-button"
  );

  g_publishersSelect.addEventListener("change", (event) => {
    if (event.target.value == -1) {
      cleanUpSelected(false);
      return;
    }
    g_comicsSelect.innerHTML = "";
    fillTitles(event.target.value);
  });
  g_titlesSelect.addEventListener("change", (event) => {
    if (event.target.value == -1) {
      cleanUpSelected(false, false);
      return;
    }
    fillComics(event.target.value);
  });
  g_comicsSelect.addEventListener("change", async (event) => {
    if (event.target.value == -1) {
      return;
    }
    let comicId = event.target.value;
    let page = await getFirstPageInfo(comicId, 1);
    g_selectedComicData = {
      source: "dcm",
      comicId: comicId,
      name: event.target.options[event.target.selectedIndex].text,
      numPages: page.numPages,
    };
    checkValidData();
  });

  g_openSelectedInACBRButton.addEventListener("click", (event) => {
    if (g_selectedComicData) {
      sendIpcToMain("open", g_selectedComicData);
    }
  });
  g_openSelectedInBrowserButton.addEventListener("click", (event) => {
    if (g_selectedComicData) {
      let url = `https://digitalcomicmuseum.com/preview/index.php?did=${g_selectedComicData.comicId}`;
      openDCMLink(url);
    }
  });
  // url
  g_dcmUrlInput = document.getElementById("tool-dcm-url-input");
  g_openInputInACBRButton = document.getElementById(
    "tool-dcm-open-input-url-acbr-button"
  );
  g_openInputInBrowserButton = document.getElementById(
    "tool-dcm-open-input-url-browser-button"
  );

  g_dcmUrlInput.addEventListener("input", (event) => {
    if (
      event.target.value.startsWith(
        "https://digitalcomicmuseum.com/preview/index.php?did="
      )
    ) {
      g_openInputInACBRButton.classList.remove("tools-disabled");
      g_openInputInBrowserButton.classList.remove("tools-disabled");
    } else {
      g_openInputInACBRButton.classList.add("tools-disabled");
      g_openInputInBrowserButton.classList.add("tools-disabled");
    }
  });
  g_openInputInACBRButton.addEventListener("click", (event) => {
    onOpenComicUrlInACBR();
  });
  g_openInputInBrowserButton.addEventListener("click", (event) => {
    onOpenComicUrlInBrowser();
  });
  // about
  document
    .getElementById("tool-dcm-open-dcm-browser-button")
    .addEventListener("click", (event) => {
      openDCMLink(`https://digitalcomicmuseum.com`);
    });

  document
    .getElementById("tool-dcm-open-donate-browser-button")
    .addEventListener("click", (event) => {
      openDCMLink(
        `https://digitalcomicmuseum.com/forum/index.php?action=treasury`
      );
    });

  ////////////////////////////////////////
  updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight(scrollTop = false) {
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
  if (scrollTop) {
    document.getElementById("tools-columns-right").scrollIntoView({
      behavior: "instant",
      block: "start",
      inline: "nearest",
    });
  }
}

function switchSection(id) {
  for (let index = 0; index < 4; index++) {
    if (id === index) {
      document
        .getElementById(`tool-dcm-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-dcm-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-dcm-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-dcm-section-${index}-content-div`)
        .classList.add("set-display-none");
    }

    if (index === 0) {
      g_searchInput.focus();
    } else if (index === 1) {
      if (g_publishersSelect.innerHTML == "") {
        (async () => {
          await fillPublishers();
          checkValidData();
        })(); // async
      }
    }
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-dcm", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-dcm", ...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};

export function onIpcFromMain(args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
}

function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("show", (outputFolderPath) => {
    init(outputFolderPath);
  });

  on("hide", () => {});

  on(
    "update-localization",
    (
      searchPlaceHolder,
      selectPublisherString,
      selectTitleString,
      selectComicString,
      modalSearchingTitleText,
      modalCloseButtonText,
      modalCancelButtonText,
      localization
    ) => {
      g_localizedSearchPlaceholderText = searchPlaceHolder;
      g_selectPublisherString = selectPublisherString;
      g_selectTitleString = selectTitleString;
      g_selectComicString = selectComicString;
      g_localizedModalSearchingTitleText = modalSearchingTitleText;
      g_localizedModalCloseButtonText = modalCloseButtonText;
      g_localizedModalCancelButtonText = modalCancelButtonText;
      for (let index = 0; index < localization.length; index++) {
        const element = localization[index];
        const domElement = document.querySelector("#" + element.id);
        if (domElement !== null) {
          domElement.innerHTML = element.text;
        }
      }
    }
  );

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });

  /////////////////////////////////////////////////////////////////////////////

  on("modal-update-title-text", (text) => {
    console.log(text);
    updateModalTitleText(text);
  });

  on("update-info-text", (text) => {
    updateInfoText(text);
  });

  on("update-log-text", (text) => {
    updateLogText(text);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("update-results", (results, openInAcbrText, openInBrowserText) => {
    document
      .querySelector("#tool-search-results-h3")
      .classList.remove("set-display-none");
    const searchResultsDiv = document.querySelector(
      "#tool-dcm-search-results-div"
    );
    searchResultsDiv.innerHTML = "";
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    if (results && results.length > 0) {
      for (let index = 0; index < results.length; index++) {
        const result = results[index];
        let li = document.createElement("li");
        li.className = "tools-buttons-list-li";
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fas fa-file fa-2x"></i>`;
        buttonSpan.title = openInAcbrText;
        let multilineText = document.createElement("span");
        multilineText.className = "tools-buttons-list-li-multiline-text";
        {
          let text = document.createElement("span");
          text.innerText = `${result.name}`;
          multilineText.appendChild(text);
        }
        buttonSpan.appendChild(multilineText);
        buttonSpan.addEventListener("click", (event) => {
          onSearchResultClicked(result.dlid, 0);
        });
        li.appendChild(buttonSpan);
        {
          let buttonSpan = document.createElement("span");
          buttonSpan.className = "tools-buttons-list-button";
          buttonSpan.innerHTML = `<i class="fas fa-link"></i>`;
          buttonSpan.title = openInBrowserText;
          buttonSpan.addEventListener("click", (event) => {
            onSearchResultClicked(result.dlid, 1);
          });
          li.appendChild(buttonSpan);
        }
        ul.appendChild(li);
      }
    } else {
      let li = document.createElement("li");
      li.className = "tools-collection-li";
      let text = document.createElement("span");
      // when 0 results/error openInAcbrText stores the text for that
      text.innerText = openInAcbrText;
      li.appendChild(text);
      ul.appendChild(li);
    }
    searchResultsDiv.appendChild(ul);
    updateColumnsHeight();
    document.getElementById("tools-columns-right").scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    closeModal();
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onSearch() {
  let inputValue = g_searchInput.value;
  if (inputValue === "") return;

  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_localizedModalSearchingTitleText);
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
    sendIpcToMain("search", response.data);
  } catch (error) {
    console.log(error);
    //g_modalInstance.close();
  }
}

async function onSearchResultClicked(dlid, openWith) {
  if (openWith === 0) {
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
  } else {
    let url = `https://digitalcomicmuseum.com/?dlid=${dlid}`;
    openDCMLink(url);
  }
}

//////////////////////////////////////

async function onOpenComicUrlInACBR(url) {
  if (!url) url = g_dcmUrlInput.value;
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

    let page = await getFirstPageInfo(comicId, 1);
    let comicData = {
      source: "dcm",
      comicId: comicId,
      name: page.name,
      numPages: page.numPages,
    };
    if (page.url) {
      sendIpcToMain("open", comicData);
    }
  }
}

function onOpenComicUrlInBrowser(url) {
  if (!url) url = g_dcmUrlInput.value;
  openDCMLink(url);
}

function openDCMLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "digitalcomicmuseum.com") {
    sendIpcToMain("open-url-in-browser", url);
  }
}

//////////////////////////////////////

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

//////////////////////////////////////

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
    g_openSelectedInBrowserButton.classList.remove("tools-disabled");
    g_openSelectedInACBRButton.classList.remove("tools-disabled");
  } else {
    g_openSelectedInBrowserButton.classList.add("tools-disabled");
    g_openSelectedInACBRButton.classList.add("tools-disabled");
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

//////////////////////////////////////

// ref: https://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
function isValidId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

function reducePathString(input) {
  let length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getOpenModal()) {
    modals.onInputEvent(getOpenModal(), type, event);
    return;
  }
  switch (type) {
    case "onkeydown": {
      if (event.key == "Tab") {
        event.preventDefault();
      }
      break;
    }
  }
}

export function onContextMenu(params) {
  if (getOpenModal()) {
    return;
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function closeModal() {
  if (g_openModal) {
    modals.close(g_openModal);
    modalClosed();
  }
}

function modalClosed() {
  g_openModal = undefined;
}

function showSearchModal() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: " ",
    message: " ",
    zIndexDelta: 5,
    frameWidth: 600,
    close: {
      callback: () => {
        modalClosed();
      },
      // key: "Escape",
      hide: true,
    },
    progressBar: {},
  });
}

function updateModalTitleText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-title").innerHTML = text;
}

function updateInfoText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-message").innerHTML = text;
}

function updateLogText(text, append = true) {
  if (g_openModal) {
    const log = g_openModal.querySelector(".modal-log");
    if (append) {
      log.innerHTML += "\n" + text;
    } else {
      log.innerHTML = text;
    }
    log.scrollTop = log.scrollHeight;
  }
}
