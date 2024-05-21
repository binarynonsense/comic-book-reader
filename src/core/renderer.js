/**
 * @license
 * Copyright 2020-2023 Álvaro García
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

function updateLanguageDirection(newDirection) {
  document.documentElement.setAttribute("dir", newDirection);
  if (newDirection === "ltr") {
    document.querySelector(".cet-title").classList.add("cet-title-right");
    document.querySelector(".cet-title").classList.remove("cet-title-left");
  } else {
    document.querySelector(".cet-title").classList.remove("cet-title-right");
    document.querySelector(".cet-title").classList.add("cet-title-left");
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
