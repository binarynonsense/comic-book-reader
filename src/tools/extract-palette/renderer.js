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
import { encodeImgPath } from "../../shared/renderer/utils.js";
import Cropper from "../../assets/libs/cropperjs/dist/cropper.esm.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_cropper;
let g_image;
let g_saveButton;
let g_exportFormatSelect;

let g_localizedModalCloseButtonText = "";
let g_localizedModalCancelButtonText = "";

function init(filePath) {
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
    .getElementById("tool-ep-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-ep-start-button")
    .addEventListener("click", (event) => {
      switchSection(0);
      onStart();
    });
  document
    .getElementById("tool-ep-export-to-file-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("export-to-file", g_exportFormatSelect.value);
    });

  // sections menu
  document
    .getElementById("tool-ep-section-general-options-button")
    .addEventListener("click", (event) => {
      switchSection(0);
    });
  document
    .getElementById("tool-ep-section-advanced-options-button")
    .addEventListener("click", (event) => {
      switchSection(1);
    });

  ////////////////////////////////////////

  g_image = document.querySelector("#tool-ep-image");
  g_saveButton = document.querySelector("#tool-ep-export-to-file-button");
  g_exportFormatSelect = document.querySelector(
    "#tool-ep-export-format-select"
  );

  document
    .getElementById("tool-ep-add-file-button")
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

  if (filePath) g_cropper.replace(encodeImgPath(filePath));

  const paletteContainer = document.getElementById("tool-ep-palette");
  paletteContainer.innerHTML = "";
  g_saveButton.classList.add("tools-disabled");

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
  switch (id) {
    case 0:
      // buttons
      document
        .getElementById("tool-ep-section-general-options-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-ep-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ep-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ep-advanced-output-options-section-div")
        .classList.add("set-display-none");
      break;
    case 1:
      // buttons
      document
        .getElementById("tool-ep-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ep-section-advanced-options-button")
        .classList.add("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ep-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ep-advanced-output-options-section-div")
        .classList.remove("set-display-none");
      break;
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-extract-palette", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-extract-palette", ...args);
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
    g_cropper.replace(encodeImgPath(filePath));
  });

  on("update-palette", (palette) => {
    const paletteContainer = document.getElementById("tool-ep-palette");
    paletteContainer.innerHTML = "";

    if (palette === undefined || palette.rgbColors.length <= 0) {
      g_saveButton.classList.add("tools-disabled");
      return;
    }

    for (let index = 0; index < palette.hexColors.length; index++) {
      const colorElement = document.createElement("div");
      colorElement.style.backgroundColor = palette.hexColors[index];
      paletteContainer.appendChild(colorElement);
      const textElement = document.createElement("div");
      textElement.innerHTML = palette.hexColors[index];
      colorElement.appendChild(textElement);
    }
    g_saveButton.classList.remove("tools-disabled");
  });

  on("export-file-created", (titleText, infoText) => {
    showExportedModal(titleText, infoText);
    // TODO: green button?
  });

  on("export-file-error", (titleText, infoText) => {
    showExportedModal(titleText, infoText);
    // TODO: red button?
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

  const paletteContainer = document.getElementById("tool-ep-palette");
  paletteContainer.innerHTML = "";
  let canvas = g_cropper.getCroppedCanvas();
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let distanceMethod = document.getElementById(
    "tool-ep-distance-method-select"
  ).value;
  let distanceThreshold = 120;
  if (distanceMethod === "deltae") {
    distanceThreshold = parseInt(
      document.getElementById("tool-ep-deltae-threshold-input").value
    );
    if (distanceThreshold < 0) distanceThreshold = 2;
    else if (distanceThreshold > 49) distanceThreshold = 49;
  }

  let maxQuantizationDepth = 4;
  let maxNumColors = parseInt(
    document.getElementById("tool-ep-max-num-colors-select").value
  );
  if (maxNumColors === 32) {
    maxQuantizationDepth = 5;
  }

  sendIpcToMain(
    "start",
    imageData.data,
    distanceMethod,
    distanceThreshold,
    maxQuantizationDepth
  );
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
        modalClosed();
      },
      // key: "Escape",
      hide: true,
    },
    progressBar: {},
  });
}

function showExportedModal(titleText, infoText) {
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
        text: g_localizedModalCloseButtonText,
        callback: () => {
          modalClosed();
        },
        id: "tool-ep-modal-close-button",
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
    if (element.id === "tool-ep-modal-close-button-text") {
      g_localizedModalCloseButtonText = element.text;
    } else if (element.id === "tool-ep-modal-cancel-button-text") {
      g_localizedModalCancelButtonText = element.text;
    } else if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }
}
