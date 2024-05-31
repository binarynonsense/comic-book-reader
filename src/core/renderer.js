/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as reader from "../reader/renderer.js";
import {
  init as initTools,
  getTools,
  getCurrentTool,
  setCurrentToolName,
} from "../shared/renderer/tools.js";
import * as modals from "../shared/renderer/modals.js";
import { init as initInput } from "../shared/renderer/input.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

init();

function init() {
  initInput();
  initTools();
  // init ipcs
  for (const [key, value] of Object.entries(getTools())) {
    value.initIpc();
  }
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  window.ipc.sendToMain(...args);
}

export async function sendIpcToMainAndWait(...args) {
  return await window.ipc.sendToMainAndWait(...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

window.ipc.addOnIpcCallbackFromMain(onIpcFromMain);

function onIpcFromMain(event, args) {
  if (args[0] === "core") {
    switch (args[1]) {
      case "update-css-properties":
        {
          updateCssProperties(args[2]);
        }
        break;

      case "update-language-direction":
        {
          updateLanguageDirection(args[2]);
        }
        break;
      case "replace-inner-html":
        {
          document.querySelector(args[2]).innerHTML = args[3];
        }
        break;
      case "append-structure-divs":
        {
          const readerDiv = document.createElement("div");
          readerDiv.id = "reader";
          document.body.appendChild(readerDiv);

          const toolsDiv = document.createElement("div");
          toolsDiv.className = "set-display-none";
          toolsDiv.id = "tools";
          document.body.appendChild(toolsDiv);

          const modalsDiv = document.createElement("div");
          modalsDiv.id = "modals";
          document.body.appendChild(modalsDiv);
        }
        break;
      case "show-tool":
        {
          setCurrentToolName(args[2]);
          if (args[2] === "reader") {
            document
              .getElementById("reader")
              .classList.remove("set-display-none");
            document.getElementById("tools").classList.add("set-display-none");
            document.getElementById("tools").innerHTML = "";
          } else {
            document.getElementById("reader").classList.add("set-display-none");
            document
              .getElementById("tools")
              .classList.remove("set-display-none");
          }
        }
        break;
      case "show-modal-info":
        {
          showModalAlert(args[2], args[3], args[4]);
        }
        break;
      case "show-context-menu":
        {
          if (getOpenModal()) {
            return;
          }
          if (getCurrentTool().onContextMenu)
            getCurrentTool().onContextMenu(args[2]);
        }
        break;
      case "log-to-console":
        {
          console.log(args[2]);
        }
        break;
    }
  } else {
    if (getTools()[args[0]]?.onIpcFromMain) {
      getTools()[args[0]].onIpcFromMain(args.slice(1));
    } else {
      console.log("onIpcFromMain is null: " + args[0]);
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateCssProperties(newValuesObject) {
  for (const [key, value] of Object.entries(newValuesObject)) {
    document.documentElement.style.setProperty(key, value);
  }
}

///////////////////////////////////////////////////////////////////////////////
// MODALS//////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function modalClosed() {
  g_openModal = undefined;
  if (getCurrentTool() === reader)
    reader.sendIpcToMain("rebuild-menu-and-toolbar", true);
}

function showModalAlert(title, message, textButton1) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: 10,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          modalClosed();
        },
        key: "Enter",
      },
    ],
  });
  if (getCurrentTool() === reader)
    reader.sendIpcToMain("rebuild-menu-and-toolbar", false);
}

///////////////////////////////////////////////////////////////////////////////
// LANGUAGE DIRECTION /////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_languageDirection = "ltr";

function updateLanguageDirection(newDirection) {
  g_languageDirection = newDirection;
  initTitleBarObserver();
  document.documentElement.setAttribute("dir", g_languageDirection);
  if (g_languageDirection === "ltr") {
    document.querySelector(".cet-title").classList.add("cet-title-right");
    document.querySelector(".cet-title").classList.remove("cet-title-left");
  } else {
    document.querySelector(".cet-title").classList.remove("cet-title-right");
    document.querySelector(".cet-title").classList.add("cet-title-left");
  }
}

let g_menuBarObserver;

// TITLE BAR HACK to support rtl direction !!!!!!
// Observe to know when a cet-menubar-menu-container is created and then
// override its position to flow from right to left, the rest is done in
// updateLanguageDirection
function initTitleBarObserver() {
  if (g_languageDirection !== "rtl") {
    if (g_menuBarObserver !== undefined) {
      g_menuBarObserver.disconnect();
      g_menuBarObserver = undefined;
    }
    return;
  }
  if (g_menuBarObserver !== undefined) return;
  try {
    // ref: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
    const targetNode = document.querySelector(".cet-menubar");
    const config = { attributes: true, childList: true, subtree: true };
    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
        if (mutation.type === "childList") {
          // a child node has been added or removed
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (
                node.classList &&
                node.classList.contains("cet-menubar-menu-container")
              ) {
                // ref: custom-electron-titlebar/src/menubar/menu/submenu.ts
                // createSubmenu()
                // HACK !!!!!
                if (node.classList.contains("cet-submenu")) {
                  // submenu container
                  node.style.left = "auto";
                  node.style.right = `${node.parentNode.offsetWidth}px`;
                  if (
                    node.parentNode.parentNode.parentNode.classList.contains(
                      "cet-action-item"
                    )
                  ) {
                    // third level submenu
                    const parentRect = node.parentNode.getBoundingClientRect();
                    const grandParentRect =
                      node.parentNode.parentNode.getBoundingClientRect();
                    node.style.top = `${
                      parentRect.top - grandParentRect.top
                    }px`;
                  } else {
                    // second level submenu
                    const parentRect = node.parentNode.getBoundingClientRect();
                    const grandGrandParentRect =
                      node.parentNode.parentNode.parentNode.getBoundingClientRect();
                    node.style.top = `${
                      parentRect.top - grandGrandParentRect.bottom
                    }px`;
                  }
                  // make paths in history submenu always ltr
                  let isHistory = false;
                  const keybindings = node.querySelectorAll(".keybinding");
                  keybindings.forEach((keybinding) => {
                    if (keybinding.tagName.toLowerCase() === "span") {
                      if (keybinding.textContent === "Control+H") {
                        isHistory = true;
                      }
                    }
                  });
                  if (isHistory) {
                    const labels = node.querySelectorAll(".cet-action-label");
                    labels.forEach((label) => {
                      if (label.tagName.toLowerCase() === "span") {
                        label.style.direction = "ltr";
                      }
                    });
                  }
                } else {
                  const rect = node.getBoundingClientRect();
                  const parentRect = node.parentNode.getBoundingClientRect();
                  node.style.left = `${
                    parentRect.left - rect.width + parentRect.width
                  }px`;
                  node.style.left = `${
                    parentRect.left - rect.width + parentRect.width
                  }px`;
                }
              }
            });
          }
        }
      }
    };
    g_menuBarObserver = new MutationObserver(callback);
    g_menuBarObserver.observe(targetNode, config);
  } catch (error) {
    console.log(error);
  }
}
