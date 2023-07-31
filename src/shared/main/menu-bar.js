/**
 * @license
 * Copyright 2020-2023 Álvaro García
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

////////////////////////////

// TODO: delete
exports.setTempCodeRefactoringDisabled = function () {
  Menu.getApplicationMenu().getMenuItemById("convert-imgs").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("create-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("create-qr").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-comics").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-palette").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-text").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-qr").enabled = false;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("tools-other"),
    false
  );

  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
  // Menu.getApplicationMenu().getMenuItemById("file-page-export").enabled = false;
  Menu.getApplicationMenu().getMenuItemById(
    "file-page-extract-palette"
  ).enabled = false;
  Menu.getApplicationMenu().getMenuItemById(
    "file-page-extract-text"
  ).enabled = false;
  Menu.getApplicationMenu().getMenuItemById(
    "file-page-extract-qr"
  ).enabled = false;
};

exports.setCanOpenBooks = setCanOpenBooks = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("open-file").enabled = isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("openrecent-file"),
    isEnabled
  );
};

exports.setComicBookOpened = setComicBookOpened = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("open-file").enabled = isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("openrecent-file"),
    isEnabled
  );
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = isEnabled;
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
  Menu.getApplicationMenu().getMenuItemById("file-page-export").enabled = false;
};

exports.setWWWOpened = function () {
  setComicBookOpened(true);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
};
