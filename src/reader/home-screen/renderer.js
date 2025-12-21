/**
 * @license
 * Copyright 2024-2025 Álvaro García
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
  getNavKeys,
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

let g_favorites;
let g_latest;

let g_draggedCard = null;

function init() {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
    ///////////
    const logoDiv = document.querySelector("#hs-logo-image");
    logoDiv.addEventListener("click", () => {
      let anim = 1;
      //anim = Math.floor(Math.random() * 2);
      if (
        !logoDiv.classList.contains("hs-animate-bounce") &&
        !logoDiv.classList.contains("hs-animate-gelatine")
      ) {
        if (anim == 0) {
          if (!logoDiv.classList.contains("hs-animate-bounce")) {
            logoDiv.classList.add("hs-animate-bounce");
            setTimeout(() => {
              logoDiv.classList.remove("hs-animate-bounce");
            }, (2000 * 30) / 100);
          }
        } else if (anim == 1) {
          if (!logoDiv.classList.contains("hs-animate-gelatine")) {
            logoDiv.classList.add("hs-animate-gelatine");
            setTimeout(() => {
              logoDiv.classList.remove("hs-animate-gelatine");
            }, 510);
          }
        } else if (anim == 2) {
          if (!logoDiv.classList.contains("hs-animate-hello")) {
            logoDiv.classList.add("hs-animate-hello");
            setTimeout(() => {
              logoDiv.classList.remove("hs-animate-hello");
            }, 550);
          }
        }
      }
    });
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
    const filesToolsButton = document.querySelector(
      "#hs-logo-files-tools-button"
    );
    filesToolsButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-files-tools");
    });
    // comicConverterButton.setAttribute("data-nav-panel", 0);
    // comicConverterButton.setAttribute("data-nav-row", 0);
    // comicConverterButton.setAttribute("data-nav-col", 3);
    // comicConverterButton.setAttribute("tabindex", "0");
    ///////////
    const artToolsButton = document.querySelector("#hs-logo-art-tools-button");
    artToolsButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-art-tools");
    });
    ///////////
    const rssReaderButton = document.querySelector(
      "#hs-logo-rss-reader-button"
    );
    rssReaderButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-open-rss-reader");
    });
    ///////////
    const radioButton = document.querySelector("#hs-logo-radio-button");
    radioButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-open-radio");
    });
    ///////////
    const quitButton = document.querySelector("#hs-logo-quit-button");
    quitButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-quit");
    });
    /////////////////////////
    const addFavoriteButton = document.querySelector(
      "#hs-favorites-add-button"
    );
    addFavoriteButton.addEventListener("click", function (event) {
      sendIpcToMain(
        "hs-on-add-favorite-clicked",
        event == undefined || event.pointerType !== "mouse"
      );
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

  on("hs-show-modal-files-tools", (...args) => {
    showModalFilesTools(...args);
  });

  on("hs-show-modal-art-tools", (...args) => {
    showModalArtTools(...args);
  });

  on("hs-show-modal-latest-options", (...args) => {
    showModalLatestOptions(...args);
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

function buildSections(
  languageDirection,
  favorites,
  latest,
  maxLatest,
  refocus
) {
  g_languageDirection = languageDirection;
  g_favorites = favorites;
  g_latest = latest;
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
      // OLD LATEST CODE
      // if (g_languageDirection === "rtl") {
      //   if (index % 2 === 0) {
      //     if (index !== 0) navRow++;
      //     navColumn = 1;
      //     if (index === latest.length - 1) {
      //       navColumn = 0;
      //     }
      //   } else {
      //     navColumn = 0;
      //   }
      // } else {
      //   if (index % 2 === 0) {
      //     navColumn = 0;
      //     if (index !== 0) navRow++;
      //   } else {
      //     navColumn = 1;
      //   }
      // }

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
  navigation.rebuild(g_navData, refocus ? 0 : undefined);
}

function getNewCardDiv(cardType, data, navRow, navColumn) {
  const cardDiv = document.createElement("div");

  // let hasButton = cardType === CardType.LATEST ? false : true;
  let hasButton = true;

  const buttonHtml = `
  <div class="hs-path-card-button hs-path-interactive">
    <i class="fas fa-ellipsis-h"></i>
  </div>`;
  //<i class="fa-solid fa-grip"></i>
  const dragMiniIconHtml = `
  <div class="hs-path-card-dragminiicon">    
    <i class="fa-solid fa-arrows-up-down-left-right"></i>
  </div>`;
  const favMiniIconHtml = `
  <div class="hs-path-card-favminiicon">
    <i class="fa-solid fa-heart"></i>
  </div>`;
  function getIconHtml() {
    const fileIconHtml = `
  <i class="hs-path-card-image-file fas fa-file fa-2x fa-fw"></i>`;
    const folderIconHtml = `
  <i class="hs-path-card-image-file fas fa-folder-closed fa-2x fa-fw"></i>`;
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
    ${cardType === CardType.FAVORITES ? dragMiniIconHtml : ""}
    <div class="hs-path-card-image">
      ${getIconHtml()}     
      ${
        cardType === CardType.LATEST && data.isInFavorites
          ? favMiniIconHtml
          : ""
      } 
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
          if (data.pathType === 1) {
            sendIpcToMain("hs-open-dialog-file", data.path);
          } else {
            sendIpcToMain("hs-open-favorite-file", data);
          }
          if (event.pointerType === "mouse") {
            navigation.refocusFocusedElement(g_navData);
            navigation.blurFocusedElement(g_navData);
          }
          event.stopPropagation();
        });

        // dragging ///////////
        mainCardDiv.draggable = true;
        // select
        mainCardDiv.addEventListener("dragstart", function (event) {
          g_draggedCard = event.target;
          mainCardDiv.classList.add("hs-path-card-main-dragging");
          mainCardDiv.blur();
          event.stopPropagation();
        });
        mainCardDiv.addEventListener("dragend", function (event) {
          g_draggedCard = undefined;
          mainCardDiv.classList.remove("hs-path-card-main-dragging");
          event.stopPropagation();
        });
        // drop
        mainCardDiv.addEventListener("drop", (event) => {
          if (event.target.classList.contains("hs-path-card-main")) {
            mainCardDiv.classList.remove("hs-path-card-main-dragging-over");
            sendIpcToMain(
              "hs-on-favorite-dropped",
              g_draggedCard.getAttribute("data-fav-index"),
              event.target.getAttribute("data-fav-index")
            );
            event.preventDefault();
          }
        });
        // receive
        mainCardDiv.addEventListener("dragover", function (event) {
          const draggingElement = document.querySelector(
            ".hs-path-card-main-dragging"
          );
          if (draggingElement && mainCardDiv != draggingElement) {
            event.preventDefault();
            mainCardDiv.classList.add("hs-path-card-main-dragging-over");
            event.stopPropagation();
          }
        });
        mainCardDiv.addEventListener("dragleave", function (event) {
          mainCardDiv.classList.remove("hs-path-card-main-dragging-over");
          event.stopPropagation();
        });
        // data
        mainCardDiv.setAttribute("data-fav-index", data.index);
        /////////////

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
            data.path,
            event == undefined || event.pointerType !== "mouse"
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
        sendIpcToMain(
          "hs-on-add-favorite-clicked",
          event == undefined || event.pointerType !== "mouse"
        );
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

        const buttonDiv = cardDiv.querySelector(".hs-path-card-button");
        buttonDiv.title = g_cardLocalization.options;
        buttonDiv.addEventListener("click", function (event) {
          sendIpcToMain(
            "hs-on-latest-options-clicked",
            data.index,
            data.path,
            event == undefined || event.pointerType !== "mouse"
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
    // OLD LATEST CODE
    // case CardType.LATEST:
    //   {
    //     cardDiv.classList.add("hs-path-card");
    //     cardDiv.innerHTML = interactiveHtml;
    //     const mainCardDiv = cardDiv.querySelector(".hs-path-card-main");
    //     mainCardDiv.title = g_cardLocalization.openInReader;
    //     mainCardDiv.addEventListener("click", function (event) {
    //       sendIpcToMain("hs-open-history-file", data.index);
    //       event.stopPropagation();
    //     });
    //     if (navRow !== undefined && navColumn !== undefined) {
    //       mainCardDiv.setAttribute("data-nav-panel", 0);
    //       mainCardDiv.setAttribute("data-nav-row", navRow);
    //       mainCardDiv.setAttribute("data-nav-col", navColumn);
    //       mainCardDiv.setAttribute("tabindex", "0");
    //     }
    //   }
    //   break;
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
      }
      ///
      if (
        input.isActionDownThisFrame({
          source: input.Source.KEYBOARD,
          commands: getNavKeys().quickMenu,
          event: event,
        })
      ) {
        inputOpenQuickMenu();
        event.stopPropagation();
        return;
      } else if (input.checkShortcut("history", "history")) {
        event.stopPropagation();
        return;
      } else if (input.checkShortcut("openFile", "open-file")) {
        event.stopPropagation();
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
        if (event.dataTransfer.files[0]) {
          sendIpcToMain(
            "open-file",
            ipc.showFilePath(event.dataTransfer.files[0])
          );
        }
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

function showModalFilesTools(
  title,
  textButtonBack,
  textButtonConvertFiles,
  textButtonCreateFile,
  textButtonConvertImages,
  textButtonExtractComics,
  showFocus
) {
  if (getOpenModal()) {
    return;
  }
  let buttons = [];
  buttons.push({
    text: textButtonConvertFiles.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-files-tools-convert-files-clicked");
    },
  });
  buttons.push({
    text: textButtonCreateFile.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-files-tools-create-file-clicked");
    },
  });
  buttons.push({
    text: textButtonConvertImages.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-files-tools-convert-images-clicked");
    },
  });
  buttons.push({
    text: textButtonExtractComics.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-files-tools-extract-comics-clicked");
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

function showModalArtTools(
  title,
  textButtonBack,
  textButtonTemplateMaker,
  textButtonExtractPalette,
  showFocus
) {
  if (getOpenModal()) {
    return;
  }
  let buttons = [];
  buttons.push({
    text: textButtonTemplateMaker.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-art-tools-template-maker-clicked");
    },
  });
  buttons.push({
    text: textButtonExtractPalette.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-art-tools-extract-palette-clicked");
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

///////////////////

function showModalAddFavorite(
  title,
  textButtonBack,
  textButtonAddFile,
  textButtonAddFolder,
  showFocus
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
    showFocus: showFocus,
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
  textButtonMoveBackward,
  textButtonOpenFolder,
  textButtonFolderFavorite,
  showFocus
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
  let isWeb =
    path === undefined || path.startsWith("http:") || path.startsWith("https:");
  if (!isWeb) {
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
    //
    if (textButtonOpenFolder)
      buttons.push({
        text: textButtonOpenFolder.toUpperCase(),
        fullWidth: true,
        callback: () => {
          modalClosed();
          sendIpcToMain(
            "hs-on-modal-favorite-options-openfolder-clicked",
            index,
            path
          );
        },
      });
    if (textButtonFolderFavorite)
      buttons.push({
        text: textButtonFolderFavorite.toUpperCase(),
        fullWidth: true,
        callback: () => {
          modalClosed();
          sendIpcToMain(
            "hs-on-modal-favorite-options-addfoldertofavorites-clicked",
            index,
            path
          );
        },
      });
  }
  // TODO: enable move up & down only if using gamepad?
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
  //
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
        callback: (showFocus, value) => {
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
        callback: (showFocus, value) => {
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

function showModalLatestOptions(
  index,
  path,
  isFavorite,
  title,
  textButtonBack,
  textButtonFavorite,
  textButtonOpenFolder,
  textButtonFolderFavorite,
  showFocus
) {
  if (getOpenModal()) {
    return;
  }

  let buttons = [];
  let isWeb =
    path === undefined || path.startsWith("http:") || path.startsWith("https:");
  if (!isFavorite) {
    buttons.push({
      text: textButtonFavorite.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain(
          "hs-on-modal-latest-options-addtofavorites-clicked",
          index,
          path
        );
      },
    });
  } else {
    buttons.push({
      text: textButtonFavorite.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain(
          "hs-on-modal-latest-options-removefromfavorites-clicked",
          index,
          path
        );
      },
    });
  }
  if (!isWeb) {
    buttons.push({
      text: textButtonOpenFolder.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain(
          "hs-on-modal-latest-options-openfolder-clicked",
          index,
          path
        );
      },
    });
    if (textButtonFolderFavorite)
      buttons.push({
        text: textButtonFolderFavorite.toUpperCase(),
        fullWidth: true,
        callback: () => {
          modalClosed();
          sendIpcToMain(
            "hs-on-modal-latest-options-addfoldertofavorites-clicked",
            index,
            path
          );
        },
      });
  }
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

function updateLocalization(
  idsLocalization,
  cardLocalization,
  preferencesTitle,
  historyTitle,
  filesToolsTitle,
  artToolsTitle,
  rssReaderTitle,
  radioTitle,
  quitTitle,
  addFavoriteTitle,
  favoritesSectionTitle,
  latestSectionTitle
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
  // files tools
  const filesToolsButton = document.querySelector(
    "#hs-logo-files-tools-button"
  );
  filesToolsButton.title = filesToolsTitle;
  // art tools
  const artToolsButton = document.querySelector("#hs-logo-art-tools-button");
  artToolsButton.title = artToolsTitle;
  // rss reader
  const rssReaderButton = document.querySelector("#hs-logo-rss-reader-button");
  rssReaderButton.title = rssReaderTitle;
  // radio
  const radioButton = document.querySelector("#hs-logo-radio-button");
  radioButton.title = radioTitle;
  // quit
  const quitButton = document.querySelector("#hs-logo-quit-button");
  quitButton.title = quitTitle;
  // add favorite
  const addFavoriteButton = document.querySelector("#hs-favorites-add-button");
  addFavoriteButton.title = addFavoriteTitle;
  // favorites title
  const favoritesSectionTitleSpan = document.querySelector(
    "#hs-favorites-title"
  );
  favoritesSectionTitleSpan.innerHTML = `<i class="fa-solid fa-heart hs-section-title-icon"></i><span>${favoritesSectionTitle}</span>`;
  // latest title
  const latestSectionTitleSpan = document.querySelector("#hs-latest-title");
  latestSectionTitleSpan.innerHTML = `<i class="fas fa-history hs-section-title-icon"></i><span>${latestSectionTitle}</span>`;
}
