/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const os = require("os");
const fs = require("fs");
const path = require("path");

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
  setBaseFolder(parentFolderPath);
};

exports.getOSTempFolderPath = function () {
  return os.tmpdir();
};

function setBaseFolder(parentFolderPath) {
  if (!parentFolderPath) {
    throw "setBaseFolder: undefined parent path";
  }
  const baseFolder = path.join(parentFolderPath, "acbr-tmp");
  if (baseFolder === g_baseFolderPath) {
    return;
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
