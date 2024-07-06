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
