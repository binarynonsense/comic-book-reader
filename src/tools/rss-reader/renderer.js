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

async function init(feeds, currentFeedIndex = 0) {
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
      sendIpcToMain("on-add-feed-clicked");
    });
  document
    .getElementById("tool-rss-reset-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("on-reset-feeds-clicked");
    });
  ////////////////////////////////////////
  g_feeds = feeds;
  g_currentFeedIndex = currentFeedIndex;

  buildSections();
  switchSection(g_currentFeedIndex);
  ////////////////////////////////////////
  updateColumnsHeight();
}

function buildSections() {
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
}

function showFeedContent(data) {
  // console.log(data);
  const root = document.getElementById("tool-rss-items-div");
  root.innerHTML = "";
  const titleButtons = `<div id="tool-rss-channel-info-title-buttons">
        <i class="fas fa-sync-alt tool-rss-icon-button" id="tool-rss-channel-info-title-reload-button" title="${g_extraLocalization.reload}"></i>
        <i class="fas fa-pen tool-rss-icon-button" id="tool-rss-channel-info-title-editname-button" title="${g_extraLocalization.editName}"></i>
        <i class="fas fa-trash-alt  tool-rss-icon-button" id="tool-rss-channel-info-title-remove-button" title="${g_extraLocalization.remove}"></i>
        <i class="fas fa-ellipsis-h tool-rss-icon-button" id="tool-rss-channel-info-title-options-button" title="${g_extraLocalization.options}"></i>
        </div>`;
  const titleText = `
  <div id='tool-rss-channel-info-title'>
      <div id='tool-rss-channel-info-title-button' class="${
        data?.link ? "tool-rss-icon-button" : ""
      }" title="${
    data?.link
      ? g_extraLocalization.openInBrowser + " (" + data?.link + ")"
      : ""
  }">
        <i class="fas fa-rss"></i>
        <span id="tool-rss-channel-info-title-text">${
          g_feeds[g_currentFeedIndex].name
        }</span>        
      </div>
      ${titleButtons}
  </div>`;
  try {
    //
    root.innerHTML += `
    <div id='tool-rss-channel-info'>
      ${titleText}
      <div id='tool-rss-channel-info-desc'>${
        data.name && data.name !== g_feeds[g_currentFeedIndex].name
          ? "<span>" + data.name + "</span>"
          : ""
      }${data.description ? "<span>" + data.description + "</span>" : ""}
      </div>
    </div>`;
    itemsToHtml(root, data.items);
  } catch (error) {
    root.innerHTML += `
    <div id='tool-rss-channel-info'>
      ${titleText}
      <div id='tool-rss-channel-info-desc'>
      ${g_extraLocalization.feedError}
      </div>
    </div>`;
  }
  document
    .getElementById(`tool-rss-channel-info-title-options-button`)
    .addEventListener("click", (event) => {
      sendIpcToMain("on-feed-options-clicked", g_currentFeedIndex);
    });
  document
    .getElementById(`tool-rss-channel-info-title-reload-button`)
    .addEventListener("click", (event) => {
      showLoadingModal();
      sendIpcToMain("get-feed-content", g_currentFeedIndex);
    });
  document
    .getElementById(`tool-rss-channel-info-title-remove-button`)
    .addEventListener("click", (event) => {
      sendIpcToMain(
        "on-modal-feed-options-remove-clicked",
        g_currentFeedIndex,
        g_feeds[g_currentFeedIndex].url
      );
    });
  document
    .getElementById(`tool-rss-channel-info-title-editname-button`)
    .addEventListener("click", (event) => {
      sendIpcToMain(
        "on-modal-feed-options-edit-name-clicked",
        g_currentFeedIndex,
        g_feeds[g_currentFeedIndex].url
      );
    });

  if (data?.link)
    document
      .getElementById(`tool-rss-channel-info-title-button`)
      .addEventListener("click", (event) => {
        sendIpcToMain("open-url-in-browser", data.link);
      });

  updateColumnsHeight();
}

function itemsToHtml(root, items) {
  try {
    items.forEach((item, index) => {
      let html = "";
      try {
        html = `<div class='tool-rss-item-div'>`;

        html += `<div class="tool-rss-item-title"><span class="tool-rss-item-title-text">${
          item.title ? item.title : ""
        }</span>`;
        if (item.link) {
          html += `<i class="fas fa-external-link-alt tool-rss-icon-button" id="tool-rss-item-title-${index}-button" data-src="${item.link}" title="${g_extraLocalization.openInBrowser} (${item.link})"></i>`;
        }
        html += `</div>`;

        if (item.date) {
          html += `<div class="tool-rss-item-date">${item.date}</div>`;
        }

        if (item.enclosureUrl) {
          if (item.enclosureUrl.toLowerCase().split("?")[0].endsWith(".mp3")) {
            html += `<div class="tool-rss-item-enclosure"><i class="fas fa-play-circle tool-rss-item-enclosure-playicon" data-src="${item.enclosureUrl}" data-title="${item.title}"></i></div>`;
          } else {
            // TODO: check image extension?
            html += `<div class="tool-rss-item-enclosure"><img src="${item.enclosureUrl}"></div>`;
          }
        } else if (item.contentEncoded) {
          const div = document.createElement("div");
          div.innerHTML = item.contentEncoded;
          const image = div.querySelector("img");
          if (image && image.src) {
            html += `<div class="tool-rss-item-enclosure"><img src="${image.src}" loading=”lazy”></div>`;
          }
        }

        html += `<div class="tool-rss-item-desc">${item.description}</div>    
    </div>`;
      } catch (error) {}
      root.innerHTML += html;
    });
  } catch (error) {}

  let links = document.querySelectorAll("a");
  links.forEach((link) => {
    if (link.href) {
      if (link.href.toLowerCase().endsWith(".mp3")) {
        link.title = `${g_extraLocalization.openInAudioPlayer} (${link.href})`;
        link.addEventListener("click", () => {
          onPlayUrlClicked(link.href, link.href);
        });
      } else {
        link.title = `${g_extraLocalization.openInBrowser} (${link.href})`;
        link.addEventListener("click", () => {
          sendIpcToMain("open-url-in-browser", link.href);
        });
      }
    }
  });

  let mp3Urls = document.querySelectorAll("i");
  mp3Urls.forEach((mp3Url) => {
    if (mp3Url.getAttribute("data-src")) {
      mp3Url.title = `${
        g_extraLocalization.openInAudioPlayer
      } (${mp3Url.getAttribute("data-src")})`;
      mp3Url.addEventListener("click", () => {
        onPlayUrlClicked(
          mp3Url.getAttribute("data-src"),
          mp3Url.getAttribute("data-title")
        );
      });
    }
  });

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
  const columns = document.getElementById("tools-columns");
  const tools = document.getElementById("tools");
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
  if (tools.offsetHeight > columns.offsetHeight) {
    columns.style.height = "100%";
  } else {
    columns.style.height = "fit-content";
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
  g_currentFeedIndex = id;
  if (g_feeds.length <= 0) {
    showFeedContent();
  } else {
    showLoadingModal();
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

  on("update-feeds", (feeds, index) => {
    closeModal();
    g_feeds = feeds;
    buildSections();
    if (index !== undefined) {
      if (index >= g_feeds.length) index = g_feeds.length - 1;
      switchSection(index);
    }
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

  on("show-modal-add-feed", (...args) => {
    showModalAddFeed(...args);
  });

  on("show-modal-info", (...args) => {
    showModalInfo(...args);
  });

  on("show-modal-reset-feeds", (...args) => {
    showModalResetFeeds(...args);
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

  on("show-modal-feed-remove", (...args) => {
    showModalFeedRemove(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("modal-update-title-text", (text) => {
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

async function onPlayUrlClicked(url, name) {
  showModalOpenInPlayer(
    url,
    name,
    g_extraLocalization.openInAudioPlayer,
    g_extraLocalization.cancel,
    g_extraLocalization.addToPlaylist,
    g_extraLocalization.startPlaylist
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

export function onContextMenu(params, target) {
  if (getOpenModal()) {
    return;
  }
  if (target.tagName === "IMG") {
    params.push(target.src);
  }
  sendIpcToMain("show-context-menu", params, target.tagName === "IMG");
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

//////////////

function showModalAddFeed(title, message, textButton1, textButton2) {
  if (getOpenModal()) {
    return;
  }

  showModal({
    title,
    message,
    zIndexDelta: 5,
    input: { type: "text", default: "" },
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
          sendIpcToMain("on-modal-add-feed-ok-clicked", value);
          modalClosed();
          showLoadingModal();
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

function showModalInfo(title, message, textButton1) {
  if (getOpenModal()) {
    closeModal();
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          modalClosed();
        },
        key: "Enter",
      },
    ],
  });
}

function showModalResetFeeds(title, message, textButton1, textButton2) {
  if (getOpenModal()) {
    return;
  }

  g_openModal = modals.show({
    title,
    message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          sendIpcToMain("on-modal-reset-feeds-ok-clicked");
          modalClosed();
        },
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

//////////////

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
    text: textButtonMoveUp.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "on-modal-feed-options-move-clicked",
        g_currentFeedIndex,
        g_feeds[g_currentFeedIndex].url,
        0
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
        g_feeds[g_currentFeedIndex].url,
        1
      );
    },
  });
  buttons.push({
    text: textButtonRemove.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "on-modal-feed-options-remove-clicked",
        g_currentFeedIndex,
        g_feeds[g_currentFeedIndex].url
      );
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

//////////////

function showModalFeedRemove(
  index,
  url,
  title,
  message,
  textButton1,
  textButton2
) {
  if (getOpenModal()) {
    return;
  }

  g_openModal = modals.show({
    title,
    message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          sendIpcToMain("on-modal-feed-options-remove-ok-clicked", index, url);
          modalClosed();
        },
        //key: "Enter",
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

//////////////

function showModalOpenInPlayer(
  url,
  name,
  title,
  textButtonBack,
  textButtonAddToPlayList,
  textButtonNewPlaylist,
  showFocus
) {
  if (g_openModal) {
    closeModal();
  }
  let buttons = [];
  buttons.push({
    text: textButtonAddToPlayList.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("open-url-in-audio-player", url, name, 0);
    },
  });
  buttons.push({
    text: textButtonNewPlaylist.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("open-url-in-audio-player", url, name, 1);
    },
  });
  buttons.push({
    text: textButtonBack.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
    },
  });
  g_openModal = modals.show({
    showFocus: showFocus,
    title: title,
    message: url,
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
