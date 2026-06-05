/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as input from "../../shared/renderer/input.js";
import { sendIpcToMain, on } from "../renderer.js";
import { collapseAllToolbarMenus } from "./toolbar.js";
import {
  handleWheelEventScrollBoundaries,
  areScrollBoundariesEnabled,
} from "./scrollbar.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pagesContainerDiv;
let g_pinchZoomTimeOut;

let g_hideMouseCursor = false;
let g_mouseCursorTimer;
let g_isMouseCursorVisible = true;
let g_mouseCursorHideTime = 3500;

let g_navKeys;
export function getNavKeys() {
  return g_navKeys;
}
let g_navButtons;
let g_mouseButtonQuickMenu;
export function getMouseButtons() {
  return { quickMenu: g_mouseButtonQuickMenu };
}

export function getNavButtons() {
  return g_navButtons;
}

///////////////////////////////////////////////////////////////////////////////
// IPC ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function initInputOnIpcCallbacks() {
  on("set-hide-inactive-mouse-cursor", (hide) => {
    g_hideMouseCursor = hide;
  });

  on("set-nav-keys", (keys) => {
    g_navKeys = keys;
  });

  on("set-nav-buttons", (buttons) => {
    g_navButtons = buttons;
  });

  on("set-mousebutton-quickmenu", (value) => {
    g_mouseButtonQuickMenu = value;
  });
}

///////////////////////////////////////////////////////////////////////////////
// MOUSE //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: also called from home screen
export function onMouseMove(fileOpen) {
  if (g_mouseCursorTimer) {
    window.clearTimeout(g_mouseCursorTimer);
  }
  if (!g_isMouseCursorVisible) {
    document.querySelector("#reader").style.cursor = "default";
    g_isMouseCursorVisible = true;
  }
  if (!fileOpen) {
    document.querySelector("#reader").style.cursor = "default";
    g_isMouseCursorVisible = true;
  } else if (g_hideMouseCursor) {
    g_mouseCursorTimer = window.setTimeout(() => {
      g_mouseCursorTimer = undefined;
      document.querySelector("#reader").style.cursor = "none";
      g_isMouseCursorVisible = false;
    }, g_mouseCursorHideTime);
  }
}

///////////////////////////////////////////////////////////////////////////////
// EVENTS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  switch (type) {
    case "onkeydown":
      {
        if (
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowLeft" ||
          event.key === " " ||
          // event.key === "Enter" || // TODO: think about this one
          event.key === "Tab"
        ) {
          event.preventDefault();
        }
        // shortcuts
        if (input.checkShortcut("history", "history")) {
          event.stopPropagation();
          return;
        } else if (input.checkShortcut("openFile", "open-file")) {
          event.stopPropagation();
          return;
        }
        if (g_pagesContainerDiv.hasChildNodes()) {
          if (input.checkShortcut("toggleScrollBar", "scrollbar")) {
            return;
          } else if (input.checkShortcut("toggleToolBar", "toolbar")) {
            return;
          } else if (input.checkShortcut("togglePageNumber", "pagenum")) {
            return;
          } else if (input.checkShortcut("toggleClock", "clock")) {
            return;
          } else if (input.checkShortcut("toggleBatteryStatus", "battery")) {
            return;
          }
        }
        ////
        if (fileOpen) {
          // TODO: now that home screen handles its own input, if I'm here,
          // isn't it always open?
          if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.changePageNext,
              event: event,
            })
          ) {
            inputGoToNextPage();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.changePagePrev,
              event: event,
            })
          ) {
            inputGoToPrevPage();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.changePageRight,
              event: event,
            })
          ) {
            inputGoToRightPage();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.changePageLeft,
              event: event,
            })
          ) {
            inputGoToLeftPage();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.changePageFirst,
              event: event,
            })
          ) {
            inputGoToFirstPage();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.changePageLast,
              event: event,
            })
          ) {
            inputGoToLastPage();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.changePageMode,
              event: event,
            })
          ) {
            inputSwitchPageMode();
          } else if (
            input.isActionDown({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.scrollDown,
              event: event,
            })
          ) {
            inputScrollPageDown(!event.repeat);
            event.stopPropagation();
          } else if (
            input.isActionDown({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.scrollUp,
              event: event,
            })
          ) {
            inputScrollPageUp(!event.repeat);
            event.stopPropagation();
          } else if (
            input.isActionDown({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.scrollLeft,
              event: event,
            })
          ) {
            let container = document.querySelector("#reader");
            let amount = container.offsetWidth / 5;
            container.scrollBy({
              top: 0,
              left: -amount,
              behavior: "smooth",
            });

            event.stopPropagation();
          } else if (
            input.isActionDown({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.scrollRight,
              event: event,
            })
          ) {
            let container = document.querySelector("#reader");
            let amount = container.offsetWidth / 5;
            container.scrollBy({
              top: 0,
              left: amount,
              behavior: "smooth",
            });
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.zoomInPage,
              event: event,
            })
          ) {
            inputZoomIn();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.zoomOutPage,
              event: event,
            })
          ) {
            inputZoomOut();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.zoomResetPage,
              event: event,
            })
          ) {
            inputSwitchScaleMode();
            event.stopPropagation();
          } else if (
            input.isActionDownThisFrame({
              source: input.Source.KEYBOARD,
              commands: g_navKeys.fileProperties,
              event: event,
            })
          ) {
            inputOpenPropertiesModal();
            event.stopPropagation();
          }
        }

        if (event.key == "Escape") {
          if (!event.repeat) sendIpcToMain("escape-pressed");
        } else if (
          input.isActionDownThisFrame({
            source: input.Source.KEYBOARD,
            commands: g_navKeys.quickMenu,
            event: event,
          })
        ) {
          inputOpenQuickMenu();
          event.stopPropagation();
        }
      }
      break;

    case "acbr-click":
      {
        if (fileOpen) {
          if (
            event.target.classList.contains("page") ||
            event.target.classList.contains("pages-row") ||
            event.target.id === "page-canvas" ||
            event.target.classList.contains("epub-view") ||
            event.target.id === "pages-container" ||
            event.target.id === "reader"
          ) {
            collapseAllToolbarMenus();
            const mouseX = event.clientX;
            const bodyX = document.body.clientWidth;
            sendIpcToMain("mouse-click", mouseX, bodyX);
          }
        }
      }
      break;

    case "acbr-doubleclick":
      {
        if (fileOpen) {
          if (event.target.id === "reader") {
            inputSwitchScaleMode();
          }
        }
      }
      break;

    case "acbr-mouseup":
      {
        if (g_mouseButtonQuickMenu && event.button === g_mouseButtonQuickMenu) {
          inputOpenQuickMenu(false);
        }
      }
      break;

    // mouse right click: document.oncontextmenu

    case "body.ondrop":
      {
        if (event.dataTransfer.files && event.dataTransfer.files[0])
          sendIpcToMain(
            "open-file",
            ipc.showFilePath(event.dataTransfer.files[0]),
          );
      }
      break;

    case "mousemove":
      {
        onMouseMove(fileOpen);
      }
      break;

    case "acbr-onmousedownmove":
      {
        if (
          event &&
          event[2] &&
          event[2]?.target?.id === "toolbar-page-slider-input"
        ) {
          // ignore it, as it's moving the toolbar's slider
        } else {
          const reader = document.getElementById("reader");
          const container = document.getElementById("pages-container");
          const image = container?.firstChild;
          if (reader && container && image) {
            reader.scrollBy(-event[0], -event[1]);
          }
        }
      }
      break;

    case "acbr-pinchzoom":
      {
        if (fileOpen) {
          // NOTE: I'm having trouble testing this as my PC doesn't have a touch
          // screen, and going back and forth to my steamdeck with the build
          // is time consuming
          if (g_pinchZoomTimeOut === undefined) {
            // zoom at a constant rate
            g_pinchZoomTimeOut = setTimeout(() => {
              if (event.touchesDistance > event.prevTouchesDistance) {
                inputZoomIn();
              } else if (event.touchesDistance < event.prevTouchesDistance) {
                inputZoomOut();
              }
              g_pinchZoomTimeOut = undefined;
            }, 100);
          }
        }
      }
      break;

    case "wheel":
      {
        if (fileOpen) {
          if (event.ctrlKey) {
            if (event.deltaY < 0) {
              inputZoomIn();
            } else if (event.deltaY > 0) {
              inputZoomOut();
            }
          } else {
            handleWheelEventScrollBoundaries(event);
          }
        }
      }
      break;
  }
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPAD ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  const deltaTime = input.getGamepadsDeltaTime();
  const scrollFactor = deltaTime * 3;
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    // zoom in/ out
    if (
      input.isActionDown({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.zoomOutPage,
      })
    ) {
      inputZoomOut(deltaTime * 10);
    } else if (
      input.isActionDown({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.zoomInPage,
      })
    ) {
      inputZoomIn(deltaTime * 10);
    }
    // page up / down
    if (
      input.isActionDown({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.scrollDown,
      })
    ) {
      inputScrollPageDown(
        input.isActionDownThisFrame({
          source: input.Source.GAMEPAD,
          commands: g_navButtons.scrollDown,
        }),
        scrollFactor,
      );
    } else if (
      input.isActionDown({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.scrollUp,
      })
    ) {
      inputScrollPageUp(
        input.isActionDownThisFrame({
          source: input.Source.GAMEPAD,
          commands: g_navButtons.scrollUp,
        }),
        scrollFactor,
      );
    }
    // next / prev page
    else if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.changePageNext,
      })
    ) {
      inputGoToNextPage();
    } else if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.changePagePrev,
      })
    ) {
      inputGoToPrevPage();
    }
    // left / right page
    else if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.changePageLeft,
      })
    ) {
      inputGoToLeftPage();
    } else if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.changePageRight,
      })
    ) {
      inputGoToRightPage();
    }
    // last / first page
    else if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.changePageLast,
      })
    ) {
      inputGoToLastPage();
    } else if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.changePageFirst,
      })
    ) {
      inputGoToFirstPage();
    }
    // change scale mode
    if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.zoomResetPage,
      })
    ) {
      inputSwitchScaleMode();
    }
    // change page mode
    if (
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: g_navButtons.changePageMode,
      })
    ) {
      inputSwitchPageMode();
    }
  }
  // toggle full screen
  if (
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: g_navButtons.toggleFullScreen,
    })
  ) {
    inputToggleFullScreen();
  }
  // open quick menu
  if (
    input.isActionDownThisFrame({
      source: input.Source.GAMEPAD,
      commands: g_navButtons.quickMenu,
    })
  ) {
    inputOpenQuickMenu();
  }
}

///////////////////////////////////////////////////////////////////////////////
// ACTIONS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function inputScrollPageUp(checkEdge = true, factor = 1) {
  const reader = document.getElementById("reader");
  const container = document.getElementById("pages-container");
  const image = container?.firstChild;

  if (reader && container && image) {
    if (areScrollBoundariesEnabled() && checkEdge && reader.scrollTop <= 0) {
      inputGoToPrevPage();
    } else {
      const cs = getComputedStyle(reader);
      const readerHeight = reader.offsetHeight - parseFloat(cs.marginBottom);
      const scrollableHeight = Math.ceil(image.offsetHeight - readerHeight);

      if (scrollableHeight > 0) {
        const isRepeating = !checkEdge;
        const amount = isRepeating
          ? 10
          : Math.max(readerHeight / 100, (factor * scrollableHeight) / 5);
        reader.scrollBy({
          top: -amount,
          left: 0,
          behavior: isRepeating ? "auto" : "smooth",
        });
      }
    }
  }
}

function inputScrollPageDown(checkEdge = true, factor = 1) {
  const reader = document.getElementById("reader");
  const container = document.getElementById("pages-container");
  const image = container?.firstChild;

  if (reader && container && image) {
    if (
      areScrollBoundariesEnabled() &&
      checkEdge &&
      Math.abs(reader.scrollHeight - reader.scrollTop - reader.clientHeight) < 1
    ) {
      inputGoToNextPage();
    } else {
      const cs = getComputedStyle(reader);
      const readerHeight = reader.offsetHeight - parseFloat(cs.marginBottom);
      const scrollableHeight = Math.ceil(image.offsetHeight - readerHeight);

      if (scrollableHeight > 0) {
        const isRepeating = !checkEdge;
        const amount = isRepeating
          ? 10
          : Math.max(readerHeight / 100, (factor * scrollableHeight) / 5);
        reader.scrollBy({
          top: amount,
          left: 0,
          behavior: isRepeating ? "auto" : "smooth",
        });
      }
    }
  }
}

export function inputGoToNextPage() {
  sendIpcToMain("next-page-pressed");
}
export function inputGoToPrevPage() {
  sendIpcToMain("prev-page-pressed");
}

function inputGoToRightPage() {
  sendIpcToMain(
    "mouse-click",
    document.body.clientWidth,
    document.body.clientWidth,
  );
}
function inputGoToLeftPage() {
  sendIpcToMain("mouse-click", 0, document.body.clientWidth);
}
function inputGoToFirstPage() {
  sendIpcToMain("home-pressed");
}
function inputGoToLastPage() {
  sendIpcToMain("end-pressed");
}

function inputZoomIn(factor = 1) {
  sendIpcToMain("zoom-in-pressed", factor);
}
function inputZoomOut(factor = 1) {
  sendIpcToMain("zoom-out-pressed", factor);
}
function inputZoomReset() {
  sendIpcToMain("zoom-reset-pressed");
}

function inputSwitchScaleMode() {
  sendIpcToMain("switch-scale-mode");
}

function inputSwitchPageMode() {
  sendIpcToMain("switch-page-mode");
}

function inputToggleFullScreen() {
  sendIpcToMain("toolbar-button-clicked", "toolbar-button-fullscreen-enter");
}

export function inputOpenQuickMenu(showFocus = true) {
  sendIpcToMain("open-quick-menu", showFocus);
}

function inputOpenPropertiesModal() {
  sendIpcToMain("open-properties-modal");
}

function inputOpenHelpModal() {
  sendIpcToMain("open-help-modal");
}
