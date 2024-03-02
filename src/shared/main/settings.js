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
const log = require("./logger");

const {
  isPortable,
  getUserDataFolderPath,
  getExeFolderPath,
} = require("./app-utils");

let g_settings;
const g_fileName = "acbr.cfg";
const g_defaultSize = { width: 1280, height: 720 };
const g_minSize = { width: 590, height: 410 };
const g_defaultSettings = {
  version: app.getVersion(),
  date: "",
  fit_mode: 0, // 0: width, 1: height, 2: scale height
  zoom_scale: 100,
  page_mode: 0, // 0: single-page, 1: double-page
  hotspots_mode: 1, // 0: disabled, 1: 2-columns, 2: 3-columns
  maximize: false,
  fullScreen: false,
  width: g_defaultSize.width,
  height: g_defaultSize.height,
  history_capacity: 30,
  on_quit_state: 0, // 0: no file, 1: reading file

  showMenuBar: true,
  showToolBar: true,
  showScrollBar: true,
  showPageNumber: true,
  showClock: false,
  showAudioPlayer: false,
  showBattery: false,

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
  layoutAudioPlayer: 0, // 0 top left, 3 bottom left - for now
  layoutBattery: 0, // 0 top left, 1 top center, 2 top right .... 5 bottom right
  epubOpenAs: 0, // 0 ask and remember, 1 always ask
  pdfReadingLib: 0, // 0 oldest, 1 newest
  cbrCreation: 0, // 0 disabled, 1 use command tool if available
  rarExeFolderPath: undefined,
  turnPageOnScrollBoundary: false,
  filterMode: 0, // 0: none, 1: old paper
  navKeys: {
    scrollUp: ["w", "ArrowUp"],
    scrollDown: ["s", "ArrowDown"],
  },

  locale: undefined,
  theme: undefined,

  tempFolderPath: undefined,

  // TOOLS

  toolGutUseCache: true,
  toolCixApiKeyPath: undefined,
};

exports.get = function () {
  return g_settings;
};

exports.getValue = function (name) {
  return g_settings[name];
};

exports.setValue = function (name, value) {
  g_settings[name] = value;
};

exports.init = function (...args) {
  load(...args);
};

function setDefaultValues() {
  g_settings = g_defaultSettings;
}

let g_scaleToHeightMin = 25;
let g_scaleToHeightMax = 500;

function sanitize(screenWidth, screenHeight) {
  if (
    !Number.isInteger(g_settings.fit_mode) ||
    g_settings.fit_mode < 0 ||
    g_settings.fit_mode > 2
  ) {
    g_settings.fit_mode = g_defaultSettings.fit_mode;
  }
  if (
    !Number.isInteger(g_settings.zoom_scale) ||
    g_settings.zoom_scale < g_scaleToHeightMin ||
    g_settings.zoom_scale > g_scaleToHeightMax
  ) {
    g_settings.zoom_scale = g_defaultSettings.zoom_scale;
  }
  if (
    !Number.isInteger(g_settings.page_mode) ||
    g_settings.page_mode < 0 ||
    g_settings.page_mode > 1
  ) {
    g_settings.page_mode = g_defaultSettings.page_mode;
  }
  if (
    !Number.isInteger(g_settings.hotspots_mode) ||
    g_settings.hotspots_mode < 0 ||
    g_settings.hotspots_mode > 2
  ) {
    g_settings.hotspots_mode = g_defaultSettings.hotspots_mode;
  }
  if (typeof g_settings.maximize !== "boolean") {
    g_settings.maximize = g_defaultSettings.maximize;
  }
  if (typeof g_settings.fullScreen !== "boolean") {
    g_settings.fullScreen = g_defaultSettings.fullScreen;
  }
  if (
    !Number.isInteger(g_settings.width) ||
    !Number.isInteger(g_settings.height)
  ) {
    g_settings.width = g_defaultSize.width;
    g_settings.height = g_defaultSize.height;
  }
  if (g_settings.width > screenWidth) {
    g_settings.width = screenWidth;
  } else if (g_settings.width < g_minSize.width) {
    g_settings.width = g_minSize.width;
  }
  if (g_settings.height > screenHeight) {
    g_settings.height = screenHeight;
  } else if (g_settings.height < g_minSize.height) {
    g_settings.height = g_minSize.height;
  }
  if (
    !Number.isInteger(g_settings.history_capacity) ||
    g_settings.history_capacity < 10 ||
    g_settings.history_capacity > 100
  ) {
    g_settings.history_capacity = g_defaultSettings.history_capacity;
  }
  if (
    !Number.isInteger(g_settings.on_quit_state) ||
    g_settings.on_quit_state < 0 ||
    g_settings.on_quit_state > 1
  ) {
    g_settings.on_quit_state = g_defaultSettings.on_quit_state;
  }

  if (typeof g_settings.showMenuBar !== "boolean") {
    g_settings.showMenuBar = true;
  }
  if (typeof g_settings.showToolBar !== "boolean") {
    g_settings.showToolBar = g_defaultSettings.showToolBar;
  }
  if (typeof g_settings.showPageNumber !== "boolean") {
    g_settings.showPageNumber = g_defaultSettings.showPageNumber;
  }
  if (typeof g_settings.showClock !== "boolean") {
    g_settings.showClock = g_defaultSettings.showClock;
  }
  if (typeof g_settings.showScrollBar !== "boolean") {
    g_settings.showScrollBar = g_defaultSettings.showScrollBar;
  }
  if (typeof g_settings.showAudioPlayer !== "boolean") {
    g_settings.showAudioPlayer = g_defaultSettings.showAudioPlayer;
  }
  if (typeof g_settings.showBattery !== "boolean") {
    g_settings.showBattery = g_defaultSettings.showBattery;
  }
  if (typeof g_settings.loadLastOpened !== "boolean") {
    g_settings.loadLastOpened = g_defaultSettings.loadLastOpened;
  }
  if (
    !Number.isInteger(g_settings.autoOpen) ||
    g_settings.autoOpen < 0 ||
    g_settings.autoOpen > 2
  ) {
    g_settings.autoOpen = g_defaultSettings.autoOpen;
  }
  if (
    !Number.isInteger(g_settings.cursorVisibility) ||
    g_settings.cursorVisibility < 0 ||
    g_settings.cursorVisibility > 1
  ) {
    g_settings.cursorVisibility = g_defaultSettings.cursorVisibility;
  }
  if (
    !Number.isInteger(g_settings.zoomDefault) ||
    g_settings.zoomDefault < 0 ||
    g_settings.zoomDefault > 2
  ) {
    g_settings.zoomDefault = g_defaultSettings.zoomDefault;
  }
  if (
    !Number.isInteger(g_settings.zoomFileLoading) ||
    g_settings.zoomFileLoading < 0 ||
    g_settings.zoomFileLoading > 1
  ) {
    g_settings.zoomFileLoading = g_defaultSettings.zoomFileLoading;
  }
  // loading indicator
  if (
    !Number.isInteger(g_settings.loadingIndicatorBG) ||
    g_settings.loadingIndicatorBG < 0 ||
    g_settings.loadingIndicatorBG > 1
  ) {
    g_settings.loadingIndicatorBG = g_defaultSettings.loadingIndicatorBG;
  }
  if (
    !Number.isInteger(g_settings.loadingIndicatorIconSize) ||
    g_settings.loadingIndicatorIconSize < 0 ||
    g_settings.loadingIndicatorIconSize > 1
  ) {
    g_settings.loadingIndicatorIconSize =
      g_defaultSettings.loadingIndicatorIconSize;
  }
  if (
    !Number.isInteger(g_settings.loadingIndicatorIconPos) ||
    g_settings.loadingIndicatorIconPos < 0 ||
    g_settings.loadingIndicatorIconPos > 1
  ) {
    g_settings.loadingIndicatorIconPos =
      g_defaultSettings.loadingIndicatorIconPos;
  }
  if (
    !Number.isInteger(g_settings.layoutClock) ||
    g_settings.layoutClock < 0 ||
    g_settings.layoutClock > 5
  ) {
    g_settings.layoutClock = g_defaultSettings.layoutClock;
  }
  if (
    !Number.isInteger(g_settings.layoutPageNum) ||
    g_settings.layoutPageNum < 0 ||
    g_settings.layoutPageNum > 5
  ) {
    g_settings.layoutPageNum = g_defaultSettings.layoutPageNum;
  }
  if (
    !Number.isInteger(g_settings.layoutAudioPlayer) ||
    (g_settings.layoutAudioPlayer != 0 && g_settings.layoutAudioPlayer != 1)
  ) {
    g_settings.layoutAudioPlayer = g_defaultSettings.layoutAudioPlayer;
  }
  if (
    !Number.isInteger(g_settings.layoutBattery) ||
    g_settings.layoutBattery < 0 ||
    g_settings.layoutBattery > 5
  ) {
    g_settings.layoutBattery = g_defaultSettings.layoutBattery;
  }
  if (
    !Number.isInteger(g_settings.epubOpenAs) ||
    g_settings.epubOpenAs < 0 ||
    g_settings.epubOpenAs > 1
  ) {
    g_settings.epubOpenAs = g_defaultSettings.epubOpenAs;
  }
  if (
    !Number.isInteger(g_settings.pdfReadingLib) ||
    g_settings.pdfReadingLib < 0 ||
    g_settings.pdfReadingLib > 1
  ) {
    g_settings.pdfReadingLib = g_defaultSettings.pdfReadingLib;
  }
  if (
    !Number.isInteger(g_settings.cbrCreation) ||
    g_settings.cbrCreation < 0 ||
    g_settings.cbrCreation > 1
  ) {
    g_settings.cbrCreation = g_defaultSettings.cbrCreation;
  }
  if (typeof g_settings.turnPageOnScrollBoundary !== "boolean") {
    g_settings.turnPageOnScrollBoundary =
      g_defaultSettings.turnPageOnScrollBoundary;
  }
  if (
    !Number.isInteger(g_settings.filterMode) ||
    g_settings.filterMode < 0 ||
    g_settings.filterMode > 1
  ) {
    g_settings.filterMode = g_defaultSettings.filterMode;
  }

  /////////////////////
  if (typeof g_settings.locale === "string") {
    g_settings.locale = g_settings.locale
      .replace(/[^a-z0-9_\-]/gi, "_")
      .toLowerCase();
  } else {
    g_settings.locale = g_defaultSettings.locale;
  }
  if (typeof g_settings.theme === "string") {
    g_settings.theme = g_settings.theme
      .replace(/[^a-z0-9_\-]/gi, "_")
      .toLowerCase();
  } else {
    g_settings.theme = g_defaultSettings.theme;
  }
  // TOOLS ///////////
  if (typeof g_settings.toolGutUseCache !== "boolean") {
    g_settings.toolGutUseCache = g_defaultSettings.toolGutUseCache;
  }
  if (
    g_settings.toolCixApiKeyPath &&
    typeof g_settings.toolCixApiKeyPath === "string"
  ) {
  } else {
    g_settings.toolCixApiKeyPath = g_defaultSettings.toolCixApiKeyPath;
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
      g_settings.rarExeFolderPath = g_defaultSettings.rarExeFolderPath;
    }
  } else {
    g_settings.rarExeFolderPath = g_defaultSettings.rarExeFolderPath;
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
  if (g_settings.tempFolderPath === fileUtils.getSystemTempFolderPath()) {
    g_settings.tempFolderPath = undefined;
  }
  g_settings.rarExeAvailable = undefined;
  const settingsJSON = JSON.stringify(g_settings, null, 2);
  try {
    fs.writeFileSync(cfgFilePath, settingsJSON, "utf-8");
  } catch (e) {
    log.error("ERROR saving settings to: " + cfgFilePath);
    return;
  }
  log.info("settings saved to: " + cfgFilePath);
};

function load(info) {
  log.debug("loading settings");
  setDefaultValues();
  try {
    let cfgFilePath = path.join(getUserDataFolderPath(), g_fileName);
    if (isPortable()) {
      cfgFilePath = path.join(getExeFolderPath(), g_fileName);
    }
    if (fs.existsSync(cfgFilePath)) {
      let data;
      try {
        data = fs.readFileSync(cfgFilePath, "utf8");
      } catch (error) {
        throw error;
      }
      if (data === null || data === undefined) {
        throw "null data";
      }

      let loadedSettings;
      try {
        loadedSettings = JSON.parse(data);
      } catch (error) {
        throw error;
      }

      for (const key in g_settings) {
        // ref: https://stackoverflow.com/questions/1098040/checking-if-a-key-exists-in-a-javascript-object
        if (loadedSettings[key] !== undefined) {
          // good if I don't allow undefines in the savefile
          if (key === "navKeys") {
            loadNavKeys(loadedSettings[key]);
          } else {
            g_settings[key] = loadedSettings[key];
          }
        }
      }
    }
    sanitize(info.screenWidth, info.screenHeight);
  } catch (error) {
    log.error(error);
    sanitize(info.screenWidth, info.screenHeight);
  }
}

function loadNavKeys(loadedKeys) {
  for (const navAction in g_settings.navKeys) {
    let navActionKeys = loadedKeys[navAction];
    if (
      navActionKeys !== undefined &&
      Array.isArray(navActionKeys) &&
      navActionKeys.length <= 2
    ) {
      let valid = true;
      for (const key in navActionKeys) {
        if (typeof key !== "string") valid = false;
      }
      if (valid) {
        g_settings.navKeys[navAction] = navActionKeys;
      }
    }
  }
}

exports.canEditRars = function () {
  if (g_settings.cbrCreation === 1) {
    if (g_settings.rarExeAvailable !== undefined) {
      return g_settings.rarExeAvailable;
    } else {
      if (utils.isRarExeAvailable(g_settings.rarExeFolderPath)) {
        g_settings.rarExeAvailable = true;
        return true;
      } else {
        g_settings.rarExeAvailable = false;
        return false;
      }
    }
  } else return false;
};
