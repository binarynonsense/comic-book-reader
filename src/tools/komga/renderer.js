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
import * as oldModals from "../../shared/renderer/modals.js";
import * as modals from "../../shared/renderer/modals/modals.js";

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
    .getElementById("tool-komga-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-komga-add-button")
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
      .getElementById(`tool-komga-section-${index}-button`)
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
        .getElementById(`tool-komga-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-komga-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-komga-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-komga-section-${index}-content-div`)
        .classList.add("set-display-none");
    }
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-komga", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-komga", ...args);
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

  on("render-book-thumb", (bookId, buffer, mime) => {
    if (buffer) {
      const img = document.querySelector(`#tool-komga-thumb-${bookId}`);
      if (img) {
        const blob = new Blob([buffer], { type: mime });
        const url = URL.createObjectURL(blob);
        img.src = url;
      }
    }
  });

  on("render-series-thumb", (seriesId, buffer, mime) => {
    if (buffer) {
      const img = document.querySelector(`#tool-komga-thumb-${seriesId}`);
      if (img) {
        const blob = new Blob([buffer], { type: mime });
        const url = URL.createObjectURL(blob);
        img.src = url;
      }
    }
  });

  /////////////////////////////////////////////////////////////////////////////

  on("close-active-modal", () => {
    closeActiveModal();
  });

  on("show-modal-login", (...args) => {
    showLoginModal(...args);
  });

  on("show-modal-loading", () => {
    showLoadingModal();
  });

  on("show-modal-info", (...args) => {
    modals.showInfoModal(...args);
  });

  /////////////////////////////////////////////////////////////////////////////
}

///////////////////////////////////////////////////////////////////////////////
// SERVERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function buildServers(servers) {
  g_servers = servers;

  const container = document.querySelector("#tool-komga-servers-div");
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
        text.innerText = `${data.email}`;
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
  const root = document.querySelector("#tool-komga-content");
  root.style = "padding-top: 10px";
  root.innerHTML = `<span> ${g_extraLocalization.noContent} </span>`;
}

function buildContentLibraries(inputData) {
  if (inputData) {
    const root = document.querySelector("#tool-komga-content");
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
  closeActiveModal();
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

function buildContentBook(data) {
  const root = document.querySelector("#tool-komga-content");
  root.innerHTML = "";

  if (data) {
    const safeTitle = data.name.replace(/"/g, "&quot;");
    const pagesCount = data.media?.pagesCount || 0;

    let progress;
    if (data.readProgress?.completed) {
      progress = g_extraLocalization.completed;
    } else if (data.readProgress?.page && data.media?.pagesCount) {
      progress = (data.readProgress.page / data.media.pagesCount) * 100 + "%";
    }

    const detailView = document.createElement("div");
    detailView.className = "tool-komga-book-detail-view";

    const authorsList =
      data.metadata?.authors?.map((a) => `${a.name} (${a.role})`).join(", ") ||
      g_extraLocalization.unknown;
    const tagsList =
      data.metadata?.tags
        ?.map((t) => `<span class="tool-komga-book-tag">${t}</span>`)
        .join(", ") || g_extraLocalization.none;
    const summaryText = data.metadata?.summary || g_extraLocalization.noSummary;

    detailView.innerHTML = `
        <div class="tool-komga-book-detail-main">
          <div class="tool-komga-book-detail-left">
            <div class="tool-komga-book-card-container">
              <img class="tool-komga-book-card-img tool-komga-contain" id="tool-komga-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
            </div>
          </div>
          
          <div class="tool-komga-book-detail-right">
            <h2 class="tool-komga-book-detail-title">${data.name}</h2>
            <h4 class="tool-komga-book-detail-series">${data.seriesTitle}</h4>
            
            <div class="tool-komga-book-meta-grid">
              <p><span class="tool-komga-book-dataname">${g_extraLocalization.numPages.toUpperCase()}</span> ${pagesCount}</p>
              ${progress ? `<p><span class="tool-komga-book-dataname">${g_extraLocalization.progress.toUpperCase()}</span> ${progress}</p>` : ""}             
              <p><span class="tool-komga-book-dataname">${g_extraLocalization.creators.toUpperCase()}</span> ${authorsList}</p>
              <div><span class="tool-komga-book-dataname">${g_extraLocalization.tags.toUpperCase()}</span> ${tagsList}</div>
              <p><span class="tool-komga-book-dataname">${g_extraLocalization.file.toUpperCase()}</span> ${data?.url || g_extraLocalization.unknown}</p>
              <p><span class="tool-komga-book-dataname">${g_extraLocalization.format.toUpperCase()}</span> ${data?.media?.mediaType || g_extraLocalization.unknown}</p>
            </div>
            
            <p class="tool-komga-book-summary">${summaryText}</p>
          </div>
        </div>

        <div>
          <button id="tool-komga-read-btn-${data.id}">
            <span>OPEN IN ACBR</span>
          </button>
          <button id="tool-komga-download-btn-${data.id}">
            <span>DOWNLOAD</span>
          </button>
        </div>
      `;

    root.appendChild(detailView);

    const readButton = document.getElementById(
      `tool-komga-read-btn-${data.id}`,
    );
    readButton.addEventListener("click", () => {
      const comicData = {
        source: "komga",
        comicId: data.id,
        name: data.name,
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
      `tool-komga-download-btn-${data.id}`,
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
  closeActiveModal();
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

function helperBuildSeries(inputData, goToPage, letters, letter, goToAlphabet) {
  const root = document.querySelector("#tool-komga-content");
  root.style = "padding-top: 10px";
  root.innerHTML = "";

  if (goToAlphabet)
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
    const gridWrapper = document.createElement("div");
    gridWrapper.className = "tool-komga-books-grid-wrapper";
    root.appendChild(gridWrapper);

    inputData.content.forEach((data) => {
      const card = document.createElement("div");
      card.className = "tool-komga-book-card";
      card.setAttribute("data-id", data.id);
      const safeTitle = data.name.replace(/"/g, "&quot;");
      card.innerHTML = `
          <div class="tool-komga-book-card-container" title="${safeTitle}">
            <img class="tool-komga-book-card-img" id="tool-komga-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
            <div class="tool-komga-book-card-numtag">${data.booksCount}</div>
          </div>
          <span class="tool-komga-book-card-title" title="${safeTitle}">${data.name}</span>
        `;
      card.addEventListener("click", () => {
        showLoadingModal();
        sendIpcToMain("show-books-in-series", data.id, data.name);
      });
      gridWrapper.appendChild(card);
    });
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
  closeActiveModal();
}

function helperBuildBooks(inputData, goToPage) {
  const root = document.querySelector("#tool-komga-content");
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
    const gridWrapper = document.createElement("div");
    gridWrapper.className = "tool-komga-books-grid-wrapper";
    root.appendChild(gridWrapper);
    inputData.content.forEach((data) => {
      const card = document.createElement("div");
      card.className = "tool-komga-book-card";
      card.setAttribute("data-id", data.id);
      const safeTitle = data.name.replace(/"/g, "&quot;");
      card.innerHTML = `
          <div class="tool-komga-book-card-container" title="${safeTitle}">
            <img class="tool-komga-book-card-img" id="tool-komga-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
          </div>
          <span class="tool-komga-book-card-title" title="${safeTitle}">${data.name}</span>
        `;
      card.addEventListener("click", () => {
        showLoadingModal();
        sendIpcToMain("show-book", data.id, data.name);
      });
      gridWrapper.appendChild(card);
    });
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
  closeActiveModal();
}

///////////////////////////////////////////////////////////////////////////////
// CONTENT NAVBAR /////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const Section = {
  LIBRARIES: "libraries",
  HISTORY: "dashboard",
  SEARCH_BOOKS: "search_books",
  SEARCH_SERIES: "search_series",
  //
  LIBRARY_SERIES: "library_series",
  SERIES_BOOKS: "series_books",
  BOOK: "book",
};

function buildContentNavbar(state, history) {
  const root = document.querySelector("#tool-komga-navbar");
  root.innerHTML = ``;

  ///////////
  const backButton = document.createElement("span");
  backButton.className = "tool-komga-navbar-icon-button";
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("on-nav-button-clicked", "back");
  });
  backButton.innerHTML = `<i class="fa-solid fa-arrow-left"></i>`;
  if (!state?.section || state.section === Section.LIBRARIES)
    backButton.classList.add("tool-komga-navbar-icon-button-disabled");
  backButton.title = g_extraLocalization.back;
  root.appendChild(backButton);

  const librariesButton = document.createElement("span");
  librariesButton.className = "tool-komga-navbar-icon-button";
  librariesButton.addEventListener("click", (event) => {
    sendIpcToMain("on-nav-button-clicked", "libraries");
  });
  librariesButton.innerHTML = `<i class="fa-solid fa-folder-tree"></i>`;
  if (!state?.section || state.section === Section.LIBRARIES)
    librariesButton.classList.add("tool-komga-navbar-icon-button-disabled");
  librariesButton.title = g_extraLocalization.libraries;
  root.appendChild(librariesButton);

  const historyButton = document.createElement("span");
  historyButton.className = "tool-komga-navbar-icon-button";
  historyButton.addEventListener("click", (event) => {
    sendIpcToMain("on-nav-button-clicked", "home");
  });
  historyButton.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>`;
  if (!state?.section || state.section === Section.HISTORY)
    historyButton.classList.add("tool-komga-navbar-icon-button-disabled");
  historyButton.title = g_extraLocalization.history;
  root.appendChild(historyButton);

  const searchButton = document.createElement("span");
  searchButton.className = "tool-komga-navbar-icon-button";
  searchButton.addEventListener("click", (event) => {
    sendIpcToMain("on-nav-button-clicked", "search");
  });
  searchButton.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>`;
  if (!state?.section)
    searchButton.classList.add("tool-komga-navbar-icon-button-disabled");
  searchButton.title = g_extraLocalization.search;
  root.appendChild(searchButton);
  //////////////
  const rightDiv = document.createElement("div");
  rightDiv.id = "tool-komga-navbar-right-content";
  root.appendChild(rightDiv);

  let title = "";
  const { section, search, library, series, book } = state || {};
  const loc = g_extraLocalization;
  if (section === Section.SEARCH_BOOKS || section === Section.SEARCH_SERIES) {
    const type = section === Section.SEARCH_BOOKS ? loc.books : loc.series;
    title += `${loc.search} (${type}): ${search.query}`;
  } else {
    const path = [library?.name, series?.name, book?.name].filter((item) => {
      return item; // returns item when if(item) is true
    });
    title += path.join(" :: ");
  }
  rightDiv.textContent = title;
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getActiveModal()) {
    // TODO: new modals input
    //oldModals.onInputEvent(getActiveModal(), type, event);
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
  if (getActiveModal()) {
    return;
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_activeModal;

export function getActiveModal() {
  return g_activeModal;
}

function closeActiveModal() {
  if (g_activeModal) {
    modals.close(g_activeModal);
    g_activeModal = undefined;
  }
}

function showLoadingModal() {
  if (g_activeModal) {
    closeActiveModal();
  }
  g_activeModal = modals.showLoadingModal(
    modals.Level.TOOLS,
    g_extraLocalization.loadingTitle,
  );
}

function showLoginModal(...args) {
  if (g_activeModal) {
    closeActiveModal();
  }
  g_activeModal = modals.showKomgaLoginModal(...args, (data) => {
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
  if (g_activeModal) {
    closeActiveModal();
  }
  g_activeModal = modals.showInfoModal(
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
  if (g_activeModal) {
    closeActiveModal();
  }
  g_activeModal = modals.showSearchModal(
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
