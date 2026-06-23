/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../core/renderer.js";
import {
  initOnIpcCallbacks as viewInitIpc,
  setZoomHeightCssVars,
  getPageMode,
  onFileClosed as viewOnFileClosed,
} from "./renderer/view.js";
import {
  initInputOnIpcCallbacks,
  onInputEvent as readerOnInputEvent,
  onGamepadPolled as readerOnGamepadPolled,
} from "./renderer/input.js";
import {
  initScrollbarOnIpcCallbacks,
  addScrollEventListener,
  scrollBoundaryHandleIsLoadingChanged,
} from "./renderer/scrollbar.js";
import {
  initToolbarOnIpcCallbacks,
  addToolbarEventListeners,
  updateToolbarPageInfo,
} from "./renderer/toolbar.js";
import { initModalsOnIpcCallbacks, getOpenModal } from "./renderer/modals.js";

import {
  onInputEvent as modalOnInputEvent,
  onGamepadPolled as modalOnGamepadPolled,
} from "../shared/renderer/modals.js";
import {
  initIpc as homeScreenInitIpc,
  onInputEvent as homeScreenOnInputEvent,
  onGamepadPolled as homeScreenOnGamepadPolled,
} from "./home-screen/renderer.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_filterMode = 0;
let g_showLoadingIndicator;

// let BookType = {
//   NOT_SET: "not_set",
//   COMIC: "comic",
//   EBOOK: "ebook",
// };

export function initIpc() {
  viewInitIpc();

  initModalsOnIpcCallbacks();
  initModalsOnIpcCallbacks();
  initToolbarOnIpcCallbacks();
  initScrollbarOnIpcCallbacks();
  initInputOnIpcCallbacks();

  homeScreenInitIpc();
  initOnIpcCallbacks();
}

///////////////////////////////////////////////////////////////////////////////
// PAGES //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function showNoBookContent(show) {
  if (show) {
    document
      .querySelector("#no-book-content")
      .classList.remove("set-display-none");
    document
      .querySelector("#pages-container")
      .classList.add("set-display-none");
    document.querySelector("#home-screen").scrollTop = 0;
    document.querySelector("#home-screen").scrollLeft = 0;
    document
      .querySelector("#home-scroll-to-top-button")
      ?.classList.remove("set-display-none");
  } else {
    document
      .querySelector("#no-book-content")
      .classList.add("set-display-none");
    document
      .querySelector("#pages-container")
      .classList.remove("set-display-none");
    document
      .querySelector("#home-scroll-to-top-button")
      ?.classList.add("set-display-none");
  }
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("reader", ...args);
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
  on("add-event-listeners", () => {
    addToolbarEventListeners();
    addScrollEventListener();
  });

  on("file-closed", () => {
    viewOnFileClosed();
    let container = document.getElementById("pages-container");
    container.innerHTML = "";
    showNoBookContent(true);
    updatePageInfo(0, 0);
  });

  ///////////////////////////////////////////////

  on("set-menubar-visibility", (isVisible) => {
    showMenuBar(isVisible);
  });

  on("update-loading", (isVisible) => {
    if (g_showLoadingIndicator && isVisible) {
      document.querySelector("#loading").classList.add("is-active");
    } else {
      document.querySelector("#loading").classList.remove("is-active");
    }
    ///////
    scrollBoundaryHandleIsLoadingChanged(isVisible);
  });

  on("update-bg", (show) => {
    if (show) showNoBookContent(true);
    else showNoBookContent(false);
  });

  ///////////////////////////////////////////////

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

  ///////////////////////////////////////////////

  on("set-filter", (value, data) => {
    g_filterMode = value;
    let pages = document.querySelectorAll(".page");
    if (value > 0) {
      setCustomFilter(...data);
    }
    pages.forEach((page) => {
      setFilterClass(page);
    });
  });
}

///////////////////////////////////////////////////////////////////////////////
// MODIFIERS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function updateZoom() {
  setZoomHeightCssVars();
}

export function updatePageInfo(pageNum, numPages, isPercentage) {
  if (isPercentage) {
    document.getElementById("page-number-bubble").innerHTML = `<span>${Number(
      pageNum,
    ).toFixed(2)}%</span>`;
  } else {
    if (numPages === 0) pageNum = -1; // hack to make it show 00 / 00 @ start
    let currentPageText = `${pageNum + 1} / ${numPages}`;
    document.getElementById("page-number-bubble").innerHTML =
      "<span>" + currentPageText + "</span>";
  }
  updateToolbarPageInfo(getPageMode(), pageNum, numPages, isPercentage);
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

export function setFilterClass(element) {
  if (g_filterMode > 0) {
    element.classList.add("page-filter-custom");
  } else {
    element.classList.remove("page-filter-custom");
  }
}

function setCustomFilter(
  invert = 0,
  rotateHue = 0,
  gamma = 1,
  blackLevel = 0,
  whiteLevel = 1,
  brightness = 1,
  contrast = 1,
  saturation = 1,
  sepia = 0,
) {
  ///////////////
  // only add those in use
  let rule = ".page-filter-custom { filter:";
  if (invert !== 0) rule += " invert(var(--page-filter-custom-invert))";
  if (rotateHue !== 0)
    rule += " hue-rotate(var(--page-filter-custom-hue-rotate))";
  if (gamma !== 1 || blackLevel !== 0 || whiteLevel !== 1)
    rule += " url(#gamma-levels-filter)";
  if (brightness !== 1)
    rule += " brightness(var(--page-filter-custom-brightness))";
  if (contrast !== 1) rule += " contrast(var(--page-filter-custom-contrast))";
  if (saturation !== 1)
    rule += " saturate(var(--page-filter-custom-saturation))";
  if (sepia !== 0) rule += " sepia(var(--page-filter-custom-sepia))";
  rule += "; image-rendering: high-quality; }";

  const sheet = document.styleSheets[3]; // reader.css is the fourth one
  const rules = sheet.cssRules;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].selectorText === ".page-filter-custom") {
      sheet.deleteRule(i);
      sheet.insertRule(rule, i);
      break;
    }
  }
  ////////////////
  const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
  // internal levels calculation
  const levelsSlope = 1 / Math.max(whiteLevel - blackLevel, 0.01);
  const levelsIntercept = -blackLevel * levelsSlope;
  const safeGamma = clamp(gamma, 0.01, 5.0);
  const safeLevelsSlope = clamp(levelsSlope, 0, 10.0);
  const safeLevelsIntercept = clamp(levelsIntercept, -5.0, 5.0);
  const safeBrightness = clamp(brightness, 0, 5.0);
  const safeContrast = clamp(contrast, 0, 5.0);
  const safeSaturation = clamp(saturation, 0, 5.0);
  const safeSepia = clamp(sepia, 0, 5.0);
  const safeInvert = clamp(invert, 0, 1.0);
  // svg filter
  const gammaChannels = document.querySelectorAll(
    "#gamma-levels-filter feComponentTransfer:first-of-type > [type='gamma']",
  );
  gammaChannels.forEach((channel) =>
    channel.setAttribute("exponent", safeGamma),
  );
  const levelChannels = document.querySelectorAll(
    "#gamma-levels-filter feComponentTransfer:nth-of-type(2) > [type='linear']",
  );
  levelChannels.forEach((channel) => {
    channel.setAttribute("slope", safeLevelsSlope);
    channel.setAttribute("intercept", safeLevelsIntercept);
  });
  // css vars
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--page-filter-custom-invert", safeInvert);
  rootStyle.setProperty("--page-filter-custom-hue-rotate", rotateHue + "deg");
  rootStyle.setProperty("--page-filter-custom-brightness", safeBrightness);
  rootStyle.setProperty("--page-filter-custom-contrast", safeContrast);
  rootStyle.setProperty("--page-filter-custom-saturation", safeSaturation);
  rootStyle.setProperty("--page-filter-custom-sepia", safeSepia);
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pagesContainerDiv;

export function onInputEvent(type, event) {
  // NOTE: if more are added, make them return true or false to see if handled
  // or next should try?
  if (getOpenModal()) {
    modalOnInputEvent(getOpenModal(), type, event);
    return;
  }
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    readerOnInputEvent(type, event);
  } else {
    homeScreenOnInputEvent(type, event);
  }
}

export async function onContextMenu(params, target) {
  if (getOpenModal()) {
    return;
  }
  // console.log(document.elementsFromPoint(params[0], params[1]));
  if (target.tagName === "IMG") {
    const response = await fetch(target.src);
    const arrayBuffer = await response.arrayBuffer();
    params.img = arrayBuffer;
    params.isDoublePage = target.classList.contains("page-2");
  } else if (target.tagName === "CANVAS") {
    // TODO: this is done every time the context menu is opened, doesn't
    // seem to take long but probably should do it only by explicit request
    // when clicking Save Image to...
    params.img = target.toDataURL("image/jpeg");
    params.isDoublePage = target.classList.contains("page-2");
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPAD ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onGamepadPolled() {
  if (getOpenModal()) {
    modalOnGamepadPolled(getOpenModal());
    return;
  }
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    readerOnGamepadPolled();
  } else {
    homeScreenOnGamepadPolled();
  }
}
