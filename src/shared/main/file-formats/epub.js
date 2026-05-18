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
  // ref: https://github.com/julien-c/epub/
  try {
    const EPub = require("epub");
    const epub = new EPub(filePath);

    await new Promise((resolve, reject) => {
      epub.once("error", reject);
      epub.once("end", function () {
        resolve();
      });
      epub.parse();
    });

    let imageIDs = [];
    const manifestKeys = Object.keys(epub.manifest);

    for (let index = 0; index < epub.spine.contents.length; index++) {
      const chapterId = epub.spine.contents[index].id;
      let promise = await getChapterImageIDs(epub, chapterId, manifestKeys);
      if (!promise.success) {
        throw promise.error;
      }
      imageIDs.push(...promise.ids);
    }

    return imageIDs;
  } catch (error) {
    log.error(error);
    return undefined;
  }
}
exports.getEpubImageIdsList = getEpubImageIdsList;

async function extractEpubImageBuffer(filePath, imageID) {
  try {
    const EPub = require("epub");
    const epub = new EPub(filePath);
    // parse epub
    await new Promise((resolve, reject) => {
      epub.once("error", reject);
      epub.once("end", () => resolve());
      epub.parse();
    });
    // extract image buffer
    let buf;
    let mime;
    await new Promise((resolve, reject) => {
      epub.getImage(imageID, function (error, data, mimeType) {
        if (error) {
          reject(error);
        } else {
          buf = Buffer.from(data);
          mime = mimeType;
          resolve();
        }
      });
    });
    return [buf, mime];
  } catch (error) {
    throw error;
  }
}
exports.extractEpubImageBuffer = extractEpubImageBuffer;

async function extractEpub(filePath, tempFolderPath) {
  try {
    const EPub = require("epub");
    const epub = new EPub(filePath);

    // parse epub
    await new Promise((resolve, reject) => {
      epub.once("error", reject);
      epub.once("end", () => resolve());
      epub.parse();
    });
    // get list of image IDs
    const manifestKeys = Object.keys(epub.manifest);
    let imageIDs = [];
    for (let index = 0; index < epub.spine.contents.length; index++) {
      const chapterId = epub.spine.contents[index].id;
      const discoveredIDs = await getChapterImageIDs(
        epub,
        chapterId,
        manifestKeys,
      );
      if (discoveredIDs.success && discoveredIDs.ids) {
        imageIDs.push(...discoveredIDs.ids);
      } else if (discoveredIDs.error) {
        throw discoveredIDs.error;
      }
    }

    // extract and save images
    for (let index = 0; index < imageIDs.length; index++) {
      const imageID = imageIDs[index];
      await new Promise((resolve) => {
        epub.getImage(imageID, function (error, data, mimeType) {
          if (error || !data) {
            resolve({ success: false, error: error });
          } else {
            // e.g. mimeType = image/png
            let extension = mimeType ? mimeType.split("/")[1] : "jpg";
            let outputFilePath = path.join(
              tempFolderPath,
              index + "." + extension,
            );
            fs.writeFileSync(outputFilePath, Buffer.from(data), "binary");
            resolve({ success: true });
          }
        });
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
exports.extractEpub = extractEpub;

//////////////////////////////////////////////////////////////////////////////
// HELPERS  ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function getChapterImageIDs(epub, chapterId, manifestKeys) {
  return new Promise((resolve, reject) => {
    epub.getChapter(chapterId, function (error, data) {
      if (error) {
        return resolve({ success: false, error, ids: [] });
      }

      const chapterIDs = [];
      let foundImgs = false;
      let m;
      // const rex = /<img[^>]+src="([^">]+)/g;
      const rex = /<img[^>]+src=(?:"([^">]+)"|'([^'>]+)')/g;

      // look for src in img tags
      while ((m = rex.exec(data))) {
        foundImgs = true;

        const srcString = m[1] || m[2];
        if (srcString && srcString.startsWith("data:")) {
          // discard base64 sources
          continue;
        }

        // remove potential starting instances of ../ or ..\
        // ?: avoids unnecessary memory overhead
        const cleanSrc = srcString.replace(/^(?:\.\.[/\\])+/, "");
        const srcTail = getPathTail(cleanSrc, false);
        const matchedImageId = findImageInManifest(
          manifestKeys,
          epub,
          srcTail,
          false,
          false,
        );

        if (matchedImageId) {
          chapterIDs.push(matchedImageId);
        }
      }

      // alternative for fixed layout / kindle comics, look for them
      // in the manifest
      if (!foundImgs && chapterId && epub.manifest[chapterId]) {
        // remove file extension (e.g. .xhtml)
        const chapTail = getPathTail(epub.manifest[chapterId].href, true);
        const id = findImageInManifest(
          manifestKeys,
          epub,
          chapTail,
          true,
          true,
        );
        if (id) {
          chapterIDs.push(id);
        }
      }

      resolve({ success: true, ids: chapterIDs });
    });
  });
}

function getPathTail(pathString, stripExtension = false) {
  if (!pathString) return "";
  const cleanPath = pathString.replace(/\\/g, "/"); // \ to /
  const parts = cleanPath.split("/");
  const sliceCount = parts.length >= 2 ? -2 : -1;
  let tail = parts.slice(sliceCount).join("/");
  if (stripExtension) {
    tail = tail.replace(/\.[^/.]+$/, "");
  }
  return tail;
}

function findImageInManifest(
  manifestKeys,
  epub,
  targetTail,
  exactMatch = false,
  stripExtension = false,
) {
  return manifestKeys.find((key) => {
    const asset = epub.manifest[key];
    const isImage =
      asset["media-type"] && asset["media-type"].startsWith("image/");
    if (!isImage) return false;
    const assetTail = getPathTail(asset.href, stripExtension);
    return exactMatch
      ? assetTail === targetTail
      : assetTail.endsWith(targetTail);
  });
}
