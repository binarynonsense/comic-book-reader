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
const favorites = require("../../shared/main/favorites");
const reader = require("../../reader/main");
const log = require("../../shared/main/logger");
const appUtils = require("../../shared/main/app-utils");
const { FileExtension } = require("../../shared/main/constants");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_favorites;

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
    favorites.init();
    sendFavoritesUpdate();
  }
}

exports.open = function (showFocus) {
  init();
  // TODO: use showFocus?
  sendLatestUpdate();
};

exports.close = function () {
  saveFavorites();
};

//////////////////////////////////////////////////////////////////////////////
// TOOL //////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function sendLatestUpdate() {
  const historyData = history.get();
  const data = [];
  for (let index = 0; index < historyData.length; index++) {
    if (data.length < 8) {
      const latestInfo = {};
      const historyDataFile = historyData[historyData.length - index - 1];
      latestInfo.path = historyDataFile.filePath;
      latestInfo.name = path.basename(historyDataFile.filePath);
      if (!fs.existsSync(latestInfo.path)) {
        continue;
      }
      latestInfo.isFile = !fs.lstatSync(latestInfo.path).isDirectory();
      data.push(latestInfo);
    } else {
      break;
    }
  }
  sendIpcToRenderer("hs-update-latest", data);
}

function sendFavoritesUpdate() {
  if (!g_favorites) g_favorites = favorites.get();
  const data = [];
  for (let index = 0; index < g_favorites.length; index++) {
    const favoriteInfo = {};
    favoriteInfo.index = index;
    favoriteInfo.path = g_favorites[index].path;
    if (g_favorites[index].localizedNameId) {
      // used in the defaults
      switch (g_favorites[index].localizedNameId) {
        case "home":
          favoriteInfo.name = _("tool-fb-shortcuts-places-home");
          break;
        case "desktop":
          favoriteInfo.name = _("tool-fb-shortcuts-places-desktop");
          break;
        case "downloads":
          favoriteInfo.name = _("tool-fb-shortcuts-places-downloads");
          break;
      }
    } else {
      favoriteInfo.name = g_favorites[index].name;
    }
    favoriteInfo.isFile = !fs.lstatSync(favoriteInfo.path).isDirectory();
    data.push(favoriteInfo);
  }
  sendIpcToRenderer("hs-update-favorites", data);
}

function saveFavorites() {
  favorites.set(g_favorites);
  favorites.save();
}

function addFavorite(favPath) {
  // TODO: check if exists?
  g_favorites.push({ path: favPath, name: path.basename(favPath) });
  sendFavoritesUpdate();
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
    addFavorite(folderPath);
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
    addFavorite(filePath);
  });

  on("hs-on-favorite-options-clicked", (index, path) => {
    // TODO: maybe check index and path match?
    sendIpcToRenderer(
      "hs-show-modal-favorite-options",
      index,
      path,
      _("tool-shared-tab-options"),
      _("tool-shared-ui-back"),
      _("tool-shared-tooltip-remove-from-list")
    );
  });

  on("hs-on-modal-favorite-options-remove-clicked", (favIndex, favPath) => {
    if (g_favorites[favIndex].path === favPath) {
      g_favorites.splice(favIndex, 1);
      sendFavoritesUpdate();
    } else {
      log.error("Tried to remove a favorite with not matching index and path");
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendFavoritesUpdate();
  sendIpcToRenderer("hs-update-localization", getIdsLocalization());
}
exports.updateLocalizedText = updateLocalizedText;

function getIdsLocalization() {
  return [
    {
      id: "hs-openfile-button-text",
      text: _("ctxmenu-openfile").replace("...", "").toUpperCase(),
    },
    {
      id: "hs-favorites-title",
      text: _("home-screen-favorites").toUpperCase(),
    },
    {
      id: "hs-latest-title",
      text: _("home-screen-latest").toUpperCase(),
    },
  ];
}
