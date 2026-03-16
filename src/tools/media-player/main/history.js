/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// based on history.js from the reader's code

const fs = require("node:fs");
const path = require("node:path");

const utils = require("../../../shared/main/utils");
const appUtils = require("../../../shared/main/app-utils");
const log = require("../../../shared/main/logger");

let g_recent = [];
let g_recentCapacity = 50;

///////////////////////////////////////////////////////////////////////////////
// HISTORY ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.init = function () {
  load();
};

exports.save = function () {
  let history = {};
  history.version = appUtils.getAppVersion();
  history.recent = g_recent;
  let hstFilePath = path.join(appUtils.getConfigFolder(), "acbr-player.hst");
  const historyJSON = JSON.stringify(history, null, 2);
  try {
    fs.writeFileSync(hstFilePath, historyJSON, "utf-8");
  } catch (e) {
    log.error("ERROR saving history to: " + hstFilePath);
    return;
  }
  log.info("history saved to: " + hstFilePath);
};

function load() {
  g_recent = [];
  let hstFilePath = path.join(appUtils.getConfigFolder(), "acbr-player.hst");
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

    if (utils.isObject(loadedHistory)) {
      function loadEntry(entry, toArray) {
        if (
          entry.filePath !== undefined &&
          entry.filePath !== "" &&
          typeof entry.filePath === "string"
        ) {
          toArray.push(entry);
        }
      }
      // recent files
      if (loadedHistory.recent && Array.isArray(loadedHistory.recent)) {
        for (let index = 0; index < loadedHistory.recent.length; index++) {
          loadEntry(loadedHistory.recent[index], g_recent);
        }
      }
    }
  }
  // limit how many are remembered
  if (g_recent.length > g_recentCapacity) {
    g_recent.splice(0, g_recent.length - g_recentCapacity);
  }
}

exports.clear = function () {
  g_recent = [];
};

///////////////////////////////////////////////////////////////////////////////
// RECENT /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.getRecent = function () {
  return structuredClone(g_recent);
};

exports.setRecent = function (recent) {
  g_recent = structuredClone(recent);
};

exports.getRecentLength = function () {
  return g_recent.length;
};

exports.getEntryInRecentByIndex = function (index) {
  return structuredClone(g_recent[index]);
};

exports.addEntryToRecent = function (filePath, currentTime, totalTime) {
  if (!filePath) return;
  let foundIndex;
  for (let index = 0; index < g_recent.length; index++) {
    if (g_recent[index].filePath === filePath) {
      foundIndex = index;
      break;
    }
  }
  if (foundIndex !== undefined) {
    // remove, to update and put last
    g_recent.splice(foundIndex, 1);
  }
  let newEntry = {
    filePath,
    currentTime,
    totalTime,
  };
  g_recent.push(newEntry);
  if (g_recent.length > g_recentCapacity) {
    g_recent.splice(0, g_recent.length - g_recentCapacity);
  }
};

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
