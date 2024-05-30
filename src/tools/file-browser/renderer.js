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
import * as navigation from "../../shared/renderer/tools-navigation.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_shortcutsDiv;
let g_navData = {};
let g_languageDirection;

async function init(showFocus, localizedLoadingText) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  g_navData.showFocus = showFocus;
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
  g_languageDirection = document.documentElement.getAttribute("dir");
  // menu buttons
  const backButton = document.getElementById("tool-fb-back-button");
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("close");
  });
  backButton.setAttribute(
    "data-nav-panel",
    g_languageDirection !== "rtl" ? 0 : 1
  );
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
    buttonDiv.setAttribute(
      "data-nav-panel",
      g_languageDirection !== "rtl" ? 0 : 1
    );
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
  navigation.rebuild(g_navData, 1);
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
  buttonSpan.setAttribute(
    "data-nav-panel",
    g_languageDirection !== "rtl" ? 1 : 0
  );
  buttonSpan.setAttribute("data-nav-row", index);
  buttonSpan.setAttribute("data-nav-col", 0);
  buttonSpan.setAttribute("tabindex", "0");
  li.appendChild(buttonSpan);
  ul.appendChild(li);
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
      navigation.navigate(
        g_navData,
        document.getElementById("tool-fb-back-button"),
        event.key == "Escape",
        event.key == "Enter",
        event.key == "ArrowUp",
        event.key == "ArrowDown",
        event.key == "ArrowLeft",
        event.key == "ArrowRight"
      );
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
// GAMEPADS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  if (getOpenModal()) {
    modals.onGamepadPolled(getOpenModal());
    return;
  }
  const upPressed =
    gamepads.getButtonDownThisFrame(gamepads.Buttons.DPAD_UP) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.RS_Y, -1) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.LS_Y, -1);
  const downPressed =
    gamepads.getButtonDownThisFrame(gamepads.Buttons.DPAD_DOWN) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.RS_Y, 1) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.LS_Y, 1);
  const leftPressed =
    gamepads.getButtonDownThisFrame(gamepads.Buttons.DPAD_LEFT) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.RS_X, -1) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.LS_X, -1);
  const rightPressed =
    gamepads.getButtonDownThisFrame(gamepads.Buttons.DPAD_RIGHT) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.RS_X, 1) ||
    gamepads.getAxisDownThisFrame(gamepads.Axes.LS_X, 1);

  navigation.navigate(
    g_navData,
    document.getElementById("tool-fb-back-button"),
    gamepads.getButtonDownThisFrame(gamepads.Buttons.B),
    gamepads.getButtonDownThisFrame(gamepads.Buttons.A),
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
