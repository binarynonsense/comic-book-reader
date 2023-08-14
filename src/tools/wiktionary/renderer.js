/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_searchInput;
let g_searchButton;

let g_localizedSearchPlaceholderText;
let g_localizedModalSearchingTitleText;

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
    .getElementById("tool-wik-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  for (let index = 0; index < 2; index++) {
    document
      .getElementById(`tool-wik-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  // search
  g_searchButton = document.getElementById("tool-wik-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-wik-search-input");
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
    .getElementById("tool-wik-open-wik-browser-button")
    .addEventListener("click", (event) => {
      openWikLink(`https://www.wiktionary.org/`);
    });

  document
    .getElementById("tool-wik-open-donate-browser-button")
    .addEventListener("click", (event) => {
      openWikLink(`https://donate.wikimedia.org/`);
    });

  ////////////////////////////////////////
  updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight() {
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
}

function switchSection(id) {
  for (let index = 0; index < 2; index++) {
    if (id === index) {
      document
        .getElementById(`tool-wik-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-wik-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-wik-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-wik-section-${index}-content-div`)
        .classList.add("set-display-none");
    }

    if (index === 0) {
      g_searchInput.focus();
    }
  }
  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-wiktionary", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-wiktionary", ...args);
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
  on("show", (collectionsContent, availabilityContent) => {
    init(collectionsContent, availabilityContent);
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

  on("update-results", (content) => {
    document
      .querySelector("#tool-search-results-h3")
      .classList.remove("set-display-none");
    const searchResultsDiv = document.querySelector(
      "#tool-wik-search-results-div"
    );
    searchResultsDiv.innerHTML = "";
    content = `<div class="tools-html-div">${content}</div>`;
    searchResultsDiv.innerHTML = content;
    ///////////////////////////////////////////
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

async function onSearch(inputValue = undefined) {
  if (!inputValue) inputValue = g_searchInput.value;
  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_localizedModalSearchingTitleText);
  sendIpcToMain(
    "search",
    inputValue,
    document.getElementById("tool-wik-search-language-select").value
  );
}

//////////////////////////////////////

function openWikLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (
    tmp.host === "www.wiktionary.org" ||
    tmp.host === "donate.wikimedia.org"
  ) {
    sendIpcToMain("open-url-in-browser", url);
  }
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getOpenModal()) {
    modals.onInputEvent(getOpenModal(), type, event);
    return;
  }
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
