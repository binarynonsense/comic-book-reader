/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const {
  setupTitlebar,
  attachTitlebarToWindow,
} = require("custom-electron-titlebar/main");

const core = require("../../core/main");
const builder = require("./menu-bar-builder");
const settings = require("./settings");
const history = require("./history");
const themes = require("./themes");

setupTitlebar();

exports.init = function (window) {
  attachTitlebarToWindow(window);
  rebuild();
};

exports.empty = function () {
  builder.buildEmptyMenu();
};

function rebuild() {
  builder.buildApplicationMenu(
    settings.get(),
    history.get(),
    core.isToolOpen(),
    core.getCurrentToolLocalizedName()
  );
  const themeData = themes.getData();
  core.sendIpcToPreload(
    "update-menubar",
    themeData["--titlebar-bg-color"],
    themeData["--titlebar-focused-bg-color"]
  );
}
exports.rebuild = rebuild;

///////////////////////////////////////////////////////////////////////////////
// SETTERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.setFitToWidth = function () {
  checkItem(getItem("fit-to-width"), true);
  checkItem(getItem("fit-to-height"), false);
  checkItem(getItem("scale-to-height"), false);
};

exports.setFitToHeight = function () {
  checkItem(getItem("fit-to-width"), false);
  checkItem(getItem("fit-to-height"), true);
  checkItem(getItem("scale-to-height"), false);
};

exports.setScaleToHeight = function () {
  checkItem(getItem("fit-to-width"), false);
  checkItem(getItem("fit-to-height"), false);
  checkItem(getItem("scale-to-height"), true);
};

exports.setScrollBar = function (isChecked) {
  checkItem(getItem("scrollbar"), isChecked);
};

exports.setToolBar = function (isChecked) {
  checkItem(getItem("toolbar"), isChecked);
};

exports.setPageNumber = function (isChecked) {
  checkItem(getItem("page-number"), isChecked);
};

exports.setClock = function (isChecked) {
  checkItem(getItem("clock"), isChecked);
};

exports.setBattery = function (isChecked) {
  checkItem(getItem("battery"), isChecked);
};

exports.setLoadingIndicator = function (isChecked) {
  checkItem(getItem("loading-indicator"), isChecked);
};

exports.setAudioPlayer = function (isChecked) {
  checkItem(getItem("audio-player"), isChecked);
};

exports.setPageRotation = function (value) {
  if (value === 0) checkItem(getItem("rotation-0"), true);
  if (value === 90) checkItem(getItem("rotation-90"), true);
  if (value === 180) checkItem(getItem("rotation-180"), true);
  if (value === 2700) checkItem(getItem("rotation-270").cheed, true);
};

exports.setFilterMode = function (mode) {
  checkItem(getItem("filter-0"), mode === 0);
  checkItem(getItem("filter-1"), mode === 1);
};

exports.setPagesDirection = function (direction) {
  checkItem(getItem("pagesdirection-0"), direction === 0);
  checkItem(getItem("pagesdirection-1"), direction === 1);
};

exports.setCloseTool = function (isEnabled) {
  enableItem(getItem("close-tool"), isEnabled);
};

////////////////////////////

exports.setCanOpenBooks = setCanOpenBooks = function (isEnabled) {
  enableItem(getItem("open-file"), isEnabled);
  enableItemRecursive(getItem("openrecent-file"), isEnabled);
};

exports.setCanOpenTools = setCanOpenTools = function (isEnabled) {
  enableItem(getItem("file-preferences"), isEnabled);
  enableItemRecursive(getItem("tools"), isEnabled);
};

exports.setCanTweakUI = setCanTweakUI = function (isEnabled) {
  enableItem(getItem("view-layout"), isEnabled);
  enableItemRecursive(getItem("view-layout-show"), isEnabled);
  enableItem(getItem("audio-player"), isEnabled);
  // getItem("scrollbar").enabled, isEnabled);
  // getItem("toolbar").enabled, isEnabled);
  // getItem("page-number").enabled, isEnabled);
  // getItem("clock").enabled, isEnabled);
  // getItem("battery").enabled, isEnabled);
  // getItem("audio-player").enabled, isEnabled);
  // getItem("loading-indicator").enabled =
  //   isEnabled;
};

exports.setComicBookOpened = setComicBookOpened = function (isEnabled) {
  setCanOpenTools(isEnabled);
  setCanOpenBooks(isEnabled);
  setCanTweakUI(isEnabled);
  enableItem(getItem("convert-file"), isEnabled);
  enableItem(getItem("extract-file"), isEnabled);
  enableItem(getItem("file-properties"), isEnabled);
  enableItemRecursive(getItem("file-page"), isEnabled);
  enableItem(getItem("close-file"), isEnabled);
  enableItemRecursive(getItem("view-rotation"), isEnabled);
  enableItemRecursive(getItem("view-page"), isEnabled);
  enableItemRecursive(getItem("view-zoom"), isEnabled);
  enableItemRecursive(getItem("view-filter"), isEnabled);
  enableItemRecursive(getItem("view-layout"), isEnabled);
  enableItemRecursive(getItem("view-layout-show"), isEnabled);
  enableItemRecursive(getItem("view-layout-pagesdirection"), isEnabled);
};

exports.setEpubEbookOpened = function () {
  setComicBookOpened(true);
  enableItem(getItem("convert-file"), false);
  enableItem(getItem("extract-file"), false);
  enableItemRecursive(getItem("file-page"), false);
  enableItemRecursive(getItem("view-rotation"), false);
  enableItemRecursive(getItem("view-page"), true);
};

exports.setImageOpened = function () {
  setComicBookOpened(true);
  enableItem(getItem("convert-file"), false);
  enableItem(getItem("extract-file"), false);
  enableItem(getItem("file-properties"), false);
  enableItem(getItem("file-page-export"), false);
};

exports.setWWWOpened = function () {
  setComicBookOpened(true);
  enableItem(getItem("convert-file"), false);
  enableItem(getItem("extract-file"), false);
  enableItem(getItem("file-properties"), false);
};

function getItem(id) {
  return Menu.getApplicationMenu().getMenuItemById(id);
}

function enableItem(item, isEnabled) {
  if (!item) return;
  item.enabled = isEnabled;
}

function checkItem(item, checked) {
  if (!item) return;
  item.checked = checked;
}

function enableItemRecursive(item, isEnabled) {
  if (!item) return;
  item.enabled = isEnabled;
  if (item.submenu) {
    item.submenu.items.forEach((subitem) => {
      enableItemRecursive(subitem, isEnabled);
    });
  }
}

// refs:
// https://uxdesign.cc/dot-dot-dot-7ce6170bfc7f?gi=ab412e3d4b7d
/*
“The ellipsis character (…) means a dialog or separate window will open and prompt the user for additional information or to make a choice.”

“This doesn’t mean you should use an ellipsis whenever an action displays another window — only when additional information is required to perform the action. Consequently, any command button whose implicit verb is to “show another window” doesn’t take an ellipsis, such as with the commands About, Advanced, Help (or any other command linking to a Help topic), Options, Properties, or Settings.”
*/
