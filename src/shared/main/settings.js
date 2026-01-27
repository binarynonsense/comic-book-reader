/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const utils = require("./utils");
const log = require("./logger");
const temp = require("./temp");

const { getConfigFolder } = require("./app-utils");

let g_settings;
const g_fileName = "acbr.cfg";
const g_defaultSize = { width: 1280, height: 720 };
const g_minSize = { width: 590, height: 410 };
const g_scaleToHeightMin = 25;
const g_scaleToHeightMax = 500;
// NOTE: add new preferences to resetPreferences
const g_defaultSettings = {
  version: app.getVersion(),
  date: "",
  fit_mode: 0, // 0: width, 1: height, 2: scale height
  zoom_scale: 100,
  page_mode: 0, // 0: single-page, 1: double-page, 2: double-page first centered
  hotspots_mode: 1, // 0: disabled, 1: 2-columns, 2: 3-columns
  maximize: false,
  fullScreen: false,
  width: g_defaultSize.width,
  height: g_defaultSize.height,
  on_quit_state: 0, // 0: no file, 1: reading file

  history_capacity: 50,

  showMenuBar: true,
  showToolBar: true,
  showScrollBar: true,
  showPageNumber: true,
  showClock: false,
  showAudioPlayer: false,
  showBattery: false,
  showLoadingIndicator: true,

  loadLastOpened: true, // TODO: used????
  autoOpen: 0, // 0: disabled, 1: next file, 2: next and previous files
  cursorVisibility: 0, // 0: always visible, 1: hide when inactive
  zoomDefault: 2, // 0: width, 1: height, 2: last used
  zoomFileLoading: 0, // 0: use default, 1: use history
  pageModeDefault: 3, // 0: single, 1: double, 2: double centered, 3: last used
  pageModeFileLoading: 0, // 0: use default, 1: use history
  loadingIndicatorBG: 1, // 0: transparent, 1: slightly opaque
  loadingIndicatorIconSize: 0, // 0: small, 1: big
  loadingIndicatorIconPos: 0, // 0: top left, 1: center
  layoutClock: 2, // 0 top left, 1 top center, 2 top right .... 5 bottom right
  clockFormat: 0, // 0: 24h, 1: 12h
  layoutPageNum: 4, // 0 top left, 1 top center, 2 top right .... 5 bottom right
  layoutAudioPlayer: 0, // 0 top left, 3 bottom left - for now
  layoutBattery: 0, // 0 top left, 1 top center, 2 top right .... 5 bottom right
  epubOpenAs: 0, // 0 ask and remember, 1 always ask
  pdfReadingLib: 0, // 0 oldest, 1 newest // DEPRECATED
  pdfReadingDpi: 300, // 600, 300, 200, 150, 96 or 72
  cbrCreation: 0, // 0 disabled, 1 use command tool if available
  rarExeFolderPath: undefined,
  turnPageOnScrollBoundary: false,
  filterMode: 0, // 0: none, 1: old paper
  toolbarDirection: 0, // 0: infer from language, 1: ltr, 2: rtl
  homeScreen: {
    latestPosition: 0, // 0: after favs, 1: top, 2: bottom
    latestMaxRows: 10, // integer >= 1
    latestMaxRowsCollapsed: 2, // integer >= 1
    favoritesMaxRowsCollapsed: 2, // integer >= 1
    otherMaxRowsCollapsed: 2, // integer >= 1
  },
  epubEbookColorMode: 0, // 0: light, 1: dark, 2: custom
  epubEbookColorText: "#000000", // rgb color in hex
  epubEbookColorBg: "#ffffff", // rgb color in hex
  pagesDirection: 0, // 0: ltr, 1: rtl,
  mouseButtonQuickMenu: 1, // -1: unassigned 0-4: mouse button

  checkUpdatesOnStart: 3, // 0: never, 1: always, 2: day, 3: week, 4: month
  checkUpdatesNotify: 0, // 0: always, 1: once
  checkUpdatesLastDate: "2025-07-01T10:37:28.188Z",
  checkUpdatesLastVersionFound: "1.0.0",

  navKeys: {
    scrollUp: ["w", "ArrowUp"],
    scrollDown: ["s", "ArrowDown"],
    scrollLeft: ["a"],
    scrollRight: ["d"],
    changePageNext: ["PageDown"],
    changePagePrev: ["PageUp"],
    changePageRight: ["ArrowRight"],
    changePageLeft: ["ArrowLeft"],
    changePageFirst: ["Home"],
    changePageLast: ["End"],
    changePageMode: ["Control+y"],
    zoomInPage: ["+"],
    zoomOutPage: ["-"],
    zoomResetPage: ["Control+0"],
    toggleFullScreen: ["F11"],
    toggleScrollBar: ["Control+b"],
    toggleToolBar: ["Control+t"],
    togglePageNumber: ["Control+p"],
    toggleClock: ["Control+j"],
    toggleBatteryStatus: ["Control+l"],
    toggleAudioPlayer: ["Control+m"],
    openFile: ["Control+o"],
    history: ["Control+h"],
    quickMenu: ["F1"],
    fileProperties: ["F2"],
    quit: ["Control+q"],
  },

  navButtons: {
    scrollUp: ["RS_UP"],
    scrollDown: ["RS_DOWN"],
    scrollLeft: ["RS_LEFT"],
    scrollRight: ["RS_RIGHT"],
    changePageRight: ["RB"],
    changePageLeft: ["LB"],
    changePageNext: ["BACK+RB"],
    changePagePrev: ["BACK+LB"],
    changePageFirst: ["BACK+A"],
    changePageLast: ["BACK+Y"],
    changePageMode: ["BACK+X"],
    zoomInPage: ["RT"],
    zoomOutPage: ["LT"],
    zoomResetPage: ["RS_PRESS"],
    toggleFullScreen: ["LS_PRESS"],
    quickMenu: ["START"],
  },

  locale: undefined,
  theme: undefined,
  themeTimeStart: "07:00",
  themeTimeEnd: "19:00",

  tempFolderPath: undefined,

  // EXTERNAL FILES LOADING
  loadExternalThemes: false,
  loadExternalLocalizations: false,

  // LINUX
  linuxEnforceGslice: false,

  // TOOLS
  toolGutUseCache: true,
  toolCixApiKeyPath: undefined,

  // EXPERIMENTAL
  experimentalForceMultimonitorSize: 0,
};

///////////////////////////////////////////////////////////////////////////////
// EXPORTS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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

exports.getDefault = function () {
  return g_defaultSettings;
};

exports.getDefaultValue = function (name) {
  return g_defaultSettings[name];
};

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

exports.capScreenSizes = function (screenWidth, screenHeight) {
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
};

exports.resetPreferences = function () {
  const currentSettings = structuredClone(g_settings);
  setDefaultValues();
  const preferences = [
    "hotspots_mode",

    "autoOpen",
    "cursorVisibility",
    "zoomDefault",
    "zoomFileLoading",
    "pageModeDefault",
    "pageModeFileLoading",
    "loadingIndicatorBG",
    "loadingIndicatorIconSize",
    "loadingIndicatorIconPos",
    "layoutClock",
    "clockFormat",
    "layoutPageNum",
    "layoutAudioPlayer",
    "layoutBattery",
    "epubOpenAs",
    "pdfReadingLib",
    "pdfReadingDpi",
    "cbrCreation",
    "rarExeFolderPath",
    "turnPageOnScrollBoundary",
    "toolbarDirection",
    "homeScreen",
    "epubEbookColorMode",
    "epubEbookColorText",
    "epubEbookColorBg",
    "mouseButtonQuickMenu",

    "checkUpdatesOnStart",
    "checkUpdatesNotify",

    "navKeys",
    "navButtons",

    "locale",
    "theme",
    "themeTimeStart",
    "themeTimeEnd",

    "tempFolderPath",

    "rarExeAvailable",
  ];
  for (const key in currentSettings) {
    if (!preferences.includes(key)) {
      log.editor(`keeping "${key}" setting`);
      g_settings[key] = currentSettings[key];
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function setDefaultValues() {
  g_settings = structuredClone(g_defaultSettings);
}

function sanitize() {
  if (
    !Number.isInteger(g_settings.width) ||
    !Number.isInteger(g_settings.height)
  ) {
    g_settings.width = g_defaultSize.width;
    g_settings.height = g_defaultSize.height;
  }
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
    g_settings.page_mode > 2
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
    !Number.isInteger(g_settings.history_capacity) ||
    g_settings.history_capacity < 1 ||
    g_settings.history_capacity > 1000
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
  if (typeof g_settings.showLoadingIndicator !== "boolean") {
    g_settings.showLoadingIndicator = g_defaultSettings.showLoadingIndicator;
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
    !Number.isInteger(g_settings.mouseButtonQuickMenu) ||
    g_settings.mouseButtonQuickMenu < -1 ||
    g_settings.mouseButtonQuickMenu > 4
  ) {
    g_settings.mouseButtonQuickMenu = -1;
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
  if (
    !Number.isInteger(g_settings.pageModeDefault) ||
    g_settings.pageModeDefault < 0 ||
    g_settings.pageModeDefault > 3
  ) {
    g_settings.pageModeDefault = g_defaultSettings.pageModeDefault;
  }
  if (
    !Number.isInteger(g_settings.pageModeFileLoading) ||
    g_settings.pageModeFileLoading < 0 ||
    g_settings.pageModeFileLoading > 1
  ) {
    g_settings.pageModeFileLoading = g_defaultSettings.pageModeFileLoading;
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
    !Number.isInteger(g_settings.clockFormat) ||
    g_settings.clockFormat < 0 ||
    g_settings.clockFormat > 1
  ) {
    g_settings.clockFormat = g_defaultSettings.clockFormat;
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
    !Number.isInteger(g_settings.toolbarDirection) ||
    g_settings.toolbarDirection < 0 ||
    g_settings.toolbarDirection > 2
  ) {
    g_settings.toolbarDirection = g_defaultSettings.toolbarDirection;
  }
  if (
    !Number.isInteger(g_settings.epubEbookColorMode) ||
    g_settings.epubEbookColorMode < 0 ||
    g_settings.epubEbookColorMode > 2
  ) {
    g_settings.epubEbookColorMode = g_defaultSettings.epubEbookColorMode;
  }
  if (!isRgbHexColor(g_settings.epubEbookColorText)) {
    g_settings.epubEbookColorText = g_defaultSettings.epubEbookColorText;
  }
  if (!isRgbHexColor(g_settings.epubEbookColorBg)) {
    g_settings.epubEbookColorBg = g_defaultSettings.epubEbookColorBg;
  }
  if (
    !Number.isInteger(g_settings.pagesDirection) ||
    g_settings.pagesDirection < 0 ||
    g_settings.pagesDirection > 1
  ) {
    g_settings.pagesDirection = g_defaultSettings.pagesDirection;
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
    !Number.isInteger(g_settings.pdfReadingDpi) ||
    (g_settings.pdfReadingDpi !== 600 &&
      g_settings.pdfReadingDpi !== 300 &&
      g_settings.pdfReadingDpi !== 200 &&
      g_settings.pdfReadingDpi !== 150 &&
      g_settings.pdfReadingDpi !== 96 &&
      g_settings.pdfReadingDpi !== 72)
  ) {
    g_settings.pdfReadingDpi = g_defaultSettings.pdfReadingDpi;
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
    g_settings.locale = g_settings.locale.replace(/[^a-zA-Z0-9_\-]/gi, "");
    if (g_settings.locale === "") g_settings.locale = g_defaultSettings.locale;
    //.toLowerCase();
  } else {
    g_settings.locale = g_defaultSettings.locale;
  }
  if (typeof g_settings.theme === "string") {
    g_settings.theme = g_settings.theme.replace(/[^a-zA-Z0-9_\-]/gi, "");
    //.toLowerCase();
    if (g_settings.theme === "") g_settings.theme = g_defaultSettings.theme;
  } else {
    g_settings.theme = g_defaultSettings.theme;
  }
  function padTime(timeString) {
    const parts = timeString.split(":");
    let hours = parts[0];
    let mins = parts[1];
    if (hours.length < 2) hours = "0" + hours;
    if (mins.length < 2) mins = "0" + mins;
    if (hours.length > 2) hours = hours.slice(-2);
    if (mins.length > 2) mins = mins.slice(-2);
    return hours + ":" + mins;
  }
  function isThemeTimeValid(timeString) {
    const parts = timeString.split(":");
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (parts.length > 2 || isNaN(hours) || isNaN(mins)) {
      return false;
    }
    if (hours < 0 || hours > 24) return false;
    if (mins < 0 || mins > 59) return false;
    return true;
  }
  if (
    typeof g_settings.themeTimeStart !== "string" ||
    !isThemeTimeValid(g_settings.themeTimeStart)
  ) {
    log.editorError("invalid theme time: " + g_settings.themeTimeStart);
    g_settings.themeTimeStart = g_defaultSettings.themeTimeStart;
  }
  g_settings.themeTimeStart = padTime(g_settings.themeTimeStart);
  if (
    typeof g_settings.themeTimeEnd !== "string" ||
    !isThemeTimeValid(g_settings.themeTimeEnd)
  ) {
    log.editorError("invalid theme time: " + g_settings.themeTimeEnd);
    g_settings.themeTimeEnd = g_defaultSettings.themeTimeEnd;
  }
  g_settings.themeTimeEnd = padTime(g_settings.themeTimeEnd);
  // EXTERNAL ///////////
  if (typeof g_settings.loadExternalThemes !== "boolean") {
    g_settings.loadExternalThemes = g_defaultSettings.loadExternalThemes;
  }
  if (typeof g_settings.loadExternalLocalizations !== "boolean") {
    g_settings.loadExternalLocalizations =
      g_defaultSettings.loadExternalLocalizations;
  }
  // LINUX ///////////
  if (typeof g_settings.linuxEnforceGslice !== "boolean") {
    g_settings.linuxEnforceGslice = g_defaultSettings.linuxEnforceGslice;
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
      g_settings.tempFolderPath = temp.getOSTempFolderPath();
    }
  } else {
    g_settings.tempFolderPath = temp.getOSTempFolderPath();
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

  // Updates
  if (
    !Number.isInteger(g_settings.checkUpdatesOnStart) ||
    g_settings.checkUpdatesOnStart < 0 ||
    g_settings.checkUpdatesOnStart > 4
  ) {
    g_settings.checkUpdatesOnStart = g_defaultSettings.checkUpdatesOnStart;
  }
  if (
    !Number.isInteger(g_settings.checkUpdatesNotify) ||
    g_settings.checkUpdatesNotify < 0 ||
    g_settings.checkUpdatesNotify > 1
  ) {
    g_settings.checkUpdatesNotify = g_defaultSettings.checkUpdatesNotify;
  }
  if (
    typeof g_settings.checkUpdatesLastDate !== "string" ||
    !Date.parse(g_settings.checkUpdatesLastDate)
  ) {
    // TODO: do something better than Date.parse?
    g_settings.checkUpdatesLastDate = g_defaultSettings.checkUpdatesLastDate;
  }
  if (
    typeof g_settings.checkUpdatesLastVersionFound !== "string" ||
    !utils.separateVersionText(g_settings.checkUpdatesLastVersionFound)
  ) {
    g_settings.checkUpdatesLastVersionFound =
      g_defaultSettings.checkUpdatesLastVersionFound;
  }

  // EXPERIMENTAL
  if (
    !Number.isInteger(g_settings.experimentalForceMultimonitorSize) ||
    g_settings.experimentalForceMultimonitorSize < 0
  ) {
    g_settings.experimentalForceMultimonitorSize = 0;
  }
}

function isRgbHexColor(text) {
  if (typeof text !== "string") {
    return false;
  }
  return /^#[0-9a-f]{6}$/i.test(text);
}

///////////////////////////////////////////////////////////////////////////////
// SAVE / LOAD ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.save = function () {
  let cfgFilePath = path.join(getConfigFolder(), g_fileName);
  let date = new Date().toJSON();
  g_settings.date = date;
  g_settings.version = app.getVersion();
  if (g_settings.tempFolderPath === temp.getOSTempFolderPath()) {
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
    let cfgFilePath = path.join(getConfigFolder(), g_fileName);
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
          } else if (key === "navButtons") {
            loadNavButtons(loadedSettings[key]);
          } else if (key === "homeScreen") {
            loadHomeScreen(loadedSettings[key]);
          } else {
            g_settings[key] = loadedSettings[key];
          }
        }
      }
      // special case: tools
      for (const key in loadedSettings) {
        if (key.startsWith("tool-")) {
          g_settings[key] = loadedSettings[key];
        }
      }
    }
    sanitize();
  } catch (error) {
    log.error(error);
    sanitize();
  }
}

function loadNavKeys(loadedKeys) {
  checkNavKeysOlderVersion(loadNavKeys);
  for (const navAction in g_settings.navKeys) {
    let commands = loadedKeys[navAction];
    if (
      commands !== undefined &&
      Array.isArray(commands) &&
      commands.length <= 2
    ) {
      let valid = true;
      for (const command in commands) {
        if (typeof command !== "string") valid = false;
      }
      if (valid) {
        g_settings.navKeys[navAction] = commands;
      }
    }
  }
}

function checkNavKeysOlderVersion(loadedKeys) {
  // if (loadedKeys.nextPage) {
  //   loadedKeys.turnToRightPage = loadedKeys.nextPage;
  //   loadedKeys.nextPage = undefined;
  // }
  // if (loadedKeys.prevPage) {
  //   loadedKeys.turnToLeftPage = loadedKeys.prevPage;
  //   loadedKeys.prevPage = undefined;
  // }
}

function loadNavButtons(loadedButtons) {
  for (const navAction in g_settings.navButtons) {
    let commands = loadedButtons[navAction];
    if (
      commands !== undefined &&
      Array.isArray(commands) &&
      commands.length <= 2
    ) {
      let valid = true;
      for (const command in commands) {
        if (typeof command !== "string") valid = false;
      }
      if (valid) {
        g_settings.navButtons[navAction] = commands;
      }
    }
  }
}

function loadHomeScreen(loadedHomeScreen) {
  if (isObject(loadedHomeScreen)) {
    for (const option in g_settings.homeScreen) {
      let value = loadedHomeScreen[option];
      if (value !== undefined && Number.isInteger(value)) {
        if (option === "latestPosition") {
          if (value >= 0 && value <= 2) isValid = true;
        } else {
          if (value > 0) isValid = true;
        }
      }
      if (isValid) {
        g_settings.homeScreen[option] = value;
      }
    }
  }
}

function isObject(input) {
  return typeof input == "object" && input.constructor == Object;
}

///////////////////////////////////////////////////////////////////////////////
// TOOLS //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.loadToolOptions = function (id) {
  let toolSettings = g_settings[id];
  if (toolSettings && isObject(toolSettings)) {
    const options = toolSettings["options"];
    if (options && isObject(options)) {
      for (const key in options) {
        if (key.includes("password-input")) {
          options[key] = atob(options[key]);
        } else if (key == "outputFolderPath") {
          if (!fs.existsSync(options[key])) {
            options[key] = undefined;
          }
        }
      }
      return options;
    }
  }
  return undefined;
};

exports.updateToolOptions = function (id, options) {
  if (options) {
    g_settings[id] = {};
    g_settings[id].version = app.getVersion();
    for (const key in options) {
      if (key.includes("password-input")) {
        options[key] = btoa(options[key]);
      }
    }
    g_settings[id].options = options;
  } else {
    g_settings[id] = undefined;
  }
};
