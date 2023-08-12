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
let g_json;
let g_fields = [];

function init(fileData, isoLangNames, isoLangCodes) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  g_fileData = fileData;
  g_hasInfo = g_fileData.metadata.comicInfoId !== undefined;
  g_isEditable =
    g_fileData.type !== FileDataType.RAR && !g_fileData.metadata.encrypted;
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
  for (let index = 0; index < 4; index++) {
    document
      .getElementById(`tool-cix-section-${index}-button`)
      .addEventListener("click", (event) => {
        switchSection(index);
      });
  }
  ////////////////////////////////////////
  g_langSelect = document.getElementById("tool-cix-data-languageiso-select");
  g_langSelect.innerHTML += `<option value="default"></option>`;
  isoLangNames.forEach((name, i) => {
    g_langSelect.innerHTML += `<option value="${isoLangCodes[i]}">${name}</option>`;
  });

  g_pagesTable = document.getElementById("tool-cix-pages-data-table");
  buildPagesTableFromJson(undefined);

  document
    .getElementById("tool-cix-update-pages-button")
    .addEventListener("click", (event) => {
      onUpdatePages();
    });

  if (g_fileData.type === "rar") {
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
      element.classList.add("tools-read-only");
      const tagName = element.tagName.toLowerCase();
      if (tagName === "textarea" || tagName === "input") {
        element.readOnly = true;
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

function updateColumnsHeight() {
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
}

function switchSection(id) {
  for (let index = 0; index < 4; index++) {
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
  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
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
  on("show", (fileData, isoLangNames, isoLangCodes) => {
    init(fileData, isoLangNames, isoLangCodes);
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
        if (domElement !== null) {
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
  // TODO: show warning ok cancel and do the following in the callback
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
        console.log(field.element.id);
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
      console.log(g_json["ComicInfo"]["Pages"]["Page"][index]["@_DoublePage"]);
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
      console.log(g_json["ComicInfo"]["Pages"]["Page"][index]["@_Type"]);
    });
  }
  tr.appendChild(td);
  return tr;
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
  // TODO: use isError to color button red or green?
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
