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
      if (loadedHistory.recent && Array.isArray(loadedHistory.recent)) {
        for (let index = 0; index < loadedHistory.recent.length; index++) {
          const entry = loadedHistory.recent[index];
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
            g_recent.push(entry);
          }
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

function removeRecentIndex(index) {
  g_recent.splice(index, 1);
}

function changeRecentCapacity(capacity) {
  if (!capacity) return;
  g_recentCapacity = capacity;
  if (g_recent.length > g_recentCapacity) {
    g_recent.splice(0, g_recent.length - capacity);
  }
}

function addRecent(filePath, pageIndex, numPages, data) {
  let foundIndex = getRecentFilePathIndex(filePath);
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
}

function getRecentFilePathIndex(filePath) {
  if (!filePath) return undefined;
  let foundIndex;
  for (let index = 0; index < g_recent.length; index++) {
    const element = g_recent[index];
    if (element.filePath === filePath) {
      foundIndex = index;
      break;
    }
  }
  return foundIndex;
}

function getRecentDataIndex(data) {
  if (!data) return undefined;
  let foundIndex;
  for (let index = 0; index < g_recent.length; index++) {
    const element = g_recent[index];
    // NOTE: crappy comparision, error prone?
    if (!element.data) continue;
    if (JSON.stringify(element.data) === JSON.stringify(data)) {
      foundIndex = index;
      break;
    }
  }
  return foundIndex;
}

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
  getRecentFilePathIndex,
  getRecentDataIndex,
};
