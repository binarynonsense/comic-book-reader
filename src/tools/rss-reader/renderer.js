/**
 * @license
 * Copyright 2025 Álvaro García
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
let g_feeds;
async function init(feeds, feedContent) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  // menu buttons
  document
    .getElementById("tool-rss-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  // for (let index = 0; index < 1; index++) {
  //   document
  //     .getElementById(`tool-rss-section-${index}-button`)
  //     .addEventListener("click", (event) => {
  //       switchSection(index);
  //     });
  // }
  ////////////////////////////////////////
  g_feeds = feeds;
  const menu = document.querySelector(".tools-menu-sections");
  menu.innerHTML = "";
  g_feeds.forEach((feed, index) => {
    console.log(feed);
    menu.innerHTML += `<div
  id="tool-rss-section-${index}-button"
  class="tools-menu-button${index == 0 ? " tools-menu-button-selected" : ""}">
  <i class="fas fa-list-ul tools-menu-button-icon"></i>
  <div class="tools-menu-button-text">
    <span id="tool-rss-section-${index}-text">${feed.name}</span>
  </div>
</div>`;
    console.log(menu.innerHTML);
  });
  g_feeds.forEach((feed, index) => {
    document
      .getElementById(`tool-rss-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  });

  showFeedContent(feedContent);
  ////////////////////////////////////////
  updateColumnsHeight();
}

function showFeedContent(data) {
  // console.log(data["rss"]);
  const root = document.getElementById("tool-rss-items-div");
  root.innerHTML = "";
  root.innerHTML += `<div id='tool-rss-channel-info'>
    <div id='tool-rss-channel-info-title'>${data["rss"]["channel"]["title"]}</div>
    <div id='tool-rss-channel-info-desc'>${data["rss"]["channel"]["description"]}</div>
    </div>`;
  itemsToHtml(root, data["rss"]["channel"]["item"]);
  updateColumnsHeight();
}

function itemsToHtml(root, items) {
  items.forEach((item) => {
    // console.log(item);
    let html = `<div class='tool-rss-item-div'>
    <div class="tool-rss-item-title">${item.title}</div>`;
    if (item.enclosure && item.enclosure["@_url"]) {
      html += `<div><img src="${item.enclosure["@_url"]}" style="max-width: 100%;"></div>`;
    }
    html += `<div>${item.description}</div>    
    </div>`;
    root.innerHTML += html;
  });
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight(scrollTop = false) {
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  const sticky = document.getElementById("tools-menu-sticky-div");
  const leftOffset = left.offsetHeight;
  const rightOffset = right.offsetHeight;
  const stickyOffset = sticky.offsetHeight;
  if (stickyOffset > rightOffset) {
    right.style.minHeight = stickyOffset + "px";
  } else {
    left.style.minHeight = rightOffset + "px";
  }
  if (scrollTop) {
    document.getElementById("tools-columns-right").scrollIntoView({
      behavior: "instant",
      block: "start",
      inline: "nearest",
    });
  }
}

function switchSection(id) {
  for (let index = 0; index < g_feeds.length; index++) {
    if (id === index) {
      document
        .getElementById(`tool-rss-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      // document
      //   .getElementById(`tool-rss-section-${index}-content-div`)
      //   .classList.remove("set-display-none");
      sendIpcToMain("get-feed-content", index);
    } else {
      document
        .getElementById(`tool-rss-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      // document
      //   .getElementById(`tool-rss-section-${index}-content-div`)
      //   .classList.add("set-display-none");
    }
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-rss", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-rss", ...args);
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
  on("show", (...args) => {
    init(...args);
  });

  on("hide", () => {});

  on("update-localization", (localization) => {
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
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

  on("show-feed-content", (data) => {
    showFeedContent(data);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("modal-update-title-text", (text) => {
    console.log(text);
    updateModalTitleText(text);
  });

  on("update-info-text", (text) => {
    updateInfoText(text);
  });

  on("update-log-text", (text) => {
    updateLogText(text);
  });

  /////////////////////////////////////////////////////////////////////////////
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

function closeModal() {
  if (g_openModal) {
    modals.close(g_openModal);
    modalClosed();
  }
}

function modalClosed() {
  g_openModal = undefined;
}

function updateModalTitleText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-title").innerHTML = text;
}

function updateInfoText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-message").innerHTML = text;
}

function updateLogText(text, append = true) {
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
