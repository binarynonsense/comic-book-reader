/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { on, sendIpcToMain, getCurrentImg64 } from "./renderer.js";
import { renderImg64, setScrollBarsPosition } from "./renderer-ui.js";

export function initIpc() {
  initHandlers();
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initHandlers() {
  // COMIC
  on("refresh-epub-comic-page", (rotation) => {
    if (getCurrentImg64())
      renderImg64(getCurrentImg64(), rotation, undefined, false, true);
  });

  // EBOOK
  on("load-epub-ebook", (filePath, pageIndex, cachedPath) => {
    loadEpubEbook(filePath, pageIndex, cachedPath);
  });

  on("render-epub-ebook-page-percentage", (percentage) => {
    document.querySelector(".centered-block").classList.add("set-display-none");
    renderEpubEbookPercentage(percentage);
  });

  on("render-epub-ebook-page-next", () => {
    document.querySelector(".centered-block").classList.add("set-display-none");
    renderEpubEbookNext();
  });

  on("render-epub-ebook-page-prev", () => {
    document.querySelector(".centered-block").classList.add("set-display-none");
    renderEpubEbookPrev();
  });

  on("refresh-epub-ebook-page", (rotation) => {
    refreshEpubEbookPage();
  });

  on("close-epub-ebook", (event) => {
    if (g_currentEpubEbook.book) {
      g_currentEpubEbook.book.destroy();
      g_currentEpubEbook = {};
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// EPUB EBOOK /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentEpubEbook = {};

export function cleanUp() {
  g_currentEpubEbook = {};
}

async function loadEpubEbook(filePath, percentage, cachedPath) {
  try {
    // const ePub = require("epubjs");
    g_currentEpubEbook.book = ePub(cachedPath ?? filePath);

    g_currentEpubEbook.book.on("openFailed", function (error) {
      sendIpcToMain("epub-ebook-load-failed", error);
    });

    const container = document.querySelector("#pages-container");
    container.innerHTML = "";
    const ebookContainer = document.createElement("div");
    ebookContainer.id = "epub-ebook-container";
    container.appendChild(ebookContainer);
    g_currentEpubEbook.rendition = await g_currentEpubEbook.book.renderTo(
      "epub-ebook-container",
      {
        flow: "paginated",
        width: 450,
        height: 600,
        allowScriptedContent: false,
      }
    );
    // g_currentEpubEbook.rendition.themes.fontSize("140%");

    g_currentEpubEbook.rendition.on("relocated", function (location) {
      const iframe = document
        .getElementsByClassName("epub-view")[0]
        .getElementsByTagName("iframe")[0];
      let iframeDoc = iframe.contentDocument;
      iframeDoc.body.innerHTML =
        iframeDoc.body.innerHTML +
        `<style>
            a, a:hover, a:focus, a:active {
              text-decoration: none !important;
              color: black !important;
            }
      </style>`;
    });

    await g_currentEpubEbook.rendition.display();
    await g_currentEpubEbook.book.locations.generate(1000);
    let cfi = getEpubEbookCfiFromPercentage(percentage / 100);
    if (cfi === "epubcfi(/!/)" || cfi === -1)
      throw { name: "GenericError", message: "Empty or malformed epub cfi" };
    const manager = g_currentEpubEbook.rendition.manager;
    // HACK / modification to epubjs
    // highjack function from managers>default>index.js in module
    // to take into account how I use a css transform to scale the 'page'
    manager.paginatedLocation = () => {
      let visible = manager.visible();
      let container = manager.container.getBoundingClientRect();
      let used = 0;

      let sections = visible.map((view) => {
        let { index, href } = view.section;
        let offset;
        let position = view.position();
        let width = view.width();

        let start;
        let end;
        let pageWidth;

        offset = container.left;
        pageWidth = 450;

        const zoomFactor =
          document.querySelector("#epub-ebook-container").clientHeight / 600;
        start = offset / zoomFactor - position.left / zoomFactor + used;
        end = start + pageWidth;

        used += pageWidth;

        let mapping = manager.mapping.page(
          view.contents,
          view.section.cfiBase,
          start,
          end
        );

        let totalPages = manager.layout.count(width).pages;
        let startPage = Math.floor(start / manager.layout.pageWidth);
        let pages = [];
        let endPage = Math.floor(end / manager.layout.pageWidth);

        if (startPage < 0) {
          startPage = 0;
          endPage = endPage + 1;
        }

        for (var i = startPage + 1; i <= endPage; i++) {
          let pg = i;
          pages.push(pg);
        }

        return {
          index,
          href,
          pages,
          totalPages,
          mapping,
        };
      });

      return sections;
    };

    sendIpcToMain("epub-ebook-loaded", filePath, percentage);
  } catch (error) {
    sendIpcToMain("epub-ebook-load-failed", error);
  }
}

async function renderEpubEbookPercentage(percentage) {
  try {
    let cfi = getEpubEbookCfiFromPercentage(percentage / 100);
    if (cfi !== "epubcfi(/!/)" && cfi !== -1) {
      await g_currentEpubEbook.rendition.display(cfi);
      refreshEpubEbookPage();
      setScrollBarsPosition(0);
      sendIpcToMain("page-loaded", { percentage: percentage });
    } else {
      sendIpcToMain("page-loaded", { error: true });
    }
  } catch (error) {
    sendIpcToMain("page-loaded", { error: true });
  }
}

async function renderEpubEbookNext() {
  await g_currentEpubEbook.rendition.next();
  refreshEpubEbookPage();
  setScrollBarsPosition(0);
  sendIpcToMain("page-loaded", {
    percentage: getCurrentPercentage() * 100,
  });
}

async function renderEpubEbookPrev() {
  await g_currentEpubEbook.rendition.prev();
  refreshEpubEbookPage();
  setScrollBarsPosition(1);
  sendIpcToMain("page-loaded", {
    percentage: getCurrentPercentage() * 100,
  });
}

function refreshEpubEbookPage() {
  const height = document.querySelector("#epub-ebook-container").clientHeight;
  const scale = height / 600;
  document.documentElement.style.setProperty(
    "--zoom-epub-ebook-scale-factor",
    scale
  );
}

function getEpubEbookCfiFromPercentage(percentage) {
  return g_currentEpubEbook.book.locations.cfiFromPercentage(percentage);
}

function getCurrentPercentage() {
  const currentLocation = g_currentEpubEbook.rendition.currentLocation();
  return g_currentEpubEbook.book.locations.percentageFromCfi(
    currentLocation.start.cfi
  );
}
