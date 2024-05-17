/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as reader from "../reader/renderer.js";
import * as audioPlayer from "../audio-player/renderer.js";
import * as toolPreferences from "../tools/preferences/renderer.js";
import * as toolHistory from "../tools/history/renderer.js";
import * as toolConvertComics from "../tools/convert-comics/renderer.js";
import * as toolExtractComics from "../tools/extract-comics/renderer.js";
import * as toolConvertImgs from "../tools/convert-imgs/renderer.js";
import * as toolExtractPalette from "../tools/extract-palette/renderer.js";
import * as toolExtractText from "../tools/extract-text/renderer.js";
import * as toolCreateQr from "../tools/create-qr/renderer.js";
import * as toolExtractQr from "../tools/extract-qr/renderer.js";
import * as toolDcm from "../tools/dcm/renderer.js";
import * as toolInternetArchive from "../tools/internet-archive/renderer.js";
import * as toolGutenberg from "../tools/gutenberg/renderer.js";
import * as toolXkcd from "../tools/xkcd/renderer.js";
import * as toolLibrivox from "../tools/librivox/renderer.js";
import * as toolWiktionary from "../tools/wiktionary/renderer.js";
import * as toolComicInfoXml from "../tools/comicinfoxml/renderer.js";
import * as toolFileBrowser from "../tools/file-browser/renderer.js";

import * as modals from "../shared/renderer/modals.js";
import { init as initInput } from "../shared/renderer/input.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentTool = "reader";
let g_tools;

init();

function init() {
  // init input
  initInput();
  // init tools
  g_tools = {};
  g_tools["reader"] = reader;
  g_tools["audio-player"] = audioPlayer;
  g_tools["tool-preferences"] = toolPreferences;
  g_tools["tool-history"] = toolHistory;
  g_tools["tool-convert-comics"] = toolConvertComics;
  g_tools["tool-extract-comics"] = toolExtractComics;
  g_tools["tool-convert-imgs"] = toolConvertImgs;
  g_tools["tool-extract-palette"] = toolExtractPalette;
  g_tools["tool-extract-text"] = toolExtractText;
  g_tools["tool-create-qr"] = toolCreateQr;
  g_tools["tool-extract-qr"] = toolExtractQr;
  g_tools["tool-dcm"] = toolDcm;
  g_tools["tool-internet-archive"] = toolInternetArchive;
  g_tools["tool-gutenberg"] = toolGutenberg;
  g_tools["tool-xkcd"] = toolXkcd;
  g_tools["tool-librivox"] = toolLibrivox;
  g_tools["tool-wiktionary"] = toolWiktionary;
  g_tools["tool-comicinfoxml"] = toolComicInfoXml;
  g_tools["tool-file-browser"] = toolFileBrowser;
  // init ipcs
  for (const [key, value] of Object.entries(g_tools)) {
    value.initIpc();
  }
}

export function getTools() {
  return g_tools;
}

export function getCurrentTool() {
  return g_tools[g_currentTool];
}

export function getCurrentToolName() {
  return g_currentTool;
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
          g_currentTool = args[2];
          if (args[2] === "reader") {
            g_currentTool = args[2];
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
          if (g_tools[g_currentTool].onContextMenu)
            g_tools[g_currentTool].onContextMenu(args[2]);
        }
        break;
      case "log-to-console":
        {
          console.log(args[2]);
        }
        break;
    }
  } else {
    if (g_tools[args[0]]?.onIpcFromMain) {
      g_tools[args[0]].onIpcFromMain(args.slice(1));
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
  if (g_tools[g_currentTool] === reader)
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
  if (g_tools[g_currentTool] === reader)
    reader.sendIpcToMain("rebuild-menu-and-toolbar", false);
}
