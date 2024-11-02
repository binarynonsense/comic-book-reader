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
      //sendIpcToMain("close");
      showModalConfirmClose();
    });
  g_iframe = document.getElementById("tool-template-maker-iframe");
  g_iframe.onload = () => {
    updateLocalization(undefined, iframeLocalization);

    g_iframe.contentWindow.document.onclick = function (clickEvent) {
      // HACK: this makes the title menu bar close any open menus when
      // clicking the iframe
      let titleElement = document.getElementsByClassName("cet-title-right")[0];
      var titlePosition = titleElement.getBoundingClientRect();
      var clickEvent = new MouseEvent("mousedown", {
        view: window,
        bubbles: true,
        cancelable: true,
        screenX: titlePosition.left,
        screenY: titlePosition.top,
      });
      titleElement.dispatchEvent(clickEvent);
    };
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

  /////////////////////////////////////////////////////////////////////////////

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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

let g_modalsLocalization;

function showModalConfirmClose() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: g_modalsLocalization["closeTitle"],
    message: g_modalsLocalization["closeMessage"],
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: g_modalsLocalization["closeOk"],
        callback: () => {
          sendIpcToMain("close");
          modalClosed();
        },
      },
      {
        text: g_modalsLocalization["closeCancel"],
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization, iframeLocalization) {
  if (localization) {
    for (let index = 0; index < localization.texts.length; index++) {
      const element = localization.texts[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
    g_modalsLocalization = localization.modals;
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
