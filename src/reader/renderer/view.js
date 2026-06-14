/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  on,
  sendIpcToMain,
  setFilterClass,
  updatePageInfo,
  showNoBookContent,
} from "../renderer.js";
import {
  setScrollBarsPosition,
  setScrollbarBoundariesConfig,
} from "./scrollbar.js";
import { setToolbarMenuButtonIcon } from "./toolbar.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentImages;

///////////////////////////////////////////////////////////////////////////////
// BASE ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onFileClosed() {
  cleanUpPages();
}

function cleanUpPages() {
  g_currentImages = undefined;
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function initOnIpcCallbacks() {
  on("render-img-page", (images, rotation, scrollBarPos) => {
    if (images) {
      cleanUpPages();
      showNoBookContent(false);
      g_currentImages = images;
      renderImageBuffers(g_currentImages, rotation, scrollBarPos, true, false);
    }
  });

  on("refresh-img-page", (rotation) => {
    if (g_currentImages)
      renderImageBuffers(g_currentImages, rotation, undefined, false, true);
  });

  on("update-img-page-title", (text) => {
    let img = document.querySelector(".page");
    if (img) img.title = text;
  });

  ///////////////////////////////////////////////

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

  //////////////////////////////////////////////////////////////

  on("render-page-info", (pageNum, numPages, isPercentage) => {
    updatePageInfo(pageNum, numPages, isPercentage);
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

let g_pageMode = 0;

export function getPageMode() {
  return g_pageMode;
}

function setPageMode(value, canBeChanged) {
  // canBeChanged is not used?
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

export function setZoomHeightCssVars(scale) {
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
