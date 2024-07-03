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
    // subject
    g_data["subject"] = [];
    let subjectText = "";
    if (
      tempData.known["dc:subject"] &&
      tempData.known["dc:subject"].length >= 0
    ) {
      tempData.known["dc:subject"].forEach((subject) => {
        if (subject["#text"]) {
          if (subjectText !== "") {
            subjectText += "; ";
          }
          subjectText += subject["#text"];
        }
      });
    }
    g_data["subject"].push({ text: subjectText });
    // other
    [...knownTags, "series", "number"].forEach((tag) => {
      if (tag !== "dc:title" && tag !== "dc:creator" && tag !== "dc:subject") {
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
    g_data.meta = tempData.known.meta;
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
    contentInput.value = data[0]["text"] ? data[0]["text"] : "";
    contentInput.spellcheck = false;
    contentInput.addEventListener("input", (event) => {
      data[0]["text"] = contentInput.value;
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
      contentInput.addEventListener("input", (event) => {
        data["text"] = contentInput.value;
        onFieldChanged(contentInput);
      });
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
      fileAsInput.addEventListener("input", (event) => {
        data["fileAs"] = fileAsInput.value;
        onFieldChanged(fileAsInput);
      });
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
        <option value="aut">${g_localizedSubTool.role.aut}</option>
        <option value="art">${g_localizedSubTool.role.art}</option>
        <option value="ill">${g_localizedSubTool.role.ill}</option>
        <option value="clr">${g_localizedSubTool.role.clr}</option>
        <option value="cov">${g_localizedSubTool.role.cov}</option>
        <option value="pbl">${g_localizedSubTool.role.pbl}</option>
        <option value="trl">${g_localizedSubTool.role.trl}</option>
        <option value="edt">${g_localizedSubTool.role.edt}</option>
        <option value="nrt">${g_localizedSubTool.role.nrt}</option>        
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
          data["role"] = roleSelect.value;
          onFieldChanged(roleSelect);
        });
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
        removeTitleButton.addEventListener("click", function (event) {
          g_data[key].splice(index, 1);
          onFieldChanged();
          buildSections();
        });
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
    addCreatorButton.addEventListener("click", function (event) {
      g_data["creator"].push({});
      onFieldChanged();
      buildSections();
    });
    //////
    g_data["creator"].forEach((creator, index) => {
      addComplexField(rootDiv, "creator", index, creator);
    });
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
      let metadata = {};
      /////////////////////////////////
      metadata.meta = structuredClone(g_data.meta);
      for (const key in g_data.unknown) {
        metadata[key] = structuredClone(g_data.unknown[key]);
      }
      // title
      let titleData = g_data.title[0];
      if (titleData != {}) {
        const id = "title_0";
        metadata["dc:title"] = { "#text": titleData.text };
        if (titleData.fileAs) {
          if (g_data.version >= 3.0) {
            metadata.meta.push({
              "#text": element.fileAs,
              "@_refines": "#" + id,
              "@_property": "file-as",
            });
          } else {
            metadata["dc:title"]["@_opf:file-as"] = titleData.fileAs;
          }
        }
      }
      // creator
      metadata["dc:creator"] = [];
      g_data.creator.forEach((element, index) => {
        const id = "creator_" + index;
        let creator = { "@_id": id, "#text": element.text };
        if (element.fileAs) {
          if (g_data.version >= 3.0) {
            metadata.meta.push({
              "#text": element.fileAs,
              "@_refines": "#" + id,
              "@_property": "file-as",
            });
          } else {
            creator["@_opf:file-as"] = element.fileAs;
          }
        }
        if (element.role) {
          if (g_data.version >= 3.0) {
            metadata.meta.push({
              "#text": element.role,
              "@_refines": "#" + id,
              "@_property": "role",
              "@_scheme": "marc:relators",
            });
          } else {
            creator["@_opf:role"] = element.role;
          }
        }
        metadata["dc:creator"].push(creator);
      });
      // subject
      let subjects = [];
      let subjectArray = g_data.subject[0].text.split(";");
      if (!(subjectArray.length === 1 && subjectArray[0].trim() === "")) {
        subjectArray.forEach((element) => {
          if (element.trim() !== "") subjects.push({ "#text": element.trim() });
        });
      }
      if (subjects.length > 0) {
        metadata["dc:subject"] = subjects;
      }
      // series & number
      if (g_data.version >= 3.0) {
        if (g_data.series[0].text || g_data.number[0].text) {
          // NOTE: if one is empty epubcheck gives an error, but I've decided to
          // do it this way anyway as I feel they need to be there even if
          // some of them have no content as their meaning is lost otherwise.
          // Could revert to the calibre metas if only one has content...?
          const id = "series_0";
          metadata.meta.push({
            "@_id": id,
            "@_property": "belongs-to-collection",
            "#text": g_data.series[0].text,
          });
          metadata.meta.push({
            "@_refines": "#" + id,
            "@_property": "collection-type",
            "#text": "series",
          });
          metadata.meta.push({
            "@_refines": "#" + id,
            "@_property": "group-position",
            "#text": g_data.number[0].text,
          });
        }
      } else {
        if (g_data.series) {
          metadata.meta.push({
            "@_name": "calibre:series",
            "@_content": g_data.series[0].text,
          });
        }
        if (g_data.number) {
          metadata.meta.push({
            "@_name": "calibre:series_index",
            "@_content": g_data.number[0].text,
          });
        }
      }
      // other
      for (const key in g_data) {
        if (
          key !== "meta" &&
          key !== "unknown" &&
          key !== "title" &&
          key !== "creator" &&
          key !== "subject" &&
          key !== "series" &&
          key !== "number" &&
          key !== "version"
        ) {
          if (g_data[key][0].text)
            metadata["dc:" + key] = { "#text": g_data[key][0].text };
        }
      }
      /////////////////////////////////
      base.sendIpcToMain("save-metadata-to-file", metadata);
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
  if (data.name) {
    compiledData.title = addLine(
      ul,
      g_localizedSubTool.uiTagNames.title,
      data.name
    );
  }
  if (data?.volume?.name) {
    compiledData.series = addLine(
      ul,
      g_localizedSubTool.uiTagNames.series,
      data.volume.name
    );
  }
  if (data.cover_date) {
    compiledData.date = addLine(
      ul,
      g_localizedSubTool.uiTagNames.date,
      data.cover_date
    );
  }
  if (
    searchHistory.issues.results.publisher &&
    searchHistory.issues.results.publisher.name
  ) {
    compiledData.publisher = addLine(
      ul,
      g_localizedSubTool.uiTagNames.publisher,
      searchHistory.issues.results.publisher.name
    );
  }
  if (data.issue_number) {
    compiledData.number = addLine(
      ul,
      g_localizedSubTool.uiTagNames.number,
      data.issue_number
    );
  }
  if (data.description) {
    const div = document.createElement("div");
    div.innerHTML = data.description;
    compiledData.description = addLine(
      ul,
      g_localizedSubTool.uiTagNames.description,
      div.innerText,
      true // just in case
    );
  }
  if (data.person_credits) {
    let roles = [
      { names: ["writer"], altName: "aut", list: "" },
      { names: ["artist", "penciler", "inker"], altName: "art", list: "" },
      { names: ["colorist"], altName: "clr", list: "" },
      { names: ["letterer"], altName: "ill", list: "" },
      { names: ["cover"], altName: "cov", list: "" },
      { names: ["editor"], altName: "edt", list: "" },
    ];
    function haveCommonItems(array_1, array_2) {
      const set_1 = new Set(array_1); // set of unique items
      const common = array_2.filter((item) =>
        set_1.has(item.toLowerCase().trim())
      );
      return common.length > 0;
    }
    data.person_credits.forEach((creator) => {
      roles.forEach((role) => {
        if (haveCommonItems(role.names, creator.role.split(","))) {
          if (role.list !== "") {
            role.list += ", ";
          }
          role.list += creator.name;
        }
      });
    });
    compiledData.creator = {};
    roles.forEach((role) => {
      if (role.list !== "") {
        compiledData.creator[role.altName] = addLine(
          ul,
          g_localizedSubTool.role[role.altName],
          role.list
        );
      }
    });
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
      let changed = false;
      if (compiledData.title && compiledData.title.checkbox.checked) {
        g_data.title = [{ text: compiledData.title.text }];
        changed = true;
      }
      if (compiledData.series && compiledData.series.checkbox.checked) {
        g_data.series = [{ text: compiledData.series.text }];
        changed = true;
      }
      if (compiledData.date && compiledData.date.checkbox.checked) {
        g_data.date = [{ text: compiledData.date.text }];
        changed = true;
      }
      if (compiledData.publisher && compiledData.publisher.checkbox.checked) {
        g_data.publisher = [{ text: compiledData.publisher.text }];
        changed = true;
      }
      if (compiledData.number && compiledData.number.checkbox.checked) {
        g_data.number = [{ text: compiledData.number.text }];
        changed = true;
      }
      if (
        compiledData.description &&
        compiledData.description.checkbox.checked
      ) {
        g_data.description = [{ text: compiledData.description.text }];
        changed = true;
      }
      let creatorsCleared = false;
      for (const key in compiledData.creator) {
        const creator = compiledData.creator[key];
        if (creator.checkbox.checked) {
          if (!creatorsCleared) {
            creatorsCleared = true;
            g_data.creator = [];
          }
          g_data.creator.push({ text: creator.text, role: key });
          changed = true;
        }
      }
      //////
      if (changed) {
        buildSections();
        onFieldChanged();
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
