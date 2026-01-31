/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  showModalAlert,
} from "../../core/renderer.js";
import { sendIpcToMain as readerSendIpcToMain } from "../../reader/renderer.js";

export function initIpc() {
  initOnIpcCallbacks();
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToMain(...args) {
  coreSendIpcToMain("system-monitor", ...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};
let g_isInitialized = false;

export function onIpcFromMain(args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
}

export function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("show", (isVisible, elementId, scale) => {
    if (!g_isInitialized) {
      document
        .querySelector("#sm-warning-icon")
        .addEventListener("click", (event) => {
          sendIpcToMain("on-warning-icon-clicked");
        });
      g_isInitialized = true;
    }
    if (isVisible) {
      document.getElementById(elementId).classList.remove("sm-hidden");
      const parent = document.getElementById("sm-frame");
      parent.style.setProperty("--sm-frame-scale", scale);
    } else {
      document.getElementById(elementId).classList.add("sm-hidden");
    }
  });

  on("update-stats", (stats, memoryTooltip) => {
    if (stats.warningIcon === "error") {
      updateWidget("sm-cpu-widget", 0);
      updateWidget("sm-memory-widget", 0, "");
      document.querySelector("#sm-warning-icon").classList.add("sm-hidden");
    } else {
      updateWidget("sm-cpu-widget", stats.cpu);
      updateWidget(
        "sm-memory-widget",
        (100 * stats.memoryUsed) / stats.memoryTotal,
        memoryTooltip,
      );
      if (stats.warningIcon === "warning") {
        document
          .querySelector("#sm-warning-icon")
          .classList.remove("sm-hidden");
      } else {
        // normal
        document.querySelector("#sm-warning-icon").classList.add("sm-hidden");
      }
    }
  });

  on("update-localization", (...args) => {
    updateLocalization(...args);
  });

  on("show-modal-warning", (...args) => {
    console.log(args[1]);
    showModalAlert(args[0], args[1], args[2]);
    document
      .querySelector("#sm-modal-link")
      .addEventListener("click", (event) => {
        readerSendIpcToMain(
          "open-url-in-browser",
          "https://github.com/binarynonsense/comic-book-reader/wiki",
        );
      });
  });
}

///////////////////////////////////////////////////////////////////////////////
// UI /////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateWidget(parentID, value, tooltip, size, thick) {
  const parent = document.getElementById(parentID);
  const valueSpan = parent.querySelector(".sm-value");
  const barFillDiv = parent.querySelector(".sm-bar-fill");

  const clampedVal = Math.min(Math.max(value, 0), 100);
  parent.style.setProperty("--sm-progress", clampedVal);

  if (Math.round(clampedVal) >= 95) {
    barFillDiv.classList.add("sm-bar-fill-alert");
  } else {
    barFillDiv.classList.remove("sm-bar-fill-alert");
  }

  if (valueSpan) {
    valueSpan.textContent = `${Math.round(clampedVal)}%`;
  }

  if (size) {
    parent.style.setProperty("--sm-size", `${size}px`);
  }

  if (thick) {
    parent.style.setProperty("--sm-thickness", `${thick}px`);
  }

  if (tooltip) {
    parent.title = tooltip;
  }
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization, tooltipsLocalization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.querySelector("#" + element.id);
    if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }

  for (let index = 0; index < tooltipsLocalization.length; index++) {
    const element = tooltipsLocalization[index];
    const domElement = document.querySelector("#" + element.id);
    if (domElement !== null) {
      if (
        domElement.classList &&
        domElement.classList.contains("tools-tooltip-button")
      ) {
        domElement.setAttribute("data-info", element.text);
        domElement.title = localizedTexts.infoTooltip;
      } else {
        domElement.title = element.text;
      }
    }
  }
}
