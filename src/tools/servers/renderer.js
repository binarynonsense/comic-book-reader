/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals/modals.js";

import { Section } from "./constants.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_extraLocalization = {};

let g_servers;

export function needsScrollToTopButtonUpdate() {
  return true;
}

async function init(section, servers) {
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
    .getElementById("tool-servers-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-servers-add-button")
    .addEventListener("click", (event) => {
      // modals.showKomgaLogin();
      sendIpcToMain("on-connect-button-clicked");
    });
  // sections menu
  for (
    let index = 0;
    index < document.querySelectorAll(".tools-menu-button").length;
    index++
  ) {
    document
      .getElementById(`tool-servers-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }

  ////////////////////////////////////////

  buildServers(servers);
  buildContentNavbar();
  buildContentEmpty();

  switchSection(servers.length > 0 ? 0 : 1);

  ////////////////////////////////////////

  updateColumnsHeight();
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
  for (
    let index = 0;
    index < document.querySelectorAll(".tools-menu-button").length;
    index++
  ) {
    if (id === index) {
      document
        .getElementById(`tool-servers-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-servers-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-servers-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-servers-section-${index}-content-div`)
        .classList.add("set-display-none");
    }
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-servers", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-servers", ...args);
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

  /////////////////////////////////////////////////////////////////////////////

  on("build-servers", (...args) => {
    buildServers(...args);
  });

  on("show-modal-remove-server-from-list-warning", (...args) => {
    showModalRemoveServerFromList(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("build-content-navbar", (...args) => {
    buildContentNavbar(...args);
  });

  on("show-modal-search", (...args) => {
    showModalSearch(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("build-content-activity", (...args) => {
    switchSection(1);
    buildContentActivity(...args);
  });

  on("build-content-libraries", (...args) => {
    switchSection(1);
    buildContentLibraries(...args);
  });

  on("build-content-series-in-library", (...args) => {
    switchSection(1);
    buildContentSeriesInLibrary(...args);
  });

  on("build-content-books-in-series", (...args) => {
    switchSection(1);
    buildContentBooksInSeries(...args);
  });

  on("build-content-volumes-in-series", (...args) => {
    switchSection(1);
    buildContentVolumesInSeries(...args);
  });

  on("build-content-books-in-volume", (...args) => {
    switchSection(1);
    buildContentBooksInVolume(...args);
  });

  on("build-content-book", (...args) => {
    switchSection(1);
    buildContentBook(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("build-content-search-books", (...args) => {
    switchSection(1);
    buildContentBooksInSearch(...args);
  });

  on("build-content-search-series", (...args) => {
    switchSection(1);
    buildContentSeriesInSearch(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("build-content-books-in-keepreading", (...args) => {
    switchSection(1);
    buildContentBooksInKeepReading(...args);
  });

  on("build-content-books-in-recentbooks", (...args) => {
    switchSection(1);
    buildContentBooksInRecentBooks(...args);
  });

  on("build-content-series-in-recentseries", (...args) => {
    switchSection(1);
    buildContentSeriesInRecentSeries(...args);
  });

  on("build-content-series-in-updatedseries", (...args) => {
    switchSection(1);
    buildContentSeriesInUpdatedSeries(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("render-thumb", (id, buffer, mime) => {
    if (buffer) {
      const img = document.querySelector(`#tool-servers-thumb-${id}`);
      if (img) {
        const blob = new Blob([buffer], { type: mime });
        const url = URL.createObjectURL(blob);
        img.src = url;
      }
    }
  });

  /////////////////////////////////////////////////////////////////////////////

  on("close-active-modal", () => {
    modals.closeActiveModal(modals.Level.TOOLS);
  });

  on("show-modal-login", (...args) => {
    showLoginModal(...args);
  });

  on("show-modal-loading", () => {
    showLoadingModal();
  });

  on("hide-modal-loading", () => {
    modals.closeActiveModal(modals.Level.TOOLS);
  });

  on("show-modal-info", (...args) => {
    modals.showInfoModal(modals.Level.TOOLS, ...args);
  });

  on("show-modal-downloading", (...args) => {
    showDownloadingModal(...args);
  });

  on("show-modal-download-error", (...args) => {
    showDownloadErrorModal(...args);
  });

  on("update-modal-downloading.percentage", (...args) => {
    updateDownloadingModalPercentage(...args);
  });

  /////////////////////////////////////////////////////////////////////////////
}

///////////////////////////////////////////////////////////////////////////////
// SERVERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function buildServers(servers) {
  g_servers = servers;

  const container = document.querySelector("#tool-servers-servers-div");
  container.innerHTML = "";
  if (g_servers && g_servers.length > 0) {
    container.style = "padding-top: 10px";
    // list
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    for (let index = 0; index < g_servers.length; index++) {
      ////////////////
      const data = g_servers[index];
      // create html
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      const buttonSpan = document.createElement("span");
      buttonSpan.className = "tools-buttons-list-button";
      buttonSpan.innerHTML = `<i class="fas fa-server fa-2x"></i>`;
      buttonSpan.title = g_extraLocalization.connect;
      const multilineText = document.createElement("span");
      multilineText.className = "tools-buttons-list-li-multiline-text";
      {
        let text = document.createElement("span");
        text.innerText = `${data.url}`;
        multilineText.appendChild(text);

        text = document.createElement("span");
        text.innerText = data.maskedApiKey
          ? "API Key"
          : g_extraLocalization.passwordType;
        multilineText.appendChild(text);

        text = document.createElement("span");
        text.innerText = data.maskedApiKey
          ? data.maskedApiKey
          : data.maskedEmail;
        multilineText.appendChild(text);
      }
      buttonSpan.appendChild(multilineText);
      buttonSpan.addEventListener("click", (event) => {
        sendIpcToMain("connect-to-server-in-list", index, data);
        showLoadingModal();
      });
      li.appendChild(buttonSpan);
      // {
      //   let buttonSpan = document.createElement("span");
      //   buttonSpan.innerHTML = `<i class="fa-solid fa-arrow-up"></i>`;
      //   buttonSpan.title = g_extraLocalization.moveUpInList;
      //   if (index > 0) {
      //     buttonSpan.className = "tools-buttons-list-button";
      //     buttonSpan.addEventListener("click", (event) => {
      //       sendIpcToMain(
      //         "on-modal-feed-options-move-clicked",
      //         index,
      //         g_servers[index].url,
      //         0,
      //       );
      //     });
      //   } else {
      //     buttonSpan.className =
      //       "tools-buttons-list-button tools-buttons-list-button-disabled";
      //   }
      //   li.appendChild(buttonSpan);
      // }
      // {
      //   let buttonSpan = document.createElement("span");
      //   buttonSpan.innerHTML = `<i class="fa-solid fa-arrow-down"></i>`;
      //   buttonSpan.title = g_extraLocalization.moveDownInList;
      //   if (index < g_servers.length - 1) {
      //     buttonSpan.className = "tools-buttons-list-button";
      //     buttonSpan.addEventListener("click", (event) => {
      //       sendIpcToMain(
      //         "on-modal-feed-options-move-clicked",
      //         index,
      //         g_servers[index].url,
      //         1,
      //       );
      //     });
      //   } else {
      //     buttonSpan.className =
      //       "tools-buttons-list-button tools-buttons-list-button-disabled";
      //   }
      //   li.appendChild(buttonSpan);
      // }
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
        buttonSpan.title = g_extraLocalization.removeFromList;
        buttonSpan.addEventListener("click", (event) => {
          sendIpcToMain(
            "remove-server-from-list-request",
            index,
            g_servers[index],
          );
        });
        li.appendChild(buttonSpan);
      }
      // {
      //   let buttonSpan = document.createElement("span");
      //   buttonSpan.className = "tools-buttons-list-button";
      //   buttonSpan.innerHTML = `<i class="fas fa-ellipsis-v"></i>`;
      //   buttonSpan.title = g_extraLocalization.options;
      //   buttonSpan.addEventListener("click", (event) => {
      //     event.stopPropagation();
      //     sendIpcToMain("on-server-options-clicked", index);
      //   });
      //   li.appendChild(buttonSpan);
      // }
      ul.appendChild(li);
      ////////////////
    }
    container.appendChild(ul);
  } else {
    container.style = "padding-top: 5px";
    container.innerHTML = `<span> ${g_extraLocalization.noServers} </span>`;
  }
}

///////////////////////////////////////////////////////////////////////////////
// CONTENT ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getAlphabetFilterDiv(groupData, activeGroup, onGroupClick) {
  let containerDiv = document.createElement("div");
  containerDiv.className = "tools-collection-alphabet-filter";

  function addButton(label, isActive, isEnabled, onClickValue) {
    if (isActive) {
      let textSpan = document.createElement("span");
      textSpan.innerText = ` ${label} `;
      containerDiv.appendChild(textSpan);
    } else {
      let span = document.createElement("span");
      span.innerText = label;
      if (isEnabled) {
        span.className = "tools-collection-pagination-button";
        span.addEventListener("click", () => onGroupClick(onClickValue));
      } else {
        span.className = "tools-collection-pagination-button-disabled";
      }
      containerDiv.appendChild(span);
    }
  }

  /////

  let hashCount = 0;
  let letterCounts = {};

  groupData.forEach((item) => {
    let grp = item.group.toLowerCase();
    if (grp >= "a" && grp <= "z") {
      letterCounts[grp] = (letterCounts[grp] || 0) + item.count;
    } else {
      hashCount += item.count;
    }
  });

  let totalCount = groupData.reduce((acc, item) => acc + item.count, 0);
  addButton("ALL", activeGroup === "ALL", totalCount > 0, "ALL");

  addButton("#", activeGroup === "#", hashCount > 0, "#");

  for (let i = 0; i < 26; i++) {
    let letter = String.fromCharCode(97 + i); // 'a' to 'z'
    let upperLetter = letter.toUpperCase();
    let count = letterCounts[letter] || 0;

    addButton(upperLetter, activeGroup === letter, count > 0, letter);
  }

  return containerDiv;
}

// not used
function getSimplePaginationDiv(pageIndex, totalPagesNum, goToPage) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    if (pageIndex > 0) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        goToPage(0);
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    if (pageIndex > 0) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        goToPage(pageIndex - 1);
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` ${pageIndex + 1} / ${totalPagesNum} `;
  paginationDiv.appendChild(span);
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    if (pageIndex < totalPagesNum - 1) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        goToPage(pageIndex + 1);
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  {
    let span = document.createElement("span");
    span.innerHTML = '<i class="fas fa-angle-double-right"></i>';
    if (pageIndex < totalPagesNum - 1) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", (event) => {
        goToPage(totalPagesNum - 1);
      });
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }
  return paginationDiv;
}

function getPaginationDiv(
  pageIndex,
  totalPagesNum,
  goToPage,
  maxVisibleButtons = 11,
) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";

  function addArrowButton(innerHTML, isEnabled, targetPage, titleText) {
    let span = document.createElement("span");
    span.innerHTML = innerHTML;
    if (titleText) {
      span.title = titleText;
    }
    if (isEnabled) {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", () => goToPage(targetPage));
    } else {
      span.className = "tools-collection-pagination-button-disabled";
    }
    paginationDiv.appendChild(span);
  }

  function addPageNumberButton(idx) {
    let span = document.createElement("span");
    span.innerText = idx + 1;
    if (idx === pageIndex) {
      let textSpan = document.createElement("span");
      textSpan.innerText = ` ${idx + 1} `;
      paginationDiv.appendChild(textSpan);
    } else {
      span.className = "tools-collection-pagination-button";
      span.addEventListener("click", () => goToPage(idx));
      paginationDiv.appendChild(span);
    }
  }

  function addEllipsis() {
    let span = document.createElement("span");
    span.innerText = " ... ";
    paginationDiv.appendChild(span);
  }

  /////////

  addArrowButton(
    '<i class="fas fa-angle-double-left"></i>',
    pageIndex > 0,
    Math.max(0, pageIndex - 10),
    "-10",
  );
  addArrowButton(
    '<i class="fas fa-angle-left"></i>',
    pageIndex > 0,
    pageIndex - 1,
    "-1",
  );

  let targetSlots = maxVisibleButtons;
  let hasLeftEdge = false;
  let hasRightEdge = false;

  if (totalPagesNum > targetSlots) {
    let checkStart = pageIndex - Math.floor(targetSlots / 2);
    let checkEnd = checkStart + targetSlots - 1;

    if (checkStart > 0) {
      targetSlots -= 2;
      hasLeftEdge = true;
    }
    if (checkEnd < totalPagesNum - 1) {
      targetSlots -= 2;
      hasRightEdge = true;
    }
  }

  let startPage = Math.max(0, pageIndex - Math.floor(targetSlots / 2));
  let endPage = Math.min(totalPagesNum - 1, startPage + targetSlots - 1);

  if (endPage - startPage + 1 < targetSlots) {
    startPage = Math.max(0, endPage - targetSlots + 1);
  }

  if (hasLeftEdge) {
    addPageNumberButton(0);
    addEllipsis();
  }

  for (let i = startPage; i <= endPage; i++) {
    addPageNumberButton(i);
  }

  if (hasRightEdge) {
    addEllipsis();
    addPageNumberButton(totalPagesNum - 1);
  }

  addArrowButton(
    '<i class="fas fa-angle-right"></i>',
    pageIndex < totalPagesNum - 1,
    pageIndex + 1,
    "+1",
  );
  addArrowButton(
    '<i class="fas fa-angle-double-right"></i>',
    pageIndex < totalPagesNum - 1,
    Math.min(totalPagesNum - 1, pageIndex + 10),
    "+10",
  );

  return paginationDiv;
}

function buildContentEmpty() {
  const root = document.querySelector("#tool-servers-content");
  root.style = "padding-top: 10px";
  root.innerHTML = `<span> ${g_extraLocalization.noContent} </span>`;
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  modals.closeActiveModal(modals.Level.TOOLS);
}

function buildContentActivity(inputData) {
  console.log(inputData);
  const root = document.querySelector("#tool-servers-content");
  root.style = "padding-top: 10px";
  root.innerHTML = `
  <div class="tool-servers-activity-section">  
    <div class="tool-servers-activity-title">
      <span>${g_extraLocalization.keepReading}</span>
      ${
        inputData.inProgress.totalElements > 5
          ? `
      <i class="fa-solid fa-circle-plus" id="tool-servers-activity-inprogress-button" title="${g_extraLocalization.btnSeeAllBooks}"></i>`
          : ""
      }
    </div>
    <div class="tool-servers-activity-div" id="tool-servers-activity-inprogress-div"></div>    
  </div>
  <div class="tool-servers-activity-section">  
    <div class="tool-servers-activity-title">
      <span>${g_extraLocalization.recentlyAddedBooks}</span>
      ${
        inputData.recentlyAddedBooks.totalElements > 5
          ? `
      <i class="fa-solid fa-circle-plus" id="tool-servers-activity-recentbooks-button" title="${g_extraLocalization.btnSeeAllBooks}"></i>`
          : ""
      }
    </div>
    <div class="tool-servers-activity-div" id="tool-servers-activity-recentbooks-div"></div>
       
  </div>
  <div class="tool-servers-activity-section">  
    <div class="tool-servers-activity-title">
      <span>${g_extraLocalization.recentlyAddedSeries}</span>
      ${
        inputData.recentlyAddedSeries.totalElements > 5
          ? `
      <i class="fa-solid fa-circle-plus" id="tool-servers-activity-recentseries-button" title="${g_extraLocalization.btnSeeAllSeries}"></i>`
          : ""
      }
    </div>
    <div class="tool-servers-activity-div" id="tool-servers-activity-recentseries-div"></div>    
  </div>
  <div class="tool-servers-activity-section">  
    <div class="tool-servers-activity-title">
      <span>${g_extraLocalization.recentlyUpdatedSeries}</span>
      ${
        inputData.recentlyUpdatedSeries.totalElements > 5
          ? `
      <i class="fa-solid fa-circle-plus" id="tool-servers-activity-updatedseries-button" title="${g_extraLocalization.btnSeeAllSeries}"></i>`
          : ""
      } 
    </div>
    <div class="tool-servers-activity-div" id="tool-servers-activity-updatedseries-div"></div>       
  </div>
  `;
  let bookIds = [];
  let seriesIds = [];
  {
    const div = document.querySelector("#tool-servers-activity-inprogress-div");
    const grid = helperBooksGrid(
      inputData.inProgress,
      g_extraLocalization.keepReading,
    );
    div.appendChild(grid);
    bookIds.push(...inputData.inProgress.content.map((data) => data.id));
    const button = document.querySelector(
      "#tool-servers-activity-inprogress-button",
    );
    if (button)
      button.addEventListener("click", () => {
        showLoadingModal();
        sendIpcToMain("show-books-in-keepreading", 0);
      });
  }
  {
    const div = document.querySelector(
      "#tool-servers-activity-recentbooks-div",
    );
    const grid = helperBooksGrid(
      inputData.recentlyAddedBooks,
      g_extraLocalization.recentlyAddedBooks,
    );
    div.appendChild(grid);
    bookIds.push(
      ...inputData.recentlyAddedBooks.content.map((data) => data.id),
    );
    const button = document.querySelector(
      "#tool-servers-activity-recentbooks-button",
    );
    if (button)
      button.addEventListener("click", () => {
        showLoadingModal();
        sendIpcToMain("show-books-in-recentbooks", 0);
      });
  }
  {
    const div = document.querySelector(
      "#tool-servers-activity-recentseries-div",
    );
    const grid = helperSeriesGrid(
      inputData.recentlyAddedSeries,
      g_extraLocalization.recentlyAddedSeries,
    );
    div.appendChild(grid);
    seriesIds.push(
      ...inputData.recentlyAddedSeries.content.map((data) => data.id),
    );
    const button = document.querySelector(
      "#tool-servers-activity-recentseries-button",
    );
    if (button)
      button.addEventListener("click", () => {
        showLoadingModal();
        sendIpcToMain("show-series-in-recentseries", 0);
      });
  }
  {
    const div = document.querySelector(
      "#tool-servers-activity-updatedseries-div",
    );
    const grid = helperSeriesGrid(
      inputData.recentlyUpdatedSeries,
      g_extraLocalization.recentlyUpdatedSeries,
    );
    div.appendChild(grid);
    seriesIds.push(
      ...inputData.recentlyUpdatedSeries.content.map((data) => data.id),
    );
    const button = document.querySelector(
      "#tool-servers-activity-updatedseries-button",
    );
    if (button)
      button.addEventListener("click", () => {
        showLoadingModal();
        sendIpcToMain("show-series-in-updatedseries", 0);
      });
  }
  sendIpcToMain("get-thumbs", bookIds, seriesIds);
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  modals.closeActiveModal(modals.Level.TOOLS);
}

function buildContentLibraries(inputData) {
  if (inputData) {
    const root = document.querySelector("#tool-servers-content");
    root.style = "padding-top: 10px";
    root.innerHTML = "";

    const ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    root.appendChild(ul);

    inputData.forEach((data) => {
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      //////////////
      let buttonSpan = document.createElement("span");
      buttonSpan.className = "tools-buttons-list-button";
      buttonSpan.innerHTML = `<i class="fas fa-folder-open fa-2x"></i>`;
      // buttonSpan.title = g_localizedModalTexts.searchResultsShowIssues;
      /////
      let multilineText = document.createElement("span");
      multilineText.className = "tools-buttons-list-li-multiline-text";
      multilineText.classList.add("set-flex-grow-1");
      {
        let text = document.createElement("span");
        text.innerText = data.name;
        multilineText.appendChild(text);

        // if (data.description) {
        //   text = document.createElement("span");
        //   text.innerHTML = data.description;
        //   text.innerHTML = reduceStringBack(text.textContent);
        //   multilineText.appendChild(text);
        // }
      }
      buttonSpan.appendChild(multilineText);
      buttonSpan.innerHTML += `<i class="fas fa-angle-right"></i>`;
      buttonSpan.addEventListener("click", (event) => {
        showLoadingModal();
        // updateModalTitleText(g_localizedModalTexts.searchingTitle);
        sendIpcToMain("show-series-in-library", data.id, data.name, "ALL", 0);
      });
      /////
      li.appendChild(buttonSpan);
      ////////////////
      ul.appendChild(li);
    });
  }
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  modals.closeActiveModal(modals.Level.TOOLS);
}

function buildContentSeriesInLibrary(
  libraryId,
  libraryName,
  inputData,
  letters,
  letter,
  pageIndex = 0,
) {
  helperBuildSeries(
    inputData,
    (pageIndex) => {
      showLoadingModal();
      sendIpcToMain(
        "show-series-in-library",
        libraryId,
        libraryName,
        letter,
        pageIndex,
      );
    },
    letters,
    letter,
    (newLetter) => {
      showLoadingModal();
      sendIpcToMain(
        "show-series-in-library",
        libraryId,
        libraryName,
        newLetter,
        0,
      );
    },
  );
}

function buildContentBooksInSeries(
  seriesId,
  seriesName,
  inputData,
  pageIndex = 0,
) {
  helperBuildBooks(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-books-in-series", seriesId, seriesName, pageIndex);
  });
}

function buildContentBooksInVolume(
  volumeId,
  volumeName,
  inputData,
  pageIndex = 0,
) {
  helperBuildBooks(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-books-in-volume", volumeId, volumeName, pageIndex);
  });
}

function buildContentBook(data) {
  const root = document.querySelector("#tool-servers-content");
  root.innerHTML = "";

  if (data) {
    const safeTitle = data.name.replace(/"/g, "&quot;");
    const pagesCount = data.media?.pagesCount || 0;

    let progress;
    if (data.readProgress?.completed) {
      progress = g_extraLocalization.completed;
    } else if (data.readProgress?.page && data.media?.pagesCount) {
      progress =
        parseInt(
          (data.readProgress.page / data.media.pagesCount) * 100,
        ).toFixed(0) + "%";
    }

    const detailView = document.createElement("div");
    detailView.className = "tool-servers-book-detail-view";

    const authorsList =
      data.metadata?.authors?.map((a) => `${a.name} (${a.role})`).join(", ") ||
      g_extraLocalization.unknown;
    const tagsList =
      data.metadata?.tags
        ?.map((t) => `<span class="tool-servers-book-tag">${t}</span>`)
        .join(", ") || g_extraLocalization.none;
    const summaryText = data.metadata?.summary || g_extraLocalization.noSummary;

    detailView.innerHTML = `
        <div class="tool-servers-book-detail-main">
          <div class="tool-servers-book-detail-left">
            <div class="tool-servers-book-card-container">
              <img class="tool-servers-book-card-img tool-servers-contain" id="tool-servers-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
            </div>
          </div>
          
          <div class="tool-servers-book-detail-right">
            <h2 class="tool-servers-book-detail-title">${data.name}</h2>
            <h4 class="tool-servers-book-detail-series">${data.seriesTitle}</h4>
            
            <div class="tool-servers-book-meta-grid">
              <p><span class="tool-servers-book-dataname">${g_extraLocalization.numPages.toUpperCase()}</span> ${pagesCount}</p>
              ${progress ? `<p><span class="tool-servers-book-dataname">${g_extraLocalization.progress.toUpperCase()}</span> ${progress}</p>` : ""}             
              <p><span class="tool-servers-book-dataname">${g_extraLocalization.creators.toUpperCase()}</span> ${authorsList}</p>
              <div><span class="tool-servers-book-dataname">${g_extraLocalization.tags.toUpperCase()}</span> ${tagsList}</div>
              <p><span class="tool-servers-book-dataname">${g_extraLocalization.file.toUpperCase()}</span> ${data?.url || g_extraLocalization.unknown}</p>
              <p><span class="tool-servers-book-dataname">${g_extraLocalization.fileSize.toUpperCase()}</span> ${data?.size || g_extraLocalization.unknown}</p>
              <p><span class="tool-servers-book-dataname">${g_extraLocalization.format.toUpperCase()}</span> ${data?.media?.mediaType || g_extraLocalization.unknown}</p>
            </div>
            
            <p class="tool-servers-book-summary">${summaryText}</p>
          </div>
        </div>

        <div>
          ${
            !data.disableReading
              ? `<button id="tool-servers-read-btn-${data.id}">
            <span>OPEN IN ACBR</span>
          </button>`
              : ""
          }          
          <button id="tool-servers-download-btn-${data.id}">
            <span>DOWNLOAD</span>
          </button>
        </div>
      `;

    root.appendChild(detailView);

    const readButton = document.getElementById(
      `tool-servers-read-btn-${data.id}`,
    );
    if (readButton)
      readButton.addEventListener("click", () => {
        const comicData = {
          comicId: data.id,
          name: data.metadata.title,
          numPages: pagesCount,
          url: ``,
        };
        sendIpcToMain(
          "open-book",
          comicData,
          data.readProgress ? data.readProgress.page : 1,
        );
      });

    const downloadButton = document.getElementById(
      `tool-servers-download-btn-${data.id}`,
    );
    downloadButton.addEventListener("click", () => {
      sendIpcToMain("download-book", data.id, data.name);
    });

    sendIpcToMain("get-books-thumbs", [data.id]);
  }
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  modals.closeActiveModal(modals.Level.TOOLS);
}

//

function buildContentVolumesInSeries(
  volumeId,
  volumeName,
  inputData,
  pageIndex = 0,
) {
  helperBuildVolumes(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-books-in-volume", volumeId, volumeName, pageIndex);
  });
}

///////////////////////////////////////////////////////////////////////////////

function buildContentBooksInSearch(query, inputData, pageIndex = 0) {
  helperBuildBooks(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-books-in-search", query, pageIndex);
  });
}

function buildContentSeriesInSearch(query, inputData, pageIndex = 0) {
  helperBuildSeries(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-series-in-search", query, pageIndex);
  });
}

///////////////////////////////////////////////////////////////////////////////

function buildContentBooksInKeepReading(inputData, pageIndex = 0) {
  helperBuildBooks(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-books-in-keepreading", pageIndex);
  });
}

function buildContentBooksInRecentBooks(inputData, pageIndex = 0) {
  helperBuildBooks(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-books-in-recentbooks", pageIndex);
  });
}

function buildContentSeriesInRecentSeries(inputData, pageIndex = 0) {
  helperBuildSeries(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-series-in-recentseries", pageIndex);
  });
}

function buildContentSeriesInUpdatedSeries(inputData, pageIndex = 0) {
  helperBuildSeries(inputData, (pageIndex) => {
    showLoadingModal();
    sendIpcToMain("show-series-in-updatedseries", pageIndex);
  });
}

///////////////////////////////////////////////////////////////////////////////

function helperBuildSeries(inputData, goToPage, letters, letter, goToAlphabet) {
  const root = document.querySelector("#tool-servers-content");
  root.style = "padding-top: 10px";
  root.innerHTML = "";

  if (letters && goToAlphabet)
    root.appendChild(getAlphabetFilterDiv(letters, letter, goToAlphabet));

  if (inputData) {
    /////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(inputData.number, inputData.totalPages, goToPage),
      );
    }
    ////
    const gridWrapper = helperSeriesGrid(inputData);
    root.appendChild(gridWrapper);
    ////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(inputData.number, inputData.totalPages, goToPage),
      );
    }
  }
  //
  const seriesIds = inputData.content.map((data) => data.id);
  sendIpcToMain("get-series-thumbs", seriesIds);
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  modals.closeActiveModal(modals.Level.TOOLS);
}

function helperBuildVolumes(inputData, goToPage) {
  const root = document.querySelector("#tool-servers-content");
  root.style = "padding-top: 10px";
  root.innerHTML = "";

  if (inputData) {
    /////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(inputData.number, inputData.totalPages, goToPage),
      );
    }
    ////
    const gridWrapper = helperVolumesGrid(inputData);
    root.appendChild(gridWrapper);
    ////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(inputData.number, inputData.totalPages, goToPage),
      );
    }
  }
  //
  const seriesIds = inputData.content.map((data) => data.id);
  sendIpcToMain("get-volumes-thumbs", seriesIds);
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  modals.closeActiveModal(modals.Level.TOOLS);
}

function helperBuildBooks(inputData, goToPage) {
  const root = document.querySelector("#tool-servers-content");
  root.style = "padding-top: 10px";
  root.innerHTML = "";

  if (inputData) {
    /////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(inputData.number, inputData.totalPages, goToPage),
      );
    }
    ////
    const gridWrapper = helperBooksGrid(inputData);
    root.appendChild(gridWrapper);
    ////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(inputData.number, inputData.totalPages, goToPage),
      );
    }
    //
    const bookIds = inputData.content.map((data) => data.id);
    sendIpcToMain("get-books-thumbs", bookIds);
  }
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  modals.closeActiveModal(modals.Level.TOOLS);
}

function helperBooksGrid(inputData, altLibraryName) {
  const gridWrapper = document.createElement("div");
  gridWrapper.className = "tool-servers-books-grid-wrapper";
  inputData.content.forEach((data) => {
    const card = document.createElement("div");
    card.className = "tool-servers-book-card";
    card.setAttribute("data-id", data.id);
    const safeTitle = data.metadata.title.replace(/"/g, "&quot;");
    card.innerHTML = `
          <div class="tool-servers-book-card-container" title="${safeTitle}">
            <img class="tool-servers-book-card-img" id="tool-servers-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
          </div>
          <span class="tool-servers-book-card-title" title="${safeTitle}">${data.metadata.title}</span>
        `;
    card.addEventListener("click", () => {
      showLoadingModal();
      sendIpcToMain("show-book", data.id, data.metadata.title, altLibraryName);
    });
    gridWrapper.appendChild(card);
  });
  return gridWrapper;
}

function helperVolumesGrid(inputData) {
  const gridWrapper = document.createElement("div");
  gridWrapper.className = "tool-servers-books-grid-wrapper";
  inputData.content.forEach((data) => {
    const card = document.createElement("div");
    card.className = "tool-servers-book-card";
    card.setAttribute("data-id", data.id);
    const safeTitle = data.metadata.title.replace(/"/g, "&quot;");
    card.innerHTML = `
          <div class="tool-servers-book-card-container" title="${safeTitle}">
            <img class="tool-servers-book-card-img" id="tool-servers-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
          </div>
          <span class="tool-servers-book-card-title" title="${safeTitle}">${data.metadata.title}</span>
        `;
    card.addEventListener("click", () => {
      showLoadingModal();
      sendIpcToMain("show-books-in-volume", data.id, data.metadata.title);
    });
    gridWrapper.appendChild(card);
  });
  return gridWrapper;
}

function helperSeriesGrid(inputData, altLibraryName) {
  const gridWrapper = document.createElement("div");
  gridWrapper.className = "tool-servers-books-grid-wrapper";
  inputData.content.forEach((data) => {
    const card = document.createElement("div");
    card.className = "tool-servers-book-card";
    card.setAttribute("data-id", data.id);
    const safeTitle = data.metadata.title.replace(/"/g, "&quot;");
    card.innerHTML = `
          <div class="tool-servers-book-card-container" title="${safeTitle}">
            <img class="tool-servers-book-card-img" id="tool-servers-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
            ${data.booksCount ? `<div class="tool-servers-book-card-numtag">${data.booksCount}</div>` : ""}
          </div>
          <span class="tool-servers-book-card-title" title="${safeTitle}">${data.metadata.title}</span>
        `;
    card.addEventListener("click", () => {
      showLoadingModal();
      sendIpcToMain(
        "show-books-in-series",
        data.id,
        data.metadata.title,
        0,
        altLibraryName,
      );
    });
    gridWrapper.appendChild(card);
  });
  return gridWrapper;
}

///////////////////////////////////////////////////////////////////////////////
// CONTENT NAVBAR /////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function buildContentNavbar(state, history) {
  const root = document.querySelector("#tool-servers-navbar");
  root.innerHTML = ``;

  ///////////
  const backButton = document.createElement("span");
  backButton.className = "tool-servers-navbar-icon-button";
  backButton.addEventListener("click", (event) => {
    showLoadingModal();
    sendIpcToMain("on-nav-button-clicked", "back");
  });
  backButton.innerHTML = `<i class="fa-solid fa-arrow-left"></i>`;
  if (!state?.section || state.section === Section.LIBRARIES)
    backButton.classList.add("tool-servers-navbar-icon-button-disabled");
  backButton.title = g_extraLocalization.back;
  root.appendChild(backButton);

  const librariesButton = document.createElement("span");
  librariesButton.className = "tool-servers-navbar-icon-button";
  librariesButton.addEventListener("click", (event) => {
    showLoadingModal();
    sendIpcToMain("on-nav-button-clicked", "libraries");
  });
  librariesButton.innerHTML = `<i class="fa-solid fa-folder-tree"></i>`;
  if (!state?.section || state.section === Section.LIBRARIES)
    librariesButton.classList.add("tool-servers-navbar-icon-button-disabled");
  librariesButton.title = g_extraLocalization.libraries;
  root.appendChild(librariesButton);

  const activityButton = document.createElement("span");
  activityButton.className = "tool-servers-navbar-icon-button";
  activityButton.addEventListener("click", (event) => {
    showLoadingModal();
    sendIpcToMain("on-nav-button-clicked", "activity");
  });
  activityButton.innerHTML = `<i class="fa-solid fa-chart-simple"></i>`;
  if (!state?.section || state.section === Section.ACTIVITY)
    activityButton.classList.add("tool-servers-navbar-icon-button-disabled");
  activityButton.title = g_extraLocalization.activity;
  root.appendChild(activityButton);

  const searchButton = document.createElement("span");
  searchButton.className = "tool-servers-navbar-icon-button";
  searchButton.addEventListener("click", (event) => {
    showLoadingModal();
    sendIpcToMain("on-nav-button-clicked", "search");
  });
  searchButton.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>`;
  if (!state?.section)
    searchButton.classList.add("tool-servers-navbar-icon-button-disabled");
  searchButton.title = g_extraLocalization.search;
  root.appendChild(searchButton);
  //////////////
  const rightDiv = document.createElement("div");
  rightDiv.id = "tool-servers-navbar-right-content";
  root.appendChild(rightDiv);

  let title = "";
  const { section, search, library, series, volume, book } = state || {};
  const loc = g_extraLocalization;
  if (section === Section.SEARCH_BOOKS || section === Section.SEARCH_SERIES) {
    const type = section === Section.SEARCH_BOOKS ? loc.books : loc.series;
    title += `${loc.search?.toUpperCase()} (${type}): ${search.query}`;
  } else if (section === Section.ACTIVITY) {
    title += loc.activity.toUpperCase();
  } else if (section === Section.LIBRARIES) {
    title += loc.libraries.toUpperCase();
  } else if (section === Section.KEEP_READING) {
    title += loc.keepReading.toUpperCase();
  } else if (section === Section.RECENT_BOOKS) {
    title += loc.recentlyAddedBooks.toUpperCase();
  } else if (section === Section.RECENT_SERIES) {
    title += loc.recentlyAddedSeries.toUpperCase();
  } else if (section === Section.UPDATED_SERIES) {
    title += loc.recentlyUpdatedSeries.toUpperCase();
  } else {
    const path = [
      library?.name?.toUpperCase(),
      series?.name,
      volume?.name,
      book?.name,
    ].filter((item) => {
      return item; // returns item when if(item) is true
    });
    // title += path.join(" 	► ");
    title += path.join("<span class='arrow'>►</span>");
  }
  rightDiv.innerHTML = title;
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (modals.getActiveModal(modals.Level.TOOLS)) {
    // TODO: new modals input
    modals.onInputEvent(modals.getActiveModal(modals.Level.TOOLS), type, event);
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
  if (modals.getActiveModal(modals.Level.TOOLS)) {
    return;
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showLoadingModal() {
  modals.showLoadingModal(
    modals.Level.TOOLS,
    true,
    g_extraLocalization.loadingTitle,
  );
}

function showDownloadingModal(fileName) {
  modals.showLoadingModal(
    modals.Level.TOOLS,
    false,
    g_extraLocalization.downloadingTitle,
    fileName,
    g_extraLocalization.cancelButton,
    () => {
      sendIpcToMain("cancel-download-book");
    },
  );
}

function updateDownloadingModalPercentage(percentage) {
  const modal = modals.getActiveModal(modals.Level.TOOLS);
  if (!modal) return;
  const progressBar = modal.querySelector(".modal-progress-bar-fill");
  if (!progressBar) return;
  progressBar.style.width = `${percentage}%`;
}

function showDownloadErrorModal(error) {
  modals.showInfoModal(
    modals.Level.TOOLS,
    g_extraLocalization.errorTitle,
    error,
    g_extraLocalization.okButton,
  );
}

function showLoginModal(...args) {
  modals.showServerLoginModal(...args, (data) => {
    if (!data) return;
    sendIpcToMain("on-modal-connect-ok-clicked", data);
  });
}

function showModalRemoveServerFromList(
  index,
  titleText,
  messageText,
  okText,
  cancelText,
) {
  modals.showInfoModal(
    modals.Level.TOOLS,
    titleText,
    messageText,
    okText,
    cancelText,
    () => {
      sendIpcToMain("on-modal-remove-server-from-list-ok-clicked", index);
    },
  );
}

function showModalSearch(titleText, messageText, okText, cancelText) {
  modals.showSearchModal(
    modals.Level.TOOLS,
    titleText,
    messageText,
    [
      { name: g_extraLocalization.books, value: "0" },
      { name: g_extraLocalization.series, value: "1" },
    ],
    okText,
    cancelText,
    (query, selectValue) => {
      sendIpcToMain("on-modal-search-ok-clicked", query, selectValue);
    },
  );
}
