/**
 * @license
 * Copyright 2025 Álvaro García
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
const log = require("../../shared/main/logger");
const axios = require("axios").default;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_feeds = [
  {
    name: "Bad Feed",
    url: "xfr",
  },
  {
    name: "Bad Feed 2",
    url: "https://comicbookrealm.com/rs",
  },
  {
    name: "CBR - Comic News",
    url: "https://www.cbr.com/feed/category/comics/news/",
  },
  {
    name: "Latest news on ComicBookRealm.com",
    url: "https://comicbookrealm.com/rss/news",
  },
  {
    name: "xkcd.com",
    url: "https://xkcd.com/rss.xml",
  },
  {
    name: "Comics and graphic novels | The Guardian",
    url: "https://www.theguardian.com/books/comics/rss",
  },
];

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
  sendIpcToRenderer("show", g_feeds);
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
  core.sendIpcToRenderer("tool-rss", ...args);
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

  on("get-feed-content", async (index) => {
    const feedData = await getFeedContent(index);
    sendIpcToRenderer("show-feed-content", feedData);
  });

  on("open-url-in-browser", (url) => {
    shell.openExternal(url);
  });

  on("on-feed-options-clicked", () => {
    sendIpcToRenderer(
      "show-modal-feed-options",
      _("tool-shared-tab-options"),
      _("tool-shared-ui-back"),
      _("tool-shared-tooltip-remove-from-list"),
      _("ui-modal-prompt-button-edit-name"),
      _("ui-modal-prompt-button-edit-url"),
      _("tool-shared-tooltip-move-up-in-list"),
      _("tool-shared-tooltip-move-down-in-list"),
      false
    );
  });

  on("on-modal-feed-options-edit-name-clicked", (feedIndex, feedUrl) => {
    if (g_feeds[feedIndex].url === feedUrl) {
      let feedName = g_feeds[feedIndex].name;
      sendIpcToRenderer(
        "show-modal-feed-edit-name",
        feedIndex,
        feedName,
        _("ui-modal-prompt-button-edit-name"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to edit a feed with not matching index and url");
    }
  });

  on("on-modal-feed-options-edit-name-ok-clicked", (feedIndex, newName) => {
    let feedName = g_feeds[feedIndex].name;
    if (newName && newName !== feedName) {
      g_feeds[feedIndex].name = newName;
      sendIpcToRenderer("update-feed-name", g_feeds, feedIndex);
    }
  });

  on("on-modal-feed-options-edit-url-clicked", (feedIndex, feedUrl) => {
    if (g_feeds[feedIndex].url === feedUrl) {
      let feedUrl = g_feeds[feedIndex].url;
      sendIpcToRenderer(
        "show-modal-feed-edit-url",
        feedIndex,
        feedUrl,
        _("ui-modal-prompt-button-edit-url"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to edit a feed with not matching index and url");
    }
  });

  on("on-modal-feed-options-edit-url-ok-clicked", (feedIndex, newUrl) => {
    let feedUrl = g_feeds[feedIndex].url;
    if (newUrl && newUrl !== feedUrl) {
      g_feeds[feedIndex].url = newUrl;
      sendIpcToRenderer("update-feed-url", g_feeds, feedIndex);
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

async function getFeedContent(feedId) {
  try {
    const response = await axios.get(g_feeds[feedId].url, { timeout: 15000 });
    const { XMLParser, XMLValidator } = require("fast-xml-parser");
    const isValidXml = XMLValidator.validate(response.data);
    if (isValidXml !== true) {
      throw "invalid xml";
    }
    // open
    const parserOptions = {
      ignoreAttributes: false,
      allowBooleanAttributes: true,
    };
    const parser = new XMLParser(parserOptions);
    let json = parser.parse(response.data);
    return json;
  } catch (error) {
    log.warning(error);
    return undefined;
  }
}
///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    getLocalization(),
    getExtraLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-rss-title-text",
      text: _("menu-tools-rss-reader").toUpperCase() + " (BETA)",
    },
    {
      id: "tool-rss-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-rss-add-button-text",
      text: _("tool-rss-add-feed").toUpperCase(),
    },
    //////////////////////////////////////////////
  ];
}

function getExtraLocalization() {
  return {
    edit: _("ui-modal-prompt-button-edit"),
    feedError: _("tool-rss-feed-error"),
    openInBrowser: _("tool-shared-ui-search-item-open-browser"),
    loadingTitle: _("tool-shared-modal-title-loading"),
  };
}
