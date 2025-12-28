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

let g_userLists;

let g_collapsedNumRowsShown = 3;
let g_collapseLatest = true;
let g_collapseFavorites = true;

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
    ///////////
    const collapseLatestButton = document.querySelector(
      "#hs-latest-collapse-button"
    );
    collapseLatestButton.addEventListener("click", function (event) {
      sendIpcToMain("hs-on-collapse-list-clicked", -2, true);
      event.stopPropagation();
    });
    const expandLatestButton = document.querySelector(
      "#hs-latest-expand-button"
    );
    expandLatestButton.addEventListener("click", function (event) {
      sendIpcToMain("hs-on-collapse-list-clicked", -2, false);
      event.stopPropagation();
    });
    ///////////
    const collapseFavoritesButton = document.querySelector(
      "#hs-favorites-collapse-button"
    );
    collapseFavoritesButton.addEventListener("click", function (event) {
      sendIpcToMain("hs-on-collapse-list-clicked", -1, true);
      event.stopPropagation();
    });
    const expandFavoritesButton = document.querySelector(
      "#hs-favorites-expand-button"
    );
    expandFavoritesButton.addEventListener("click", function (event) {
      sendIpcToMain("hs-on-collapse-list-clicked", -1, false);
      event.stopPropagation();
    });
    ///////////
    const createListButton = document.querySelector("#hs-addlist-add-button");
    createListButton.addEventListener("click", (event) => {
      sendIpcToMain("hs-on-create-list-clicked");
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

  on("hs-build-sections", (...args) => {
    buildSections(...args);
  });

  ///////////

  on("hs-set-list-collapse-value", (listIndex, value) => {
    if (listIndex === -2) g_collapseLatest = value;
    else if (listIndex === -1) g_collapseFavorites = value;
    else {
      // TODO
    }
  });

  ///////////

  on("hs-show-modal-add-list-entry", (...args) => {
    showModalAddListEntry(...args);
  });

  on("hs-show-modal-edit-list-name", (...args) => {
    showModalEditListName(...args);
  });

  on("hs-show-modal-remove-list-warning", (...args) => {
    showModalRemoveListWarning(...args);
  });

  on("hs-show-modal-list-entry-options", (...args) => {
    showModalListEntryOptions(...args);
  });

  on("hs-show-modal-list-entry-edit-name", (...args) => {
    showModalListEntryEditName(...args);
  });

  on("hs-show-modal-list-entry-edit-path", (...args) => {
    showModalListEntryEditPath(...args);
  });

  on("hs-show-modal-drop-card-options", (...args) => {
    showModalDropCardOptions(...args);
  });

  ///////////

  on("hs-show-modal-files-tools", (...args) => {
    showModalFilesTools(...args);
  });

  on("hs-show-modal-art-tools", (...args) => {
    showModalArtTools(...args);
  });

  on("hs-show-modal-latest-options", (...args) => {
    showModalLatestOptions(...args);
  });

  on("hs-show-modal-create-list", (...args) => {
    showModalCreateList(...args);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const CardType = {
  EMPTY: "empty",
  LATEST: "latest",
  FAVORITES: "favorites",
  USERLIST: "user list",
};

function isListCollapsed(listIndex) {
  if (listIndex === -2) return g_collapseLatest;
  else if (listIndex === -1) return g_collapseFavorites;
  else {
    return g_userLists[listIndex].collapsed;
  }
}

function buildSections(
  languageDirection,
  favorites,
  latest,
  userLists,
  localization,
  refocus
) {
  g_languageDirection = languageDirection;
  g_userLists = userLists;

  let navRow = 1;
  let navColumn = 0;

  // FAVORITES ////////////////////
  // title
  const addFavoriteButton = document.querySelector("#hs-favorites-add-button");
  addFavoriteButton.addEventListener("click", function (event) {
    sendIpcToMain(
      "hs-on-add-list-entry-clicked",
      -1,
      event == undefined || event.pointerType !== "mouse"
    );
    event.stopPropagation();
  });
  addFavoriteButton.setAttribute("data-nav-panel", 0);
  addFavoriteButton.setAttribute("data-nav-row", navRow);
  addFavoriteButton.setAttribute("data-nav-col", navColumn++);
  addFavoriteButton.setAttribute("tabindex", "0");

  const collapseFavoritesButton = document.querySelector(
    "#hs-favorites-collapse-button"
  );
  const expandFavoritesButton = document.querySelector(
    "#hs-favorites-expand-button"
  );

  // cards
  const favoritesDiv = document.querySelector("#hs-favorites");
  favoritesDiv.innerHTML = "";

  let listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list");
  favoritesDiv.appendChild(listDiv);

  let max = favorites.length;
  let showFavoritesEllipsis = false;
  if (favorites.length <= g_collapsedNumRowsShown * 2) {
    collapseFavoritesButton.classList.add("set-display-none");
    expandFavoritesButton.classList.add("set-display-none");
  } else {
    if (isListCollapsed(-1)) {
      collapseFavoritesButton.classList.add("set-display-none");
      expandFavoritesButton.classList.remove("set-display-none");
      collapseFavoritesButton.removeAttribute("data-nav-panel");
      collapseFavoritesButton.removeAttribute("data-nav-row");
      collapseFavoritesButton.removeAttribute("data-nav-col");
      expandFavoritesButton.setAttribute("data-nav-panel", 0);
      expandFavoritesButton.setAttribute("data-nav-row", navRow);
      expandFavoritesButton.setAttribute("data-nav-col", navColumn++);
      expandFavoritesButton.setAttribute("tabindex", "0");
      max = g_collapsedNumRowsShown * 2;
      if (favorites.length > max) showFavoritesEllipsis = true;
    } else {
      collapseFavoritesButton.classList.remove("set-display-none");
      expandFavoritesButton.classList.add("set-display-none");
      collapseFavoritesButton.setAttribute("data-nav-panel", 0);
      collapseFavoritesButton.setAttribute("data-nav-row", navRow);
      collapseFavoritesButton.setAttribute("data-nav-col", navColumn++);
      collapseFavoritesButton.setAttribute("tabindex", "0");
      expandFavoritesButton.removeAttribute("data-nav-panel");
      expandFavoritesButton.removeAttribute("data-nav-row");
      expandFavoritesButton.removeAttribute("data-nav-col");
    }
  }
  max = Math.max(2, 2 * Math.round(max / 2));

  ///////

  if (favorites.length > 0) {
    // if not, just empty cards
    navRow++;
    navColumn = 0;
  }
  for (let cardIndex = 0; cardIndex < max; cardIndex++) {
    if (g_languageDirection === "rtl") {
      if (cardIndex % 2 === 0) {
        if (cardIndex !== 0) navRow++;
        navColumn = 3;
        if (cardIndex === favorites.length - 1) navColumn = 1;
      } else {
        navColumn = 1;
      }
    } else {
      if (cardIndex % 2 === 0) {
        navColumn = 0;
        if (cardIndex !== 0) navRow++;
      } else {
        navColumn = 2;
      }
    }
    if (favorites && favorites.length > cardIndex) {
      const data = favorites[cardIndex];
      listDiv.appendChild(
        getNewCardDiv(CardType.FAVORITES, data, navRow, navColumn, -1)
      );
    } else {
      listDiv.appendChild(
        getNewCardDiv(CardType.EMPTY, undefined, navRow, navColumn, -1)
      );
    }
  }
  if (showFavoritesEllipsis) {
    const ellipsis = document.createElement("div");
    ellipsis.classList = "hs-section-ellipsis";
    ellipsis.innerHTML = `<i class="fa-solid fa-ellipsis"></i>`;
    favoritesDiv.appendChild(ellipsis);
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

  // LATEST //////////////////////
  const latestTitleDiv = document.querySelector("#hs-latest-title");
  const latestDiv = document.querySelector("#hs-latest");
  const collapseLatestButton = document.querySelector(
    "#hs-latest-collapse-button"
  );
  const expandLatestButton = document.querySelector("#hs-latest-expand-button");
  latestDiv.innerHTML = "";

  latestTitleDiv.classList.remove("set-display-none");
  listDiv = document.createElement("div");
  listDiv.classList.add("hs-path-cards-list");
  latestDiv.appendChild(listDiv);

  max = latest.length;
  // collapse / expand button ////////////
  let showLatestEllipsis = false;
  if (latest.length <= g_collapsedNumRowsShown * 2) {
    collapseLatestButton.classList.add("set-display-none");
    expandLatestButton.classList.add("set-display-none");
  } else {
    navRow++;
    navColumn = 0;
    if (isListCollapsed(-2)) {
      collapseLatestButton.classList.add("set-display-none");
      expandLatestButton.classList.remove("set-display-none");
      collapseLatestButton.removeAttribute("data-nav-panel");
      collapseLatestButton.removeAttribute("data-nav-row");
      collapseLatestButton.removeAttribute("data-nav-col");
      expandLatestButton.setAttribute("data-nav-panel", 0);
      expandLatestButton.setAttribute("data-nav-row", navRow);
      expandLatestButton.setAttribute("data-nav-col", navColumn++);
      expandLatestButton.setAttribute("tabindex", "0");
      max = g_collapsedNumRowsShown * 2;
      if (latest.length > max) showLatestEllipsis = true;
    } else {
      collapseLatestButton.classList.remove("set-display-none");
      expandLatestButton.classList.add("set-display-none");
      collapseLatestButton.setAttribute("data-nav-panel", 0);
      collapseLatestButton.setAttribute("data-nav-row", navRow);
      collapseLatestButton.setAttribute("data-nav-col", navColumn++);
      collapseLatestButton.setAttribute("tabindex", "0");
      expandLatestButton.removeAttribute("data-nav-panel");
      expandLatestButton.removeAttribute("data-nav-row");
      expandLatestButton.removeAttribute("data-nav-col");
    }
  }
  max = Math.max(2, 2 * Math.round(max / 2));
  //////////////////
  if (latest.length > 0) {
    // if not, just empty cards
    navRow++;
    navColumn = 0;
  }
  for (let cardIndex = 0; cardIndex < max; cardIndex++) {
    if (g_languageDirection === "rtl") {
      if (cardIndex % 2 === 0) {
        if (cardIndex !== 0) navRow++;
        navColumn = 3;
        if (cardIndex === favorites.length - 1) navColumn = 1;
      } else {
        navColumn = 1;
      }
    } else {
      if (cardIndex % 2 === 0) {
        navColumn = 0;
        if (cardIndex !== 0) navRow++;
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

    if (latest && latest.length > cardIndex) {
      const data = latest[cardIndex];
      listDiv.appendChild(
        getNewCardDiv(CardType.LATEST, data, navRow, navColumn, -2)
      );
    } else {
      listDiv.appendChild(
        getNewCardDiv(CardType.EMPTY, undefined, navRow, navColumn, -2)
      );
    }
  }
  if (showLatestEllipsis) {
    const ellipsis = document.createElement("div");
    ellipsis.classList = "hs-section-ellipsis";
    ellipsis.innerHTML = `<i class="fa-solid fa-ellipsis"></i>`;
    latestDiv.appendChild(ellipsis);
  }
  // USER LISTS //////////////////
  const listsDiv = document.querySelector("#hs-lists");
  listsDiv.innerHTML = "";
  if (userLists && userLists.length > 0) {
    for (let listIndex = 0; listIndex < userLists.length; listIndex++) {
      const list = userLists[listIndex];
      navRow++;
      navColumn = 0;

      //title
      const titleDiv = document.createElement("div");
      titleDiv.classList = "hs-section-title";
      titleDiv.innerHTML = `
      <div><i class="fa-solid fa-list hs-section-title-icon"></i> ${list.name}</div>
      <div class="hs-section-title-buttons">        
        <div id="hs-list-${listIndex}-edit-name-button" class="hs-section-title-button">
          <i class="fa-solid fa-pen"></i>
        </div>
         <div id="hs-list-${listIndex}-remove-button" class="hs-section-title-button">
          <i class="fa-solid fa-trash-can"></i>
        </div>
        <div id="hs-list-${listIndex}-add-button" class="hs-section-title-button">
          <i class="fas fa-plus-circle"></i>
        </div>
        <div id="hs-list-${listIndex}-collapse-button" class="hs-section-title-button">
          <i class="fa-solid fa-circle-chevron-up"></i>
        </div>
        <div id="hs-list-${listIndex}-expand-button" class="hs-section-title-button">
          <i class="fa-solid fa-circle-chevron-down"></i>
        </div>
      </div>`;
      listsDiv.appendChild(titleDiv);

      const contentDiv = document.createElement("div");
      contentDiv.id = `hs-list-${listIndex}`;
      contentDiv.classList = "hs-section-content";
      listsDiv.appendChild(contentDiv);

      const editNameButton = document.querySelector(
        `#hs-list-${listIndex}-edit-name-button`
      );
      editNameButton.title = localization.editNameButtonTitle;
      editNameButton.addEventListener("click", function (event) {
        sendIpcToMain("hs-on-edit-list-name-clicked", listIndex);
        event.stopPropagation();
      });
      editNameButton.setAttribute("data-nav-panel", 0);
      editNameButton.setAttribute("data-nav-row", navRow);
      editNameButton.setAttribute("data-nav-col", navColumn++);
      editNameButton.setAttribute("tabindex", "0");

      const removeButton = document.querySelector(
        `#hs-list-${listIndex}-remove-button`
      );
      removeButton.title = localization.removeListButtonTitle;
      removeButton.addEventListener("click", function (event) {
        sendIpcToMain("hs-on-remove-list-clicked", listIndex);
        event.stopPropagation();
      });
      removeButton.setAttribute("data-nav-panel", 0);
      removeButton.setAttribute("data-nav-row", navRow);
      removeButton.setAttribute("data-nav-col", navColumn++);
      removeButton.setAttribute("tabindex", "0");

      const addButton = document.querySelector(
        `#hs-list-${listIndex}-add-button`
      );
      addButton.title = localization.addButtonTitle;
      addButton.addEventListener("click", function (event) {
        sendIpcToMain(
          "hs-on-add-list-entry-clicked",
          listIndex,
          event == undefined || event.pointerType !== "mouse"
        );
        event.stopPropagation();
      });
      addButton.setAttribute("data-nav-panel", 0);
      addButton.setAttribute("data-nav-row", navRow);
      addButton.setAttribute("data-nav-col", navColumn++);
      addButton.setAttribute("tabindex", "0");

      const collapseButton = document.querySelector(
        `#hs-list-${listIndex}-collapse-button`
      );
      collapseButton.title = localization.collapseButtonTitle;
      collapseButton.addEventListener("click", function (event) {
        sendIpcToMain("hs-on-collapse-list-clicked", listIndex, true);
        event.stopPropagation();
      });
      const expandButton = document.querySelector(
        `#hs-list-${listIndex}-expand-button`
      );
      expandButton.title = localization.expandButtonTitle;
      expandButton.addEventListener("click", function (event) {
        sendIpcToMain("hs-on-collapse-list-clicked", listIndex, false);
        event.stopPropagation();
      });

      // cards
      let cardsDiv = document.createElement("div");
      cardsDiv.classList.add("hs-path-cards-list");
      contentDiv.appendChild(cardsDiv);

      let max = list.data.length;
      let showEllipsis = false;
      if (list.data.length <= g_collapsedNumRowsShown * 2) {
        collapseButton.classList.add("set-display-none");
        expandButton.classList.add("set-display-none");
      } else {
        if (isListCollapsed(listIndex)) {
          collapseButton.classList.add("set-display-none");
          expandButton.classList.remove("set-display-none");
          collapseButton.removeAttribute("data-nav-panel");
          collapseButton.removeAttribute("data-nav-row");
          collapseButton.removeAttribute("data-nav-col");
          expandButton.setAttribute("data-nav-panel", 0);
          expandButton.setAttribute("data-nav-row", navRow);
          expandButton.setAttribute("data-nav-col", navColumn++);
          expandButton.setAttribute("tabindex", "0");
          max = g_collapsedNumRowsShown * 2;
          if (list.data.length > max) showEllipsis = true;
        } else {
          collapseButton.classList.remove("set-display-none");
          expandButton.classList.add("set-display-none");
          collapseButton.setAttribute("data-nav-panel", 0);
          collapseButton.setAttribute("data-nav-row", navRow);
          collapseButton.setAttribute("data-nav-col", navColumn++);
          collapseButton.setAttribute("tabindex", "0");
          expandButton.removeAttribute("data-nav-panel");
          expandButton.removeAttribute("data-nav-row");
          expandButton.removeAttribute("data-nav-col");
        }
      }
      max = Math.max(2, 2 * Math.round(max / 2));

      ///////

      if (list.data.length > 0) {
        // if not, just empty cards
        navRow++;
        navColumn = 0;
      }

      for (let cardIndex = 0; cardIndex < max; cardIndex++) {
        if (g_languageDirection === "rtl") {
          if (cardIndex % 2 === 0) {
            if (cardIndex !== 0) navRow++;
            navColumn = 3;
            if (cardIndex === list.data.length - 1) navColumn = 1;
          } else {
            navColumn = 1;
          }
        } else {
          if (cardIndex % 2 === 0) {
            navColumn = 0;
            if (cardIndex !== 0) navRow++;
          } else {
            navColumn = 2;
          }
        }
        if (list.data && list.data.length > cardIndex) {
          const data = list.data[cardIndex];
          cardsDiv.appendChild(
            getNewCardDiv(CardType.USERLIST, data, navRow, navColumn, listIndex)
          );
        } else {
          cardsDiv.appendChild(
            getNewCardDiv(
              CardType.EMPTY,
              undefined,
              navRow,
              navColumn,
              listIndex
            )
          );
        }
      }
      if (showEllipsis) {
        const ellipsis = document.createElement("div");
        ellipsis.classList = "hs-section-ellipsis";
        ellipsis.innerHTML = `<i class="fa-solid fa-ellipsis"></i>`;
        contentDiv.appendChild(ellipsis);
      }
    }
  }

  // CREATE LIST button //////////
  navRow++;
  navColumn = 0;
  const createListButton = document.querySelector("#hs-addlist-add-button");
  createListButton.setAttribute("data-nav-panel", 0);
  createListButton.setAttribute("data-nav-row", navRow);
  createListButton.setAttribute("data-nav-col", navColumn++);
  createListButton.setAttribute("tabindex", "0");

  // NAVIGATION
  navigation.rebuild(g_navData, refocus ? 0 : undefined);
}

function getNewCardDiv(cardType, data, navRow, navColumn, listIndex) {
  const cardDiv = document.createElement("div");

  // let hasButton = cardType === CardType.LATEST ? false : true;
  let hasButton = true;

  const buttonHtml = `
  <div class="hs-path-card-button hs-path-interactive">
    <i class="fas fa-ellipsis-v"></i>
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

  function getPercentageBarHtml(percentage) {
    if (percentage !== undefined && percentage <= 100) {
      return `
  <div class="hs-path-card-percentageBar" style="width:${percentage}%">
  </div>`;
    } else return "";
  }

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
    ${
      cardType === CardType.FAVORITES ||
      cardType === CardType.LATEST ||
      cardType === CardType.USERLIST
        ? dragMiniIconHtml
        : ""
    }
    <div class="hs-path-card-image">
      ${getIconHtml()}     
      ${
        (cardType === CardType.LATEST && data.isInFavorites) ||
        (cardType === CardType.USERLIST && data.isInFavorites)
          ? favMiniIconHtml
          : ""
      } 
    </div>
    <div class="hs-path-card-content">
      <span>${data.name}</span
      >${data.path ? "<span>" + data.path + "</span>" : ""}
    </div>
     ${data.percentageRead ? getPercentageBarHtml(data.percentageRead) : ""}
  </div>
  ${hasButton ? buttonHtml : ""}`
    : "";
  const emptyHtml = `
  <div class="hs-path-card-main hs-path-empty">
  </div>`;
  // const addFavHtml = `
  // <div class="hs-add-card-image">
  //   <i class="fas fa-plus-circle fa-2x fa-fw"></i>
  // </div>`;

  switch (cardType) {
    case CardType.FAVORITES:
    case CardType.USERLIST:
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
            const fromListIndex = g_draggedCard.getAttribute("data-list-index");
            const toListIndex = event.target.getAttribute("data-list-index");
            const fromIndex = g_draggedCard.getAttribute(
              "data-list-card-index"
            );
            const toIndex = event.target.getAttribute("data-list-card-index");
            sendIpcToMain(
              "hs-on-list-card-dropped",
              parseInt(fromListIndex),
              parseInt(toListIndex),
              parseInt(fromIndex),
              parseInt(toIndex)
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
        mainCardDiv.setAttribute("data-list-card-index", data.index);
        mainCardDiv.setAttribute("data-list-index", listIndex);

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
            "hs-on-list-entry-options-clicked",
            listIndex,
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

        // data
        mainCardDiv.setAttribute("data-list-card-index", data.index);
        mainCardDiv.setAttribute("data-list-index", listIndex);

        /////////////

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
      const mainCardDiv = cardDiv.querySelector(".hs-path-card-main");
      // if (navRow !== undefined && navColumn !== undefined) {
      //   cardDiv.setAttribute("data-nav-panel", 0);
      //   cardDiv.setAttribute("data-nav-row", navRow);
      //   cardDiv.setAttribute("data-nav-col", navColumn);
      //   cardDiv.setAttribute("tabindex", "0");
      // }
      if (listIndex >= -1) {
        // don't do for latest
        // drop
        cardDiv.addEventListener("drop", (event) => {
          if (event.target.classList.contains("hs-path-card-main")) {
            mainCardDiv.classList.remove("hs-path-card-main-dragging-over");
            const fromListIndex = g_draggedCard.getAttribute("data-list-index");
            const toListIndex = listIndex;
            const fromIndex = g_draggedCard.getAttribute(
              "data-list-card-index"
            );
            const toIndex = -1;
            sendIpcToMain(
              "hs-on-list-card-dropped",
              parseInt(fromListIndex),
              parseInt(toListIndex),
              parseInt(fromIndex),
              parseInt(toIndex)
            );
            event.preventDefault();
          }
        });
        // receive
        cardDiv.addEventListener("dragover", function (event) {
          const draggingElement = document.querySelector(
            ".hs-path-card-main-dragging"
          );
          if (draggingElement) {
            event.preventDefault();
            mainCardDiv.classList.add("hs-path-card-main-dragging-over");
            event.stopPropagation();
          }
        });
        cardDiv.addEventListener("dragleave", function (event) {
          mainCardDiv.classList.remove("hs-path-card-main-dragging-over");
          event.stopPropagation();
        });
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

function showModalAddListEntry(
  title,
  textButtonBack,
  textButtonAddFile,
  textButtonAddFolder,
  listIndex,
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
      sendIpcToMain("hs-on-modal-add-list-file-clicked", listIndex);
    },
  });
  buttons.push({
    text: textButtonAddFolder.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("hs-on-modal-add-list-folder-clicked", listIndex);
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

function showModalEditListName(
  listIndex,
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
            "hs-on-modal-edit-list-name-ok-clicked",
            listIndex,
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

function showModalRemoveListWarning(
  listIndex,
  title,
  message,
  textButton1,
  textButton2
) {
  if (getOpenModal()) {
    return;
  }

  showModal({
    title: title,
    message: message,
    zIndexDelta: -450,
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
          sendIpcToMain("hs-on-remove-list-warning-ok-clicked", listIndex);
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

////////////////

function showModalListEntryOptions(
  listIndex,
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
  textButtonAddToFavorites,
  textButtonRemoveFromFavorites,
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
      sendIpcToMain(
        "hs-on-modal-list-entry-options-remove-clicked",
        listIndex,
        index,
        path
      );
    },
  });
  buttons.push({
    text: textButtonEditName.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain(
        "hs-on-modal-list-entry-options-edit-name-clicked",
        listIndex,
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
          "hs-on-modal-list-entry-options-edit-path-clicked",
          listIndex,
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
            "hs-on-modal-list-entry-options-openfolder-clicked",
            listIndex,
            index,
            path
          );
        },
      });

    if (textButtonAddToFavorites)
      buttons.push({
        text: textButtonAddToFavorites.toUpperCase(),
        fullWidth: true,
        callback: () => {
          modalClosed();
          sendIpcToMain(
            "hs-on-modal-list-entry-options-addtofavorites-clicked",
            listIndex,
            index,
            path
          );
        },
      });

    if (textButtonRemoveFromFavorites)
      buttons.push({
        text: textButtonRemoveFromFavorites.toUpperCase(),
        fullWidth: true,
        callback: () => {
          modalClosed();
          sendIpcToMain(
            "hs-on-modal-list-entry-options-removefavorites-clicked",
            listIndex,
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
            "hs-on-modal-list-entry-options-addfoldertofavorites-clicked",
            listIndex,
            index,
            path
          );
        },
      });
  }
  if (showFocus) {
    buttons.push({
      text: textButtonMoveBackward.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain(
          "hs-on-modal-list-entry-options-move-clicked",
          listIndex,
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
          "hs-on-modal-list-entry-options-move-clicked",
          listIndex,
          index,
          path,
          1
        );
      },
    });
  }
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

function showModalListEntryEditName(
  listIndex,
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
            "hs-on-modal-list-entry-options-edit-name-ok-clicked",
            listIndex,
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

function showModalListEntryEditPath(
  listIndex,
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
            "hs-on-modal-list-entry-options-edit-path-ok-clicked",
            listIndex,
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

function showModalCreateList(
  defaultName,
  title,
  textButton1,
  textButton2,
  showFocus
) {
  if (getOpenModal()) {
    return;
  }

  showModal({
    showFocus: showFocus,
    title: title,
    zIndexDelta: -450,
    input: { type: "text", default: defaultName },
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
          sendIpcToMain("hs-on-modal-create-list-ok-clicked", value);
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

function showModalDropCardOptions(
  fromListIndex,
  toListIndex,
  fromEntryIndex,
  toEntryIndex,
  title,
  message,
  textButtonBack,
  textButtonMove,
  textButtonCopy,
  showFocus
) {
  if (getOpenModal()) {
    return;
  }
  let buttons = [];
  if (textButtonMove)
    buttons.push({
      text: textButtonMove.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain(
          "hs-on-modal-drop-card-options-move-clicked",
          fromListIndex,
          toListIndex,
          fromEntryIndex,
          toEntryIndex
        );
      },
    });
  if (textButtonCopy)
    buttons.push({
      text: textButtonCopy.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain(
          "hs-on-modal-drop-card-options-copy-clicked",
          fromListIndex,
          toListIndex,
          fromEntryIndex,
          toEntryIndex
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
    message: message,
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
  collapseTitle,
  expandTitle,
  favoritesSectionTitle,
  latestSectionTitle,
  createListTitle
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
  document.querySelector("#hs-logo-preferences-button").title =
    preferencesTitle;
  // history
  document.querySelector("#hs-logo-history-button").title = historyTitle;
  // files tools
  document.querySelector("#hs-logo-files-tools-button").title = filesToolsTitle;
  // art tools
  document.querySelector("#hs-logo-art-tools-button").title = artToolsTitle;
  // rss reader
  document.querySelector("#hs-logo-rss-reader-button").title = rssReaderTitle;
  // radio
  document.querySelector("#hs-logo-radio-button").title = radioTitle;
  // quit
  document.querySelector("#hs-logo-quit-button").title = quitTitle;
  // add favorite
  document.querySelector("#hs-favorites-add-button").title = addFavoriteTitle;
  // collapse favorites
  document.querySelector("#hs-favorites-collapse-button").title = collapseTitle;
  // expand favorites
  document.querySelector("#hs-favorites-expand-button").title = expandTitle;
  // favorites title
  document.querySelector(
    "#hs-favorites-title"
  ).innerHTML = `<i class="fa-solid fa-heart hs-section-title-icon"></i><span>${favoritesSectionTitle}</span>`;
  // latest title
  document.querySelector(
    "#hs-latest-title"
  ).innerHTML = `<i class="fas fa-history hs-section-title-icon"></i><span>${latestSectionTitle}</span>`;
  // collapse latests
  document.querySelector("#hs-latest-collapse-button").title = collapseTitle;
  // expand latests
  document.querySelector("#hs-latest-expand-button").title = expandTitle;
  // create list
  document.querySelector("#hs-addlist-add-button").title = createListTitle;
}
