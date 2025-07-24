/**
 * @license
 * Copyright 2024-2025 Álvaro García
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
const settings = require("../../shared/main/settings");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_defaultServer = "https:\\de2.api.radio-browser.info";
let g_server;
let g_favorites = [];

async function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
    await getServersList();
  }
}

async function getServersList() {
  let urls = [];
  try {
    log.debug("[Radio] trying to get server from de1.api");
    const axios = require("axios").default;
    const response = await axios.get(
      `https:\\de1.api.radio-browser.info/json/servers`,
      { timeout: 10000 }
    );
    if (response.data && response.data.length > 0) {
      for (let i = 0; i < response.data.length; i++) {
        if (response.data[i].name == "de1.api.radio-browser.info") {
          // seems to be working so just choose it if it's in the list
          g_server = "https:\\de1.api.radio-browser.info";
          log.debug(`[Radio] server set to: ${g_server}`);
          return;
        }
      }
      // if not, choose at random
      response.data.forEach((element) => {
        if (element.name) urls.push("https://" + element.name);
      });
    } else {
      throw "de1.api no data";
    }
  } catch (error) {
    log.editorError(error);
    try {
      log.debug("[Radio] trying to get server from all.api");
      const axios = require("axios").default;
      const response = await axios.get(
        `https://all.api.radio-browser.info/json/servers`,
        { timeout: 10000 }
      );
      if (response.data && response.data.length > 0) {
        response.data.forEach((element) => {
          if (element.name) urls.push("https://" + element.name);
        });
      } else {
        throw "all.api no data";
      }
    } catch (error) {
      log.editorError(error);
    }
  }
  if (urls.length > 0) {
    log.debug("[Radio] choosing at random from the results");
    g_server = urls[Math.floor(Math.random() * urls.length)];
    log.debug(`[Radio] server set to: ${g_server}`);
    return;
  }
  log.debug(
    `[Radio] nothing found, will use the default server: ${g_defaultServer}`
  );
  // refs:
  // https://api.radio-browser.info/examples/serverlist_fast.js
  // https://all.api.radio-browser.info/json/servers
  // https://docs.radio-browser.info/#server-mirrors
}

exports.open = function (section = 1) {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();

  let loadedOptions = settings.loadToolOptions("tool-radio");
  if (
    loadedOptions &&
    loadedOptions.favorites &&
    Array.isArray(loadedOptions.favorites)
  ) {
    g_favorites = [];
    loadedOptions.favorites.forEach((favorite) => {
      if (typeof favorite == "object" && favorite.constructor == Object) {
        if (favorite.url && typeof favorite.url === "string") {
          if (!favorite.name || typeof favorite.name !== "string")
            favorite.name = "???";
          g_favorites.push(favorite);
        }
      }
    });
  }

  sendIpcToRenderer(
    "show",
    section,
    g_favorites,
    _("tool-shared-ui-search-nothing-found"),
    _("tool-shared-ui-search-item-open-acbr"),
    _("tool-shared-ui-search-item-open-browser"),
    _("tool-radio-add-to-favorites"),
    _("tool-radio-remove-from-favorites")
  );
};

function saveSettings() {
  let options = {};
  options.favorites = g_favorites;
  settings.updateToolOptions("tool-radio", options);
}

exports.close = function () {
  // called by switchTool when closing tool
  saveSettings();
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up
};

exports.onQuit = function () {
  saveSettings();
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
      sendIpcToAudioPlayerRenderer("add-to-playlist", files, true, false);
    } else {
      let playlist = {
        id: name,
        source: "radio",
        files: [{ url: url, duration: -1, title: name }],
      };
      sendIpcToAudioPlayerRenderer("open-playlist", playlist);
    }
    // Call the click api as requested by the docs
    (async () => {
      try {
        const axios = require("axios").default;
        await axios.get(
          `${g_server ? g_server : g_defaultServer}/json/url/${id}`,
          {
            timeout: 5000,
          }
        );
      } catch (error) {}
    })();
  });

  /////////

  on("on-clear-favorites-clicked", () => {
    sendIpcToRenderer(
      "show-modal-clear-favorites",
      _("tool-shared-modal-title-warning"),
      _("tool-shared-ui-clear-list-warning"),
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel")
    );
  });

  on("on-modal-reset-favorites-ok-clicked", () => {
    g_favorites = [];
    sendIpcToRenderer(
      "on-favorites-reset",
      g_favorites,
      _("tool-shared-ui-search-nothing-found"),
      _("tool-shared-ui-search-item-open-acbr"),
      _("tool-shared-ui-search-item-open-browser"),
      _("tool-radio-add-to-favorites"),
      _("tool-radio-remove-from-favorites")
    );
  });

  /////////

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
        `${
          g_server ? g_server : g_defaultServer
        }/json/stations/search?name=${searchQuery}&hidebroken=false${extraOptions}`,
        { timeout: 10000 }
      );

      sendIpcToRenderer(
        "update-results",
        response.data,
        true,
        _("tool-shared-ui-search-nothing-found"),
        _("tool-shared-ui-search-item-open-acbr"),
        _("tool-shared-ui-search-item-open-browser"),
        _("tool-radio-add-to-favorites"),
        _("tool-radio-remove-from-favorites")
      );
    } catch (error) {
      log.error(error);
      sendIpcToRenderer(
        "update-results",
        true,
        undefined,
        _("tool-shared-ui-search-nothing-found")
      );
    }
  });

  on("open-url-in-browser", (url) => {
    shell.openExternal(url);
  });

  on("on-add-result-to-favorites-clicked", (name, url) => {
    addFavorite(name, url);
  });

  on("on-remove-result-from-favorites-clicked", (name, url) => {
    removeFavorite(name, url);
  });

  on("on-favorite-options-clicked", (index) => {
    sendIpcToRenderer(
      "show-modal-favorite-options",
      index,
      _("tool-shared-tab-options"),
      _("tool-shared-ui-back"),
      _("tool-shared-tooltip-remove-from-list"),
      _("ui-modal-prompt-button-edit-name"),
      _("ui-modal-prompt-button-edit-url"),
      _("tool-shared-tooltip-move-up-in-list"),
      _("tool-shared-tooltip-move-down-in-list")
    );
  });

  on("on-modal-favorite-options-remove-clicked", (favIndex, favUrl) => {
    if (g_favorites[favIndex].url === favUrl) {
      sendIpcToRenderer(
        "show-modal-favorite-remove-from-favorites",
        favIndex,
        favUrl,
        _("tool-radio-remove-from-favorites"),
        _("tool-radio-remove-from-favorites-warning"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to remove a favorite with not matching index and path");
    }
  });

  on("on-modal-favorite-options-remove-ok-clicked", (favIndex, favUrl) => {
    g_favorites.splice(favIndex, 1);
    rebuildFavorites(false);
  });

  on("on-modal-favorite-options-edit-name-clicked", (favIndex, favUrl) => {
    if (g_favorites[favIndex].url === favUrl) {
      let favName = g_favorites[favIndex].name;
      sendIpcToRenderer(
        "show-modal-favorite-edit-name",
        favIndex,
        favUrl,
        favName,
        _("ui-modal-prompt-button-edit-name"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to edit a favorite with not matching index and url");
    }
  });

  on(
    "on-modal-favorite-options-edit-name-ok-clicked",
    (favIndex, favUrl, newName) => {
      if (g_favorites[favIndex].url === favUrl) {
        let favName = g_favorites[favIndex].name;
        if (newName && newName !== favName) {
          g_favorites[favIndex].name = newName;
          rebuildFavorites(false);
        }
      } else {
        log.error("Tried to edit a favorite with not matching index and url");
      }
    }
  );

  on("on-modal-favorite-options-edit-url-clicked", (favIndex, favUrl) => {
    if (g_favorites[favIndex].url === favUrl) {
      sendIpcToRenderer(
        "show-modal-favorite-edit-url",
        favIndex,
        favUrl,
        _("ui-modal-prompt-button-edit-url"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to edit a favorite with not matching index and url");
    }
  });

  on(
    "on-modal-favorite-options-edit-url-ok-clicked",
    (favIndex, favUrl, newUrl) => {
      if (g_favorites[favIndex].url === favUrl) {
        if (newUrl && newUrl !== favUrl) {
          g_favorites[favIndex].url = newUrl;
          rebuildFavorites(false);
        }
      } else {
        log.error("Tried to edit a favorite with not matching index and url");
      }
    }
  );

  on("on-modal-favorite-options-move-clicked", (favIndex, favUrl, dir) => {
    if (g_favorites[favIndex].url === favUrl) {
      if (dir == 0) {
        // up
        if (favIndex > 0) {
          let temp = g_favorites[favIndex - 1];
          g_favorites[favIndex - 1] = g_favorites[favIndex];
          g_favorites[favIndex] = temp;
          rebuildFavorites(false);
        }
      } else if (dir == 1) {
        // down
        if (favIndex < g_favorites.length - 1) {
          let temp = g_favorites[favIndex + 1];
          g_favorites[favIndex + 1] = g_favorites[favIndex];
          g_favorites[favIndex] = temp;
          rebuildFavorites(false);
        }
      }
    } else {
      log.error("Tried to move a favorite with not matching index and url");
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

function rebuildFavorites(scrollToTop) {
  sendIpcToRenderer("rebuild-favorites", g_favorites);
  sendIpcToRenderer(
    "update-results",
    undefined,
    scrollToTop,
    _("tool-shared-ui-search-nothing-found"),
    _("tool-shared-ui-search-item-open-acbr"),
    _("tool-shared-ui-search-item-open-browser"),
    _("tool-radio-add-to-favorites"),
    _("tool-radio-remove-from-favorites")
  );
}

function addFavorite(name, url) {
  let isAlreadyInList = false;
  for (let index = 0; index < g_favorites.length; index++) {
    if (g_favorites[index].url === url) {
      isAlreadyInList = true;
      break;
    }
  }
  if (!isAlreadyInList) {
    g_favorites.push({ name, url });
    rebuildFavorites(false);
  } else {
    log.debug("tried to add a favorite already in the list");
  }
}

function removeFavorite(name, url) {
  let isAlreadyInList = false;
  let index = 0;
  for (; index < g_favorites.length; index++) {
    if (g_favorites[index].url === url) {
      isAlreadyInList = true;
      break;
    }
  }
  if (isAlreadyInList) {
    g_favorites.splice(index, 1);
    rebuildFavorites(false);
  } else {
    log.debug("tried to remove a favorite not in the list");
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
      id: "tool-radio-title-text",
      text: _("menu-tools-radio").toUpperCase(),
    },
    {
      id: "tool-radio-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-radio-clear-favorites-button-text",
      text: _("tool-shared-ui-clear-list").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-radio-section-0-text",
      text: _("tool-radio-favorites"),
    },
    {
      id: "tool-radio-section-1-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-radio-section-2-text",
      text: _("tool-shared-tab-options"),
    },
    {
      id: "tool-radio-section-3-text",
      text: _("tool-shared-tab-about"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-radio-favorites-text",
      text: _("tool-radio-favorites"),
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

function getExtraLocalization() {
  return {
    searchPlaceHolderText: _("tool-shared-ui-search-placeholder"),
    modalSearchingTitleText: _("tool-shared-modal-title-searching"),
    modalCancelButtonText: _("tool-shared-ui-cancel"),
    modalOpenInPlayerTitleText: _("ui-modal-prompt-button-open-in-audioplayer"),
    modalAddToPlaylistButtonText: _("ui-modal-prompt-button-add-to-playlist"),
    modalNewPlaylistButtonText: _("ui-modal-prompt-button-start-new-playlist"),
    // favorites
    options: _("tool-shared-tab-options"),
    open: _("ui-modal-prompt-button-open"),
    back: _("tool-shared-ui-back"),
    removeFromList: _("tool-shared-tooltip-remove-from-list"),
    // _("ui-modal-prompt-button-edit-name"),
    // _("ui-modal-prompt-button-edit-url"),
    moveUpInList: _("tool-shared-tooltip-move-up-in-list"),
    moveDownInList: _("tool-shared-tooltip-move-down-in-list"),
  };
}
