/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const fileFormats = require("../shared/main/file-formats");
const { FileDataType } = require("../shared/main/constants");
const fileUtils = require("../shared/main/file-utils");
const log = require("../shared/main/logger");

process.on("message", (message) => {
  log.init(message[0]);
  extractBase64Image(...message.slice(1));
});

async function extractBase64Image(
  fileType,
  filePath,
  entryName,
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
        entryName,
        password,
        tempSubFolderPath,
        "zip"
      );
      mime = "image/" + fileUtils.getMimeType(entryName);
      if (result.success) {
        buf = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.RAR) {
      buf = await fileFormats.extractRarEntryBuffer(
        filePath,
        entryName,
        password,
        tempSubFolderPath
      );
      mime = "image/" + fileUtils.getMimeType(entryName);
    } else if (fileType === FileDataType.SEVENZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryName,
        password,
        tempSubFolderPath
      );
      mime = "image/" + fileUtils.getMimeType(entryName);
      if (result.success) {
        buf = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.EPUB_COMIC) {
      const data = await fileFormats.extractEpubImageBuffer(
        filePath,
        entryName
      );
      buf = data[0];
      mime = data[1];
    } else if (fileType === FileDataType.IMGS_FOLDER) {
      // if (!path.isAbsolute(entryName)) {
      //   // FIXME: make it absolute somehow?
      // }
      const fullPath = path.join(filePath, entryName);
      buf = fs.readFileSync(fullPath);
      mime = "image/" + fileUtils.getMimeType(fullPath);
    } else {
      //  TODO: handle error file type not valid
    }
    if (buf) {
      let img64 = "data:" + mime + ";base64," + buf.toString("base64");
      process.send([true, img64, scrollBarPos]);
    } else {
      if (error) {
        throw error;
      } else throw "empty buffer";
    }
  } catch (error) {
    process.send([false, error]);
  }
}
