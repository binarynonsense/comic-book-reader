/**
 * @license
 * Copyright 2020-2024 Álvaro García
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
import {
  initIpc as homeScreenInitIpc,
  onInputEvent as homeScreenOnInputEvent,
} from "./home-screen/renderer.js";

export function initIpc() {
  uiInitIpc();
  pdfInitIpc();
  epubInitIpc();
  homeScreenInitIpc();
  initOnIpcCallbacks();
}

///////////////////////////////////////////////////////////////////////////////
// PAGES //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentImg64 = null;

function cleanUpPages() {
  g_currentImg64 = null;
  cleanUpPdf();
  cleanUpEpub();
}

export function getCurrentImg64() {
  return g_currentImg64;
}

export function showNoBookContent(show) {
  if (show) {
    document
      .querySelector("#no-book-content")
      .classList.remove("set-display-none");
    document
      .querySelector("#pages-container")
      .classList.add("set-display-none");
  } else {
    document
      .querySelector("#no-book-content")
      .classList.add("set-display-none");
    document
      .querySelector("#pages-container")
      .classList.remove("set-display-none");
  }
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
      cleanUpPages();
      showNoBookContent(false);
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
    cleanUpPages();
    let container = document.getElementById("pages-container");
    container.innerHTML = "";
    showNoBookContent(true);
    updatePageInfo(0, 0);
  });
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pagesContainerDiv;

export function onInputEvent(type, event) {
  // NOTE: if more are added, make them return true or false to see if handled
  // or next should try?
  if (getOpenModal()) {
    modalOnInputEvent(getOpenModal(), type, event);
    return;
  }
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    uiOnInputEvent(type, event);
  } else {
    homeScreenOnInputEvent(type, event);
  }
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
