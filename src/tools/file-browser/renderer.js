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
import * as gamepads from "../../shared/renderer/gamepads.js";
import { delay } from "../../shared/renderer/utils.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_shortcutsDiv;

async function init(showFocus, localizedLoadingText) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  g_navShowFocus = showFocus;
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  ////////////////////////////////////////
  if (!g_openModal) closeModal(g_openModal);
  showProgressModal(localizedLoadingText);
  // give some time for the modal to show
  await delay(0.2);
  sendIpcToMain("build-drives-data");
}
async function buildPage(drivesData) {
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
  updateColumnsHeight();
  if (g_openModal) {
    modals.close(g_openModal);
    modalClosed();
  }
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

  on("build-page", (...args) => {
    buildPage(...args);
  });

  on("show-folder-contents", (...args) => {
    showFolderContents(...args);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showFolderContents(
  folderPath,
  folderContents,
  parentFolder,
  previousFolder
) {
  document.getElementById("tool-fb-current-path-text").innerText = folderPath;
  const ul = document.querySelector("#tool-fb-items-ul");
  ul.innerHTML = "";
  let rowId = 0;
  if (parentFolder && parentFolder?.path) {
    let data = {
      name: parentFolder.name,
      fullPath: parentFolder.path,
      isLink: false,
    };
    addFolderContentLi(-1, ul, data, rowId++);
  }
  if (previousFolder && previousFolder?.path) {
    let data = {
      name: previousFolder.name,
      fullPath: previousFolder.path,
      isLink: false,
    };
    addFolderContentLi(-2, ul, data, rowId++);
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
  updateColumnsHeight();
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
  } else if (type === -2) {
    buttonSpan.innerHTML = `<i class="fas fa-arrow-alt-circle-left fa-2x fa-fw"></i>`;
  }
  let text = document.createElement("span");
  text.innerText = `${entry.name}`;
  buttonSpan.appendChild(text);
  if (type === 0 || type === -1 || type === -2) {
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
  ul.appendChild(li);
}

///////////////////////////////////////////////////////////////////////////////
// NAVIGATION /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_navFocusedElement;
let g_navTree;
let g_navShowFocus;

function rebuildNavigation(focusedPanelID) {
  const root = document.getElementById("tools-columns");
  g_navFocusedElement = undefined;
  g_navTree = [];
  for (let panelIndex = 0; panelIndex < 2; panelIndex++) {
    g_navTree.push([]);
    const panelElements = root.querySelectorAll(
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
    g_navFocusedElement = g_navTree[focusedPanelID][0][0];
    if (g_navShowFocus) g_navFocusedElement.focus();
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
  if (!g_navTree) return;
  if (!g_navFocusedElement) g_navFocusedElement = g_navTree[0][0][0];

  if (upPressed || downPressed || leftPressed || rightPressed) {
    g_navShowFocus = true;
  }

  if (backPressed) {
    const button = document.getElementById("tool-fb-back-button");
    button.click();
  } else if (actionPressed) {
    if (g_navFocusedElement) {
      g_navFocusedElement.click();
      document.activeElement.blur();
    }
  } else if (upPressed || downPressed || leftPressed || rightPressed) {
    let panelId = g_navFocusedElement.getAttribute("data-nav-panel");
    let rowId = g_navFocusedElement.getAttribute("data-nav-row");
    let colId = g_navFocusedElement.getAttribute("data-nav-col");
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
    g_navFocusedElement = g_navTree[panelId][rowId][colId];
    g_navFocusedElement.focus();
  }
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
      navigate(
        event.key == "Escape",
        event.key == "Enter",
        event.key == "ArrowUp",
        event.key == "ArrowDown",
        event.key == "ArrowLeft",
        event.key == "ArrowRight"
      );
      if (event.key == "Tab") {
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
// GAMEPADS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  if (getOpenModal()) {
    modals.onGamepadPolled(getOpenModal());
    return;
  }
  const upPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_UP) ||
    gamepads.getAxisDown(gamepads.Axes.RS_Y, -1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_Y, -1);
  const downPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_DOWN) ||
    gamepads.getAxisDown(gamepads.Axes.RS_Y, 1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_Y, 1);
  const leftPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_LEFT) ||
    gamepads.getAxisDown(gamepads.Axes.RS_X, -1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_X, -1);
  const rightPressed =
    gamepads.getButtonDown(gamepads.Buttons.DPAD_RIGHT) ||
    gamepads.getAxisDown(gamepads.Axes.RS_X, 1) ||
    gamepads.getAxisDown(gamepads.Axes.LS_X, 1);

  navigate(
    gamepads.getButtonDown(gamepads.Buttons.B),
    gamepads.getButtonDown(gamepads.Buttons.A),
    upPressed,
    downPressed,
    leftPressed,
    rightPressed
  );
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

function showProgressModal(title) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
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
