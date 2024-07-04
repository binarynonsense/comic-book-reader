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
  getNavButtons,
  inputOpenQuickMenu,
  onMouseMove,
  getMouseButtons,
} from "../../reader/renderer-ui.js";
import * as input from "../../shared/renderer/input.js";
import * as navigation from "./renderer-navigation.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_navData = {};
let g_languageDirection = "ltr";
let g_pagesContainerDiv;

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
    ///////////
    const preferencesButton = document.querySelector(
      "#hs-logo-preferences-button"
    );
    preferencesButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-open-preferences");
    });
    // preferencesButton.setAttribute("data-nav-panel", 0);
    // preferencesButton.setAttribute("data-nav-row", 0);
    // preferencesButton.setAttribute("data-nav-col", 1);
    // preferencesButton.setAttribute("tabindex", "0");
    ///////////
    const historyButton = document.querySelector("#hs-logo-history-button");
    historyButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-open-history");
    });
    // preferencesButton.setAttribute("data-nav-panel", 0);
    // preferencesButton.setAttribute("data-nav-row", 0);
    // preferencesButton.setAttribute("data-nav-col", 2);
    // preferencesButton.setAttribute("tabindex", "0");
    ///////////
    const comicConverterButton = document.querySelector(
      "#hs-logo-convert-comics-button"
    );
    comicConverterButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-open-convert-comics");
    });
    // comicConverterButton.setAttribute("data-nav-panel", 0);
    // comicConverterButton.setAttribute("data-nav-row", 0);
    // comicConverterButton.setAttribute("data-nav-col", 3);
    // comicConverterButton.setAttribute("tabindex", "0");
    /////////////////////////
    const addFavoriteButton = document.querySelector(
      "#hs-favorites-add-button"
    );
    addFavoriteButton.addEventListener("click", function (event) {
      sendIpcToMain("hs-on-add-favorite-clicked");
      event.stopPropagation();
    });
    addFavoriteButton.setAttribute("data-nav-panel", 0);
    addFavoriteButton.setAttribute("data-nav-row", 1);
    addFavoriteButton.setAttribute("data-nav-col", 0);
    addFavoriteButton.setAttribute("tabindex", "0");
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

  on("hs-show-modal-favorite-edit-name", (...args) => {
    showModalFavoriteEditName(...args);
  });

  on("hs-show-modal-favorite-edit-path", (...args) => {
    showModalFavoriteEditPath(...args);
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

function buildSections(languageDirection, favorites, latest, maxLatest) {
  g_languageDirection = languageDirection;
  // FAVORITES
  const favoritesDiv = document.querySelector("#hs-favorites");
  favoritesDiv.innerHTML = "";

  let listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list");
  favoritesDiv.appendChild(listDiv);

  let navRow = 2;
  let navColumn = 0;
  let index = 0;
  for (; index < favorites.length; index++) {
    const data = favorites[index];
    if (g_languageDirection === "rtl") {
      if (index % 2 === 0) {
        if (index !== 0) navRow++;
        navColumn = 3;
        if (index === favorites.length - 1) navColumn = 1;
      } else {
        navColumn = 1;
      }
    } else {
      if (index % 2 === 0) {
        navColumn = 0;
        if (index !== 0) navRow++;
      } else {
        navColumn = 2;
      }
    }
    listDiv.appendChild(
      getNewCardDiv(CardType.FAVORITES, data, navRow, navColumn)
    );
  }
  // Add
  // if (g_languageDirection === "rtl") {
  //   navColumn = 0;
  //   if (index % 2 === 0 && index !== 0) {
  //     navRow++;
  //   }
  // } else {
  //   if (index % 2 === 0) {
  //     navColumn = 0;
  //     if (index !== 0) navRow++;
  //   } else {
  //     navColumn = 2;
  //   }
  // }
  // listDiv.appendChild(
  //   getNewCardDiv(CardType.ADD_FAVORITE, undefined, navRow, navColumn)
  // );
  navRow++;

  // LATEST
  const latestTitleDiv = document.querySelector("#hs-latest-title");
  const latestDiv = document.querySelector("#hs-latest");
  latestDiv.innerHTML = "";
  if (maxLatest <= 0 || latest.length <= 0) {
    latestTitleDiv.classList.add("set-display-none");
  } else {
    latestTitleDiv.classList.remove("set-display-none");

    listDiv = document.createElement("div");
    listDiv.classList.add("hs-path-cards-list");
    latestDiv.appendChild(listDiv);

    // NOTE: I decided to not show empty slots but I'll leave the
    // code for that in case I change my mind
    const max = Math.max(0, latest.length);
    //const max = Math.max(2, 2 * Math.round(latest.length / 2));
    for (index = 0; index < max; index++) {
      if (g_languageDirection === "rtl") {
        if (index % 2 === 0) {
          if (index !== 0) navRow++;
          navColumn = 1;
          if (index === latest.length - 1) {
            navColumn = 0;
          }
        } else {
          navColumn = 0;
        }
      } else {
        if (index % 2 === 0) {
          navColumn = 0;
          if (index !== 0) navRow++;
        } else {
          navColumn = 1;
        }
      }
      if (latest && latest.length > index) {
        const data = latest[index];
        listDiv.appendChild(
          getNewCardDiv(CardType.LATEST, data, navRow, navColumn)
        );
      } else {
        listDiv.appendChild(
          getNewCardDiv(CardType.EMPTY, undefined, navRow, navColumn)
        );
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
  function getIconHtml() {
    const fileIconHtml = `
  <i class="hs-path-card-image-file fas fa-file fa-2x fa-fw"></i>`;
    const folderIconHtml = `
  <i class="hs-path-card-image-file fas fa-folder fa-2x fa-fw"></i>`;
    const imagesIconHtml = `
  <i class="hs-path-card-image-file fas fa-images fa-2x fa-fw"></i>`;
    const questionIconHtml = `
  <i class="hs-path-card-image-file fas fa-question fa-2x fa-fw"></i>`;
    const wwwIconHtml = `
  <i class="hs-path-card-image-file fas fa-globe fa-2x fa-fw"></i>`;
    if (data.pathType === -1) {
      return questionIconHtml;
    } else {
      if (data.pathType === 0) {
        return fileIconHtml;
      } else if (data.pathType === 2) {
        return wwwIconHtml;
      } else {
        if (cardType === CardType.LATEST) {
          return imagesIconHtml;
        } else {
          return folderIconHtml;
        }
      }
    }
  }
  const interactiveHtml = data
    ? `
  <div class="hs-path-card-main hs-path-interactive">
    <div class="hs-path-card-image">
      ${getIconHtml()}
    </div>
    <div class="hs-path-card-content">
      <span>${data.name}</span
      >${data.path ? "<span>" + data.path + "</span>" : ""}
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

        if (data.pathType <= 0) {
          mainCardDiv.title = g_cardLocalization.openInReader;
        } else if (data.pathType === 1) {
          mainCardDiv.title = g_cardLocalization.openInSystemBrowser;
        }

        mainCardDiv.addEventListener("click", function (event) {
          if (data.pathType <= 0) {
            sendIpcToMain("hs-open-file", data.path);
          } else if (data.pathType === 1) {
            sendIpcToMain("hs-open-dialog-file", data.path);
          }
          event.stopPropagation();
        });

        if (navRow !== undefined && navColumn !== undefined) {
          mainCardDiv.setAttribute("data-nav-panel", 0);
          mainCardDiv.setAttribute("data-nav-row", navRow);
          mainCardDiv.setAttribute("data-nav-col", navColumn);
          mainCardDiv.setAttribute("tabindex", "0");
          if (data.pathType === 1) {
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
          if (g_languageDirection === "rtl") {
            navColumn -= 1;
          } else {
            navColumn += 1;
          }
          buttonDiv.setAttribute("data-nav-col", navColumn);
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
          sendIpcToMain("hs-open-history-file", data.index);
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
      // if (navRow !== undefined && navColumn !== undefined) {
      //   cardDiv.setAttribute("data-nav-panel", 0);
      //   cardDiv.setAttribute("data-nav-row", navRow);
      //   cardDiv.setAttribute("data-nav-col", navColumn);
      //   cardDiv.setAttribute("tabindex", "0");
      // }
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
      } else if (event.key == "F1") {
        inputOpenQuickMenu();
        return;
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

    case "body.ondrop":
      {
        sendIpcToMain("open-file", event.dataTransfer.files[0].path);
      }
      break;

    case "mousemove":
      {
        if (!g_pagesContainerDiv) {
          g_pagesContainerDiv = document.getElementById("pages-container");
        }
        let fileOpen =
          g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
        onMouseMove(fileOpen);
      }
      break;

    case "acbr-mouseup":
      {
        if (
          getMouseButtons().quickMenu &&
          event.button === getMouseButtons().quickMenu
        ) {
          inputOpenQuickMenu(false);
        }
      }
      break;
  }
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPADS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  if (
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: getNavButtons().quickMenu,
    })
  ) {
    inputOpenQuickMenu();
    return;
  }

  const upPressed =
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_UP"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_UP"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_UP"],
    });
  const downPressed =
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_DOWN"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_DOWN"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_DOWN"],
    });
  const leftPressed =
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_LEFT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_LEFT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_LEFT"],
    });
  const rightPressed =
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_RIGHT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_RIGHT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_RIGHT"],
    });

  navigation.navigate(
    g_navData,
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["A"],
    }),
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
  textButtonRemove,
  textButtonEditName,
  textButtonEditPath,
  textButtonMoveForward,
  textButtonMoveBackward
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
        "hs-on-modal-favorite-options-edit-name-clicked",
        index,
        path
      );
    },
  });
  buttons.push({
    text: textButtonEditPath.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "hs-on-modal-favorite-options-edit-path-clicked",
        index,
        path
      );
    },
  });
  buttons.push({
    text: textButtonMoveBackward.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "hs-on-modal-favorite-options-move-clicked",
        index,
        path,
        0
      );
    },
  });
  buttons.push({
    text: textButtonMoveForward.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "hs-on-modal-favorite-options-move-clicked",
        index,
        path,
        1
      );
    },
  });
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

function showModalFavoriteEditName(
  index,
  path,
  name,
  title,
  textButton1,
  textButton2
) {
  if (getOpenModal()) {
    return;
  }

  showModal({
    title: title,
    zIndexDelta: -450,
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
        callback: (value) => {
          sendIpcToMain(
            "hs-on-modal-favorite-options-edit-name-ok-clicked",
            index,
            path,
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

function showModalFavoriteEditPath(
  index,
  path,
  title,
  textButton1,
  textButton2
) {
  if (getOpenModal()) {
    return;
  }

  showModal({
    title: title,
    zIndexDelta: -450,
    input: { type: "text", default: path },
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: (value) => {
          sendIpcToMain(
            "hs-on-modal-favorite-options-edit-path-ok-clicked",
            index,
            path,
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

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_cardLocalization;

function updateLocalization(
  idsLocalization,
  cardLocalization,
  preferencesTitle,
  historyTitle,
  comicConverterTitle,
  addFavoriteTitle
) {
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
  // preferences
  const preferencesButton = document.querySelector(
    "#hs-logo-preferences-button"
  );
  preferencesButton.title = preferencesTitle;
  // history
  const historyButton = document.querySelector("#hs-logo-history-button");
  historyButton.title = historyTitle;
  // convert comics
  const comicConverterButton = document.querySelector(
    "#hs-logo-convert-comics-button"
  );
  comicConverterButton.title = comicConverterTitle;
  // add favorite
  const addFavoriteButton = document.querySelector("#hs-favorites-add-button");
  addFavoriteButton.title = addFavoriteTitle;
}
