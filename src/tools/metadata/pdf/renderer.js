/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as base from "../renderer.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_localizedModalTexts;
let g_localizedSubTool;
let g_saveButton;
let g_data;

export function init(fileData) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  g_saveButton = document.getElementById("tool-metadata-save-button");
  ////////////////////////////////////////
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onLoadMetadata(metadata, error) {
  g_data = {};
  g_data.originalMetadata = metadata;
  g_data.modifiedMetadata = {};
  // fill UI with data
  const detailsDiv = document.querySelector(
    "#tool-metadata-section-2-content-div"
  );
  const otherDiv = document.querySelector(
    "#tool-metadata-section-3-content-div"
  );
  function addHtml(rootDiv, key, type, value) {
    const label = document.createElement("label");
    rootDiv.appendChild(label);
    const span = document.createElement("span");
    label.appendChild(span);
    let input;
    if (type === "textarea") {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    label.appendChild(input);
    span.innerText = g_localizedSubTool[key];
    input.value = value;
    input.spellcheck = false;
    input.addEventListener("change", (event) => {
      g_saveButton.classList.remove("tools-disabled");
      g_data.modifiedMetadata[key] = input.value;
    });
  }
  addHtml(detailsDiv, "title", "text", g_data.originalMetadata["title"]);
  addHtml(detailsDiv, "author", "text", g_data.originalMetadata["title"]);
  addHtml(
    detailsDiv,
    "subject",
    "textarea",
    g_data.originalMetadata["subject"]
  );
  addHtml(detailsDiv, "keywords", "text", g_data.originalMetadata["keywords"]);

  addHtml(otherDiv, "creator", "text", g_data.originalMetadata["creator"]);
  addHtml(otherDiv, "producer", "text", g_data.originalMetadata["producer"]);
  addHtml(
    otherDiv,
    "creationDate",
    "text",
    g_data.originalMetadata["creationDate"].toISOString()
  );
  addHtml(
    otherDiv,
    "modificationDate",
    "text",
    g_data.originalMetadata["modificationDate"].toISOString()
  );
  //////////
  base.closeModal();
  if (error) {
    base.showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_localizedModalTexts.loadingMessageErrorInvalid,
      g_localizedModalTexts.okButton
    );
  }
}

//////////////////////////////////////////////

export async function onSave() {
  if (base.getOpenModal()) base.closeModal();
  base.showInfoModal(
    g_localizedModalTexts.warningTitle,
    g_localizedModalTexts.savingMessageUpdate,
    g_localizedModalTexts.okButton,
    g_localizedModalTexts.cancelButton,
    () => {
      base.showProgressModal();
      base.updateModalTitleText(g_localizedModalTexts.savingTitle);
      base.sendIpcToMain("save-metadata-to-file", g_data.modifiedMetadata);
    }
  );
}

export function onSavingDone(error) {}

//////////////////////////////////////////////

export function onContextMenu(params) {
  base.sendIpcToMain("show-context-menu", params, true);
}

export function onIssueSearchResults(
  searchHistory,
  importButton,
  ul,
  data,
  addLine
) {}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function updateLocalization(localizedModalTexts, localizedSubTool) {
  g_localizedModalTexts = localizedModalTexts;
  g_localizedSubTool = localizedSubTool;
}
