/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain, on } from "../../reader/renderer.js";
import {
  getOpenModal,
  showModal,
  modalClosed,
} from "../../reader/renderer-ui.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init() {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
    const openFileButton = document.querySelector("#hs-openfile-button");
    openFileButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-open-dialog-file");
    });
  }
}

export function initIpc() {
  initOnIpcCallbacks();
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initOnIpcCallbacks() {
  on("hs-update-localization", (...args) => {
    updateLocalization(...args);
  });

  on("hs-init", (...args) => {
    init();
  });

  on("hs-update-favorites", (...args) => {
    updateFavorites(args[0]);
  });

  on("hs-update-latest", (...args) => {
    updateLatest(args[0]);
  });

  on("hs-show-modal-add-favorite", (...args) => {
    showModalAddFavorite(...args);
  });

  on("hs-show-modal-favorite-options", (...args) => {
    showModalFavoriteOptions(...args);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const CardType = {
  EMPTY: "empty",
  LATEST: "latest",
  FAVORITES: "favorites",
  ADD_FAVORITE: "add favorite",
};

function updateFavorites(favorites) {
  const favoritesDiv = document.querySelector("#hs-favorites");
  favoritesDiv.innerHTML = "";

  const listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list");
  favoritesDiv.appendChild(listDiv);

  for (let index = 0; index < favorites.length; index++) {
    const data = favorites[index];
    listDiv.appendChild(getNewCardDiv(CardType.FAVORITES, data));
  }

  listDiv.appendChild(getNewCardDiv(CardType.ADD_FAVORITE));
}

function updateLatest(latest) {
  const latestDiv = document.querySelector("#hs-latest");
  latestDiv.innerHTML = "";

  const listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list");
  latestDiv.appendChild(listDiv);

  for (let index = 0; index < 6; index++) {
    if (latest && latest.length > index) {
      const data = latest[index];
      listDiv.appendChild(getNewCardDiv(CardType.LATEST, data));
    } else if (index < 4) {
      listDiv.appendChild(getNewCardDiv(CardType.EMPTY));
    }
  }
}

function getNewCardDiv(cardType, data) {
  const cardDiv = document.createElement("div");

  let hasButton = cardType === CardType.LATEST ? false : true;

  const buttonHtml = `
  <div class="hs-path-card-button hs-path-interactive">
    <i class="fas fa-ellipsis-h"></i>
  </div>`;
  const fileIconHtml = `
  <i class="hs-path-card-image-file fas fa-file fa-2x fa-fw"></i>`;
  const folderIconHtml = `
  <i class="hs-path-card-image-file fas fa-folder fa-2x fa-fw"></i>`;
  const imagesIconHtml = `
  <i class="hs-path-card-image-file fas fa-images fa-2x fa-fw"></i>`;
  const interactiveHtml = data
    ? `
  <div class="hs-path-card-main hs-path-interactive">
    <div class="hs-path-card-image">
      ${
        data.isFile
          ? fileIconHtml
          : cardType === CardType.LATEST
          ? imagesIconHtml
          : folderIconHtml
      }
    </div>
    <div class="hs-path-card-content">
      <span>${data.name}</span
      ><span>${data.path}</span>
    </div>
  </div>
  ${hasButton ? buttonHtml : ""}`
    : "";
  const emptyHtml = `
  <div class="hs-path-card-main hs-path-empty">
  </div>`;
  const addFavHtml = `
  <div class="hs-add-card-image">
    <i class="fas fa-plus-circle fa-2x fa-fw"></i>
  </div>`;

  switch (cardType) {
    case CardType.LATEST:
      {
        cardDiv.classList.add("hs-path-card");
        cardDiv.innerHTML = interactiveHtml;
        const mainCardDiv = cardDiv.querySelector(".hs-path-card-main");
        mainCardDiv.title = g_cardLocalization.openInReader;
        mainCardDiv.addEventListener("click", function (event) {
          sendIpcToMain("hs-open-file", data.path);
          event.stopPropagation();
        });
      }
      break;
    case CardType.FAVORITES:
      {
        cardDiv.classList.add("hs-path-card");
        cardDiv.innerHTML = interactiveHtml;
        const mainCardDiv = cardDiv.querySelector(".hs-path-card-main");
        mainCardDiv.title = data.isFile
          ? g_cardLocalization.openInReader
          : g_cardLocalization.openInSystemBrowser;
        mainCardDiv.addEventListener("click", function (event) {
          if (data.isFile) {
            sendIpcToMain("hs-open-file", data.path);
          } else {
            sendIpcToMain("hs-open-dialog-file", data.path);
          }
          event.stopPropagation();
        });

        const buttonDiv = cardDiv.querySelector(".hs-path-card-button");
        buttonDiv.title = g_cardLocalization.options;
        buttonDiv.addEventListener("click", function (event) {
          sendIpcToMain(
            "hs-on-favorite-options-clicked",
            data.index,
            data.path
          );
          event.stopPropagation();
        });
      }
      break;
    case CardType.EMPTY:
      cardDiv.classList.add("hs-path-card");
      cardDiv.innerHTML = emptyHtml;
      break;
    case CardType.ADD_FAVORITE:
      cardDiv.classList.add("hs-add-card");
      cardDiv.classList.add("hs-path-interactive");
      cardDiv.innerHTML = addFavHtml;
      cardDiv.title = g_cardLocalization.add;
      cardDiv.addEventListener("click", function (event) {
        sendIpcToMain("hs-on-add-favorite-clicked");
        event.stopPropagation();
      });
      break;
  }
  return cardDiv;
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showModalAddFavorite(
  title,
  textButtonBack,
  textButtonAddFile,
  textButtonAddFolder
) {
  if (getOpenModal()) {
    return;
  }
  let buttons = [];
  buttons.push({
    text: textButtonAddFile.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-add-favorite-file-clicked");
    },
  });
  buttons.push({
    text: textButtonAddFolder.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-add-favorite-folder-clicked");
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
    showFocus: true,
    title: title,
    frameWidth: 400,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

function showModalFavoriteOptions(
  index,
  path,
  title,
  textButtonBack,
  textButtonRemove
) {
  if (getOpenModal()) {
    return;
  }
  let buttons = [];
  buttons.push({
    text: textButtonRemove.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-favorite-options-remove-clicked", index, path);
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
    showFocus: true,
    title: title,
    frameWidth: 400,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_cardLocalization;

function updateLocalization(idsLocalization, cardLocalization) {
  // ids
  for (let index = 0; index < idsLocalization.length; index++) {
    const element = idsLocalization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.innerText = element.text;
    }
  }
  // cards
  g_cardLocalization = cardLocalization;
}
