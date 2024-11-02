/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_iframe;

function init(iframeLocalization) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document
    .getElementById("tool-template-maker-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  g_iframe = document.getElementById("tool-template-maker-iframe");
  g_iframe.onload = () => {
    updateLocalization(undefined, iframeLocalization);
  };

  ////////////////////////////////////////
}

export function initIpc() {
  initOnIpcCallbacks();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-template-maker", ...args);
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

  on("update-localization", (...args) => {
    updateLocalization(...args);
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

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  // if (getOpenModal()) {
  //   modals.onInputEvent(getOpenModal(), type, event);
  //   return;
  // }
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
  // if (getOpenModal()) {
  //   return;
  // }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization, iframeLocalization) {
  if (localization) {
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
  }
  if (iframeLocalization) {
    for (let index = 0; index < iframeLocalization.texts.length; index++) {
      const data = iframeLocalization.texts[index];
      const domElement = g_iframe.contentWindow.document.querySelector(
        "#" + data.id
      );
      if (domElement !== null) {
        domElement.innerHTML = data.text;
      }
    }
    for (let index = 0; index < iframeLocalization.titles.length; index++) {
      const data = iframeLocalization.titles[index];
      const domElement = g_iframe.contentWindow.document.querySelector(
        "#" + data.id
      );
      if (domElement !== null) {
        domElement.title = data.text;
      }
    }
  }
}
