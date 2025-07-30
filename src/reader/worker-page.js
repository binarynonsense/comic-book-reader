/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const fileFormats = require("../shared/main/file-formats");
const { FileDataType } = require("../shared/main/constants");
const fileUtils = require("../shared/main/file-utils");
const log = require("../shared/main/logger");

process.on("message", async (message) => {
  log.init(message[0]);
  const entryNames = message[3];
  let img64s = [];
  for (let i = 0; i < entryNames.length; i++) {
    const result = await extractBase64Image(i, ...message.slice(1));
    if (!result[0]) {
      process.send([false, result[1]]);
      return;
    }
    img64s.push(result[1]);
  }
  process.send([true, img64s, message[4]]);
});

async function extractBase64Image(
  entryNameIndex,
  fileType,
  filePath,
  entryNames,
  scrollBarPos,
  password,
  tempSubFolderPath
) {
  try {
    let buf;
    let mime;
    let error;
    if (fileType === FileDataType.ZIP) {
      //buf = fileFormats.extractZipEntryBuffer(filePath, entryName, password);
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
        password,
        tempSubFolderPath,
        "zip"
      );
      mime = "image/" + fileUtils.getMimeType(entryNames[entryNameIndex]);
      if (result.success) {
        buf = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.RAR) {
      buf = await fileFormats.extractRarEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
        password,
        tempSubFolderPath
      );
      mime = "image/" + fileUtils.getMimeType(entryNames[entryNameIndex]);
    } else if (fileType === FileDataType.SEVENZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
        password,
        tempSubFolderPath
      );
      mime = "image/" + fileUtils.getMimeType(entryNames[entryNameIndex]);
      if (result.success) {
        buf = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.EPUB_COMIC) {
      const data = await fileFormats.extractEpubImageBuffer(
        filePath,
        entryNames[entryNameIndex]
      );
      buf = data[0];
      mime = data[1];
    } else if (fileType === FileDataType.IMGS_FOLDER) {
      // if (!path.isAbsolute(entryName)) {
      //   // FIXME: make it absolute somehow?
      // }
      const fullPath = path.join(filePath, entryNames[entryNameIndex]);
      buf = fs.readFileSync(fullPath);
      mime = "image/" + fileUtils.getMimeType(fullPath);
    } else {
      //  TODO: handle error file type not valid
    }
    if (buf) {
      let img64 = "data:" + mime + ";base64," + buf.toString("base64");
      return [true, img64, scrollBarPos];
    } else {
      if (error) {
        throw error;
      } else throw "empty buffer";
    }
  } catch (error) {
    return [false, error];
  }
}
