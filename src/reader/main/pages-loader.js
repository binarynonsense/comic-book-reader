/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");

const settings = require("../../shared/main/settings");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const temp = require("../../shared/main/temp");
const forkUtils = require("../../shared/main/fork-utils");
const timers = require("../../shared/main/timers");
const { FileDataState, FileDataType } = require("../../shared/main/constants");

//////////////////////////////////////////////////////////////////////////////
// SETUP /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let sendIpcToRenderer, closeCurrentFile;

let g_fileData;
let g_pageWorkerMain = { id: "main" };
let g_pageWorkerBG = { id: "bg" };
let g_cacheJobId = 0;

exports.init = function (_sendIpcToRenderer, _closeCurrentFile) {
  sendIpcToRenderer = _sendIpcToRenderer;
  closeCurrentFile = _closeCurrentFile;
};

exports.onQuit = function () {
  killPageWorker(g_pageWorkerMain);
  killPageWorker(g_pageWorkerBG);
};

exports.onBookClosed = function (fileData) {
  g_fileData = undefined;
  g_cacheJobId++;
  log.editor("[PAGES] cacheJobId: " + g_cacheJobId);
  killPageWorker(g_pageWorkerMain);
  killPageWorker(g_pageWorkerBG);
  clearCache();
};

exports.setCacheSize = function (value) {
  log.editor("[PAGES] set cache size limit: " + value);
  g_pageCacheLimitMB = value;
  killPageWorker(g_pageWorkerBG);
  clearCache();
};

exports.getCacheStats = function () {
  const currentPage = g_fileData?.pageIndex;
  const sortedIndexes =
    g_pageCache.size > 0 && g_fileData
      ? (() => {
          const allKeys = Array.from(g_pageCache.keys()).sort((a, b) => a - b);
          const before = allKeys
            .filter((i) => i < currentPage)
            .map((i) => i + 1)
            .join(", ");
          const current = allKeys.includes(currentPage)
            ? (currentPage + 1).toString()
            : "";
          const after = allKeys
            .filter((i) => i > currentPage)
            .map((i) => i + 1)
            .join(", ");

          return [before, current, after]; //`${before}\n${current}\n${after}`;
        })()
      : "";

  return {
    maxSize: g_pageCacheLimitMB,
    size: g_currentPageCacheMB,
    sortedIndexes,
  };
};

//////////////////////////////////////////////////////////////////////////////
// TEMP FOLDERS //////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_tempCacheFolder;

function createTempCacheFolder() {
  g_tempCacheFolder = temp.createSubFolder();
}

function deleteTempCacheFolder() {
  if (!g_tempCacheFolder) return;
  const tempCacheFolder = g_tempCacheFolder;
  g_tempCacheFolder = undefined;
  // use a timeout to avoid folders not really deleting if called too fast
  setTimeout(() => {
    temp.deleteSubFolder(tempCacheFolder);
  }, 200);
}

function createTempPageFolder() {
  if (!g_tempCacheFolder) createTempCacheFolder();
  return temp.createSubFolder(g_tempCacheFolder);
}

function deleteTempPageFolder(folderPath) {
  temp.deleteSubFolder(folderPath);
}

//////////////////////////////////////////////////////////////////////////////
// PAGES /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_scrollBarPos;
let g_currentRequest = [];

exports.loadPage = async function (fileData, pageIndexes, scrollBarPos) {
  timers.start("pagesExtraction");
  g_scrollBarPos = scrollBarPos;
  g_currentRequest = pageIndexes.map((pageIndex, index) => ({
    pageIndex,
    image: getCachedPage(pageIndex),
  }));
  pageIndexes = [];
  g_currentRequest.forEach((request) => {
    if (request.image === undefined) {
      pageIndexes.push(request.pageIndex);
    }
  });
  killPageWorker(g_pageWorkerBG);
  if (pageIndexes.length <= 0) {
    sendCurrentRequestResult();
    return;
  }
  // need page/s
  fetchPages(g_pageWorkerMain, fileData, pageIndexes);
};

function tryBgFetchIfNeeded() {
  const pageIndex = getPageIndexCandidate(
    g_fileData.pageIndex,
    g_fileData.numPages,
  );
  if (pageIndex !== undefined) {
    startPageWorker(g_pageWorkerBG);
    fetchPages(g_pageWorkerBG, g_fileData, [pageIndex]);
  } else {
    killPageWorker(g_pageWorkerBG);
  }
}

function isCurrentRequestDone() {
  for (let index = 0; index < g_currentRequest.length; index++) {
    if (g_currentRequest[index].image === undefined) return false;
  }
  return true;
}

function sendCurrentRequestResult() {
  log.debug(
    `[PAGES] page load time: ${timers.stop("pagesExtraction").toFixed(2)}s`,
  );
  const images = g_currentRequest.map((request, index) => request.image);
  sendIpcToRenderer(
    "render-img-page",
    images, // buffers and mimes
    g_fileData.pageRotation,
    g_scrollBarPos,
  );
  g_currentRequest = [];
  tryBgFetchIfNeeded();
}

function pagesFetched(message) {
  if (message.success === true) {
    try {
      if (message.cacheJobId !== g_cacheJobId) {
        log.debug("[PAGES] pagesFetched message.cacheJobId !== g_cacheJobId");
        return;
      }
      deleteTempPageFolder(message.tempSubFolderPath);
      message.images.forEach((image) => {
        cachePage(image.pageIndex, image, g_fileData.pageIndex);
      });
      if (message.workerId === "main") {
        message.images.forEach((image) => {
          g_currentRequest.forEach((request) => {
            if (request.pageIndex === image.pageIndex) {
              log.editor(
                "[PAGES] update request fulfilled for page " + image.pageIndex,
              );
              request.image = image;
            }
          });
        });
        if (isCurrentRequestDone()) {
          sendCurrentRequestResult();
        }
      } else {
        tryBgFetchIfNeeded();
      }
    } catch (error) {
      log.debug("unknown pagesFetched error");
      log.error(error);
    }
    return;
  } else if (message.success === false) {
    killPageWorker(g_pageWorkerMain);
    killPageWorker(g_pageWorkerBG);
    clearCache();
    if (message?.error?.toString() === "password required") {
      // log.warning("[PAGES] password required");
      sendIpcToRenderer(
        "show-modal-prompt-password",
        _("ui-modal-prompt-enterpassword"),
        path.basename(g_fileData.path),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel"),
      );
      return;
    } else {
      // TODO: handle other errors
      log.error("[PAGES] unhandled worker error");
      log.error("[PAGES] " + message.error);
      deleteTempPageFolder(message.tempSubFolderPath);
      const type = g_fileData.type;
      closeCurrentFile();
      sendIpcToRenderer(
        "show-modal-info",
        _("tool-shared-modal-title-error"),
        _("ui-modal-info-couldntopen-format", type?.toUpperCase()),
        _("ui-modal-prompt-button-ok"),
      );
      return;
    }
  }
}

async function fetchPages(pageWorker, fileData, pageIndexes) {
  g_fileData = fileData;
  let scrollBarPos = g_scrollBarPos;
  if (g_fileData.type !== FileDataType.WWW) {
    let extraData = { workerId: pageWorker.id, cacheJobId: g_cacheJobId };
    let entryNames = pageIndexes;
    if (g_fileData.type === FileDataType.PDF) {
      if (!settings.getValue("pdfReadingLibrary").startsWith("pdfjs")) {
        extraData.dpi = settings.getValue("pdfReadingDpi");
      } else {
        // pdfjs
        sendIpcToRenderer(
          "render-pdf-page",
          pageIndexes,
          g_fileData.pageRotation,
          scrollBarPos,
          settings.getValue("pdfReadingDpi"),
        );
        return;
      }
    } else if (
      g_fileData.type === FileDataType.EPUB_EBOOK ||
      g_fileData.type === FileDataType.AZW3 ||
      g_fileData.type === FileDataType.MOBI ||
      g_fileData.type === FileDataType.FB2
    ) {
      extraData.config = settings.getValue("epubEbook");
    } else {
      entryNames = [];
      pageIndexes.forEach((index) => {
        entryNames.push(g_fileData.pagesPaths[index]);
      });
    }

    let tempSubFolderPath =
      g_fileData.type === FileDataType.SEVENZIP ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.EPUB_EBOOK ||
      g_fileData.type === FileDataType.AZW3 ||
      g_fileData.type === FileDataType.MOBI ||
      g_fileData.type === FileDataType.FB2
        ? createTempPageFolder()
        : undefined;

    startPageWorker(pageWorker);
    sendToPageWorker(pageWorker, {
      command: "extract",
      fileType: g_fileData.type,
      filePath: g_fileData.cachedPath ?? g_fileData.path,
      pageIndexes,
      entryNames,
      scrollBarPos,
      password: g_fileData.password,
      tempSubFolderPath,
      extraData,
    });
    return;
  } else {
    // WWW
    const calledFunc = g_fileData.getPageCallback;
    let response = await g_fileData.getPageCallback(
      g_fileData.pageIndex + 1,
      g_fileData,
    );
    if (calledFunc !== g_fileData.getPageCallback) {
      // getPageCallback changed while downloading
      return;
    }
    if (!response || !response.pageImgSrc) {
      // TODO: handle error
      log.error("[PAGES] download error");
      g_fileData.state = FileDataState.LOADED;
      sendIpcToRenderer("update-loading", false);
      return;
    }
    g_fileData.pagesPaths = [response.pageImgUrl];
    if (response.tempData) {
      if (g_fileData.data) {
        g_fileData.data.tempData = response.tempData;
      }
    }
    sendIpcToRenderer(
      "render-img-page",
      [{ url: response.pageImgSrc }],
      g_fileData.pageRotation,
      scrollBarPos,
    );
    return;
  }
}

//////////////////////////////////////////////////////////////////////////////
// CACHE /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

const g_pageCache = new Map();
const g_minPages = 3;
let g_currentPageCacheMB = 0;
let g_pageCacheLimitMB = 32;
// g_bgFetchedPages is used to avoid an infinite delete-fetch-delete... loop
let g_bgFetchedPages = new Set();

function updatePageCacheSize() {
  let totalBytes = 0;
  for (const page of g_pageCache.values()) {
    // .byteLength for TypedArrays/ArrayBuffers, .length for Node Buffers
    if (page && page.buffer) {
      totalBytes += page.buffer.byteLength || page.buffer.length || 0;
    }
  }
  g_currentPageCacheMB = totalBytes / (1024 * 1024);
  log.editor(
    `[PAGES] [CACHE] cache size ${g_currentPageCacheMB.toFixed(2)}MB - ${g_pageCache.size} entries`,
  );
  const sortedIndexes = Array.from(g_pageCache.keys())
    .sort((a, b) => a - b)
    .map((i) => i + 1)
    .join(", ");
  log.editor("[PAGES] [CACHE] current indexes: " + sortedIndexes);
  return g_currentPageCacheMB;
}

function getCachedPage(index) {
  return g_pageCache.get(index);
}

// size based
// function getPageIndexCandidate(currentPage, numPages) {
//   currentPage++; // skew 1 ahead, as it's the most probable reading direction
//   const radius = Math.floor(g_maxPages / 2);
//   for (let r = 1; r <= radius; r++) {
//     const ahead = currentPage + r;
//     const back = currentPage - r;
//     // check ahead
//     if (ahead < numPages && !g_pageCache.has(ahead)) return ahead;
//     // check back
//     if (back >= 0 && !g_pageCache.has(back)) return back;
//   }
//   return undefined;
// }

// memory based
function getPageIndexCandidate(currentPage, numPages) {
  let pageIndex = undefined;
  if (g_currentPageCacheMB >= g_pageCacheLimitMB) {
    return undefined;
  }
  currentPage++;
  for (let r = 1; r < numPages; r++) {
    const ahead = currentPage + r;
    const back = currentPage - r;
    const isAheadInBounds = ahead < numPages;
    const isBackInBounds = back >= 0;
    if (!isAheadInBounds && !isBackInBounds) break;
    // check ahead
    if (isAheadInBounds && !g_pageCache.has(ahead)) {
      pageIndex = ahead;
      break;
    }
    // check back
    if (isBackInBounds && !g_pageCache.has(back)) {
      pageIndex = back;
      break;
    }
  }
  if (pageIndex !== undefined) {
    if (g_bgFetchedPages.has(pageIndex)) {
      pageIndex = undefined;
    } else {
      g_bgFetchedPages.add(pageIndex);
    }
  }
  return pageIndex;
}

function cachePage(index, image, currentPage) {
  if (g_pageCache.has(index)) return;
  currentPage++; // skew 1 ahead, as it's the most probable reading direction
  g_pageCache.set(index, image ?? null);
  updatePageCacheSize();
  // num entries based
  // if (g_pageCache.size >= g_maxPages) {
  //   // make room
  //   let furthestPage = -1;
  //   let maxDistance = -1;
  //   for (const cachedIndex of g_pageCache.keys()) {
  //     const distance = Math.abs(cachedIndex - currentPage);
  //     if (distance > maxDistance) {
  //       maxDistance = distance;
  //       furthestPage = cachedIndex;
  //     }
  //   }
  //   if (furthestPage !== -1) {
  //     g_pageCache.delete(furthestPage);
  //   }
  // }
  // memory size based
  while (
    g_currentPageCacheMB > g_pageCacheLimitMB &&
    g_pageCache.size > g_minPages
  ) {
    // make room
    let furthestPageIndex = -1;
    let maxDistance = -1;
    for (const cachedIndex of g_pageCache.keys()) {
      const distance = Math.abs(cachedIndex - currentPage);
      if (distance > maxDistance) {
        maxDistance = distance;
        furthestPageIndex = cachedIndex;
      }
    }
    if (furthestPageIndex !== -1) {
      // NOTE: use this, plus deleting updatePageCacheSize(); below, if
      // I decide to not recalculate the whole thing for one delete
      // const page = g_pageCache.get(furthestPageIndex);
      // if (page?.buffer) {
      //   g_currentCacheMB -=
      //     (page.buffer.byteLength || page.buffer.length || 0) / (1024 * 1024);
      // }
      g_pageCache.delete(furthestPageIndex);
      updatePageCacheSize();
    }
  }
}

function clearCache() {
  g_currentPageCacheMB = 0;
  g_pageCache.clear();
}

//////////////////////////////////////////////////////////////////////////////
// WORKERS ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function startPageWorker(pageWorker) {
  try {
    if (pageWorker.process === undefined) {
      log.editor("[PAGES] start page worker");
      pageWorker.process = forkUtils.fork(
        path.join(__dirname, "./worker-page.js"),
        {
          exposeGC: true,
          memoryLimit: 3072,
        },
      );
      pageWorker.process.on("message", (message) => {
        if (message.type === "testLog") {
          log.test("[PAGES] " + message.log);
          return;
        } else if (message.type === "editorLog") {
          log.editor("[PAGES] " + message.log);
          return;
        } else if (message.type === "debugLog") {
          log.debug("[PAGES] " + message.log);
          return;
        } else {
          if (message.type === "extractResult") {
            pagesFetched(message);
          }
        }
      });
      return true;
    }
    return false;
  } catch (error) {
    log.editorError(error);
    throw error;
  }
}

function killPageWorker(pageWorker) {
  if (pageWorker.process !== undefined) {
    log.editor("[PAGES] kill page worker " + pageWorker.id);
    pageWorker.process.kill();
    pageWorker.process = undefined;
    if (pageWorker.id === "bg") {
      g_bgFetchedPages = new Set();
    }
  }
  deleteTempCacheFolder();
}

function sendToPageWorker(pageWorker, data) {
  pageWorker.process.postMessage(data);
}
