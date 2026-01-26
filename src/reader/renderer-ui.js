/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { on, sendIpcToMain, showNoBookContent } from "./renderer.js";
import * as modals from "../shared/renderer/modals.js";
import * as input from "../shared/renderer/input.js";

export function initIpc() {
  initOnIpcCallbacks();
  initModalsOnIpcCallbacks();
}

let BookType = {
  NOT_SET: "not set",
  COMIC: "comic",
  EBOOK: "ebook",
};

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

let g_turnPageOnScrollBoundary = true;
let g_filterMode = 0;
let g_showLoadingIndicator; // = true;

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initOnIpcCallbacks() {
  on("add-event-listeners", () => {
    addToolbarEventListeners();
  });
  on("update-loading", (isVisible) => {
    if (g_showLoadingIndicator && isVisible) {
      document.querySelector("#loading").classList.add("is-active");
    } else {
      document.querySelector("#loading").classList.remove("is-active");
    }
  });

  on("update-clock", (time) => {
    document.querySelector("#clock-bubble").innerHTML =
      "<span>" + time + "</span>";
  });

  on("init-battery", () => {
    const bubble = document.querySelector("#battery-bubble");
    // chargingchange
    // chargingtimechange
    // dischargingtimechange
    function setValue(battery) {
      bubble.innerHTML = `<span>${
        battery.charging
          ? `<i class="fa-solid ${
              battery.level === 1 ? "fa-plug" : "fa-plug-circle-bolt"
            }"></i> `
          : ""
      }${(battery.level * 100).toFixed(0)}%</span>`;
    }
    navigator.getBattery().then(function (battery) {
      setValue(battery);
      battery.addEventListener("levelchange", function () {
        setValue(this);
      });
      battery.addEventListener("chargingchange", function () {
        setValue(this);
      });
    });
  });

  on(
    "update-loading-indicator",
    (loadingIndicatorBG, loadingIndicatorIconSize, loadingIndicatorIconPos) => {
      if (loadingIndicatorBG === 0) {
        document.documentElement.style.setProperty("--li-bg-alpha", 0);
      } else {
        document.documentElement.style.setProperty("--li-bg-alpha", 0.1);
      }
      if (loadingIndicatorIconSize === 0) {
        document.documentElement.style.setProperty("--li-icon-size", "30px");
        document.documentElement.style.setProperty(
          "--li-icon-thickness",
          "4px",
        );
      } else {
        document.documentElement.style.setProperty("--li-icon-size", "65px");
        document.documentElement.style.setProperty(
          "--li-icon-thickness",
          "8px",
        );
      }
      if (loadingIndicatorIconPos === 0) {
        document.documentElement.style.setProperty(
          "--li-icon-align-self",
          "normal",
        );
        document.documentElement.style.setProperty(
          "--li-icon-justify-self",
          "left",
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-full",
          "10px",
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-win",
          "40px",
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-left",
          "10px",
        );
      } else {
        document.documentElement.style.setProperty(
          "--li-icon-align-self",
          "center",
        );
        document.documentElement.style.setProperty(
          "--li-icon-justify-self",
          "center",
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-full",
          "0px",
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-win",
          "0px",
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-left",
          "0px",
        );
      }
    },
  );

  on("update-layout-pos", (value, id) => {
    const element = document.querySelector(id);
    element.className = "";
    element.classList.add("info-bubble");
    let anchor;
    switch (value) {
      case 0:
        anchor = document.getElementById("info-anchor-topleft");
        break;
      case 1:
        anchor = document.getElementById("info-anchor-topcenter");
        break;
      case 2:
        anchor = document.getElementById("info-anchor-topright");
        break;
      case 3:
        anchor = document.getElementById("info-anchor-bottomleft");
        break;
      case 4:
        anchor = document.getElementById("info-anchor-bottomcenter");
        break;
      case 5:
        anchor = document.getElementById("info-anchor-bottomright");
        break;
    }
    anchor.appendChild(element);
  });

  on("update-bg", (show) => {
    if (show) showNoBookContent(true);
    else showNoBookContent(false);
  });

  on("update-toolbar-menus-collapse-all", () => {
    collapseAllToolbarMenus();
  });

  on("update-toolbar-direction", (dir) => {
    document.querySelector("#toolbar").style.direction = dir;
  });

  on(
    "update-toolbar-tooltips",
    (
      tOpenFile,
      tPrevious,
      tNext,
      tRotateCounter,
      tRotateClock,
      tFullScreen,

      tCollapse,
      tZoom,
      tZoomModes,
      tPageMode,
      tPageModeModes,
      tPagesDirection,
      tPagesDirectionModes,
    ) => {
      document.querySelector("#toolbar-button-open-href").title = tOpenFile;
      document.querySelector("#toolbar-button-left-href").title = tPrevious;
      document.querySelector("#toolbar-button-right-href").title = tNext;
      document.querySelector(
        "#toolbar-button-rotate-counterclockwise-href",
      ).title = tRotateCounter;
      document.querySelector("#toolbar-button-rotate-clockwise-href").title =
        tRotateClock;
      document.querySelector("#toolbar-button-fullscreen-enter-href").title =
        tFullScreen;
      document.querySelector("#toolbar-button-fullscreen-exit-href").title =
        tFullScreen;
      setToolbarMenuButtonLocalization(
        "toolbar-button-zoom",
        tCollapse,
        tZoom,
        tZoomModes,
      );
      setToolbarMenuButtonLocalization(
        "toolbar-button-pagemode",
        tCollapse,
        tPageMode,
        tPageModeModes,
      );
      setToolbarMenuButtonLocalization(
        "toolbar-button-pagesdirection",
        tCollapse,
        tPagesDirection,
        tPagesDirectionModes,
      );
    },
  );

  on("update-toolbar-rotation-buttons", (areEnabled) => {
    const button1 = document.querySelector("#toolbar-button-rotate-clockwise");
    const button2 = document.querySelector(
      "#toolbar-button-rotate-counterclockwise",
    );
    if (areEnabled) {
      button1.classList.remove("set-no-click");
      button2.classList.remove("set-no-click");
      button1.classList.remove("set-low-opacity");
      button2.classList.remove("set-low-opacity");
    } else {
      button1.classList.add("set-no-click");
      button2.classList.add("set-no-click");
      button1.classList.add("set-low-opacity");
      button2.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-page-buttons", (areEnabled) => {
    const button1 = document.querySelector("#toolbar-button-left");
    const button2 = document.querySelector("#toolbar-button-right");
    if (areEnabled) {
      button1.classList.remove("set-no-click");
      button2.classList.remove("set-no-click");
      button1.classList.remove("set-low-opacity");
      button2.classList.remove("set-low-opacity");
    } else {
      button1.classList.add("set-no-click");
      button2.classList.add("set-no-click");
      button1.classList.add("set-low-opacity");
      button2.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-zoom-buttons", (areEnabled) => {
    const button = document.querySelector("#toolbar-button-zoom");
    if (areEnabled) {
      button.classList.remove("set-no-click");
      button.classList.remove("set-low-opacity");
    } else {
      button.classList.add("set-no-click");
      button.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-pagemode-buttons", (areEnabled) => {
    const button = document.querySelector("#toolbar-button-pagemode");
    if (areEnabled) {
      button.classList.remove("set-no-click");
      button.classList.remove("set-low-opacity");
    } else {
      button.classList.add("set-no-click");
      button.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-pagesdirection-buttons", (areEnabled) => {
    const button = document.querySelector("#toolbar-button-pagesdirection");
    if (areEnabled) {
      button.classList.remove("set-no-click");
      button.classList.remove("set-low-opacity");
    } else {
      button.classList.add("set-no-click");
      button.classList.add("set-low-opacity");
    }
  });

  on("set-scrollbar-visibility", (isVisible) => {
    showScrollBar(isVisible);
  });

  on("set-scrollbar-position", (position) => {
    setScrollBarsPosition(position);
  });

  on("set-menubar-visibility", (isVisible) => {
    showMenuBar(isVisible);
  });

  on("set-toolbar-visibility", (isVisible) => {
    showToolBar(isVisible);
  });

  on("set-page-number-visibility", (isVisible) => {
    showPageNumber(isVisible);
  });

  on("set-clock-visibility", (isVisible) => {
    showClock(isVisible);
  });

  on("set-battery-visibility", (isVisible) => {
    showBattery(isVisible);
  });

  on("set-loading-indicator", (isVisible) => {
    showLoadingIndicator(isVisible);
  });

  on("set-fullscreen-ui", (isFullscreen) => {
    setFullscreenUI(isFullscreen);
  });

  on("set-page-mode", (...args) => {
    setPageMode(...args);
  });

  on("set-fit-to-width", () => {
    setFitToWidth();
  });

  on("set-fit-to-height", () => {
    setFitToHeight();
  });

  on("set-scale-to-height", (scale) => {
    setScaleToHeight(scale);
  });

  on("try-zoom-scale-from-width", (increment) => {
    const page = document.querySelector("#pages-container");
    const img = page.firstChild;
    const imgHeight = img.offsetHeight;
    const vh = Math.min(
      document.documentElement.clientHeight || 0,
      window.innerHeight || 0,
    );
    // TODO: not getting exactly the value I want, cheat by using the 1.1 multiplier for now
    let scale = parseInt((imgHeight / vh) * 100 * (increment > 0 ? 1.1 : 1));
    scale += increment;
    sendIpcToMain("set-scale-mode", scale);
  });

  on("set-page-turn-on-scroll-boundary", (value) => {
    g_turnPageOnScrollBoundary = value;
  });

  on("render-page-info", (pageNum, numPages, isPercentage) => {
    updatePageInfo(pageNum, numPages, isPercentage);
  });

  on("set-filter", (value) => {
    g_filterMode = value;
    let pages = document.querySelectorAll(".page");
    pages.forEach((page) => {
      setFilterClass(page);
    });
  });

  on("set-pages-direction", (value) => {
    setToolbarMenuButtonIcon(
      "toolbar-button-pagesdirection",
      value == "ltr" ? 0 : 1,
    );
    document
      .querySelector("#toolbar-page-slider-div")
      .setAttribute("dir", value);
    if (value === "rtl") {
      document.querySelector("#pages-container").classList.add("pages-rtl");
    } else {
      document.querySelector("#pages-container").classList.remove("pages-rtl");
    }
  });

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
// MODIFIERS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showScrollBar(isVisible) {
  // ref: https://stackoverflow.com/questions/4481485/changing-css-pseudo-element-styles-via-javascript
  if (isVisible) {
    // generic:
    document.body.classList.remove("hidden-scrollbar");
    // if custom title bar enabled:
    document.querySelector("#reader").classList.remove("hidden-scrollbar");
  } else {
    // generic:
    document.body.classList.add("hidden-scrollbar");
    // if custom title bar enabled:
    document.querySelector("#reader").classList.add("hidden-scrollbar");
  }
}

function showMenuBar(isVisible) {
  if (isVisible) {
    document
      .querySelector(".cet-titlebar")
      .classList.remove("set-display-none");
    document.querySelector("#reader").classList.remove("set-top-zero");

    document
      .querySelector("#loading-spinner")
      .classList.remove("is-full-screen");
  } else {
    document.querySelector(".cet-titlebar").classList.add("set-display-none");
    document.querySelector("#reader").classList.add("set-top-zero");

    document.querySelector("#loading-spinner").classList.add("is-full-screen");
  }
  updateZoom();
}

function showToolBar(isVisible) {
  if (isVisible) {
    document.querySelector("#toolbar").classList.remove("set-display-none");
    document
      .querySelector("#reader")
      .classList.remove("set-margin-bottom-zero");
    document.documentElement.style.setProperty("--toolbar-height", "30px");
  } else {
    document.querySelector("#toolbar").classList.add("set-display-none");
    document.querySelector("#reader").classList.add("set-margin-bottom-zero");
    document.documentElement.style.setProperty("--toolbar-height", "0px");
  }
  updateZoom();
}

function showPageNumber(isVisible) {
  if (isVisible) {
    document
      .querySelector("#page-number-bubble")
      .classList.remove("set-display-none");
  } else {
    document
      .querySelector("#page-number-bubble")
      .classList.add("set-display-none");
  }
}

function showClock(isVisible) {
  if (isVisible) {
    document
      .querySelector("#clock-bubble")
      .classList.remove("set-display-none");
  } else {
    document.querySelector("#clock-bubble").classList.add("set-display-none");
  }
}

function showBattery(isVisible) {
  if (isVisible) {
    document
      .querySelector("#battery-bubble")
      .classList.remove("set-display-none");
  } else {
    document.querySelector("#battery-bubble").classList.add("set-display-none");
  }
}

function showLoadingIndicator(isVisible) {
  g_showLoadingIndicator = isVisible;
}

function setFullscreenUI(isFullscreen) {
  let buttonEnter = document.querySelector("#toolbar-button-fullscreen-enter");
  let buttonExit = document.querySelector("#toolbar-button-fullscreen-exit");
  if (isFullscreen) {
    buttonEnter.classList.add("set-display-none");
    buttonExit.classList.remove("set-display-none");
    document.documentElement.style.setProperty("--menubar-height", "0px");
  } else {
    buttonEnter.classList.remove("set-display-none");
    buttonExit.classList.add("set-display-none");
    document.documentElement.style.setProperty("--menubar-height", "30px");
  }
  updateZoom();
}

let g_pageMode = 0;

export function getPageMode() {
  return g_pageMode;
}

function setPageMode(value, canBeChanged) {
  g_pageMode = value;

  setToolbarMenuButtonIcon("toolbar-button-pagemode", value);
}

function setFitToWidth() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-scale-to-height");
  container.classList.remove("set-fit-to-height");
  container.classList.add("set-fit-to-width");

  setToolbarMenuButtonIcon("toolbar-button-zoom", 1);
}

function setFitToHeight() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-scale-to-height");
  container.classList.remove("set-fit-to-width");
  container.classList.add("set-fit-to-height");

  setToolbarMenuButtonIcon("toolbar-button-zoom", 0);
}

function setScaleToHeight(scale) {
  setZoomHeightCssVars(scale);
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-fit-to-width");
  container.classList.remove("set-fit-to-height");
  container.classList.add("set-scale-to-height");

  setToolbarMenuButtonIcon("toolbar-button-zoom", 2);
}

function setZoomHeightCssVars(scale) {
  if (scale !== undefined)
    document.documentElement.style.setProperty(
      "--zoom-height-scale",
      `${scale}`,
    );

  let isTitlebarHidden = document
    .querySelector(".cet-titlebar")
    .classList.contains("set-display-none");
  let isToolbarHidden = document
    .querySelector("#toolbar")
    .classList.contains("set-display-none");

  let border = 0;
  if (!isTitlebarHidden) border += 30;
  if (!isToolbarHidden) border += 30;
  document.documentElement.style.setProperty(
    "--zoom-height-borders",
    `${border}px`,
  );
}

function updateZoom() {
  setZoomHeightCssVars();
}

function moveScrollBarsToStart() {
  document.querySelector("#reader").scrollTop = 0;
  document.querySelector("#reader").scrollLeft = 0;
}

function moveScrollBarsToEnd() {
  document.querySelector("#reader").scrollTop =
    document.querySelector("#reader").scrollHeight;
  document.querySelector("#reader").scrollLeft =
    document.querySelector("#reader").scrollWidth;
}

export function setScrollBarsPosition(position) {
  if (position === 0) {
    moveScrollBarsToStart();
  } else if (position === 1) {
    moveScrollBarsToEnd();
  }
}

export function setFilterClass(element) {
  if (g_filterMode === 0) element.classList.remove("page-filter-old-page");
  else if (g_filterMode === 1) element.classList.add("page-filter-old-page");
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pagesContainerDiv;
let g_pinchZoomTimeOut;

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
            container.scrollBy(-amount, 0);
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
            container.scrollBy(amount, 0);
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
            // inputZoomReset();
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
          // is time consuming and can't easily debug things
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
          } else if (g_turnPageOnScrollBoundary) {
            let container = document.querySelector("#reader");
            if (
              event.deltaY > 0 &&
              Math.abs(
                container.scrollHeight -
                  container.scrollTop -
                  container.clientHeight,
              ) < 1
            ) {
              // reached bottom
              inputGoToNextPage();
            } else if (event.deltaY < 0 && container.scrollTop <= 0) {
              // reached top
              inputGoToPrevPage();
            }
          }
        }
      }
      break;
  }
}

function inputScrollPageUp(checkEdge = true, factor = 1) {
  const reader = document.getElementById("reader");
  const container = document.getElementById("pages-container");
  const image = container?.firstChild;
  if (reader && container && image) {
    if (g_turnPageOnScrollBoundary && checkEdge && reader.scrollTop <= 0) {
      inputGoToPrevPage();
    } else {
      const cs = getComputedStyle(reader);
      const readerHeight = reader.offsetHeight - parseFloat(cs.marginBottom);
      const scrollableHeight = Math.ceil(image.offsetHeight - readerHeight);
      if (scrollableHeight > 0) {
        const amount = Math.max(
          readerHeight / 100,
          (factor * scrollableHeight) / 5,
        );
        reader.scrollBy(0, -amount);
      }
    }
  }
}

function inputScrollPageDown(checkEdge = true, factor = 1) {
  const reader = document.getElementById("reader");
  const container = document.getElementById("pages-container");
  const image = container.firstChild;
  if (reader && container && image) {
    if (
      g_turnPageOnScrollBoundary &&
      checkEdge &&
      Math.abs(reader.scrollHeight - reader.scrollTop - reader.clientHeight) < 1
    ) {
      inputGoToNextPage();
    } else {
      const cs = getComputedStyle(reader);
      const readerHeight = reader.offsetHeight - parseFloat(cs.marginBottom);
      const scrollableHeight = Math.ceil(image.offsetHeight - readerHeight);
      if (scrollableHeight > 0) {
        const amount = Math.max(
          readerHeight / 100,
          (factor * scrollableHeight) / 5,
        );
        reader.scrollBy(0, amount);
      }
    }
  }
}

function inputGoToNextPage() {
  sendIpcToMain("next-page-pressed");
}
function inputGoToPrevPage() {
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

// NOTE: also called from home screen
export function onMouseMove(fileOpen) {
  if (g_mouseCursorTimer) {
    window.clearTimeout(g_mouseCursorTimer);
  }
  if (!g_isMouseCursorVisible) {
    //document.body.style.cursor = "default";
    document.querySelector("#reader").style.cursor = "default";
    g_isMouseCursorVisible = true;
  }
  if (!fileOpen) {
    document.querySelector("#reader").style.cursor = "default";
    g_isMouseCursorVisible = true;
  } else if (g_hideMouseCursor) {
    g_mouseCursorTimer = window.setTimeout(() => {
      g_mouseCursorTimer = undefined;
      //document.body.style.cursor = "none";
      document.querySelector("#reader").style.cursor = "none";
      g_isMouseCursorVisible = false;
    }, g_mouseCursorHideTime);
  }
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPAD ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function getNavButtons() {
  return g_navButtons;
}

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
// TOOLBAR ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function addToolbarMenuButtonEvent(buttonName) {
  const button = document.getElementById(buttonName);
  if (!button) return;
  //expand
  button.children[0].addEventListener("click", (event) => {
    collapseAllToolbarMenus();
    expandToolbarMenuButton(buttonName, true);
  });
  // collapse
  button.children[1].addEventListener("click", (event) => {
    collapseAllToolbarMenus();
    expandToolbarMenuButton(buttonName, false);
  });
  // menu buttons
  const menu = button.children[2];
  for (let index = 0; index < menu.children.length; index++) {
    const element = menu.children[index];
    element.addEventListener("click", (event) => {
      button.children[0].classList.remove("set-display-none");
      button.children[1].classList.add("set-display-none");
      button.children[2].classList.add("set-display-none");
      sendIpcToMain("toolbar-button-clicked", `${buttonName}-menu-${index}`);
    });
  }
}

function expandToolbarMenuButton(buttonName, value) {
  const button = document.getElementById(buttonName);
  if (value === true) {
    button.children[0].classList.add("set-display-none");
    button.children[1].classList.remove("set-display-none");
    button.children[2].classList.remove("set-display-none");
    // menu buttons
    const menu = button.children[2];
    for (let index = 0; index < menu.children.length; index++) {
      const element = menu.children[index];
      if (button.children[0].innerHTML === element.innerHTML) {
        element.classList.add("toolbar-button-menu-child-highlight");
      } else {
        element.classList.remove("toolbar-button-menu-child-highlight");
      }
    }
  } else {
    button.children[0].classList.remove("set-display-none");
    button.children[1].classList.add("set-display-none");
    button.children[2].classList.add("set-display-none");
  }
}

function collapseAllToolbarMenus() {
  const menus = document.querySelectorAll(".toolbar-button-menu");
  menus.forEach((menu) => {
    expandToolbarMenuButton(menu.parentElement.id, false);
  });
}

function setToolbarMenuButtonIcon(buttonName, buttonIndex) {
  const button = document.getElementById(buttonName);
  if (!button) return;
  const menu = button.children[2];
  button.children[0].innerHTML = menu.children[buttonIndex].innerHTML;
}

function setToolbarMenuButtonLocalization(
  buttonName,
  tCollapse,
  titleLocalization,
  menuLocalization,
) {
  const button = document.getElementById(buttonName);
  button.children[0].title = titleLocalization;
  button.children[1].title = tCollapse;
  // menu buttons
  const menu = button.children[2];
  for (let index = 0; index < menu.children.length; index++) {
    const element = menu.children[index];
    element.title = menuLocalization[index];
  }
}

////////////////

function addButtonEvent(buttonName) {
  document.getElementById(buttonName).addEventListener("click", (event) => {
    collapseAllToolbarMenus();
    sendIpcToMain("toolbar-button-clicked", buttonName);
  });
}

function addToolbarEventListeners() {
  addButtonEvent("toolbar-button-rotate-clockwise");
  addButtonEvent("toolbar-button-rotate-counterclockwise");
  addButtonEvent("toolbar-button-right");
  addButtonEvent("toolbar-button-left");
  addToolbarMenuButtonEvent("toolbar-button-pagemode");
  addToolbarMenuButtonEvent("toolbar-button-pagesdirection");
  addToolbarMenuButtonEvent("toolbar-button-zoom");
  addButtonEvent("toolbar-button-fullscreen-enter");
  addButtonEvent("toolbar-button-fullscreen-exit");
  addButtonEvent("toolbar-button-open");

  document
    .getElementById("toolbar-page-slider-input")
    .addEventListener("mouseup", (event) => {
      collapseAllToolbarMenus();
      sendIpcToMain("toolbar-slider-changed", event.currentTarget.value);
    });
  document
    .getElementById("toolbar-page-slider-input")
    .addEventListener("input", (event) => {
      if (g_toolbarSliderIsPercentage) {
        document.getElementById("toolbar-page-numbers").innerHTML =
          `${event.currentTarget.value}.00%`;
      } else {
        document.getElementById("toolbar-page-numbers").innerHTML =
          event.currentTarget.value + " / " + event.currentTarget.max;
      }
    });
}

let g_toolbarSliderIsPercentage = false;

export function updatePageInfo(pageNum, numPages, isPercentage) {
  g_toolbarSliderIsPercentage = isPercentage;
  if (isPercentage) {
    document.getElementById("toolbar-page-slider-input").max = 100;
    document.getElementById("toolbar-page-slider-input").min = 0;
    document.getElementById("toolbar-page-slider-input").value = pageNum;
    document.getElementById("toolbar-page-numbers").innerHTML = `${Number(
      pageNum,
    ).toFixed(2)}%`;
    document.getElementById("page-number-bubble").innerHTML = `<span>${Number(
      pageNum,
    ).toFixed(2)}%</span>`;
  } else {
    if (numPages === 0) pageNum = -1; // hack to make it show 00 / 00 @ start
    document.getElementById("toolbar-page-slider-input").max = numPages;
    document.getElementById("toolbar-page-slider-input").min = 1;
    document.getElementById("toolbar-page-slider-input").value = pageNum + 1;

    let currentPageText = `${pageNum + 1} / ${numPages}`;
    if (g_pageMode === 1) {
      if (numPages > 1 && pageNum + 1 < numPages) {
        currentPageText = `${pageNum + 1}-${pageNum + 2} / ${numPages}`;
        document.getElementById("toolbar-page-slider-input").value =
          pageNum + 2;
      }
    } else if (g_pageMode === 2) {
      if (numPages > 1 && pageNum !== 0 && pageNum + 1 < numPages) {
        currentPageText = `${pageNum + 1}-${pageNum + 2} / ${numPages}`;
        document.getElementById("toolbar-page-slider-input").value =
          pageNum + 2;
      }
    }
    document.getElementById("toolbar-page-numbers").innerHTML = currentPageText;
    document.getElementById("page-number-bubble").innerHTML =
      "<span>" + currentPageText + "</span>";

    // calc page text space so slider doesn't change sizes too widely
    let numChars = numPages.toString().length * (g_pageMode == 0 ? 2 : 3) + 5;
    document.getElementById("toolbar-page-numbers").style.minWidth =
      `${numChars}ch`;
  }
}

///////////////////////////////////////////////////////////////////////////////
// IMAGE BUFFERS //////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function renderImageBuffers(
  images,
  rotation,
  scrollBarPos,
  sendPageLoaded,
  fromRefresh,
) {
  const containerDiv = document.getElementById("pages-container");

  let title;
  if (fromRefresh) {
    let img = document.querySelector(".page");
    if (img) title = img.title;
  }

  const isDoublePages = images.length === 2;

  if (rotation === 0 || rotation === 180) {
    //// setup ////
    let pagesLoaded = 0;
    let page1Img, page2Img;
    page1Img = new Image();
    assignImageToImgSrc(images[0], page1Img);
    page1Img.classList.add("page-img");
    page1Img.classList.add("page");
    if (title && title != "") page1Img.title = title;
    if (rotation === 180) {
      page1Img.classList.add("set-rotate-180");
    }
    ////
    const pagesRowDiv = document.createElement("div");
    pagesRowDiv.classList.add("pages-row");
    if (isDoublePages) {
      page2Img = new Image();
      assignImageToImgSrc(images[1], page2Img);
      page2Img.classList.add("page-img");
      page2Img.classList.add("page");
      page1Img.classList.add("page-1");
      page2Img.classList.add("page-2");
      if (title && title != "") page2Img.title = title;
      if (rotation === 180) {
        page2Img.classList.add("set-rotate-180");
      }
      pagesRowDiv.classList.add("pages-row-2p");
      pagesRowDiv.innerHTML = "";
      setFilterClass(page2Img);
    } else {
      if (getPageMode() !== 0) {
        pagesRowDiv.classList.add("pages-row-2p");
        page1Img.classList.add("page-centered");
      }
    }
    setFilterClass(page1Img);
    //// check function ////
    function checkImageResults() {
      if (
        (!isDoublePages && pagesLoaded >= 1) ||
        (isDoublePages && pagesLoaded >= 2)
      ) {
        if (sendPageLoaded) {
          sendIpcToMain("page-loaded", {
            dimensions: [page1Img.naturalWidth, page1Img.naturalHeight],
          });
        }
        if (page1Img) pagesRowDiv.appendChild(page1Img);
        if (page2Img) pagesRowDiv.appendChild(page2Img);
        containerDiv.innerHTML = "";
        containerDiv.appendChild(pagesRowDiv);
        if (scrollBarPos !== undefined) setScrollBarsPosition(scrollBarPos);
      }
    }
    //// events ///
    page1Img.onload = function () {
      pagesLoaded++;
      checkImageResults();
    };
    page1Img.onerror = function () {
      page1Img.src = "../assets/images/error_page.png";
    };
    if (isDoublePages) {
      page2Img.onload = function () {
        pagesLoaded++;
        const totalWidth = page1Img.naturalWidth + page2Img.naturalWidth;
        document.documentElement.style.setProperty(
          "--zoom-width-page1",
          `${(100 * page1Img.naturalWidth) / totalWidth}%`,
        );
        document.documentElement.style.setProperty(
          "--zoom-width-page2",
          `${(100 * page2Img.naturalWidth) / totalWidth}%`,
        );
        checkImageResults();
      };
      page2Img.onerror = function () {
        page2Img.src = "../assets/images/error_page.png";
      };
    }
  }
  // I use a different method here, I prefer the look of images in <img> when resizing but can't make them rotate
  // as I like, so I'll try canvas for these rotations
  else if (rotation === 90 || rotation === 270) {
    var canvas = document.createElement("canvas");
    canvas.classList.add("page-canvas");
    canvas.classList.add("page");
    if (title && title != "") canvas.title = title;
    containerDiv.innerHTML = "";
    const pagesRowDiv = document.createElement("div");
    pagesRowDiv.classList.add("pages-row");
    containerDiv.appendChild(pagesRowDiv);
    pagesRowDiv.innerHTML = "";
    pagesRowDiv.appendChild(canvas);
    setFilterClass(canvas);
    var context = canvas.getContext("2d");
    var image = new Image();
    image.onload = function () {
      // ref: https://stackoverflow.com/questions/44076873/resize-image-and-rotate-canvas-90-degrees
      // TODO: use naturalWidth & naturalHeight???
      canvas.width = image.height;
      canvas.height = image.width;
      if (rotation === 90) {
        context.setTransform(
          0, // hScale
          1, // vSkew
          -1, // hSkew
          0, // vScale
          image.height, // hTrans
          0, // vTrans
        );
      } else if (rotation === 270) {
        context.setTransform(
          0, // hScale
          -1, // vSkew
          1, // hSkew
          0, // vScale
          0, // hTrans
          image.width, // vTrans
        );
      }
      context.drawImage(image, 0, 0);
      context.setTransform(1, 0, 0, 1, 0, 0); // restore default
      if (sendPageLoaded) {
        sendIpcToMain("page-loaded", {
          dimensions: [image.naturalWidth, image.naturalHeight],
        });
      }
      if (scrollBarPos !== undefined) setScrollBarsPosition(scrollBarPos);
    };
    image.onerror = function () {
      image.src = "../assets/images/error_page.png";
    };
    assignImageToImgSrc(images[0], image);
  }
}

function assignImageToImgSrc(image, imgElement) {
  if (image.url) {
    imgElement.src = image.url;
  } else if (image.buffer) {
    const blob = new Blob([image.buffer], { type: image.mime });
    const url = URL.createObjectURL(blob);
    if (imgElement.src.startsWith("blob:")) {
      URL.revokeObjectURL(imgElement.src);
    }
    imgElement.src = url;
  }
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

// NOTE: called from home-screen renderer
export function showModal(config) {
  g_openModal = modals.show(config);
}

export function modalClosed() {
  g_openModal = undefined;
}

function initModalsOnIpcCallbacks() {
  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });

  on(
    "show-modal-prompt",
    (question, defaultValue, textButton1, textButton2, mode = 0) => {
      showModalPrompt(question, defaultValue, textButton1, textButton2, mode);
    },
  );

  on("show-modal-prompt-password", (...args) => {
    showModalPromptPassword(...args);
  });

  on("show-modal-info", (...args) => {
    showModalAlert(...args);
  });

  on("show-modal-question-openas", (...args) => {
    showModalQuestionOpenAs(...args);
  });

  on("show-modal-request-open-confirmation", (...args) => {
    showModalRequestOpenConfirmation(...args);
  });

  on("show-modal-properties", (...args) => {
    showModalProperties(...args);
  });

  on("show-modal-quick-menu", (...args) => {
    showModalQuickMenu(...args);
  });
}

function showModalPrompt(
  question,
  defaultValue,
  textButton1,
  textButton2,
  mode = 0,
) {
  if (g_openModal) {
    return;
  }
  if (mode === 0) {
    g_openModal = modals.show({
      title: question,
      message: defaultValue,
      zIndexDelta: -450,
      input: {},
      close: {
        callback: () => {
          modalClosed();
        },
        key: "Escape",
      },
      buttons: [
        {
          text: textButton1.toUpperCase(),
          callback: (showFocus, value) => {
            sendIpcToMain("go-to-page", value);
            modalClosed();
          },
          key: "Enter",
        },
        {
          text: textButton2.toUpperCase(),
          callback: () => {
            modalClosed();
          },
        },
      ],
    });
  } else if (mode === 1) {
    g_openModal = modals.show({
      title: question,
      message: defaultValue,
      zIndexDelta: -450,
      input: {},
      close: {
        callback: () => {
          modalClosed();
        },
        key: "Escape",
      },
      buttons: [
        {
          text: textButton1.toUpperCase(),
          callback: (showFocus, value) => {
            sendIpcToMain("enter-scale-value", parseInt(value));
            modalClosed();
          },
          key: "Enter",
        },
        {
          text: textButton2.toUpperCase(),
          callback: () => {
            modalClosed();
          },
        },
      ],
    });
  }
  if (mode === 2) {
    g_openModal = modals.show({
      title: question,
      message: defaultValue,
      zIndexDelta: -450,
      input: {},
      close: {
        callback: () => {
          modalClosed();
        },
        key: "Escape",
      },
      buttons: [
        {
          text: textButton1.toUpperCase(),
          callback: (showFocus, value) => {
            sendIpcToMain("go-to-percentage", value);
            modalClosed();
          },
          key: "Enter",
        },
        {
          text: textButton2.toUpperCase(),
          callback: () => {
            modalClosed();
          },
        },
      ],
    });
  }
}

function showModalPromptPassword(title, message, textButton1, textButton2) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
    input: { type: "password" },
    close: {
      callback: () => {
        sendIpcToMain("password-canceled");
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: (showFocus, value) => {
          sendIpcToMain("password-entered", value);
          modalClosed();
        },
        key: "Enter",
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          sendIpcToMain("password-canceled");
          modalClosed();
        },
      },
    ],
  });
}

function showModalAlert(title, message, textButton1) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
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
}

function showModalQuestionOpenAs(
  title,
  message,
  textButton1,
  textButton2,
  filePath,
) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
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
          sendIpcToMain("booktype-entered", filePath, BookType.COMIC);
          modalClosed();
        },
        key: "Enter",
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          sendIpcToMain("booktype-entered", filePath, BookType.EBOOK);
          modalClosed();
        },
      },
    ],
  });
}

function showModalRequestOpenConfirmation(
  title,
  message,
  textButton1,
  textButton2,
  filePath,
) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
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
          sendIpcToMain("open-file", filePath);
          modalClosed();
        },
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}

function showModalProperties(title, message, textButton1, textButton2) {
  if (g_openModal) {
    return;
  }
  let buttons = [];
  if (textButton2) {
    buttons.push({
      text: textButton2.toUpperCase(),
      callback: () => {
        modalClosed();
        sendIpcToMain("open-metadata-tool");
      },
    });
  }
  buttons.push({
    text: textButton1.toUpperCase(),
    callback: () => {
      modalClosed();
    },
  });
  g_openModal = modals.show({
    title: title,
    log: { message: message, useDiv: true },
    frameWidth: 600,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

function showModalQuickMenu(
  title,
  textButtonBack,
  textCloseFile,
  textButtonFileBrowser,
  textButtonHistory,
  textButtonFullscreen,
  textButtonQuit,
  showFocus,
) {
  if (g_openModal) {
    return;
  }
  let buttons = [];
  buttons.push({
    text: textButtonBack.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
    },
  });
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    buttons.push({
      text: textCloseFile.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain("close-file", true);
      },
    });
  }
  buttons.push({
    text: textButtonFileBrowser.toUpperCase(),
    fullWidth: true,
    callback: (showFocus) => {
      modalClosed();
      sendIpcToMain("open-file-browser-tool", showFocus);
    },
  });
  buttons.push({
    text: textButtonHistory.toUpperCase(),
    fullWidth: true,
    callback: (showFocus) => {
      modalClosed();
      sendIpcToMain("open-history-tool", showFocus);
    },
  });
  buttons.push({
    text: textButtonFullscreen.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("toggle-fullscreen");
    },
  });
  buttons.push({
    text: textButtonQuit.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("quit");
    },
  });
  g_openModal = modals.show({
    showFocus: showFocus,
    title: title,
    frameWidth: 400,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape," + g_navKeys.quickMenu[0],
      gpCommand: g_navButtons.quickMenu[0],
    },
    buttons: buttons,
  });
}
