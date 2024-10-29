/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const reader = require("../../reader/main");
const shell = require("electron").shell;
const { BookType } = require("../../shared/main/constants");
const appUtils = require("../../shared/main/app-utils");
const settings = require("../../shared/main/settings");
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
  let portableCacheFolderPath = getPortableCacheFolder();
  sendIpcToRenderer(
    "show",
    portableCacheFolderPath,
    fs.existsSync(portableCacheFolderPath),
    settings.getValue("toolGutUseCache")
  );
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
  core.sendIpcToRenderer("tool-gutenberg", ...args);
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
    contextMenu.show("edit", params, onCloseClicked);
  });

  on("open-id", (bookId, bookTitle, mirrorUrl) => {
    const url = `${mirrorUrl}cache/epub/${bookId}/pg${bookId}.epub`;
    let data = { source: "gut", bookType: BookType.EBOOK };
    if (bookTitle) data.name = bookTitle;
    reader.openEbookFromPath(url, 0, {
      data: data,
    });
    onCloseClicked();
  });

  on("search", async (text, pageNum) => {
    try {
      if (text.trim().length === 0) {
        throw "query text is empty";
      }
      const axios = require("axios").default;
      // uses https://gutendex.com/
      // e.g. https://gutendex.com/books/?page=2&search=jules+verne',
      // if this stops working try parsing official search engine
      // e.g. https://www.gutenberg.org/ebooks/search/?query=jules+verne
      let searchQuery = encodeURIComponent(text);
      const response = await axios.get(
        `https://gutendex.com/books?page=${pageNum}&search=${searchQuery}`,
        { timeout: 10000 }
      );
      sendIpcToRenderer(
        "update-results",
        response.data,
        _("tool-shared-ui-search-nothing-found"),
        text,
        pageNum,
        _("tool-shared-ui-search-item-open-acbr"),
        _("tool-shared-ui-search-item-open-browser")
      );
    } catch (error) {
      log.error(error);
      sendIpcToRenderer(
        "update-results",
        undefined,
        _("tool-shared-ui-search-nothing-found")
      );
    }
  });

  on("update-use-cache", (value) => {
    settings.setValue("toolGutUseCache", value);
  });

  on("open-url-in-browser", (url) => {
    shell.openExternal(url);
  });

  on("open-path", (path) => {
    shell.openPath(path);
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

function getPortableCacheFolder() {
  return path.join(appUtils.getExeFolderPath(), "acbr-cache", "gutenberg");
}
exports.getPortableCacheFolder = getPortableCacheFolder;

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    _("tool-shared-ui-search-placeholder"),
    _("tool-shared-modal-title-searching"),
    _("tool-shared-ui-close"), // TODO: not used?
    _("tool-shared-ui-cancel"), // TODO: not used?
    getLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-gut-title-text",
      text: _("menu-tools-gut").toUpperCase(),
    },
    {
      id: "tool-gut-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-gut-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-gut-section-1-text",
      text: _("tool-shared-tab-openurl"),
    },
    {
      id: "tool-gut-section-2-text",
      text: _("tool-shared-tab-options"),
    },
    {
      id: "tool-gut-section-3-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-gut-section-4-text",
      text: _("tool-shared-tab-donate"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-gut-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-gut-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-gut-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-gut-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-gut-url-text",
      text: _("tool-gut-text-url"),
    },
    {
      id: "tool-gut-open-input-url-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-gut-open-input-url-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-gut-search-options-text",
      text: _("tool-shared-ui-search-options"),
    },
    {
      id: "tool-gut-options-mirrors-text",
      text: _("tool-gut-text-options-mirrors"),
    },
    {
      id: "tool-gut-options-search-engine-text",
      text: _("tool-gut-text-options-search-engine"),
    },
    {
      id: "tool-gut-other-options-text",
      text: _("tool-shared-ui-general-options"),
    },
    {
      id: "tool-gut-options-cache-folder-text",
      text: _("tool-gut-text-options-cache-folder"),
    },
    {
      id: "tool-gut-options-cache-downloads-text",
      text: _("tool-gut-text-options-cache-downloads"),
    },
    {
      id: "tool-gut-options-open-cache-folder-button-text",
      text: _("tool-gut-button-options-open-cache-folder").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-gut-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-gut-about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-books"),
        "Project Gutenberg"
      ),
    },
    {
      id: "tool-gut-about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-gut-open-pg-browser-button-text",
      text: _(
        "tool-shared-ui-button-open-websitename-in-browser",
        "Project Gutenberg"
      ).toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-gut-donate-text",
      text: _("tool-shared-ui-donateto-website", _("menu-tools-gut")),
    },
    {
      id: "tool-gut-donate-1-text",
      text: _("tool-shared-ui-donate-text", _("menu-tools-gut")),
    },
    {
      id: "tool-gut-open-donate-browser-button-text",
      text: _("tool-shared-ui-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-gut-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-gut-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "tool-gut-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
