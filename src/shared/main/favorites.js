/**
 * @license
 * Copyright 2024-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const log = require("./logger");
const {
  getConfigFolder,
  getAppVersion,
  getHomeFolderPath,
  getDesktopFolderPath,
  getDownloadsFolderPath,
} = require("./app-utils");

let g_favorites = {};

exports.getValue = function (name) {
  return g_favorites[name];
};

exports.setValue = function (name, value) {
  g_favorites[name] = value;
};

exports.getData = function () {
  if (!g_favorites.data) g_favorites.data = [];
  return g_favorites.data;
};

exports.setData = function (data) {
  g_favorites.version = getAppVersion();
  g_favorites.data = [...data];
};

exports.getLists = function () {
  if (!g_favorites.lists) g_favorites.lists = [];
  return g_favorites.lists;
};

exports.setLists = function (lists) {
  g_favorites.version = getAppVersion();
  g_favorites.lists = [...lists];
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
  let favFilePath = path.join(getConfigFolder(), "acbr.fav");
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
  log.debug("loading favorites");
  g_favorites = {};
  g_favorites.version = getAppVersion();
  g_favorites.data = [];
  try {
    let favFilePath = path.join(getConfigFolder(), "acbr.fav");
    if (fs.existsSync(favFilePath)) {
      let fileData;
      try {
        fileData = fs.readFileSync(favFilePath, "utf8");
      } catch (error) {
        throw "invalid favorites file";
      }
      if (fileData === null || fileData === undefined) {
        throw "invalid favorites file content";
      }
      // favorites
      let loadedFavorites;
      try {
        loadedFavorites = JSON.parse(fileData);
      } catch (error) {
        throw "invalid favorites JSON";
      }
      if (loadedFavorites.version && Array.isArray(loadedFavorites.data)) {
        g_favorites.data = sanitizeData(loadedFavorites.data);
        if (g_favorites.data.length <= 0) throw "invalid favorites format";
      }
      // lists
      g_favorites.lists = sanitizeLists(loadedFavorites.lists);
      // collapse
      if (
        loadedFavorites.collapseFavorites &&
        typeof loadedFavorites.collapseFavorites === "boolean"
      ) {
        g_favorites.collapseFavorites = loadedFavorites.collapseFavorites;
      } else {
        g_favorites.collapseFavorites = false;
      }
      if (
        loadedFavorites.collapseLatest &&
        typeof loadedFavorites.collapseLatest === "boolean"
      ) {
        g_favorites.collapseLatest = loadedFavorites.collapseLatest;
      } else {
        g_favorites.collapseLatest = false;
      }
    } else {
      throw "favorites file not found";
    }
  } catch (error) {
    log.debug(error);
    g_favorites.data = getDefaultFavorites();
  }
}
exports.load = load;

function getDefaultFavorites() {
  const data = [];
  const homeFolderPath = getHomeFolderPath();
  const desktopFolderPath = getDesktopFolderPath();
  const downloadsFolderPath = getDownloadsFolderPath();
  if (homeFolderPath) {
    data.push({
      localizedNameId: "home",
      path: homeFolderPath,
    });
    if (desktopFolderPath && desktopFolderPath != homeFolderPath)
      data.push({
        localizedNameId: "desktop",
        path: desktopFolderPath,
      });
    if (downloadsFolderPath && downloadsFolderPath != homeFolderPath)
      data.push({
        localizedNameId: "downloads",
        path: downloadsFolderPath,
      });
  }
  return data;
}

function sanitizeData(data) {
  let sanitizedData = [];
  for (let index = 0; index < data.length; index++) {
    try {
      const loadedEntry = data[index];
      let entry = {};
      if (loadedEntry.path && typeof loadedEntry.path === "string") {
        entry.path = loadedEntry.path;
      }
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
      if (loadedEntry.data && typeof loadedEntry.data === "object") {
        entry.data = loadedEntry.data;
      }
      if (Object.keys(entry).length !== 0) sanitizedData.push(entry);
    } catch (error) {
      log.error(error);
    }
  }
  return sanitizedData;
}

function sanitizeLists(lists) {
  let sanitizedLists = [];
  if (lists && Array.isArray(lists)) {
    for (let listIndex = 0; listIndex < lists.length; listIndex++) {
      const list = lists[listIndex];
      if (typeof list === "object") {
        let sanitizedList = {};
        // name
        if (typeof list.name && typeof list.name === "string")
          sanitizedList.name = list.name;
        else sanitizedList.name = sanitizedList.name = "???";
        // collapsed
        if (typeof list.collapsed === "boolean")
          sanitizedList.collapsed = list.collapsed;
        else sanitizedList.collapsed = false;
        // data
        sanitizedList.data = sanitizeData(list.data);
        // add
        sanitizedLists.push(sanitizedList);
      }
    }
  }
  return sanitizedLists;
}
