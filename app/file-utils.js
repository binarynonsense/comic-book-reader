const { app, dialog } = require("electron");

const path = require("path");
const os = require("os");
const fs = require("fs");
const fileFormats = require("./file-formats");

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

///////////////////////////////////////////////////////////////////////////////
// SAVE / LOAD ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.saveSettings = function (settings) {
  const cfgFilePath = path.join(app.getPath("userData"), "acbr.cfg");
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
  const cfgFilePath = path.join(app.getPath("userData"), "acbr.cfg");
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
  const hstFilePath = path.join(app.getPath("userData"), "acbr.hst");
  const historyJSON = JSON.stringify(history);
  try {
    fs.writeFileSync(hstFilePath, historyJSON, "utf-8");
  } catch (e) {
    console.log("ERROR saving history to: " + hstFilePath);
    return;
  }
  console.log("history saved to: " + hstFilePath);
};

exports.loadHistory = function () {
  let history = [];
  const hstFilePath = path.join(app.getPath("userData"), "acbr.hst");
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
        if (entry.filePath !== undefined && entry.filePath !== "") {
          if (isNaN(entry.pageIndex)) entry.pageIndex = 0;
          history.push(entry);
        }
      }
    }
  }
  // limit how many are remembered
  if (history.length > 10) {
    history.splice(0, history.length - 10);
  }
  return history;
};

///////////////////////////////////////////////////////////////////////////////
// FILE DIALOGUES /////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function chooseOpenFile(window, defaultPath) {
  if (!fs.existsSync(defaultPath)) {
    defaultPath = undefined;
  }

  let filePath = dialog.showOpenDialogSync(window, {
    defaultPath: defaultPath,
    filters: [
      {
        name: "Comic Book Files",
        extensions: ["cbz", "cbr", "pdf", "epub"],
      },
    ],
    properties: ["openFile"],
  });
  return filePath;
}
exports.chooseOpenFile = chooseOpenFile;

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

function chooseSaveFile(window, defaultPath) {
  let filePath = dialog.showSaveDialogSync(window, {
    defaultPath: defaultPath,
    filters: [
      {
        name: "Images",
        extensions: ["jpg"],
      },
    ],
    properties: ["showOverwriteConfirmation"],
  });
  return filePath;
}
exports.chooseSaveFile = chooseSaveFile;

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

// function getImageFilesInFolder(folderPath) {
//   if (fs.existsSync(folderPath)) {
//     let filesInFolder = fs.readdirSync(folderPath);
//     if (filesInFolder.length === 0) {
//       console.log("no files found in dir");
//       return [];
//     } else {
//       return filesInFolder.filter(fileFormats.hasImageExtension);
//     }
//   } else {
//     console.log("folder doesn't exist");
//     return [];
//   }
// }
//exports.getImageFilesInFolder = getImageFilesInFolder;

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
