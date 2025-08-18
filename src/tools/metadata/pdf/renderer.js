/**
 * @license
 * Copyright 2024-2025 Álvaro García
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

function onFieldChanged(element) {
  g_saveButton.classList.remove("tools-disabled");
  g_data.modifiedMetadata[element.getAttribute("data-key")] = element.value;
}

export function onLoadMetadata(metadata, error) {
  g_data = {};
  g_data.originalMetadata = metadata;
  g_data.modifiedMetadata = {};
  // fill UI with data
  const detailsDiv = document.querySelector("#tool-metadata-pdf-subsection-2");
  const creatorsDiv = document.querySelector("#tool-metadata-pdf-subsection-3");
  const otherDiv = document.querySelector("#tool-metadata-pdf-subsection-4");
  // details
  function addHtml(rootDiv, key, type, value, tooltip) {
    const label = document.createElement("label");
    rootDiv.appendChild(label);
    const span = document.createElement("span");
    span.innerText = g_localizedSubTool[key];
    label.appendChild(span);
    if (tooltip) {
      const tooltipElement = document.createElement("i");
      tooltipElement.classList.add("fas");
      tooltipElement.classList.add("fa-question-circle");
      tooltipElement.classList.add("tools-tooltip-button");
      tooltipElement.addEventListener("click", (event) => {
        base.sendIpcToMain("tooltip-button-clicked", tooltip);
      });
      label.appendChild(tooltipElement);
    }
    let input;
    if (type === "textarea") {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    label.appendChild(input);
    input.value = value ? value : "";
    input.spellcheck = false;
    input.id = `tool-metadata-data-${key}-input`;
    input.setAttribute("data-key", key);
    input.addEventListener("input", (event) => {
      onFieldChanged(input);
    });
  }
  addHtml(detailsDiv, "title", "text", g_data.originalMetadata["title"]);
  addHtml(
    detailsDiv,
    "subject",
    "textarea",
    g_data.originalMetadata["subject"]
  );
  addHtml(
    detailsDiv,
    "keywords",
    "text",
    g_data.originalMetadata["keywords"],
    g_localizedSubTool.keywordsTooltip
  );
  // creators
  addHtml(
    creatorsDiv,
    "author",
    "text",
    g_data.originalMetadata["author"],
    g_localizedSubTool.keywordsTooltip
  );
  // other
  addHtml(otherDiv, "creator", "text", g_data.originalMetadata["creator"]);
  addHtml(otherDiv, "producer", "text", g_data.originalMetadata["producer"]);
  addHtml(
    otherDiv,
    "creationDate",
    "text",
    g_data.originalMetadata["creationDate"].toISOString(),
    g_localizedSubTool.dateTooltip
  );
  addHtml(
    otherDiv,
    "modificationDate",
    "text",
    g_data.originalMetadata["modificationDate"].toISOString(),
    g_localizedSubTool.dateTooltip
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

export function onSavingDone(error) {
  if (!error) {
    base.showInfoModal(
      g_localizedModalTexts.successTitle,
      g_localizedModalTexts.savingMessageSuccessUpdate,
      g_localizedModalTexts.okButton
    );
  } else if (error.dateError) {
    base.showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_localizedModalTexts.savingMessageInvalidChanges,
      g_localizedModalTexts.okButton
    );
  } else {
    base.showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_localizedModalTexts.savingMessageErrorUpdate,
      g_localizedModalTexts.okButton
    );
  }
}

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
) {
  importButton.classList.remove("tools-disabled");
  let compiledData = {};
  let title;
  if (data?.volume?.name && data.name) {
    if (data.issue_number) {
      title = data.volume.name + " #" + data.issue_number + " - " + data.name;
    } else {
      title = data.volume.name + " - " + data.name;
    }
  } else if (data?.volume?.name) {
    if (data.issue_number) {
      title = data.volume.name + " #" + data.issue_number;
    } else {
      title = data.volume.name;
    }
  } else if (data.name) {
    title = data.name;
  }
  if (title) {
    compiledData.title = addLine(ul, g_localizedSubTool.title, title);
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

    let author = "";
    for (let i = 1; i < roles.length; i++) {
      if (roles[i].list && roles[i].list !== "") {
        if (author != "") {
          author += "; ";
        }
        author += roles[i].name + ": " + roles[i].list;
      }
    }

    compiledData.author = addLine(ul, g_localizedSubTool.author, author);
  }

  if (data.description) {
    const div = document.createElement("div");
    div.innerHTML = data.description;
    compiledData.summary = addLine(
      ul,
      g_localizedSubTool.subject,
      div.innerText,
      true // just in case
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
      if (compiledData["author"] && compiledData["author"].checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-author-input"
        );
        element.value = compiledData["author"].text;
        onFieldChanged(element);
      }
      if (compiledData.summary && compiledData.summary.checkbox.checked) {
        let element = document.getElementById(
          "tool-metadata-data-subject-input"
        );
        element.value = compiledData.summary.text;
        onFieldChanged(element);
      }

      base.switchSection(2);
    }
  );
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function updateLocalization(localizedModalTexts, localizedSubTool) {
  g_localizedModalTexts = localizedModalTexts;
  g_localizedSubTool = localizedSubTool;
}
