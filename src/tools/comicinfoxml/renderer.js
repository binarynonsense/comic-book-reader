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
import { FileDataType } from "../../shared/renderer/constants.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_localizedModalTexts;
let g_localizedPageTypes;
let g_localizedPageTableHeaders;

let g_saveButton;
let g_langSelect;
let g_pagesTable;

let g_hasInfo;
let g_isEditable;
let g_fileData;
let g_canEditRars;
let g_json;
let g_fields = [];

let g_searchInput;
let g_searchButton;
let g_searchHistory;
let g_apiKeyFilePathUl;
let g_apiKeyFilePathCheckbox;

function init(fileData, isoLanguages, canEditRars) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });

  g_fileData = fileData;
  g_hasInfo = g_fileData.metadata.comicInfoId !== undefined;
  g_canEditRars = canEditRars;
  g_isEditable =
    (g_canEditRars || g_fileData.type !== FileDataType.RAR) &&
    !g_fileData.metadata.encrypted;
  // menu buttons
  document
    .getElementById("tool-cix-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  g_saveButton = document.getElementById("tool-cix-save-button");
  g_saveButton.addEventListener("click", (event) => {
    onSave();
  });
  g_saveButton.classList.add("tools-disabled");
  // sections menu
  for (let index = 0; index < 6; index++) {
    document
      .getElementById(`tool-cix-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  g_langSelect = document.getElementById("tool-cix-data-languageiso-select");
  g_langSelect.innerHTML += `<option value="default"></option>`;
  isoLanguages.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
  isoLanguages.forEach((lang, i) => {
    g_langSelect.innerHTML += `<option value="${lang.code}">${lang.name} (${lang.nativeName})</option>`;
  });

  g_pagesTable = document.getElementById("tool-cix-pages-data-table");
  buildPagesTableFromJson(undefined);

  document
    .getElementById("tool-cix-update-pages-button")
    .addEventListener("click", (event) => {
      onUpdatePages();
    });

  if (g_fileData.type === FileDataType.RAR && !g_canEditRars) {
    document
      .getElementById("tool-cix-update-pages-button")
      .classList.add("tools-disabled");
    document
      .getElementById("tool-cix-cbr-no-edit-rar-div")
      .classList.remove("set-display-none");
  }
  if (g_fileData.metadata.encrypted) {
    document
      .getElementById("tool-cix-update-pages-button")
      .classList.add("tools-disabled");
    document
      .getElementById("tool-cix-cbr-no-edit-encrypted-div")
      .classList.remove("set-display-none");
  }
  ////////////////////////////////////////
  // generate fields array
  let elements = document
    .querySelector("#tools-columns-right")
    .getElementsByTagName("input");
  elements = [
    ...elements,
    ...document
      .querySelector("#tools-columns-right")
      .getElementsByTagName("select"),
  ];
  elements = [
    ...elements,
    ...document
      .querySelector("#tools-columns-right")
      .getElementsByTagName("textarea"),
  ];
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index];
    if (!g_isEditable) {
      const tagName = element.tagName.toLowerCase();
      if (tagName === "textarea" || tagName === "input") {
        if (element.id !== "tool-cix-search-input") {
          element.readOnly = true;
        }
      } else {
        element.classList.add("tools-read-only");
      }
    }
    g_fields.push({
      element: element,
      xmlId: element.getAttribute("data-xml-id"),
      xmlType: element.getAttribute("data-xml-type"),
    });
  }
  // add event listeners
  g_fields.forEach((field) => {
    if (field.xmlId) {
      if (
        field.element.tagName.toLowerCase() === "input" ||
        field.element.tagName.toLowerCase() === "textarea"
      )
        field.element.addEventListener("input", (event) => {
          onFieldChanged(field.element);
        });
      else if (field.element.tagName.toLowerCase() === "select")
        field.element.addEventListener("change", (event) => {
          onFieldChanged(field.element);
        });
    }
  });
  ////////////////////////////////////////
  // search
  g_searchButton = document.getElementById("tool-cix-search-button");
  g_searchButton.addEventListener("click", (event) => {
    onSearch();
  });

  g_searchInput = document.getElementById("tool-cix-search-input");
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
        .getElementById("tool-cix-section-4-content-div")
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
    "tool-cix-comicvine-api-key-file-ul"
  );
  g_apiKeyFilePathCheckbox = document.getElementById(
    "tool-cix-comicvine-api-key-checkbox"
  );
  document
    .getElementById("tool-cix-comicvine-api-key-file-change-button")
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
  if (!g_openModal) closeModal(g_openModal);
  showProgressModal();
  updateModalTitleText(g_localizedModalTexts.loadingTitle);
  sendIpcToMain("load-xml");
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
  for (let index = 0; index < 6; index++) {
    if (id === index) {
      document
        .getElementById(`tool-cix-section-${index}-button`)
        .classList.add("tools-menu-button-selected");
      document
        .getElementById(`tool-cix-section-${index}-content-div`)
        .classList.remove("set-display-none");
    } else {
      document
        .getElementById(`tool-cix-section-${index}-button`)
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById(`tool-cix-section-${index}-content-div`)
        .classList.add("set-display-none");
    }
  }
  updateColumnsHeight(true);
  if (id === 4) {
    g_searchInput.focus();
  }
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-comicinfoxml", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-comicinfoxml", ...args);
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

  on(
    "update-localization",
    (
      localizedModalTexts,
      localizedPageTypes,
      localizedPageTableHeaders,
      localization,
      tooltipsLocalization
    ) => {
      g_localizedModalTexts = localizedModalTexts;
      g_localizedPageTypes = localizedPageTypes;
      g_localizedPageTableHeaders = localizedPageTableHeaders;
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

  on("load-json", (json, error) => {
    onLoadJson(json, error);
  });

  on("pages-updated", (json) => {
    onPagesUpdated(json);
  });

  on("saving-done", (error) => {
    closeModal();
    if (!error) {
      showInfoModal(
        g_localizedModalTexts.successTitle,
        g_hasInfo
          ? g_localizedModalTexts.savingMessageSuccessUpdate
          : g_localizedModalTexts.savingMessageSuccessCreate,
        g_localizedModalTexts.okButton
      );
      g_hasInfo = true;
    } else {
      showInfoModal(
        g_localizedModalTexts.errorTitle,
        g_hasInfo
          ? g_localizedModalTexts.savingMessageErrorUpdate
          : g_localizedModalTexts.savingMessageErrorCreate,
        g_localizedModalTexts.okButton
      );
    }
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
        .querySelector("#tool-cix-search-results-div")
        .classList.remove("set-display-none");
      document
        .querySelector("#tool-cix-search-results-issues-div")
        .classList.add("set-display-none");
      document
        .querySelector("#tool-cix-search-results-issue-div")
        .classList.add("set-display-none");
      const searchResultsDiv = document.querySelector(
        "#tool-cix-search-results-div"
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
      .querySelector("#tool-cix-search-results-div")
      .classList.add("set-display-none");
    document
      .querySelector("#tool-cix-search-results-issues-div")
      .classList.remove("set-display-none");
    document
      .querySelector("#tool-cix-search-results-issue-div")
      .classList.add("set-display-none");
    const searchResultsDiv = document.querySelector(
      "#tool-cix-search-results-issues-div"
    );
    searchResultsDiv.innerHTML = "";

    g_searchHistory.issues = searchResults;
    g_searchHistory.issue = undefined;

    let button = document.createElement("span");
    button.className = "tools-collection-navigation-back";
    button.addEventListener("click", (event) => {
      document
        .querySelector("#tool-cix-search-results-div")
        .classList.remove("set-display-none");
      document
        .querySelector("#tool-cix-search-results-issues-div")
        .classList.add("set-display-none");
      document
        .querySelector("#tool-cix-search-results-issue-div")
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
      .querySelector("#tool-cix-search-results-div")
      .classList.add("set-display-none");
    document
      .querySelector("#tool-cix-search-results-issues-div")
      .classList.add("set-display-none");
    document
      .querySelector("#tool-cix-search-results-issue-div")
      .classList.remove("set-display-none");
    const searchResultsDiv = document.querySelector(
      "#tool-cix-search-results-issue-div"
    );
    searchResultsDiv.innerHTML = "";

    g_searchHistory.issue = searchResults;

    let button = document.createElement("span");
    button.className = "tools-collection-navigation-back";
    button.addEventListener("click", (event) => {
      document
        .querySelector("#tool-cix-search-results-div")
        .classList.add("set-display-none");
      document
        .querySelector("#tool-cix-search-results-issues-div")
        .classList.remove("set-display-none");
      document
        .querySelector("#tool-cix-search-results-issue-div")
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
      if (!g_isEditable) {
        button.className = "tools-disabled";
      }
      button.appendChild(text);
      searchResultsDiv.appendChild(button);
      // ref: https://comicvine.gamespot.com/api/documentation#toc-0-10
      /////////////////////////////////
      let addLine = (ul, title, text, sanitize) => {
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
      };
      /////////////////////////////////
      let compiledData = {};
      if (data.name) {
        compiledData.title = addLine(
          ul,
          document.getElementById("tool-cix-data-title-text").textContent,
          data.name
        );
      }
      if (data?.volume?.name) {
        compiledData.series = addLine(
          ul,
          document.getElementById("tool-cix-data-series-text").textContent,
          data.volume.name
        );
      }
      if (data.cover_date) {
        let numbers = data.cover_date.split("-");
        if (numbers.length > 0)
          compiledData.year = addLine(
            ul,
            document.getElementById("tool-cix-data-year-text").textContent,
            numbers[0]
          );
        if (numbers.length > 1)
          compiledData.month = addLine(
            ul,
            document.getElementById("tool-cix-data-month-text").textContent,
            numbers[1]
          );
        if (numbers.length > 2)
          compiledData.day = addLine(
            ul,
            document.getElementById("tool-cix-data-day-text").textContent,
            numbers[2]
          );
      }
      if (
        g_searchHistory.issues.results.publisher &&
        g_searchHistory.issues.results.publisher.name
      ) {
        compiledData.publisher = addLine(
          ul,
          document.getElementById("tool-cix-data-publisher-text").textContent,
          g_searchHistory.issues.results.publisher.name
        );
      }
      if (data.issue_number) {
        compiledData.number = addLine(
          ul,
          document.getElementById("tool-cix-data-number-text").textContent,
          data.issue_number
        );
      }
      if (g_searchHistory.issues.results.count_of_issues) {
        compiledData.totalNumber = addLine(
          ul,
          document.getElementById("tool-cix-data-count-text").textContent,
          g_searchHistory.issues.results.count_of_issues
        );
      }
      if (data.person_credits) {
        let roles = [
          { name: "artist", list: "" },
          { name: "penciler", altName: "penciller", list: "" },
          { name: "inker", list: "" },
          { name: "colorist", list: "" },
          { name: "letterer", list: "" },
          { name: "writer", list: "" },
          { name: "cover", altName: "coverartist", list: "" },
          { name: "editor", list: "" },
        ];
        for (let i = 0; i < roles.length; i++) {
          for (let j = 0; j < data.person_credits.length; j++) {
            const creator = data.person_credits[j];
            if (creator.role.toLowerCase().includes(roles[i].name)) {
              if (roles[i].list !== "") {
                roles[i].list += ", ";
              }
              roles[i].list += creator.name;
            }
          }
        }
        if (roles[0].list !== "") {
          if (roles[1].list !== "") {
            roles[1].list += ", ";
          }
          roles[1].list += roles[0].list;
          if (roles[2].list !== "") {
            roles[2].list += ", ";
          }
          roles[2].list += roles[0].list;
        }
        for (let i = 1; i < roles.length; i++) {
          if (roles[i].list !== "") {
            compiledData[roles[i].name] = addLine(
              ul,
              document.getElementById(
                `tool-cix-data-${
                  roles[i].altName !== undefined
                    ? roles[i].altName
                    : roles[i].name
                }-text`
              ).textContent,
              roles[i].list
            );
          }
        }
      }
      if (data.story_arc_credits) {
        let arcs = "";
        for (let index = 0; index < data.story_arc_credits.length; index++) {
          arcs += data.story_arc_credits[index].name;
          if (index < data.story_arc_credits.length - 1) {
            arcs += ", ";
          }
        }
        if (arcs !== "")
          compiledData.storyArc = addLine(
            ul,
            document.getElementById("tool-cix-data-storyarc-text").textContent,
            arcs
          );
      }
      if (data.location_credits) {
        let locations = "";
        for (let index = 0; index < data.location_credits.length; index++) {
          locations += data.location_credits[index].name;
          if (index < data.location_credits.length - 1) {
            locations += ", ";
          }
        }
        if (locations !== "")
          compiledData.locations = addLine(
            ul,
            document.getElementById("tool-cix-data-locations-text").textContent,
            locations
          );
      }
      if (data.character_credits) {
        let characters = "";
        for (let index = 0; index < data.character_credits.length; index++) {
          characters += data.character_credits[index].name;
          if (index < data.character_credits.length - 1) {
            characters += ", ";
          }
        }
        if (characters !== "")
          compiledData.characters = addLine(
            ul,
            document.getElementById("tool-cix-data-characters-text")
              .textContent,
            characters
          );
      }
      if (data.team_credits) {
        let teams = "";
        for (let index = 0; index < data.team_credits.length; index++) {
          teams += data.team_credits[index].name;
          if (index < data.team_credits.length - 1) {
            teams += ", ";
          }
        }
        if (teams !== "")
          compiledData.teams = addLine(
            ul,
            document.getElementById("tool-cix-data-teams-text").textContent,
            teams
          );
      }
      // TODO:
      //aliases 	List of aliases the issue is known by. A \n (newline) seperates each alias.
      if (data.description) {
        compiledData.summary = addLine(
          ul,
          document.getElementById("tool-cix-data-summary-text").textContent,
          data.description,
          true
        );
      }
      searchResultsDiv.appendChild(ul);

      button.addEventListener("click", (event) => {
        if (g_openModal) return;
        showInfoModal(
          g_localizedModalTexts.warningTitle,
          g_localizedModalTexts.importingMessage,
          g_localizedModalTexts.okButton,
          g_localizedModalTexts.cancelButton,
          () => {
            // showProgressModal();
            // updateModalTitleText(g_localizedModalTexts.importingTitle);
            /////////////////////////////////
            if (compiledData.title && compiledData.title.checkbox.checked) {
              let element = document.getElementById(
                "tool-cix-data-title-input"
              );
              element.value = compiledData.title.text;
              onFieldChanged(element);
            }
            if (compiledData.series && compiledData.series.checkbox.checked) {
              let element = document.getElementById(
                "tool-cix-data-series-input"
              );
              element.value = compiledData.series.text;
              onFieldChanged(element);
            }
            if (compiledData.year && compiledData.year.checkbox.checked) {
              let element = document.getElementById("tool-cix-data-year-input");
              element.value = compiledData.year.text;
              onFieldChanged(element);
            }
            if (compiledData.month && compiledData.month.checkbox.checked) {
              let element = document.getElementById(
                "tool-cix-data-month-input"
              );
              element.value = compiledData.month.text;
              onFieldChanged(element);
            }
            if (compiledData.day && compiledData.day.checkbox.checked) {
              let element = document.getElementById("tool-cix-data-day-input");
              element.value = compiledData.day.text;
              onFieldChanged(element);
            }
            if (
              compiledData.publisher &&
              compiledData.publisher.checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-publisher-input"
              );
              element.value = compiledData.publisher.text;
              onFieldChanged(element);
            }
            if (compiledData.number && compiledData.number.checkbox.checked) {
              let element = document.getElementById(
                "tool-cix-data-number-input"
              );
              element.value = compiledData.number.text;
              onFieldChanged(element);
            }
            if (
              compiledData.totalNumber &&
              compiledData.totalNumber.checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-count-input"
              );
              element.value = compiledData.totalNumber.text;
              onFieldChanged(element);
            }
            if (
              compiledData["penciler"] &&
              compiledData["penciler"].checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-penciller-input"
              );
              element.value = compiledData["penciler"].text;
              onFieldChanged(element);
            }
            if (
              compiledData["inker"] &&
              compiledData["inker"].checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-inker-input"
              );
              element.value = compiledData["inker"].text;
              onFieldChanged(element);
            }
            if (
              compiledData["colorist"] &&
              compiledData["colorist"].checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-colorist-input"
              );
              element.value = compiledData["colorist"].text;
              onFieldChanged(element);
            }
            if (
              compiledData["letterer"] &&
              compiledData["letterer"].checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-letterer-input"
              );
              element.value = compiledData["letterer"].text;
              onFieldChanged(element);
            }
            if (
              compiledData["writer"] &&
              compiledData["writer"].checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-writer-input"
              );
              element.value = compiledData["writer"].text;
              onFieldChanged(element);
            }
            if (
              compiledData["cover"] &&
              compiledData["cover"].checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-coverartist-input"
              );
              element.value = compiledData["cover"].text;
              onFieldChanged(element);
            }
            if (
              compiledData["editor"] &&
              compiledData["editor"].checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-editor-input"
              );
              element.value = compiledData["editor"].text;
              onFieldChanged(element);
            }
            if (
              compiledData.storyArc &&
              compiledData.storyArc.checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-storyarc-input"
              );
              element.value = compiledData.storyArc.text;
              onFieldChanged(element);
            }
            if (
              compiledData.locations &&
              compiledData.locations.checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-locations-input"
              );
              element.value = compiledData.locations.text;
              onFieldChanged(element);
            }
            if (
              compiledData.characters &&
              compiledData.characters.checkbox.checked
            ) {
              let element = document.getElementById(
                "tool-cix-data-characters-input"
              );
              element.value = compiledData.characters.text;
              onFieldChanged(element);
            }
            if (compiledData.teams && compiledData.teams.checkbox.checked) {
              let element = document.getElementById(
                "tool-cix-data-teams-input"
              );
              element.value = compiledData.teams.text;
              onFieldChanged(element);
            }
            if (compiledData.summary && compiledData.summary.checkbox.checked) {
              let element = document.getElementById(
                "tool-cix-data-summary-textarea"
              );
              element.value = compiledData.summary.text;
              onFieldChanged(element);
            }

            switchSection(0);
            /////////////////////////////////
            //closeModal();
          }
        );
      });
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
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function onFieldChanged(element) {
  element.setAttribute("data-changed", true);
  if (g_isEditable) g_saveButton.classList.remove("tools-disabled");
}

function onLoadJson(json, error) {
  g_json = json;

  // fill UI with json data
  for (let index = 0; index < g_fields.length; index++) {
    const field = g_fields[index];
    if (!field.xmlId || !field.xmlType) continue;
    let value = json["ComicInfo"][field.xmlId];
    if (value && value !== "") {
      if (field.xmlType !== "Page") {
        // sanitize
        if (field.element.tagName.toLowerCase() === "select") {
          if (!field.element.querySelector('[value="' + value + '"]')) continue;
        }
        // update element's value
        field.element.value = value;
      }
    }
  }

  buildPagesTableFromJson(g_json);

  //////////////////////////////////

  closeModal();
  if (error) {
    showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_localizedModalTexts.loadingMessageErrorInvalid,
      g_localizedModalTexts.okButton
    );
  }
}

function onUpdatePages() {
  if (g_openModal) closeModal();
  showProgressModal();
  updateModalTitleText(g_localizedModalTexts.updatingTitle);
  sendIpcToMain("update-pages", g_json);
}

function onPagesUpdated(json) {
  if (json) {
    g_json = json;
    document.getElementById("tool-cix-data-pagecount-input").value =
      json["ComicInfo"]["Pages"]["Page"].length;
    onFieldChanged(document.getElementById("tool-cix-data-pagecount-input"));
    buildPagesTableFromJson(json);
    if (g_isEditable) g_saveButton.classList.remove("tools-disabled");
    updateColumnsHeight();
    closeModal();
  } else {
    // TODO: show error
    closeModal();
  }
}

async function onSave() {
  if (g_openModal) closeModal();
  showInfoModal(
    g_localizedModalTexts.warningTitle,
    g_hasInfo
      ? g_localizedModalTexts.savingMessageUpdate
      : g_localizedModalTexts.savingMessageCreate,
    g_localizedModalTexts.okButton,
    g_localizedModalTexts.cancelButton,
    () => {
      showProgressModal();
      updateModalTitleText(g_localizedModalTexts.savingTitle);
      /////////////////////////////////
      for (let index = 0; index < g_fields.length; index++) {
        const field = g_fields[index];
        if (!field.element.getAttribute("data-changed")) continue;
        let value = field.element.value;
        if (field.element.tagName.toLowerCase() === "select") {
          if (value === "default") value = "";
        }
        g_json["ComicInfo"][field.xmlId] = value;
      }
      // pages already updated, they are updated on input events
      /////////////////////////////////
      sendIpcToMain("save-json-to-file", g_json);
    }
  );
}

function buildPagesTableFromJson(json) {
  if (!g_isEditable) g_pagesTable.classList.add("tools-read-only");
  if (
    json &&
    json["ComicInfo"]["Pages"] &&
    json["ComicInfo"]["Pages"]["Page"]
  ) {
    g_pagesTable.innerHTML = "";
    g_pagesTable.appendChild(generateTableHeader());
    let pages = json["ComicInfo"]["Pages"]["Page"];
    for (let index = 0; index < pages.length; index++) {
      const pageData = pages[index];
      if (pageData) {
        // TODO: check info sanitize
        g_pagesTable.appendChild(
          generateTableRow(
            index,
            pageData["@_Image"],
            pageData["@_ImageSize"],
            pageData["@_ImageWidth"],
            pageData["@_ImageHeight"],
            pageData["@_DoublePage"],
            pageData["@_Type"]
          )
        );
      }
    }
  } else {
    g_pagesTable.innerHTML = "";
    g_pagesTable.appendChild(generateTableHeader());
    g_pagesTable.appendChild(generateTableEmptyRow());
  }
}

function generateTableHeader() {
  let tr = document.createElement("tr");
  let th = document.createElement("th");
  th.innerText = g_localizedPageTableHeaders[0];
  tr.appendChild(th);
  th = document.createElement("th");
  th.innerText = g_localizedPageTableHeaders[1];
  tr.appendChild(th);
  th = document.createElement("th");
  th.innerText = g_localizedPageTableHeaders[2];
  tr.appendChild(th);
  th = document.createElement("th");
  th.innerText = g_localizedPageTableHeaders[3];
  tr.appendChild(th);
  th = document.createElement("th");
  th.innerText = g_localizedPageTableHeaders[4];
  tr.appendChild(th);
  th = document.createElement("th");
  th.innerText = g_localizedPageTableHeaders[5];
  tr.appendChild(th);
  return tr;
}

function generateTableEmptyRow() {
  let tr = document.createElement("tr");
  let td = document.createElement("td");
  td.innerText = " ";
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = " ";
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = " ";
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = " ";
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = " ";
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = " ";
  tr.appendChild(td);
  return tr;
}

function generateTableRow(index, id, size, width, height, doublepage, type) {
  let tr = document.createElement("tr");
  let td = document.createElement("td");
  td.innerText = id;
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = size;
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = width;
  tr.appendChild(td);
  td = document.createElement("td");
  td.innerText = height;
  tr.appendChild(td);
  td = document.createElement("td");
  {
    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = doublepage;
    td.appendChild(checkbox);
    checkbox.addEventListener("change", (event) => {
      g_json["ComicInfo"]["Pages"]["Page"][index]["@_DoublePage"] =
        checkbox.checked ? "true" : "false";
      onFieldChanged(checkbox);
    });
  }
  tr.appendChild(td);
  td = document.createElement("td");
  {
    let select = document.createElement("select");
    select.innerHTML = `<option value="default"></option>
<option value="FrontCover"${type === "FrontCover" ? " selected" : ""}>${
      g_localizedPageTypes[0]
    }</option>
<option value="InnerCover"${type === "InnerCover" ? " selected" : ""}>${
      g_localizedPageTypes[1]
    }</option>
<option value="Roundup"${type === "Roundup" ? " selected" : ""}>${
      g_localizedPageTypes[2]
    }</option>
<option value="Story"${type === "Story" ? " selected" : ""}>${
      g_localizedPageTypes[3]
    }</option>
<option value="Advertisement"${type === "Advertisement" ? " selected" : ""}>${
      g_localizedPageTypes[4]
    }</option>
<option value="Editorial"${type === "Editorial" ? " selected" : ""}>${
      g_localizedPageTypes[5]
    }</option>
<option value="Letters"${type === "Letters" ? " selected" : ""}>${
      g_localizedPageTypes[6]
    }</option>
<option value="Preview"${type === "Preview" ? " selected" : ""}>${
      g_localizedPageTypes[7]
    }</option>
<option value="BackCover"${type === "BackCover" ? " selected" : ""}>${
      g_localizedPageTypes[8]
    }</option>
<option value="Other"${type === "Other" ? " selected" : ""}>${
      g_localizedPageTypes[9]
    }</option>
<option value="Deleted"${type === "Deleted" ? " selected" : ""}>${
      g_localizedPageTypes[10]
    }</option>`;
    td.appendChild(select);
    select.addEventListener("change", (event) => {
      g_json["ComicInfo"]["Pages"]["Page"][index]["@_Type"] =
        select.value === "default" ? "" : select.value;
      onFieldChanged(select);
    });
  }
  tr.appendChild(td);
  return tr;
}

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
  sendIpcToMain("show-context-menu", params, g_isEditable);
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

function showProgressModal() {
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

function showInfoModal(
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
