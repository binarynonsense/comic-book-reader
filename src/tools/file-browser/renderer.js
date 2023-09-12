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
  const backButton = document.getElementById("tool-fb-back-button");
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("close");
  });
  backButton.setAttribute("data-nav-panel", 0);
  backButton.setAttribute("data-nav-row", 0);
  backButton.setAttribute("data-nav-col", 0);
  ////////////////////////////////////////
  g_shortcutsDiv = document.getElementById("shortcuts");
  drivesData.forEach((drive, index) => {
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
    // buttonDiv.setAttribute("data-path", drive.path);
    buttonDiv.addEventListener("click", () => {
      sendIpcToMain("change-current-folder", drive.path);
    });
    buttonDiv.setAttribute("data-nav-panel", 0);
    buttonDiv.setAttribute("data-nav-row", index + 1);
    buttonDiv.setAttribute("data-nav-col", 0);
    buttonDiv.setAttribute("tabindex", "0");
    g_shortcutsDiv.appendChild(buttonDiv);
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
  const ul = document.querySelector("#tool-fb-items-ul");
  ul.innerHTML = "";
  let rowId = 0;
  if (parentPath) {
    let data = {
      name: "..",
      fullPath: parentPath,
      isLink: false,
    };
    addFolderContentLi(-1, ul, data, rowId++);
  }
  if (folderContents.folders) {
    for (let index = 0; index < folderContents.folders.length; index++) {
      const entry = folderContents.folders[index];
      addFolderContentLi(0, ul, entry, rowId++);
    }
  }
  if (folderContents.files) {
    for (let index = 0; index < folderContents.files.length; index++) {
      const entry = folderContents.files[index];
      addFolderContentLi(1, ul, entry, rowId++);
    }
  }

  rebuildNavigation(1);
}

function addFolderContentLi(type, ul, entry, index) {
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
  buttonSpan.setAttribute("data-nav-panel", 1);
  buttonSpan.setAttribute("data-nav-row", index);
  buttonSpan.setAttribute("data-nav-col", 0);
  buttonSpan.setAttribute("tabindex", "0");
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
// NAVIGATION /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_navFocus;
let g_navTree = [];

function rebuildNavigation(focusedPanelID) {
  g_navTree = [];
  for (let panelIndex = 0; panelIndex < 2; panelIndex++) {
    g_navTree.push([]);
    const panelElements = document.querySelectorAll(
      `[data-nav-panel='${panelIndex}']`
    );
    for (let index = 0; index < panelElements.length; index++) {
      const element = panelElements[index];
      const rowId = element.getAttribute("data-nav-row");
      const colId = element.getAttribute("data-nav-col");
      if (!g_navTree[panelIndex][rowId]) {
        g_navTree[panelIndex][rowId] = [];
      }
      g_navTree[panelIndex][rowId][colId] = element;
    }
  }
  if (focusedPanelID != undefined) {
    g_navFocus = g_navTree[focusedPanelID][0][0];
    g_navFocus.focus();
  }
}

function navigate(
  backPressed,
  actionPressed,
  upPressed,
  downPressed,
  leftPressed,
  rightPressed
) {
  if (
    (!g_navFocus || document.activeElement != g_navFocus) &&
    (upPressed || downPressed || leftPressed || rightPressed)
  ) {
    g_navFocus = document.getElementById("tool-fb-back-button");
    g_navFocus.focus();
  } else if (backPressed) {
    const button = document.getElementById("tool-fb-back-button");
    button.click();
  } else if (actionPressed) {
    if (g_navFocus) {
      g_navFocus.click();
      document.activeElement.blur();
    }
  } else if (upPressed || downPressed || leftPressed || rightPressed) {
    let panelId = g_navFocus.getAttribute("data-nav-panel");
    let rowId = g_navFocus.getAttribute("data-nav-row");
    let colId = g_navFocus.getAttribute("data-nav-col");
    if (upPressed) {
      colId = 0;
      rowId--;
      if (rowId < 0) rowId = g_navTree[panelId].length - 1;
    } else if (downPressed) {
      colId = 0;
      rowId++;
      if (rowId >= g_navTree[panelId].length) rowId = 0;
    } else if (leftPressed) {
      if (colId > 0) {
        colId--;
      } else {
        if (panelId > 0) {
          panelId--;
          colId = 0;
          rowId = 0;
          document.getElementById("tools-columns-right").scrollIntoView({
            behavior: "instant",
            block: "start",
            inline: "nearest",
          });
        }
      }
    } else if (rightPressed) {
      if (colId < g_navTree[panelId][rowId].length - 1) {
        colId++;
      } else {
        // TODO: hardcoded 1, store somewhere the number of panels
        if (panelId < 1) {
          panelId++;
          colId = 0;
          rowId = 0;
        }
      }
    }
    g_navFocus = g_navTree[panelId][rowId][colId];
    g_navFocus.focus();
  }
}
//var rectObject = object.getBoundingClientRect();

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  // if (getOpenModal()) {
  //   modals.onInputEvent(getOpenModal(), type, event);
  //   return;
  // }
  switch (type) {
    case "onkeydown":
      navigate(
        event.key == "Esc",
        event.key == "Enter",
        event.key == "ArrowUp",
        event.key == "ArrowDown",
        event.key == "ArrowLeft",
        event.key == "ArrowRight"
      );
      event.preventDefault();
      break;
  }
}

export function onContextMenu(params) {
  // if (getOpenModal()) {
  //   return;
  // }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPADS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  const upPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_UP) ||
    gamepads.getAxisDown(gamepads.Axes.RS_Y, -1);
  const downPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_DOWN) ||
    gamepads.getAxisDown(gamepads.Axes.RS_Y, 1);
  const leftPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_LEFT) ||
    gamepads.getAxisDown(gamepads.Axes.RS_X, -1);
  const rightPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_RIGHT) ||
    gamepads.getAxisDown(gamepads.Axes.RS_X, 1);

  navigate(
    gamepads.getButtonDown(gamepads.Buttons.B),
    gamepads.getButtonDown(gamepads.Buttons.A),
    upPressed,
    downPressed,
    leftPressed,
    rightPressed
  );
}
