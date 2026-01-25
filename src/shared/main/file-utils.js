/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");
const log = require("./logger");

///////////////////////////////////////////////////////////////////////////////
// GENERAL ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.moveFile = function (oldPath, newPath) {
  try {
    fs.renameSync(oldPath, newPath);
  } catch (error) {
    if (error.code === "EXDEV") {
      // EXDEV = cross-device link not permitted.
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);
    } else {
      throw error;
    }
  }
};

exports.getFolderContents = function (folderPath) {
  try {
    if (fs.existsSync(folderPath)) {
      let folderStats = fs.lstatSync(folderPath);
      if (folderStats.isSymbolicLink()) {
        const realPath = fs.readlinkSync(folderPath);
        if (fs.existsSync(realPath)) {
          folderPath = realPath;
          folderStats = fs.lstatSync(folderPath);
        }
      }
      if (!folderStats.isDirectory()) {
        return undefined;
      }
      // get contents
      let filesInFolder = fs.readdirSync(folderPath);
      if (filesInFolder.length === 0) {
        return {};
      } else {
        let contents = {
          files: [],
          folders: [],
        };
        filesInFolder.forEach((entry) => {
          try {
            let data = {
              name: entry,
              fullPath: path.join(folderPath, entry),
              isLink: false,
            };
            let stats = fs.lstatSync(data.fullPath);
            if (
              process.platform === "win32" &&
              path.extname(entry) === ".lnk"
            ) {
              const { shell } = require("electron");
              const parsed = shell.readShortcutLink(data.fullPath);
              const realPath = parsed.target;
              data.isLink = true;
              if (fs.existsSync(realPath)) {
                data.name = path.basename(entry, path.extname(entry));
                data.fullPath = realPath;
                stats = fs.lstatSync(data.fullPath);
              }
            }
            if (!data.isLink && stats.isSymbolicLink()) {
              data.isLink = true;
              const realPath = fs.readlinkSync(path.join(folderPath, entry));
              if (fs.existsSync(realPath)) {
                data.fullPath = realPath;
                stats = fs.lstatSync(data.fullPath);
              }
            }
            // add to the corresponding list
            if (stats.isDirectory()) {
              contents.folders.push(data);
            } else {
              contents.files.push(data);
            }
          } catch (error) {
            // just don't add files/folders if there are errors
            // checking their stats
          }
        });
        return contents;
      }
    } else {
      return undefined;
    }
  } catch (error) {
    return undefined;
  }
};

exports.getFileSizeGB = function (filePath) {
  try {
    let stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024 * 1024);
  } catch (error) {
    return -1;
  }
};

function generateRandomSubfolderPath(baseFolderPath) {
  // let randomName = Math.random()
  //   .toString("36")
  //   .substring(2, 15)
  //   .replaceAll(" ", "");
  const { randomBytes } = require("node:crypto");
  let randomName = randomBytes(4).toString("hex");
  return path.join(baseFolderPath, randomName);
}

exports.createRandomSubfolder = function (baseFolderPath) {
  let folderPath = generateRandomSubfolderPath(baseFolderPath);
  let tries = 0;
  while (fs.existsSync(folderPath)) {
    tries++;
    if (tries > 5) return undefined;
    folderPath = generateRandomSubfolderPath(baseFolderPath);
  }
  fs.mkdirSync(folderPath);
  return folderPath;
};

exports.changeJpegBufferDpi = function (buffer, dpi) {
  /**
   * ref: JFIF 1.02 Spec https://www.w3.org/Graphics/JPEG/jfif3.pdf
   * -------------------------------------------------------------------------
   * Offset | Size | Value       | Description
   * -------------------------------------------------------------------------
   * i      | 2    | 0xFF 0xE0   | APP0 Marker
   * i + 4  | 5    | "JFIF\0"    | Identifier (0x4A 0x46 0x49 0x46 0x00)
   * i + 13 | 1    | 1           | Density Units (1 = DPI, 2 = Dots/cm)
   * i + 14 | 2    | 0xHH 0xLL   | Xdensity (16-bit Big Endian)
   * i + 16 | 2    | 0xHH 0xLL   | Ydensity (16-bit Big Endian)
   * -------------------------------------------------------------------------
   */
  // safety limit for the [i + 17] check
  const scanLimit = Math.min(buffer.length - 18, 50);
  if (scanLimit < 0) return buffer;

  for (let i = 0; i < scanLimit; i++) {
    // Marker
    if (buffer[i] === 0xff && buffer[i + 1] === 0xe0) {
      // Identifier
      if (
        buffer[i + 4] === 0x4a && // J
        buffer[i + 5] === 0x46 && // F
        buffer[i + 6] === 0x49 && // I
        buffer[i + 7] === 0x46 && // F
        buffer[i + 8] === 0x00 // \0
      ) {
        // Density Units
        buffer[i + 13] = 1;
        // Xdensity
        buffer[i + 14] = (dpi >> 8) & 0xff; // high
        buffer[i + 15] = dpi & 0xff; // low
        // Ydensity
        buffer[i + 16] = (dpi >> 8) & 0xff;
        buffer[i + 17] = dpi & 0xff;
        return buffer;
      }
    }
  }
  return buffer;
};

///////////////////////////////////////////////////////////////////////////////
// FILE TYPE //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.getFileTypeFromPath = function (filePath, returnMimeType = false) {
  // read 100 bytes
  const buffer = Buffer.alloc(100);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, buffer, 0, 100, 0);
  fs.closeSync(fd);
  let type = getFileTypeFromBuffer(buffer, returnMimeType);
  // ugly hack for epubs that don't strictly follow the spec
  if (returnMimeType) {
    if (
      type === "application/epub+zip" &&
      filePath.toLowerCase().endsWith(".epub")
    ) {
      type = "application/epub+zip";
    }
  } else {
    if (type === "zip" && filePath.toLowerCase().endsWith(".epub")) {
      type = "epub";
    }
  }
  return type;
};

function getFileTypeFromBuffer(buffer, returnMimeType = false) {
  try {
    const mimeMap = {
      rar: "application/x-rar-compressed", //rar: "application/vnd.rar",
      "7z": "application/x-7z-compressed",
      pdf: "application/pdf",
      epub: "application/epub+zip",
      zip: "application/zip",
      jpg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      avif: "image/avif",
    };

    const hex = buffer.toString("hex").toLowerCase();

    let type;

    // docs logic
    if (hex.startsWith("52617221")) type = "rar";
    else if (hex.startsWith("377abcaf")) type = "7z";
    else if (hex.startsWith("25504446")) type = "pdf";
    else if (hex.startsWith("504b0304")) {
      const check = buffer.toString("ascii", 30, 100);
      if (check.includes("mimetype") && check.includes("epub+zip")) {
        type = "epub";
      } else {
        type = "zip";
      }
    }
    // images logic
    else if (hex.startsWith("ffd8ff")) type = "jpg";
    else if (hex.startsWith("89504e47")) type = "png";
    else if (hex.startsWith("47494638")) type = "gif";
    else if (hex.startsWith("424d")) type = "bmp";
    else if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") {
      type = "webp";
    } else if (hex.slice(8, 24) === "6674797061766966") {
      type = "avif";
    }

    if (!type) return undefined;
    return returnMimeType ? mimeMap[type] : type;
  } catch (error) {
    log.error(error);
    return undefined;
  }
}
exports.getFileTypeFromBuffer = getFileTypeFromBuffer;

///////////////////////////////////////////////////////////////////////////////
// EXTENSIONS /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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

function hasComicBookExtension(filePath) {
  const allowedFileExtensions = [".cbz", ".cbr", ".pdf", ".epub", ".cb7"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
}
exports.hasComicBookExtension = hasComicBookExtension;

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

///////////////////////////////////////////////////////////////////////////////
// GET IMAGES /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const getImageFilesInFolderRecursive = function (
  folderPath,
  ignoreMacOSFolder = true,
) {
  let filesArray = [];
  let dirs = [];

  if (fs.existsSync(folderPath)) {
    let nodes = fs.readdirSync(folderPath);
    nodes.forEach((node) => {
      const nodePath = path.join(folderPath, node);
      if (fs.lstatSync(nodePath).isDirectory()) {
        if (!ignoreMacOSFolder || node !== "__MACOSX") {
          // check later so this folder's imgs come first
          dirs.push(nodePath);
        }
      } else {
        if (hasImageExtension(nodePath)) {
          filesArray.push(nodePath);
        }
      }
    });
    // now check inner folders
    dirs.forEach((dir) => {
      filesArray = filesArray.concat(getImageFilesInFolderRecursive(dir));
    });
  }
  return filesArray;
};
exports.getImageFilesInFolderRecursive = getImageFilesInFolderRecursive;

function getImageFilesInFolder(folderPath) {
  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    let filesInFolder = fs.readdirSync(folderPath);
    if (filesInFolder.length === 0) {
      return [];
    } else {
      return filesInFolder.filter(hasImageExtension);
    }
  } else {
    return [];
  }
}
exports.getImageFilesInFolder = getImageFilesInFolder;

///////////////////////////////////////////////////////////////////////////////
// GET FILES IN FOLDER ////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function hasAllowedFileExtension(filePath, allowedFileExtensions) {
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
}

const getFilesInFolderRecursive = function (folderPath, allowedFileExtensions) {
  let filesArray = [];
  let dirs = [];

  if (fs.existsSync(folderPath)) {
    let nodes = fs.readdirSync(folderPath);
    nodes.forEach((node) => {
      const nodePath = path.join(folderPath, node);
      if (fs.lstatSync(nodePath).isDirectory()) {
        dirs.push(nodePath); // check later so this folder's imgs come first
      } else {
        if (hasAllowedFileExtension(nodePath, allowedFileExtensions)) {
          filesArray.push(nodePath);
        }
      }
    });
    // now check inner folders
    dirs.forEach((dir) => {
      filesArray = filesArray.concat(
        getFilesInFolderRecursive(dir, allowedFileExtensions),
      );
    });
  }
  return filesArray;
};
exports.getFilesInFolderRecursive = getFilesInFolderRecursive;

function getFilesInFolder(folderPath, allowedFileExtensions) {
  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    let filesInFolder = fs.readdirSync(folderPath);
    if (filesInFolder.length === 0) {
      return [];
    } else {
      // return filesInFolder.filter(hasComicBookExtension);
      return filesInFolder.filter((filePath) => {
        return hasAllowedFileExtension(filePath, allowedFileExtensions);
      });
    }
  } else {
    return [];
  }
}
exports.getFilesInFolder = getFilesInFolder;

///////////////////////////////////////////////////////////////////////////////
// GET COMIC INFO FILE ////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const getComicInfoFileInFolderRecursive = function (folderPath) {
  let filesArray = [];
  let dirs = [];

  if (fs.existsSync(folderPath)) {
    let nodes = fs.readdirSync(folderPath);
    nodes.forEach((node) => {
      const nodePath = path.join(folderPath, node);
      if (fs.lstatSync(nodePath).isDirectory()) {
        dirs.push(nodePath); // check later so this folder's imgs come first
      } else {
        let fileName = path.basename(nodePath);
        if (fileName.toLowerCase() === "comicinfo.xml") {
          filesArray.push(nodePath);
        }
      }
    });
    // now check inner folders
    dirs.forEach((dir) => {
      filesArray = filesArray.concat(getComicInfoFileInFolderRecursive(dir));
    });
  }

  // NOTE: could there be more than one? I'll just return the first one for now, if any
  if (filesArray.length > 0) return filesArray[0];
  else return undefined;
};
exports.getComicInfoFileInFolderRecursive = getComicInfoFileInFolderRecursive;

///////////////////////////////////////////////////////////////////////////////
// DELETE /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.deleteFolderRecursive = function (
  folderPath,
  logToError,
  pathStartsWith,
  nameStartsWith,
) {
  if (!fs.existsSync(folderPath)) {
    log.editor("deleteFolderRecursive: !existsSync " + folderPath);
    return;
  }
  if (nameStartsWith && !path.basename(folderPath).startsWith(nameStartsWith))
    return;
  if (pathStartsWith && !folderPath.startsWith(pathStartsWith)) return;

  try {
    fs.rmSync(folderPath, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    log.debug("deleted folder: " + folderPath);
  } catch (error) {
    if (error.code === "EBUSY" || error.code === "ENOTEMPTY") {
      log.warning(
        "folder locked, attempting final delayed retry: " + folderPath,
      );
      setTimeout(() => {
        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          log.debug("retry success: deleted folder: " + folderPath);
        } catch (retryError) {
          log.error("couldn't delete folder: " + folderPath);
          log.error(retryError.code);
        }
      }, 500);
    } else {
      if (logToError) {
        log.error("couldn't delete folder: " + folderPath);
        log.error(error.code);
      } else {
        log.debug("couldn't delete folder: " + folderPath);
        log.debug(error.code);
      }
    }
  }
};
