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
import axios from "../../assets/libs/axios/dist/esm/axios.js";

let g_catalogNumberSelect;
let g_openSelectedInACBRButton;
let g_openSelectedInBrowserButton;

let g_totalNumComics;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

async function init(selectCatalogNumberLocalizedText) {
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
    .getElementById("tool-xkcd-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  for (let index = 0; index < 2; index++) {
    document
      .getElementById(`tool-xkcd-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  // catalog
  g_catalogNumberSelect = document.querySelector(
    "#tool-xkcd-catalog-number-select"
  );
  g_catalogNumberSelect.addEventListener("change", (event) => {
    if (g_catalogNumberSelect.value == -1) {
      g_openSelectedInACBRButton.classList.add("tools-disabled");
      g_openSelectedInBrowserButton.classList.add("tools-disabled");
    } else {
      g_openSelectedInACBRButton.classList.remove("tools-disabled");
      g_openSelectedInBrowserButton.classList.remove("tools-disabled");
    }
  });

  g_openSelectedInACBRButton = document.querySelector(
    "#tool-xkcd-open-selected-acbr-button"
  );
  g_openSelectedInACBRButton.addEventListener("click", (event) => {
    const number = g_catalogNumberSelect.value;
    if (!number || number == -1) return;

    let comicData = {
      source: "xkcd",
      name: "xkcd",
      numPages: g_totalNumComics,
    };
    sendIpcToMain("open", comicData, number);
  });

  g_openSelectedInBrowserButton = document.querySelector(
    "#tool-xkcd-open-selected-browser-button"
  );
  g_openSelectedInBrowserButton.addEventListener("click", async (event) => {
    const number = g_catalogNumberSelect.value;
    if (!number || number == "-1") return;
    try {
      const response = await axios.get(
        `https://xkcd.com/${number}/info.0.json`,
        {
          timeout: 10000,
        }
      );
      const url = response?.data?.img;
      if (url) openXkcdLink(url);
    } catch (error) {}
  });

  let selectNumberContent = `<option value="-1">${selectCatalogNumberLocalizedText}</option>`;
  try {
    const response = await axios.get("https://xkcd.com/info.0.json", {
      timeout: 10000,
    });
    g_totalNumComics = response?.data?.num;
    if (g_totalNumComics) {
      for (let index = g_totalNumComics; index > 0; index--) {
        selectNumberContent += `<option value="${index}">${index}</option>`;
      }
    }
    g_catalogNumberSelect.innerHTML = selectNumberContent;
  } catch (error) {
    g_catalogNumberSelect.innerHTML = selectNumberContent;
  }
  // about
  document
    .getElementById("tool-xkcd-open-dcm-browser-button")
    .addEventListener("click", (event) => {
      openXkcdLink(`https://xkcd.com/`);
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
  for (let index = 0; index < 2; index++) {
    if (id === index) {
      document
        .getElementById(`tool-xkcd-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-xkcd-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-xkcd-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-xkcd-section-${index}-content-div`)
        .classList.add("set-display-none");
    }
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-xkcd", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-xkcd", ...args);
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
  on("show", (selectCatalogNumberLocalizedText) => {
    init(selectCatalogNumberLocalizedText);
  });

  on("hide", () => {});

  on("update-localization", (localization) => {
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
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
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function openXkcdLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "imgs.xkcd.com" || tmp.host === "xkcd.com") {
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
