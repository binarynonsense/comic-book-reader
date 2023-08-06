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
import Cropper from "../../assets/libs/cropperjs/dist/cropper.esm.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_cropper;
let g_image;
let g_languageOfflineSelect;
let g_languageOnlineSelect;
let g_languageCheckbox;
let g_outputTextArea;
let g_copyTextButton;

let g_localizedModalCancelButtonText = "";

function init(filePath) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }

  document
    .getElementById("tool-et-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-et-start-button")
    .addEventListener("click", (event) => {
      switchSection(0);
      onStart();
    });
  // sections menu
  document
    .getElementById("tool-et-section-general-options-button")
    .addEventListener("click", (event) => {
      switchSection(0);
    });
  document
    .getElementById("tool-et-section-advanced-options-button")
    .addEventListener("click", (event) => {
      switchSection(1);
    });

  ////////////////////////////////////////

  g_image = document.querySelector("#tool-et-image");
  g_outputTextArea = document.querySelector("#tool-et-textarea-output");
  g_copyTextButton = document.querySelector("#tool-et-copy-text-button");
  g_languageOfflineSelect = document.querySelector(
    "#tool-et-language-select-offline"
  );
  g_languageOnlineSelect = document.querySelector(
    "#tool-et-language-select-online"
  );
  g_languageCheckbox = document.querySelector("#tool-et-language-checkbox");

  g_copyTextButton.addEventListener("click", (event) => {
    sendIpcToMain("copy-text-to-clipboard", g_outputTextArea.innerHTML);
  });

  g_languageCheckbox.addEventListener("click", (event) => {
    if (g_languageCheckbox.checked) {
      g_languageOfflineSelect.classList.add("set-display-none");
      g_languageOnlineSelect.classList.remove("set-display-none");
    } else {
      g_languageOfflineSelect.classList.remove("set-display-none");
      g_languageOnlineSelect.classList.add("set-display-none");
    }
  });

  document
    .getElementById("tool-et-add-file-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("choose-file");
    });

  g_cropper = new Cropper(g_image, {
    ready: function () {},
    dragMode: "move",
    viewMode: 2,
    rotatable: false,
    toggleDragModeOnDblclick: true,
    autoCropArea: 1, // 0-1, default 0.8
  });

  if (filePath) g_cropper.replace(filePath);

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
  switch (id) {
    case 0:
      // buttons
      document
        .getElementById("tool-et-section-general-options-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-et-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-et-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-et-advanced-output-options-section-div")
        .classList.add("set-display-none");
      break;
    case 1:
      // buttons
      document
        .getElementById("tool-et-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-et-section-advanced-options-button")
        .classList.add("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-et-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-et-advanced-output-options-section-div")
        .classList.remove("set-display-none");
      break;
  }
  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-extract-text", ...args);
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
  on("show", (filePath) => {
    init(filePath);
  });

  on("hide", () => {});

  on("update-localization", (localization) => {
    updateLocalization(localization);
  });

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("update-image", (filePath) => {
    g_cropper.replace(filePath);
  });

  on("fill-textarea", (text) => {
    g_outputTextArea.innerHTML = text;
    if (text && text !== "") {
      g_copyTextButton.classList.remove("tools-disabled");
    } else {
      g_copyTextButton.classList.add("tools-disabled");
    }
  });

  on("modal-close", () => {
    modals.close(g_openModal);
    g_openModal = undefined;
  });

  /////////////////////////////////////////////////////////////////////////////

  on("modal-update-title-text", (text) => {
    updateModalTitleText(text);
  });

  on("modal-update-info-text", (text) => {
    updateModalInfoText(text);
  });

  on("modal-update-log-text", (text) => {
    updateModalLogText(text);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function onStart() {
  if (!g_openModal) showExtractingModal();

  let lang;
  let offline;
  if (g_languageCheckbox.checked) {
    lang = g_languageOnlineSelect.value;
    offline = false;
  } else {
    lang = g_languageOfflineSelect.value;
    offline = true;
  }
  const word = "offline-";
  if (lang.startsWith(word)) {
    lang = lang.slice(word.length);
  }
  g_outputTextArea.innerHTML = "";
  let base64Img = g_cropper.getCroppedCanvas().toDataURL();

  sendIpcToMain("start", base64Img, lang, offline);
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

function modalClosed() {
  g_openModal = undefined;
}

function showExtractingModal() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: " ",
    zIndexDelta: 5,
    frameWidth: 600,
    close: {
      callback: () => {
        sendIpcToMain("cancel-extraction");
        modalClosed(); // reduntant?, cancel calls modal-close
      },
      key: "Escape",
    },
    progressBar: {},
    log: {},
    buttons: [
      {
        text: g_localizedModalCancelButtonText.toUpperCase(),
        callback: (value) => {
          sendIpcToMain("cancel-extraction");
          modalClosed(); // reduntant?, cancel calls modal-close
        },
      },
    ],
  });
}

function updateModalTitleText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-title").innerHTML = text;
}

function updateModalInfoText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-message").innerHTML = text;
}

function updateModalLogText(text, append = true) {
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

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.querySelector("#" + element.id);
    if (element.id === "tool-et-modal-cancel-button-text") {
      g_localizedModalCancelButtonText = element.text;
    } else if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }
}
