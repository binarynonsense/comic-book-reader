/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as reader from "../reader/renderer.js";
import { getNavKeys } from "../reader/renderer-ui.js";
import {
  init as initTools,
  getTools,
  getCurrentTool,
  setCurrentToolName,
  needsScrollToTopButtonUpdate,
} from "../shared/renderer/tools.js";
import * as modals from "../shared/renderer/modals.js";
import { init as initInput } from "../shared/renderer/input.js";
import {
  isVersionOlder,
  getFormattedShortcut,
} from "../shared/renderer/utils.js";
import axios from "../assets/libs/axios/dist/esm/axios.js";
import * as toasts from "../shared/renderer/toasts.js";

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

      case "update-language-locale":
        {
          updateLanguageLocale(args[2]);
        }
        break;

      case "replace-inner-html":
        {
          document.querySelector(args[2]).innerHTML = args[3];
        }
        break;

      // ref: https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML
      case "insert-html-beforebegin":
        {
          document
            .querySelector(args[2])
            .insertAdjacentHTML("beforebegin", args[3]);
        }
        break;

      case "insert-html-afterbegin":
        {
          document
            .querySelector(args[2])
            .insertAdjacentHTML("afterbegin", args[3]);
        }
        break;

      case "insert-html-afterend":
        {
          document
            .querySelector(args[2])
            .insertAdjacentHTML("afterend", args[3]);
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

          const toolsScrollButton = document.createElement("div");
          toolsScrollButton.style.display = "none";
          toolsScrollButton.id = "tools-scroll-to-top-button";
          document.body.appendChild(toolsScrollButton);
          toolsScrollButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
          toolsDiv.addEventListener("scroll", (event) => {
            if (needsScrollToTopButtonUpdate()) {
              if (toolsDiv.scrollTop > 20) {
                toolsScrollButton.style.display = "flex";
              } else {
                toolsScrollButton.style.display = "none";
              }
            }
          });
          toolsScrollButton.addEventListener("click", (event) => {
            toolsDiv.scrollTop = 0;
          });

          const audioplayerDiv = document.createElement("div");
          audioplayerDiv.id = "audio-player-container";
          audioplayerDiv.classList =
            "ap-layout-top-left ap-hidden ap-zindex-reader";
          document.body.appendChild(audioplayerDiv);

          const systemMonitorDiv = document.createElement("div");
          systemMonitorDiv.id = "system-monitor-container";
          systemMonitorDiv.classList = "sm-hidden";
          document.body.appendChild(systemMonitorDiv);

          const modalsDiv = document.createElement("div");
          modalsDiv.id = "modals";
          document.body.appendChild(modalsDiv);
        }
        break;

      case "show-tool":
        {
          setCurrentToolName(args[2]);

          document.getElementById("tools-scroll-to-top-button").style.display =
            "none";

          if (args[2] === "reader") {
            document
              .getElementById("reader")
              .classList.remove("set-display-none");
            document.getElementById("tools").classList.add("set-display-none");
            document.getElementById("tools").innerHTML = "";

            document
              .getElementById("audio-player-container")
              .classList.add("ap-zindex-reader");
            document
              .getElementById("audio-player-container")
              .classList.remove("ap-zindex-tools");
          } else {
            document.getElementById("reader").classList.add("set-display-none");
            document
              .getElementById("tools")
              .classList.remove("set-display-none");

            document
              .getElementById("audio-player-container")
              .classList.remove("ap-zindex-reader");
            document
              .getElementById("audio-player-container")
              .classList.add("ap-zindex-tools");
          }
        }
        break;

      case "show-modal-info":
        {
          showModalAlert(args[2], args[3], args[4]);
        }
        break;

      case "show-modal-about":
        {
          showModalAlert(args[2], args[3], args[4]);
          document
            .querySelector("#about-modal-link")
            .addEventListener("click", (event) => {
              reader.sendIpcToMain(
                "open-url-in-browser",
                "http://www.binarynonsense.com",
              );
            });
        }
        break;

      case "show-modal-checkversion":
        {
          showModalCheckUpdates(...args.slice(2));
        }
        break;

      case "log-to-console":
        {
          console.log(args[2]);
        }
        break;

      case "show-toast":
        {
          toasts.show(...args.slice(2));
        }
        break;

      case "show-toast-open-path-in-browser":
        {
          toasts.show(
            args[2],
            args[3],
            () => {
              reader.sendIpcToMain("open-path-in-browser", args[4]);
            },
            args[5],
          );
        }
        break;

      case "show-toast-update-available":
        {
          toasts.show(args[2], 5000, () => {
            reader.sendIpcToMain(
              "open-url-in-browser",
              "https://github.com/binarynonsense/comic-book-reader/releases/latest",
            );
          });
        }
        break;

      case "show-toast-open-url":
        {
          toasts.show(
            args[2],
            args[3],
            () => {
              reader.sendIpcToMain("open-url-in-browser", args[4]);
            },
            args[5],
          );
        }
        break;

      case "show-toast-ipc-core":
        {
          toasts.show(
            args[2],
            args[3],
            () => {
              sendIpcToMain(...args[4]);
            },
            args[5],
          );
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

export function showModalAlert(title, message, textButton1) {
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
  // if (getCurrentTool() === reader)
  //   reader.sendIpcToMain("rebuild-menu-and-toolbar", false);
}

async function showModalCheckUpdates(currentVersion, texts) {
  if (g_openModal) {
    return;
  }
  // Searching Modal
  g_openModal = modals.show({
    title: texts.titleSearching,
    message: " ",
    zIndexDelta: 5,
    frameWidth: 600,
    close: {
      callback: () => {
        modalClosed();
      },
      hide: true,
    },
    progressBar: {},
  });
  try {
    const response = await axios.get(
      `https://api.github.com/repos/binarynonsense/comic-book-reader/releases/latest`,
      { timeout: 15000 },
    );
    let latestVersion = response.data.tag_name;
    if (!latestVersion) {
      throw "error version";
    }
    latestVersion = latestVersion.replace("v", "");
    modals.close(g_openModal);

    const isOlder = isVersionOlder(currentVersion, latestVersion);
    let versionsText =
      "\n\n" +
      texts.infoCurrentVersion +
      ": " +
      currentVersion +
      "\n" +
      texts.infoLatestVersion +
      ": " +
      latestVersion;
    if (isOlder) {
      // Update Available Modal
      g_openModal = modals.show({
        title: texts.titleUpdateAvailable,
        message: texts.infoUpdateAvailable + versionsText,
        zIndexDelta: 10,
        close: {
          callback: () => {
            modalClosed();
          },
          key: "Escape",
        },
        buttons: [
          {
            text: texts.buttonOpen.toUpperCase(),
            callback: () => {
              modalClosed();
              reader.sendIpcToMain(
                "open-url-in-browser",
                "https://github.com/binarynonsense/comic-book-reader/releases/latest",
              );
            },
          },
          {
            text: texts.buttonClose.toUpperCase(),
            callback: () => {
              modalClosed();
            },
          },
        ],
      });
    } else {
      // Up to Date Modal
      g_openModal = modals.show({
        title: texts.titleUpToDate,
        message: texts.infoUpToDate + versionsText,
        zIndexDelta: 10,
        close: {
          callback: () => {
            modalClosed();
          },
          key: "Escape",
        },
        buttons: [
          {
            text: texts.buttonClose.toUpperCase(),
            callback: () => {
              modalClosed();
            },
          },
        ],
      });
    }
  } catch (error) {
    modals.close(g_openModal);
    // Error Modal
    g_openModal = modals.show({
      title: texts.titleError,
      message:
        error?.name === "AxiosError"
          ? texts.infoNetworkError.replace("{0}", "GitHub")
          : error,
      zIndexDelta: 10,
      close: {
        callback: () => {
          modalClosed();
        },
        key: "Escape",
      },
      buttons: [
        {
          text: texts.buttonClose.toUpperCase(),
          callback: () => {
            modalClosed();
          },
        },
      ],
    });
    // console.error(error);
  }

  // if (getCurrentTool() === reader)
  //   reader.sendIpcToMain("rebuild-menu-and-toolbar", false);
}

///////////////////////////////////////////////////////////////////////////////
// LANGUAGE DIRECTION /////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_languageDirection = "ltr";

function updateLanguageLocale(newLocale) {
  document.documentElement.setAttribute("lang", newLocale);
}

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

///////////////////////////////////////////////////////////////////////////////
// MENU BAR OBSERVER //////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_menuBarObserver;

// TITLE BAR HACK to support rtl direction !!!!!!
// Observe to know when a cet-menubar-menu-container is created and then
// override its position to flow from right to left, the rest is done in
// updateLanguageDirection
function initTitleBarObserver() {
  // old code only for rtl
  // if (g_languageDirection !== "rtl") {
  //   if (g_menuBarObserver !== undefined) {
  //     g_menuBarObserver.disconnect();
  //     g_menuBarObserver = undefined;
  //   }
  //   return;
  // }
  // if (g_menuBarObserver !== undefined) return;

  // new code: will always observe
  if (g_menuBarObserver !== undefined) {
    g_menuBarObserver.disconnect();
    g_menuBarObserver = undefined;
  }

  try {
    // ref: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
    const targetNode = document.querySelector(".cet-menubar");
    const config = { attributes: true, childList: true, subtree: true };
    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
        if (mutation.type === "childList") {
          // a child node has been added or removed
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            // keybindings names adjustments
            // TODO: this is a brute force approach, do something more
            // performant?
            const keybindings = targetNode.querySelectorAll(".keybinding");
            function getFormatedAccText(key) {
              let command = getNavKeys()[key][0];
              return getFormattedShortcut(command);
            }
            keybindings.forEach((keybinding) => {
              if (keybinding.tagName.toLowerCase() === "span") {
                if (keybinding.textContent === "acc-zoom-in") {
                  keybinding.textContent = getFormatedAccText("zoomInPage");
                } else if (keybinding.textContent === "acc-zoom-out") {
                  keybinding.textContent = getFormatedAccText("zoomOutPage");
                } else if (keybinding.textContent === "acc-zoom-reset") {
                  keybinding.textContent = getFormatedAccText("zoomResetPage");
                }
                ////
                else if (keybinding.textContent === "acc-hist") {
                  keybinding.textContent = getFormatedAccText("history");
                } else if (keybinding.textContent === "acc-file-open") {
                  keybinding.textContent = getFormatedAccText("openFile");
                } else if (keybinding.textContent === "acc-quit") {
                  keybinding.textContent = getFormatedAccText("quit");
                }
                ////
                else if (keybinding.textContent === "acc-scrollbar") {
                  keybinding.textContent =
                    getFormatedAccText("toggleScrollBar");
                } else if (keybinding.textContent === "acc-toolbar") {
                  keybinding.textContent = getFormatedAccText("toggleToolBar");
                } else if (keybinding.textContent === "acc-pagenum") {
                  keybinding.textContent =
                    getFormatedAccText("togglePageNumber");
                } else if (keybinding.textContent === "acc-clock") {
                  keybinding.textContent = getFormatedAccText("toggleClock");
                } else if (keybinding.textContent === "acc-battery") {
                  keybinding.textContent = getFormatedAccText(
                    "toggleBatteryStatus",
                  );
                }
                ////
                else if (keybinding.textContent === "acc-audio-player") {
                  keybinding.textContent =
                    getFormatedAccText("toggleAudioPlayer");
                } ////
                else if (keybinding.textContent === "acc-fullscreen") {
                  keybinding.textContent =
                    getFormatedAccText("toggleFullScreen");
                }
              }
            });
            // rtl adjustments
            if (g_languageDirection === "rtl") {
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
                        "cet-action-item",
                      )
                    ) {
                      // third level submenu
                      const parentRect =
                        node.parentNode.getBoundingClientRect();
                      const grandParentRect =
                        node.parentNode.parentNode.getBoundingClientRect();
                      node.style.top = `${
                        parentRect.top - grandParentRect.top
                      }px`;
                    } else {
                      // second level submenu
                      const parentRect =
                        node.parentNode.getBoundingClientRect();
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
      }
    };
    g_menuBarObserver = new MutationObserver(callback);
    g_menuBarObserver.observe(targetNode, config);
  } catch (error) {
    console.log(error);
  }
}

/* <li class="cet-action-item" role="presentation" tabindex="0">
  <a
    class="cet-action-menu-item"
    aria-checked="false"
    style="color: rgb(238, 238, 238);"
  >
    <span
      class="cet-menu-item-icon checkbox"
      role="none"
      style="color: rgb(238, 238, 238);"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M5 12l5 5l10 -10"></path>
      </svg>
    </span>
    <span class="cet-action-label">Audio Player</span>
    <span class="keybinding">Control+M</span>
  </a>
</li>; */
