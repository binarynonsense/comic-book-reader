/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";

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

export function onIpcFromMain(args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
}

export function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("show", (isVisible, elementId) => {
    if (isVisible) {
      document.getElementById(elementId).classList.remove("sm-hidden");
    } else {
      document.getElementById(elementId).classList.add("sm-hidden");
    }
  });

  on("update-stats", (stats, memoryTooltip) => {
    //   mode: "proc" : "generic",
    // document.querySelector("#sm-cpu-text").textContent =
    //   `CPU: ${stats.cpu.toFixed(1)}%`;
    // document.querySelector("#sm-memory-text").textContent =
    //   `Memory: ${stats.memoryUsed.toFixed(1)}GiB / ${stats.memoryTotal.toFixed(1)}GiB`;
    updateWidget("sm-cpu-widget", stats.cpu);
    updateWidget(
      "sm-memory-widget",
      (100 * stats.memoryUsed) / stats.memoryTotal,
      memoryTooltip,
    );
  });

  on("update-localization", (callback) => {
    updateLocalization(callback);
  });
}

///////////////////////////////////////////////////////////////////////////////
// UI /////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateWidget(parentID, value, tooltip, size, thick) {
  const parent = document.getElementById(parentID);
  const valueSpan = parent.querySelector(".sm-value");

  const clampedVal = Math.min(Math.max(value, 0), 100);
  parent.style.setProperty("--sm-progress", clampedVal);

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

function updateLocalization(localization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.innerText = element.text;
    }
  }
}
