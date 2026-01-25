/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { FileDataType } from "../../../shared/renderer/constants.js";
import * as base from "../renderer.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_localizedModalTexts;
let g_localizedPageTypes;
let g_localizedPageTableHeaders;

let g_saveButton;

let g_pagesTable;
let g_data;
let g_hasInfo;
let g_isEditable;
let g_fileData;
let g_canEditRars;
let g_fields = [];

let g_langSelect;

export function init(fileData, isoLanguages, canEditRars) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  g_fileData = fileData;
  g_hasInfo = g_fileData.metadata.comicInfoId !== undefined;
  g_canEditRars = canEditRars;
  g_isEditable =
    (g_canEditRars || g_fileData.type !== FileDataType.RAR) &&
    !g_fileData.metadata.encrypted;

  g_saveButton = document.getElementById("tool-metadata-save-button");
  ////////////////////////////////////////
  g_langSelect = document.getElementById(
    "tool-metadata-data-languageiso-select",
  );
  g_langSelect.innerHTML += `<option value="default"></option>`;
  isoLanguages.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
  isoLanguages.forEach((lang, i) => {
    g_langSelect.innerHTML += `<option value="${lang.code}">${lang.name} (${lang.nativeName})</option>`;
  });

  g_pagesTable = document.getElementById("tool-metadata-pages-data-table");
  buildPagesTableFromData(undefined);

  document
    .getElementById("tool-metadata-update-pages-button")
    .addEventListener("click", (event) => {
      onUpdatePages();
    });

  if (g_fileData.type === FileDataType.RAR && !g_canEditRars) {
    document
      .getElementById("tool-metadata-update-pages-button")
      .classList.add("tools-disabled");
    document
      .getElementById("tool-metadata-cbr-no-edit-rar-div")
      .classList.remove("set-display-none");
  }
  if (g_fileData.metadata.encrypted) {
    document
      .getElementById("tool-metadata-update-pages-button")
      .classList.add("tools-disabled");
    document
      .getElementById("tool-metadata-cbr-no-edit-encrypted-div")
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
        if (element.id !== "tool-metadata-search-input") {
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
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function onFieldChanged(element) {
  element.setAttribute("data-changed", true);
  if (g_isEditable) g_saveButton.classList.remove("tools-disabled");
}

export function onLoadMetadata(data, error) {
  g_data = data;

  // fill UI with json data
  for (let index = 0; index < g_fields.length; index++) {
    const field = g_fields[index];
    if (!field.xmlId || !field.xmlType) continue;
    let value = data["ComicInfo"][field.xmlId];
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

  buildPagesTableFromData(g_data);

  //////////////////////////////////

  base.closeModal();
  if (error) {
    base.showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_localizedModalTexts.loadingMessageErrorInvalid,
      g_localizedModalTexts.okButton,
    );
  }
}

//////////////////////////////////////////////

export async function onSave() {
  if (base.getOpenModal()) base.closeModal();
  base.showInfoModal(
    g_localizedModalTexts.warningTitle,
    g_hasInfo
      ? g_localizedModalTexts.savingMessageUpdate
      : g_localizedModalTexts.savingMessageCreate,
    g_localizedModalTexts.okButton,
    g_localizedModalTexts.cancelButton,
    () => {
      base.showProgressModal();
      base.updateModalTitleText(g_localizedModalTexts.savingTitle);
      /////////////////////////////////
      for (let index = 0; index < g_fields.length; index++) {
        const field = g_fields[index];
        if (!field.element.getAttribute("data-changed")) continue;
        let value = field.element.value;
        if (field.element.tagName.toLowerCase() === "select") {
          if (value === "default") value = "";
        }
        g_data["ComicInfo"][field.xmlId] = value;
      }
      // pages already updated, they are updated on input events
      /////////////////////////////////
      base.sendIpcToMain("save-metadata-to-file", g_data);
    },
  );
}

export function onSavingDone(error) {
  if (!error) {
    base.showInfoModal(
      g_localizedModalTexts.successTitle,
      g_hasInfo
        ? g_localizedModalTexts.savingMessageSuccessUpdate
        : g_localizedModalTexts.savingMessageSuccessCreate,
      g_localizedModalTexts.okButton,
    );
    g_hasInfo = true;
  } else {
    base.showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_hasInfo
        ? g_localizedModalTexts.savingMessageErrorUpdate
        : g_localizedModalTexts.savingMessageErrorCreate,
      g_localizedModalTexts.okButton,
    );
  }
}

//////////////////////////////////////////////

export function onContextMenu(params) {
  base.sendIpcToMain("show-context-menu", params, g_isEditable);
}

export function onIssueSearchResults(
  searchHistory,
  importButton,
  ul,
  data,
  addLine,
) {
  if (g_isEditable) {
    importButton.classList.remove("tools-disabled");
  }

  let compiledData = {};
  if (data.name) {
    compiledData.title = addLine(
      ul,
      document.getElementById("tool-metadata-data-title-text").textContent,
      data.name,
    );
  }
  if (data?.volume?.name) {
    compiledData.series = addLine(
      ul,
      document.getElementById("tool-metadata-data-series-text").textContent,
      data.volume.name,
    );
  }
  if (data.issue_number) {
    compiledData.number = addLine(
      ul,
      document.getElementById("tool-metadata-data-number-text").textContent,
      data.issue_number,
    );
  }
  if (data.cover_date) {
    let numbers = data.cover_date.split("-");
    if (numbers.length > 0)
      compiledData.year = addLine(
        ul,
        document.getElementById("tool-metadata-data-year-text").textContent,
        numbers[0],
      );
    if (numbers.length > 1)
      compiledData.month = addLine(
        ul,
        document.getElementById("tool-metadata-data-month-text").textContent,
        numbers[1],
      );
    if (numbers.length > 2)
      compiledData.day = addLine(
        ul,
        document.getElementById("tool-metadata-data-day-text").textContent,
        numbers[2],
      );
  }
  if (
    searchHistory.issues.results.publisher &&
    searchHistory.issues.results.publisher.name
  ) {
    compiledData.publisher = addLine(
      ul,
      document.getElementById("tool-metadata-data-publisher-text").textContent,
      searchHistory.issues.results.publisher.name,
    );
  }
  if (searchHistory.issues.results.count_of_issues) {
    compiledData.totalNumber = addLine(
      ul,
      document.getElementById("tool-metadata-data-count-text").textContent,
      searchHistory.issues.results.count_of_issues,
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
            `tool-metadata-data-${
              roles[i].altName !== undefined ? roles[i].altName : roles[i].name
            }-text`,
          ).textContent,
          roles[i].list,
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
        document.getElementById("tool-metadata-data-storyarc-text").textContent,
        arcs,
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
        document.getElementById("tool-metadata-data-locations-text")
          .textContent,
        locations,
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
        document.getElementById("tool-metadata-data-characters-text")
          .textContent,
        characters,
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
        document.getElementById("tool-metadata-data-teams-text").textContent,
        teams,
      );
  }
  // TODO:
  //aliases 	List of aliases the issue is known by. A \n (newline) seperates each alias.
  if (data.description) {
    compiledData.summary = addLine(
      ul,
      document.getElementById("tool-metadata-data-summary-text").textContent,
      data.description,
      true,
    );
  }

  /////////////////////////////////////////

  importButton.addEventListener("click", (event) => {
    if (base.getOpenModal()) return;
    onImportSearchResults(compiledData);
  });
}

function onImportSearchResults(compiledData) {
  base.showInfoModal(
    g_localizedModalTexts.warningTitle,
    g_localizedModalTexts.importingMessage,
    g_localizedModalTexts.okButton,
    g_localizedModalTexts.cancelButton,
    () => {
      if (compiledData.title && compiledData.title.checkbox.checked) {
        let element = document.getElementById("tool-metadata-data-title-input");
        element.value = compiledData.title.text;
        onFieldChanged(element);
      }
      if (compiledData.series && compiledData.series.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-series-input",
        );
        element.value = compiledData.series.text;
        onFieldChanged(element);
      }
      if (compiledData.year && compiledData.year.checkbox.checked) {
        let element = document.getElementById("tool-metadata-data-year-input");
        element.value = compiledData.year.text;
        onFieldChanged(element);
      }
      if (compiledData.month && compiledData.month.checkbox.checked) {
        let element = document.getElementById("tool-metadata-data-month-input");
        element.value = compiledData.month.text;
        onFieldChanged(element);
      }
      if (compiledData.day && compiledData.day.checkbox.checked) {
        let element = document.getElementById("tool-metadata-data-day-input");
        element.value = compiledData.day.text;
        onFieldChanged(element);
      }
      if (compiledData.publisher && compiledData.publisher.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-publisher-input",
        );
        element.value = compiledData.publisher.text;
        onFieldChanged(element);
      }
      if (compiledData.number && compiledData.number.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-number-input",
        );
        element.value = compiledData.number.text;
        onFieldChanged(element);
      }
      if (
        compiledData.totalNumber &&
        compiledData.totalNumber.checkbox.checked
      ) {
        let element = document.getElementById("tool-metadata-data-count-input");
        element.value = compiledData.totalNumber.text;
        onFieldChanged(element);
      }
      if (
        compiledData["penciler"] &&
        compiledData["penciler"].checkbox.checked
      ) {
        let element = document.getElementById(
          "tool-metadata-data-penciller-input",
        );
        element.value = compiledData["penciler"].text;
        onFieldChanged(element);
      }
      if (compiledData["inker"] && compiledData["inker"].checkbox.checked) {
        let element = document.getElementById("tool-metadata-data-inker-input");
        element.value = compiledData["inker"].text;
        onFieldChanged(element);
      }
      if (
        compiledData["colorist"] &&
        compiledData["colorist"].checkbox.checked
      ) {
        let element = document.getElementById(
          "tool-metadata-data-colorist-input",
        );
        element.value = compiledData["colorist"].text;
        onFieldChanged(element);
      }
      if (
        compiledData["letterer"] &&
        compiledData["letterer"].checkbox.checked
      ) {
        let element = document.getElementById(
          "tool-metadata-data-letterer-input",
        );
        element.value = compiledData["letterer"].text;
        onFieldChanged(element);
      }
      if (compiledData["writer"] && compiledData["writer"].checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-writer-input",
        );
        element.value = compiledData["writer"].text;
        onFieldChanged(element);
      }
      if (compiledData["cover"] && compiledData["cover"].checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-coverartist-input",
        );
        element.value = compiledData["cover"].text;
        onFieldChanged(element);
      }
      if (compiledData["editor"] && compiledData["editor"].checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-editor-input",
        );
        element.value = compiledData["editor"].text;
        onFieldChanged(element);
      }
      if (compiledData.storyArc && compiledData.storyArc.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-storyarc-input",
        );
        element.value = compiledData.storyArc.text;
        onFieldChanged(element);
      }
      if (compiledData.locations && compiledData.locations.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-locations-input",
        );
        element.value = compiledData.locations.text;
        onFieldChanged(element);
      }
      if (compiledData.characters && compiledData.characters.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-characters-input",
        );
        element.value = compiledData.characters.text;
        onFieldChanged(element);
      }
      if (compiledData.teams && compiledData.teams.checkbox.checked) {
        let element = document.getElementById("tool-metadata-data-teams-input");
        element.value = compiledData.teams.text;
        onFieldChanged(element);
      }
      if (compiledData.summary && compiledData.summary.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-summary-textarea",
        );
        element.value = compiledData.summary.text;
        onFieldChanged(element);
      }

      base.switchSection(2);
    },
  );
}

//////////////////////////////////////////////

function onUpdatePages() {
  if (base.getOpenModal()) base.closeModal();
  base.showProgressModal();
  base.updateModalTitleText(g_localizedModalTexts.updatingTitle);
  base.sendIpcToMain("update-pages", g_data);
}

export function onPagesUpdated(data) {
  if (data) {
    g_data = data;
    document.getElementById("tool-metadata-data-pagecount-input").value =
      data["ComicInfo"]["Pages"]["Page"].length;
    onFieldChanged(
      document.getElementById("tool-metadata-data-pagecount-input"),
    );
    buildPagesTableFromData(data);
    if (g_isEditable) g_saveButton.classList.remove("tools-disabled");
    base.updateColumnsHeight();
    base.closeModal();
  } else {
    // TODO: show error
    base.closeModal();
  }
}

function buildPagesTableFromData(data) {
  if (!g_isEditable) g_pagesTable.classList.add("tools-read-only");
  if (
    data &&
    data["ComicInfo"]["Pages"] &&
    data["ComicInfo"]["Pages"]["Page"]
  ) {
    g_pagesTable.innerHTML = "";
    g_pagesTable.appendChild(generateTableHeader());
    let pages = data["ComicInfo"]["Pages"]["Page"];
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
            pageData["@_Type"],
          ),
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
      g_data["ComicInfo"]["Pages"]["Page"][index]["@_DoublePage"] =
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
      g_data["ComicInfo"]["Pages"]["Page"][index]["@_Type"] =
        select.value === "default" ? "" : select.value;
      onFieldChanged(select);
    });
  }
  tr.appendChild(td);
  return tr;
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function updateLocalization(localizedModalTexts, localizedSubTool) {
  g_localizedModalTexts = localizedModalTexts;
  g_localizedPageTypes = localizedSubTool[0];
  g_localizedPageTableHeaders = localizedSubTool[1];
}
