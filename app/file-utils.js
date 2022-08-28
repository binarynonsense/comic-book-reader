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

function separateVersionText(version) {
  try {
    const regex =
      /^(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)(-beta(?<beta>[0-9]+))*$/;
    let match = version.match(regex);
    if (match === null) return undefined;
    return match.groups;
  } catch (error) {
    console.log("match error");
  }
}
exports.separateVersionText = separateVersionText;

exports.isVersionOlder = function (testVersion, referenceVersion) {
  const test = separateVersionText(testVersion);
  const reference = separateVersionText(referenceVersion);
  if (test === undefined || reference === undefined) return true;
  if (test.major < reference.major) return true;
  if (test.minor < reference.minor) return true;
  if (test.patch < reference.patch) return true;
  if (test.beta !== undefined) {
    if (reference.beta === undefined) return true;
    if (test.beta < reference.beta) return true;
  }
  return false;
};

exports.compare = function (a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

// keep just in case, but I'm not longer using it
exports.naturalCompare = function (a, b) {
  const naturalCompare = require("natural-compare-lite");
  return naturalCompare(a, b);
};

///////////////////////////////////////////////////////////////////////////////
// SAVE / LOAD ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getUserDataFolderPath() {
  return app.getPath("userData");
}
exports.getUserDataFolderPath = getUserDataFolderPath;

function getExeFolderPath() {
  // app.getAppPath();
  // process.cwd();
  // process.execPath;

  // process.cwd() seemed to work as I wanted on win and linux until I used
  // shortcuts to launch the builds. It is fine in windows (always returns
  // the exe's directory path) but not linux. And for appimage builds
  // app.getAppPath() returns the temp directory it was extracted to, not the exe's
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

exports.saveSettings = function (settings) {
  let cfgFilePath = path.join(getUserDataFolderPath(), "acbr.cfg");
  if (isPortable()) {
    cfgFilePath = path.join(getExeFolderPath(), "acbr.cfg");
    try {
      fs.accessSync(getExeFolderPath(), fs.constants.W_OK);
    } catch (err) {
      console.log("Warning: portable settings' folder not writable");
    }
  }
  let date = new Date().toJSON();
  settings.date = date;
  settings.version = app.getVersion();
  const settingsJSON = JSON.stringify(settings);
  try {
    fs.writeFileSync(cfgFilePath, settingsJSON, "utf-8");
  } catch (e) {
    console.log("ERROR saving settings to: " + cfgFilePath);
    return;
  }
  console.log("settings saved to: " + cfgFilePath);
};

exports.loadSettings = function (settings) {
  let cfgFilePath = path.join(getUserDataFolderPath(), "acbr.cfg");
  if (isPortable()) {
    cfgFilePath = path.join(getExeFolderPath(), "acbr.cfg");
  }
  if (fs.existsSync(cfgFilePath)) {
    let data;
    try {
      data = fs.readFileSync(cfgFilePath, "utf8");
    } catch (e) {
      return settings;
    }
    if (data === null || data === undefined) return settings;

    let loadedSettings;
    try {
      loadedSettings = JSON.parse(data);
    } catch (e) {
      return settings;
    }

    for (key in settings) {
      // ref: https://stackoverflow.com/questions/1098040/checking-if-a-key-exists-in-a-javascript-object
      if (loadedSettings[key] !== undefined) {
        // good if I don't allow undefines in the savefile
        settings[key] = loadedSettings[key];
      }
    }
  }
  return settings;
};

exports.saveHistory = function (history) {
  let hstFilePath = path.join(getUserDataFolderPath(), "acbr.hst");
  if (fs.existsSync(path.join(getExeFolderPath(), "portable.txt"))) {
    hstFilePath = path.join(getExeFolderPath(), "acbr.hst");
  }
  const historyJSON = JSON.stringify(history);
  try {
    fs.writeFileSync(hstFilePath, historyJSON, "utf-8");
  } catch (e) {
    console.log("ERROR saving history to: " + hstFilePath);
    return;
  }
  console.log("history saved to: " + hstFilePath);
};

exports.loadHistory = function (capacity) {
  let history = [];
  let hstFilePath = path.join(getUserDataFolderPath(), "acbr.hst");
  if (isPortable()) {
    hstFilePath = path.join(getExeFolderPath(), "acbr.hst");
  }
  if (fs.existsSync(hstFilePath)) {
    let data;
    try {
      data = fs.readFileSync(hstFilePath, "utf8");
    } catch (e) {
      return history;
    }
    if (data === null || data === undefined) return history;

    let loadedHistory;
    try {
      loadedHistory = JSON.parse(data);
    } catch (e) {
      return history;
    }

    if (Array.isArray(loadedHistory)) {
      for (let index = 0; index < loadedHistory.length; index++) {
        const entry = loadedHistory[index];
        if (
          entry.filePath !== undefined &&
          entry.filePath !== "" &&
          typeof entry.filePath === "string"
        ) {
          if (isNaN(entry.pageIndex)) entry.pageIndex = 0;
          entry.pageIndex = Number(entry.pageIndex);
          if (entry.fitMode !== undefined && isNaN(entry.fitMode)) {
            delete entry.fitMode;
          }
          if (entry.zoomScale !== undefined && isNaN(entry.zoomScale)) {
            delete entry.zoomScale;
          }
          // TODO: sanitize data bookType if available
          history.push(entry);
        }
      }
    }
  }
  // limit how many are remembered
  if (history.length > capacity) {
    history.splice(0, history.length - capacity);
  }
  return history;
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
// TEMP FOLDER ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// TODO maybe? ref: https://stackabuse.com/using-global-variables-in-node-js/
// or move this to main and keep tabs of multiple tempFolders?

g_tempFolderPath = undefined;

function getTempFolderPath() {
  return g_tempFolderPath;
}
exports.getTempFolderPath = getTempFolderPath;

function createTempFolder() {
  g_tempFolderPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "comic-book-reader-")
  );
  console.log("temp folder created: " + g_tempFolderPath);
  return g_tempFolderPath;
}
exports.createTempFolder = createTempFolder;

function cleanUpTempFolder() {
  if (g_tempFolderPath === undefined) return;
  deleteTempFolderRecursive(g_tempFolderPath);
  g_tempFolderPath = undefined;
}
exports.cleanUpTempFolder = cleanUpTempFolder;

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
    console.log("deletedfolder: " + folderPath);
  }
};
