/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import * as comicinfo from "./comicinfo/renderer.js";
import * as epub from "./epub/renderer.js";
import * as pdf from "./pdf/renderer.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_subTool;

let g_isInitialized = false;
let g_localizedModalTexts;

let g_saveButton;

let g_searchInput;
let g_searchButton;
let g_searchHistory;
let g_apiKeyFilePathUl;
let g_apiKeyFilePathCheckbox;

function init(...args) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  ////////////////////////////////////////
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  // menu buttons
  document
    .getElementById("tool-metadata-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  g_saveButton = document.getElementById("tool-metadata-save-button");
  g_saveButton.addEventListener("click", (event) => {
    g_subTool.onSave();
  });
  g_saveButton.classList.add("tools-disabled");
  // sections menu
  for (
    let index = 0;
    index < document.querySelectorAll(".tools-menu-button").length;
    index++
  ) {
    document
      .getElementById(`tool-metadata-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  // search
  g_searchButton = document.getElementById("tool-metadata-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-metadata-search-input");
  g_searchInput.placeholder = g_localizedModalTexts.searchPlaceholder;
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
        .getElementById("tool-metadata-section-0-content-div")
        .classList.contains("set-display-none")
    ) {
      event.preventDefault();
      if (g_searchInput.value) {
        onSearch();
      }
    }
  });
  g_searchInput.focus();
  // TODO: cache multiple searches, issue url...
  g_searchHistory = {};
  ////////////////////////////////////////
  // search settings
  g_apiKeyFilePathUl = document.getElementById(
    "tool-metadata-comicvine-api-key-file-ul"
  );
  g_apiKeyFilePathCheckbox = document.getElementById(
    "tool-metadata-comicvine-api-key-checkbox"
  );
  document
    .getElementById("tool-metadata-comicvine-api-key-file-change-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("change-api-key-file", g_apiKeyFilePathCheckbox.checked);
    });
  ////////////////////////////////////////
  // tooltips
  const tooltipButtons = document.querySelectorAll(".tools-tooltip-button");
  tooltipButtons.forEach((element) => {
    element.addEventListener("click", (event) => {
      sendIpcToMain(
        "tooltip-button-clicked",
        element.getAttribute("data-info")
      );
    });
  });
  ////////////////////////////////////////
  g_subTool.init(...args);
  if (!g_openModal) closeModal(g_openModal);
  showProgressModal();
  updateModalTitleText(g_localizedModalTexts.loadingTitle);
  sendIpcToMain("load-metadata");
  ////////////////////////////////////////
  updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

export function updateColumnsHeight(scrollTop = false) {
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

export function switchSection(id) {
  for (
    let index = 0;
    index < document.querySelectorAll(".tools-menu-button").length;
    index++
  ) {
    if (id === index) {
      document
        .getElementById(`tool-metadata-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-metadata-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-metadata-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-metadata-section-${index}-content-div`)
        .classList.add("set-display-none");
    }
  }
  updateColumnsHeight(true);
  if (id === 0) {
    g_searchInput.focus();
  }
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-metadata", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-metadata", ...args);
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

  on("set-subtool", (id) => {
    // TODO: epub, pdf...
    if (id === "cix") {
      g_subTool = comicinfo;
    } else if (id === "epub") {
      g_subTool = epub;
    } else if (id === "pdf") {
      g_subTool = pdf;
    }
  });

  on(
    "update-localization",
    (
      localization,
      tooltipsLocalization,
      localizedModalTexts,
      localizedSubTool
    ) => {
      g_localizedModalTexts = localizedModalTexts;
      g_subTool?.updateLocalization(localizedModalTexts, localizedSubTool);
      for (let index = 0; index < localization.length; index++) {
        const element = localization[index];
        const domElement = document.querySelector("#" + element.id);
        if (domElement !== null) {
          domElement.innerHTML = element.text;
        }
      }
      for (let index = 0; index < tooltipsLocalization.length; index++) {
        const element = tooltipsLocalization[index];
        const domElement = document.querySelector("#" + element.id);
        if (domElement !== null) {
          if (
            domElement.classList &&
            domElement.classList.contains("tools-tooltip-button")
          ) {
            domElement.setAttribute("data-info", element.text);
            domElement.title = localizedModalTexts.infoTooltip;
          } else {
            domElement.title = element.text;
          }
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
    updateModalTitleText(text);
  });

  on("update-info-text", (text) => {
    updateInfoText(text);
  });

  on("update-log-text", (text) => {
    updateLogText(text);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("load-metadata", (json, error) => {
    g_subTool.onLoadMetadata(json, error);
  });

  on("pages-updated", (json) => {
    g_subTool.onPagesUpdated(json);
  });

  on("saving-done", (error) => {
    closeModal();
    g_subTool.onSavingDone(error);
  });

  on("show-modal-info", (...args) => {
    showInfoModal(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on(
    "search-volumes-results",
    (searchResults, noResultsText, queryInputText, pageNum) => {
      document
        .querySelector("#tool-search-results-h3")
        .classList.remove("set-display-none");

      document
        .querySelector("#tool-metadata-search-results-div")
        .classList.remove("set-display-none");
      document
        .querySelector("#tool-metadata-search-results-issues-div")
        .classList.add("set-display-none");
      document
        .querySelector("#tool-metadata-search-results-issue-div")
        .classList.add("set-display-none");
      const searchResultsDiv = document.querySelector(
        "#tool-metadata-search-results-div"
      );
      searchResultsDiv.innerHTML = "";

      g_searchHistory.volumes = searchResults;
      g_searchHistory.issues = undefined;
      g_searchHistory.issue = undefined;

      const totalResultsNum = searchResults?.number_of_total_results;
      if (
        searchResults &&
        searchResults.error === "OK" &&
        totalResultsNum &&
        totalResultsNum > 0
      ) {
        const resultsNum = searchResults.results.length;
        if (!g_searchHistory.lastSearchPageSize || pageNum === 1)
          g_searchHistory.lastSearchPageSize = resultsNum;
        // pagination top
        if (totalResultsNum > g_searchHistory.lastSearchPageSize) {
          const totalPagesNum = Math.ceil(
            totalResultsNum / g_searchHistory.lastSearchPageSize
          );
          searchResultsDiv.appendChild(
            generatePaginationHtml(pageNum, totalPagesNum, queryInputText)
          );
        }
        // list
        let ul = document.createElement("ul");
        ul.className = "tools-collection-ul";
        for (let index = 0; index < resultsNum; index++) {
          const data = searchResults.results[index];
          let li = document.createElement("li");
          li.className = "tools-collection-li";
          // text
          let multilineText = document.createElement("span");
          multilineText.className = "tools-collection-li-multiline-text";
          {
            let text = document.createElement("span");
            text.innerText =
              data?.name +
              " (" +
              data?.start_year +
              "); Issues: " +
              data?.count_of_issues +
              "; Publisher: " +
              data?.publisher?.name; // + " - " + data.resource_type;

            multilineText.appendChild(text);

            if (data.description) {
              text = document.createElement("span");
              text.innerHTML = data.description;
              text.innerHTML = reduceStringBack(text.textContent);
              multilineText.appendChild(text);
            }
          }
          li.appendChild(multilineText);

          // open issues list
          let button = document.createElement("span");
          button.title = g_localizedModalTexts.searchResultsShowIssues;
          button.className =
            "tools-collection-li-button tools-collection-li-button-extra-padding";
          button.addEventListener("click", (event) => {
            showProgressModal();
            updateModalTitleText(g_localizedModalTexts.searchingTitle);
            sendIpcToMain("get-volume-data", data.api_detail_url);
          });
          button.innerHTML = `<i class="fas fa-angle-right"></i>`;
          li.appendChild(button);

          ul.appendChild(li);
        }
        searchResultsDiv.appendChild(ul);
        // pagination bottom
        if (totalResultsNum > g_searchHistory.lastSearchPageSize) {
          const totalPagesNum = Math.ceil(
            totalResultsNum / g_searchHistory.lastSearchPageSize
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

  on("search-issues-results", (searchResults, noResultsText) => {
    document
      .querySelector("#tool-metadata-search-results-div")
      .classList.add("set-display-none");
    document
      .querySelector("#tool-metadata-search-results-issues-div")
      .classList.remove("set-display-none");
    document
      .querySelector("#tool-metadata-search-results-issue-div")
      .classList.add("set-display-none");
    const searchResultsDiv = document.querySelector(
      "#tool-metadata-search-results-issues-div"
    );
    searchResultsDiv.innerHTML = "";

    g_searchHistory.issues = searchResults;
    g_searchHistory.issue = undefined;

    let button = document.createElement("span");
    button.className = "tools-collection-navigation-back";
    button.addEventListener("click", (event) => {
      document
        .querySelector("#tool-metadata-search-results-div")
        .classList.remove("set-display-none");
      document
        .querySelector("#tool-metadata-search-results-issues-div")
        .classList.add("set-display-none");
      document
        .querySelector("#tool-metadata-search-results-issue-div")
        .classList.add("set-display-none");
    });
    button.innerHTML = `<i class="fas fa-angle-left"></i> BACK`;
    searchResultsDiv.appendChild(button);

    if (
      searchResults &&
      searchResults.error === "OK" &&
      searchResults.results &&
      searchResults.results.issues
    ) {
      // list
      let ul = document.createElement("ul");
      ul.className = "tools-collection-ul";
      searchResults.results.issues.sort((a, b) =>
        parseInt(a.issue_number) > parseInt(b.issue_number)
          ? 1
          : parseInt(b.issue_number) > parseInt(a.issue_number)
          ? -1
          : 0
      );
      for (
        let index = 0;
        index < searchResults.results.issues.length;
        index++
      ) {
        const data = searchResults.results.issues[index];
        let li = document.createElement("li");
        li.className = "tools-collection-li";
        // text
        let multilineText = document.createElement("span");
        multilineText.className = "tools-collection-li-multiline-text";
        {
          let text = document.createElement("span");
          text.innerText = `${data.issue_number}`;
          if (data.name) text.innerText += ` - ${data.name}`;
          multilineText.appendChild(text);
        }
        li.appendChild(multilineText);

        // open issue data
        let button = document.createElement("span");
        button.title = g_localizedModalTexts.searchResultsShowMetadata;
        button.className =
          "tools-collection-li-button tools-collection-li-button-extra-padding";
        button.addEventListener("click", (event) => {
          showProgressModal();
          updateModalTitleText(g_localizedModalTexts.searchingTitle);
          sendIpcToMain("get-issue-data", data.api_detail_url);
        });
        button.innerHTML = `<i class="fas fa-angle-right"></i>`;
        li.appendChild(button);

        ul.appendChild(li);
      }
      searchResultsDiv.appendChild(ul);
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
  });

  on("search-issue-results", (searchResults, localizedImportButtonText) => {
    document
      .querySelector("#tool-metadata-search-results-div")
      .classList.add("set-display-none");
    document
      .querySelector("#tool-metadata-search-results-issues-div")
      .classList.add("set-display-none");
    document
      .querySelector("#tool-metadata-search-results-issue-div")
      .classList.remove("set-display-none");
    const searchResultsDiv = document.querySelector(
      "#tool-metadata-search-results-issue-div"
    );
    searchResultsDiv.innerHTML = "";

    g_searchHistory.issue = searchResults;

    let button = document.createElement("span");
    button.className = "tools-collection-navigation-back";
    button.addEventListener("click", (event) => {
      document
        .querySelector("#tool-metadata-search-results-div")
        .classList.add("set-display-none");
      document
        .querySelector("#tool-metadata-search-results-issues-div")
        .classList.remove("set-display-none");
      document
        .querySelector("#tool-metadata-search-results-issue-div")
        .classList.add("set-display-none");
    });
    button.innerHTML = `<i class="fas fa-angle-left"></i> BACK`;
    searchResultsDiv.appendChild(button);

    if (
      searchResults &&
      searchResults.error === "OK" &&
      searchResults.results
    ) {
      // list
      let ul = document.createElement("ul");
      ul.className = "tools-collection-ul";
      const data = searchResults.results;
      let button = document.createElement("button");
      let text = document.createElement("span");
      text.innerText = localizedImportButtonText;
      button.className = "tools-disabled";
      button.appendChild(text);
      searchResultsDiv.appendChild(button);
      // ref: https://comicvine.gamespot.com/api/documentation#toc-0-10
      /////////////////////////////////
      let addLine = (ul, title, text, sanitize) => {
        try {
          let li = document.createElement("li");
          li.className = "tools-collection-li";
          // checkbox
          let checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = true;
          li.appendChild(checkbox);
          // text
          let multilineText = document.createElement("span");
          multilineText.className =
            "tools-collection-li-multiline-text tools-collection-selectable";
          let textSpan = document.createElement("span");
          textSpan.innerText = title + ":";
          multilineText.appendChild(textSpan);
          let sanitizedText = text;
          textSpan = document.createElement("span");
          if (!sanitize) {
            textSpan.innerText = text;
          } else {
            textSpan.innerHTML = text;
            for (
              let i = 0,
                elems = textSpan.getElementsByTagName("*"),
                len = elems.length;
              i < len;
              i++
            ) {
              elems[i].removeAttribute("style");
            }
            textSpan.textContent = textSpan.innerHTML;
            sanitizedText = textSpan.textContent;
          }
          multilineText.appendChild(textSpan);
          li.appendChild(multilineText);
          ul.appendChild(li);
          return { checkbox: checkbox, text: sanitizedText };
        } catch (error) {
          // console.log(error);
          return undefined;
        }
      };
      /////////////////////////////////
      g_subTool.onIssueSearchResults(
        g_searchHistory,
        button,
        ul,
        data,
        addLine
      );
      searchResultsDiv.appendChild(ul);
    } else {
      let ul = document.createElement("ul");
      ul.className = "tools-collection-ul";
      let li = document.createElement("li");
      li.className = "tools-collection-li";
      let text = document.createElement("span");
      text.innerText = localizedImportButtonText;
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
  });

  ///////////////////////////////////////////

  on("set-api-key-file", (filePath, saveAsRelative) => {
    g_apiKeyFilePathCheckbox.checked = saveAsRelative;
    g_apiKeyFilePathUl.innerHTML = "";
    let li = document.createElement("li");
    li.className = "tools-collection-li";
    // text
    let text = document.createElement("span");
    if (filePath && filePath !== "") text.innerText = reduceString(filePath);
    else text.innerHTML = "&nbsp;";
    li.appendChild(text);
    g_apiKeyFilePathUl.appendChild(li);
  });
}

///////////////////////////////////////////////////////////////////////////////
// COMICS VINE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onSearch(pageNum = 1, inputValue = undefined) {
  if (!inputValue) inputValue = g_searchInput.value;
  if (g_openModal) return;
  showProgressModal();
  updateModalTitleText(g_localizedModalTexts.searchingTitle);
  sendIpcToMain("search", inputValue, pageNum);
}

//////////////////////////////////////

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

//////////////////////////////////////

function reduceString(input) {
  if (!input) return undefined;
  let length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

function reduceStringBack(input) {
  if (!input) return undefined;
  let length = 80;
  input = input.length > length ? input.substring(0, length) + "..." : input;
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
  g_subTool.onContextMenu(params);
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

export function closeModal() {
  if (g_openModal) {
    modals.close(g_openModal);
    modalClosed();
  }
}

function modalClosed() {
  g_openModal = undefined;
}

export function showProgressModal() {
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

export function showInfoModal(
  title,
  message,
  textButton1,
  textButton2,
  callbackButton1,
  callbackButton2
) {
  if (g_openModal) {
    return;
  }
  let buttons = [];
  if (textButton1) {
    buttons.push({
      text: textButton1,
      callback: () => {
        if (callbackButton1) callbackButton1();
        modalClosed();
      },
    });
  }
  if (textButton2) {
    buttons.push({
      text: textButton2,
      callback: () => {
        if (callbackButton2) callbackButton2();
        modalClosed();
      },
    });
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        if (callbackButton1) callbackButton1();
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

export function updateModalTitleText(text) {
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
