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
import * as gamepads from "../../shared/renderer/gamepads.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_shortcutsDiv;

async function init(drivesData) {
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
  document
    .getElementById("tool-fb-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  ////////////////////////////////////////
  g_shortcutsDiv = document.getElementById("shortcuts");
  drivesData.forEach((drive) => {
    const buttonDiv = document.createElement("div");
    buttonDiv.className = "tools-menu-button";
    const buttonIcon = document.createElement("i");
    if (drive.isPlace) {
      buttonIcon.className = "fas fa-bookmark tools-menu-button-icon";
    } else if (drive.isUSB) {
      buttonIcon.className = "fab fa-usb tools-menu-button-icon";
    } else {
      buttonIcon.className = "fas fa-hdd tools-menu-button-icon";
    }
    buttonDiv.appendChild(buttonIcon);
    const textDiv = document.createElement("div");
    textDiv.className = "tools-menu-button-text";
    const textSpan = document.createElement("span");
    textSpan.innerText = drive.name;
    textDiv.appendChild(textSpan);
    buttonDiv.appendChild(textDiv);
    buttonDiv.setAttribute("data-path", drive.path);
    g_shortcutsDiv.appendChild(buttonDiv);
    buttonDiv.addEventListener("click", () => {
      sendIpcToMain("change-current-folder", drive.path);
    });
  });
  ////////////////////////////////////////

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

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-file-browser", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-file-browser", ...args);
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

  on("hide", () => {});

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("update-localization", (localization) => {
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
  });

  //////////////////////////

  on("show-folder-contents", (...args) => {
    showFolderContents(...args);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showFolderContents(folderPath, folderContents, parentPath) {
  document.getElementById("tool-fb-current-path-text").innerText = folderPath;
  // TODO: rebuild navigation tree, set current element focused...
  const ul = document.querySelector("#tool-fb-items-ul");
  ul.innerHTML = "";
  if (parentPath) {
    let data = {
      name: "..",
      fullPath: parentPath,
      isLink: false,
    };
    addFolderContentLi(-1, ul, data);
  }
  if (folderContents.folders) {
    for (let index = 0; index < folderContents.folders.length; index++) {
      const entry = folderContents.folders[index];
      addFolderContentLi(0, ul, entry);
    }
  }
  if (folderContents.files) {
    for (let index = 0; index < folderContents.files.length; index++) {
      const entry = folderContents.files[index];
      addFolderContentLi(1, ul, entry);
    }
  }
  if (folderContents.links) {
    for (let index = 0; index < folderContents.links.length; index++) {
      const entry = folderContents.links[index];
      addFolderContentLi(2, ul, entry);
    }
  }
}

function addFolderContentLi(type, ul, entry) {
  let li = document.createElement("li");
  li.className = "tools-buttons-list-li";
  let buttonSpan = document.createElement("span");
  buttonSpan.className = "tools-buttons-list-button";
  if (type === 0) {
    if (entry.isLink) {
      buttonSpan.innerHTML = `<span class="fa-stack">
      <i class="fas fa-folder fa-stack-2x"></i>
      <i class="fas fa-link fa-stack-1x tools-buttons-list-linkicon-folder"></i>
      </span>`;
    } else {
      buttonSpan.innerHTML = `<i class="fas fa-folder fa-2x fa-fw"></i>`;
    }
  } else if (type === 1) {
    if (entry.isLink) {
      buttonSpan.innerHTML = `<span class="fa-stack">
      <i class="fas fa-file fa-stack-2x"></i>
      <i class="fas fa-link fa-stack-1x tools-buttons-list-linkicon-file"></i>
      </span>`;
    } else {
      buttonSpan.innerHTML = `<i class="fas fa-file fa-2x fa-fw"></i>`;
    }
  } else if (type === -1) {
    buttonSpan.innerHTML = `<i class="fas fa-arrow-alt-circle-up fa-2x fa-fw"></i>`;
  }
  let text = document.createElement("span");
  text.innerText = `${entry.name}`;
  buttonSpan.appendChild(text);
  if (type === 0 || type === -1) {
    buttonSpan.addEventListener("click", (event) => {
      sendIpcToMain("change-current-folder", entry.fullPath);
    });
  } else if (type === 1) {
    buttonSpan.addEventListener("click", (event) => {
      sendIpcToMain("open-file", entry.fullPath);
    });
  }
  li.appendChild(buttonSpan);
  // {
  //   // TODO: delete TEST, use in History tool
  //   //<i class="fas fa-window-close"></i>
  //   if (type === -1) {
  //     let buttonSpan = document.createElement("span");
  //     buttonSpan.className = "tools-buttons-list-button";
  //     buttonSpan.innerHTML = `<i class="fas fa-times fa-2x fa-fw"></i>`;
  //     li.appendChild(buttonSpan);
  //   }
  // }
  ul.appendChild(li);
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  // if (getOpenModal()) {
  //   modals.onInputEvent(getOpenModal(), type, event);
  //   return;
  // }
}

export function onContextMenu(params) {
  // if (getOpenModal()) {
  //   return;
  // }
  sendIpcToMain("show-context-menu", params);
}
