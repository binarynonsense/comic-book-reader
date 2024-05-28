/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const history = require("../../shared/main/history");
const reader = require("../../reader/main");
const log = require("../../shared/main/logger");
const appUtils = require("../../shared/main/app-utils");
const { FileExtension } = require("../../shared/main/constants");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init() {
  if (!g_isInitialized) {
    g_isInitialized = true;
    initOnIpcCallbacks();
    const data = fs.readFileSync(path.join(__dirname, "index.html"));
    reader.sendIpcToCoreRenderer(
      "replace-inner-html",
      "#home-screen",
      data.toString()
    );
    sendIpcToRenderer("hs-init");
    sendFavoritesUpdate();
  }
}

exports.open = function (showFocus) {
  init();
  // TODO: use showFocus
  sendLatestUpdate();
};

exports.close = function () {};

//////////////////////////////////////////////////////////////////////////////
// TOOL //////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function sendLatestUpdate() {
  const historyData = history.get();
  const latest = [];
  for (let index = 0; index < historyData.length; index++) {
    if (latest.length < 8) {
      const latestInfo = {};
      const historyDataFile = historyData[historyData.length - index - 1];
      latestInfo.path = historyDataFile.filePath;
      latestInfo.name = path.basename(historyDataFile.filePath);
      if (!fs.existsSync(latestInfo.path)) {
        continue;
      }
      latestInfo.isFile = !fs.lstatSync(latestInfo.path).isDirectory();
      latest.push(latestInfo);
    } else {
      break;
    }
  }
  sendIpcToRenderer("hs-update-latest", latest);
}

function sendFavoritesUpdate() {
  const favorites = [];
  // TODO: load favorites from file
  if (false) {
    // TODO: if favorites file loaded from file successfully
  } else {
    // Couldn't load favorites, fill with default
    let folderPath = appUtils.getHomeFolderPath();
    if (fs.existsSync(folderPath)) {
      let favorite = {};
      favorite.name = _("tool-fb-shortcuts-places-home");
      favorite.path = folderPath;
      favorite.isFile = false;
      favorites.push(favorite);
    }

    folderPath = appUtils.getDesktopFolderPath();
    if (fs.existsSync(folderPath)) {
      let favorite = {};
      favorite.name = _("tool-fb-shortcuts-places-desktop");
      favorite.path = folderPath;
      favorite.isFile = false;
      favorites.push(favorite);
    }

    folderPath = appUtils.getDownloadsFolderPath();
    if (fs.existsSync(folderPath)) {
      let favorite = {};
      favorite.name = _("tool-fb-shortcuts-places-downloads");
      favorite.path = folderPath;
      favorite.isFile = false;
      favorites.push(favorite);
    }
  }
  sendIpcToRenderer("hs-update-favorites", favorites);
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  reader.sendIpcToRenderer(...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function on(id, callback) {
  reader.on(id, callback);
}

function initOnIpcCallbacks() {
  on("hs-open-dialog-file", (path) => {
    reader.onMenuOpenFile(path);
  });

  on("hs-open-file", (filePath) => {
    reader.tryOpen(filePath);
  });

  on("hs-on-add-favorite-clicked", () => {
    sendIpcToRenderer(
      "hs-show-modal-add-favorite",
      _("home-screen-favorites"),
      _("tool-shared-ui-back"),
      _("tool-shared-ui-add-file"),
      _("tool-shared-ui-add-folder")
    );
  });

  on("hs-on-modal-add-favorite-folder-clicked", () => {
    let folderList = appUtils.chooseFolder(core.getMainWindow());
    if (folderList === undefined || folderList.length <= 0) {
      return;
    }
    const folderPath = folderList[0];
    log.test(folderPath);
  });

  on("hs-on-modal-add-favorite-file-clicked", () => {
    let allowMultipleSelection = false;
    let allowedFileTypesName = _("dialog-file-types-comics");
    let allowedFileTypesList = [
      FileExtension.CBZ,
      FileExtension.CBR,
      FileExtension.CB7,
      FileExtension.PDF,
      FileExtension.EPUB,
    ];
    let filePathsList = appUtils.chooseFiles(
      core.getMainWindow(),
      undefined,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection
    );
    if (filePathsList === undefined || filePathsList.length <= 0) {
      return;
    }
    const filePath = filePathsList[0];
    log.test(filePath);
  });
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer("hs-update-localization", getIdsLocalization());
}
exports.updateLocalizedText = updateLocalizedText;

function getIdsLocalization() {
  return [
    {
      id: "home-screen-title-text",
      text: _("home-screen").toUpperCase(),
    },
  ];
}
