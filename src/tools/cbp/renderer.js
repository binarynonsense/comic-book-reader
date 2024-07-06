/**
 * @license
 * Copyright 2024 Álvaro García
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

let g_dcmUrlInput;
let g_openInputInACBRButton;
let g_openInputInBrowserButton;

let g_localizedSearchPlaceholderText;
let g_localizedModalCancelButtonText;
let g_localizedModalCloseButtonText;
let g_localizedModalSearchingTitleText;

let g_searchResultsPrevUrls;
let g_searchResultsNextUrl;

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
    .getElementById("tool-cbp-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  for (let index = 0; index < 3; index++) {
    document
      .getElementById(`tool-cbp-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////

  // search
  g_searchButton = document.getElementById("tool-cbp-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-cbp-search-input");
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
  // url
  g_dcmUrlInput = document.getElementById("tool-cbp-url-input");
  g_openInputInACBRButton = document.getElementById(
    "tool-cbp-open-input-url-acbr-button"
  );
  g_openInputInBrowserButton = document.getElementById(
    "tool-cbp-open-input-url-browser-button"
  );

  g_dcmUrlInput.addEventListener("input", (event) => {
    if (event.target.value.startsWith("https://comicbookplus.com/?dlid=")) {
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
    .getElementById("tool-cbp-open-cbp-browser-button")
    .addEventListener("click", (event) => {
      openCBPLink(`https://comicbookplus.com`);
    });

  document
    .getElementById("tool-cbp-open-donate-browser-button")
    .addEventListener("click", (event) => {
      openCBPLink(`https://comicbookplus.com/?cbplus=sponsorcomicbookplus`);
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
  for (let index = 0; index < 3; index++) {
    if (id === index) {
      document
        .getElementById(`tool-cbp-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-cbp-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-cbp-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-cbp-section-${index}-content-div`)
        .classList.add("set-display-none");
    }

    if (index === 0) {
      g_searchInput.focus();
    }
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-cbp", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-cbp", ...args);
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
      modalSearchingTitleText,
      modalCloseButtonText,
      modalCancelButtonText,
      localization
    ) => {
      g_localizedSearchPlaceholderText = searchPlaceHolder;
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
      "#tool-cbp-search-results-div"
    );
    searchResultsDiv.innerHTML = "";
    // pagination top
    if (results.hasNext || results.hasPrev) {
      searchResultsDiv.appendChild(generatePaginationHtml(results));
    }
    // list
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    if (results && results.links && results.links.length > 0) {
      for (let index = 0; index < results.links.length; index++) {
        const result = results.links[index];
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
    // pagination top
    if (results.hasNext || results.hasPrev) {
      searchResultsDiv.appendChild(generatePaginationHtml(results));
    }

    updateColumnsHeight();
    document.getElementById("tools-columns-right").scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    closeModal();
  });
}

function generatePaginationHtml(results) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  if (results.pageNum > 1) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(1, results.query);
    });
    paginationDiv.appendChild(span);
  }
  if (results.hasPrev) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(results.pageNum - 1, results.query);
    });
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` | `;
  paginationDiv.appendChild(span);
  if (results.hasNext) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(results.pageNum + 1, results.query);
    });
    paginationDiv.appendChild(span);
  }
  // NOTE: don't know the total number of pages, so can't add a button to
  // go to the end directly
  return paginationDiv;
}

function updateResultsDDG(
  searchResults,
  noResultsText,
  openInAcbrText,
  openInBrowserText
) {
  ///////////////////////////////////////////
  //
  document
    .querySelector("#tool-search-results-h3")
    .classList.remove("set-display-none");
  const searchResultsDiv = document.querySelector(
    "#tool-cbp-search-results-div"
  );
  searchResultsDiv.innerHTML = "";
  ////////////////////////////////////////////
  if (searchResults && searchResults.links.length > 0) {
    // pagination top
    if (searchResults.prevUrl || searchResults.nextUrl) {
      searchResultsDiv.appendChild(generatePaginationHtmlDDG(searchResults));
    }
    // list
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    for (let index = 0; index < searchResults.links.length; index++) {
      const bookData = searchResults.links[index];
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
        text.innerText = reduceString(bookData.title);
        multilineText.appendChild(text);
      }
      buttonSpan.appendChild(multilineText);
      buttonSpan.addEventListener("click", (event) => {
        onSearchResultClicked(bookData.id, 0);
      });
      li.appendChild(buttonSpan);
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fas fa-link"></i>`;
        buttonSpan.title = openInBrowserText;
        buttonSpan.addEventListener("click", (event) => {
          onSearchResultClicked(bookData.id, 1);
        });
        li.appendChild(buttonSpan);
      }
      ul.appendChild(li);
    }
    searchResultsDiv.appendChild(ul);
    // pagination top
    if (searchResults.prevUrl || searchResults.nextUrl) {
      searchResultsDiv.appendChild(generatePaginationHtmlDDG(searchResults));
    }
  } else {
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    let li = document.createElement("li");
    li.className = "tools-collection-li";
    let text = document.createElement("span");
    text.innerText = noResultsText;
    li.appendChild(text);
    ul.appendChild(li);
    searchResultsDiv.appendChild(ul);
  }
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  closeModal();
}

function generatePaginationHtmlDDG(searchResults) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  // if (g_searchResultsPrevUrls.length > 1) {
  //   let span = document.createElement("span");
  //   span.className = "tools-collection-pagination-button";
  //   span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
  //   span.addEventListener("click", (event) => {
  //     onSearch(searchResults.text, g_searchResultsPrevUrls[0]);
  //   });
  //   paginationDiv.appendChild(span);
  // }
  if (searchResults.prevUrl) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(searchResults.text, searchResults.prevUrl);
    });
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` | `;
  paginationDiv.appendChild(span);
  if (searchResults.nextUrl) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(searchResults.text, searchResults.nextUrl);
    });
    paginationDiv.appendChild(span);
  }
  // NOTE: don't know the total number of pages, so can't add a button to
  // go to the end directly
  return paginationDiv;
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onSearch(pageNum = 1, query = undefined) {
  if (!query) query = g_searchInput.value + " site:comicbookplus.com";
  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_localizedModalSearchingTitleText);
  // <input type="hidden" name="q" value="mars site:comicbookplus.com">
  // <input type="hidden" name="category_general" value="1">
  // <input type="hidden" name="pageno" value="2">
  // <input type="hidden" name="language" value="en-US">
  // <input type="hidden" name="time_range" value="">
  // <input type="hidden" name="safesearch" value="1">
  // <input type="hidden" name="theme" value="beetroot"> // or simple
  try {
    const formData = new FormData();
    formData.append("q", query);
    formData.append("category_general", "1");
    formData.append("pageno", pageNum);
    formData.append("language", "en-US");
    formData.append("time_range", "");
    formData.append("safesearch", "1");
    formData.append("theme", "simple");
    const response = await axios.post(
      "https://search.disroot.org/search",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 15000,
        withCredentials: true,
      }
    );
    sendIpcToMain("search", response.data, query, pageNum);
    // sendIpcToMain("search", undefined, query, pageNum);
  } catch (error) {
    sendIpcToMain("search", undefined, query, pageNum, error.message);
  }
}

// async function onSearch(text, url) {
//   if (!url) {
//     text = g_searchInput.value;
//     g_searchResultsPrevUrls = [];
//     g_searchResultsNextUrl = undefined;
//   }
//   if (!g_openModal) showSearchModal(); // TODO: check if first time?
//   updateModalTitleText(g_localizedModalSearchingTitleText);
//   // DDG: sendIpcToMain("search", text, url, window.navigator.userAgent);
//   sendIpcToMain("search", text, url, window.navigator.userAgent);
// }

async function onSearchResultClicked(dlid, openWith) {
  if (openWith === 0) {
    try {
      let url = `https://comicbookplus.com/?dlid=${dlid}`;
      onOpenComicUrlInACBR(url);
    } catch (error) {
      console.log(error);
    }
  } else {
    let url = `https://comicbookplus.com/?dlid=${dlid}`;
    openCBPLink(url);
  }
}

//////////////////////////////////////

async function onOpenComicUrlInACBR(url) {
  try {
    if (!url) url = g_dcmUrlInput.value;
    const tmp = document.createElement("a");
    tmp.href = url;
    if (tmp.host === "comicbookplus.com") {
      let comicId;
      let parts = url.split("dlid=");
      if (parts.length === 2 && isValidId(parts[1])) {
        comicId = parts[1];
      }
      if (!comicId) return;

      let page = await getFirstPageInfo(comicId, 1);
      let comicData = {
        source: "cbp",
        comicId: comicId,
        name: page.name,
        numPages: page.numPages,
        url: `https://comicbookplus.com/?dlid=${comicId}`,
      };
      if (page.url) {
        sendIpcToMain("open", comicData);
      }
    }
  } catch (error) {}
}

function onOpenComicUrlInBrowser(url) {
  if (!url) url = g_dcmUrlInput.value;
  openCBPLink(url);
}

function openCBPLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "comicbookplus.com") {
    sendIpcToMain("open-url-in-browser", url);
  }
}

//////////////////////////////////////

async function getFirstPageInfo(comicId) {
  try {
    const response = await axios.get(
      `https://comicbookplus.com/?dlid=${comicId}`,
      { timeout: 15000 }
    );
    const regex = /comicnumpages=(.*);/;
    let match = response.data.match(regex);
    let numPages = match[1];
    const parser = new DOMParser().parseFromString(response.data, "text/html");
    let title = parser.title.replace(" - Comic Book Plus", "");
    //e.g. <img src="https://box01.comicbookplus.com/viewer/5e/5e287e0a63a5733bb2fd0e5c49f80f4d/9.jpg" id="maincomic" width="975" alt="Book Cover For Space Action 1" onclick="turnpage(1)" itemprop="image">
    let imageUrl = parser.getElementById("maincomic").src;
    return { url: imageUrl, numPages: numPages, name: title };
  } catch (error) {
    console.error(error);
  }
}

//////////////////////////////////////

// ref: https://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
function isValidId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

function reduceString(input) {
  if (!input) return undefined;
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
