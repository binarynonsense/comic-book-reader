/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const log = require("./logger");
const appUtils = require("./app-utils");
const utils = require("./utils");

const settings = require("./settings");
const { getConfigFolder } = require("./app-utils");

let g_recent = [];
let g_recentCapacity = 100;

let g_home = [];

///////////////////////////////////////////////////////////////////////////////
// HISTORY ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function init(capacity) {
  g_recentCapacity = capacity;
  load();
}

function save() {
  let history = {};
  history.version = appUtils.getAppVersion();
  history.recent = g_recent;
  history.home = g_home;
  let hstFilePath = path.join(getConfigFolder(), "acbr.hst");
  const historyJSON = JSON.stringify(history, null, 2);
  try {
    fs.writeFileSync(hstFilePath, historyJSON, "utf-8");
  } catch (e) {
    log.error("ERROR saving history to: " + hstFilePath);
    return;
  }
  log.info("history saved to: " + hstFilePath);
}

function load() {
  g_recent = [];
  g_home = [];
  let hstFilePath = path.join(getConfigFolder(), "acbr.hst");
  if (fs.existsSync(hstFilePath)) {
    let data;
    try {
      data = fs.readFileSync(hstFilePath, "utf8");
    } catch (e) {
      return;
    }
    if (data === null || data === undefined) return;

    let loadedHistory;
    try {
      loadedHistory = JSON.parse(data);
    } catch (e) {
      return;
    }

    // if old array version -> convert
    if (Array.isArray(loadedHistory)) {
      loadedHistory = { recent: loadedHistory };
    }

    if (utils.isObject(loadedHistory)) {
      function loadEntry(entry, toArray) {
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
          if (entry.pageMode !== undefined && isNaN(entry.pageMode)) {
            delete entry.pageMode;
          }
          if (entry.zoomScale !== undefined && isNaN(entry.zoomScale)) {
            delete entry.zoomScale;
          }
          // TODO: sanitize data bookType if available
          toArray.push(entry);
        }
      }
      // recent files
      if (loadedHistory.recent && Array.isArray(loadedHistory.recent)) {
        for (let index = 0; index < loadedHistory.recent.length; index++) {
          loadEntry(loadedHistory.recent[index], g_recent);
        }
      }
      // files from home not in recent
      if (loadedHistory.home && Array.isArray(loadedHistory.home)) {
        for (let index = 0; index < loadedHistory.home.length; index++) {
          loadEntry(loadedHistory.home[index], g_home);
        }
      }
    }
  }
  // limit how many are remembered
  if (g_recent.length > g_recentCapacity) {
    g_recent.splice(0, g_recent.length - capacity);
  }
}

function clear() {
  g_recent = [];
}

///////////////////////////////////////////////////////////////////////////////
// RECENT /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getRecent() {
  return structuredClone(g_recent);
}

function setRecent(recent) {
  g_recent = structuredClone(recent);
}

function getRecentIndex(index) {
  return structuredClone(g_recent[index]);
}

function getFilePathIndexInRecent(filePath) {
  return getFilePathIndexInList(filePath, 0);
}

function getDataIndexInRecent(data) {
  return getDataIndexInList(data, 0);
}

function changeRecentCapacity(capacity) {
  if (!capacity) return;
  g_recentCapacity = capacity;
  if (g_recent.length > g_recentCapacity) {
    g_recent.splice(0, g_recent.length - capacity);
  }
}

function addRecent(filePath, pageIndex, numPages, data) {
  let foundIndex = getFilePathIndexInRecent(filePath);
  if (foundIndex !== undefined) {
    // remove, to update and put last
    g_recent.splice(foundIndex, 1);
  }
  let newEntry = {
    filePath: filePath,
    pageIndex: pageIndex,
    numPages: numPages,
    fitMode: settings.getValue("fit_mode"),
    zoomScale: settings.getValue("zoom_scale"),
    pageMode: settings.getValue("page_mode"),
  };
  if (data) {
    newEntry.data = data;
    if (newEntry.data.tempData) delete newEntry.data.tempData;
  }
  g_recent.push(newEntry);
  if (g_recent.length > settings.getValue("history_capacity")) {
    g_recent.splice(0, g_recent.length - settings.getValue("history_capacity"));
  }
  //
  foundIndex = getFilePathIndexInHome(filePath);
  if (foundIndex !== undefined) {
    // remove from home, as it's now in recent
    g_home.splice(foundIndex, 1);
  }
}

function removeRecentIndex(index) {
  const entry = g_recent[index];
  // TODO: is it in a home list??
  if (true) {
    let foundIndex = undefined;
    if (entry.data && entry.data.source) {
      foundIndex = getDataIndexInHome(entry.data);
    } else {
      foundIndex = getFilePathIndexInHome(entry.filePath);
    }
    if (!foundIndex) {
      // not already in home
      g_home.push(entry);
    }
  }
  g_recent.splice(index, 1);
}

///////////////////////////////////////////////////////////////////////////////
// HOME ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getFilePathIndexInHome(filePath) {
  return getFilePathIndexInList(filePath, 1);
}

function getDataIndexInHome(data) {
  return getDataIndexInList(data, 1);
}

///////////////////////////////////////////////////////////////////////////////
// COMMON /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getDataIndexInList(data, listIndex) {
  if (!data || listIndex < 0 || listIndex > 1) return undefined;
  let foundIndex;
  const entries = listIndex === 0 ? g_recent : g_home;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    // NOTE: crappy comparision, error prone?
    if (!entry.data) continue;
    if (JSON.stringify(entry.data) === JSON.stringify(data)) {
      foundIndex = index;
      break;
    }
  }
  return foundIndex;
}

function getFilePathIndexInList(filePath, listIndex) {
  if (!filePath || listIndex < 0 || listIndex > 1) return undefined;
  let foundIndex;
  const entries = listIndex === 0 ? g_recent : g_home;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.filePath === filePath) {
      foundIndex = index;
      break;
    }
  }
  return foundIndex;
}

///////////////////////////////////////////////////////////////////////////////
// EXPORTS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

module.exports = {
  init,
  save,
  load,
  clear,
  getRecent,
  setRecent,
  getRecentIndex,
  removeRecentIndex,
  changeRecentCapacity,
  addRecent,
  getFilePathIndexInRecent,
  getDataIndexInRecent,
};
