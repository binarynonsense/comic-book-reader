/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");
const log = require("../logger");

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function getEpubImageIdsList(filePath) {
  // ref: https://github.com/julien-c/epub/blob/master/example/example.js
  // ref: https://github.com/julien-c/epub/issues/16
  try {
    const EPub = require("epub");
    const epub = new EPub(filePath);

    let promise = await new Promise((resolve, reject) => {
      epub.on("error", function (error) {
        resolve({ success: false, error: error });
      });
      epub.on("end", function (error) {
        if (error) {
          resolve({ success: false, error: error });
        } else {
          resolve({ success: true, error: undefined });
        }
      });
      epub.parse();
    });
    if (!promise.success) {
      throw promise.error;
    }

    let imageIDs = [];
    for (let index = 0; index < epub.spine.contents.length; index++) {
      let promise = await new Promise((resolve, reject) => {
        epub.getChapter(epub.spine.contents[index].id, function (error, data) {
          if (error) {
            resolve({
              success: false,
              error: error,
            });
          } else {
            // ref: https://stackoverflow.com/questions/14939296/extract-image-src-from-a-string/14939476
            const rex = /<img[^>]+src="([^">]+)/g;
            while ((m = rex.exec(data))) {
              // e.g. /images/img-0139/OPS/images/0139.jpeg
              let id = m[1].split("/")[2];
              imageIDs.push(id);
            }
            resolve({
              success: true,
            });
          }
        });
      });
      if (!promise.success) {
        throw promise.error;
      }
    }
    return imageIDs;
  } catch (error) {
    log.error(error);
    return undefined;
  }
}
exports.getEpubImageIdsList = getEpubImageIdsList;

async function extractEpubImageBuffer(filePath, imageID) {
  const EPub = require("epub");
  const epub = new EPub(filePath);

  // parse epub
  await new Promise((resolve, reject) => {
    epub.parse();
    epub.on("error", reject);
    epub.on("end", (err) => {
      if (err) {
        return reject({
          error: true,
          message: err,
        });
      }
      return resolve({
        success: true,
      });
    });
  });

  // extract image buffer
  let buf;
  let mime;
  await new Promise((resolve, reject) => {
    epub.getImage(imageID, function (err, data, mimeType) {
      if (err) {
        return reject({
          error: true,
          message: err,
        });
      } else {
        buf = Buffer.from(data);
        mime = mimeType;
        return resolve({
          success: true,
        });
      }
    });
  });
  return [buf, mime];
}
exports.extractEpubImageBuffer = extractEpubImageBuffer;

async function extractEpub(filePath, tempFolderPath) {
  try {
    const EPub = require("epub");
    const epub = new EPub(filePath);

    // parse epub
    let promise = await new Promise((resolve, reject) => {
      epub.parse();
      epub.on("error", reject);
      epub.on("end", (error) => {
        if (error) {
          resolve({ success: false, error: error });
        } else {
          resolve({
            success: true,
          });
        }
      });
    });
    if (!promise.success) throw promise.error;

    // get list of image IDs
    let imageIDs = [];
    for (let index = 0; index < epub.spine.contents.length; index++) {
      const element = epub.spine.contents[index];
      let promise = await new Promise((resolve, reject) => {
        epub.getChapter(element.id, function (error, data) {
          if (error) {
            resolve({ success: false, error: error });
          } else {
            const rex = /<img[^>]+src="([^">]+)/g;
            while ((m = rex.exec(data))) {
              // e.g. /images/img-0139/OPS/images/0139.jpeg
              let id = m[1].split("/")[2];
              imageIDs.push(id);
            }
            resolve({
              success: true,
            });
          }
        });
      });
      if (!promise.success) throw promise.error;
    }

    // extract and save images
    for (let index = 0; index < imageIDs.length; index++) {
      const imageID = imageIDs[index];
      let promise = await new Promise((resolve, reject) => {
        epub.getImage(imageID, function (error, data, mimeType) {
          if (error) {
            resolve({ success: false, error: error });
          } else {
            let extension = mimeType.split("/")[1];
            let filePath = path.join(tempFolderPath, index + "." + extension);
            fs.writeFileSync(filePath, Buffer.from(data), "binary");
            resolve({
              success: true,
            });
          }
        });
      });
    }

    return true;
  } catch (error) {
    return false;
  }
}
exports.extractEpub = extractEpub;
