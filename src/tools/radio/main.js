/**
 * @license
 * Copyright 2024 Álvaro García
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

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_server = "https:\\de2.api.radio-browser.info";

async function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
    await getServersList();
  }
}

async function getServersList() {
  try {
    const axios = require("axios").default;
    const response = await axios.get(
      `https://all.api.radio-browser.info/json/servers`,
      { timeout: 10000 }
    );
    let urls = [];
    if (response.data && response.data.length > 0) {
      response.data.forEach((element) => {
        if (element.name) urls.push("https://" + element.name);
      });
    }
    if (urls.length > 0) {
      g_server = urls[Math.floor(Math.random() * urls.length)];
      log.test(g_server);
    }
  } catch (error) {
    log.error(error);
  }
  // refs:
  // https://api.radio-browser.info/examples/serverlist_fast.js
  // https://all.api.radio-browser.info/json/servers
  // https://docs.radio-browser.info/#server-mirrors
}

exports.open = function () {
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
  core.sendIpcToRenderer("tool-radio", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}

function sendIpcToAudioPlayerRenderer(...args) {
  core.sendIpcToRenderer("audio-player", ...args);
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

  on("open", (id, name, url, playlistOption) => {
    reader.showAudioPlayer(true, false);
    if (playlistOption === 0) {
      let files = [{ url: url, duration: -1, title: name }];
      sendIpcToAudioPlayerRenderer("add-to-playlist", files, true);
    } else {
      let playlist = {
        id: name,
        source: "radio",
        files: [{ url: url, duration: -1, title: name }],
      };
      sendIpcToAudioPlayerRenderer("open-playlist", playlist);
    }
    onCloseClicked();
    // Call the click api as requested by the docs
    (async () => {
      try {
        const axios = require("axios").default;
        await axios.get(`${g_server}/json/url/${id}`, {
          timeout: 5000,
        });
      } catch (error) {}
    })();
  });

  on("search", async (text, options) => {
    // ref: https://de1.api.radio-browser.info/#Advanced_station_search
    try {
      if (text.trim().length === 0) {
        throw "query's text is empty";
      }
      const axios = require("axios").default;
      let searchQuery = encodeURIComponent(text);
      let extraOptions = "";
      for (const key in options) {
        if (options[key] != undefined && options[key] != "") {
          extraOptions += "&" + key + "=" + encodeURIComponent(options[key]);
        }
      }
      const response = await axios.get(
        `${g_server}/json/stations/search?name=${searchQuery}&hidebroken=false${extraOptions}`,
        { timeout: 10000 }
      );

      sendIpcToRenderer(
        "update-results",
        response.data,
        _("tool-shared-ui-search-nothing-found"),
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

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    _("tool-shared-ui-search-placeholder"),
    _("tool-shared-modal-title-searching"),
    _("tool-shared-ui-cancel"),
    _("ui-modal-prompt-button-open-in-audioplayer"),
    _("ui-modal-prompt-button-add-to-playlist"),
    _("ui-modal-prompt-button-start-new-playlist"),
    getLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-radio-title-text",
      text: _("menu-tools-radio").toUpperCase(),
    },
    {
      id: "tool-radio-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-radio-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-radio-section-1-text",
      text: _("tool-shared-tab-options"),
    },
    {
      id: "tool-radio-section-2-text",
      text: _("tool-shared-tab-about"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-radio-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-radio-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-radio-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-radio-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-radio-options-text",
      text: _("tool-shared-ui-search-options"),
    },
    {
      id: "tool-radio-options-orderby-text",
      text: _("tool-radio-search-options-orderby"),
    },
    {
      id: "tool-radio-options-orderby-name-text",
      text: _("tool-radio-search-options-orderby-name"),
    },
    {
      id: "tool-radio-options-orderby-votes-text",
      text: _("tool-radio-search-options-orderby-votes"),
    },
    {
      id: "tool-radio-options-orderby-clicks-text",
      text: _("tool-radio-search-options-orderby-clicks"),
    },
    {
      id: "tool-radio-options-language-text",
      text: _("tool-radio-search-options-language"),
    },
    {
      id: "tool-radio-options-countrycode-text",
      text: _("tool-radio-search-options-countrycode"),
    },
    {
      id: "tool-radio-options-tag-text",
      text: _("tool-radio-search-options-tag"),
    },
    {
      id: "tool-radio-options-taglist-text",
      text: _("tool-radio-search-options-taglist"),
    },
    // {
    //   id: "tool-radio-advanced-options-text",
    //   text: _("tool-shared-ui-advanced-search-options"),
    // },
    //////////////////////////////////////////////
    {
      id: "tool-radio-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-radio-about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-radiostations"),
        "radio-browser.info"
      ),
    },
    {
      id: "tool-radio-about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-radio-open-radio-browser-button-text",
      text: _(
        "tool-shared-ui-button-open-websitename-in-browser",
        "radio-browser"
      ).toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-radio-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
