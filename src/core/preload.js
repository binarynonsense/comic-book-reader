/**
 * @license
 * Copyright 2023-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { CustomTitlebar, TitlebarColor } = require("custom-electron-titlebar");

contextBridge.exposeInMainWorld("ipc", {
  sendToMain: (...args) => {
    ipcRenderer.send("main", args);
  },
  sendToMainAndWait: (...args) => {
    return ipcRenderer.invoke("main", ...args);
  },
  addOnIpcCallbackFromMain: (callback) => ipcRenderer.on("renderer", callback),
  showFilePath(file) {
    return webUtils.getPathForFile(file);
  },
});

///////////////////////////////////////////////////////////////////////////////
// TITLE BAR //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_titlebar;

window.addEventListener("DOMContentLoaded", () => {
  g_titlebar = new CustomTitlebar({
    icon: "../../assets/images/icon_256x256.png",
    titleHorizontalAlignment: "right",
  });

  ipcRenderer.on("preload", (event, args) => {
    if (args[0] == "update-menubar") {
      if (args[1]) g_titlebar.updateBackground(TitlebarColor.fromHex(args[1]));
      if (args[2]) g_titlebar.updateItemBGColor(TitlebarColor.fromHex(args[2]));
      g_titlebar.refreshMenu();
      // updateWindowButtons();
    } else if (args[0] == "update-title") {
      document.title = args[1];
      g_titlebar.updateTitle(args[1]);
    } else if (args[0] == "update-window-buttons") {
      updateWindowButtons(...args.slice(1));
    } else if (args[0] == "update-tools-common") {
      const localization = args[1];
      document.getElementById("tools-scroll-to-top-button").title =
        localization.scrollToTop;
    } else if (args[0] == "set-player-mode") {
      // const observer = new ResizeObserver((entries) => {
      //   for (const entry of entries) {
      //     // const width = Math.ceil(entry.contentRect.width);
      //     // const height = Math.ceil(entry.contentRect.height);
      //     const width = Math.ceil(entry.borderBoxSize[0].inlineSize);
      //     const height = Math.ceil(entry.borderBoxSize[0].blockSize);
      //     ipcRenderer.send("main", [
      //       "resize-player-mode",
      //       width,
      //       height,
      //       document
      //         .querySelector("#media-player-container")
      //         .classList.contains("mp-layout-fullscreen"),
      //     ]);
      //   }
      // });
      const mediaPlayerDiv = document.querySelector("#media-player-container");
      const modalsDiv = document.querySelector("#modals");
      //
      function resizePlayer() {
        let mediaSize = { width: 0, height: 0 };
        let modalsSize = { width: 0, height: 0 };
        mediaSize.width = Math.ceil(mediaPlayerDiv.offsetWidth);
        mediaSize.height = Math.ceil(mediaPlayerDiv.offsetHeight);
        if (modalsDiv.children.length !== 0) {
          const modalFrameDiv = modalsDiv.querySelector(".modal-frame");
          modalsSize.width = Math.ceil(modalFrameDiv.offsetWidth);
          modalsSize.height = Math.ceil(modalFrameDiv.offsetHeight);
        }
        ipcRenderer.send("main", [
          "resize-player-mode",
          Math.max(mediaSize.width, modalsSize.width),
          Math.max(mediaSize.height, modalsSize.height),
          document
            .querySelector("#media-player-container")
            .classList.contains("mp-layout-fullscreen"),
        ]);
      }
      //
      const mediaSizeObserver = new ResizeObserver((entries) => {
        resizePlayer();
      });
      mediaSizeObserver.observe(mediaPlayerDiv);
      ////
      let wasEmpty = modalsDiv.children.length === 0;
      const elementObserver = new MutationObserver(() => {
        const isEmpty = modalsDiv.children.length === 0;
        if (isEmpty !== wasEmpty) {
          // resize if modal created or destroyed
          resizePlayer();
          wasEmpty = isEmpty;
        }
      });
      elementObserver.observe(modalsDiv, {
        childList: true,
      });
    }
  });
});

function updateWindowButtons(localizedTexts, inMaximized) {
  if (localizedTexts) {
    g_titlebar.currentOptions.tooltips.maximize = localizedTexts.maximize;
    g_titlebar.currentOptions.tooltips.minimize = localizedTexts.minimize;
    g_titlebar.currentOptions.tooltips.restoreDown = localizedTexts.restoreDown;
    g_titlebar.currentOptions.tooltips.close = localizedTexts.close;
  }
  g_titlebar.controls.close.title = g_titlebar.currentOptions.tooltips.close;
  g_titlebar.controls.minimize.title =
    g_titlebar.currentOptions.tooltips.minimize;
  g_titlebar.controls.maximize.title = inMaximized
    ? g_titlebar.currentOptions.tooltips.restoreDown
    : g_titlebar.currentOptions.tooltips.maximize;
}

// ref: https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
// ref: https://www.electronjs.org/docs/latest/tutorial/ipc
// ref: https://www.electronjs.org/docs/latest/api/ipc-renderer
