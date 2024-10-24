/**
 * @license
 * Copyright 2020-2024 Álvaro García
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
  builder.buildApplicationMenu(settings.get(), history.get());
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
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = true;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = false;
  Menu.getApplicationMenu().getMenuItemById("scale-to-height").checked = false;
};

exports.setFitToHeight = function () {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = false;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = true;
  Menu.getApplicationMenu().getMenuItemById("scale-to-height").checked = false;
};

exports.setScaleToHeight = function () {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = false;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = false;
  Menu.getApplicationMenu().getMenuItemById("scale-to-height").checked = true;
};

exports.setScrollBar = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("scrollbar").checked = isChecked;
};

exports.setToolBar = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("toolbar").checked = isChecked;
};

exports.setPageNumber = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("page-number").checked = isChecked;
};

exports.setClock = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("clock").checked = isChecked;
};

exports.setBattery = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("battery").checked = isChecked;
};

exports.setLoadingIndicator = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("loading-indicator").checked =
    isChecked;
};

exports.setAudioPlayer = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("audio-player").checked = isChecked;
};

exports.setPageRotation = function (value) {
  if (value === 0)
    Menu.getApplicationMenu().getMenuItemById("rotation-0").checked = true;
  if (value === 90)
    Menu.getApplicationMenu().getMenuItemById("rotation-90").checked = true;
  if (value === 180)
    Menu.getApplicationMenu().getMenuItemById("rotation-180").checked = true;
  if (value === 2700)
    Menu.getApplicationMenu().getMenuItemById("rotation-270").checked = true;
};

exports.setFilterMode = function (mode) {
  Menu.getApplicationMenu().getMenuItemById("filter-0").checked = mode === 0;
  Menu.getApplicationMenu().getMenuItemById("filter-1").checked = mode === 1;
};

exports.setPagesDirection = function (direction) {
  Menu.getApplicationMenu().getMenuItemById("pagesdirection-0").checked =
    direction === 0;
  Menu.getApplicationMenu().getMenuItemById("pagesdirection-1").checked =
    direction === 1;
};

////////////////////////////

exports.setCanOpenBooks = setCanOpenBooks = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("open-file").enabled = isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("openrecent-file"),
    isEnabled
  );
};

exports.setCanOpenTools = setCanOpenTools = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("file-preferences").enabled =
    isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("tools"),
    isEnabled
  );
};

exports.setCanTweakUI = setCanTweakUI = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("view-layout").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("scrollbar").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("toolbar").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("page-number").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("clock").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("battery").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("audio-player").enabled = isEnabled;
};

exports.setComicBookOpened = setComicBookOpened = function (isEnabled) {
  setCanOpenTools(isEnabled);
  setCanOpenBooks(isEnabled);
  setCanTweakUI(isEnabled);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-properties").enabled =
    isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("file-page"),
    isEnabled
  );
  Menu.getApplicationMenu().getMenuItemById("close-file").enabled = isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-rotation"),
    isEnabled
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-page"),
    isEnabled
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-zoom"),
    isEnabled
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-filter"),
    isEnabled
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-layout"),
    isEnabled
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-layout-pagesdirection"),
    isEnabled
  );
};

exports.setEpubEbookOpened = function () {
  setComicBookOpened(true);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("file-page"),
    false
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-rotation"),
    false
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-page"),
    true
  );
};

function EnableItemRecursive(item, isEnabled) {
  item.enabled = isEnabled;
  if (item.submenu) {
    item.submenu.items.forEach((subitem) => {
      EnableItemRecursive(subitem, isEnabled);
    });
  }
}

exports.setImageOpened = function () {
  setComicBookOpened(true);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("file-properties").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("file-page-export").enabled = false;
};

exports.setWWWOpened = function () {
  setComicBookOpened(true);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("file-properties").enabled = false;
};

// refs:
// https://uxdesign.cc/dot-dot-dot-7ce6170bfc7f?gi=ab412e3d4b7d
/*
“The ellipsis character (…) means a dialog or separate window will open and prompt the user for additional information or to make a choice.”

“This doesn’t mean you should use an ellipsis whenever an action displays another window — only when additional information is required to perform the action. Consequently, any command button whose implicit verb is to “show another window” doesn’t take an ellipsis, such as with the commands About, Advanced, Help (or any other command linking to a Help topic), Options, Properties, or Settings.”
*/
