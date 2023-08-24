/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const fileUtils = require("./file-utils");

///////////////////////////////////////////////////////////////////////////////
// PATHS //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getDesktopFolderPath() {
  return app.getPath("desktop");
}
exports.getDesktopFolderPath = getDesktopFolderPath;

function getUserDataFolderPath() {
  return app.getPath("userData");
}
exports.getUserDataFolderPath = getUserDataFolderPath;

function getExeFolderPath() {
  if (process.platform === "linux") {
    if (process.env.APPIMAGE) {
      return path.dirname(process.env.APPIMAGE);
    } else {
      if (process.argv[2] == "--dev") {
        return process.cwd();
      } else {
        return path.join(app.getAppPath(), "../../");
      }
    }
  } else {
    // win
    return path.join(app.getAppPath(), "../../");
  }
}
exports.getExeFolderPath = getExeFolderPath;

function isPortable() {
  return fs.existsSync(path.join(getExeFolderPath(), "portable.txt"));
}
exports.isPortable = isPortable;

exports.getConfigFolder = function () {
  if (isPortable()) {
    try {
      fs.accessSync(getExeFolderPath(), fs.constants.W_OK);
      return getExeFolderPath();
    } catch (err) {
      console.log("Warning: portable settings' folder not writable");
    }
  }
  return getUserDataFolderPath();
};

///////////////////////////////////////////////////////////////////////////////
// FILE DIALOGUES /////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function chooseOpenFiles(
  window,
  defaultPath,
  allowedFileTypesName,
  allowedFileTypesList,
  allowMultipleSelection
) {
  if (defaultPath !== undefined && !fs.existsSync(defaultPath)) {
    defaultPath = undefined;
  }

  let properties;
  if (allowMultipleSelection) {
    properties = ["openFile", "multiSelections"];
  } else {
    properties = ["openFile"];
  }

  let filePaths = dialog.showOpenDialogSync(window, {
    defaultPath: defaultPath,
    filters: [
      {
        name: allowedFileTypesName,
        extensions: allowedFileTypesList,
      },
    ],
    properties: properties,
  });
  return filePaths;
}
exports.chooseOpenFiles = chooseOpenFiles;

function chooseFolder(window, defaultPath) {
  if (!fs.existsSync(defaultPath)) {
    defaultPath = undefined;
  }

  let folderPath = dialog.showOpenDialogSync(window, {
    defaultPath: defaultPath,
    properties: ["openDirectory"],
  });
  return folderPath;
}
exports.chooseFolder = chooseFolder;

function chooseSaveAs(
  window,
  defaultPath,
  allowedFileTypesName,
  allowedFileTypesList
) {
  if (!fs.existsSync(path.dirname(defaultPath))) {
    defaultPath = undefined;
  }

  let filePath = dialog.showSaveDialogSync(window, {
    // title = ""
    defaultPath: defaultPath,
    properties: ["showOverwriteConfirmation"],
    filters: [
      {
        name: allowedFileTypesName,
        extensions: allowedFileTypesList,
      },
    ],
  });
  return filePath;
}
exports.chooseSaveAs = chooseSaveAs;

///////////////////////////////////////////////////////////////////////////////
// USER DATA //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function cleanUpUserDataFolder() {
  // some things are not entirely deleted, but it's good enough :)
  console.log("cleaning up...");
  let keepFiles = [
    "acbr.cfg",
    "acbr.hst",
    "acbr-player.cfg",
    "acbr-player.m3u",
  ];
  let userDataPath = app.getPath("userData");
  if (fs.existsSync(userDataPath)) {
    let files = fs.readdirSync(userDataPath);
    files.forEach((file) => {
      if (!keepFiles.includes(file)) {
        const entryPath = path.join(userDataPath, file);
        if (fs.lstatSync(entryPath).isDirectory()) {
          fileUtils.deleteFolderRecursive(entryPath, false, userDataPath);
        } else {
          fs.unlinkSync(entryPath); // delete the file
        }
      }
    });
  }
}
exports.cleanUpUserDataFolder = cleanUpUserDataFolder;
