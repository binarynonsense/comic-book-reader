/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { ipcRenderer } = require("electron");

ipcRenderer.on("getHtml", (event, tool, data) => {
  data.html = document.documentElement.innerHTML;
  ipcRenderer.send("tools-bg-window", tool, data);
});

let g_tries = 0;
ipcRenderer.on("getCbpResultsWhenReady", (event, tool, data) => {
  checkCbpSearchReady(tool, data);
});

function checkCbpSearchReady(tool, data) {
  if (g_tries < 10 && !document.querySelector(".gs-webResult")) {
    // no results yet?
    g_tries++;
    setTimeout(() => {
      checkCbpSearchReady(tool, data);
    }, 500);
  } else {
    // ready?
    // timeout a bit just in case, not sure if needed
    setTimeout(() => {
      data.html = document.documentElement.innerHTML;
      ipcRenderer.send("tools-bg-window", tool, data);
    }, 200);
  }
}
