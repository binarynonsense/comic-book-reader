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
      sendIpcToMain("on-open-server-url-clicked");
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

  g_servers = servers;
  renderNoContent();
  switchSection(1);

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

  on("render-libraries", (...args) => {
    switchSection(1);
    renderLibraries(...args);
  });

  on("render-series-in-library", (...args) => {
    renderSeriesInLibrary(...args);
  });

  on("render-books-in-series", (...args) => {
    renderBooksInSeries(...args);
  });

  on("render-book", (...args) => {
    renderBook(...args);
  });

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

  on("render-image", (buffer, mime) => {
    if (buffer) {
      const container = document.querySelector("#tool-komga-content");
      container.innerHTML = "";
      const img = document.createElement("img");
      img.style.width = "100%";
      container.appendChild(img);

      const blob = new Blob([buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      img.src = url;
    }
  });

  /////////////////////////////////////////////////////////////////////////////

  on("close-modal", () => {
    closeOpenModal();
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
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getPaginationDiv(pageIndex, totalPagesNum, goToPage) {
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

function renderNoContent() {
  const root = document.querySelector("#tool-komga-content");
  root.style = "padding-top: 10px";
  root.innerHTML = `<span> ${g_extraLocalization.noContent} </span>`;
}

function renderLibraries(inputData) {
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
        sendIpcToMain("show-series-in-library", data.id, 0);
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
  closeOpenModal();
}

function renderSeriesInLibrary(libraryId, inputData, pageIndex = 0) {
  const root = document.querySelector("#tool-komga-content");
  root.style = "padding-top: 10px";
  root.innerHTML = "";

  let backButton = document.createElement("span");
  backButton.className = "tools-collection-navigation-back";
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("go-back");
  });
  backButton.innerHTML = `<i class="fas fa-angle-left"></i> BACK`;
  root.appendChild(backButton);

  if (inputData) {
    /////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(
          inputData.number,
          inputData.totalPages,
          (pageIndex) => {
            showLoadingModal();
            sendIpcToMain("show-series-in-library", libraryId, pageIndex);
          },
        ),
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
        sendIpcToMain("show-books-in-series", data.id);
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
        getPaginationDiv(
          inputData.number,
          inputData.totalPages,
          (pageIndex) => {
            showLoadingModal();
            sendIpcToMain("show-series-in-library", libraryId, pageIndex);
          },
        ),
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
  closeOpenModal();
}

function renderBooksInSeries(seriesId, inputData, pageIndex = 0) {
  const root = document.querySelector("#tool-komga-content");
  root.style = "padding-top: 10px";
  root.innerHTML = "";

  let backButton = document.createElement("span");
  backButton.className = "tools-collection-navigation-back";
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("go-back");
  });
  backButton.innerHTML = `<i class="fas fa-angle-left"></i> BACK`;
  root.appendChild(backButton);

  if (inputData) {
    /////
    if (
      inputData.number !== undefined &&
      inputData.totalPages !== undefined &&
      inputData.totalPages > 1
    ) {
      root.appendChild(
        getPaginationDiv(
          inputData.number,
          inputData.totalPages,
          (pageIndex) => {
            showLoadingModal();
            sendIpcToMain("show-books-in-series", seriesId, pageIndex);
          },
        ),
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
        sendIpcToMain("show-book", data.id);
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
        getPaginationDiv(
          inputData.number,
          inputData.totalPages,
          (pageIndex) => {
            showLoadingModal();
            sendIpcToMain("show-books-in-series", seriesId, pageIndex);
          },
        ),
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
  closeOpenModal();
}

function renderBook(data) {
  console.log(data);

  const root = document.querySelector("#tool-komga-content");
  root.innerHTML = "";

  let backButton = document.createElement("span");
  backButton.className = "tools-collection-navigation-back";
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("go-back");
  });
  backButton.innerHTML = `<i class="fas fa-angle-left"></i> BACK`;
  root.appendChild(backButton);

  if (data) {
    const safeTitle = data.name.replace(/"/g, "&quot;");
    const pagesCount = data.media?.pagesCount || 0;

    const detailView = document.createElement("div");
    detailView.className = "tool-komga-book-detail-view";

    const authorsList =
      data.metadata?.authors?.map((a) => `${a.name} (${a.role})`).join(", ") ||
      "Unknown Author";
    const tagsList =
      data.metadata?.tags
        ?.map((t) => `<span class="tool-komga-book-badge">${t}</span>`)
        .join(" ") || "None";
    const summaryText = data.metadata?.summary || "No summary available.";

    detailView.innerHTML = `
        <div class="tool-komga-book-detail-main">
          <!-- Left Column: Frame holding our unique thumbnail slot -->
          <div class="tool-komga-book-detail-left">
            <div class="tool-komga-book-card-container">
              <img class="tool-komga-book-card-img tool-komga-contain" id="tool-komga-thumb-${data.id}" src="" alt="" title="${safeTitle}" />
            </div>
          </div>
          
          <div class="tool-komga-book-detail-right">
            <h2 class="tool-komga-book-detail-title">${data.name}</h2>
            <h4 class="tool-komga-book-detail-series">${data.seriesTitle}</h4>
            
            <div class="tool-komga-book-meta-grid">
              <p><strong>Pages:</strong> ${pagesCount}</p>
              <p><strong>File Size:</strong> ${data.size || "Unknown size"}</p>
              <p><strong>Creators:</strong> ${authorsList}</p>
              <div class="tool-komga-book-tags-row"><strong>Tags:</strong> ${tagsList}</div>
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
      sendIpcToMain("open-book", comicData, 1);
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
  closeOpenModal();
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getOpenModal()) {
    oldModals.onInputEvent(getOpenModal(), type, event);
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
  if (getOpenModal()) {
    return;
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function closeOpenModal() {
  if (g_openModal) {
    modals.close(g_openModal);
    modalClosed();
  }
}

function modalClosed() {
  g_openModal = undefined;
}

function showLoadingModal() {
  if (g_openModal) {
    closeOpenModal();
  }
  g_openModal = modals.showLoadingModal(
    modals.Level.TOOLS,
    g_extraLocalization.loadingTitle,
  );
}

function showLoginModal(...args) {
  if (g_openModal) {
    closeOpenModal();
  }
  g_openModal = modals.showKomgaLoginModal(...args, (data) => {
    if (!data) return;
    sendIpcToMain("on-modal-open-server-url-ok-clicked", data);
  });
}
