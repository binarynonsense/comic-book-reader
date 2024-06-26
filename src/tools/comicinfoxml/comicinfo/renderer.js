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
  // sections menu
  for (let index = 2; index < 6; index++) {
    document
      .getElementById(`tool-metadata-section-${index}-button`)
      .addEventListener("click", (event) => {
        base.switchSection(index);
      });
  }
  ////////////////////////////////////////
  g_langSelect = document.getElementById(
    "tool-metadata-data-languageiso-select"
  );
  g_langSelect.innerHTML += `<option value="default"></option>`;
  isoLanguages.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
  isoLanguages.forEach((lang, i) => {
    g_langSelect.innerHTML += `<option value="${lang.code}">${lang.name} (${lang.nativeName})</option>`;
  });

  g_pagesTable = document.getElementById("tool-metadata-pages-data-table");
  buildPagesTableFromJson(undefined);

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

export function onLoadMetadata(json, error) {
  g_data = json;

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

  buildPagesTableFromJson(g_data);

  //////////////////////////////////

  base.closeModal();
  if (error) {
    showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_localizedModalTexts.loadingMessageErrorInvalid,
      g_localizedModalTexts.okButton
    );
  }
}

function onUpdatePages() {
  if (base.getOpenModal()) base.closeModal();
  base.showProgressModal();
  base.updateModalTitleText(g_localizedModalTexts.updatingTitle);
  base.sendIpcToMain("update-pages", g_data);
}

export function onPagesUpdated(json) {
  if (json) {
    g_data = json;
    document.getElementById("tool-metadata-data-pagecount-input").value =
      json["ComicInfo"]["Pages"]["Page"].length;
    onFieldChanged(
      document.getElementById("tool-metadata-data-pagecount-input")
    );
    buildPagesTableFromJson(json);
    if (g_isEditable) g_saveButton.classList.remove("tools-disabled");
    base.updateColumnsHeight();
    base.closeModal();
  } else {
    // TODO: show error
    base.closeModal();
  }
}

async function onSave() {
  if (base.getOpenModal()) base.closeModal();
  showInfoModal(
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
      base.sendIpcToMain("save-json-to-file", g_data);
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
