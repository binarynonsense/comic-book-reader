/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { on, sendIpcToMain, showNoBookContent } from "../renderer.js";
import { initModalsOnIpcCallbacks } from "./modals.js";
import {
  initScrollbarOnIpcCallbacks,
  setScrollBarsPosition,
  setScrollbarBoundariesConfig,
  addScrollEventListener,
  scrollBoundaryHandleIsLoadingChanged,
} from "./scrollbar.js";
import {
  initToolbarOnIpcCallbacks,
  setToolbarMenuButtonIcon,
  addToolbarEventListeners,
  updateToolbarPageInfo,
} from "./toolbar.js";
import { initInputOnIpcCallbacks } from "./input.js";

export function initIpc() {
  initOnIpcCallbacks();
  initModalsOnIpcCallbacks();
  initToolbarOnIpcCallbacks();
  initScrollbarOnIpcCallbacks();
  initInputOnIpcCallbacks();
}

let BookType = {
  NOT_SET: "not_set",
  COMIC: "comic",
  EBOOK: "ebook",
};

let g_filterMode = 0;
let g_showLoadingIndicator;

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initOnIpcCallbacks() {
  on("add-event-listeners", () => {
    addToolbarEventListeners();
    addScrollEventListener();
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

  on("set-menubar-visibility", (isVisible) => {
    showMenuBar(isVisible);
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

  on("set-fit-to-both", () => {
    setFitToBoth();
  });

  on("set-scale-to-height", (scale) => {
    setScaleToHeight(scale);
  });

  on("try-zoom-scale-from-other-mode", (increment) => {
    const pagesContainer = document.getElementById("pages-container");
    const pagesRow = pagesContainer.querySelector(".pages-row");
    if (!pagesRow) return;
    const pages = pagesRow.querySelectorAll(".page");
    if (pages.length === 0) return;

    const currentVisualHeight = pagesRow.getBoundingClientRect().height;
    const maxHeight = window.innerHeight;
    const cssHeightBordersVar = getComputedStyle(
      document.documentElement,
    ).getPropertyValue("--zoom-height-borders");
    const heightBordersSize = parseFloat(cssHeightBordersVar) || 0;

    let scale = Math.round(
      ((currentVisualHeight + heightBordersSize) / maxHeight) * 100,
    );
    scale += increment;

    sendIpcToMain("set-scale-mode", scale);
  });

  on(
    "set-page-turn-on-scroll-boundary",
    (enabled, lockTimeMs, settleTimeMs, scrollBlockTimeMs) => {
      setScrollbarBoundariesConfig(
        enabled,
        lockTimeMs,
        settleTimeMs,
        scrollBlockTimeMs,
      );
    },
  );

  on("render-page-info", (pageNum, numPages, isPercentage) => {
    updatePageInfo(pageNum, numPages, isPercentage);
  });

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
}

///////////////////////////////////////////////////////////////////////////////
// MODIFIERS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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
  container.classList.remove("set-fit-to-both");

  setToolbarMenuButtonIcon("toolbar-button-zoom", 1);
}

function setFitToHeight() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-scale-to-height");
  container.classList.remove("set-fit-to-width");
  container.classList.add("set-fit-to-height");
  container.classList.remove("set-fit-to-both");

  setToolbarMenuButtonIcon("toolbar-button-zoom", 0);
}

function setFitToBoth() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-scale-to-height");
  container.classList.remove("set-fit-to-height");
  container.classList.remove("set-fit-to-width");
  container.classList.add("set-fit-to-both");
  setToolbarMenuButtonIcon;
  setToolbarMenuButtonIcon("toolbar-button-zoom", 2);
}

function setScaleToHeight(scale) {
  setZoomHeightCssVars(scale);
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-fit-to-width");
  container.classList.remove("set-fit-to-height");
  container.classList.add("set-scale-to-height");
  container.classList.remove("set-fit-to-both");

  setToolbarMenuButtonIcon("toolbar-button-zoom", 3);
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

export function updateZoom() {
  setZoomHeightCssVars();
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
  updateToolbarPageInfo(g_pageMode, pageNum, numPages, isPercentage);
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
        addPagesResizeEventListener(pagesRowDiv);
      }
    }
    //// events ///
    page1Img.onload = function () {
      pagesLoaded++;
      checkImageResults();
    };
    page1Img.onerror = function () {
      page1Img.src = "../../assets/images/error_page.png";
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
        page2Img.src = "../../assets/images/error_page.png";
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
    const pagesRowDiv = document.createElement("div");
    pagesRowDiv.classList.add("pages-row");
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
      containerDiv.innerHTML = "";
      containerDiv.appendChild(pagesRowDiv);
      if (scrollBarPos !== undefined) setScrollBarsPosition(scrollBarPos);
      addPagesResizeEventListener(pagesRowDiv);
    };
    image.onerror = function () {
      image.src = "../../assets/images/error_page.png";
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

let g_activeResizeHandler;

function addPagesResizeEventListener(pagesRowDiv) {
  if (!pagesRowDiv) return;
  const pages = pagesRowDiv.querySelectorAll(".page");
  if (pages.length === 0) return;

  // the combined ratio is the sum of the one from all pages
  let combinedPageSizeRatio = 0;
  pages.forEach((img) => {
    const trueWidth = img.width || img.naturalWidth || 1;
    const trueHeight = img.height || img.naturalHeight || 1;
    combinedPageSizeRatio += trueWidth / trueHeight;
  });

  // clean up previous
  if (g_activeResizeHandler) {
    window.removeEventListener("resize", g_activeResizeHandler);
  }

  g_activeResizeHandler = () => {
    const hasFitMode = document.querySelector(".set-fit-to-both");
    if (!hasFitMode) {
      // clean up if not fit both mode
      pagesRowDiv.style.width = "";
      pagesRowDiv.style.height = "";
      window.removeEventListener("resize", g_activeResizeHandler);
      g_activeResizeHandler = null;
      return;
    }

    const maxWidth = window.innerWidth;
    const cssHeightBordersVar = getComputedStyle(
      document.documentElement,
    ).getPropertyValue("--zoom-height-borders");
    const heightBordersSize = parseFloat(cssHeightBordersVar) || 0;
    const maxHeight = window.innerHeight - heightBordersSize;

    let desiredPagesRowHeight = maxHeight;
    let desiredPagesRowWidth = desiredPagesRowHeight * combinedPageSizeRatio;
    // fit to both width and height
    if (desiredPagesRowWidth > maxWidth) {
      desiredPagesRowWidth = maxWidth;
      desiredPagesRowHeight = desiredPagesRowWidth / combinedPageSizeRatio;
    }

    pagesRowDiv.style.width = `${Math.floor(desiredPagesRowWidth)}px`;
    pagesRowDiv.style.height = `${Math.floor(desiredPagesRowHeight)}px`;
  };

  window.addEventListener("resize", g_activeResizeHandler);
  g_activeResizeHandler();
}
