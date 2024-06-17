/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { contextBridge, ipcRenderer } = require("electron");
const { CustomTitlebar, TitlebarColor } = require("custom-electron-titlebar");

contextBridge.exposeInMainWorld("ipc", {
  sendToMain: (...args) => {
    ipcRenderer.send("main", args);
  },
  sendToMainAndWait: (...args) => {
    return ipcRenderer.invoke("main", args);
  },
  addOnIpcCallbackFromMain: (callback) => ipcRenderer.on("renderer", callback),
});

///////////////////////////////////////////////////////////////////////////////
// TITLE BAR //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_titlebar;

window.addEventListener("DOMContentLoaded", () => {
  g_titlebar = new CustomTitlebar({
    icon: "../assets/images/icon_256x256.png",
    titleHorizontalAlignment: "right",
  });

  ipcRenderer.on("preload", (event, args) => {
    if (args[0] == "update-menubar") {
      if (args[1]) g_titlebar.updateBackground(TitlebarColor.fromHex(args[1]));
      if (args[2]) g_titlebar.updateItemBGColor(TitlebarColor.fromHex(args[2]));
      g_titlebar.refreshMenu();
    } else if (args[0] == "update-title") {
      document.title = args[1];
      g_titlebar.updateTitle(args[1]);
    }
  });
});

// ref: https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
// ref: https://www.electronjs.org/docs/latest/tutorial/ipc
// ref: https://www.electronjs.org/docs/latest/api/ipc-renderer
