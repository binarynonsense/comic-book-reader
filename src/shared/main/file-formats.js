/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

function isDev() {
  return process.argv[2] == "--dev";
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getMimeType(filePath) {
  let mimeType = path.extname(filePath).substring(1);
  return mimeType;
}
exports.getMimeType = getMimeType;

function hasImageExtension(filePath) {
  const allowedFileExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".avif",
  ];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
}
exports.hasImageExtension = hasImageExtension;

exports.hasBookExtension = function (filePath) {
  const allowedFileExtensions = [".cbz", ".cbr", ".pdf", ".epub", ".cb7"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
};

exports.hasComicBookExtension = function (filePath) {
  const allowedFileExtensions = [".cbz", ".cbr", ".pdf", ".epub", ".cb7"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
};

exports.hasEpubExtension = function (filePath) {
  let fileExtension = path.extname(filePath).toLowerCase();
  if (fileExtension === ".epub") {
    return true;
  }
  return false;
};

exports.hasPdfKitCompatibleImageExtension = function (filePath) {
  const allowedFileExtensions = [".jpg", ".jpeg", ".png"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
};

exports.hasEpubSupportedImageExtension = function (filePath) {
  const allowedFileExtensions = [".jpg", ".jpeg", ".png"]; // gif?
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
};

// mostly a copy from file-utils

function createTempFolder() {
  let tempFolderPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "comic-book-reader-")
  );
  return tempFolderPath;
}

function cleanUpTempFolder(tempFolderPath) {
  if (tempFolderPath === undefined) return;
  deleteTempFolderRecursive(tempFolderPath);
  tempFolderPath = undefined;
}

const deleteTempFolderRecursive = function (folderPath) {
  if (fs.existsSync(folderPath)) {
    if (!folderPath.startsWith(os.tmpdir())) {
      // safety check
      return;
    }
    let files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const entryPath = path.join(folderPath, file);
      if (fs.lstatSync(entryPath).isDirectory()) {
        deleteTempFolderRecursive(entryPath);
      } else {
        fs.unlinkSync(entryPath); // delete the file
      }
    });
    fs.rmdirSync(folderPath);
  }
};

///////////////////////////////////////////////////////////////////////////////
// RAR ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function getRarEntriesList(filePath, password) {
  try {
    const unrar = require("node-unrar-js");
    let buf = Uint8Array.from(fs.readFileSync(filePath)).buffer;

    let extractor;
    try {
      extractor = await unrar.createExtractorFromData({
        data: buf,
        password: password,
      });
    } catch (error) {
      if (error.message.startsWith("Password for encrypted")) {
        // the file list is also encrypted
        // full message is something like:
        // "Password for encrypted file or header is not specified"
        return { result: "password required", paths: [] };
      } else {
        throw error;
      }
    }

    const list = extractor.getFileList();
    // const arcHeader = list.arcHeader;
    // console.log(arcHeader);
    const fileHeaders = [...list.fileHeaders];
    let imgEntries = [];
    let comicInfoId = undefined;
    let isEncrypted = false;
    let encryptedEntryName;
    fileHeaders.forEach(function (header) {
      if (header.flags.encrypted) {
        isEncrypted = true;
        encryptedEntryName = header.name;
      }
      if (!header.flags.directory) {
        if (hasImageExtension(header.name)) {
          imgEntries.push(header.name);
        } else if (header.name.toLowerCase().endsWith("comicinfo.xml")) {
          comicInfoId = header.name;
        }
      }
    });
    if (isEncrypted) {
      // try password to see if there's an error = wrong password
      try {
        const extracted = extractor.extract({ files: [encryptedEntryName] });
        const files = [...extracted.files];
        files[0].extraction;
      } catch (error) {
        return { result: "password required", paths: [] };
      }
    }
    return {
      result: "success",
      paths: imgEntries,
      metadata: { encrypted: isEncrypted, comicInfoId: comicInfoId },
    };
  } catch (error) {
    console.log(error.message);
    return { result: "other error", paths: [] };
  }
}
exports.getRarEntriesList = getRarEntriesList;

async function extractRarEntryBuffer(rarPath, entryName, password) {
  try {
    const unrar = require("node-unrar-js");
    let buf = Uint8Array.from(fs.readFileSync(rarPath)).buffer;
    let extractor = await unrar.createExtractorFromData({
      data: buf,
      password: password,
    });
    const extracted = extractor.extract({ files: [entryName] });
    const files = [...extracted.files];
    files[0].extraction; // Uint8Array
    return Buffer.from(files[0].extraction);
  } catch (error) {
    console.log(error);
    return undefined;
  }
}
exports.extractRarEntryBuffer = extractRarEntryBuffer;

async function extractRar(filePath, tempFolderPath, password) {
  try {
    const unrar = require("node-unrar-js");
    //ref: https://github.com/YuJianrong/node-unrar.js
    let extractor = await unrar.createExtractorFromFile({
      filepath: filePath,
      targetPath: tempFolderPath,
      password: password,
    });
    const { files } = extractor.extract();
    [...files]; // lazy initialization? the files are not extracted if I don't do this
    return true;
  } catch (error) {
    return false;
  }
}
exports.extractRar = extractRar;

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
        if (hasImageExtension(zipEntry.entryName)) {
          imgEntries.push(zipEntry.entryName);
        } else if (zipEntry.entryName.toLowerCase().endsWith("comicinfo.xml")) {
          comicInfoId = zipEntry.entryName;
        }
      }
    });
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
    console.log(error.message);
    return { result: "other error", paths: [] };
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
    console.log(error);
    return false;
  }
}
exports.updateZipEntry = updateZipEntry;

///////////////////////////////////////////////////////////////////////////////
// 7ZIP ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pathTo7zipBin;
function checkPathTo7ZipBin() {
  const sevenBin = require("7zip-bin");
  if (g_pathTo7zipBin === undefined) {
    g_pathTo7zipBin = sevenBin.path7za;
    if (!isDev()) {
      // find the one that works in the release version
      g_pathTo7zipBin = g_pathTo7zipBin.replace(
        "app.asar",
        "app.asar.unpacked"
      );
    }
  }
  return g_pathTo7zipBin;
}

async function get7ZipEntriesList(filePath, password) {
  try {
    if (password === undefined || password === "") {
      // to help trigger the right error
      password = "_";
    }
    checkPathTo7ZipBin();
    // NOTE:  I use test instead of list because it gives an error for encrypted files
    // that have the file names ot encrypted, and also returns the file list.
    // List only gives an error if the names are also encrypted
    // TODO: check if test comes with a performance hit for big files? Don't really know what it tests...
    const Seven = require("node-7z");
    const seven = Seven.test(filePath, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
      password: password,
    });

    let imgEntries;
    let comicInfoId = undefined;
    let promise = await new Promise((resolve) => {
      imgEntries = [];
      seven.on("data", function (data) {
        if (hasImageExtension(data.file)) {
          imgEntries.push(data.file);
        } else if (data.file.toLowerCase().endsWith("comicinfo.xml")) {
          comicInfoId = data.file;
        }
      });
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: imgEntries,
        });
      });
    });

    if (promise.success === true) {
      return {
        result: "success",
        paths: imgEntries,
        metadata: {
          encrypted: password && password !== "_",
          comicInfoId: comicInfoId,
        },
      };
    } else if (promise.success === false) {
      if (promise.data.toString().search("password") !== -1) {
        // Can not open encrypted archive. Wrong password?"
        return { result: "password required", paths: [] };
      }
    }
    // shouldn't reach this point
    return { result: "other error", paths: [] };
  } catch (error) {
    console.log(error);
    return { result: "other error", paths: [] };
  }
}
exports.get7ZipEntriesList = get7ZipEntriesList;

async function extract7ZipEntryBuffer(filePath, entryName, password) {
  let tempFolderPath;
  try {
    tempFolderPath = createTempFolder();
    //////////////////////////////////////////
    if (password === undefined || password === "") {
      // to help trigger the right error
      password = "_";
    }
    checkPathTo7ZipBin();

    const Seven = require("node-7z");
    const seven = Seven.extract(filePath, tempFolderPath, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
      password: password,
      $cherryPick: entryName,
    });

    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        console.log(error);
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: "",
        });
      });
    });

    let buffer;
    if (promise.success === true) {
      buffer = fs.readFileSync(path.join(tempFolderPath, entryName));
      cleanUpTempFolder(tempFolderPath);
      return buffer;
    }
    //////////////////////////////////////////
    cleanUpTempFolder(tempFolderPath);
    return undefined;
  } catch (error) {
    console.log(error);
    cleanUpTempFolder(tempFolderPath);
    return undefined;
  }
}
exports.extract7ZipEntryBuffer = extract7ZipEntryBuffer;

async function extract7Zip(filePath, tempFolderPath, password) {
  try {
    if (password === undefined || password === "") {
      // to help trigger the right error
      password = "_";
    }
    checkPathTo7ZipBin();

    const Seven = require("node-7z");
    const seven = Seven.extractFull(filePath, tempFolderPath, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
      password: password,
    });

    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: "",
        });
      });
    });

    if (promise.success === true) {
      return true;
    } else if (promise.success === false) {
      throw promise.data;
    }
    throw "Error: unknown error extracting 7z file";
  } catch (error) {
    return false;
  }
}
exports.extract7Zip = extract7Zip;

async function create7Zip(filePathsList, outputFilePath) {
  try {
    checkPathTo7ZipBin();

    const Seven = require("node-7z");
    const seven = Seven.add(outputFilePath, filePathsList, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
    });
    // TODO: test archiveType, maybe to support cbt files?
    // not sure, but possible values may be: 7z, xz, split, zip, gzip, bzip2, tar,

    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
        });
      });
    });

    if (promise.success === true) {
      return;
    } else if (promise.success === false) {
      throw promise.data;
    }
  } catch (error) {
    throw error;
  }
}
exports.create7Zip = create7Zip;

async function update7ZipEntry(filePath, entryName, workingDir, password) {
  try {
    checkPathTo7ZipBin();
    const Seven = require("node-7z");
    const seven = Seven.add(filePath, entryName, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8",
      password: password,
      workingDir: workingDir,
    });
    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: "",
        });
      });
    });

    if (promise.success === true) {
      return true;
    }
    throw promise.data;
  } catch (error) {
    console.log(error);
    return false;
  }
}
exports.update7ZipEntry = update7ZipEntry;

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
    console.log(error);
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

async function createEpub(
  imgPathsList,
  outputFilePath,
  tempFolderPath,
  imageStorageSelection
) {
  try {
    const epub = require("./epub-generator");
    await epub.createComic(
      imgPathsList,
      outputFilePath,
      tempFolderPath,
      imageStorageSelection
    );
    return;
  } catch (error) {
    throw error;
  }
}
exports.createEpub = createEpub;

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function createPdf(imgPathsList, outputFilePath, method) {
  try {
    const PDFDocument = require("pdfkit");
    const sharp = require("sharp");
    const pdf = new PDFDocument({
      autoFirstPage: false,
    });
    pdf.pipe(fs.createWriteStream(outputFilePath));
    for (let index = 0; index < imgPathsList.length; index++) {
      const imgPath = imgPathsList[index];
      const img = pdf.openImage(imgPath);

      if (method === "metadata") {
        let imgData = await sharp(imgPath).metadata();
        let imgDpi = imgData.density;
        if (imgDpi === undefined || imgDpi < 72) imgDpi = 300;
        pdf.addPage({
          margin: 0,
          size: [(72 * img.width) / imgDpi, (72 * img.height) / imgDpi],
        });
        pdf.image(img, 0, 0, { scale: 72.0 / imgDpi });
      } else if (method === "300dpi") {
        let imgDpi = 300;
        pdf.addPage({
          margin: 0,
          size: [(72 * img.width) / imgDpi, (72 * img.height) / imgDpi],
        });
        pdf.image(img, 0, 0, { scale: 72.0 / imgDpi });
      } else if (method === "72dpi") {
        pdf.addPage({
          margin: 0,
          size: [img.width, img.height],
        });
        pdf.image(img, 0, 0);
      }
    }
    pdf.end();
  } catch (error) {
    throw error;
  }
}
exports.createPdf = createPdf;
