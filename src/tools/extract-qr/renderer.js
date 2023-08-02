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
let g_outputTextArea;
let g_copyTextButton;

let g_localizedModalCloseButtonText = "";
let g_localizedModalCancelButtonText = "";

function init(filePath) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }

  document
    .getElementById("tool-eq-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-eq-start-button")
    .addEventListener("click", (event) => {
      onStart();
    });

  ////////////////////////////////////////

  g_image = document.querySelector("#tool-eq-image");
  g_outputTextArea = document.querySelector("#tool-eq-textarea-output");
  g_copyTextButton = document.querySelector("#tool-eq-copy-text-button");

  g_copyTextButton.addEventListener("click", (event) => {
    sendIpcToMain("copy-text-to-clipboard", g_outputTextArea.innerHTML);
  });

  document
    .getElementById("tool-eq-add-file-button")
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

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-extract-qr", ...args);
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
    g_outputTextArea.value = text;
    if (text && text !== "") {
      g_copyTextButton.classList.remove("tools-disabled");
    } else {
      g_copyTextButton.classList.add("tools-disabled");
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
  if (!g_openModal) showExtractingModal();

  try {
    g_outputTextArea.value = "";
    let canvas = g_cropper.getCroppedCanvas();
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    sendIpcToMain("start", imageData, canvas.width, canvas.height);
  } catch (error) {
    sendIpcToMain("cancel-extraction", error);
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
    if (element.id === "tool-eq-modal-cancel-button-text") {
      g_localizedModalCancelButtonText = element.text;
    } else if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }
}
