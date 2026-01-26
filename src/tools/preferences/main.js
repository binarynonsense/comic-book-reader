/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");
const core = require("../../core/main");
const i18n = require("../../shared/main/i18n");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const settings = require("../../shared/main/settings");
const themes = require("../../shared/main/themes");
const reader = require("../../reader/main");
const homeScreen = require("../../reader/home-screen/main");
const appUtils = require("../../shared/main/app-utils");
const contextMenu = require("../../shared/main/tools-menu-context");
const temp = require("../../shared/main/temp");
const tools = require("../../shared/main/tools");
const history = require("../../shared/main/history");
const localization = require("./main/localization");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText(); // also creates the navKeys html
  sendIpcToRenderer(
    "show",
    i18n.getLoadedLocale(),
    i18n.getAvailableLocales(),
    themes.getId(),
    themes.getAvailableList(),
    settings.get(),
  );
  let tempFolderPath = settings.getValue("tempFolderPath");
  let saveAsRelative = false;
  if (!path.isAbsolute(tempFolderPath)) {
    saveAsRelative = true;
  }
  sendIpcToRenderer("set-temp-folder", tempFolderPath, saveAsRelative);
  sendIpcToRenderer("set-config-files", appUtils.getConfigFiles());
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
};

exports.onResize = function () {
  sendIpcToRenderer("update-window");
};

exports.onMaximize = function () {
  sendIpcToRenderer("update-window");
};

exports.onToggleFullScreen = function () {
  sendIpcToRenderer("update-window");
};

exports.getLocalizedName = function () {
  return _("tool-pre-title");
};

function onCloseClicked() {
  tools.switchTool("reader");
}

function updateNavKeys() {
  sendIpcToRenderer(
    "update-navkeys",
    settings.getValue("navKeys"),
    i18n._object("tool-pre-navkeys-actions"),
    _("tool-shared-ui-change").toUpperCase(),
    _("tool-shared-ui-reset").toUpperCase(),
    _("tool-pre-navkeys-button-resetall").toUpperCase(),
    _("tool-pre-navkeys-unassigned-key").toUpperCase(),
  );
}

function updateNavButtons() {
  sendIpcToRenderer(
    "update-navbuttons",
    settings.getValue("navButtons"),
    i18n._object("tool-pre-navkeys-actions"),
    _("tool-shared-ui-reset").toUpperCase(),
    _("tool-pre-navbuttons-button-resetall").toUpperCase(),
  );
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-preferences", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}

function sendIpcToPreload(...args) {
  core.sendIpcToPreload(...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};

exports.onIpcFromRenderer = function (...args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
};

function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("close", () => {
    onCloseClicked();
  });

  on("show-context-menu", (params) => {
    contextMenu.show("minimal", params, onCloseClicked);
  });

  on("reset-all", () => {
    log.debug("resetting settings");
    settings.resetPreferences();
    core.restartApp();
  });

  on("set-setting", (id, value) => {
    settings.setValue(id, value);
  });

  on("set-language", (value) => {
    i18n.loadLocale(value);
    settings.setValue("locale", i18n.getLoadedLocale());
    core.onLanguageChanged();
    reader.updateToolbarDirection(settings.getValue("toolbarDirection"));
    reader.rebuildMenuAndToolBars(false);
    for (const [key, value] of Object.entries(tools.getTools())) {
      if (value.updateLocalizedText) value.updateLocalizedText();
    }
  });

  on("set-theme", (value) => {
    themes.load(value);
    settings.setValue("theme", value);
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    reader.rebuildMenuAndToolBars(false);
  });

  on("set-theme-time-start", (value) => {
    settings.setValue("themeTimeStart", value);
    //
    themes.load(settings.getValue("theme"));
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    reader.rebuildMenuAndToolBars(false);
  });
  on("set-theme-time-end", (value) => {
    settings.setValue("themeTimeEnd", value);
    //
    themes.load(settings.getValue("theme"));
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    reader.rebuildMenuAndToolBars(false);
  });

  on("set-layout-clock", (value) => {
    settings.setValue("layoutClock", value);
    reader.updateLayoutClock();
  });

  on("set-clock-format", (value) => {
    settings.setValue("clockFormat", value);
  });

  on("set-layout-pagenum", (value) => {
    settings.setValue("layoutPageNum", value);
    reader.updateLayoutPageNum();
  });

  on("set-layout-audioplayer", (value) => {
    settings.setValue("layoutAudioPlayer", value);
    reader.updateLayoutAudioPlayer();
  });

  on("set-layout-battery", (value) => {
    settings.setValue("layoutBattery", value);
    reader.updateLayoutBattery();
  });

  on("set-toolbar-direction", (value) => {
    settings.setValue("toolbarDirection", value);
    reader.updateToolbarDirection();
  });

  /////////////////

  function updateHomeSettingsEntry(key, value) {
    let homeSettings = settings.getValue("homeScreen");
    homeSettings[key] = value;
    settings.setValue("homeScreen", homeSettings);
    homeScreen.onSettingsUpdated();
  }

  on("set-home-screen-latest-position", (value) => {
    updateHomeSettingsEntry("latestPosition", value);
  });

  on("set-home-screen-latest-max-rows", (value) => {
    updateHomeSettingsEntry("latestMaxRows", value);
  });

  on("set-home-screen-latest-max-rows-collapsed", (value) => {
    updateHomeSettingsEntry("latestMaxRowsCollapsed", value);
  });

  on("set-home-screen-favorites-max-rows-collapsed", (value) => {
    updateHomeSettingsEntry("favoritesMaxRowsCollapsed", value);
  });

  on("set-home-screen-other-max-rows-collapsed", (value) => {
    updateHomeSettingsEntry("otherMaxRowsCollapsed", value);
  });

  /////////////////

  on("set-epub-ebook-color-mode", (mode, textColor, bgColor) => {
    if (mode != undefined) settings.setValue("epubEbookColorMode", mode);
    if (textColor != undefined)
      settings.setValue("epubEbookColorText", textColor);
    if (bgColor != undefined) settings.setValue("epubEbookColorBg", bgColor);
    reader.sendIpcToRenderer(
      "update-epub-ebook-color-mode",
      mode,
      textColor,
      bgColor,
    );
  });

  on("set-recent-max-files", (value) => {
    settings.setValue("history_capacity", value);
    history.changeRecentCapacity(value);
    reader.rebuildMenuAndToolBars();
    homeScreen.refresh();
  });

  on("set-loading-bg", (value) => {
    settings.setValue("loadingIndicatorBG", value);
    reader.updateLoadingIndicator();
  });

  on("set-loading-isize", (value) => {
    settings.setValue("loadingIndicatorIconSize", value);
    reader.updateLoadingIndicator();
  });

  on("set-loading-ipos", (value) => {
    settings.setValue("loadingIndicatorIconPos", value);
    reader.updateLoadingIndicator();
  });

  on("set-cursor", (value) => {
    settings.setValue("cursorVisibility", value);
    reader.sendIpcToRenderer("set-hide-inactive-mouse-cursor", value === 1);
  });

  on("set-mousebutton-quickmenu", (value) => {
    settings.setValue("mouseButtonQuickMenu", value);
    reader.sendIpcToRenderer("set-mousebutton-quickmenu", value);
  });

  on("set-page-turn", (value) => {
    settings.setValue("turnPageOnScrollBoundary", value);
    reader.sendIpcToRenderer("set-page-turn-on-scroll-boundary", value);
  });

  on("change-temp-folder", (reset, saveAsRelative) => {
    let folderPath;
    let relativeFolderPath;
    if (reset) {
      folderPath = temp.getOSTempFolderPath();
      saveAsRelative = false;
    } else {
      let defaultPath = settings.getValue("tempFolderPath");
      let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
      if (folderList === undefined) {
        return;
      }
      folderPath = folderList[0];
      if (folderPath === undefined || folderPath === "") return;
      // TODO: check if writable?
      if (saveAsRelative) {
        relativeFolderPath = path.relative(
          appUtils.getExeFolderPath(),
          folderPath,
        );
      }
    }
    settings.setValue(
      "tempFolderPath",
      relativeFolderPath ? relativeFolderPath : folderPath,
    );
    // TODO: error recovery?
    temp.changeBaseFolderPath(folderPath);
    sendIpcToRenderer(
      "set-temp-folder",
      relativeFolderPath ? relativeFolderPath : folderPath,
      saveAsRelative,
    );
  });

  on("change-rar-folder", (reset) => {
    let folderPath;
    if (reset) {
      folderPath = undefined;
    } else {
      let defaultPath = settings.getValue("rarExeFolderPath");
      if (defaultPath === undefined && process.platform === "win32") {
        let winrarPath = "C:\\Program Files\\WinRAR";
        if (fs.existsSync(winrarPath)) {
          defaultPath = winrarPath;
          log.debug("found potential rar folder: " + defaultPath);
        } else {
          winrarPath = "D:\\Program Files\\WinRAR";
          if (fs.existsSync(winrarPath)) {
            defaultPath = winrarPath;
            log.debug("found potential rar folder: " + defaultPath);
          }
        }
      }
      let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
      if (folderList === undefined) {
        return;
      }
      folderPath = folderList[0];
      if (folderPath === undefined || folderPath === "") return;
    }
    settings.setValue("rarExeFolderPath", folderPath);
    settings.setValue("rarExeAvailable", undefined);
    sendIpcToRenderer("set-rar-folder", folderPath);
  });

  on("request-manual-updates-check", () => {
    core.onMenuCheckUpdates();
  });

  on("tooltip-button-clicked", (text) => {
    sendIpcToRenderer(
      "show-ok-modal",
      _("tool-shared-modal-title-info"),
      text,
      _("tool-shared-ui-close").toUpperCase(),
    );
  });

  // keys ///////////////

  on("click-nav-keys-change", (action, keyIndex) => {
    sendIpcToRenderer(
      "show-nav-keys-change-modal",
      i18n._object("tool-pre-navkeys-actions")[action],
      `${_("tool-pre-navkeys-change-press")}\n${_(
        "tool-pre-navkeys-change-modifiers",
        "Control, Alt",
      )}\n\n${_("tool-pre-navkeys-change-cancel")}`,
      _("ui-modal-prompt-button-cancel").toUpperCase(),
      action,
      keyIndex,
    );
  });

  on("click-nav-keys-resetall", () => {
    sendIpcToRenderer(
      "show-nav-keys-resetall-modal",
      _("tool-pre-navkeys-button-resetall"),
      _("tool-pre-navkeys-modal-resetall-message"),
      _("ui-modal-prompt-button-yes"),
      _("ui-modal-prompt-button-cancel"),
    );
  });

  on("change-nav-keys", (action, index, newValue) => {
    let navKeys = settings.getValue("navKeys");
    navKeys[action][index] = newValue; // array ref, so this updates the settings
    reader.sendIpcToRenderer("set-nav-keys", settings.getValue("navKeys"));
    updateNavKeys();
  });

  on("reset-nav-keys", (action, index) => {
    let navKeys = settings.getValue("navKeys");
    const defaultAction = settings.getDefaultValue("navKeys")[action];
    let value = "UNASSIGNED";
    // The action could have only one default key
    if (defaultAction.length > index) {
      value = defaultAction[index];
    }
    navKeys[action][index] = value; // array ref, so this updates the settings
    reader.sendIpcToRenderer("set-nav-keys", settings.getValue("navKeys"));
    updateNavKeys();
  });

  on("resetall-nav-keys", () => {
    // make a copy of the defaults object to update the settings
    const defaultNavKeys = structuredClone(settings.getDefaultValue("navKeys"));
    settings.setValue("navKeys", defaultNavKeys);
    reader.sendIpcToRenderer("set-nav-keys", settings.getValue("navKeys"));
    updateNavKeys();
  });

  // buttons /////////////

  on("click-nav-buttons-resetall", () => {
    sendIpcToRenderer(
      "show-nav-buttons-resetall-modal",
      _("tool-pre-navbuttons-button-resetall"),
      _("tool-pre-navbuttons-modal-resetall-message"),
      _("ui-modal-prompt-button-yes"),
      _("ui-modal-prompt-button-cancel"),
    );
  });

  on("change-nav-buttons", (action, index, buttonIds) => {
    let navButtons = settings.getValue("navButtons");
    buttonIds = buttonIds.filter((entry) => entry != "");
    let newCommand = "";
    for (let index = 0; index < buttonIds.length; index++) {
      const id = buttonIds[index];
      if (id != "") {
        newCommand += id;
        if (index < buttonIds.length - 1) {
          newCommand += "+";
        }
      }
    }
    navButtons[action][index] = newCommand; // array ref, so this updates the settings
    reader.sendIpcToRenderer(
      "set-nav-buttons",
      settings.getValue("navButtons"),
    );
    updateNavButtons();
  });

  on("reset-nav-buttons", (action, index) => {
    let navButtons = settings.getValue("navButtons");
    const defaultAction = settings.getDefaultValue("navButtons")[action];
    let value = "";
    // The action could have only one default command
    if (defaultAction.length > index) {
      value = defaultAction[index];
    }
    navButtons[action][index] = value; // array ref, so this updates the settings
    reader.sendIpcToRenderer(
      "set-nav-buttons",
      settings.getValue("navButtons"),
    );
    updateNavButtons();
  });

  on("resetall-nav-buttons", () => {
    // make a copy of the defaults object to update the settings
    const defaultNavButtons = structuredClone(
      settings.getDefaultValue("navButtons"),
    );
    settings.setValue("navButtons", defaultNavButtons);
    reader.sendIpcToRenderer(
      "set-nav-buttons",
      settings.getValue("navButtons"),
    );
    updateNavButtons();
  });

  on("open-path-in-file-browser", (path) => {
    appUtils.openPathInFileBrowser(path);
  });
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    localization.getLocalization(),
    localization.getTooltipsLocalization(),
    localization.getExtraLocalization(),
  );
  updateNavKeys();
  updateNavButtons();
}
exports.updateLocalizedText = updateLocalizedText;
