/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import * as input from "../../shared/renderer/input.js";
import * as navigation from "../../shared/renderer/tools-navigation.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_navData = {};
let g_languageDirection;

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
  g_navData.showFocus = showFocus;
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  g_languageDirection = document.documentElement.getAttribute("dir");
  // menu buttons
  const backButton = document.getElementById("tool-hst-back-button");
  backButton.addEventListener("click", (event) => {
    sendIpcToMain("close");
  });
  backButton.setAttribute(
    "data-nav-panel",
    g_languageDirection !== "rtl" ? 0 : 1
  );
  backButton.setAttribute("data-nav-row", 0);
  backButton.setAttribute("data-nav-col", 0);
  const clearButton = document.getElementById("tool-hst-clear-button");
  clearButton.addEventListener("click", (event) => {
    showModalConfirmClearAll();
  });
  clearButton.setAttribute(
    "data-nav-panel",
    g_languageDirection !== "rtl" ? 0 : 1
  );
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
    buttonSpan.setAttribute(
      "data-nav-panel",
      g_languageDirection !== "rtl" ? 1 : 0
    );
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
      buttonSpan.setAttribute(
        "data-nav-panel",
        g_languageDirection !== "rtl" ? 1 : 0
      );
      buttonSpan.setAttribute("data-nav-row", history.length - 1 - index);
      buttonSpan.setAttribute("data-nav-col", 1);
      buttonSpan.setAttribute("tabindex", "0");
      li.appendChild(buttonSpan);
    }
    ul.appendChild(li);
  }
  if (history.length < 10) {
    for (let index = 0; index < 10 - history.length; index++) {
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      let span = document.createElement("span");
      span.innerHTML = `&nbsp;&nbsp;`;
      li.appendChild(span);
      ul.appendChild(li);
    }
  }
  updateColumnsHeight();
  navigation.rebuild(g_navData, g_languageDirection === "rtl" ? 0 : 1);
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
        document.getElementById("tool-hst-back-button"),
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
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_UP"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_UP"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_UP"],
    });
  const downPressed =
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_DOWN"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_DOWN"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_DOWN"],
    });
  const leftPressed =
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_LEFT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_LEFT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_LEFT"],
    });
  const rightPressed =
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["DPAD_RIGHT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["RS_RIGHT"],
    }) ||
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["LS_RIGHT"],
    });

  navigation.navigate(
    g_navData,
    document.getElementById("tool-hst-back-button"),
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["B"],
    }),
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: ["A"],
    }),
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
