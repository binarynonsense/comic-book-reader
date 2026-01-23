/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const fileFormats = require("../shared/main/file-formats");
const { FileDataType } = require("../shared/main/constants");
const fileUtils = require("../shared/main/file-utils");

process.on("message", async (message) => {
  const entryNames = message[3];
  let images = [];
  for (let i = 0; i < entryNames.length; i++) {
    const result = await extractImageBuffer(i, ...message.slice(1));
    if (!result[0]) {
      process.send([false, result[1]]);
      return;
    }
    images.push({ buffer: result[1], mime: result[2] });
  }
  process.send([true, buffers, message[4]]);
});

process.parentPort?.once("message", async (event) => {
  let message = event.data;
  const entryNames = message[3];
  let img64s = [];
  for (let i = 0; i < entryNames.length; i++) {
    const result = await extractImageBuffer(i, ...message.slice(1));
    if (!result[0]) {
      process.parentPort.postMessage([false, result[1]]);
      return;
    }
    img64s.push(result[1]);
  }
  process.parentPort.postMessage([true, img64s, message[4]]);
});

async function extractImageBuffer(
  entryNameIndex,
  fileType,
  filePath,
  entryNames,
  scrollBarPos,
  password,
  tempSubFolderPath,
) {
  try {
    let buffer;
    let mime;
    let error;
    if (fileType === FileDataType.ZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
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
      buffer = await fileFormats.extractRarEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
        password,
        tempSubFolderPath,
      );
    } else if (fileType === FileDataType.SEVENZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
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
        entryNames[entryNameIndex],
      );
      buffer = data[0];
    } else if (fileType === FileDataType.IMGS_FOLDER) {
      // if (!path.isAbsolute(entryName)) {
      //   // FIXME: make it absolute somehow?
      // }
      const fullPath = path.join(filePath, entryNames[entryNameIndex]);
      buffer = fs.readFileSync(fullPath);
    } else {
      //  TODO: handle error file type not valid
    }
    if (buffer) {
      mime = fileUtils.getImageMimeTypeFromBuffer(buffer);
      return [true, buffer, mime, scrollBarPos];
    } else {
      if (error) {
        throw error;
      } else throw "empty buffer";
    }
  } catch (error) {
    return [false, error];
  }
}
