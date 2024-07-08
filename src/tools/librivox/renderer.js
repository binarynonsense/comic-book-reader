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

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_searchInput;
let g_searchButton;

let g_localizedSearchPlaceholderText;
let g_localizedModalSearchingTitleText;

let g_lastSearchResults;

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

  g_lastSearchResults = undefined;

  // menu buttons
  document
    .getElementById("tool-lvx-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  for (let index = 0; index < 3; index++) {
    document
      .getElementById(`tool-lvx-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  // search
  g_searchButton = document.getElementById("tool-lvx-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-lvx-search-input");
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
  // about
  document
    .getElementById("tool-lvx-open-lvx-browser-button")
    .addEventListener("click", (event) => {
      openLvxLink(`https://librivox.org/`);
    });

  document
    .getElementById("tool-lvx-open-donate-browser-button")
    .addEventListener("click", (event) => {
      openLvxLink(`https://librivox.org/pages/donate-to-librivox/`);
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
        .getElementById(`tool-lvx-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-lvx-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-lvx-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-lvx-section-${index}-content-div`)
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
  coreSendIpcToMain("tool-librivox", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-librivox", ...args);
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
  on("show", () => {
    init();
  });

  on("hide", () => {});

  on(
    "update-localization",
    (searchPlaceHolderText, modalSearchingTitleText, localization) => {
      g_localizedSearchPlaceholderText = searchPlaceHolderText;
      g_localizedModalSearchingTitleText = modalSearchingTitleText;
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

  on(
    "update-results",
    (
      searchResults,
      noResultsText,
      queryInputText,
      pageNum,
      queryPageSize,
      openInAcbrText,
      openInBrowserText
    ) => {
      g_lastSearchResults = searchResults;
      ///////////////////////////////////////////
      document
        .querySelector("#tool-search-results-h3")
        .classList.remove("set-display-none");
      const searchResultsDiv = document.querySelector(
        "#tool-lvx-search-results-div"
      );
      searchResultsDiv.innerHTML = "";
      // e.g.
      // docs: (8) [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}]
      // numFound: 8
      // start: 0
      const totalResultsNum = searchResults?.response?.numFound;
      if (searchResults && totalResultsNum && totalResultsNum > 0) {
        const queryResultsNum = searchResults.response.docs.length;
        // pagination top
        if (totalResultsNum > queryPageSize) {
          const totalPagesNum = Math.ceil(totalResultsNum / queryPageSize);
          searchResultsDiv.appendChild(
            generatePaginationHtml(pageNum, totalPagesNum, queryInputText)
          );
        }
        // list
        let ul = document.createElement("ul");
        ul.className = "tools-collection-ul";
        for (let index = 0; index < queryResultsNum; index++) {
          const bookData = searchResults.response.docs[index];
          // e.g.
          // identifier: "originalillustra00cast"
          // imagecount: 650
          // title: "The Original Illustrated Sherlock Holmes"
          // create html
          let li = document.createElement("li");
          li.className = "tools-buttons-list-li";
          let buttonSpan = document.createElement("span");
          buttonSpan.className = "tools-buttons-list-button";
          buttonSpan.innerHTML = `<i class="fas fa-file-audio fa-2x"></i>`;
          buttonSpan.title = openInAcbrText;
          let multilineText = document.createElement("span");
          multilineText.className = "tools-buttons-list-li-multiline-text";
          {
            let text = document.createElement("span");
            text.innerText = reduceString(bookData.title);
            multilineText.appendChild(text);

            if (bookData.creator && bookData.creator !== "") {
              let authors = reduceString(bookData.creator);
              let text = document.createElement("span");
              text.innerText = `${authors}`;
              multilineText.appendChild(text);
            }
          }
          buttonSpan.appendChild(multilineText);
          buttonSpan.addEventListener("click", (event) => {
            onSearchResultClicked(index, 0);
          });
          li.appendChild(buttonSpan);
          {
            let buttonSpan = document.createElement("span");
            buttonSpan.className = "tools-buttons-list-button";
            buttonSpan.innerHTML = `<i class="fas fa-link"></i>`;
            buttonSpan.title = openInBrowserText;
            buttonSpan.addEventListener("click", (event) => {
              onSearchResultClicked(index, 1);
            });
            li.appendChild(buttonSpan);
          }
          ul.appendChild(li);
        }
        searchResultsDiv.appendChild(ul);
        // pagination bottom
        if (totalResultsNum > queryPageSize) {
          const totalPagesNum = Math.ceil(totalResultsNum / queryPageSize);
          searchResultsDiv.appendChild(
            generatePaginationHtml(pageNum, totalPagesNum, queryInputText)
          );
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
  );
}

function generatePaginationHtml(pageNum, totalPagesNum, queryInputText) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  if (pageNum > 2) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(1, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  if (pageNum > 1) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(pageNum - 1, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` ${pageNum} / ${totalPagesNum} `;
  paginationDiv.appendChild(span);
  if (pageNum < totalPagesNum) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(pageNum + 1, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  if (pageNum < totalPagesNum - 1) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-double-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(totalPagesNum, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  return paginationDiv;
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onSearch(pageNum = 1, inputValue = undefined) {
  if (!inputValue) inputValue = g_searchInput.value;
  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_localizedModalSearchingTitleText);
  sendIpcToMain("search", inputValue, pageNum);
}

async function onSearchResultClicked(index, mode) {
  if (!g_lastSearchResults) return;
  const bookData = g_lastSearchResults.response.docs[index];
  if (mode === 0) {
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
        sendIpcToMain("open", bookData.identifier, fileUrls);
      }
    } catch (error) {
      console.log(error);
    }
  } else {
    let url = `https://archive.org/details/${bookData.identifier}`;
    openLvxLink(url);
  }
}

//////////////////////////////////////

function openLvxLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "archive.org" || tmp.host === "librivox.org") {
    sendIpcToMain("open-url-in-browser", url);
  }
}

//////////////////////////////////////

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
