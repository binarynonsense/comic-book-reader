/**
 * @license
 * Copyright 2025-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */
const fs = require("node:fs");
const path = require("node:path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const reader = require("../../reader/main");
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");
const log = require("../../shared/main/logger");
const sanitizeHtml = require("sanitize-html");
const settings = require("../../shared/main/settings");
const appUtils = require("../../shared/main/app-utils");
const localization = require("./main/localization");

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

  sendIpcToRenderer("show");
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up
};

exports.onQuit = function () {};

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
  return _("menu-tools-rss-reader");
};

function onCloseClicked() {
  tools.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-wiki", ...args);
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

  on("show-context-menu", (params, isImg) => {
    if (isImg) {
      contextMenu.show("copy-img", params, onCloseClicked);
    } else {
      contextMenu.show("copy-select", params, onCloseClicked);
    }
  });

  //////////////////

  on("load-md-url", (...args) => {
    loadMdUrl(...args);
  });

  on("open-url-in-browser", (urlString) => {
    appUtils.openURLInBrowser(urlString);
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

async function loadMdUrl(url) {
  const urlData = convertWikiToRawUrl(url);
  try {
    const net = require("../../shared/both/net");
    const { marked } = require("marked");
    const response = await net.get(urlData.rawUrl, {
      timeout: 10000,
    });
    let htmlOutput = marked.parse(response.data);
    const sanitizeHtml = require("sanitize-html");
    htmlOutput = sanitizeHtml(htmlOutput, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    });
    sendIpcToRenderer("load-content", htmlOutput, urlData);
  } catch (error) {
    log.error(error);
    sendIpcToRenderer(
      "load-content",
      `<div>${_("tool-wiki-error-load")}</div>`,
      urlData,
    );
    if (error.message && error.message === "fetch failed") {
      // network-level failure
    } else if (error.name && error.name === "NetError") {
      sendIpcToRenderer(
        "show-modal-info",
        _("ui-modal-title-networkerror"),
        _("tool-wiki-error-load") +
          "\n\n" +
          _("ui-modal-info-networkerror-code", error?.response.status ?? ""),
        _("ui-modal-prompt-button-ok"),
      );
      return;
    }
    sendIpcToRenderer(
      "show-modal-info",
      _("tool-shared-modal-title-error"),
      _("tool-wiki-error-load"),
      _("ui-modal-prompt-button-ok"),
    );
  }
}

function convertWikiToRawUrl(url) {
  try {
    let cleanUrl = url.split("#")[0].trim();
    const regex = /github\.com\/([^\/]+)\/([^\/]+)\/wiki\/(.+)$/;
    const match = cleanUrl.match(regex);
    if (!match) throw "no match";
    const [_, user, repo, title] = match;
    const sanitizedTitle = title
      // .replace(/%/g, "%25")
      // .replace(/:/g, "%3A")
      .replace(/\?/g, "%3F");
    const rawUrl = `https://raw.githubusercontent.com/wiki/${user}/${repo}/${sanitizedTitle}.md`;
    return { url, rawUrl, title };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    localization.getLocalization(),
    localization.getExtraLocalization(),
  );
}
exports.updateLocalizedText = updateLocalizedText;
