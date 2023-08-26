/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const log = require("../shared/main/logger");

const {
  isPortable,
  getUserDataFolderPath,
  getExeFolderPath,
} = require("../shared/main/app-utils");

let g_settings;
let g_fileName = "acbr-player.cfg";

exports.get = function () {
  return g_settings;
};

exports.set = function (settings) {
  return (g_settings = settings);
};

exports.getValue = function (name) {
  return g_settings[name];
};

exports.setValue = function (name, value) {
  g_settings[name] = value;
};

exports.init = function () {
  load();
};

function setDefaultValues() {
  g_settings = {
    version: app.getVersion(),
    date: "",
    volume: 0.8,
    shuffle: false,
    repeat: false,
    currentFileIndex: undefined,
    currentTime: 0,
    showPlaylist: true,
  };
}

function sanitize() {
  if (isNaN(g_settings.volume)) {
    g_settings.volume = 0.8;
  }
  if (g_settings.volume < 0 || g_settings.volume > 1) {
    g_settings.volume = 0.8;
  }
  if (typeof g_settings.shuffle !== "boolean") {
    g_settings.shuffle = false;
  }
  if (typeof g_settings.repeat !== "boolean") {
    g_settings.repeat = false;
  }
  if (isNaN(g_settings.currentFileIndex)) {
    g_settings.currentFileIndex = undefined;
  }
  if (isNaN(g_settings.currentTime)) {
    g_settings.currentTime = 0;
  }
  if (typeof g_settings.showPlaylist !== "boolean") {
    g_settings.showPlaylist = true;
  }
}

///////////////////////////////////////////////////////////////////////////////
// SAVE / LOAD ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.save = function () {
  let cfgFilePath = path.join(getUserDataFolderPath(), g_fileName);
  if (isPortable()) {
    cfgFilePath = path.join(getExeFolderPath(), g_fileName);
    try {
      fs.accessSync(getExeFolderPath(), fs.constants.W_OK);
    } catch (err) {
      log.info("Warning: portable settings' folder not writable");
    }
  }
  let date = new Date().toJSON();
  g_settings.date = date;
  g_settings.version = app.getVersion();
  const settingsJSON = JSON.stringify(g_settings, null, 2);
  try {
    fs.writeFileSync(cfgFilePath, settingsJSON, "utf-8");
  } catch (e) {
    log.info("ERROR saving settings to: " + cfgFilePath);
    return;
  }
  log.info("settings saved to: " + cfgFilePath);
};

function load() {
  setDefaultValues();
  let cfgFilePath = path.join(getUserDataFolderPath(), g_fileName);
  if (isPortable()) {
    cfgFilePath = path.join(getExeFolderPath(), g_fileName);
  }
  if (fs.existsSync(cfgFilePath)) {
    let data;
    try {
      data = fs.readFileSync(cfgFilePath, "utf8");
    } catch (e) {
      return g_settings;
    }
    if (data === null || data === undefined) return settings;

    let loadedSettings;
    try {
      loadedSettings = JSON.parse(data);
    } catch (e) {
      return g_settings;
    }

    for (key in g_settings) {
      // ref: https://stackoverflow.com/questions/1098040/checking-if-a-key-exists-in-a-javascript-object
      if (loadedSettings[key] !== undefined) {
        // good if I don't allow undefines in the savefile
        g_settings[key] = loadedSettings[key];
      }
    }
    sanitize();
  }
}
