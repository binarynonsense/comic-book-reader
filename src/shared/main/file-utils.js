/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");
const fs = require("fs");
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

///////////////////////////////////////////////////////////////////////////////
// EXTENSIONS /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.getImageMimeTypeFromBuffer = function (buffer) {
  if (!buffer || buffer.length < 12) return "image/png";
  // need the first 12 bytes
  const hex = buffer.toString("hex", 0, 12);

  if (hex.startsWith("ffd8ff")) {
    return "image/jpeg";
  }
  if (hex.startsWith("89504e47")) {
    return "image/png";
  }
  if (hex.startsWith("47494638")) {
    return "image/gif";
  }
  if (hex.startsWith("424d")) {
    return "image/bmp";
  }
  // WEBP (RIFF .... WEBP)
  // hex.slice(16, 24) is the offset for the 8th to 12th byte
  if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") {
    return "image/webp";
  }
  // AVIF (.... ftypavif)
  // usually starts with 000000 followed by ftypavif (6674797061766966)
  if (hex.includes("6674797061766966")) {
    return "image/avif";
  }

  return "image/png"; // fallback value // TODO: better return undefined?
};

exports.getFileTypeFromPath = function (filePath) {
  try {
    // read 100 bytes
    const buffer = Buffer.alloc(100);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 100, 0);
    fs.closeSync(fd);
    const hex = buffer.toString("hex").toLowerCase();

    // docs
    if (hex.startsWith("52617221")) return "rar"; // Rar!
    if (hex.startsWith("377abcaf")) return "7z"; // 7z
    if (hex.startsWith("25504446")) return "pdf"; // %PDF
    // ZIP or EPUB start with PK.. (504b0304)
    if (hex.startsWith("504b0304")) {
      const check = buffer.toString("ascii", 30, 100);
      if (check.includes("mimetype") && check.includes("epub+zip")) {
        return "epub";
      }
      // not the greatest solution but some epubs are not 100% compliant
      // with the specification
      if (filePath.toLowerCase().endsWith(".epub")) {
        return "epub";
      }
      return "zip";
    }

    // images
    if (hex.startsWith("ffd8ff")) return "jpg";
    if (hex.startsWith("89504e47")) return "png";
    if (hex.startsWith("47494638")) return "gif";
    if (hex.startsWith("424d")) return "bmp";
    // WebP (RIFF at byte 0, WEBP at byte 8)
    if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") {
      return "webp";
    }
    // AVIF (ftypavif at byte 4)
    // check index 8 to 24 (8 bytes / 16 hex chars)
    if (hex.slice(8, 24) === "6674797061766966") {
      return "avif";
    }

    return undefined;
  } catch (error) {
    log.error(error);
    return undefined;
  }
};

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

function deleteFolderRecursive(
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
}

function deleteFolderRecursiveOLD(
  folderPath,
  logToError,
  pathStartsWith,
  nameStartsWith,
) {
  if (fs.existsSync(folderPath)) {
    if (nameStartsWith) {
      const folderName = path.basename(folderPath);
      if (!folderName.startsWith(nameStartsWith)) {
        log.warning(
          "tried to delete a folder with a name that doesn't start with: " +
            nameStartsWith,
        );
        log.warning(folderPath);
        return;
      }
    }
    if (pathStartsWith) {
      if (!folderPath.startsWith(pathStartsWith)) {
        log.warning(
          "tried to delete a folder with a path that doesn't start with: " +
            pathStartsWith,
        );
        log.warning(folderPath);
        return;
      }
    }
    let files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const entryPath = path.join(folderPath, file);
      if (fs.lstatSync(entryPath).isDirectory()) {
        deleteFolderRecursive(entryPath, logToError);
      } else {
        try {
          fs.unlinkSync(entryPath); // delete the file
        } catch (error) {
          log.debug("couldn't delete file: " + entryPath);
        }
      }
    });
    try {
      fs.rmdirSync(folderPath);
      log.debug("deleted folder: " + folderPath);
    } catch (error) {
      if (error.code == "ENOTEMPTY") {
        // TODO: retry?
        // this can happen if for example the temp folder is the same
        // as the one the conversion is outputing to
      }
      if (logToError) {
        log.error("couldn't delete folder: " + folderPath);
        log.error(error.code);
      } else {
        log.debug("couldn't delete folder: " + folderPath);
        log.debug(error.code);
      }
    }
  } else {
    log.editor("deleteFolderRecursive: !existsSync " + folderPath);
  }
}
exports.deleteFolderRecursive = deleteFolderRecursive;
