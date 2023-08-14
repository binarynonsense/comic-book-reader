/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_localizedRemoveFromListText = "";
let g_localizedOpenFromListText = "";

let g_localizedModalClearAllTitleText = "";
let g_localizedModalClearAllMessageText = "";
let g_localizedModalClearAllOkText = "";
let g_localizedModalClearAllCancelText = "";

function init(history) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  buildList(history);
  // menu buttons
  document
    .getElementById("tool-hst-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-hst-clear-button")
    .addEventListener("click", (event) => {
      showModalConfirmClearAll();
    });

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

function buildList(history) {
  // history list
  const ul = document.querySelector("#tool-hst-items-ul");
  ul.innerHTML = "";
  for (let index = history.length - 1; index >= 0; index--) {
    const fileInfo = history[index];
    let name = reducePathString(fileInfo.filePath);
    if (fileInfo.data && fileInfo.data.source) {
      if (fileInfo.data.name) {
        name = "[www] " + reducePathString(fileInfo.data.name);
      } else {
        name = "[www] " + name;
      }
    }
    let li = document.createElement("li");
    li.className = "tools-collection-li";
    // open icon - clickable
    let button = document.createElement("span");
    button.title = g_localizedOpenFromListText;
    button.className = "tools-collection-li-button";
    button.addEventListener("click", (event) => {
      sendIpcToMain("open-item", index);
    });
    button.innerHTML = `<i class="fa fa-folder-open"></i>`;
    li.appendChild(button);
    // text
    let text = document.createElement("span");
    text.innerText = `${name}`;
    li.appendChild(text);
    // remove icon - clickable
    button = document.createElement("span");
    button.title = g_localizedRemoveFromListText;
    button.className = "tools-collection-li-button";
    button.addEventListener("click", (event) => {
      sendIpcToMain("remove-item", index);
    });
    button.innerHTML = `<i class="fas fa-window-close"></i>`;
    li.appendChild(button);
    ul.appendChild(li);
  }
  if (history.length < 20) {
    for (let index = 0; index < 20 - history.length; index++) {
      let li = document.createElement("li");
      li.className = "tools-collection-li";
      let a = document.createElement("span");
      a.innerHTML = `&nbsp;&nbsp;`;
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-history", ...args);
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
  on("show", (history) => {
    init(history);
  });

  on("build-list", (history) => {
    buildList(history);
  });

  on("update-localization", (localization, tooltipsLocalization) => {
    updateLocalization(localization, tooltipsLocalization);
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

function modalClosed() {
  g_openModal = undefined;
}

function showModalConfirmClearAll() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: g_localizedModalClearAllTitleText,
    message: g_localizedModalClearAllMessageText,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: g_localizedModalClearAllOkText.toUpperCase(),
        callback: () => {
          sendIpcToMain("remove-all");
          modalClosed();
        },
        key: "Enter",
      },
      {
        text: g_localizedModalClearAllCancelText.toUpperCase(),
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

function updateLocalization(localization, tooltipsLocalization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.innerText = element.text;
    }
  }
  for (let index = 0; index < tooltipsLocalization.length; index++) {
    const element = tooltipsLocalization[index];
    const domElement = document.querySelector("#" + element.id);
    if (domElement !== null) {
      domElement.title = element.text;
    }
    if (element.id === "tool-hst-tooltip-remove-from-list") {
      g_localizedRemoveFromListText = element.text;
    } else if (element.id === "tool-hst-tooltip-open-from-list") {
      g_localizedOpenFromListText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-title") {
      g_localizedModalClearAllTitleText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-message") {
      g_localizedModalClearAllMessageText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-ok") {
      g_localizedModalClearAllOkText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-cancel") {
      g_localizedModalClearAllCancelText = element.text;
    }
  }
}

function reducePathString(input) {
  let length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}
