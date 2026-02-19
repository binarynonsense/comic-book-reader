/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const log = require("./logger");
const { deleteFolderRecursive } = require("./file-utils");

let g_baseFolderPath;

exports.init = function (parentFolderPath) {
  setBaseFolder(parentFolderPath);
};

exports.cleanUp = function () {
  log.debug("cleaning up temp folder");
  deleteBaseFolder();
};

exports.changeBaseFolderPath = function (parentFolderPath) {
  return setBaseFolder(parentFolderPath, false);
};

exports.getOSTempFolderPath = function () {
  return os.tmpdir();
};

exports.getBaseFolder = function () {
  return g_baseFolderPath;
};

function setBaseFolder(parentFolderPath, resetToDefault) {
  try {
    if (!exports.isValidParentFolder(parentFolderPath)) {
      log.debug(`couldn't set ${parentFolderPath} as temp folder`);
      if (resetToDefault) {
        parentFolderPath = getOSTempFolderPath();
      } else {
        return false;
      }
    }
    const baseFolder = path.join(parentFolderPath, "acbr-tmp");
    if (baseFolder === g_baseFolderPath) {
      log.editor("setBaseFolder: baseFolder === g_baseFolderPath");
      return true;
    }
    if (fs.existsSync(baseFolder)) {
      // it already existed, clean it up just in case
      deleteFolderRecursive(baseFolder, true, undefined, "acbr-tmp");
    }
    fs.mkdirSync(baseFolder);
    log.debug("base temp folder: " + baseFolder);
    if (g_baseFolderPath) {
      // there was a different one set already, clean it up just in case
      deleteBaseFolder();
    }
    g_baseFolderPath = baseFolder;
    return true;
  } catch (error) {
    log.error(error);
    return false;
  }
}

function deleteBaseFolder() {
  deleteFolderRecursive(g_baseFolderPath, true, undefined, "acbr-tmp");
}

exports.createSubFolder = function () {
  let folderPath = fs.mkdtempSync(path.join(g_baseFolderPath, "acbr-tmp-"));
  log.debug("created folder: " + folderPath);
  return folderPath;
};

exports.deleteSubFolder = function (folderPath) {
  if (folderPath) {
    deleteFolderRecursive(folderPath, true, g_baseFolderPath, "acbr-tmp-");
  }
};

exports.isValidParentFolder = function (folderPath) {
  if (
    !folderPath ||
    !fs.existsSync(folderPath) ||
    !fs.lstatSync(folderPath).isDirectory() ||
    !exports.isWritable(folderPath)
  ) {
    return false;
  }
  return true;
};

exports.isWritable = function (folderPath) {
  try {
    fs.accessSync(folderPath, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
};
