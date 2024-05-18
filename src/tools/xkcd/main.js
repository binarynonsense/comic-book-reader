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
const reader = require("../../reader/main");
const shell = require("electron").shell;
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");

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

exports.open = function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();
  sendIpcToRenderer("show", _("tool-xkcd-select-catalog-number-default"));
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up
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
  core.sendIpcToRenderer("tool-xkcd", ...args);
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

  on("open", (comicData, pageNum) => {
    reader.openBookFromCallback(comicData, getPageCallback, pageNum - 1);
    onCloseClicked();
  });

  on("open-url-in-browser", (url) => {
    shell.openExternal(url);
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

async function getPageCallback(pageNum, fileData) {
  try {
    const axios = require("axios").default;
    const response = await axios.get(
      `https://xkcd.com/${pageNum}/info.0.json`,
      {
        timeout: 10000,
      }
    );
    const imageUrl = response?.data?.img;
    return {
      pageImgSrc: imageUrl,
      pageImgUrl: imageUrl,
      tempData: { title: response?.data?.alt },
    };
  } catch (error) {
    // console.error(error);
    return undefined;
  }
}
exports.getPageCallback = getPageCallback;

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
      id: "tool-xkcd-title-text",
      text: _("tool-xkcd-title").toUpperCase(),
    },
    {
      id: "tool-xkcd-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-xkcd-section-0-text",
      text: _("tool-shared-tab-catalog"),
    },
    {
      id: "tool-xkcd-section-1-text",
      text: _("tool-shared-tab-about"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-xkcd-catalog-text",
      text: _("tool-shared-tab-catalog"),
    },
    {
      id: "tool-xkcd-catalog-number-text",
      text: _("tool-xkcd-text-catalog-number"),
    },
    {
      id: "tool-xkcd-open-selected-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-xkcd-open-selected-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-xkcd-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-xkcd-about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-webcomics"),
        "xkcd"
      ),
    },
    {
      id: "tool-xkcd-about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-xkcd-about-3-text",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "tool-xkcd-open-dcm-browser-button-text",
      text: _("tool-xkcd-button-open-website-browser").toUpperCase(),
    },
  ];
}
