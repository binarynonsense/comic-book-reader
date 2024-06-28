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
let g_saveButton;
let g_fileData;

let g_epubData;

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
  // Reorganize info from original metadata
  g_epubData = {};
  g_epubData.version = version;
  g_epubData.oldMetadata = metadata;
  g_epubData.metadata = {};
  g_epubData.unknown = {};

  function entryContentToArray(entry) {
    entry = structuredClone(entry); // needed??
    let result = [];
    if (Array.isArray(entry)) {
      entry.forEach((element) => {
        result.push(element);
      });
    } else {
      result.push(entry);
    }
    return result;
  }

  const knownTags = [
    "dc:title",
    "dc:creator",
    "dc:language",
    "dc:subject",
    "dc:date",
    "dc:publisher",
  ];

  for (const key in metadata) {
    if (key === "meta" || knownTags.includes(key)) {
      g_epubData[key] = entryContentToArray(metadata[key]);
    } else {
      // unknown, just copy them
      g_epubData.unknown[key] = structuredClone(metadata[key]);
    }
  }
  console.log(g_epubData);

  let metaIndexesToDelete = [];
  knownTags.forEach((tag) => {
    if (g_epubData[tag]) {
      g_epubData[tag].forEach((tagEntry) => {
        if (tagEntry["@_id"]) {
          g_epubData["meta"].forEach((meta, metaIndex) => {
            if (
              meta["@_refines"] &&
              meta["@_property"] &&
              meta["@_refines"] === "#" + tagEntry["@_id"]
            ) {
              console.log("match!!");
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
  console.log(metaIndexesToDelete);

  g_epubData["meta"] = g_epubData["meta"].filter(
    (value, index) => !metaIndexesToDelete.includes(index)
  );

  console.log(g_epubData);

  base.closeModal();
  if (error) {
    base.showInfoModal(
      g_localizedModalTexts.errorTitle,
      g_localizedModalTexts.loadingMessageErrorInvalid,
      g_localizedModalTexts.okButton
    );
  }
}

// function epubBuildKey(key, labelText) {
//   const rootDiv = document.querySelector(
//     "#tool-metadata-section-0-content-div"
//   );
//   const data = g_epubData.json[key];
//   if (Array.isArray(data)) {
//     data.forEach((element, index, array) => {
//       if (typeof element === "string") {
//         epubAddInputHtml(
//           rootDiv,
//           { key, type: "arrayString", index },
//           labelText,
//           element
//         );
//       } else {
//         epubAddInputHtml(
//           rootDiv,
//           { key, type: "arrayObject", index, id: element["@_id"] },
//           labelText,
//           element["#text"]
//         );
//       }
//     });
//   } else if (typeof data === "string") {
//     epubAddInputHtml(rootDiv, { key, type: "string" }, labelText, data);
//   } else {
//     epubAddInputHtml(
//       rootDiv,
//       { key, type: "object", id: data["@_id"] },
//       "Title",
//       data["#text"]
//     );
//   }
// }

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
}
