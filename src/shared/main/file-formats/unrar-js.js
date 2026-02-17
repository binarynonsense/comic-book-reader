// /**
//  * @license
//  * Copyright 2020-2026 Álvaro García
//  * www.binarynonsense.com
//  * SPDX-License-Identifier: BSD-2-Clause
//  */

// const path = require("node:path");
// const fs = require("node:fs");
// const utils = require("../utils");
// const fileUtils = require("../file-utils");
// const log = require("../logger");

// ///////////////////////////////////////////////////////////////////////////////
// // RAR ////////////////////////////////////////////////////////////////////////
// ///////////////////////////////////////////////////////////////////////////////

// async function getRarEntriesList(filePath, password, tempSubFolderPath) {
//   try {
//     const unrar = require("node-unrar-js");
//     //let buf = Uint8Array.from(fs.readFileSync(filePath)).buffer;
//     let extractor;
//     try {
//       // extractor = await unrar.createExtractorFromData({
//       //   data: buf,
//       //   password: password,
//       // });
//       extractor = await unrar.createExtractorFromFile({
//         filepath: filePath,
//         targetPath: tempSubFolderPath,
//         password: password,
//       });
//     } catch (error) {
//       if (error.message.startsWith("Password for encrypted")) {
//         // the file list is also encrypted
//         // full message is something like:
//         // "Password for encrypted file or header is not specified"
//         return { result: "password required", paths: [] };
//       } else {
//         throw error;
//       }
//     }

//     const list = extractor.getFileList();
//     // const arcHeader = list.arcHeader;
//     // log.debug(arcHeader);
//     const fileHeaders = [...list.fileHeaders];
//     let imgEntries = [];
//     let comicInfoId = undefined;
//     let comicInfoIds = [];
//     let isEncrypted = false;
//     let encryptedEntryName;
//     fileHeaders.forEach(function (header) {
//       if (header.flags.encrypted) {
//         isEncrypted = true;
//         encryptedEntryName = header.name;
//       }
//       if (!header.flags.directory) {
//         if (fileUtils.hasImageExtension(header.name)) {
//           imgEntries.push(header.name);
//         } else if (header.name.toLowerCase().endsWith("comicinfo.xml")) {
//           comicInfoIds.push(header.name);
//         }
//       }
//     });
//     if (comicInfoIds.length > 0) {
//       if (comicInfoIds.length > 1) {
//         for (const id of comicInfoIds) {
//           if (id.toLowerCase() === "comicinfo.xml") {
//             // is at the root, choose that one
//             comicInfoId = id;
//             break;
//           }
//         }
//         if (!comicInfoId) {
//           // choose any one, the first detected?
//           comicInfoId = comicInfoIds[0];
//         }
//       } else {
//         comicInfoId = comicInfoIds[0];
//       }
//     }
//     if (isEncrypted) {
//       // try password to see if there's an error = wrong password
//       try {
//         const extracted = extractor.extract({ files: [encryptedEntryName] });
//         const files = [...extracted.files];
//         files[0].extraction;
//       } catch (error) {
//         return { result: "password required", paths: [] };
//       }
//     }
//     return {
//       result: "success",
//       paths: imgEntries,
//       metadata: { encrypted: isEncrypted, comicInfoId: comicInfoId },
//     };
//   } catch (error) {
//     if (error.message.startsWith("Password for encrypted")) {
//       // "Password for encrypted file or header is not specified"
//       return { result: "password required", paths: [] };
//     } else {
//       log.error(error.message);
//       if (error.message.includes("greater than 2 GiB")) {
//         return { result: "other error", paths: [], extra: "over2gb" };
//       } else {
//         return { result: "other error", paths: [] };
//       }
//     }
//   }
// }
// exports.getRarEntriesList = getRarEntriesList;

// async function extractRarEntryBuffer(
//   rarPath,
//   entryName,
//   password,
//   tempSubFolderPath,
// ) {
//   try {
//     const unrar = require("node-unrar-js");
//     // let buf = Uint8Array.from(fs.readFileSync(rarPath)).buffer;
//     // let extractor = await unrar.createExtractorFromData({
//     //   data: buf,
//     //   password: password,
//     // });
//     // const extracted = extractor.extract({ files: [entryName] });
//     // const files = [...extracted.files];
//     // files[0].extraction; // Uint8Array

//     let extractor = await unrar.createExtractorFromFile({
//       filepath: rarPath,
//       targetPath: tempSubFolderPath,
//       password: password,
//     });
//     const extracted = extractor.extract({ files: [entryName] });
//     const files = [...extracted.files];
//     let buffer = fs.readFileSync(path.join(tempSubFolderPath, entryName));

//     return buffer;
//   } catch (error) {
//     log.error(error);
//     return undefined;
//   }
// }
// exports.extractRarEntryBuffer = extractRarEntryBuffer;

// async function extractRar(filePath, tempFolderPath, password) {
//   try {
//     const unrar = require("node-unrar-js");
//     //ref: https://github.com/YuJianrong/node-unrar.js
//     let extractor = await unrar.createExtractorFromFile({
//       filepath: filePath,
//       targetPath: tempFolderPath,
//       password: password,
//     });
//     const { files } = extractor.extract();
//     [...files]; // lazy initialization? the files are not extracted if I don't do this
//     return { success: true };
//   } catch (error) {
//     if (error.message && error.message.includes("ENOSPC")) {
//       //ENOSPC: no space left on device, write
//       error = "no_disk_space";
//     }
//     return { success: false, error: error };
//   }
// }
// exports.extractRar = extractRar;
