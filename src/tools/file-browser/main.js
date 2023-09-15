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

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_startingFolderPath;
let g_previousFolderPath;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function (fileData, showFocus) {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();
  g_startingFolderPath =
    fileData && fileData.path !== undefined && fileData.path !== ""
      ? path.dirname(fileData.path)
      : appUtils.getDesktopFolderPath();
  g_previousFolderPath = undefined;
  sendIpcToRenderer("show", showFocus, _("tool-shared-modal-title-loading"));
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

  on("build-drives-data", () => {
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

    const drives = utils.getDriveList();
    drives.forEach((drive) => {
      if (drive.path) {
        try {
          fs.accessSync(drive.path, fs.constants.R_OK);
          if (!drive.label || drive.label.trim() == "") {
            drive.name = _("tool-fb-shortcuts-generic-drive", drive.size);
          } else {
            drive.name = drive.label;
          }
          drivesData.push(drive);
        } catch (error) {
          log.test(error.message);
        }
      }
    });

    sendIpcToRenderer("build-page", drivesData);
    updateCurrentFolder(g_startingFolderPath);
  });

  on("change-current-folder", (...args) => {
    updateCurrentFolder(...args);
  });

  on("open-file", (filePath) => {
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
  try {
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
        parent === folderPath
          ? undefined
          : { path: parent, name: _("tool-fb-browse-up") },
        g_previousFolderPath
          ? {
              path: g_previousFolderPath,
              name: _("tool-fb-browse-back"),
            }
          : undefined
      );
      g_previousFolderPath = folderPath;
    }
  } catch (error) {
    log.debug(error);
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
