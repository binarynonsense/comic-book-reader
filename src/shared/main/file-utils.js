/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app, dialog } = require("electron");

const path = require("path");
const os = require("os");
const fs = require("fs");
const fileFormats = require("./file-formats");

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

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.reducePathString = function (input, max = 60) {
  var length = max;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
};

exports.reducePathStringMiddle = function (text, length) {
  if (text.length <= length) return text;
  const separator = "...";
  const finalLength = length - separator.length;
  const frontLength = Math.ceil(finalLength / 2);
  const backLength = Math.floor(finalLength / 2);
  return (
    text.substr(0, frontLength) +
    separator +
    text.substr(text.length - backLength)
  );
};

exports.compare = function (a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

exports.parsePdfDate = function (date) {
  // examples
  // D:20230806093904Z
  // D:20180529112151-05'00'
  // TODO: HACK: investigate how to do this properly, now the time zone
  // is incorrect/being ignored
  if (date.startsWith("D:")) date = date.replace("D:", "");
  // if (!/^[0-9]{8}T[0-9]{6}Z$/.test(date))
  //   throw new Error("incorrect date format: " + date);
  var year = date.substr(0, 4);
  var month = date.substr(4, 2);
  var day = date.substr(6, 2);
  var hour = date.substr(8, 2);
  var minute = date.substr(10, 2);
  var second = date.substr(12, 2);
  // UTC months start in 0
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

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
// GET IMAGES /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const getImageFilesInFolderRecursive = function (folderPath) {
  let filesArray = [];
  let dirs = [];

  if (fs.existsSync(folderPath)) {
    let nodes = fs.readdirSync(folderPath);
    nodes.forEach((node) => {
      const nodePath = path.join(folderPath, node);
      if (fs.lstatSync(nodePath).isDirectory()) {
        dirs.push(nodePath); // check later so this folder's imgs come first
      } else {
        if (fileFormats.hasImageExtension(nodePath)) {
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
      return filesInFolder.filter(fileFormats.hasImageExtension);
    }
  } else {
    return [];
  }
}
exports.getImageFilesInFolder = getImageFilesInFolder;

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
// TEMP FOLDER ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// TODO: MAYBE: keep tabs of multiple tempFolders?

let g_tempFolderPath = undefined;
let g_tempFolderParentPath = undefined;

function getTempFolderPath() {
  return g_tempFolderPath;
}
exports.getTempFolderPath = getTempFolderPath;

function getTempFolderParentPath() {
  return g_tempFolderParentPath;
}
exports.getTempFolderParentPath = getTempFolderParentPath;

function setTempFolderParentPath(folderPath) {
  g_tempFolderParentPath = folderPath;
}
exports.setTempFolderParentPath = setTempFolderParentPath;

function getSystemTempFolderPath() {
  return os.tmpdir();
}
exports.getSystemTempFolderPath = getSystemTempFolderPath;

function createTempFolder() {
  g_tempFolderPath = fs.mkdtempSync(path.join(g_tempFolderParentPath, "acbr-"));
  return g_tempFolderPath;
}
exports.createTempFolder = createTempFolder;

function cleanUpTempFolder() {
  if (g_tempFolderPath === undefined) return;
  deleteTempFolderRecursive(g_tempFolderPath);
  g_tempFolderPath = undefined;
}
exports.cleanUpTempFolder = cleanUpTempFolder;

const deleteTempFolderRecursive = function (folderPath, isRoot = true) {
  if (fs.existsSync(folderPath)) {
    const folderName = path.basename(folderPath);
    if (isRoot && !folderName.startsWith("acbr-")) {
      // safety check
      return;
    }
    let files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const entryPath = path.join(folderPath, file);
      if (fs.lstatSync(entryPath).isDirectory()) {
        deleteTempFolderRecursive(entryPath, false);
      } else {
        fs.unlinkSync(entryPath); // delete the file
      }
    });
    try {
      fs.rmdirSync(folderPath);
      console.log("deleted folder: " + folderPath);
    } catch (error) {
      if (error.code == "ENOTEMPTY") {
        // TODO: retry?
        // this can happen if the temp folder is the same as the one the
        // conversion is outputing to
      }
      console.log("Error: " + error.code);
      console.log("couldn't delete folder: " + folderPath);
    }
  }
};

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
          deleteUserDataFolderRecursive(entryPath);
        } else {
          fs.unlinkSync(entryPath); // delete the file
        }
      }
    });
  }
}
exports.cleanUpUserDataFolder = cleanUpUserDataFolder;

const deleteUserDataFolderRecursive = function (folderPath) {
  if (fs.existsSync(folderPath)) {
    if (!folderPath.startsWith(app.getPath("userData"))) {
      // safety check
      return;
    }
    let files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const entryPath = path.join(folderPath, file);
      if (fs.lstatSync(entryPath).isDirectory()) {
        deleteUserDataFolderRecursive(entryPath);
      } else {
        fs.unlinkSync(entryPath); // delete the file
      }
    });
    fs.rmdirSync(folderPath);
  }
};

///////////////////////////////////////////////////////////////////////////////
// ////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// TODO: create utils.js and move there?
exports.delay = async function (seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};
