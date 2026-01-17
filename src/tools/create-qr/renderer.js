/**
 * @license
 * Copyright 2020-2026 Álvaro García
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

let g_image;
let g_inputTextArea;
let g_startButton;
let g_clearButton;
let g_exportButton;

let g_localizedModalCloseButtonText = "";

export function needsScrollToTopButtonUpdate() {
  return true;
}

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

  document
    .getElementById("tool-cq-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-cq-start-button")
    .addEventListener("click", (event) => {
      onStart();
    });

  ////////////////////////////////////////

  g_image = document.querySelector("#tool-cq-image");
  g_inputTextArea = document.querySelector("#tool-cq-textarea-input");
  g_startButton = document.getElementById("tool-cq-start-button");
  g_clearButton = document.querySelector("#tool-cq-clear-button");
  g_exportButton = document.querySelector("#tool-cq-export-button");

  g_exportButton.addEventListener("click", (event) => {
    sendIpcToMain("export-to-file");
  });

  g_clearButton.addEventListener("click", (event) => {
    g_inputTextArea.value = "";
    onInputTextChanged(g_inputTextArea);
  });

  g_inputTextArea.addEventListener("input", (event) => {
    onInputTextChanged(g_inputTextArea);
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

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-create-qr", ...args);
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

  on("update-image", (base64) => {
    if (base64) {
      g_image.src = base64;
      g_exportButton.classList.remove("tools-disabled");
    }
  });

  on("show-modal-alert", (titleText, infoText, isError) => {
    if (g_openModal) {
      modals.close(g_openModal);
      g_openModal = undefined;
    }
    showAlertModal(titleText, infoText, isError);
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
  if (!g_openModal) showCreatingModal();

  sendIpcToMain("start", g_inputTextArea.value);
}

function onInputTextChanged(textArea) {
  if (textArea.value !== "") {
    g_startButton.classList.remove("tools-disabled");
    g_clearButton.classList.remove("tools-disabled");
  } else {
    g_startButton.classList.add("tools-disabled");
    g_clearButton.classList.add("tools-disabled");
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

function modalClosed() {
  g_openModal = undefined;
}

function showCreatingModal() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: " ",
    zIndexDelta: 5,
    frameWidth: 600,
    close: {
      hide: true,
    },
    progressBar: {},
  });
}

function showAlertModal(titleText, infoText, isError) {
  // TODO: use isError to color button red or green?
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: titleText,
    message: infoText,
    zIndexDelta: 5,
    frameWidth: 600,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: g_localizedModalCloseButtonText.toUpperCase(),
        callback: () => {
          modalClosed();
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
    if (element.id === "tool-et-modal-close-button-text") {
      g_localizedModalCloseButtonText = element.text;
    } else if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }
}
