/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../core/renderer.js";
import {
  initIpc as uiInitIpc,
  renderImageBuffers as renderImages,
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
  onGamepadPolled as homeScreenOnGamepadPolled,
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

let g_currentImages;

function cleanUpPages() {
  g_currentImages = undefined;
  cleanUpPdf();
  cleanUpEpub();
}

export function getCurrentImgBuffers() {
  return g_currentImages;
}

export function showNoBookContent(show) {
  if (show) {
    document
      .querySelector("#no-book-content")
      .classList.remove("set-display-none");
    document
      .querySelector("#pages-container")
      .classList.add("set-display-none");
    document.querySelector("#home-screen").scrollTop = 0;
    document.querySelector("#home-screen").scrollLeft = 0;
    document
      .querySelector("#home-scroll-to-top-button")
      ?.classList.remove("set-display-none");
  } else {
    document
      .querySelector("#no-book-content")
      .classList.add("set-display-none");
    document
      .querySelector("#pages-container")
      .classList.remove("set-display-none");
    document
      .querySelector("#home-scroll-to-top-button")
      ?.classList.add("set-display-none");
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
  on("render-img-page", (images, rotation, scrollBarPos) => {
    if (images) {
      cleanUpPages();
      showNoBookContent(false);
      g_currentImages = images;
      renderImages(g_currentImages, rotation, scrollBarPos, true, false);
    }
  });

  on("refresh-img-page", (rotation) => {
    if (g_currentImages)
      renderImages(g_currentImages, rotation, undefined, false, true);
  });

  on("update-img-page-title", (text) => {
    let img = document.querySelector(".page");
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

export function onContextMenu(params, target) {
  if (getOpenModal()) {
    return;
  }
  // console.log(document.elementsFromPoint(params[0], params[1]));
  if (target.tagName === "IMG") {
    params.push(target.src);
    params.push(target.classList.contains("page-2"));
  } else if (target.tagName === "CANVAS") {
    // TODO: this is done every time the context menu is opened, doesn't
    // seem to take long but probably should do it only by explicit request
    // when clicking Save Image to...
    params.push(target.toDataURL("image/jpeg"));
    params.push(target.classList.contains("page-2"));
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
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    uiOnGamepadPolled();
  } else {
    homeScreenOnGamepadPolled();
  }
}
