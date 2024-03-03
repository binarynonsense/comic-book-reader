/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const i18n = require("../../shared/main/i18n");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const settings = require("../../shared/main/settings");
const themes = require("../../shared/main/themes");
const reader = require("../../reader/main");
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const contextMenu = require("../../shared/main/tools-menu-context");

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
    settings.get()
  );
  let tempFolderPath = settings.getValue("tempFolderPath");
  let saveAsRelative = false;
  if (!path.isAbsolute(tempFolderPath)) {
    saveAsRelative = true;
  }
  sendIpcToRenderer("set-temp-folder", tempFolderPath, saveAsRelative);
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

function onCloseClicked() {
  core.switchTool("reader");
}

function updateNavKeys() {
  sendIpcToRenderer(
    "update-navkeys",
    settings.getValue("navKeys"),
    i18n._object("tool-pre-navkeys-actions"),
    _("tool-shared-ui-change").toUpperCase(),
    _("tool-shared-ui-reset").toUpperCase(),
    _("tool-pre-navkeys-button-resetall").toUpperCase(),
    _("tool-pre-navkeys-unassigned-key").toUpperCase()
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

  on("set-setting", (id, value) => {
    settings.setValue(id, value);
  });

  on("set-language", (value) => {
    i18n.loadLocale(value);
    settings.setValue("locale", i18n.getLoadedLocale());
    reader.rebuildMenuAndToolBars(false);
    for (const [key, value] of Object.entries(core.getTools())) {
      if (value.updateLocalizedText) value.updateLocalizedText();
    }
  });

  on("set-theme", (value) => {
    themes.load(value);
    settings.setValue("theme", value);
    sendIpcToCoreRenderer("update-css-properties", themes.getData());
    reader.rebuildMenuAndToolBars(false);
  });

  on("set-layout-clock", (value) => {
    settings.setValue("layoutClock", value);
    reader.updateLayoutClock();
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

  on("set-page-turn", (value) => {
    settings.setValue("turnPageOnScrollBoundary", value);
    reader.sendIpcToRenderer("set-page-turn-on-scroll-boundary", value);
  });

  on("set-pdf-reading-lib", (value) => {
    settings.setValue("pdfReadingLib", value);
    sendIpcToRenderer(
      "show-ok-modal",
      _("tool-shared-modal-title-info"),
      _("tool-shared-modal-info-change-needs-restart"),
      _("ui-modal-prompt-button-ok")
    );
  });

  on("change-temp-folder", (reset, saveAsRelative) => {
    let folderPath;
    let relativeFolderPath;
    if (reset) {
      folderPath = fileUtils.getSystemTempFolderPath();
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
          folderPath
        );
      }
    }
    settings.setValue(
      "tempFolderPath",
      relativeFolderPath ? relativeFolderPath : folderPath
    );
    fileUtils.setTempFolderParentPath(folderPath);
    sendIpcToRenderer(
      "set-temp-folder",
      relativeFolderPath ? relativeFolderPath : folderPath,
      saveAsRelative
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

  on("click-nav-keys-change", (action, keyIndex) => {
    sendIpcToRenderer(
      "show-nav-keys-change-modal",
      i18n._object("tool-pre-navkeys-actions")[action],
      `${_("tool-pre-navkeys-change-press")}\n${_(
        "tool-pre-navkeys-change-modifiers",
        "Control, Alt"
      )}\n\n${_("tool-pre-navkeys-change-cancel")}`,
      _("ui-modal-prompt-button-cancel").toUpperCase(),
      action,
      keyIndex
    );
  });

  on("click-nav-keys-resetall", () => {
    sendIpcToRenderer(
      "show-nav-keys-resetall-modal",
      _("tool-pre-navkeys-button-resetall"),
      _("tool-pre-navkeys-modal-resetall-message"),
      _("ui-modal-prompt-button-yes"),
      _("ui-modal-prompt-button-cancel")
    );
  });

  on("change-nav-keys", (action, index, key, ctrl, alt) => {
    let navKeys = settings.getValue("navKeys");
    let newValue = key;
    if (alt) newValue = "Alt+" + newValue;
    if (ctrl) newValue = "Control+" + newValue;
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
    const defaultNavKeys = JSON.parse(
      JSON.stringify(settings.getDefaultValue("navKeys"))
    );
    settings.setValue("navKeys", defaultNavKeys);
    reader.sendIpcToRenderer("set-nav-keys", settings.getValue("navKeys"));
    updateNavKeys();
  });
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    getLocalization(),
    getTooltipsLocalization()
  );
  updateNavKeys();
}
exports.updateLocalizedText = updateLocalizedText;

function getTooltipsLocalization() {
  return [
    {
      id: "tool-pre-tooltip-cbr-creation-modification",
      text: _(
        "tool-pre-use-system-exe-tooltip",
        process.platform === "win32" ? '"Rar.exe"' : '"rar"'
      ),
    },
    {
      id: "tool-pre-tooltip-rarfolder",
      text: `${_(
        "tool-pre-rarfolder-tooltip",
        process.platform === "win32" ? '"Rar.exe"' : '"rar"'
      )}${
        process.platform === "win32"
          ? " " + _("tool-pre-rarfolder-example", '"C:\\Program Files\\WinRAR"')
          : ""
      }`,
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "tool-pre-title-text",
      text: _("tool-pre-title").toUpperCase(),
    },
    {
      id: "tool-pre-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-section-all-text",
      text: _("tool-pre-all"),
    },
    {
      id: "tool-pre-section-appearance-text",
      text: _("tool-pre-appearance"),
    },
    {
      id: "tool-pre-section-ui-text",
      text: _("tool-pre-ui"),
    },
    {
      id: "tool-pre-section-file-formats-text",
      text: _("tool-pre-file-formats"),
    },
    {
      id: "tool-pre-section-advanced-text",
      text: _("tool-pre-advanced-preferences"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-text-colors-text",
      text: _("tool-pre-text-colors"),
    },
    {
      id: "tool-pre-languages-text",
      text: _("tool-pre-language"),
    },
    {
      id: "tool-pre-themes-text",
      text: _("tool-pre-theme"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-zoom-text",
      text: _("tool-pre-zoom"),
    },
    {
      id: "tool-pre-zoom-default-text",
      text: _("tool-pre-zoom-default"),
    },
    {
      id: "tool-pre-zoom-default-fitwidth-text",
      text: _("tool-pre-zoom-default-fitwidth"),
    },
    {
      id: "tool-pre-zoom-default-fitheight-text",
      text: _("tool-pre-zoom-default-fitheight"),
    },
    {
      id: "tool-pre-zoom-default-lastused-text",
      text: _("tool-pre-zoom-default-lastused"),
    },
    {
      id: "tool-pre-zoom-fileloading-text",
      text: _("tool-pre-zoom-fileloading"),
    },
    {
      id: "tool-pre-zoom-fileloading-default-text",
      text: _("tool-pre-zoom-fileloading-default"),
    },
    {
      id: "tool-pre-zoom-fileloading-history-text",
      text: _("tool-pre-zoom-fileloading-history"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-layout-text",
      text: _("tool-pre-layout"),
    },

    {
      id: "tool-pre-layout-clock-text",
      text: _("tool-pre-layout-clock"),
    },
    {
      id: "tool-pre-layout-clock-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-clock-1-text",
      text: _("menu-shared-top-center"),
    },
    {
      id: "tool-pre-layout-clock-2-text",
      text: _("menu-shared-top-right"),
    },
    {
      id: "tool-pre-layout-clock-3-text",
      text: _("menu-shared-bottom-left"),
    },
    {
      id: "tool-pre-layout-clock-4-text",
      text: _("menu-shared-bottom-center"),
    },
    {
      id: "tool-pre-layout-clock-5-text",
      text: _("menu-shared-bottom-right"),
    },

    {
      id: "tool-pre-layout-pagenum-text",
      text: _("tool-pre-layout-pagenum"),
    },
    {
      id: "tool-pre-layout-pagenum-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-pagenum-1-text",
      text: _("menu-shared-top-center"),
    },
    {
      id: "tool-pre-layout-pagenum-2-text",
      text: _("menu-shared-top-right"),
    },
    {
      id: "tool-pre-layout-pagenum-3-text",
      text: _("menu-shared-bottom-left"),
    },
    {
      id: "tool-pre-layout-pagenum-4-text",
      text: _("menu-shared-bottom-center"),
    },
    {
      id: "tool-pre-layout-pagenum-5-text",
      text: _("menu-shared-bottom-right"),
    },
    {
      id: "tool-pre-layout-audioplayer-text",
      text: _("tool-pre-layout-audioplayer"),
    },

    {
      id: "tool-pre-layout-audioplayer-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-audioplayer-1-text",
      text: _("menu-shared-bottom-left"),
    },

    {
      id: "tool-pre-layout-battery-text",
      text: _("tool-pre-layout-battery"),
    },
    {
      id: "tool-pre-layout-battery-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-battery-1-text",
      text: _("menu-shared-top-center"),
    },
    {
      id: "tool-pre-layout-battery-2-text",
      text: _("menu-shared-top-right"),
    },
    {
      id: "tool-pre-layout-battery-3-text",
      text: _("menu-shared-bottom-left"),
    },
    {
      id: "tool-pre-layout-battery-4-text",
      text: _("menu-shared-bottom-center"),
    },
    {
      id: "tool-pre-layout-battery-5-text",
      text: _("menu-shared-bottom-right"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-loading-text",
      text: _("tool-pre-loading"),
    },
    {
      id: "tool-pre-loading-bg-text",
      text: _("tool-pre-loading-bg"),
    },
    {
      id: "tool-pre-loading-bg-0-text",
      text: _("tool-pre-loading-bg-0"),
    },
    {
      id: "tool-pre-loading-bg-1-text",
      text: _("tool-pre-loading-bg-1"),
    },
    {
      id: "tool-pre-loading-isize-text",
      text: _("tool-pre-loading-isize"),
    },
    {
      id: "tool-pre-loading-isize-0-text",
      text: _("tool-pre-loading-isize-0"),
    },
    {
      id: "tool-pre-loading-isize-1-text",
      text: _("tool-pre-loading-isize-1"),
    },
    {
      id: "tool-pre-loading-ipos-text",
      text: _("tool-pre-loading-ipos"),
    },
    {
      id: "tool-pre-loading-ipos-0-text",
      text: _("tool-pre-loading-ipos-0"),
    },
    {
      id: "tool-pre-loading-ipos-1-text",
      text: _("tool-pre-loading-ipos-1"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-mouse-keyboard-text",
      text: _("tool-pre-mouse-keyboard"),
    },
    {
      id: "tool-pre-hotspots-text",
      text: _("tool-pre-hotspots"),
    },
    {
      id: "tool-pre-hotspots-disabled-text",
      text: _("tool-pre-hotspots-disabled"),
    },
    {
      id: "tool-pre-hotspots-2columns-text",
      text: _("tool-pre-hotspots-2columns"),
    },
    {
      id: "tool-pre-hotspots-3columns-text",
      text: _("tool-pre-hotspots-3columns"),
    },
    {
      id: "tool-pre-cursor-text",
      text: _("tool-pre-cursor"),
    },
    {
      id: "tool-pre-cursor-always-text",
      text: _("tool-pre-cursor-always"),
    },
    {
      id: "tool-pre-cursor-hide-inactive-text",
      text: _("tool-pre-cursor-hide-inactive"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-navigation-text",
      text: _("tool-pre-navigation"),
    },
    {
      id: "tool-pre-autoopen-text",
      text: _("tool-pre-autoopen"),
    },
    {
      id: "tool-pre-autoopen-disabled-text",
      text: _("tool-pre-autoopen-disabled"),
    },
    {
      id: "tool-pre-autoopen-next-text",
      text: _("tool-pre-autoopen-next"),
    },
    {
      id: "tool-pre-autoopen-nextandprev-text",
      text: _("tool-pre-autoopen-nextandprev"),
    },
    {
      id: "tool-pre-page-turn-text",
      text: _("tool-pre-page-turn"),
    },
    {
      id: "tool-pre-page-turn-default-text",
      text: _("tool-pre-page-turn-default"),
    },
    {
      id: "tool-pre-page-turn-onscroll-text",
      text: _("tool-pre-page-turn-onscroll"),
    },
    {
      id: "tool-pre-navkeys-text",
      text: _("tool-pre-navkeys"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-epub-text",
      text: _("tool-pre-epub"),
    },
    {
      id: "tool-pre-epub-openas-text",
      text: _("tool-pre-epub-openas"),
    },
    {
      id: "tool-pre-epub-openas-0-text",
      text: _("tool-pre-epub-openas-0"),
    },
    {
      id: "tool-pre-epub-openas-1-text",
      text: _("tool-pre-epub-openas-1"),
    },

    {
      id: "tool-pre-pdf-text",
      text: _("tool-pre-pdf"),
    },
    {
      id: "tool-pre-pdf-reading-library-version-text",
      text: _("tool-pre-pdf-reading-library-version"),
    },
    {
      id: "tool-pre-pdf-reading-library-version-0-text",
      text: `${_("tool-pre-pdf-library-version-oldest")} (${_(
        "tool-pre-pdf-library-version-oldest-desc"
      )})`,
    },
    {
      id: "tool-pre-pdf-reading-library-version-1-text",
      text: `${_("tool-pre-pdf-library-version-newest")} (${_(
        "tool-pre-pdf-library-version-newest-desc"
      )})`,
    },

    {
      id: "tool-pre-cbr-text",
      text: _("tool-pre-cbr"),
    },
    {
      id: "tool-pre-cbr-creation-modification-text",
      text: _("tool-pre-cbr-creation-modification"),
    },
    {
      id: "tool-pre-cbr-creation-modification-0-text",
      text: _("tool-pre-cbr-creation-modification-disabled"),
    },
    {
      id: "tool-pre-cbr-creation-modification-1-text",
      text:
        _("tool-pre-cbr-creation-modification-enabled") +
        " (" +
        _("tool-pre-use-system-exe") +
        ")",
    },
    {
      id: "tool-pre-rarfolder-text",
      text: _("tool-pre-rarfolder"),
    },
    {
      id: "tool-pre-rarfolder-update-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-pre-rarfolder-reset-button-text",
      text: _("tool-shared-ui-reset").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-tempfolder-text",
      text: _("tool-pre-tempfolder"),
    },
    {
      id: "tool-pre-tempfolder-update-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-pre-tempfolder-reset-button-text",
      text: _("tool-shared-ui-reset").toUpperCase(),
    },
    {
      id: "tool-pre-tempfolder-checkbox-text",
      text: _("tool-shared-ui-save-as-relative-path"),
    },
  ];
}
