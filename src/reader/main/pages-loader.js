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

let g_loadedPages = {};
let g_runningJobs = [];
let g_fileData;

let sendIpcToRenderer, closeCurrentFile;

exports.init = function (_sendIpcToRenderer, _closeCurrentFile) {
  sendIpcToRenderer = _sendIpcToRenderer;
  closeCurrentFile = _closeCurrentFile;
};

// exports.onBookOpened = function () {};

exports.onBookClosed = function (fileData) {
  log.test("[PAGES] book closed: " + fileData?.path);
  g_fileData = undefined;
  killPageWorker();
};

//////////////////////////////////////////////////////////////////////////////
// PAGES /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getPages = async function (fileData, pageIndexes, scrollBarPos) {
  g_fileData = fileData;
  timers.start("pagesExtraction");
  // log.test(`[PAGES] get pages: ${g_fileData.path}`);
  // log.test(pageIndexes);
  if (g_fileData.type !== FileDataType.WWW) {
    let extraData, config;
    let entryNames = pageIndexes;
    if (g_fileData.type === FileDataType.PDF) {
      if (!settings.getValue("pdfReadingLibrary").startsWith("pdfjs")) {
        extraData = { dpi: settings.getValue("pdfReadingDpi") };
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
      config = settings.getValue("epubEbook");
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
        ? temp.createSubFolder()
        : undefined;

    startPageWorker();

    sendToPageWorker({
      command: "extract",
      fileType: g_fileData.type,
      filePath: g_fileData.cachedPath ?? g_fileData.path,
      entryNames,
      scrollBarPos,
      password: g_fileData.password,
      tempSubFolderPath,
      extraData,
      config,
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
};

//////////////////////////////////////////////////////////////////////////////
// WORKERS ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_pageWorker;

function startPageWorker() {
  try {
    if (g_pageWorker === undefined) {
      log.editor("[PAGES] start page worker");
      g_pageWorker = forkUtils.fork(path.join(__dirname, "./worker-page.js"), {
        exposeGC: true,
        memoryLimit: 3072,
      });
      g_pageWorker.on("message", (message) => {
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
            log.debug(
              `[PAGES] page load time: ${timers.stop("pagesExtraction").toFixed(2)}s`,
            );
            if (message.success === true) {
              sendIpcToRenderer(
                "render-img-page",
                message.images, // buffers and mimes
                g_fileData.pageRotation,
                message.scrollBarPos,
              );
              temp.deleteSubFolder(message.tempSubFolderPath);
              return;
            } else if (message.success === false) {
              killPageWorker();
              if (message?.error?.toString() === "password required") {
                log.warning("[PAGES] password required");
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
                temp.deleteSubFolder(message.tempSubFolderPath);
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
        }
      });
      return true;
    }
    return false;
  } catch (error) {
    throw error;
  }
}

function killPageWorker() {
  if (g_pageWorker !== undefined) {
    log.editor("[PAGES] kill page worker");
    g_pageWorker.kill();
    g_pageWorker = undefined;
  }
}

function sendToPageWorker(data) {
  g_pageWorker.postMessage(data);
}
