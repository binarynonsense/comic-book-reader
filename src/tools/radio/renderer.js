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
    .getElementById("tool-radio-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  for (let index = 0; index < 3; index++) {
    document
      .getElementById(`tool-radio-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  // search
  g_searchButton = document.getElementById("tool-radio-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-radio-search-input");
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
  // options
  //  g_collectionSelect = document.querySelector(
  //   "#tool-radio-options-collections-select"
  // );
  // g_availabilitySelect = document.querySelector(
  //   "#tool-radio-options-availability-select"
  // );

  // g_collectionSelect.innerHTML = collectionsContent;
  // g_availabilitySelect.innerHTML = availabilityContent;
  // about
  document
    .getElementById("tool-radio-open-radio-browser-button")
    .addEventListener("click", (event) => {
      openRadioBrowserLink(`https://www.radio-browser.info/`);
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
        .getElementById(`tool-radio-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-radio-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-radio-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-radio-section-${index}-content-div`)
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
  coreSendIpcToMain("tool-radio", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-radio", ...args);
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
    (searchResults, noResultsText, openInAcbrText, openInBrowserText) => {
      // console.log(searchResults);
      g_lastSearchResults = searchResults;
      ///////////////////////////////////////////
      document
        .querySelector("#tool-search-results-h3")
        .classList.remove("set-display-none");
      const searchResultsDiv = document.querySelector(
        "#tool-radio-search-results-div"
      );
      searchResultsDiv.innerHTML = "";
      if (searchResults && searchResults.length > 0) {
        // list
        let ul = document.createElement("ul");
        ul.className = "tools-collection-ul";
        for (let index = 0; index < searchResults.length; index++) {
          const stationData = searchResults[index];

          let li = document.createElement("li");
          li.className = "tools-buttons-list-li";
          let buttonSpan = document.createElement("span");
          buttonSpan.className = "tools-buttons-list-button";
          buttonSpan.innerHTML = `<i class="fas fa-music fa-2x"></i>`;
          buttonSpan.title = openInAcbrText;
          let multilineText = document.createElement("span");
          multilineText.className = "tools-buttons-list-li-multiline-text";
          {
            let text = document.createElement("span");
            text.innerText = `${stationData.name}`;
            multilineText.appendChild(text);

            text = document.createElement("span");
            let extraData = `${stationData.bitrate} kbps | ${stationData.codec} | ${stationData.countrycode} | ${stationData.language} | ${stationData.tags}`;
            text.innerHTML = extraData;
            multilineText.appendChild(text);
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

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onSearch() {
  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_localizedModalSearchingTitleText);
  sendIpcToMain("search", g_searchInput.value, {
    order: document.querySelector("#tool-radio-options-orderby-select").value,
    language: document.querySelector("#tool-radio-options-language-input")
      .value,
    countrycode: document.querySelector("#tool-radio-options-countrycode-input")
      .value,
    tag: document.querySelector("#tool-radio-options-tag-input").value,
    taglist: document.querySelector("#tool-radio-options-taglist-input").value,
  });
}

async function onSearchResultClicked(index, mode) {
  if (!g_lastSearchResults) return;
  const stationData = g_lastSearchResults[index];
  if (mode === 0) {
    sendIpcToMain(
      "open",
      stationData.stationuuid,
      stationData.name,
      stationData.url_resolved
    );
  } else {
    openStationLink(stationData.url_resolved);
  }
}

//////////////////////////////////////

function openRadioBrowserLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "www.radio-browser.info") {
    sendIpcToMain("open-url-in-browser", url);
  }
}

function openStationLink(url) {
  sendIpcToMain("open-url-in-browser", url);
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
