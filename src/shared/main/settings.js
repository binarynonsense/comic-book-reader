/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const fileUtils = require("./file-utils");
const utils = require("./utils");

const {
  isPortable,
  getUserDataFolderPath,
  getExeFolderPath,
} = require("./file-utils");

let g_settings;
let g_fileName = "acbr.cfg";

exports.get = function () {
  return g_settings;
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
    fit_mode: 0, // 0: width, 1: height, 2: scale height
    zoom_scale: 100,
    page_mode: 0, // 0: single-page, 1: double-page
    hotspots_mode: 1, // 0: disabled, 1: 2-columns, 2: 3-columns
    maximize: false,
    width: 800,
    height: 600,
    history_capacity: 30,
    on_quit_state: 0, // 0: no file, 1: reading file

    showMenuBar: true,
    showToolBar: true,
    showScrollBar: true,
    showPageNumber: true,
    showClock: false,
    showAudioPlayer: false,

    loadLastOpened: true,
    autoOpen: 0, // 0: disabled, 1: next file, 2: next and previous files
    cursorVisibility: 0, // 0: always visible, 1: hide when inactive
    zoomDefault: 2, // 0: width, 1: height, 2: last used
    zoomFileLoading: 0, // 0: use default, 1: use history
    loadingIndicatorBG: 1, // 0: transparent, 1: slightly opaque
    loadingIndicatorIconSize: 0, // 0: small, 1: big
    loadingIndicatorIconPos: 0, // 0: top left, 1: center
    layoutClock: 2, // 0 top left, 1 top center, 2 top right .... 5 bottom right
    layoutPageNum: 4, // 0 top left, 1 top center, 2 top right .... 5 bottom right
    layoutAudioPlayer: 0, // 0 top left, 3 bootom left - for now
    epubOpenAs: 0, // 0 ask and remember, 1 always ask
    cbrCreation: 0, // 0 disabled, 1 use command tool if available
    rarExeFolderPath: undefined,
    turnPageOnScrollBoundary: false,
    filterMode: 0, // 0: none, 1: old paper

    locale: undefined,
    theme: undefined,

    tempFolderPath: undefined,

    // TOOLS

    toolGutUseCache: true,
    toolCixApiKeyPath: undefined,
  };
}

let g_scaleToHeightMin = 25;
let g_scaleToHeightMax = 500;

function sanitize() {
  if (
    !Number.isInteger(g_settings.fit_mode) ||
    g_settings.fit_mode < 0 ||
    g_settings.fit_mode > 2
  ) {
    g_settings.fit_mode = 0;
  }
  if (
    !Number.isInteger(g_settings.zoom_scale) ||
    g_settings.zoom_scale < g_scaleToHeightMin ||
    g_settings.zoom_scale > g_scaleToHeightMax
  ) {
    g_settings.zoom_scale = 100;
  }
  if (
    !Number.isInteger(g_settings.page_mode) ||
    g_settings.page_mode < 0 ||
    g_settings.page_mode > 1
  ) {
    g_settings.page_mode = 0;
  }
  if (
    !Number.isInteger(g_settings.hotspots_mode) ||
    g_settings.hotspots_mode < 0 ||
    g_settings.hotspots_mode > 2
  ) {
    g_settings.hotspots_mode = 1;
  }
  if (typeof g_settings.maximize !== "boolean") {
    g_settings.maximize = false;
  }
  if (
    !Number.isInteger(g_settings.width) ||
    !Number.isInteger(g_settings.height)
  ) {
    g_settings.width = 800;
    g_settings.height = 600;
  }
  if (
    !Number.isInteger(g_settings.history_capacity) ||
    g_settings.history_capacity < 10 ||
    g_settings.history_capacity > 100
  ) {
    g_settings.history_capacity = 30;
  }
  if (
    !Number.isInteger(g_settings.on_quit_state) ||
    g_settings.on_quit_state < 0 ||
    g_settings.on_quit_state > 1
  ) {
    g_settings.on_quit_state = 0;
  }

  if (typeof g_settings.showMenuBar !== "boolean") {
    g_settings.showMenuBar = true;
  }
  if (typeof g_settings.showToolBar !== "boolean") {
    g_settings.showToolBar = true;
  }
  if (typeof g_settings.showPageNumber !== "boolean") {
    g_settings.showPageNumber = true;
  }
  if (typeof g_settings.showClock !== "boolean") {
    g_settings.showClock = false;
  }
  if (typeof g_settings.showScrollBar !== "boolean") {
    g_settings.showScrollBar = true;
  }
  if (typeof g_settings.showAudioPlayer !== "boolean") {
    g_settings.showAudioPlayer = false;
  }
  if (typeof g_settings.loadLastOpened !== "boolean") {
    g_settings.loadLastOpened = true;
  }
  if (
    !Number.isInteger(g_settings.autoOpen) ||
    g_settings.autoOpen < 0 ||
    g_settings.autoOpen > 2
  ) {
    g_settings.autoOpen = 0;
  }
  if (
    !Number.isInteger(g_settings.cursorVisibility) ||
    g_settings.cursorVisibility < 0 ||
    g_settings.cursorVisibility > 1
  ) {
    g_settings.cursorVisibility = 0;
  }
  if (
    !Number.isInteger(g_settings.zoomDefault) ||
    g_settings.zoomDefault < 0 ||
    g_settings.zoomDefault > 2
  ) {
    g_settings.zoomDefault = 2;
  }
  if (
    !Number.isInteger(g_settings.zoomFileLoading) ||
    g_settings.zoomFileLoading < 0 ||
    g_settings.zoomFileLoading > 1
  ) {
    g_settings.zoomFileLoading = 0;
  }
  // loading indicator
  if (
    !Number.isInteger(g_settings.loadingIndicatorBG) ||
    g_settings.loadingIndicatorBG < 0 ||
    g_settings.loadingIndicatorBG > 1
  ) {
    g_settings.loadingIndicatorBG = 1;
  }
  if (
    !Number.isInteger(g_settings.loadingIndicatorIconSize) ||
    g_settings.loadingIndicatorIconSize < 0 ||
    g_settings.loadingIndicatorIconSize > 1
  ) {
    g_settings.loadingIndicatorIconSize = 0;
  }
  if (
    !Number.isInteger(g_settings.loadingIndicatorIconPos) ||
    g_settings.loadingIndicatorIconPos < 0 ||
    g_settings.loadingIndicatorIconPos > 1
  ) {
    g_settings.loadingIndicatorIconPos = 0;
  }
  if (
    !Number.isInteger(g_settings.layoutClock) ||
    g_settings.layoutClock < 0 ||
    g_settings.layoutClock > 5
  ) {
    g_settings.layoutClock = 2;
  }
  if (
    !Number.isInteger(g_settings.layoutPageNum) ||
    g_settings.layoutPageNum < 0 ||
    g_settings.layoutPageNum > 5
  ) {
    g_settings.layoutPageNum = 2;
  }
  if (
    !Number.isInteger(g_settings.layoutAudioPlayer) ||
    (g_settings.layoutAudioPlayer != 0 && g_settings.layoutAudioPlayer != 1)
  ) {
    g_settings.layoutAudioPlayer = 0;
  }
  if (
    !Number.isInteger(g_settings.epubOpenAs) ||
    g_settings.epubOpenAs < 0 ||
    g_settings.epubOpenAs > 1
  ) {
    g_settings.epubOpenAs = 0;
  }
  if (
    !Number.isInteger(g_settings.cbrCreation) ||
    g_settings.cbrCreation < 0 ||
    g_settings.cbrCreation > 1
  ) {
    g_settings.cbrCreation = 0;
  }
  if (typeof g_settings.turnPageOnScrollBoundary !== "boolean") {
    g_settings.turnPageOnScrollBoundary = false;
  }
  if (
    !Number.isInteger(g_settings.filterMode) ||
    g_settings.filterMode < 0 ||
    g_settings.filterMode > 1
  ) {
    g_settings.filterMode = 0;
  }

  /////////////////////
  if (typeof g_settings.locale === "string") {
    g_settings.locale = g_settings.locale
      .replace(/[^a-z0-9_\-]/gi, "_")
      .toLowerCase();
  } else {
    g_settings.locale = undefined;
  }
  if (typeof g_settings.theme === "string") {
    g_settings.theme = g_settings.theme
      .replace(/[^a-z0-9_\-]/gi, "_")
      .toLowerCase();
  } else {
    g_settings.theme = undefined;
  }
  // TOOLS ///////////
  if (typeof g_settings.toolGutUseCache !== "boolean") {
    g_settings.toolGutUseCache = true;
  }
  if (
    g_settings.toolCixApiKeyPath &&
    typeof g_settings.toolCixApiKeyPath === "string"
  ) {
  } else {
    g_settings.toolCixApiKeyPath = undefined;
  }
  // TEMP FOLDER
  if (
    g_settings.tempFolderPath &&
    typeof g_settings.tempFolderPath === "string"
  ) {
    if (
      !fs.existsSync(g_settings.tempFolderPath) ||
      !fs.lstatSync(g_settings.tempFolderPath).isDirectory()
    ) {
      g_settings.tempFolderPath = fileUtils.getSystemTempFolderPath();
    }
  } else {
    g_settings.tempFolderPath = fileUtils.getSystemTempFolderPath();
  }
  // RAR FOLDER
  if (
    g_settings.rarExeFolderPath &&
    typeof g_settings.rarExeFolderPath === "string"
  ) {
    if (
      !fs.existsSync(g_settings.rarExeFolderPath) ||
      !fs.lstatSync(g_settings.rarExeFolderPath).isDirectory()
    ) {
      // if (process.platform === "win32") {
      // }
      g_settings.rarExeFolderPath = undefined;
    }
  } else {
    g_settings.rarExeFolderPath = undefined;
  }

  g_settings.rarExeAvailable = !utils.isRarExeAvailable(
    g_settings.rarExeFolderPath
  ).error;
  // TODO: delete
  console.log("rar command available: " + g_settings.rarExeAvailable);
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
      console.log("Warning: portable settings' folder not writable");
    }
  }
  let date = new Date().toJSON();
  g_settings.date = date;
  g_settings.version = app.getVersion();
  if (g_settings.tempFolderPath === fileUtils.getSystemTempFolderPath()) {
    g_settings.tempFolderPath = undefined;
  }
  g_settings.rarExeAvailable = undefined;
  const settingsJSON = JSON.stringify(g_settings, null, 2);
  try {
    fs.writeFileSync(cfgFilePath, settingsJSON, "utf-8");
  } catch (e) {
    console.log("ERROR saving settings to: " + cfgFilePath);
    return;
  }
  console.log("settings saved to: " + cfgFilePath);
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
