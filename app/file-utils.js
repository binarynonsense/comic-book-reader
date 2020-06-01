const path = require("path");
const os = require("os");
const fs = require("fs");

const AdmZip = require("adm-zip");
const unrar = require("node-unrar-js");

const { app, dialog } = require("electron");

///////////////////////////////////////////////////////////////////////////////
// SAVE / LOAD ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.saveSettings = function (settings) {
  const cfgFilePath = path.join(app.getPath("userData"), "acbr.cfg");
  //console.log(cfgFilePath);
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
        //console.log(key + ": " + loadedSettings[key]);
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
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getMimeType(filePath) {
  let mimeType = path.basename(filePath);
  return mimeType;
}
exports.getMimeType = getMimeType;

function hasImageExtension(filePath) {
  const allowedFileExtensions = [".jpg", ".jpeg", ".png"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
}

const deleteTempFolderRecursive = function (folderPath) {
  //console.log("deleteFolderRecursive: " + folderPath);
  if (fs.existsSync(folderPath)) {
    if (!folderPath.startsWith(os.tmpdir())) {
      // safety check
      return;
    }
    let files = fs.readdirSync(folderPath);
    //console.log(files.length);
    files.forEach((file) => {
      //console.log(file);
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

function chooseFile(window, defaultPath = "") {
  if (!fs.existsSync(defaultPath)) {
    defaultPath = "";
  }
  // TODO defaultPath doesn't seem to work, at least on linux, where I've made more tests..
  // but I'll leave the code anyway

  let imagePath = dialog.showOpenDialogSync(window, {
    filters: [
      {
        name: "Comic Book Files",
        extensions: ["cbz", "cbr", "pdf"],
        defaultPath: defaultPath,
      },
    ],
    properties: ["openFile"],
  });
  return imagePath;
}
exports.chooseFile = chooseFile;

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

// function getImageFilesInFolder(folderPath) {
//   if (fs.existsSync(folderPath)) {
//     let filesInFolder = fs.readdirSync(folderPath);
//     if (filesInFolder.length === 0) {
//       console.log("no files found in dir");
//       return [];
//     } else {
//       return filesInFolder.filter(hasImageExtension);
//     }
//   } else {
//     console.log("folder doesn't exist");
//     return [];
//   }
// }
//exports.getImageFilesInFolder = getImageFilesInFolder;

///////////////////////////////////////////////////////////////////////////////
// ZIP / RAR //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function extractRar(filePath) {
  cleanUpTempFolder();
  createTempFolder();
  console.log(tempFolder);

  //ref: https://github.com/YuJianrong/node-unrar.js
  let extractor = unrar.createExtractorFromFile(filePath, tempFolder);
  extractor.extractAll();

  console.log("rar file extracted");
  return tempFolder;
}
exports.extractRar = extractRar;

function getRarEntriesList(filePath) {
  var buf = Uint8Array.from(fs.readFileSync(filePath)).buffer;
  var extractor = unrar.createExtractorFromData(buf);
  var rarEntries = extractor.getFileList();
  let imgEntries = [];
  if (rarEntries[0].state === "SUCCESS") {
    rarEntries[1].fileHeaders.forEach(function (rarEntry) {
      if (!rarEntry.flags.directory) {
        if (hasImageExtension(rarEntry.name)) {
          imgEntries.push(rarEntry.name);
        }
      }
    });
  }
  // imgEntries.forEach(function (entryName) {
  //   console.log(entryName);
  // });
  return imgEntries;
}
exports.getRarEntriesList = getRarEntriesList;

function extractRarEntryData(rarPath, entryName) {
  var buf = Uint8Array.from(fs.readFileSync(rarPath)).buffer;
  var extractor = unrar.createExtractorFromData(buf);
  var extracted = extractor.extractFiles([entryName]);
  if (extracted[0].state === "SUCCESS") {
    if (extracted[1].files[0].extract[0].state === "SUCCESS") {
      // ref: https://stackoverflow.com/questions/54305759/how-to-encode-a-buffer-to-base64-in-nodejs
      return Buffer.from(extracted[1].files[0].extract[1]);
    }
  }
  return;
}
exports.extractRarEntryData = extractRarEntryData;

function getZipEntriesList(filePath) {
  let zip = new AdmZip(filePath);
  let zipEntries = zip.getEntries();
  let imgEntries = [];
  zipEntries.forEach(function (zipEntry) {
    if (!zipEntry.isDirectory) {
      if (hasImageExtension(zipEntry.entryName)) {
        imgEntries.push(zipEntry.entryName);
      }
    }
  });
  return imgEntries;
}
exports.getZipEntriesList = getZipEntriesList;

function extractZipEntryData(zipPath, entryName) {
  let zip = new AdmZip(zipPath);
  return zip.readFile(entryName);
}
exports.extractZipEntryData = extractZipEntryData;

function extractZip(filePath) {
  cleanUpTempFolder();
  createTempFolder();
  console.log(tempFolder);

  // ref: https://github.com/cthackers/adm-zip/wiki/ADM-ZIP-Introduction
  let zip = new AdmZip(filePath);
  const imageData = zip.readFile("");
  zip.extractAllTo(tempFolder, true);
  console.log("zip file extracted");
  return tempFolder;
}
exports.extractZip = extractZip;

///////////////////////////////////////////////////////////////////////////////
// TEMP FOLDER ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let tempFolder; // = os.tmpdir();

function getTempFolder() {
  return tempFolder;
}
exports.getTempFolder = getTempFolder;

function createTempFolder() {
  tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "comic-book-reader-"));
  console.log("temp folder created: " + tempFolder);
}
exports.createTempFolder = createTempFolder;

function cleanUpTempFolder() {
  if (tempFolder === undefined) return;
  // console.log("cleaning folder: " + tempFolder);
  const files = fs.readdirSync(tempFolder);
  deleteTempFolderRecursive(tempFolder);
}
exports.cleanUpTempFolder = cleanUpTempFolder;
