/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../core/renderer.js";
import {
  initIpc as uiInitIpc,
  renderImg64,
  updatePageInfo,
  onInputEvent as uiOnInputEvent,
  getOpenModal,
  onGamepadPolled as uiOnGamepadPolled,
} from "./renderer-ui.js";
import {
  initIpc as pdfInitIpc,
  cleanUp as cleanUpPdf,
} from "./renderer-pdf.js";
import {
  initIpc as epubInitIpc,
  cleanUp as cleanUpEpub,
} from "./renderer-epub.js";
import {
  onInputEvent as modalOnInputEvent,
  onGamepadPolled as modalOnGamepadPolled,
} from "../shared/renderer/modals.js";

export function initIpc() {
  uiInitIpc();
  pdfInitIpc();
  epubInitIpc();
  initOnIpcCallbacks();
}

///////////////////////////////////////////////////////////////////////////////
// PAGES //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentImg64 = null;

function cleanUp() {
  g_currentImg64 = null;
  cleanUpPdf();
  cleanUpEpub();
}

export function getCurrentImg64() {
  return g_currentImg64;
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("reader", ...args);
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

export function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("render-img-page", (img64, rotation, scrollBarPos) => {
    if (img64) {
      cleanUp();
      document
        .querySelector(".centered-block")
        .classList.add("set-display-none");
      g_currentImg64 = img64;
      renderImg64(g_currentImg64, rotation, scrollBarPos, true, false);
    }
  });

  on("refresh-img-page", (rotation) => {
    if (g_currentImg64)
      renderImg64(g_currentImg64, rotation, undefined, false, true);
  });

  on("update-img-page-title", (text) => {
    let img = document.getElementById("page-img");
    if (!img) img = document.getElementById("page-canvas");
    if (img) img.title = text;
  });

  on("file-closed", () => {
    cleanUp();
    let container = document.getElementById("pages-container");
    container.innerHTML = "";
    document
      .querySelector(".centered-block")
      .classList.remove("set-display-none");
    updatePageInfo(0, 0);
    document.querySelector("#page-number-bubble").innerHTML = "";
  });
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  // NOTE: if more are added, make them return true or false to see if handled
  // or next should try?
  if (getOpenModal()) {
    modalOnInputEvent(getOpenModal(), type, event);
    return;
  }
  uiOnInputEvent(type, event);
}

export function onContextMenu(params) {
  if (getOpenModal()) {
    return;
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPAD ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  if (getOpenModal()) {
    modalOnGamepadPolled(getOpenModal());
    return;
  }
  uiOnGamepadPolled();
}
