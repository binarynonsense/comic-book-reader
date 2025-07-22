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
import * as utils from "../../shared/renderer/utils.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_extraLocalization = {};

let g_favorites;
let g_currentFeedFavoriteIndex = -1;
let g_currentFeedData;

export function needsScrollToTopButtonUpdate() {
  return true;
}

async function init(favorites, url) {
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
      sendIpcToMain("on-open-feed-url-clicked");
    });

  // sections menu
  for (let index = 0; index < 2; index++) {
    document
      .getElementById(`tool-rss-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }

  document
    .getElementById("tool-rss-reset-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("on-reset-favorites-clicked");
    });

  ////////////////////////////////////////

  g_favorites = favorites;

  buildFavorites();
  if (url) {
    sendIpcToMain("get-feed-content", url, -1);
    showLoadingModal();
  } else if (g_currentFeedData) {
    showFeedContent(g_currentFeedData, g_currentFeedFavoriteIndex);
    switchSection(1);
  } else {
    removeCurrentFeedContent();
    switchSection(0);
  }
  ////////////////////////////////////////
  updateColumnsHeight();
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
  for (let index = 0; index < 2; index++) {
    if (id === index) {
      document
        .getElementById(`tool-rss-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-rss-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-rss-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-rss-section-${index}-content-div`)
        .classList.add("set-display-none");
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

  on("load-feed-content", (data, index, switchToContent) => {
    showFeedContent(data, index);
    if (switchToContent) switchSection(1);
    closeModal();
  });

  ///////////////

  on("on-favorite-feed-added", (favorites, name, url) => {
    g_favorites = favorites;
    buildFavorites();
    // right now should only be possible from content view
    if (
      g_currentFeedData &&
      g_currentFeedData.name == name &&
      g_currentFeedData.url == url
    ) {
      g_currentFeedFavoriteIndex = g_favorites.length - 1;
      updateCurrentFeedContentIcons();
    } else {
      // just in case
      removeCurrentFeedContent();
    }
    closeModal();
  });

  on("on-favorite-feed-removed", (favorites, prevIndex) => {
    g_favorites = favorites;
    buildFavorites();
    closeModal();
    if (g_currentFeedFavoriteIndex >= 0) {
      if (!g_currentFeedData) {
        // shouldn't happen
        removeCurrentFeedContent();
      }
      if (g_currentFeedFavoriteIndex === prevIndex) {
        g_currentFeedFavoriteIndex = -1;
        // was the same
        updateCurrentFeedContentIcons();
      } else {
        g_currentFeedFavoriteIndex--;
      }
    }
  });

  on("on-favorite-feeds-moved", (favorites, prevIndex, newIndex) => {
    g_favorites = favorites;
    buildFavorites();
    if (g_currentFeedFavoriteIndex == prevIndex)
      g_currentFeedFavoriteIndex = newIndex;
    closeModal();
  });

  on("on-favorites-reset", (favorites) => {
    g_favorites = favorites;
    buildFavorites();
    closeModal();
    if (g_currentFeedData) {
      showFeedContent(g_currentFeedData, -1);
    } else {
      removeCurrentFeedContent();
    }
  });

  on("on-favorite-feed-name-updated", (feeds, index) => {
    g_favorites = feeds;
    buildFavorites();
    if (index === g_currentFeedFavoriteIndex) {
      document.getElementById("tool-rss-channel-info-title-text").innerText =
        g_favorites[g_currentFeedFavoriteIndex].name;
    }
    closeModal();
  });

  on("on-favorite-feed-url-updated", (feeds, index) => {
    g_favorites = feeds;
    buildFavorites();
    closeModal();
    if (index === g_currentFeedFavoriteIndex) {
      showLoadingModal();
      sendIpcToMain("get-feed-content", index);
    } else {
      removeCurrentFeedContent();
    }
  });

  /////////////////

  on("show-modal-open-feed-url", (...args) => {
    showModalOpenFeedURL(...args);
  });

  on("show-modal-info", (...args) => {
    showModalInfo(...args);
  });

  on("show-modal-reset-favorites", (...args) => {
    showModalResetFavorites(...args);
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

  on("show-modal-feed-remove-from-favorites", (...args) => {
    showModalFeedRemoveFromFavorites(...args);
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

function buildFavorites() {
  const favoritesDiv = document.querySelector("#tool-rss-favorites-div");
  favoritesDiv.innerHTML = "";

  let listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list-single");
  listDiv.style = "padding-top: 5px;";
  favoritesDiv.appendChild(listDiv);

  if (g_favorites) {
    let index = 0;
    for (; index < g_favorites.length; index++) {
      listDiv.appendChild(getNewCardDiv(g_favorites[index], index));
    }
  }
}

function getNewCardDiv(data, index) {
  const cardDiv = document.createElement("div");
  const iconHtml = `
  <i class="hs-path-card-image-file fas fa-rss-square fa-2x fa-fw"></i>`;
  const buttonHtml = `
  <div class="hs-path-card-button hs-path-interactive hs-path-interactive-use-list-colors">
    <i class="fas fa-ellipsis-h"></i>
  </div>`;

  cardDiv.classList.add("hs-path-card");
  cardDiv.innerHTML = `<div class="hs-path-card-main hs-path-interactive hs-path-interactive-use-list-colors">
  <div class="hs-path-card-image">
    ${iconHtml}
  </div>
  <div class="hs-path-card-content">
    <span>${data.name}</span
    ><span>${data.url}</span>
      </div>
  </div>
  ${buttonHtml}`;

  const mainCardDiv = cardDiv.querySelector(".hs-path-card-main");
  mainCardDiv.title = g_extraLocalization.open;

  mainCardDiv.addEventListener("click", function (event) {
    sendIpcToMain("get-feed-content", data.url, index);
    showLoadingModal();
  });

  const buttonDiv = cardDiv.querySelector(".hs-path-card-button");
  buttonDiv.title = g_extraLocalization.options;
  buttonDiv.addEventListener("click", function (event) {
    sendIpcToMain("on-favorite-options-clicked", index, data.url);
    event.stopPropagation();
    sendIpcToMain("on-feed-options-clicked", index, false);
  });

  return cardDiv;
}

////////////////////////////

function removeCurrentFeedContent() {
  const contentDiv = document.getElementById("tool-rss-items-div");
  contentDiv.innerHTML = `<span> ${g_extraLocalization.noContent} </span>`;
  g_currentFeedData = undefined;
  g_currentFeedFavoriteIndex = -1;
}

function updateCurrentFeedContentIcons() {
  if (g_currentFeedFavoriteIndex < 0) {
    // not in favs
    document
      .getElementById(`tool-rss-channel-info-title-remove-button`)
      .classList.add("set-display-none");
    document
      .getElementById(`tool-rss-channel-info-title-add-button`)
      .classList.remove("set-display-none");
  } else {
    document
      .getElementById(`tool-rss-channel-info-title-remove-button`)
      .classList.remove("set-display-none");
    document
      .getElementById(`tool-rss-channel-info-title-add-button`)
      .classList.add("set-display-none");
  }
}

function showFeedContent(data, index = -1) {
  g_currentFeedFavoriteIndex = index;
  g_currentFeedData = data;

  const root = document.getElementById("tool-rss-items-div");
  root.innerHTML = "";
  const titleButtons = `<div id="tool-rss-channel-info-title-buttons">
        <i class="fas fa-sync-alt tool-rss-icon-button" id="tool-rss-channel-info-title-reload-button" title="${g_extraLocalization.reload}"></i>
        <i class="fa-regular fa-heart tool-rss-icon-button" id="tool-rss-channel-info-title-add-button" title="${g_extraLocalization.addToFavorites}"></i>
        <i class="fa-solid fa-heart tool-rss-icon-button" id="tool-rss-channel-info-title-remove-button" title="${g_extraLocalization.removeFromFavorites}"></i>        
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
          index >= 0 ? g_favorites[g_currentFeedFavoriteIndex].name : data.name
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
        data.name &&
        (g_currentFeedFavoriteIndex < 0 ||
          data.name !== g_favorites[g_currentFeedFavoriteIndex].name)
          ? "<span>" + data.name + "</span>"
          : ""
      }${data.description ? "<span>" + data.description + "</span>" : ""}
      </div>
    </div>`;
    itemsToHtml(root, data.items);
  } catch (error) {
    console.log(error);
    root.innerHTML += `
    <div id='tool-rss-channel-info'>
      ${titleText}
      <div id='tool-rss-channel-info-desc'>
      ${g_extraLocalization.feedError}
      </div>
    </div>`;
  }
  /////
  document
    .getElementById(`tool-rss-channel-info-title-reload-button`)
    .addEventListener("click", (event) => {
      showLoadingModal();
      sendIpcToMain("get-feed-content", data.url, g_currentFeedFavoriteIndex);
    });
  /////
  document
    .getElementById(`tool-rss-channel-info-title-add-button`)
    .addEventListener("click", (event) => {
      sendIpcToMain("on-modal-feed-options-add-clicked", data.name, data.url);
    });
  document
    .getElementById(`tool-rss-channel-info-title-remove-button`)
    .addEventListener("click", (event) => {
      sendIpcToMain(
        "on-modal-feed-options-remove-clicked",
        g_currentFeedFavoriteIndex,
        g_favorites[g_currentFeedFavoriteIndex].url
      );
    });

  updateCurrentFeedContentIcons();

  /////

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
          if (utils.hasAudioExtension(item.enclosureUrl.split("?")[0])) {
            html += `<div class="tool-rss-item-enclosure"><i class="fas fa-play-circle tool-rss-item-enclosure-playicon" data-src="${item.enclosureUrl}" data-title="${item.title}"></i></div>`;
          } else if (utils.hasImageExtension(item.enclosureUrl.split("?")[0])) {
            html += `<div class="tool-rss-item-enclosure"><img src="${item.enclosureUrl}"></div>`;
          } else if (utils.hasVideoExtension(item.enclosureUrl.split("?")[0])) {
            html += `<div class="tool-rss-item-enclosure"><i class="fas fa-play-circle tool-rss-item-enclosure-playicon" data-src="${item.enclosureUrl}" data-title="${item.title}"></i></div>`;
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
      if (
        utils.hasAudioExtension(link.href) ||
        utils.hasVideoExtension(link.href)
      ) {
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
    if (!mp3Url.title && mp3Url.getAttribute("data-src")) {
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
    if (element) {
      element.addEventListener("click", (event) => {
        sendIpcToMain("open-url-in-browser", element.getAttribute("data-src"));
      });
    } else {
      console.log(`"tool-rss-item-title-${index}-button" not found`);
    }
  }
}

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

function showModalOpenFeedURL(title, message, textButton1, textButton2) {
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
          sendIpcToMain("on-modal-open-feed-url-ok-clicked", value);
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

function showModalResetFavorites(title, message, textButton1, textButton2) {
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
          sendIpcToMain("on-modal-reset-favorites-ok-clicked");
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
  favoriteIndex,
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
        favoriteIndex,
        g_favorites[favoriteIndex].url
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
        favoriteIndex,
        g_favorites[favoriteIndex].url
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
        favoriteIndex,
        g_favorites[favoriteIndex].url,
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
        favoriteIndex,
        g_favorites[favoriteIndex].url,
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
        favoriteIndex,
        g_favorites[favoriteIndex].url
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

function showModalFeedRemoveFromFavorites(
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
