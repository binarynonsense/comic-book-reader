/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");

const settings = require("./settings");
const {
  isPortable,
  getUserDataFolderPath,
  getExeFolderPath,
} = require("./app-utils");

let g_history = [];
let g_capacity = 100;

exports.get = function () {
  return g_history;
};

exports.set = function (history) {
  g_history = [...history];
};

exports.getIndex = function (index) {
  return g_history[index];
};

exports.removeIndex = function (index) {
  g_history.splice(index, 1);
};

exports.init = function (capacity) {
  g_capacity = capacity;
  load();
};

exports.save = function () {
  let hstFilePath = path.join(getUserDataFolderPath(), "acbr.hst");
  if (fs.existsSync(path.join(getExeFolderPath(), "portable.txt"))) {
    hstFilePath = path.join(getExeFolderPath(), "acbr.hst");
  }
  const historyJSON = JSON.stringify(g_history, null, 2);
  try {
    fs.writeFileSync(hstFilePath, historyJSON, "utf-8");
  } catch (e) {
    console.log("ERROR saving history to: " + hstFilePath);
    return;
  }
  console.log("history saved to: " + hstFilePath);
};

function load() {
  g_history = [];
  let hstFilePath = path.join(getUserDataFolderPath(), "acbr.hst");
  if (isPortable()) {
    hstFilePath = path.join(getExeFolderPath(), "acbr.hst");
  }
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
          g_history.push(entry);
        }
      }
    }
  }
  // limit how many are remembered
  if (g_history.length > g_capacity) {
    g_history.splice(0, g_history.length - capacity);
  }
}
exports.load = load;

function clear() {
  g_history = [];
}
exports.clear = clear;

exports.add = function (filePath, pageIndex, data) {
  let foundIndex = getFilePathIndex(filePath);
  if (foundIndex !== undefined) {
    // remove, to update and put last
    g_history.splice(foundIndex, 1);
  }
  let newEntry = {
    filePath: filePath,
    pageIndex: pageIndex,
    fitMode: settings.getValue("fit_mode"),
    zoomScale: settings.getValue("zoom_scale"),
  };
  if (data) {
    newEntry.data = data;
    if (newEntry.data.tempData) delete newEntry.data.tempData;
  }
  g_history.push(newEntry);
  if (g_history.length > settings.getValue("history_capacity")) {
    g_history.splice(
      0,
      g_history.length - settings.getValue("history_capacity")
    );
  }
};

function getFilePathIndex(filePath) {
  if (!filePath) return undefined;
  let foundIndex;
  for (let index = 0; index < g_history.length; index++) {
    const element = g_history[index];
    if (element.filePath === filePath) {
      foundIndex = index;
      break;
    }
  }
  return foundIndex;
}
exports.getFilePathIndex = getFilePathIndex;
