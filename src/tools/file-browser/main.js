/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const utils = require("../../shared/main/utils");
const appUtils = require("../../shared/main/app-utils");
const fileUtils = require("../../shared/main/file-utils");
const reader = require("../../reader/main");
const contextMenu = require("../../shared/main/tools-menu-context");
let drivelist; // required in open

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = async function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();

  drivelist = require("drivelist");
  const drives = await drivelist.list();
  let drivesData = [];
  drivesData.push({
    name: _("tool-fb-shortcuts-places-home"),
    path: appUtils.getHomeFolderPath(),
    isPlace: true,
  });
  drivesData.push({
    name: _("tool-fb-shortcuts-places-desktop"),
    path: appUtils.getDesktopFolderPath(),
    isPlace: true,
  });
  drivesData.push({
    name: _("tool-fb-shortcuts-places-downloads"),
    path: appUtils.getDownloadsFolderPath(),
    isPlace: true,
  });
  drives.forEach((drive) => {
    // log.test(drive);
    // log.test("---------------------");
    if (drive.mountpoints && drive.mountpoints.length > 0) {
      let driveName = drive.mountpoints[drive.mountpoints.length - 1].label;
      const drivePath = drive.mountpoints[drive.mountpoints.length - 1].path;
      if (!driveName) {
        driveName = drive.displayName;
      }
      if (!driveName) {
        let size = (drive.size / 1024 / 1024 / 1024).toFixed(2);
        driveName = _("tool-fb-shortcuts-generic-drive", size);
      }
      drivesData.push({
        name: driveName,
        path: drivePath,
        isRemovable: drive.isRemovable,
        isUSB: drive.isUSB,
      });
    }
  });
  sendIpcToRenderer("show", drivesData);
  updateCurrentFolder(appUtils.getDesktopFolderPath());
};

exports.close = function () {
  // called by switchTool when closing tool
  // sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up
};

exports.onResize = function () {
  sendIpcToRenderer("update-window");
};

exports.onMaximize = function () {
  sendIpcToRenderer("update-window");
};

function onCloseClicked() {
  core.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-file-browser", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
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

  on("change-current-folder", (...args) => {
    updateCurrentFolder(...args);
  });

  on("open-file", (filePath) => {
    // TODO: check also, or only, in the change folder content generation?
    if (
      fileUtils.hasImageExtension(filePath) ||
      fileUtils.hasComicBookExtension(filePath)
    ) {
      reader.tryOpen(filePath);
      onCloseClicked();
    }
  });
}

// HANDLE

let g_handleIpcCallbacks = {};

async function handleIpcFromRenderer(...args) {
  const callback = g_handleIpcCallbacks[args[0]];
  if (callback) return await callback(...args.slice(1));
  return;
}
exports.handleIpcFromRenderer = handleIpcFromRenderer;

function handle(id, callback) {
  g_handleIpcCallbacks[id] = callback;
}

function initHandleIpcCallbacks() {}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateCurrentFolder(folderPath) {
  const folderContents = fileUtils.getFolderContents(folderPath);
  if (folderContents) {
    if (folderContents.files) {
      // files: only comics and images, no hidden ones
      folderContents.files = folderContents.files.filter((e) => {
        return (
          (fileUtils.hasImageExtension(e.fullPath) ||
            fileUtils.hasComicBookExtension(e.fullPath)) &&
          (process.platform !== "linux" || !e.name.startsWith("."))
        );
      });
      folderContents.files.sort((a, b) => {
        return utils.compare(a.name, b.name);
      });
    }
    if (folderContents.folders) {
      // folders: no hidden ones
      folderContents.folders = folderContents.folders.filter((e) => {
        return process.platform !== "linux" || !e.name.startsWith(".");
      });
      folderContents.folders.sort((a, b) => {
        return utils.compare(a.name, b.name);
      });
    }

    const parent = path.resolve(folderPath, "../");
    sendIpcToRenderer(
      "show-folder-contents",
      folderPath,
      folderContents,
      parent === folderPath ? undefined : parent
    );
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer("update-localization", getLocalization());
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-fb-title-text",
      text: _("tool-fb-title").toUpperCase(),
    },
    {
      id: "tool-fb-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
  ];
}
