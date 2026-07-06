/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");
const log = require("../logger");
const utils = require("../utils");
const temp = require("../temp");
const {
  getEpubOpfEntriesList,
  extract7ZipEntryBuffer,
} = require("./seven-zip");

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function getEpubImageIdsList(filePath, tempFolderPath) {
  try {
    const metadata = await parseEpubMetadata(filePath, tempFolderPath);
    if (!metadata.success) return undefined;

    const { manifest, spine, opfDir } = metadata.data;
    let imageIDs = [];

    for (let index = 0; index < spine.length; index++) {
      const chapterId = spine[index].id;
      let promise = await getChapterImageIDs(
        filePath,
        chapterId,
        manifest,
        opfDir,
        tempFolderPath,
      );
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

async function extractEpubImageBuffer(filePath, imageID, tempFolderPath) {
  try {
    const metadata = await parseEpubMetadata(filePath, tempFolderPath);
    if (!metadata.success) throw new Error(metadata.data);

    const epubData = metadata.data;
    const asset = epubData.manifest[imageID];
    if (!asset) throw `EPUB: image id "${imageID}" not in manifest`;

    const targetPath = path.posix.join(epubData.opfDir, asset.href);

    // extract image buffer
    const buf = await extract7ZipEntryBuffer(
      filePath,
      targetPath,
      undefined,
      tempFolderPath,
      "zip",
    );

    const mime = asset["media-type"];

    return { success: true, data: buf.data, mime };
  } catch (error) {
    return { success: false, data: error };
  }
}
exports.extractEpubImageBuffer = extractEpubImageBuffer;

async function extractEpub(filePath, tempFolderPath, extraData) {
  try {
    if (!tempFolderPath) throw "EPUB: temp folder is undefined";

    const metadata = await parseEpubMetadata(filePath, tempFolderPath);
    if (!metadata.success) throw "EPUB: failed parsing metadata";

    const { manifest, spine, opfDir } = metadata.data;

    // get list of image IDs
    let imageIDs = [];
    for (let index = 0; index < spine.length; index++) {
      const chapterId = spine[index].id;
      const discoveredIDs = await getChapterImageIDs(
        filePath,
        chapterId,
        manifest,
        opfDir,
        tempFolderPath,
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
      const asset = manifest[imageID];
      if (!asset) continue;

      const targetPath = path.posix.join(opfDir, asset.href);

      try {
        const buffer = await extract7ZipEntryBuffer(
          filePath,
          targetPath,
          undefined,
          extraData.tempSubFolderPath,
          "zip",
        );
        if (!buffer.success) throw "EPUB: bad image";

        // e.g. mimeType = image/png
        const mimeType = asset["media-type"];
        const extension = mimeType ? mimeType.split("/")[1] : "jpg";
        const fileName = utils.padNumber(index + 1, imageIDs.length);
        const outputFilePath = path.join(
          tempFolderPath,
          fileName + "." + extension,
        );
        fs.writeFileSync(outputFilePath, buffer.data, "binary");
      } catch (e) {
        continue;
      }
    }

    return { success: true, extraData };
  } catch (error) {
    return { success: false, error };
  }
}
exports.extractEpub = extractEpub;

//////////////////////////////////////////////////////////////////////////////
// HELPERS  //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

async function parseEpubMetadata(filePath, tempFolderPath) {
  try {
    const { XMLParser } = require("fast-xml-parser");

    const opfEntries = await getEpubOpfEntriesList(filePath);
    if (!opfEntries || opfEntries.length === 0) throw "EPUB: couldn't find opf";
    // same as a I do in getMetadataProperties in epub-metadata.js
    let opfEntryPath;
    for (let index = 0; index < opfEntries.length; index++) {
      const opf = opfEntries[index];
      if (opf.startsWith("OEBPS") || opf.startsWith("OPS")) {
        opfEntryPath = opf;
        break;
      }
    }
    if (!opfEntryPath) {
      throw "EPUB: couldn't find opf (2)";
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });

    const normalizedOpfPath = opfEntryPath.replace(/\\/g, "/");
    const opfDir =
      path.posix.dirname(normalizedOpfPath) === "."
        ? ""
        : path.posix.dirname(normalizedOpfPath);

    const opfBuffer = await extract7ZipEntryBuffer(
      filePath,
      opfEntryPath,
      undefined,
      tempFolderPath,
      "zip",
    );
    // TODO: check result for !success

    const opfData = parser.parse(opfBuffer.data.toString());

    let manifestData = opfData.package.manifest.item;
    if (!Array.isArray(manifestData))
      manifestData = manifestData ? [manifestData] : [];
    const manifest = {};
    manifestData.forEach((item) => {
      manifest[item.id] = item;
    });

    let spineData = opfData.package.spine.itemref;
    if (!Array.isArray(spineData)) spineData = spineData ? [spineData] : [];
    const spine = spineData.map((item) => ({ id: item.idref }));

    return { success: true, data: { manifest, spine, opfDir } };
  } catch (error) {
    return { success: false, data: error };
  }
}

function getChapterImageIDs(
  filePath,
  chapterId,
  manifest,
  opfDir,
  tempFolderPath,
) {
  return new Promise(async (resolve) => {
    try {
      const manifestKeys = Object.keys(manifest);

      const asset = manifest[chapterId];
      if (!asset) {
        return resolve({
          success: false,
          error: `EPUB: chapter ${chapterId} missing`,
          ids: [],
        });
      }

      const targetPath = path.posix.join(opfDir, asset.href);

      const buffer = await extract7ZipEntryBuffer(
        filePath,
        targetPath,
        undefined,
        tempFolderPath,
        "zip",
      );
      // TODO: check success
      const data = buffer.data.toString("utf-8");

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
          manifest,
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
      if (!foundImgs && chapterId && manifest[chapterId]) {
        // remove file extension (e.g. .xhtml)
        const chapTail = getPathTail(manifest[chapterId].href, true);
        const id = findImageInManifest(
          manifestKeys,
          manifest,
          chapTail,
          true,
          true,
        );
        if (id) {
          chapterIDs.push(id);
        }
      }

      resolve({ success: true, ids: chapterIDs });
    } catch (error) {
      resolve({ success: false, error, ids: [] });
    }
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
  manifest,
  targetTail,
  exactMatch = false,
  stripExtension = false,
) {
  return manifestKeys.find((key) => {
    const asset = manifest[key];
    const isImage =
      asset["media-type"] &&
      asset["media-type"].toLowerCase().startsWith("image/");
    if (!isImage) return false;
    const assetTail = getPathTail(asset.href, stripExtension);
    return exactMatch
      ? assetTail === targetTail
      : assetTail.endsWith(targetTail);
  });
}
