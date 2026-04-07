/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

///////////////////////////////////////////////////////////////////////////////
// WORKER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

require("../../shared/main/env-utils").setSafeEnvironment(
  "[PAGE WORKER] ",
  send,
);

const fs = require("node:fs");
const path = require("node:path");
const fileFormats = require("../../shared/main/file-formats");
const { FileDataType } = require("../../shared/main/constants");
const fileUtils = require("../../shared/main/file-utils");

process.parentPort.on("message", async (event) => {
  let message = event.data;
  // process.parentPort.postMessage({
  //   type: "testLog",
  //   log: `[page worker] message received: ${message.command}`,
  // });
  if (message.command === "extract") {
    const pageIndexes = message.pageIndexes;
    const entryNames = message.entryNames;
    const workerId = message.extraData.workerId;
    const cacheJobId = message.extraData.cacheJobId;
    let images = [];
    let tempSubFolderPath = message.tempSubFolderPath;
    for (let i = 0; i < entryNames.length; i++) {
      message.entryName = entryNames[i];
      const result = await extractImageBuffer(message);
      if (result.success === false) {
        process.parentPort.postMessage({
          type: "extractResult",
          success: false,
          error: result.error,
          tempSubFolderPath,
          workerId,
          cacheJobId,
        });
        return;
      }
      images.push({
        pageIndex: pageIndexes[i],
        buffer: result.buffer,
        mime: result.mime,
      });
    }
    process.parentPort.postMessage({
      type: "extractResult",
      success: true,
      images,
      tempSubFolderPath,
      scrollBarPos: message.scrollBarPos,
      workerId,
      cacheJobId,
    });
  } else if (message.command === "open") {
    if (message.fileType === FileDataType.PDF) {
      ////
      // const result = await fileFormats.openPdf(
      //   message.filePath,
      //   message.password,
      // );
      // message.type = "openResult";
      // message.result = result;
      // process.parentPort.postMessage(message);
      const result = await fileFormats.openMuPdf(
        message.filePath,
        message.password,
      );
      message.type = "openResult";
      message.result = result;
      process.parentPort.postMessage(message);
    } else if (
      message.fileType === FileDataType.EPUB_EBOOK ||
      message.fileType === FileDataType.AZW3 ||
      message.fileType === FileDataType.MOBI ||
      message.fileType === FileDataType.FB2
    ) {
      const result = await fileFormats.openMuEpub(
        message.filePath,
        message.tempSubFolderPath,
        message.extraData.config,
      );
      message.type = "openResult";
      message.result = result;
      process.parentPort.postMessage(message);
    }
  }
});

async function extractImageBuffer({
  entryName,
  fileType,
  filePath,
  scrollBarPos,
  password,
  tempSubFolderPath,
  extraData,
}) {
  try {
    let buffer;
    let mime;
    let error;
    if (fileType === FileDataType.ZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryName,
        password,
        tempSubFolderPath,
        "zip",
      );
      if (result.success) {
        buffer = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.RAR) {
      // buffer = await fileFormats.extractRarEntryBuffer(
      //   filePath,
      //   entryNames[entryNameIndex],
      //   password,
      //   tempSubFolderPath,
      // );
      result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryName,
        password,
        tempSubFolderPath,
        "rar",
      );
      if (result.success) {
        buffer = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.SEVENZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryName,
        password,
        tempSubFolderPath,
      );
      if (result.success) {
        buffer = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.EPUB_COMIC) {
      const data = await fileFormats.extractEpubImageBuffer(
        filePath,
        entryName,
      );
      buffer = data[0];
    } else if (fileType === FileDataType.IMGS_FOLDER) {
      // if (!path.isAbsolute(entryName)) {
      //   // FIXME: make it absolute somehow?
      // }
      const fullPath = path.join(filePath, entryName);
      buffer = fs.readFileSync(fullPath);
    } else if (fileType === FileDataType.PDF) {
      // buffer = await fileFormats.extractPdfPageBuffer(
      //   filePath,
      //   entryNames[entryNameIndex], // = page number
      //   extraData?.dpi,
      // );
      const result = await fileFormats.extractMuPdfPageBuffer(
        filePath,
        entryName, // = page number
        password,
        extraData?.dpi,
        4500,
      );
      if (result.success) {
        buffer = result.data;
      } else {
        error = result.data;
      }
    } else if (
      fileType === FileDataType.EPUB_EBOOK ||
      fileType === FileDataType.AZW3 ||
      fileType === FileDataType.MOBI ||
      fileType === FileDataType.FB2
    ) {
      const result = await fileFormats.extractMuEpubPageBuffer(
        filePath,
        entryName, // = page number
        tempSubFolderPath,
        extraData.config,
      );
      if (result.success) {
        buffer = result.data;
      } else {
        error = result.data;
      }
    } else {
      //  TODO: handle error file type not valid
    }
    if (buffer) {
      mime = fileUtils.getFileTypeFromBuffer(buffer, true);
      return { success: true, buffer, mime, scrollBarPos };
    } else {
      if (error) {
        throw error;
      } else throw "empty buffer";
    }
  } catch (error) {
    return { success: false, error };
  }
}

function send(message) {
  process.parentPort.postMessage(message);
}
