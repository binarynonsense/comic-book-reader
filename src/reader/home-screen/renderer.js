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
import * as gamepads from "../../shared/renderer/gamepads.js";
import * as navigation from "./renderer-navigation.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_navData = {};

function init() {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
    ///////////
    const openFileButton = document.querySelector("#hs-openfile-button");
    openFileButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-open-dialog-file");
    });
    openFileButton.addEventListener("acbr-nav-click", (event) => {
      sendIpcToMain("hs-open-dialog-file", undefined, 1);
    });
    openFileButton.setAttribute("data-nav-panel", 0);
    openFileButton.setAttribute("data-nav-row", 0);
    openFileButton.setAttribute("data-nav-col", 0);
    openFileButton.setAttribute("data-nav-click", 0);
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

  on("hs-build-sections", (...args) => {
    buildSections(...args);
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

function buildSections(favorites, latest) {
  // FAVORITES
  const favoritesDiv = document.querySelector("#hs-favorites");
  favoritesDiv.innerHTML = "";

  let listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list");
  favoritesDiv.appendChild(listDiv);

  let navRow = 1;
  let navColumn = 0;

  for (let index = 0; index < favorites.length; index++) {
    const data = favorites[index];
    listDiv.appendChild(
      getNewCardDiv(CardType.FAVORITES, data, navRow, navColumn)
    );
    if (index % 2 === 0) {
      navColumn = 2;
    } else {
      navRow++;
      navColumn = 0;
    }
  }

  listDiv.appendChild(
    getNewCardDiv(CardType.ADD_FAVORITE, undefined, navRow, navColumn)
  );
  navColumn = 0;
  navRow++;

  // LATEST
  const latestDiv = document.querySelector("#hs-latest");
  latestDiv.innerHTML = "";

  listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list");
  latestDiv.appendChild(listDiv);

  for (let index = 0; index < 6; index++) {
    if (latest && latest.length > index) {
      const data = latest[index];
      listDiv.appendChild(
        getNewCardDiv(CardType.LATEST, data, navRow, navColumn)
      );
      navColumn++;
      if (navColumn >= 2) {
        navColumn = 0;
        navRow++;
      }
    } else if (index < 4) {
      listDiv.appendChild(
        getNewCardDiv(CardType.EMPTY, undefined, navRow, navColumn)
      );
      navColumn++;
      if (navColumn >= 2) {
        navColumn = 0;
        navRow++;
      }
    }
  }

  // NAVIGATION
  navigation.rebuild(g_navData, 0);
}

function getNewCardDiv(cardType, data, navRow, navColumn) {
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

        if (navRow !== undefined && navColumn !== undefined) {
          mainCardDiv.setAttribute("data-nav-panel", 0);
          mainCardDiv.setAttribute("data-nav-row", navRow);
          mainCardDiv.setAttribute("data-nav-col", navColumn);
          mainCardDiv.setAttribute("tabindex", "0");

          if (!data.isFile) {
            mainCardDiv.addEventListener("acbr-nav-click", (event) => {
              sendIpcToMain("hs-open-dialog-file", data.path, 1);
            });
            mainCardDiv.setAttribute("data-nav-click", 0);
          }
        }

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
        if (navRow !== undefined && navColumn !== undefined) {
          buttonDiv.setAttribute("data-nav-panel", 0);
          buttonDiv.setAttribute("data-nav-row", navRow);
          buttonDiv.setAttribute("data-nav-col", navColumn + 1);
          buttonDiv.setAttribute("tabindex", "0");
        }
      }
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
      if (navRow !== undefined && navColumn !== undefined) {
        cardDiv.setAttribute("data-nav-panel", 0);
        cardDiv.setAttribute("data-nav-row", navRow);
        cardDiv.setAttribute("data-nav-col", navColumn);
        cardDiv.setAttribute("tabindex", "0");
      }
      break;
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
        if (navRow !== undefined && navColumn !== undefined) {
          mainCardDiv.setAttribute("data-nav-panel", 0);
          mainCardDiv.setAttribute("data-nav-row", navRow);
          mainCardDiv.setAttribute("data-nav-col", navColumn);
          mainCardDiv.setAttribute("tabindex", "0");
        }
      }
      break;
    case CardType.EMPTY:
      cardDiv.classList.add("hs-path-card");
      cardDiv.innerHTML = emptyHtml;
      if (navRow !== undefined && navColumn !== undefined) {
        cardDiv.setAttribute("data-nav-panel", 0);
        cardDiv.setAttribute("data-nav-row", navRow);
        cardDiv.setAttribute("data-nav-col", navColumn);
        cardDiv.setAttribute("tabindex", "0");
      }
      break;
  }
  return cardDiv;
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  switch (type) {
    case "onkeydown":
      if (
        // disable default scrolling
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowLeft" ||
        event.key === " " ||
        // disable default zoom in out reset
        (event.key === "-" && event.ctrlKey) ||
        (event.key === "+" && event.ctrlKey) ||
        (event.key === "0" && event.ctrlKey)
      ) {
        event.preventDefault();
      }

      navigation.navigate(
        g_navData,
        event.key == "Enter",
        event.key == "ArrowUp",
        event.key == "ArrowDown",
        event.key == "ArrowLeft",
        event.key == "ArrowRight"
      );
      if (
        event.key == "Tab" ||
        event.key == "ArrowUp" ||
        event.key == "ArrowDown" ||
        event.key == "ArrowLeft" ||
        event.key == "ArrowRight"
      ) {
        event.preventDefault();
      }
      break;
  }
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPADS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  const upPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_UP) ||
    gamepads.getAxisDown(gamepads.Axes.RS_Y, -1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_Y, -1);
  const downPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_DOWN) ||
    gamepads.getAxisDown(gamepads.Axes.RS_Y, 1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_Y, 1);
  const leftPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_LEFT) ||
    gamepads.getAxisDown(gamepads.Axes.RS_X, -1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_X, -1);
  const rightPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_RIGHT) ||
    gamepads.getAxisDown(gamepads.Axes.RS_X, 1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_X, 1);

  navigation.navigate(
    g_navData,
    gamepads.getButtonDown(gamepads.Buttons.A),
    upPressed,
    downPressed,
    leftPressed,
    rightPressed
  );
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
