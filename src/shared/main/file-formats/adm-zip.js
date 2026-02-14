/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fileUtils = require("../file-utils");
const log = require("../logger");

///////////////////////////////////////////////////////////////////////////////
// ZIP ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getZipEntriesList(filePath, password) {
  try {
    const AdmZip = require("adm-zip");
    let zip = new AdmZip(filePath);
    let zipEntries = zip.getEntries();
    let imgEntries = [];
    let comicInfoId = undefined;
    let comicInfoIds = [];
    let isEncrypted = false;
    let encryptedEntryName;
    let compressionMethod;
    zipEntries.forEach(function (zipEntry) {
      if (zipEntry.header.encripted) {
        isEncrypted = true;
        encryptedEntryName = zipEntry.entryName;
        compressionMethod = zipEntry.header.method;
      }
      if (!zipEntry.isDirectory) {
        if (fileUtils.hasImageExtension(zipEntry.entryName)) {
          imgEntries.push(zipEntry.entryName);
        } else if (zipEntry.entryName.toLowerCase().endsWith("comicinfo.xml")) {
          comicInfoIds.push(zipEntry.entryName);
        }
      }
    });
    if (comicInfoIds.length > 0) {
      if (comicInfoIds.length > 1) {
        for (const id of comicInfoIds) {
          if (id.toLowerCase() === "comicinfo.xml") {
            // is at the root, choose that one
            comicInfoId = id;
            break;
          }
        }
        if (!comicInfoId) {
          // choose any one, the first detected?
          comicInfoId = comicInfoIds[0];
        }
      } else {
        comicInfoId = comicInfoIds[0];
      }
    }
    if (isEncrypted) {
      if (parseInt(compressionMethod) !== 99) {
        // AES encryption is not supported by adm-zip, only ZipCrypto
        // compression method 99 indicates the AES encryption
        if (!zip.test(password)) {
          return { result: "password required", paths: [] };
        }
      } else {
        // can't handle this protection
        return { result: "other error", paths: [], extra: "aes" };
      }
    }
    return {
      result: "success",
      paths: imgEntries,
      metadata: { encrypted: isEncrypted, comicInfoId: comicInfoId },
    };
  } catch (error) {
    log.error(error.message);
    if (error.message.includes("greater than 2 GiB")) {
      return { result: "other error", paths: [], extra: "over2gb" };
    } else {
      return { result: "other error", paths: [] };
    }
  }
}
exports.getZipEntriesList = getZipEntriesList;

function extractZipEntryBuffer(zipPath, entryName, password) {
  const AdmZip = require("adm-zip");
  let zip = new AdmZip(zipPath);
  return zip.readFile(entryName, password);
}
exports.extractZipEntryBuffer = extractZipEntryBuffer;

function extractZip(filePath, tempFolderPath, password) {
  // ref: https://github.com/cthackers/adm-zip/wiki/ADM-ZIP-Introduction
  try {
    const AdmZip = require("adm-zip");
    let zip = new AdmZip(filePath);
    const imageData = zip.readFile("");
    zip.extractAllTo(tempFolderPath, true, false, password);
    return true;
  } catch (error) {
    return false;
  }
}
exports.extractZip = extractZip;

function createZip(filePathsList, outputFilePath) {
  const AdmZip = require("adm-zip");
  let zip = new AdmZip();
  filePathsList.forEach((element) => {
    zip.addLocalFile(element);
  });
  zip.writeZip(outputFilePath);
}
exports.createZip = createZip;

function updateZipEntry(zipPath, entryName, contentBuffer, entryExists) {
  try {
    const AdmZip = require("adm-zip");
    let zip = new AdmZip(zipPath);
    if (entryExists) zip.updateFile(entryName, contentBuffer);
    else zip.addFile(entryName, contentBuffer);
    zip.writeZip(zipPath);
    return true;
  } catch (error) {
    log.error(error);
    return false;
  }
}
exports.updateZipEntry = updateZipEntry;
