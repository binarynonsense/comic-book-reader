/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_epubData;

function init(format, metadata, version) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  // menu buttons
  const backButton = document.getElementById("tool-metadata-back-button");
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("close");
  });
  ////////////////////////////////////////
  if (format === "epub") {
    epubInit(metadata, version);
  } else {
    // NOTE: should NOT be able to reach this for now!!
  }
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

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-metadata", ...args);
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

  on("update-localization", (...args) => {
    updateLocalization(...args);
  });

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function epubInit(metadata, version) {
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
}

function epubBuildKey(key, labelText) {
  const rootDiv = document.querySelector(
    "#tool-metadata-section-0-content-div"
  );
  const data = g_epubData.json[key];
  if (Array.isArray(data)) {
    data.forEach((element, index, array) => {
      if (typeof element === "string") {
        epubAddInputHtml(
          rootDiv,
          { key, type: "arrayString", index },
          labelText,
          element
        );
      } else {
        epubAddInputHtml(
          rootDiv,
          { key, type: "arrayObject", index, id: element["@_id"] },
          labelText,
          element["#text"]
        );
      }
    });
  } else if (typeof data === "string") {
    epubAddInputHtml(rootDiv, { key, type: "string" }, labelText, data);
  } else {
    epubAddInputHtml(
      rootDiv,
      { key, type: "object", id: data["@_id"] },
      "Title",
      data["#text"]
    );
  }
}

function epubAddInputHtml(rootDiv, source, labelText, inputValue) {
  const label = document.createElement("label");
  rootDiv.appendChild(label);
  const span = document.createElement("span");
  label.appendChild(span);
  const input = document.createElement("input");
  label.appendChild(input);

  span.innerText = labelText;
  input.value = inputValue ? inputValue : "";
  input.type = "text";
  input.spellcheck = "false";
  input.addEventListener("change", (event) => {
    console.log(source);
    console.log(input.value);
  });
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
    case "onkeydown":
      if (
        event.key == "Tab" ||
        event.key == "ArrowUp" ||
        event.key == "ArrowDown" ||
        event.key == "ArrowLeft" ||
        event.key == "ArrowRight"
      ) {
        event.preventDefault();
      }
      break;
  }
}

export function onContextMenu(params) {
  if (getOpenModal()) {
    return;
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function modalClosed() {
  g_openModal = undefined;
}

function showModalConfirmClearAll() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: g_localizedModalClearAllTitleText,
    message: g_localizedModalClearAllMessageText,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: g_localizedModalClearAllOkText.toUpperCase(),
        callback: () => {
          sendIpcToMain("remove-all");
          modalClosed();
        },
        //key: "Enter",
      },
      {
        text: g_localizedModalClearAllCancelText.toUpperCase(),
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization, tooltipsLocalization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.innerText = element.text;
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
