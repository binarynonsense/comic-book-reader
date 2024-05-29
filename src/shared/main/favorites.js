/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const log = require("./logger");
const {
  isPortable,
  getUserDataFolderPath,
  getExeFolderPath,
  getAppVersion,
  getHomeFolderPath,
  getDesktopFolderPath,
  getDownloadsFolderPath,
} = require("./app-utils");

let g_favorites = {};

exports.get = function () {
  if (!g_favorites.data) g_favorites.data = [];
  return g_favorites.data;
};

exports.set = function (data) {
  g_favorites.version = getAppVersion();
  g_favorites.data = [...data];
};

exports.getIndex = function (index) {
  return g_favorites.data[index];
};

exports.removeIndex = function (index) {
  g_favorites.data.splice(index, 1);
};

exports.init = function () {
  load();
};

exports.save = function () {
  let favFilePath = path.join(getUserDataFolderPath(), "acbr.fav");
  if (fs.existsSync(path.join(getExeFolderPath(), "portable.txt"))) {
    favFilePath = path.join(getExeFolderPath(), "acbr.fav");
  }
  const favsJSON = JSON.stringify(g_favorites, null, 2);
  try {
    fs.writeFileSync(favFilePath, favsJSON, "utf-8");
  } catch (e) {
    log.error("ERROR saving favorites to: " + favFilePath);
    return;
  }
  log.info("favorites saved to: " + favFilePath);
};

function load() {
  g_favorites = {};
  g_favorites.version = getAppVersion();
  g_favorites.data = [];
  let favFilePath = path.join(getUserDataFolderPath(), "acbr.fav");
  if (isPortable()) {
    favFilePath = path.join(getExeFolderPath(), "acbr.fav");
  }
  if (fs.existsSync(favFilePath)) {
    let fileData;
    try {
      fileData = fs.readFileSync(favFilePath, "utf8");
    } catch (e) {
      return g_favorites;
    }
    if (fileData === null || fileData === undefined) return g_favorites;

    let loadedFavorites;
    try {
      loadedFavorites = JSON.parse(fileData);
    } catch (e) {
      return g_favorites;
    }

    const loadedFavoritesData = loadedFavorites.data;
    if (Array.isArray(loadedFavoritesData)) {
      for (let index = 0; index < loadedFavoritesData.length; index++) {
        const loadedEntry = loadedFavoritesData[index];
        if (loadedEntry.path && typeof loadedEntry.path === "string") {
          let entry = { path: loadedEntry.path };
          if (loadedEntry.name && typeof loadedEntry.name === "string") {
            entry.name = loadedEntry.name;
          }
          if (
            loadedEntry.localizedNameId &&
            typeof loadedEntry.localizedNameId === "string"
          ) {
            // default favorites like Home, Desktop... will have a
            // localizedNameId and it will be used to get a localized name
            // and replace the name key contents
            entry.localizedNameId = loadedEntry.localizedNameId;
            entry.name = undefined;
          }
          //typeof loadedEntry.localizeName !== 'undefined'
          // if (
          //   loadedEntry.localizeName &&
          //   typeof loadedEntry.localizeName === "boolean"
          // ) {
          //   entry.localizeName = loadedEntry.localizeName;
          // }
          g_favorites.data.push(entry);
        }
      }
    }
  } else {
    // initialize with defaults
    g_favorites.data.push({
      localizedNameId: "home",
      path: getHomeFolderPath(),
    });
    g_favorites.data.push({
      localizedNameId: "desktop",
      path: getDesktopFolderPath(),
    });
    g_favorites.data.push({
      localizedNameId: "downloads",
      path: getDownloadsFolderPath(),
    });
  }
}
exports.load = load;
