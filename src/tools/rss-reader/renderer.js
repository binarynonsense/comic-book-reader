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
let g_extraLocalization = {};
let g_currentFeedIndex = 0;

async function init(feeds) {
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
  document
    .getElementById("tool-rss-add-button")
    .addEventListener("click", (event) => {
      // TODO
    });
  ////////////////////////////////////////
  g_feeds = feeds;
  g_currentFeedIndex = 0;

  const menu = document.querySelector(".tools-menu-sections");
  menu.innerHTML = "";
  g_feeds.forEach((feed, index) => {
    menu.innerHTML += `<div
  id="tool-rss-section-${index}-button"
  class="tools-menu-button${index == 0 ? " tools-menu-button-selected" : ""}">
  <i class="fas fa-rss-square tools-menu-button-icon"></i>
  <div class="tools-menu-button-text">
    <span id="tool-rss-section-${index}-text">${feed.name}</span>
  </div>
</div>`;
  });
  g_feeds.forEach((feed, index) => {
    document
      .getElementById(`tool-rss-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  });

  switchSection(0);
  ////////////////////////////////////////
  updateColumnsHeight();
}

function showFeedContent(data) {
  console.log(data);
  const root = document.getElementById("tool-rss-items-div");
  root.innerHTML = "";
  try {
    //
    root.innerHTML += `<div id='tool-rss-channel-info'>
      <div id='tool-rss-channel-info-title'>
        <i class="fas fa-rss"></i>
        <span id="tool-rss-channel-info-title-text">${data["rss"]["channel"]["title"]}</span>
        <i class="fas fa-ellipsis-h tool-rss-icon-button" id="tool-rss-channel-info-title-button" title="${g_extraLocalization.edit}"></i>
      </div>
      <div id='tool-rss-channel-info-desc'>${data["rss"]["channel"]["description"]}</div>
    </div>`;

    itemsToHtml(root, data["rss"]["channel"]["item"]);
  } catch (error) {
    root.innerHTML += `<div id='tool-rss-channel-info'>
      <div id='tool-rss-channel-info-title'>
        <i class="fas fa-rss"></i>
        <span id="tool-rss-channel-info-title-text">${g_feeds[g_currentFeedIndex].name}</span>
        <i class="fas fa-ellipsis-h tool-rss-icon-button" id="tool-rss-channel-info-title-button" title="${g_extraLocalization.edit}"></i>
      </div>
    </div>`;
    root.innerHTML += `<div>${g_extraLocalization.feedError}</div>`;
  }
  const element = document.getElementById(`tool-rss-channel-info-title-button`);
  element.addEventListener("click", (event) => {
    sendIpcToMain("on-feed-options-clicked", g_currentFeedIndex);
  });
  updateColumnsHeight();
}

function itemsToHtml(root, items) {
  try {
    items.forEach((item, index) => {
      // console.log(item);
      let html = "";
      try {
        html = `<div class='tool-rss-item-div'>
    <div class="tool-rss-item-title"><span class="tool-rss-item-title-text">${item.title}</span><i class="fas fa-external-link-alt tool-rss-icon-button" id="tool-rss-item-title-${index}-button" data-src="${item.link}" title="${g_extraLocalization.openInBrowser} (${item.link})"></i></div>`;

        if (item.pubDate) {
          var date = new Date(item.pubDate);
          html += `<div class="tool-rss-item-date">${date.toLocaleString(
            undefined,
            { weekday: "long", year: "numeric", month: "long", day: "numeric" }
          )}</div>`;
        }

        if (item.enclosure && item.enclosure["@_url"]) {
          html += `<div class="tool-rss-item-enclosure"><img src="${item.enclosure["@_url"]}" style="max-width: 100%;"></div>`;
        }

        html += `<div class="tool-rss-item-desc">${item.description}</div>    
    </div>`;
      } catch (error) {}
      root.innerHTML += html;

      let links = document.querySelectorAll("a");
      links.forEach((link) => {
        if (link.href) {
          link.title = `${g_extraLocalization.openInBrowser} (${link.href})`;
          link.addEventListener("click", () => {
            sendIpcToMain("open-url-in-browser", link.href);
          });
        }
      });
    });
  } catch (error) {}
  for (let index = 0; index < items.length; index++) {
    const element = document.getElementById(
      `tool-rss-item-title-${index}-button`
    );
    element.addEventListener("click", (event) => {
      sendIpcToMain("open-url-in-browser", element.getAttribute("data-src"));
    });
  }
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
  showLoadingModal();
  g_currentFeedIndex = id;
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

  on("update-localization", (localization, extraLocalization) => {
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
    g_extraLocalization = extraLocalization;
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
    closeModal();
  });

  on("update-feed-name", (feeds, index) => {
    g_feeds = feeds;
    if (index === g_currentFeedIndex) {
      document.getElementById("tool-rss-channel-info-title-text").innerText =
        g_feeds[g_currentFeedIndex].name;
    }
    document.getElementById(`tool-rss-section-${index}-text`).innerText =
      g_feeds[index].name;

    closeModal();
  });

  on("update-feed-url", (feeds, index) => {
    g_feeds = feeds;
    switchSection(g_currentFeedIndex);
  });
  /////////////////

  on("show-modal-feed-options", (...args) => {
    showModalFeedOptions(...args);
  });

  on("show-modal-feed-edit-name", (...args) => {
    showModalFeedEditName(...args);
  });

  on("show-modal-feed-edit-url", (...args) => {
    showModalFeedEditUrl(...args);
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

function showModal(config) {
  g_openModal = modals.show(config);
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

///////////

function showLoadingModal() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: g_extraLocalization.loadingTitle,
    message: " ",
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

function showModalFeedOptions(
  title,
  textButtonBack,
  textButtonRemove,
  textButtonEditName,
  textButtonEditUrl,
  textButtonMoveUp,
  textButtonMoveDown,
  showFocus
) {
  if (getOpenModal()) {
    return;
  }

  let buttons = [];
  buttons.push({
    text: textButtonEditName.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "on-modal-feed-options-edit-name-clicked",
        g_currentFeedIndex,
        g_feeds[g_currentFeedIndex].url
      );
    },
  });
  buttons.push({
    text: textButtonEditUrl.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "on-modal-feed-options-edit-url-clicked",
        g_currentFeedIndex,
        g_feeds[g_currentFeedIndex].url
      );
    },
  });
  buttons.push({
    text: textButtonMoveDown.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "on-modal-feed-options-move-clicked",
        g_currentFeedIndex,
        0
      );
    },
  });
  buttons.push({
    text: textButtonMoveUp.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "on-modal-feed-options-move-clicked",
        g_currentFeedIndex,
        1
      );
    },
  });
  buttons.push({
    text: textButtonRemove.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("on-modal-feed-options-remove-clicked", g_currentFeedIndex);
    },
  });
  buttons.push({
    text: textButtonBack.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
    },
  });

  showModal({
    showFocus: showFocus,
    title: title,
    frameWidth: 400,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

function showModalFeedEditName(index, name, title, textButton1, textButton2) {
  if (getOpenModal()) {
    return;
  }

  showModal({
    title: title,
    zIndexDelta: 5,
    input: { type: "text", default: name },
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: (showFocus, value) => {
          sendIpcToMain(
            "on-modal-feed-options-edit-name-ok-clicked",
            index,
            value
          );
          modalClosed();
        },
        key: "Enter",
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}

function showModalFeedEditUrl(index, url, title, textButton1, textButton2) {
  if (getOpenModal()) {
    return;
  }

  showModal({
    title: title,
    zIndexDelta: 5,
    input: { type: "text", default: url },
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: (showFocus, value) => {
          sendIpcToMain(
            "on-modal-feed-options-edit-url-ok-clicked",
            index,
            value
          );
          modalClosed();
        },
        key: "Enter",
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}
