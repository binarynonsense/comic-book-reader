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
let g_currentFeedContentPage = 0;

let g_searchInput;
let g_searchButton;
let g_lastSearchResults;
let g_lastSearchType = "podcasts";

export function needsScrollToTopButtonUpdate() {
  return true;
}

async function init(section, favorites) {
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
  for (let index = 0; index < 3; index++) {
    document
      .getElementById(`tool-rss-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }

  ////////////////////////////////////////

  document
    .getElementById("tool-rss-reset-favorites-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("on-reset-favorites-clicked");
    });

  document
    .getElementById("tool-rss-clear-favorites-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("on-clear-favorites-clicked");
    });

  ////////////////////////////////////////

  g_favorites = favorites;
  buildFavorites();

  ////////////////////////////////////////
  // search
  g_searchButton = document.getElementById("tool-rss-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-rss-search-input");
  g_searchInput.placeholder = g_extraLocalization.searchPlaceholderType1;
  g_searchInput.addEventListener("input", function (event) {
    if (g_searchInput.value !== "") {
      g_searchButton.classList.remove("tools-disabled");
    } else {
      g_searchButton.classList.add("tools-disabled");
    }
  });
  g_searchInput.addEventListener("keypress", function (event) {
    if (
      event.key === "Enter" &&
      !document
        .getElementById("tool-rss-search-input-div")
        .classList.contains("set-display-none")
    ) {
      event.preventDefault();
      if (g_searchInput.value) {
        onSearch();
      }
    }
  });

  document.getElementById("tool-rss-search-type-select-id-1").innerText =
    g_extraLocalization.searchType1;
  document.getElementById("tool-rss-search-type-select-id-2").innerText =
    g_extraLocalization.searchType2;

  document
    .getElementById("tool-rss-search-type-select")
    .addEventListener("change", (event) => {
      g_searchInput.value = "";
      g_searchButton.classList.add("tools-disabled");
      if (
        document.getElementById("tool-rss-search-type-select").value ===
        "podcasts"
      ) {
        g_searchInput.placeholder = g_extraLocalization.searchPlaceholderType1;
      } else {
        g_searchInput.placeholder = g_extraLocalization.searchPlaceholderType2;
      }
    });

  ////////////////////////////////////////

  if (g_lastSearchResults) {
    updateSearchResults(g_lastSearchType, g_lastSearchResults);
  }

  // old way, was passing a url from separated podcast tool
  // TODO: delete when I'm sure I won't need the reference
  // if (url) {
  //   sendIpcToMain("get-feed-content", url, -1);
  //   showLoadingModal();
  // } else if (g_currentFeedData) {
  //   showFeedContent(g_currentFeedData, g_currentFeedFavoriteIndex, 0);
  //   switchSection(2);
  // } else {
  //   removeCurrentFeedContent();
  //   switchSection(0);
  // }

  if (g_currentFeedData) {
    showFeedContent(
      g_currentFeedData,
      g_currentFeedFavoriteIndex,
      g_currentFeedContentPage
    );
  } else {
    removeCurrentFeedContent();
  }

  if (g_currentFeedData && section != 1) {
    switchSection(2);
  } else {
    switchSection(section);
  }

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
  for (let index = 0; index < 3; index++) {
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
  if (id === 1) {
    g_searchInput.focus();
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

  ///////////////

  on("load-feed-content", (data, index, switchToContent) => {
    showFeedContent(data, index, 0);
    if (switchToContent) switchSection(2);
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
      g_currentFeedFavoriteIndex = -1;
      // check if it's in the new list
      for (let i = 0; i < g_favorites.length; i++) {
        const fav = g_favorites[i];
        if (
          fav.name === g_currentFeedData.name &&
          fav.url === g_currentFeedData.url
        ) {
          g_currentFeedFavoriteIndex = i;
          break;
        }
      }
      showFeedContent(
        g_currentFeedData,
        g_currentFeedFavoriteIndex,
        g_currentFeedContentPage
      );
    } else {
      // just in case
      removeCurrentFeedContent();
    }
  });

  on("on-favorites-clear", (favorites) => {
    g_favorites = favorites;
    buildFavorites();
    closeModal();
    if (g_currentFeedData) {
      showFeedContent(g_currentFeedData, -1, g_currentFeedContentPage);
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

  ///////////////////////////////////////////////////////////////

  on("update-results", (...args) => {
    updateSearchResults(...args);
    closeModal();
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

  on("show-modal-clear-favorites", (...args) => {
    showModalClearFavorites(...args);
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
  if (g_favorites && g_favorites.length > 0) {
    favoritesDiv.style = "padding-top: 20px";
    // list
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    for (let index = 0; index < g_favorites.length; index++) {
      ////////////////
      const data = g_favorites[index];
      // create html
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      let buttonSpan = document.createElement("span");
      buttonSpan.className = "tools-buttons-list-button";
      buttonSpan.innerHTML = `<i class="fas fa-rss-square fa-2x"></i>`; //fas fa-file-audio
      buttonSpan.title = g_extraLocalization.open;
      let multilineText = document.createElement("span");
      multilineText.className = "tools-buttons-list-li-multiline-text";
      {
        let text = document.createElement("span");
        text.innerText = `${data.name}`;
        multilineText.appendChild(text);

        text = document.createElement("span");
        text.innerText = `${data.url}`;
        multilineText.appendChild(text);
      }
      buttonSpan.appendChild(multilineText);
      buttonSpan.addEventListener("click", (event) => {
        sendIpcToMain("get-feed-content", data.url, index);
        showLoadingModal();
      });
      li.appendChild(buttonSpan);
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.innerHTML = `<i class="fa-solid fa-arrow-up"></i>`;
        buttonSpan.title = g_extraLocalization.moveUpInList;
        if (index > 0) {
          buttonSpan.className = "tools-buttons-list-button";
          buttonSpan.addEventListener("click", (event) => {
            sendIpcToMain(
              "on-modal-feed-options-move-clicked",
              index,
              g_favorites[index].url,
              0
            );
          });
        } else {
          buttonSpan.className =
            "tools-buttons-list-button tools-buttons-list-button-disabled";
        }
        li.appendChild(buttonSpan);
      }
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.innerHTML = `<i class="fa-solid fa-arrow-down"></i>`;
        buttonSpan.title = g_extraLocalization.moveDownInList;
        if (index < g_favorites.length - 1) {
          buttonSpan.className = "tools-buttons-list-button";
          buttonSpan.addEventListener("click", (event) => {
            sendIpcToMain(
              "on-modal-feed-options-move-clicked",
              index,
              g_favorites[index].url,
              1
            );
          });
        } else {
          buttonSpan.className =
            "tools-buttons-list-button tools-buttons-list-button-disabled";
        }
        li.appendChild(buttonSpan);
      }
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
        buttonSpan.title = g_extraLocalization.removeFromList;
        buttonSpan.addEventListener("click", (event) => {
          sendIpcToMain(
            "on-modal-feed-options-remove-clicked",
            index,
            g_favorites[index].url
          );
        });
        li.appendChild(buttonSpan);
      }
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fas fa-ellipsis-h"></i>`;
        buttonSpan.title = g_extraLocalization.options;
        buttonSpan.addEventListener("click", (event) => {
          event.stopPropagation();
          sendIpcToMain("on-feed-options-clicked", index);
        });
        li.appendChild(buttonSpan);
      }
      ul.appendChild(li);
      ////////////////
    }
    favoritesDiv.appendChild(ul);
  } else {
    favoritesDiv.style = "padding-top: 5px";
  }
}

////////////////////////////

function removeCurrentFeedContent() {
  const contentDiv = document.getElementById("tool-rss-items-div");
  contentDiv.innerHTML = `<span> ${g_extraLocalization.noContent} </span>`;
  g_currentFeedData = undefined;
  g_currentFeedFavoriteIndex = -1;
  g_currentFeedContentPage = 0;
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

function showFeedContent(data, index, pageNum, scrollToTop = false) {
  g_currentFeedFavoriteIndex = index;
  g_currentFeedData = data;
  g_currentFeedContentPage = pageNum;

  const root = document.getElementById("tool-rss-items-div");
  root.innerHTML = "";

  try {
    const totalResultsNum = data.items.length;
    const itemsPerPage = 10;
    const totalPagesNum = Math.ceil(totalResultsNum / itemsPerPage);

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

    //

    const descPrelineClass = `${
      utils.isStringHTML(data.description)
        ? ""
        : " class='tool-rss-desc-prelined'"
    }`;

    root.innerHTML += `
    <div id='tool-rss-channel-info'>
      ${titleText}
      <div id='tool-rss-channel-info-desc'>${
        data.name &&
        (g_currentFeedFavoriteIndex < 0 ||
          data.name !== g_favorites[g_currentFeedFavoriteIndex].name)
          ? "<span>" + data.name + "</span>"
          : ""
      }${
      data.description
        ? `<span${descPrelineClass}>` + data.description + "</span$>"
        : ""
    }
      </div>
    </div>`;

    itemsToHtml(root, data.items, pageNum, itemsPerPage, totalPagesNum);

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

    if (totalPagesNum > 1) {
      document
        .getElementById("tool-rss-items-top-pagination")
        .appendChild(getFeedContentPaginationHtml(pageNum, totalPagesNum));
      document
        .getElementById("tool-rss-items-bottom-pagination")
        .appendChild(getFeedContentPaginationHtml(pageNum, totalPagesNum));
    }
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

  updateColumnsHeight(scrollToTop);
}

function getFeedContentPaginationHtml(pageNum, totalPagesNum) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    if (pageNum > 0) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        showFeedContent(g_currentFeedData, g_currentFeedFavoriteIndex, 0, true);
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    if (pageNum > 0) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        showFeedContent(
          g_currentFeedData,
          g_currentFeedFavoriteIndex,
          pageNum - 1,
          true
        );
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` ${pageNum + 1} / ${totalPagesNum} `;
  paginationDiv.appendChild(span);
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    if (pageNum < totalPagesNum - 1) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        showFeedContent(
          g_currentFeedData,
          g_currentFeedFavoriteIndex,
          pageNum + 1,
          true
        );
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-double-right"></i>';
    if (pageNum < totalPagesNum - 1) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        showFeedContent(
          g_currentFeedData,
          g_currentFeedFavoriteIndex,
          totalPagesNum - 1,
          true
        );
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  return paginationDiv;
}

function itemsToHtml(root, items, pageNum, itemsPerPage, totalPagesNum) {
  try {
    root.innerHTML += `<div id='tool-rss-items-top-pagination'></div>`;
    const startIndex = pageNum * itemsPerPage;
    let endIndex = startIndex + itemsPerPage - 1;
    if (endIndex > items.length - 1) endIndex = items.length - 1;

    for (let index = startIndex; index <= endIndex; index++) {
      const item = items[index];
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

        html += `<div class="tool-rss-item-desc${
          utils.isStringHTML(item.description) ? "" : " tool-rss-desc-prelined"
        }">${item.description}</div>
        </div>`;
      } catch (error) {
        html = "";
      }
      root.innerHTML += html;
    }
    root.innerHTML += `<div id='tool-rss-items-bottom-pagination'></div>`;
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
      //console.log(`"tool-rss-item-title-${index}-button" not found`);
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

function updateSearchResults(type, searchResults) {
  // console.log(searchResults);
  g_lastSearchResults = searchResults;
  g_lastSearchType = type;
  ///////////////////////////////////////////
  document
    .querySelector("#tool-rss-search-results-h3")
    .classList.remove("set-display-none");
  const searchResultsDiv = document.querySelector(
    "#tool-rss-search-results-div"
  );
  searchResultsDiv.innerHTML = "";
  if (searchResults && searchResults.length > 0) {
    // console.log(searchResults);
    // list
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    for (let index = 0; index < searchResults.length; index++) {
      const resultData = searchResults[index];
      const resultUrl =
        type === "podcasts" ? resultData.feedUrl : resultData.url;
      if (!resultUrl) break;
      // create html
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      let buttonSpan = document.createElement("span");
      buttonSpan.className = "tools-buttons-list-button";
      buttonSpan.innerHTML = `<i class="fas fa-rss-square fa-2x"></i>`;
      buttonSpan.title = g_extraLocalization.open;
      let multilineText = document.createElement("span");
      multilineText.className = "tools-buttons-list-li-multiline-text";
      if (type === "podcasts") {
        let text = document.createElement("span");
        text.innerText = `${resultData.trackName}`;
        multilineText.appendChild(text);

        text = document.createElement("span");
        text.innerHTML = `${resultData.artistName}`;
        multilineText.appendChild(text);

        // unused: artworkUrl60 artworkUrl30 artworkUrl100

        if (resultData.genres && resultData.genres.length > 0) {
          text = document.createElement("span");
          text.innerHTML = `${resultData.genres[0]}`;
          for (let index = 1; index < resultData.genres.length; index++) {
            text.innerHTML += ` | ${resultData.genres[index]}`;
          }
          multilineText.appendChild(text);
        }

        text = document.createElement("span");
        text.innerHTML = `${resultData.trackCount}`;
        multilineText.appendChild(text);

        if (resultData.releaseDate) {
          text = document.createElement("span");
          text.innerHTML = new Date(
            resultData.releaseDate
          ).toLocaleDateString();
          multilineText.appendChild(text);
        }

        text = document.createElement("span");
        text.innerHTML = `${resultUrl}`;
        multilineText.appendChild(text);
      } else {
        // websites
        let text = document.createElement("span");
        text.innerText = `${resultData.title}`;
        multilineText.appendChild(text);

        text = document.createElement("span");
        text.innerHTML = `${resultUrl}`;
        multilineText.appendChild(text);
      }
      buttonSpan.appendChild(multilineText);

      buttonSpan.addEventListener("click", (event) => {
        onSearchResultClicked(resultUrl, 0);
      });
      li.appendChild(buttonSpan);
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fas fa-external-link-alt"></i>`;
        buttonSpan.title = g_extraLocalization.openInBrowser;
        buttonSpan.addEventListener("click", (event) => {
          onSearchResultClicked(resultUrl, 1);
        });
        li.appendChild(buttonSpan);
      }
      ul.appendChild(li);
    }
    searchResultsDiv.appendChild(ul);
  } else {
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    let li = document.createElement("li");
    li.className = "tools-collection-li";
    let text = document.createElement("span");
    text.innerText = g_extraLocalization.searchNoResults;
    li.appendChild(text);
    ul.appendChild(li);
    searchResultsDiv.appendChild(ul);
  }
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
}

//////////////////////////////////////

async function onSearch() {
  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_extraLocalization.searching);
  sendIpcToMain(
    "search",
    g_searchInput.value,
    document.getElementById("tool-rss-search-type-select").value
  );
}

async function onSearchResultClicked(url, mode) {
  if (mode === 0) {
    sendIpcToMain("get-feed-content", url, -1);
    showLoadingModal();
  } else {
    sendIpcToMain("open-url-in-browser", url);
  }
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

function showModalClearFavorites(title, message, textButton1, textButton2) {
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
          sendIpcToMain("on-modal-clear-favorites-ok-clicked");
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

///////////

function showSearchModal() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: " ",
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
