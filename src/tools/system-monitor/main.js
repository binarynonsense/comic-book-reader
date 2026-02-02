/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");
const { Worker } = require("node:worker_threads");

const core = require("../../core/main");
const log = require("../../shared/main/logger");
const { _ } = require("../../shared/main/i18n");
const settings = require("../../shared/main/settings");

let g_worker = undefined;
let g_mainWindow, g_parentElementId;
let g_isInitialized = false;

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core?.sendIpcToRenderer("system-monitor", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core?.sendIpcToRenderer("core", ...args);
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
  on("on-warning-icon-clicked", () => {
    let message = `
    <div id="sm-modal-div">${_("ui-modal-info-systemmonitor-retricted")}\n\n${_(
      "ui-modal-info-checkwiki",
      _("ui-modal-info-checkwiki-wiki"),
    )}</div>`;
    // _() sanitizes html so I have to add the span later
    message = message.replace(
      _("ui-modal-info-checkwiki-wiki"),
      `<span id="sm-modal-link" title="${_(
        "tool-shared-ui-search-item-open-browser",
      )}">${_("ui-modal-info-checkwiki-wiki")}</span>`,
    );
    sendIpcToRenderer(
      "show-modal-warning",
      _("tool-shared-modal-title-warning"),
      message,
      _("ui-modal-prompt-button-ok"),
    );
  });
}

///////////////////////////////////////////////////////////////////////////////
// MONITOR ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.init = function (mainWindow, parentElementId) {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    g_mainWindow = mainWindow;
    const data = fs.readFileSync(path.join(__dirname, "index.html"));
    g_parentElementId = parentElementId;
    sendIpcToCoreRenderer(
      "replace-inner-html",
      "#" + parentElementId,
      data.toString(),
    );
    updateLocalizedText();
    g_isInitialized = true;
  }
};

exports.open = function (isVisible) {
  if (isVisible) {
    try {
      sendIpcToRenderer(
        "show",
        true,
        g_parentElementId,
        settings.getValue("systemMonitorScale"),
      );
      log.debug("opening system monitor");
      const workerPath = path.join(__dirname, "/main/worker-thread.js");

      const worker = new Worker(workerPath);
      worker.on("message", (message) => {
        if (message.type === "stats") {
          if (message.stats.error) {
            sendIpcToRenderer("update-stats", message.stats, ``);
          } else {
            sendIpcToRenderer(
              "update-stats",
              message.stats,
              `${_("systemmonitor-memory-used")}: ${message.stats.memoryUsed.toFixed(1)}GiB / ${_("systemmonitor-memory-total")}: ${message.stats.memoryTotal.toFixed(1)}GiB`,
            );
          }
        } else if (message.type === "test-log") {
          log.test(message.text);
        } else if (message.type === "dev-error-log") {
          if (core?.isDev()) log.error(message.text);
        }
      });
      worker.on("error", (error) => {
        log.error("[System Monitor] worker error:", error);
      });
      worker.on("exit", (code) => {
        if (g_worker === worker) {
          g_worker = undefined;
        }
        if (code !== 0) {
          log.error(`[System Monitor] worker stopped with exit code ${code}`);
          // restart? setTimeout(startResourceWorker, 5000);
        }
      });

      g_worker = worker;
    } catch (error) {
      log.debug("couldn't start the system monitor");
    }
  } else {
    log.debug("closing system monitor");
    sendIpcToRenderer("show", false, g_parentElementId);
    shutdownWorker();
  }
};

exports.quit = function () {
  shutdownWorker();
};

function shutdownWorker() {
  if (g_worker) {
    g_worker.postMessage("shutdown");
    g_worker = undefined;
  }
}

function updateLocalizedText() {
  if (g_mainWindow)
    sendIpcToRenderer(
      "update-localization",
      getLocalization(),
      getTooltipsLocalization(),
    );
}
exports.updateLocalizedText = updateLocalizedText;

/////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "sm-memory-widget-name-text",
      text: _("systemmonitor-memory"),
    },
  ];
}

function getTooltipsLocalization() {
  return [
    {
      id: "sm-warning-icon",
      text: _("tool-shared-modal-title-warning"),
    },
  ];
}
