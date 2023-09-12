/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import * as gamepads from "../../shared/renderer/gamepads.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_localizedRemoveFromListText = "";
let g_localizedOpenFromListText = "";

let g_localizedModalClearAllTitleText = "";
let g_localizedModalClearAllMessageText = "";
let g_localizedModalClearAllOkText = "";
let g_localizedModalClearAllCancelText = "";

function init(history, showFocus) {
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
  // menu buttons
  const backButton = document.getElementById("tool-hst-back-button");
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("close");
  });
  backButton.setAttribute("data-nav-panel", 0);
  backButton.setAttribute("data-nav-row", 0);
  backButton.setAttribute("data-nav-col", 0);
  const clearButton = document.getElementById("tool-hst-clear-button");
  clearButton.addEventListener("click", (event) => {
    showModalConfirmClearAll();
  });
  clearButton.setAttribute("data-nav-panel", 0);
  clearButton.setAttribute("data-nav-row", 1);
  clearButton.setAttribute("data-nav-col", 0);
  // history list
  buildHistoryList(history);
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
  coreSendIpcToMain("tool-history", ...args);
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

  on("build-list", (...args) => {
    buildHistoryList(...args);
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

function buildHistoryList(history) {
  // history list
  const ul = document.querySelector("#tool-hst-items-ul");
  ul.innerHTML = "";
  for (let index = history.length - 1; index >= 0; index--) {
    const fileInfo = history[index];
    let name = reducePathString(fileInfo.filePath);
    if (fileInfo.data && fileInfo.data.source) {
      if (fileInfo.data.name) {
        name = "[www] " + reducePathString(fileInfo.data.name);
      } else {
        name = "[www] " + name;
      }
    }
    let li = document.createElement("li");
    li.className = "tools-buttons-list-li";
    let buttonSpan = document.createElement("span");
    buttonSpan.className = "tools-buttons-list-button";
    buttonSpan.innerHTML = `<i class="fas fa-file fa-2x fa-fw"></i>`;
    buttonSpan.title = g_localizedOpenFromListText;
    let text = document.createElement("span");
    text.innerText = `${name}`;
    buttonSpan.appendChild(text);
    buttonSpan.addEventListener("click", (event) => {
      sendIpcToMain("open-item", index);
    });
    buttonSpan.setAttribute("data-nav-panel", 1);
    buttonSpan.setAttribute("data-nav-row", history.length - 1 - index);
    buttonSpan.setAttribute("data-nav-col", 0);
    buttonSpan.setAttribute("tabindex", "0");
    li.appendChild(buttonSpan);
    {
      let buttonSpan = document.createElement("span");
      buttonSpan.className = "tools-buttons-list-button";
      buttonSpan.innerHTML = `<i class="fas fa-times fa-2x fa-fw"></i>`;
      buttonSpan.title = g_localizedRemoveFromListText;
      buttonSpan.addEventListener("click", (event) => {
        sendIpcToMain("remove-item", index);
      });
      buttonSpan.setAttribute("data-nav-panel", 1);
      buttonSpan.setAttribute("data-nav-row", history.length - 1 - index);
      buttonSpan.setAttribute("data-nav-col", 1);
      buttonSpan.setAttribute("tabindex", "0");
      li.appendChild(buttonSpan);
    }
    ul.appendChild(li);
  }
  if (history.length < 20) {
    for (let index = 0; index < 20 - history.length; index++) {
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      let span = document.createElement("span");
      span.innerHTML = `&nbsp;&nbsp;`;
      li.appendChild(span);
      ul.appendChild(li);
    }
  }
  updateColumnsHeight();
  rebuildNavigation(1);
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
    const button = document.getElementById("tool-hst-back-button");
    button.click();
  } else if (actionPressed) {
    if (g_navFocusedElement && document.activeElement == g_navFocusedElement) {
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
      event.preventDefault();
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
    if (element.id === "tool-hst-tooltip-remove-from-list") {
      g_localizedRemoveFromListText = element.text;
    } else if (element.id === "tool-hst-tooltip-open-from-list") {
      g_localizedOpenFromListText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-title") {
      g_localizedModalClearAllTitleText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-message") {
      g_localizedModalClearAllMessageText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-ok") {
      g_localizedModalClearAllOkText = element.text;
    } else if (element.id === "tool-hst-modal-clearall-cancel") {
      g_localizedModalClearAllCancelText = element.text;
    }
  }
}

function reducePathString(input) {
  let length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}
