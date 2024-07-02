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
let g_fileData;
let g_data;

export function init(fileData) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  g_fileData = fileData;
  g_saveButton = document.getElementById("tool-metadata-save-button");
  ////////////////////////////////////////
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onLoadMetadata(metadata, version, error) {
  try {
    let tempData;
    // extract info from input metadata
    tempData = {};
    tempData.version = version;
    tempData.known = {};
    tempData.unknown = {};

    function entryContentToArray(entry) {
      let result = [];
      if (entry) {
        entry = structuredClone(entry); // needed??
        if (Array.isArray(entry)) {
          entry.forEach((element) => {
            result.push(element);
          });
        } else {
          result.push({ "#text": entry });
        }
      }
      return result;
    }

    const knownTags = [
      "dc:title",
      "dc:creator",
      "dc:description",
      "dc:subject",
      "dc:language",
      "dc:publisher",
      "dc:date",
    ];

    // separate known tags
    for (const key in metadata) {
      if (key === "meta" || knownTags.includes(key)) {
        tempData.known[key] = entryContentToArray(metadata[key]);
      } else {
        // unknown, just copy them
        tempData.unknown[key] = structuredClone(metadata[key]);
      }
    }
    console.log(tempData);
    // extract refines and add them to corresponting entry
    let metaIndexesToDelete = [];
    knownTags.forEach((tag) => {
      if (tempData.known[tag]) {
        tempData.known[tag].forEach((tagEntry) => {
          if (tagEntry["@_id"]) {
            tempData.known["meta"].forEach((meta, metaIndex) => {
              if (
                meta["@_refines"] &&
                meta["@_property"] &&
                meta["@_refines"] === "#" + tagEntry["@_id"]
              ) {
                tagEntry["@_" + meta["@_property"]] = meta["#text"];
                if (meta["@_scheme"]) {
                  tagEntry["@_scheme"] = meta["@_scheme"];
                }
                metaIndexesToDelete.push(metaIndex);
              }
            });
          }
        });
      }
    });
    // get series and series index if available
    // examples:
    // v2
    // <meta name="calibre:series" content="" />
    // <meta name="calibre:series_index" content="25" />
    // v3
    // <meta id="magazine-issue" property="belongs-to-collection">Series Name</meta>
    // <meta refines="#magazine-issue" property="collection-type">series</meta>
    // <meta refines="#magazine-issue" property="group-position">25</meta>
    let calibreSeries, calibreSeriesNumber, series, seriesNumber;
    tempData.known["meta"].forEach((meta, metaIndex) => {
      if (meta["@_name"] === "calibre:series") {
        calibreSeries = meta["@_content"];
        metaIndexesToDelete.push(metaIndex);
      } else if (meta["@_name"] === "calibre:series_index") {
        calibreSeriesNumber = meta["@_content"];
        metaIndexesToDelete.push(metaIndex);
      } else if (meta["@_property"] === "belongs-to-collection") {
        let id = meta["@_id"];
        if (id) {
          let collectionType;
          tempData.known["meta"].forEach((meta, metaIndex2) => {
            if (
              meta["@_property"] === "collection-type" &&
              meta["@_refines"] === "#" + id
            ) {
              // could be "set" too?
              collectionType = "series";
            }
          });
          if (collectionType === "series") {
            series = meta["#text"];
            metaIndexesToDelete.push(metaIndex);
            tempData.known["meta"].forEach((meta, metaIndex) => {
              if (meta["@_refines"] === "#" + id) {
                metaIndexesToDelete.push(metaIndex);
                if (meta["@_property"] === "group-position") {
                  seriesNumber = meta["#text"];
                }
              }
            });
          }
        }
      }
    });
    if (calibreSeries || calibreSeriesNumber) {
      if (calibreSeries) tempData.known["series"] = calibreSeries;
      if (calibreSeriesNumber)
        tempData.known["seriesNumber"] = calibreSeriesNumber;
    } else if (series || seriesNumber) {
      if (series) tempData.known["series"] = series;
      if (seriesNumber) tempData.known["seriesNumber"] = seriesNumber;
    }
    // delete used meta entries
    console.log(metaIndexesToDelete);
    tempData.known["meta"] = tempData.known["meta"].filter(
      (value, index) => !metaIndexesToDelete.includes(index)
    );
    ///////////////////////////////////////
    // reorganize metadata into g_data
    ///////////////////////////////////////
    g_data = {};
    // title
    g_data["title"] = [];
    tempData.known["dc:title"].forEach((title) => {
      g_data["title"].push({
        text: title["#text"],
        fileAs: title["@_file-as"],
      });
    });
    if (g_data["title"].length <= 0) {
      g_data["title"].push({});
    }
    // creator
    g_data["creator"] = [];
    tempData.known["dc:creator"].forEach((creator, index) => {
      if (creator["@_opf:role"]) {
        creator["@_role"] = creator["@_opf:role"];
      }
      if (creator["@_opf:file-as"]) {
        creator["@_file-as"] = creator["@_opf:file-as"];
      }
      g_data["creator"].push({
        text: creator["#text"],
        scheme: "marc:relators",
        role: creator["@_role"], // TODO: check if valid
        fileAs: creator["@_file-as"],
      });
    });
    if (g_data["creator"].length <= 0) {
      g_data["creator"].push({});
    }
    //////
    g_data.version = tempData.version;
    g_data.meta = tempData.meta;
    g_data.unknown = tempData.unknown;
    ///////////////////////////////////////
    ///////////////////////////////////////
    // generate html
    buildSections();
    // done
    base.closeModal();
  } catch (error) {
    base.closeModal();
    if (error) {
      base.showInfoModal(
        g_localizedModalTexts.errorTitle,
        error.message, //g_localizedModalTexts.loadingMessageErrorInvalid,
        g_localizedModalTexts.okButton
      );
    }
  }
}

function buildSections() {
  console.log(g_data);
  const rootDiv = document.querySelector("#tool-metadata-section-2-lists-div");
  rootDiv.innerHTML = "";
  // title
  {
    const titlesLabel = document.createElement("label");
    {
      const titlesSpan = document.createElement("span");
      titlesSpan.innerText = g_localizedSubTool.uiTitles;
      titlesLabel.appendChild(titlesSpan);
    }
    rootDiv.appendChild(titlesLabel);

    const titlesDiv = document.createElement("div");
    titlesDiv.classList.add("tools-columns-right-subsection-1");
    rootDiv.appendChild(titlesDiv);

    g_data["title"].forEach((title, index) => {
      title["id"] = "title" + index;
      const parentDiv = document.createElement("div");
      parentDiv.classList.add("tool-shared-columns-parent");
      {
        const titleLabel = document.createElement("label");
        titleLabel.classList.add("tool-shared-columns-50-grow");
        {
          const titleSpan = document.createElement("span");
          titleSpan.innerText = g_localizedSubTool.uiTitle;
          titleLabel.appendChild(titleSpan);

          const titleInput = document.createElement("input");
          titleInput.value = title["text"] ? title["text"] : "";
          titleInput.type = "text";
          titleInput.spellcheck = false;
          titleLabel.appendChild(titleInput);
        }
        parentDiv.appendChild(titleLabel);

        const fileAsLabel = document.createElement("label");
        fileAsLabel.classList.add("tool-shared-columns-25");
        {
          const fileAsSpan = document.createElement("span");
          fileAsSpan.innerText = g_localizedSubTool.uiFileAs;
          fileAsLabel.appendChild(fileAsSpan);

          const fileAsInput = document.createElement("input");
          fileAsInput.value = title["fileAs"] ? title["fileAs"] : "";
          fileAsInput.type = "text";
          fileAsInput.spellcheck = false;
          fileAsLabel.appendChild(fileAsInput);
        }
        parentDiv.appendChild(fileAsLabel);

        const removeButtonLabel = document.createElement("label");
        removeButtonLabel.classList.add("tool-shared-columns-25");
        {
          const removeButtonLabelSpan = document.createElement("span");
          removeButtonLabelSpan.innerHTML = "&nbsp;&nbsp;";
          removeButtonLabel.appendChild(removeButtonLabelSpan);

          const removeTitleButton = document.createElement("button");
          removeTitleButton.classList.add("tools-input-label-button");
          removeButtonLabel.appendChild(removeTitleButton);
          const removeTitleSpan = document.createElement("span");
          removeTitleButton.appendChild(removeTitleSpan);
          removeTitleSpan.innerText = g_localizedSubTool.uiRemove;
          removeTitleButton.addEventListener("click", function (event) {
            console.log("click");
          });
          if (index === 0) {
            removeButtonLabel.classList.add("tools-disabled");
          }
        }
        parentDiv.appendChild(removeButtonLabel);
      }
      titlesDiv.appendChild(parentDiv);
    });
    ////
    const addTitleButton = document.createElement("button");
    titlesDiv.appendChild(addTitleButton);
    const addTitleSpan = document.createElement("span");
    addTitleButton.appendChild(addTitleSpan);
    addTitleSpan.innerText = g_localizedSubTool.uiAdd;
    addTitleButton.addEventListener("click", function (event) {});
  }
  // creator
  {
    const creatorsLabel = document.createElement("label");
    {
      const titlesSpan = document.createElement("span");
      titlesSpan.innerText = g_localizedSubTool.uiCreators;
      creatorsLabel.appendChild(titlesSpan);
    }
    rootDiv.appendChild(creatorsLabel);

    const creatorsDiv = document.createElement("div");
    creatorsDiv.classList.add("tools-columns-right-subsection-1");
    rootDiv.appendChild(creatorsDiv);

    g_data["creator"].forEach((title, index) => {
      title["id"] = "creator" + index;
      const parentDiv = document.createElement("div");
      parentDiv.classList.add("tool-shared-columns-parent");
      {
        const titleLabel = document.createElement("label");
        titleLabel.classList.add("tool-shared-columns-50-grow");
        {
          const titleSpan = document.createElement("span");
          titleSpan.innerText = g_localizedSubTool.uiCreator;
          titleLabel.appendChild(titleSpan);

          const titleInput = document.createElement("input");
          titleInput.value = title["text"] ? title["text"] : "";
          titleInput.type = "text";
          titleInput.spellcheck = false;
          titleLabel.appendChild(titleInput);
        }
        parentDiv.appendChild(titleLabel);

        const fileAsLabel = document.createElement("label");
        fileAsLabel.classList.add("tool-shared-columns-25");
        {
          const fileAsSpan = document.createElement("span");
          fileAsSpan.innerText = g_localizedSubTool.uiFileAs;
          fileAsLabel.appendChild(fileAsSpan);

          const fileAsInput = document.createElement("input");
          fileAsInput.value = title["fileAs"] ? title["fileAs"] : "";
          fileAsInput.type = "text";
          fileAsInput.spellcheck = false;
          fileAsLabel.appendChild(fileAsInput);
        }
        parentDiv.appendChild(fileAsLabel);

        const removeButtonLabel = document.createElement("label");
        removeButtonLabel.classList.add("tool-shared-columns-25");
        {
          const removeButtonLabelSpan = document.createElement("span");
          removeButtonLabelSpan.innerHTML = "&nbsp;&nbsp;";
          removeButtonLabel.appendChild(removeButtonLabelSpan);

          const removeTitleButton = document.createElement("button");
          removeTitleButton.classList.add("tools-input-label-button");
          removeButtonLabel.appendChild(removeTitleButton);
          const removeTitleSpan = document.createElement("span");
          removeTitleButton.appendChild(removeTitleSpan);
          removeTitleSpan.innerText = g_localizedSubTool.uiRemove;
          removeTitleButton.addEventListener("click", function (event) {
            console.log("click");
          });
          if (index === 0) {
            removeButtonLabel.classList.add("tools-disabled");
          }
        }
        parentDiv.appendChild(removeButtonLabel);
      }
      creatorsDiv.appendChild(parentDiv);
    });
    ////
    const addCreatorButton = document.createElement("button");
    creatorsDiv.appendChild(addCreatorButton);
    const addCreatorSpan = document.createElement("span");
    addCreatorButton.appendChild(addCreatorSpan);
    addCreatorSpan.innerText = g_localizedSubTool.uiAdd;
    addCreatorButton.addEventListener("click", function (event) {});
  }
}

// function epubAddInputHtml(rootDiv, source, labelText, inputValue) {
//   const label = document.createElement("label");
//   rootDiv.appendChild(label);
//   const span = document.createElement("span");
//   label.appendChild(span);
//   const input = document.createElement("input");
//   label.appendChild(input);

//   span.innerText = labelText;
//   input.value = inputValue ? inputValue : "";
//   input.type = "text";
//   input.spellcheck = "false";
//   input.addEventListener("change", (event) => {
//     console.log(source);
//     console.log(input.value);
//   });
// }

//////////////////////////////////////////////

export async function onSave() {}

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
