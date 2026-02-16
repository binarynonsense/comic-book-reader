/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app, dialog, nativeTheme } = require("electron");
const shell = require("electron").shell;
const path = require("node:path");
const fs = require("node:fs");
const fileUtils = require("./file-utils");
const log = require("./logger");

///////////////////////////////////////////////////////////////////////////////
// MISC ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.getAppVersion = function () {
  return app.getVersion();
};

exports.openURLInBrowser = function (urlString) {
  // TODO: the TLD check could be done earlier and probably better
  let url;
  try {
    url = new URL(urlString);
    log.editor(url.href);
    log.editor(url.protocol);
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (!urlString.includes(".")) throw "no tld"; // require TLD
      log.debug(`Opening in browser: ${urlString}`);
      shell.openExternal(urlString);
    } else {
      log.warning("Tried to open an invalid URL: " + urlString);
      return;
    }
  } catch (error) {
    log.editor("Invalid URL, adding http://");
    // try adding http://, for example for: "binarynonsense.com"
    try {
      urlString = "http://" + urlString;
      url = new URL(urlString);
      log.editor(url.href);
      log.editor(url.protocol);
      if (url.protocol === "http:" || url.protocol === "https:") {
        if (!urlString.includes(".")) throw "no tld"; // require TLD
        log.debug(`Opening in browser: ${urlString}`);
        shell.openExternal(urlString);
      } else {
        throw "invalid TLD";
      }
    } catch (error) {
      log.warning("Tried to open an invalid URL: " + urlString);
      return;
    }
  }
};

exports.openPathInFileBrowser = function (inputPath) {
  if (!fs.existsSync(inputPath)) return;
  if (fs.lstatSync(inputPath).isDirectory()) {
    shell.openPath(inputPath);
  } else {
    shell.showItemInFolder(inputPath);
  }
};

///////////////////////////////////////////////////////////////////////////////
// THEMES /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.getShouldUseDarkColors = function () {
  return nativeTheme.shouldUseDarkColors;
};

exports.setNativeThemeUpdateEventHandler = function (handler) {
  nativeTheme.on("updated", () => {
    log.debug(
      "native theme updated: " + nativeTheme.shouldUseDarkColors
        ? "dark"
        : "light",
    );
    handler();
  });
};

///////////////////////////////////////////////////////////////////////////////
// PATHS //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getDesktopFolderPath() {
  return app.getPath("desktop");
}
exports.getDesktopFolderPath = getDesktopFolderPath;

function getHomeFolderPath() {
  return app.getPath("home");
}
exports.getHomeFolderPath = getHomeFolderPath;

function getDownloadsFolderPath() {
  return app.getPath("downloads");
}
exports.getDownloadsFolderPath = getDownloadsFolderPath;

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

function getConfigFolder() {
  if (isPortable()) {
    try {
      fs.accessSync(getExeFolderPath(), fs.constants.W_OK);
      return getExeFolderPath();
    } catch (err) {
      log.info("Warning: portable settings' folder not writable");
    }
  }
  return getUserDataFolderPath();
}
exports.getConfigFolder = getConfigFolder;

function getExternalFilesFolder() {
  const configFolder = getConfigFolder();
  return path.join(configFolder, "/acbr-user-extensions");
}
exports.getExternalFilesFolder = getExternalFilesFolder;

function generateExternalFilesFolder() {
  try {
    const baseFolder = getExternalFilesFolder();
    if (!baseFolder) return;
    const themesFolder = path.join(baseFolder, "/themes");
    if (!fs.existsSync(themesFolder)) {
      log.editor("creating external themes folder: " + themesFolder);
      fs.mkdirSync(themesFolder, { recursive: true });
    }
    const localesFolder = path.join(baseFolder, "/locales");
    if (!fs.existsSync(localesFolder)) {
      log.editor("creating external locales folder: " + localesFolder);
      fs.mkdirSync(localesFolder, { recursive: true });
    }
    const readmePath = path.join(baseFolder, "/README.txt");
    if (!fs.existsSync(readmePath)) {
      const content =
        "Drop your files in the corresponding folder: localization files in /locales, color themes in /themes...";
      log.editor("creating README: " + readmePath);
      fs.writeFileSync(readmePath, content, "utf8");
    }
  } catch (error) {
    log.error(error);
  }
}
exports.generateExternalFilesFolder = generateExternalFilesFolder;

///////////////////////////////////////////////////////////////////////////////
// FILE DIALOGUES /////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function chooseFiles(
  window,
  defaultPath,
  allowedFileTypesName,
  allowedFileTypesList,
  allowMultipleSelection,
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
      {
        name: "",
        extensions: ["*"],
      },
    ],
    properties: properties,
  });
  return filePaths;
}
exports.chooseFiles = chooseFiles;

function chooseFolder(window, defaultPath, allowMultipleSelection) {
  if (!fs.existsSync(defaultPath)) {
    defaultPath = undefined;
  }

  let properties;
  if (allowMultipleSelection) {
    properties = ["openDirectory", "multiSelections"];
  } else {
    properties = ["openDirectory"];
  }

  let folderPath = dialog.showOpenDialogSync(window, {
    defaultPath: defaultPath,
    properties: properties,
  });
  return folderPath;
}
exports.chooseFolder = chooseFolder;

function chooseSaveAs(
  window,
  defaultPath,
  allowedFileTypesName,
  allowedFileTypesList,
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

exports.getConfigFiles = function () {
  let data = [];
  let cfgFolderPath = getConfigFolder();
  data.push(getFileData("acbr.cfg", cfgFolderPath));
  data.push(getFileData("acbr.hst", cfgFolderPath));
  data.push(getFileData("acbr.fav", cfgFolderPath));
  data.push(getFileData("acbr-player.cfg", cfgFolderPath));
  data.push(getFileData("acbr-player.m3u", cfgFolderPath));
  return data;
};

exports.getLogFile = function () {
  let data = [];
  let cfgFolderPath = getConfigFolder();
  data.push(getFileData("acbr.log", cfgFolderPath));
  data.push(getFileData("acbr-prev.log", cfgFolderPath));
  return data;
};

function getFileData(fileName, folderPath) {
  const name = fileName;
  const filePath = path.join(folderPath, fileName);
  const exists = fs.existsSync(filePath);
  return { name, path: filePath, exists };
}

function cleanUpUserDataFolder() {
  // some things are not entirely deleted, but it's good enough :)
  try {
    log.debug("cleaning up user data folder");
    log.debug(
      "the clean up process may fail to delete some files or folders depending on the OS and other circumstances, this is normal and expected",
    );
    let keepFiles = [
      "acbr.cfg",
      "acbr.hst",
      "acbr.fav",
      "acbr-player.cfg",
      "acbr-player.m3u",
      "acbr-cache",
      "acbr-user-extensions",
      "acbr.log",
      "acbr-prev.log",
      //
      "acbr-fork-debug.log",
    ];
    let userDataPath = app.getPath("userData");
    if (
      fs.existsSync(userDataPath) &&
      path.basename(userDataPath).startsWith("acbr-comic-book-reader")
    ) {
      log.debug("user data path is valid");
      let files = fs.readdirSync(userDataPath);
      files.forEach((file) => {
        if (!keepFiles.includes(file)) {
          const entryPath = path.join(userDataPath, file);
          if (fs.lstatSync(entryPath).isDirectory()) {
            fileUtils.deleteFolderRecursive(entryPath, false, userDataPath);
          } else {
            try {
              fs.unlinkSync(entryPath); // delete the file
            } catch (error) {
              // just skip it
              log.debug("couldn't delete file: " + entryPath);
            }
          }
        }
      });
    }
  } catch (error) {}
}
exports.cleanUpUserDataFolder = cleanUpUserDataFolder;
