/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_searchInput;
let g_searchButton;
let g_lastSearchPageSize;

let g_urlInput;
let g_openInputInACBRButton;
let g_openInputInBrowserButton;

let g_mirrorsSelect;
let g_cacheFolderInput;
let g_cacheDownloadsCheckbox;
let g_openCacheFolderButton;
let g_portableCacheFolderPath = undefined;
let g_portableCacheFolderExists = false;

let g_localizedSearchPlaceholderText;
let g_localizedModalCancelButtonText;
let g_localizedModalCloseButtonText;
let g_localizedModalSearchingTitleText;

function init(
  portableCacheFolderPath,
  portableCacheFolderExists,
  settingsUseCache
) {
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
    .getElementById("tool-gut-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  for (let index = 0; index < 4; index++) {
    document
      .getElementById(`tool-gut-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////

  // search
  g_searchButton = document.getElementById("tool-gut-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-gut-search-input");
  g_searchInput.placeholder = g_localizedSearchPlaceholderText;
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
        .getElementById("tool-search-input-div")
        .classList.contains("set-display-none")
    ) {
      event.preventDefault();
      if (g_searchInput.value) {
        onSearch();
      }
    }
  });
  g_searchInput.focus();

  g_lastSearchPageSize = undefined;

  // url
  g_urlInput = document.getElementById("tool-gut-url-input");
  g_openInputInACBRButton = document.getElementById(
    "tool-gut-open-input-url-acbr-button"
  );
  g_openInputInBrowserButton = document.getElementById(
    "tool-gut-open-input-url-browser-button"
  );

  g_urlInput.addEventListener("input", (event) => {
    if (event.target.value.startsWith("https://www.gutenberg.org/ebooks/")) {
      g_openInputInACBRButton.classList.remove("tools-disabled");
      g_openInputInBrowserButton.classList.remove("tools-disabled");
    } else {
      g_openInputInACBRButton.classList.add("tools-disabled");
      g_openInputInBrowserButton.classList.add("tools-disabled");
    }
  });
  g_openInputInACBRButton.addEventListener("click", (event) => {
    onOpenUrlInACBR();
  });
  g_openInputInBrowserButton.addEventListener("click", (event) => {
    onOpenUrlInBrowser();
  });

  // options
  // e.g.
  // https://www.gutenberg.org/ebooks/68783
  // https://www.gutenberg.org/cache/epub/68783/pg68783.epub
  // mirror:
  // https://gutenberg.pglaf.org/cache/epub/68783/pg68783.epub
  let mirrorsContent = `<option value="https://gutenberg.pglaf.org/">gutenberg.pglaf.org</option>`;
  //mirrorsContent += `<option value="http://eremita.di.uminho.pt/gutenberg/">eremita.di.uminho.pt/gutenberg</option>`;
  mirrorsContent += `<option value="http://gutenberg.readingroo.ms/">gutenberg.readingroo.ms</option>`;
  mirrorsContent += `<option value="https://www.gutenberg.org/">gutenberg.org</option>`;
  g_mirrorsSelect = document.getElementById("tool-gut-options-mirrors-select");
  g_mirrorsSelect.innerHTML = mirrorsContent;

  g_portableCacheFolderPath = portableCacheFolderPath;
  g_portableCacheFolderExists = portableCacheFolderExists;

  g_cacheFolderInput = document.getElementById(
    "tool-gut-options-cache-folder-input"
  );
  g_cacheFolderInput.value = g_portableCacheFolderPath;
  g_openCacheFolderButton = document.getElementById(
    "tool-gut-options-open-cache-folder-button"
  );
  if (g_portableCacheFolderExists) {
    g_openCacheFolderButton.classList.remove("tools-disabled");
  } else {
    g_openCacheFolderButton.classList.add("tools-disabled");
  }
  g_openCacheFolderButton.addEventListener("click", (event) => {
    sendIpcToMain("open-path", g_portableCacheFolderPath);
  });

  g_cacheDownloadsCheckbox = document.getElementById(
    "tool-gut-options-cache-downloads-checkbox"
  );
  if (settingsUseCache) {
    g_cacheDownloadsCheckbox.checked = true;
  } else {
    g_cacheDownloadsCheckbox.checked = false;
  }
  g_cacheDownloadsCheckbox.addEventListener("change", (event) => {
    sendIpcToMain("update-use-cache", g_cacheDownloadsCheckbox.checked);
  });

  // about
  document
    .getElementById("tool-gut-open-pg-browser-button")
    .addEventListener("click", (event) => {
      openGutLink(`https://www.gutenberg.org/`);
    });

  document
    .getElementById("tool-gut-open-donate-browser-button")
    .addEventListener("click", (event) => {
      openGutLink(`https://www.gutenberg.org/donate/`);
    });

  ////////////////////////////////////////
  updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight() {
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
}

function switchSection(id) {
  for (let index = 0; index < 4; index++) {
    if (id === index) {
      document
        .getElementById(`tool-gut-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-gut-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-gut-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-gut-section-${index}-content-div`)
        .classList.add("set-display-none");
    }

    if (index === 0) {
      g_searchInput.focus();
    }
  }
  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-gutenberg", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-gutenberg", ...args);
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
  on(
    "show",
    (portableCacheFolderPath, portableCacheFolderExists, settingsUseCache) => {
      init(
        portableCacheFolderPath,
        portableCacheFolderExists,
        settingsUseCache
      );
    }
  );

  on("hide", () => {});

  on(
    "update-localization",
    (
      searchPlaceHolder,
      modalSearchingTitleText,
      modalCloseButtonText,
      modalCancelButtonText,
      localization
    ) => {
      g_localizedSearchPlaceholderText = searchPlaceHolder;
      g_localizedModalSearchingTitleText = modalSearchingTitleText;
      g_localizedModalCloseButtonText = modalCloseButtonText;
      g_localizedModalCancelButtonText = modalCancelButtonText;
      for (let index = 0; index < localization.length; index++) {
        const element = localization[index];
        const domElement = document.querySelector("#" + element.id);
        if (domElement !== null) {
          domElement.innerHTML = element.text;
        }
      }
    }
  );

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });

  /////////////////////////////////////////////////////////////////////////////

  on("modal-update-title-text", (text) => {
    console.log(text);
    updateModalTitleText(text);
  });

  on("update-info-text", (text) => {
    updateInfoText(text);
  });

  on("update-log-text", (text) => {
    updateLogText(text);
  });

  /////////////////////////////////////////////////////////////////////////////

  on(
    "update-results",
    (
      searchResults,
      noResultsText,
      queryInputText,
      pageNum,
      openInAcbrText,
      openInBrowserText
    ) => {
      document
        .querySelector("#tool-search-results-h3")
        .classList.remove("set-display-none");
      const searchResultsDiv = document.querySelector(
        "#tool-gut-search-results-div"
      );
      searchResultsDiv.innerHTML = "";
      /*
        {
          "count": <number>,
          "next": <string or null>,
          "previous": <string or null>,
          "results": <array of Books>
        }
      */
      const totalResultsNum = searchResults?.count;
      if (searchResults && totalResultsNum && totalResultsNum > 0) {
        const resultsNum = searchResults.results.length;
        if (!g_lastSearchPageSize || pageNum === 1)
          g_lastSearchPageSize = resultsNum;
        // pagination top
        if (totalResultsNum > g_lastSearchPageSize) {
          const totalPagesNum = Math.ceil(
            totalResultsNum / g_lastSearchPageSize
          );
          searchResultsDiv.appendChild(
            generatePaginationHtml(pageNum, totalPagesNum, queryInputText)
          );
        }
        // list
        let ul = document.createElement("ul");
        ul.className = "tools-collection-ul";
        for (let index = 0; index < resultsNum; index++) {
          const bookData = searchResults.results[index];
          if (bookData.media_type !== "Text") continue;
          /*
            Book
            {
              "id": <number of Project Gutenberg ID>,
              "title": <string>,
              "subjects": <array of strings>,
              "authors": <array of Persons>,
              "translators": <array of Persons>,
              "bookshelves": <array of strings>,
              "languages": <array of strings>,
              "copyright": <boolean or null>,
              "media_type": <string>,
              "formats": <Format>,
              "download_count": <number>
            }
            Person
            {
              "birth_year": <number or null>,
              "death_year": <number or null>,
              "name": <string>
            }
          */
          let li = document.createElement("li");
          li.className = "tools-collection-li";
          // open icon - clickable
          let button = document.createElement("span");
          button.title = openInAcbrText;
          button.className = "tools-collection-li-button";
          button.addEventListener("click", (event) => {
            onSearchResultClicked(bookData.id, bookData.title, 0);
          });
          button.innerHTML = `<i class="fa fa-folder-open"></i>`;
          li.appendChild(button);
          // text
          let multilineText = document.createElement("span");
          multilineText.className = "tools-collection-li-multiline-text";
          {
            let text = document.createElement("span");
            text.innerText = reduceString(bookData.title);
            multilineText.appendChild(text);
            let authorNames = [];
            for (let index = 0; index < bookData.authors.length; index++) {
              let author = bookData.authors[index].name;
              if (author && author !== "") {
                authorNames.push(author);
              }
            }
            let authors = "";
            for (let index = 0; index < authorNames.length; index++) {
              authors += authorNames[index];
              if (
                (index === 0 && authorNames.length > 1) ||
                index < authorNames.length - 1
              )
                authors += "; ";
            }
            if (authors !== "") {
              let text = document.createElement("span");
              text.innerText = reduceString(authors);
              multilineText.appendChild(text);
            }
          }
          li.appendChild(multilineText);
          // open url - clickable
          button = document.createElement("span");
          button.title = openInBrowserText;
          button.className = "tools-collection-li-button";
          button.addEventListener("click", (event) => {
            onSearchResultClicked(bookData.id, bookData.title, 1);
          });
          button.innerHTML = `<i class="fas fa-link"></i>`;
          li.appendChild(button);
          ul.appendChild(li);
        }
        searchResultsDiv.appendChild(ul);
        // pagination bottom
        if (totalResultsNum > g_lastSearchPageSize) {
          const totalPagesNum = Math.ceil(
            totalResultsNum / g_lastSearchPageSize
          );
          searchResultsDiv.appendChild(
            generatePaginationHtml(pageNum, totalPagesNum, queryInputText)
          );
        }
      } else {
        let ul = document.createElement("ul");
        ul.className = "tools-collection-ul";
        let li = document.createElement("li");
        li.className = "tools-collection-li";
        let text = document.createElement("span");
        text.innerText = noResultsText;
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
      closeModal();
    }
  );
}

function generatePaginationHtml(pageNum, totalPagesNum, queryInputText) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  if (pageNum > 2) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(1, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  if (pageNum > 1) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(pageNum - 1, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` ${pageNum} / ${totalPagesNum} `;
  paginationDiv.appendChild(span);
  if (pageNum < totalPagesNum) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(pageNum + 1, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  if (pageNum < totalPagesNum - 1) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-double-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(totalPagesNum, queryInputText);
    });
    paginationDiv.appendChild(span);
  }
  return paginationDiv;
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onSearch(pageNum = 1, inputValue = undefined) {
  if (!inputValue) inputValue = g_searchInput.value;
  if (!g_openModal) showSearchModal();
  updateModalTitleText(g_localizedModalSearchingTitleText);
  sendIpcToMain("search", inputValue, pageNum);
}

async function onSearchResultClicked(bookId, bookTitle, openWith) {
  if (openWith === 0) {
    sendIpcToMain("open-id", bookId, bookTitle, g_mirrorsSelect.value);
  } else {
    let url = `https://www.gutenberg.org/ebooks/${bookId}`;
    openGutLink(url);
  }
}

//////////////////////////////////////

function onOpenUrlInACBR() {
  let url = g_urlInput.value;
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "www.gutenberg.org") {
    // e.g. https://www.gutenberg.org/ebooks/35
    let bookId;
    let parts = url.split("ebooks/");
    if (parts.length === 2 && isValidBookId(parts[1])) {
      bookId = parts[1];
    }
    if (!bookId) return;
    sendIpcToMain("open-id", bookId, undefined, g_mirrorsSelect.value);
  }
}

function onOpenUrlInBrowser() {
  let url = g_urlInput.value;
  openGutLink(url);
}

function openGutLink(url) {
  const tmp = document.createElement("a");
  tmp.href = url;
  if (tmp.host === "www.gutenberg.org") {
    sendIpcToMain("open-url-in-browser", url);
  }
}

//////////////////////////////////////

function isValidBookId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

function reduceString(input) {
  if (!input) return undefined;
  let length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getOpenModal()) {
    modals.onInputEvent(getOpenModal(), type, event);
    return;
  }
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
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
