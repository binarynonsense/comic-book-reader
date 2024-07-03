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
            if (typeof element === "string") {
              result.push({ "#text": element });
            } else {
              result.push(element);
            }
          });
        } else {
          if (typeof entry === "string") {
            result.push({ "#text": entry });
          } else {
            result.push(entry);
          }
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
    if (calibreSeries) {
      tempData.known["series"] = [{ "#text": calibreSeries }];
    } else if (series) {
      tempData.known["series"] = [{ "#text": series }];
    } else {
      tempData.known["series"] = [{}];
    }
    if (calibreSeriesNumber) {
      tempData.known["number"] = [{ "#text": calibreSeriesNumber }];
    } else if (seriesNumber) {
      tempData.known["number"] = [{ "#text": seriesNumber }];
    } else {
      tempData.known["number"] = [{}];
    }
    // delete used meta entries
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
    } else {
      // TODO: now just choosing the first one, check if it's the right one/main?
      // epub 3: title-type refine is main, subtitle title-type refine is subtitle; epub 2 no way? and no subtitles
      g_data["title"].splice(1);
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
        role: creator["@_role"],
        fileAs: creator["@_file-as"],
      });
    });
    if (g_data["creator"].length <= 0) {
      g_data["creator"].push({});
    }
    // TODO: contributor?
    //////
    [...knownTags, "series", "number"].forEach((tag) => {
      if (tag !== "dc:title" && tag !== "dc:creator") {
        let newTag = tag.replace("dc:", "");
        g_data[newTag] = [];
        if (tempData.known[tag] && tempData.known[tag].length >= 1) {
          tempData.known[tag].forEach((element) => {
            g_data[newTag].push({
              text: element["#text"],
            });
          });
        } else {
          g_data[newTag].push({});
        }
      }
    });
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

function onFieldChanged(element) {
  g_saveButton.classList.remove("tools-disabled");
}

function addSimpleField(parentDiv, key) {
  let data = g_data[key];
  const contentLabel = document.createElement("label");
  {
    const contentSpan = document.createElement("span");
    contentSpan.innerText = g_localizedSubTool.uiTagNames[key];
    contentLabel.appendChild(contentSpan);

    let contentInput;
    if (key === "description") {
      contentInput = document.createElement("textarea");
    } else {
      contentInput = document.createElement("input");
      contentInput.type = "text";
    }
    if (key === "subject" && data.length > 1) {
      let text = "";
      data.forEach((element, elementIndex) => {
        if (element["text"]) {
          if (text !== "") {
            text += "; ";
          }
          text += element["text"];
        }
      });
      contentInput.value = text;
    } else {
      contentInput.value = data[0]["text"] ? data[0]["text"] : "";
    }
    data[0]["contentInputElement"] = contentInput;

    contentInput.spellcheck = false;
    contentInput.addEventListener("change", (event) => {
      onFieldChanged(contentInput);
    });
    contentLabel.appendChild(contentInput);
  }
  parentDiv.appendChild(contentLabel);
}

function addComplexField(parentDiv, key, index, data) {
  // data["id"] = key + index;
  const sectionDiv = document.createElement("div");
  sectionDiv.classList.add("tool-shared-columns-parent");
  {
    const contentLabel = document.createElement("label");
    contentLabel.classList.add("tool-shared-columns-50-grow");
    {
      const contentSpan = document.createElement("span");
      if (key === "title") {
        contentSpan.innerText = g_localizedSubTool.uiTagNames.title;
      } else if (key === "creator") {
        contentSpan.innerText = g_localizedSubTool.uiTagNames.creator;
      }
      contentLabel.appendChild(contentSpan);

      const contentInput = document.createElement("input");
      contentInput.value = data["text"] ? data["text"] : "";
      contentInput.type = "text";
      contentInput.spellcheck = false;
      contentInput.addEventListener("change", (event) => {
        onFieldChanged(contentInput);
      });
      data["contentInputElement"] = contentInput;
      contentLabel.appendChild(contentInput);
    }

    sectionDiv.appendChild(contentLabel);

    const fileAsLabel = document.createElement("label");
    fileAsLabel.classList.add("tool-shared-columns-25");
    {
      const fileAsSpan = document.createElement("span");
      fileAsSpan.innerText = g_localizedSubTool.uiFileAs;
      fileAsLabel.appendChild(fileAsSpan);

      const fileAsInput = document.createElement("input");
      fileAsInput.value = data["fileAs"] ? data["fileAs"] : "";
      fileAsInput.type = "text";
      fileAsInput.spellcheck = false;
      fileAsInput.addEventListener("change", (event) => {
        onFieldChanged(fileAsInput);
      });
      data["fileAsInputElement"] = fileAsInput;
      fileAsLabel.appendChild(fileAsInput);
    }
    sectionDiv.appendChild(fileAsLabel);

    if (key === "creator") {
      const roleLabel = document.createElement("label");
      roleLabel.classList.add("tool-shared-columns-25");
      {
        const roleSpan = document.createElement("span");
        roleSpan.innerText = g_localizedSubTool.uiRole;
        roleLabel.appendChild(roleSpan);

        const roleSelect = document.createElement("select");
        // ref: https://www.loc.gov/marc/relators/relaterm.html
        let optionsHtml = `
        <option value=""></option>
        <option value="aut">${g_localizedSubTool.uiAuthor}</option>
        <option value="art">${g_localizedSubTool.uiArtist}</option>
        <option value="ill">${g_localizedSubTool.uiIllustrator}</option>
        <option value="clr">${g_localizedSubTool.uiColorist}</option>
        <option value="cov">${g_localizedSubTool.uiCoverArtist}</option>
        <option value="pbl">${g_localizedSubTool.uiPublisher}</option>
        <option value="trl">${g_localizedSubTool.uiTranslator}</option>
        <option value="edt">${g_localizedSubTool.uiEditor}</option>
        <option value="nrt">${g_localizedSubTool.uiNarrator}</option>        
        `;
        roleSelect.innerHTML = optionsHtml;
        function isValidRole(role) {
          let roles = [
            "aut",
            "art",
            "ill",
            "clr",
            "cov",
            "pbl",
            "trl",
            "edt",
            "nrt",
          ];
          return roles.includes(role);
        }
        roleSelect.value = isValidRole(data["role"]) ? data["role"] : "";
        roleSelect.addEventListener("change", (event) => {
          onFieldChanged(roleSelect);
        });
        data["roleSelectElement"] = roleSelect;
        roleLabel.appendChild(roleSelect);
      }
      sectionDiv.appendChild(roleLabel);

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
        removeTitleButton.addEventListener("click", function (event) {});
        if (index === 0) {
          removeButtonLabel.classList.add("tools-disabled");
        }
      }
      sectionDiv.appendChild(removeButtonLabel);
    }
  }
  parentDiv.appendChild(sectionDiv);
}

function buildSections() {
  let rootDiv = document.querySelector("#tool-metadata-section-2-lists-div");
  rootDiv.innerHTML = "";
  // title
  addComplexField(rootDiv, "title", 0, g_data["title"][0]);
  // series & number
  {
    const sectionDiv = document.createElement("div");
    sectionDiv.classList.add("tool-shared-columns-parent");
    addSimpleField(sectionDiv, "series");
    addSimpleField(sectionDiv, "number");
    rootDiv.appendChild(sectionDiv);
  }
  // others
  addSimpleField(rootDiv, "description");
  addSimpleField(rootDiv, "subject");
  addSimpleField(rootDiv, "language");
  addSimpleField(rootDiv, "publisher");
  addSimpleField(rootDiv, "date");
  // creators
  rootDiv = document.querySelector("#tool-metadata-section-3-lists-div");
  rootDiv.innerHTML = "";
  {
    const addCreatorButton = document.createElement("button");
    rootDiv.appendChild(addCreatorButton);
    const addCreatorSpan = document.createElement("span");
    addCreatorButton.appendChild(addCreatorSpan);
    addCreatorSpan.innerText = g_localizedSubTool.uiAdd;
    addCreatorButton.addEventListener("click", function (event) {});
    //////
    g_data["creator"].forEach((creator, index) => {
      addComplexField(rootDiv, "creator", index, creator);
    });
  }
}

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
