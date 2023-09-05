/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { on, sendIpcToMain } from "./renderer.js";
import * as modals from "../shared/renderer/modals.js";
import * as gamepads from "../shared/renderer/gamepads.js";

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

let g_turnPageOnScrollBoundary = true;
let g_filterMode = 0;

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initOnIpcCallbacks() {
  on("add-event-listeners", () => {
    addToolbarEventListeners();
  });
  on("update-loading", (isVisible) => {
    if (isVisible) {
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
    navigator.getBattery().then(function (battery) {
      bubble.innerHTML = `<span>${battery.level * 100}%</span>`;
      battery.addEventListener("levelchange", function () {
        bubble.innerHTML = `<span>${this.level * 100}%</span>`;
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
          "4px"
        );
      } else {
        document.documentElement.style.setProperty("--li-icon-size", "65px");
        document.documentElement.style.setProperty(
          "--li-icon-thickness",
          "8px"
        );
      }
      if (loadingIndicatorIconPos === 0) {
        document.documentElement.style.setProperty(
          "--li-icon-align-self",
          "normal"
        );
        document.documentElement.style.setProperty(
          "--li-icon-justify-self",
          "left"
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-full",
          "10px"
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-win",
          "40px"
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-left",
          "10px"
        );
      } else {
        document.documentElement.style.setProperty(
          "--li-icon-align-self",
          "center"
        );
        document.documentElement.style.setProperty(
          "--li-icon-justify-self",
          "center"
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-full",
          "0px"
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-top-win",
          "0px"
        );
        document.documentElement.style.setProperty(
          "--li-icon-margin-left",
          "0px"
        );
      }
    }
  );

  on("update-layout-pos", (value, id) => {
    let element = document.querySelector(id);
    element.className = "";
    element.classList.add("layout-bubble");
    switch (value) {
      case 0:
        element.classList.add("layout-top");
        element.classList.add("layout-left");
        break;
      case 1:
        element.classList.add("layout-top");
        element.classList.add("layout-center");
        break;
      case 2:
        element.classList.add("layout-top");
        element.classList.add("layout-right");
        break;
      case 3:
        element.classList.add("layout-bottom");
        element.classList.add("layout-left");
        break;
      case 4:
        element.classList.add("layout-bottom");
        element.classList.add("layout-center");
        break;
      case 5:
        element.classList.add("layout-bottom");
        element.classList.add("layout-right");
        break;
    }
  });

  on("update-bg-text", (text) => {
    document.querySelector("#centered-block-text").innerHTML = text;
  });

  on("update-bg", (show) => {
    if (show)
      document
        .querySelector(".centered-block")
        .classList.remove("set-display-none");
    else
      document
        .querySelector(".centered-block")
        .classList.add("set-display-none");
  });

  on(
    "update-toolbar-tooltips",
    (
      tOpenFile,
      tPrevious,
      tNext,
      tFitWidth,
      tFitHeight,
      tRotateCounter,
      tRotateClock,
      tFullScreen
    ) => {
      document.querySelector("#toolbar-button-open-href").title = tOpenFile;
      document.querySelector("#toolbar-button-prev-href").title = tPrevious;
      document.querySelector("#toolbar-button-next-href").title = tNext;
      document.querySelector("#toolbar-button-fit-to-height-href").title =
        tFitHeight;
      document.querySelector("#toolbar-button-fit-to-width-href").title =
        tFitWidth;
      document.querySelector(
        "#toolbar-button-rotate-counterclockwise-href"
      ).title = tRotateCounter;
      document.querySelector("#toolbar-button-rotate-clockwise-href").title =
        tRotateClock;
      document.querySelector("#toolbar-button-fullscreen-enter-href").title =
        tFullScreen;
      document.querySelector("#toolbar-button-fullscreen-exit-href").title =
        tFullScreen;
    }
  );

  on("update-toolbar-rotation-buttons", (areEnabled) => {
    const button1 = document.querySelector("#toolbar-button-rotate-clockwise");
    const button2 = document.querySelector(
      "#toolbar-button-rotate-counterclockwise"
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
    const button1 = document.querySelector("#toolbar-button-prev");
    const button2 = document.querySelector("#toolbar-button-next");
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
    const button1 = document.querySelector("#toolbar-button-fit-to-height");
    const button2 = document.querySelector("#toolbar-button-fit-to-width");
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

  on("set-fullscreen-ui", (isFullscreen) => {
    setFullscreenUI(isFullscreen);
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
      window.innerHeight || 0
    );
    // TODO: not getting exactly the value I want, cheat by using the 1.1 multiplier for now
    let scale = parseInt((imgHeight / vh) * 100 * (increment > 0 ? 1.1 : 1));
    scale += increment;
    sendIpcToMain("set-scale-mode", scale);
  });

  on("set-hide-inactive-mouse-cursor", (hide) => {
    g_hideMouseCursor = hide;
  });

  on("set-page-turn-on-scroll-boundary", (value) => {
    g_turnPageOnScrollBoundary = value;
  });

  on("render-page-info", (pageNum, numPages, isPercentage) => {
    updatePageInfo(pageNum, numPages, isPercentage);
  });

  on("set-filter", (value) => {
    g_filterMode = value;
    let img = document.getElementById("page-img");
    if (!img) img = document.getElementById("page-canvas");
    if (img) {
      setFilterClass(img);
    }
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

function setFitToWidth() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-scale-to-height");
  container.classList.remove("set-fit-to-height");
  container.classList.add("set-fit-to-width");

  document
    .querySelector("#toolbar-button-fit-to-width")
    .classList.add("set-display-none");
  document
    .querySelector("#toolbar-button-fit-to-height")
    .classList.remove("set-display-none");
}

function setFitToHeight() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-scale-to-height");
  container.classList.remove("set-fit-to-width");
  container.classList.add("set-fit-to-height");

  document
    .querySelector("#toolbar-button-fit-to-width")
    .classList.remove("set-display-none");
  document
    .querySelector("#toolbar-button-fit-to-height")
    .classList.add("set-display-none");
}

function setScaleToHeight(scale) {
  setZoomHeightCssVars(scale);
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-fit-to-width");
  container.classList.remove("set-fit-to-height");
  container.classList.add("set-scale-to-height");

  document
    .querySelector("#toolbar-button-fit-to-width")
    .classList.remove("set-display-none");
  document
    .querySelector("#toolbar-button-fit-to-height")
    .classList.add("set-display-none");
}

function setZoomHeightCssVars(scale) {
  if (scale !== undefined)
    document.documentElement.style.setProperty(
      "--zoom-height-scale",
      `${scale}`
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
    `${border}px`
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

export function onInputEvent(type, event) {
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  switch (type) {
    case "onkeydown":
      {
        if (fileOpen) {
          if (event.key == "PageDown" || event.key == "ArrowRight") {
            if (!event.repeat) {
              inputGoToNextPage();
              event.stopPropagation();
            }
            event.stopPropagation();
          } else if (event.key == "PageUp" || event.key == "ArrowLeft") {
            if (!event.repeat) {
              inputGoToPrevPage();
              event.stopPropagation();
            }
          } else if (event.key == "Home") {
            if (!event.repeat) inputGoToFirstPage();
          } else if (event.key == "End") {
            if (!event.repeat) inputGoToLastPage();
          } else if (event.key == "ArrowDown" || event.key == "s") {
            inputScrollPageDown();
            event.stopPropagation();
          } else if (event.key == "ArrowUp" || event.key == "w") {
            inputScrollPageUp();
            event.stopPropagation();
          } else if (event.key == "a") {
            let container = document.querySelector("#reader");
            let amount = container.offsetWidth / 5;
            container.scrollBy(-amount, 0);
            event.stopPropagation();
          } else if (event.key == "d") {
            let container = document.querySelector("#reader");
            let amount = container.offsetWidth / 5;
            container.scrollBy(amount, 0);
            event.stopPropagation();
          } else if (event.ctrlKey && event.key === "+") {
            if (!event.repeat) {
              inputZoomIn();
              event.stopPropagation();
            }
          } else if (event.ctrlKey && event.key === "-") {
            if (!event.repeat) {
              inputZoomOut();
              event.stopPropagation();
            }
          } else if (event.ctrlKey && event.key == "0") {
            if (!event.repeat) inputZoomReset();
          }
        }

        if (event.key == "Escape") {
          if (!event.repeat) sendIpcToMain("escape-pressed");
        } else if (
          event.ctrlKey &&
          event.shiftKey &&
          (event.key == "i" || event.key == "I")
        ) {
          sendIpcToMain("dev-tools-pressed");
        }
      }
      break;

    case "onclick":
      {
        if (fileOpen) {
          if (
            event.target.classList.contains("page") ||
            event.target.id === "page-canvas" ||
            event.target.classList.contains("epub-view") ||
            event.target.id === "pages-container" ||
            event.target.id === "reader"
          ) {
            const mouseX = event.clientX;
            const bodyX = document.body.clientWidth;
            sendIpcToMain("mouse-click", mouseX, bodyX);
          }
        }
      }
      // mouse right click: document.oncontextmenu
      break;

    case "body.ondrop":
      {
        sendIpcToMain("open-file", event.dataTransfer.files[0].path);
      }
      break;

    case "onmousemove":
      {
        if (g_mouseCursorTimer) {
          window.clearTimeout(g_mouseCursorTimer);
        }
        if (!g_isMouseCursorVisible) {
          //document.body.style.cursor = "default";
          document.querySelector("#reader").style.cursor = "default";
          g_isMouseCursorVisible = true;
        }
        if (g_hideMouseCursor) {
          g_mouseCursorTimer = window.setTimeout(() => {
            g_mouseCursorTimer = undefined;
            //document.body.style.cursor = "none";
            document.querySelector("#reader").style.cursor = "none";
            g_isMouseCursorVisible = false;
          }, g_mouseCursorHideTime);
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
                  container.clientHeight
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
          (factor * scrollableHeight) / 5
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
          (factor * scrollableHeight) / 5
        );
        reader.scrollBy(0, amount);
      }
    }
  }
}

function inputGoToNextPage() {
  sendIpcToMain(
    "mouse-click",
    document.body.clientWidth,
    document.body.clientWidth
  );
}
function inputGoToPrevPage() {
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

function inputToggleFullScreen() {
  sendIpcToMain("toolbar-button-clicked", "toolbar-button-fullscreen-enter");
}

function inputOpenFileBrowser() {
  sendIpcToMain("open-file-browser-tool");
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPAD ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  const deltaTime = gamepads.getDeltaTime();
  const scrollFactor = deltaTime * 3;
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    // zoom in/ out
    if (gamepads.getButton(gamepads.Buttons.LT)) {
      inputZoomOut(deltaTime * 10);
    } else if (gamepads.getButton(gamepads.Buttons.RT)) {
      inputZoomIn(deltaTime * 10);
    }
    // page up / down
    if (gamepads.getAxis(gamepads.Axes.RS_Y) > 0.5) {
      inputScrollPageDown(
        gamepads.getPrevAxis(gamepads.Axes.RS_Y) < 0.5,
        scrollFactor
      );
    } else if (gamepads.getAxis(gamepads.Axes.RS_Y) < -0.5) {
      inputScrollPageUp(
        gamepads.getPrevAxis(gamepads.Axes.RS_Y) > -0.5,
        scrollFactor
      );
    }
    // next / prev page
    if (gamepads.getButtonDown(gamepads.Buttons.LB)) {
      inputGoToPrevPage();
    } else if (gamepads.getButtonDown(gamepads.Buttons.RB)) {
      inputGoToNextPage();
    }
    // last / first page
    if (gamepads.getButtonDown(gamepads.Buttons.A)) {
      inputGoToLastPage();
    } else if (gamepads.getButtonDown(gamepads.Buttons.Y)) {
      inputGoToFirstPage();
    }
    // change scale mode
    if (gamepads.getButtonDown(gamepads.Buttons.RS_PRESS)) {
      inputSwitchScaleMode();
    }
  }

  // toggle full screen
  if (gamepads.getButtonDown(gamepads.Buttons.LS_PRESS)) {
    inputToggleFullScreen();
  }
  // // open file browser
  // //if (
  // // gamepads.getButtonDown(gamepads.Buttons.BACK)
  // // ) {
  // //   inputOpenFileBrowser();
  // // }
}

///////////////////////////////////////////////////////////////////////////////
// TOOLBAR ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function addButtonEvent(buttonName) {
  document.getElementById(buttonName).addEventListener("click", (event) => {
    sendIpcToMain("toolbar-button-clicked", buttonName);
  });
}

function addToolbarEventListeners() {
  addButtonEvent("toolbar-button-rotate-clockwise");
  addButtonEvent("toolbar-button-rotate-counterclockwise");
  addButtonEvent("toolbar-button-next");
  addButtonEvent("toolbar-button-prev");
  addButtonEvent("toolbar-button-fit-to-width");
  addButtonEvent("toolbar-button-fit-to-height");
  addButtonEvent("toolbar-button-fullscreen-enter");
  addButtonEvent("toolbar-button-fullscreen-exit");
  addButtonEvent("toolbar-button-open");

  document
    .getElementById("toolbar-page-slider-input")
    .addEventListener("mouseup", (event) => {
      sendIpcToMain("toolbar-slider-changed", event.currentTarget.value);
    });
  document
    .getElementById("toolbar-page-slider-input")
    .addEventListener("input", (event) => {
      if (g_toolbarSliderIsPercentage) {
        document.getElementById(
          "toolbar-page-numbers"
        ).innerHTML = `${event.currentTarget.value}.00%`;
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
      pageNum
    ).toFixed(2)}%`;
    document.getElementById("page-number-bubble").innerHTML = `<span>${Number(
      pageNum
    ).toFixed(2)}%</span>`;
  } else {
    if (numPages === 0) pageNum = -1; // hack to make it show 00 / 00 @ start
    document.getElementById("toolbar-page-slider-input").max = numPages;
    document.getElementById("toolbar-page-slider-input").min = 1;
    document.getElementById("toolbar-page-slider-input").value = pageNum + 1;
    document.getElementById("toolbar-page-numbers").innerHTML =
      pageNum + 1 + " / " + numPages;
    document.getElementById("page-number-bubble").innerHTML =
      "<span>" + (pageNum + 1) + " / " + numPages + "</span>";
  }
}

///////////////////////////////////////////////////////////////////////////////
// IMG64 //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function renderImg64(
  img64,
  rotation,
  scrollBarPos,
  sendPageLoaded,
  fromRefresh
) {
  let container = document.getElementById("pages-container");
  let title;
  if (fromRefresh) {
    let img = document.getElementById("page-img");
    if (!img) img = document.getElementById("page-canvas");
    if (img) title = img.title;
  }
  if (rotation === 0 || rotation === 180) {
    var image = new Image();
    image.onload = function () {
      container.innerHTML = "";
      container.appendChild(image);
      setFilterClass(image);
      if (sendPageLoaded) {
        sendIpcToMain("page-loaded", {
          dimensions: [image.naturalWidth, image.naturalHeight],
        });
      }
      if (scrollBarPos !== undefined) setScrollBarsPosition(scrollBarPos);
    };
    image.src = img64;
    image.id = "page-img";
    image.classList.add("page");
    if (title && title != "") image.title = title;
    if (rotation === 180) {
      image.classList.add("set-rotate-180");
    }
  }
  // I use a different method here, I prefer the look of images in <img> when resizing but can't make them rotate
  // as I like, so I'll try canvas for these rotations
  else if (rotation === 90 || rotation === 270) {
    var canvas = document.createElement("canvas");
    canvas.id = "page-canvas";
    if (title && title != "") canvas.title = title;
    container.innerHTML = "";
    container.appendChild(canvas);
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
          0 // vTrans
        );
      } else if (rotation === 270) {
        context.setTransform(
          0, // hScale
          -1, // vSkew
          1, // hSkew
          0, // vScale
          0, // hTrans
          image.width // vTrans
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
    image.src = img64;
  }
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function modalClosed() {
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
    }
  );

  on("show-modal-prompt-password", (text1, text2, textButton1, textButton2) => {
    showModalPromptPassword(text1, text2, textButton1, textButton2);
  });

  on("show-modal-info", (title, message, textButton1) => {
    showModalAlert(title, message, textButton1);
  });

  on(
    "show-modal-question-openas",
    (title, message, textButton1, textButton2, filePath) => {
      showModalQuestionOpenAs(
        title,
        message,
        textButton1,
        textButton2,
        filePath
      );
    }
  );

  on("show-modal-properties", (title, message, textButton1, textButton2) => {
    showModalProperties(title, message, textButton1, textButton2);
  });
}

function showModalPrompt(
  question,
  defaultValue,
  textButton1,
  textButton2,
  mode = 0
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
          callback: (value) => {
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
          callback: (value) => {
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
          callback: (value) => {
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
        callback: (value) => {
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
  filePath
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
        sendIpcToMain("open-comicinfo-xml-tool");
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
    log: { message: message },
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
