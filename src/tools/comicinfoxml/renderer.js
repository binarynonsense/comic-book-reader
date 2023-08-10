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

let g_localizedModalUpdatingTitleText;
let g_localizedModalSavingTitleText;
let g_localizedModalLoadingTitleText;

let g_saveButton;
let g_langSelect;
let g_pagesDiv;

let g_fields = [];

function init(isoLangNames, isoLangCodes) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  // menu buttons
  document
    .getElementById("tool-cix-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  g_saveButton = document.getElementById("tool-cix-save-button");
  g_saveButton.addEventListener("click", (event) => {
    onSave();
  });
  g_saveButton.classList.add("tools-disabled");
  // sections menu
  for (let index = 0; index < 4; index++) {
    document
      .getElementById(`tool-cix-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  g_langSelect = document.getElementById("tool-cix-data-languageiso-select");
  g_langSelect.innerHTML += `<option value="default"></option>`;
  isoLangNames.forEach((name, i) => {
    g_langSelect.innerHTML += `<option value="${isoLangCodes[i]}">${name}</option>`;
  });
  g_pagesDiv = document.getElementById("tool-cix-pages-data-div");
  let ul = document.createElement("ul");
  ul.className = "tools-collection-ul";
  let li = document.createElement("li");
  li.className = "tools-collection-li";
  li.innerHTML = "&nbsp;";
  ul.appendChild(li);
  g_pagesDiv.appendChild(ul);
  ////////////////////////////////////////
  // generate fields array
  let elements = document
    .querySelector("#tools-columns-right")
    .getElementsByTagName("input");
  elements = [
    ...elements,
    ...document
      .querySelector("#tools-columns-right")
      .getElementsByTagName("select"),
  ];
  elements = [
    ...elements,
    ...document
      .querySelector("#tools-columns-right")
      .getElementsByTagName("textarea"),
  ];
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index];
    g_fields.push({
      element: element,
      xmlId: element.getAttribute("data-xml-id"),
      xmlType: element.getAttribute("data-xml-type"),
    });
  }
  // add event listeners
  g_fields.forEach((field) => {
    if (field.xmlId) {
      if (
        field.element.tagName.toLowerCase() === "input" ||
        field.element.tagName.toLowerCase() === "textarea"
      )
        field.element.addEventListener("input", (event) => {
          onFieldChanged(field.element);
        });
      else if (field.element.tagName.toLowerCase() === "select")
        field.element.addEventListener("change", (event) => {
          onFieldChanged(field.element);
        });
    }
  });
  ////////////////////////////////////////
  if (!g_openModal) closeModal(g_openModal);
  showProgressModal();
  updateModalTitleText(g_localizedModalLoadingTitleText);
  sendIpcToMain("load-xml");
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
  for (let index = 0; index < 4; index++) {
    if (id === index) {
      document
        .getElementById(`tool-cix-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-cix-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-cix-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-cix-section-${index}-content-div`)
        .classList.add("set-display-none");
    }
  }
  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-comicinfoxml", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-comicinfoxml", ...args);
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
  on("show", (isoLangNames, isoLangCodes) => {
    init(isoLangNames, isoLangCodes);
  });

  on("hide", () => {});

  on(
    "update-localization",
    (
      modalUpdatingTitleText,
      modalSavingTitleText,
      modalLoadingTitleText,
      localization,
      tooltipsLocalization
    ) => {
      g_localizedModalUpdatingTitleText = modalUpdatingTitleText;
      g_localizedModalSavingTitleText = modalSavingTitleText;
      g_localizedModalLoadingTitleText = modalLoadingTitleText;
      for (let index = 0; index < localization.length; index++) {
        const element = localization[index];
        const domElement = document.querySelector("#" + element.id);
        if (domElement !== null) {
          domElement.innerHTML = element.text;
        }
      }
      for (let index = 0; index < tooltipsLocalization.length; index++) {
        const element = tooltipsLocalization[index];
        const domElement = document.querySelector("#" + element.id);
        if (domElement !== null) {
          domElement.title = element.text;
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

  on("load-json", (json) => {
    onLoadJson(json);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function onFieldChanged(element) {
  // TODO: reenable
  //g_saveButton.classList.remove("tools-disabled");
}

function onLoadJson(json) {
  // console.log(json);

  // fill UI with json data
  for (let index = 0; index < g_fields.length; index++) {
    const field = g_fields[index];
    if (!field.xmlId || !field.xmlType) continue;
    let value = json["ComicInfo"][field.xmlId];
    if (value && value !== "") {
      if (field.xmlType !== "Page") {
        // sanitize
        if (field.element.tagName.toLowerCase() === "select") {
          if (!field.element.querySelector('[value="' + value + '"]')) continue;
        }
        // update element's value
        field.element.value = value;
      }
    }
  }

  //////////////////////////////////
  closeModal();
}

async function onSave() {
  if (g_openModal) return;
  showProgressModal();
  updateModalTitleText(g_localizedModalSavingTitleText);
  // sendIpcToMain
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

function showProgressModal() {
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
