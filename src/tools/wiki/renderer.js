/**
 * @license
 * Copyright 2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import * as utils from "../../shared/renderer/utils.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_extraLocalization = {};

const g_homeUrl =
  "https://github.com/binarynonsense/comic-book-reader/wiki/Home"; //  "https://raw.githubusercontent.com/wiki/binarynonsense/comic-book-reader/Home.md";
let g_currentUrl;
let g_prevUrl;

export function needsScrollToTopButtonUpdate() {
  return true;
}

async function init(section, favorites) {
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
    .getElementById("tool-wiki-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });

  // sections menu
  for (let index = 0; index < 1; index++) {
    document
      .getElementById(`tool-wiki-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }

  switchSection(0);

  g_currentUrl = undefined;
  g_prevUrl = undefined;
  loadMdUrl(g_homeUrl);

  ////////////////////////////////////////

  updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight(scrollTop = false) {
  const columns = document.getElementById("tools-columns");
  const tools = document.getElementById("tools");
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
  if (tools.offsetHeight > columns.offsetHeight) {
    columns.style.height = "100%";
  } else {
    columns.style.height = "fit-content";
  }
  if (scrollTop) {
    document.getElementById("tools-columns-right").scrollIntoView({
      behavior: "instant",
      block: "start",
      inline: "nearest",
    });
  }
}

function switchSection(id) {
  for (let index = 0; index < 1; index++) {
    if (id === index) {
      document
        .getElementById(`tool-wiki-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-wiki-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-wiki-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-wiki-section-${index}-content-div`)
        .classList.add("set-display-none");
    }
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-wiki", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-wiki", ...args);
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
  on("show", (...args) => {
    init(...args);
  });

  on("hide", () => {});

  on("update-localization", (localization, extraLocalization) => {
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
    g_extraLocalization = extraLocalization;
  });

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });

  ///////////////

  on("load-content", (...args) => {
    loadContent(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("show-modal-info", (...args) => {
    showModalInfo(...args);
  });

  /////////////////////////////////////////////////////////////////////////////
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function loadMdUrl(url) {
  sendIpcToMain("load-md-url", url);
  showLoadingModal();
}

function loadContent(html, urlData) {
  closeModal();
  const url = urlData.url;
  if (g_currentUrl !== url) g_prevUrl = g_currentUrl;
  g_currentUrl = url;
  const condentDiv = document.querySelector("#tool-wiki-content-div");
  condentDiv.innerHTML =
    `<h1>${urlData.title.replace(/\-/g, " ").replace("%E2%80%90", "-")}</h1><hr>` +
    html;
  const links = condentDiv.querySelectorAll("a");
  links.forEach((link) => {
    let url = link.href;
    link.title = url;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (
        url &&
        url.startsWith(
          "https://github.com/binarynonsense/comic-book-reader/wiki/",
        )
      ) {
        loadMdUrl(url);
      } else {
        sendIpcToMain("open-url-in-browser", url);
      }
    });
  });
  ////
  document
    .querySelector("#tool-wiki-pagination-up-div")
    .replaceChildren(getFeedContentPaginationHtml());
  document
    .querySelector("#tool-wiki-pagination-down-div")
    .replaceChildren(getFeedContentPaginationHtml());
  ////
  condentDiv.querySelectorAll("p > code").forEach((code) => {
    const paragraph = code.parentElement;
    if (paragraph.textContent.trim() === code.textContent.trim()) {
      paragraph.classList.add("tools-html-lone-code-p");
    }
  });
  ////
  updateColumnsHeight(true);
}

function getFeedContentPaginationHtml() {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-arrow-left"></i>';
    if (g_prevUrl) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        loadMdUrl(g_prevUrl);
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-home"></i>';
    span.className = "tools-collection-pagination-button";
    span.addEventListener("click", (event) => {
      // if (g_currentUrl != g_homeUrl)
      loadMdUrl(g_homeUrl);
    });
    paginationDiv.appendChild(span);
  }
  return paginationDiv;
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
      } else if (event.key == "PageDown") {
        document.getElementById("tools").scrollBy({
          top: window.innerHeight,
          behavior: "auto",
        });
      } else if (event.key == "PageUp") {
        document.getElementById("tools").scrollBy({
          top: -window.innerHeight,
          behavior: "auto",
        });
      } else if (event.key == "ArrowDown") {
        document.getElementById("tools").scrollBy({
          top: 40,
          behavior: "auto",
        });
      } else if (event.key == "ArrowUp") {
        document.getElementById("tools").scrollBy({
          top: -40,
          behavior: "auto",
        });
      }
      break;
    }
  }
}

export function onContextMenu(params, target) {
  if (getOpenModal()) {
    return;
  }
  if (target.tagName === "IMG") {
    params.img = target.src;
  }
  sendIpcToMain("show-context-menu", params, target.tagName === "IMG");
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function showModal(config) {
  g_openModal = modals.show(config);
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

///////////

function showModalInfo(title, message, textButton1) {
  if (getOpenModal()) {
    closeModal();
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          modalClosed();
        },
        key: "Enter",
      },
    ],
  });
}

function showLoadingModal() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: g_extraLocalization.loadingTitle,
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
