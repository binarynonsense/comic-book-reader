/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { clipboard } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../../core/main");
const { _, _raw } = require("../../shared/main/i18n");

const { FileExtension } = require("../../shared/main/constants");
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const contextMenu = require("../../shared/main/tools-menu-context");
const temp = require("../../shared/main/temp");
const tools = require("../../shared/main/tools");
const settings = require("../../shared/main/settings");
const menuBar = require("../../shared/main/menu-bar");
const log = require("../../shared/main/logger");
const forkUtils = require("../../shared/main/fork-utils");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_cancel = false;
let g_worker;
let g_tempSubFolderPath;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());

  updateLocalizedText();

  let loadedOptions = settings.loadToolOptions(`tool-ci`);
  sendIpcToRenderer("show", appUtils.getDesktopFolderPath(), loadedOptions);

  updateLocalizedText();
};

function killWorker() {
  if (g_worker !== undefined) {
    log.editor("[CI] killing worker");
    g_worker?.kill();
    g_worker = undefined;
  }
}

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up

  killWorker();
  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
};

exports.saveAndQuit = function () {
  sendIpcToRenderer("save-and-quit-request");
};

exports.saveAndClose = function () {
  sendIpcToRenderer("save-and-close-request");
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
  tools.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-convert-imgs", ...args);
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

  on("click-reset-options", () => {
    sendIpcToRenderer(
      "show-reset-options-modal",
      _("tool-shared-modal-title-warning"),
      _("tool-shared-ui-settings-reset-warning"),
      _("ui-modal-prompt-button-yes"),
      _("ui-modal-prompt-button-cancel"),
    );
  });

  on("save-settings-options", (options, forceQuit) => {
    settings.updateToolOptions(
      `tool-ci`,
      options["tool-ci-setting-remember-checkbox"] ? options : undefined,
    );
    if (forceQuit) {
      core.forceQuit();
    }
  });

  on("choose-file", async (lastFilePath) => {
    let defaultPath;
    if (lastFilePath) defaultPath = path.dirname(lastFilePath);
    try {
      let allowMultipleSelection = true;
      let allowedFileTypesName = _("dialog-file-types-images");
      let allowedFileTypesList = [
        FileExtension.JPG,
        FileExtension.JPEG,
        FileExtension.PNG,
        FileExtension.WEBP,
        FileExtension.BMP,
        FileExtension.AVIF,
      ];
      let filePathsList = appUtils.chooseFiles(
        core.getMainWindow(),
        defaultPath,
        allowedFileTypesName,
        allowedFileTypesList,
        allowMultipleSelection,
      );
      if (filePathsList === undefined) {
        return;
      }
      for (let index = 0; index < filePathsList.length; index++) {
        const filePath = filePathsList[index];
        await addFile(filePath);
      }
    } catch (err) {
      // TODO: do something?
    }
  });

  on("choose-folder", (inputFilePath, outputFolderPath) => {
    let defaultPath;
    if (outputFolderPath !== undefined) {
      defaultPath = outputFolderPath;
    } else if (inputFilePath !== undefined) {
      defaultPath = path.dirname(inputFilePath);
    }
    let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
    if (folderList === undefined) {
      return;
    }
    let folderPath = folderList[0];
    if (folderPath === undefined || folderPath === "") return;

    sendIpcToRenderer("change-output-folder", folderPath);
  });

  on("open-path-in-file-browser", (path) => {
    appUtils.openPathInFileBrowser(path);
  });

  on("dragged-files", async (filePaths) => {
    for (let index = 0; index < filePaths.length; index++) {
      const filePath = filePaths[index];
      await addFile(filePath);
    }
  });

  on("tooltip-button-clicked", (text) => {
    sendIpcToRenderer(
      "show-modal-info",
      _("tool-shared-modal-title-info"),
      text,
      _("tool-shared-ui-close").toUpperCase(),
    );
  });

  /////////////////////////

  on("cancel", () => {
    log.editor("[CI] cancel received");
    if (!g_cancel) {
      g_cancel = true;
      if (g_worker) {
        log.editor("[CI] sending cancel to worker");
        g_worker.postMessage([core.getLaunchInfo(), "cancel"]);
      } else {
        log.editor("[CI] can't send cancel to worker, no g_worker");
      }
    }
  });

  on(
    "start",
    (
      inputFiles,
      outputScale,
      outputFormatParams,
      outputFormat,
      outputFolderPath,
    ) => {
      menuBar.setCloseTool(false);
      sendIpcToPreload("update-menubar");
      start(
        inputFiles,
        outputScale,
        outputFormatParams,
        outputFormat,
        outputFolderPath,
      );
    },
  );

  on("copy-text-to-clipboard", (text) => {
    clipboard.writeText(text);
    core.showToast(_("ui-modal-prompt-button-copy-log-notification"), 3000);
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

async function addFile(filePath) {
  let stats = fs.statSync(filePath);
  if (!stats.isFile()) return; // avoid folders accidentally getting here
  let fileExtension = path.extname(filePath).toLowerCase();
  if (
    fileExtension === "." + FileExtension.JPG ||
    fileExtension === "." + FileExtension.JPEG ||
    fileExtension === "." + FileExtension.PNG ||
    fileExtension === "." + FileExtension.WEBP ||
    fileExtension === "." + FileExtension.BMP ||
    fileExtension === "." + FileExtension.AVIF
  ) {
    sendIpcToRenderer("add-file", filePath);
  }
}

function stopError(error) {
  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
  sendIpcToRenderer("update-log-text", error);
  sendIpcToRenderer(
    "update-log-text",
    _("tool-shared-modal-log-conversion-error"),
  );

  sendIpcToRenderer(
    "modal-update-title-text",
    _("tool-shared-modal-title-conversion-finished") + " ENDDDD",
  );

  if (g_numErrors > 0) {
    sendIpcToRenderer(
      "update-info-text",
      _(
        "tool-shared-modal-info-conversion-error-num-files",
        g_numErrors,
        g_numFiles,
      ),
    );
  } else {
    sendIpcToRenderer(
      "update-info-text",
      _("tool-shared-modal-info-conversion-success-num-files", g_numFiles),
    );
  }

  menuBar.setCloseTool(true);
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer(
    "show-result",
    _("tool-shared-modal-log-failed-files"),
    g_numFiles,
    g_numErrors,
    g_failedFilePaths,
    g_numAttempts,
  );
}

function stopCancel() {
  temp.deleteSubFolder(g_tempSubFolderPath);
  g_tempSubFolderPath = undefined;
  g_numAttempts--;
  sendIpcToRenderer(
    "update-log-text",
    _("tool-shared-modal-log-conversion-canceled"),
  );

  sendIpcToRenderer(
    "modal-update-title-text",
    _("tool-shared-modal-title-conversion-canceled"),
  );
  sendIpcToRenderer(
    "update-info-text",
    _(
      "tool-shared-modal-info-conversion-results",
      g_numAttempts - g_numErrors,
      g_numErrors,
      g_numFiles - g_numAttempts,
    ),
  );

  menuBar.setCloseTool(true);
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer(
    "show-result",
    _("tool-shared-modal-log-failed-files"),
    g_numFiles,
    g_numErrors,
    g_failedFilePaths,
    g_numAttempts,
  );
}

function updateModalLogText(inputText, append = true) {
  sendIpcToRenderer("update-log-text", inputText, append);
}

let g_numErrors = 0;
let g_numFiles = 0;
let g_numAttempts = 0;
let g_failedFilePaths = [];

async function start(
  imgFiles,
  outputScaleParams,
  outputFormatParams,
  outputFormat,
  outputFolderPath,
) {
  g_cancel = false;
  g_numErrors = 0;
  g_failedFilePaths = [];
  g_numAttempts = 0;
  g_numFiles = imgFiles.length;
  try {
    sendIpcToRenderer(
      "modal-update-title-text",
      _("tool-shared-modal-title-converting"),
    );
    sendIpcToRenderer(
      "update-log-text",
      _("tool-shared-modal-log-converting-images") + "...",
    );

    g_tempSubFolderPath = temp.createSubFolder();

    try {
      log.editor("[CI] starting worker (process images)");
      killWorker();
      g_worker = forkUtils.fork(
        path.join(__dirname, "../../shared/main/tools-worker-process.js"),
      );
      await new Promise((resolve, reject) => {
        g_worker.on("message", (message) => {
          if (message.type === "testLog") {
            log.test(message.log);
            return;
          } else if (message.type === "editorLog") {
            log.editor("[CI] " + message.log);
            return;
          } else if (message.type === "modalLog") {
            updateModalLogText(message.log);
            return;
          } else {
            g_numAttempts = message.numAttempts;
            g_numErrors = message.numErrors;
            g_failedFilePaths = message.failedFilePaths;
            if (message.success) {
              log.debug("[CI] images processed: " + message.state);
              resolve();
            } else {
              log.debug("[CI] images NOT processed correctly");
              reject(message.error);
            }
          }
        });
        g_worker.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`worker exited with code ${code}`));
          }
        });
        g_worker.postMessage([
          core.getLaunchInfo(),
          "images-tool-work",
          imgFiles,
          g_tempSubFolderPath,
          outputFolderPath,
          outputFormat,
          outputScaleParams,
          outputFormatParams,
          _("tool-shared-modal-log-resizing-image"),
          _("tool-shared-modal-log-converting-image"),
          _("tool-ec-modal-log-extracting-to"),
        ]);
      });
      killWorker();
      if (g_cancel === true) {
        stopCancel();
        return;
      }
    } catch (error) {
      stopError(error);
      return;
    }

    temp.deleteSubFolder(g_tempSubFolderPath);
    g_tempSubFolderPath = undefined;
    sendIpcToRenderer(
      "modal-update-title-text",
      _("tool-shared-modal-title-conversion-finished"),
    );
    if (g_numErrors > 0) {
      sendIpcToRenderer(
        "update-info-text",
        _(
          "tool-shared-modal-info-conversion-error-num-files",
          g_numErrors,
          g_numFiles,
        ),
      );
    } else {
      sendIpcToRenderer(
        "update-info-text",
        _("tool-shared-modal-info-conversion-success-num-files", g_numFiles),
      );
    }
    menuBar.setCloseTool(true);
    sendIpcToPreload("update-menubar");
    sendIpcToRenderer(
      "show-result",
      _("tool-shared-modal-log-failed-files"),
      g_numFiles,
      g_numErrors,
      g_failedFilePaths,
      g_numAttempts,
    );
  } catch (err) {
    stopError(err);
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    getLocalization(),
    getTooltipsLocalization(),
    { infoTooltip: _("tool-shared-modal-title-info") },
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getTooltipsLocalization() {
  return [
    {
      id: "tool-ci-tooltip-output-size",
      text: _("tool-shared-tooltip-output-scale-options"),
    },
    {
      id: "tool-ci-tooltip-output-folder",
      text: _("tool-shared-tooltip-output-folder"),
    },
    {
      id: "tool-ci-tooltip-remove-from-list",
      text: _("tool-shared-tooltip-remove-from-list"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "tool-ci-title-text",
      text: (_raw("tool-ci-title-alt", false)
        ? _raw("tool-ci-title-alt", false)
        : _("tool-ci-title")
      ).toUpperCase(),
    },
    {
      id: "tool-ci-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-ci-start-button-text",
      text: _("tool-shared-ui-convert").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ci-section-general-options-text",
      text: _("tool-shared-ui-general-options"),
    },
    {
      id: "tool-ci-section-advanced-options-text",
      text: _("tool-shared-ui-advanced-options"),
    },
    {
      id: "tool-ci-section-settings-text",
      text: _("tool-shared-tab-settings"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ci-input-options-text",
      text: _("tool-shared-ui-input-options"),
    },
    {
      id: "tool-ci-input-files-text",
      text: _("tool-shared-ui-input-files"),
    },
    {
      id: "tool-ci-add-file-button-text",
      text: _("tool-shared-ui-add").toUpperCase(),
    },
    {
      id: "tool-ci-clear-list-button-text",
      text: _("tool-shared-ui-clear-list").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ci-output-options-text",
      text: _("tool-shared-ui-output-options"),
    },

    {
      id: "tool-ci-output-image-scale-text",
      text: _("tool-shared-ui-output-options-scale").replace(" (%)", ""),
    },
    {
      id: "tool-ci-output-image-scale-select-0-text",
      text: _("tool-shared-ui-output-options-scale-percentage"),
    },
    {
      id: "tool-ci-output-image-scale-select-1-text",
      text: _("tool-shared-ui-output-options-scale-height"),
    },
    {
      id: "tool-ci-output-image-scale-select-2-text",
      text: _("tool-shared-ui-output-options-scale-width"),
    },

    {
      id: "tool-ci-output-image-format-text",
      text: _("tool-shared-ui-output-options-image-format"),
    },
    {
      id: "tool-ci-output-image-quality-text",
      text: _("tool-shared-ui-output-options-image-quality"),
    },
    {
      id: "tool-ci-output-folder-text",
      text: _("tool-shared-ui-output-folder"),
    },
    {
      id: "tool-ci-change-folder-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-ci-open-folder-button-text",
      text: _("tool-shared-ui-open").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ci-advanced-output-options-text",
      text: _("tool-shared-ui-advanced-output-options"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ci-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-ci-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "tool-ci-modal-copylog-button-text",
      text: _("ui-modal-prompt-button-copy-log").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ci-settings-text",
      text: _("tool-shared-tab-settings"),
    },
    {
      id: "tool-ci-setting-remember-text",
      text: _("tool-shared-ui-settings-remember"),
    },
    {
      id: "tool-ci-settings-reset-button-text",
      text: _("tool-shared-ui-settings-reset").toUpperCase(),
    },
    //////////////////////////////////////////////
  ];
}
