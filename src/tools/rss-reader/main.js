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
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");
const log = require("../../shared/main/logger");
const axios = require("axios").default;
const sanitizeHtml = require("sanitize-html");
const settings = require("../../shared/main/settings");
const utils = require("../../shared/main/utils");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_defaultFeeds = [
  // {
  //   name: "Bad feed",
  //   url: "fdfdfd",
  // },
  {
    name: "CBR Comic News",
    url: "https://www.cbr.com/feed/category/comics/news/",
  },
  {
    name: "Comics Worth Reading",
    url: "https://comicsworthreading.com/feed/",
  },
  {
    name: "The Comics Journal",
    url: "https://www.tcj.com/feed/",
  },
  {
    name: "The Beat",
    url: "https://www.comicsbeat.com/feed/",
  },
  {
    name: "Bleeding Cool - Comics",
    url: "https://bleedingcool.com/comics/feed/",
  },
  {
    name: "ComicList: Shipping This Week",
    url: "http://feeds.feedburner.com/ncrl",
  },
  {
    name: "r/comicbooks",
    url: "https://old.reddit.com/r/comicbooks/.rss",
  },
  {
    name: "xkcd.com",
    url: "https://xkcd.com/rss.xml",
  },
  {
    name: "ACBR Release Notes",
    url: "https://github.com/binarynonsense/comic-book-reader/releases.atom",
  },
  // {
  //   name: "Project Gutenberg Recently Posted or Updated EBooks",
  //   url: "http://www.gutenberg.org/cache/epub/feeds/today.rss",
  // },
  // {
  //   name: "Comics and graphic novels | The Guardian",
  //   url: "https://www.theguardian.com/books/comics/rss",
  // },
  // {
  //   name: "Blog | Binary Nonsense",
  //   url: "http://blog.binarynonsense.com/feed.xml",
  // },
];

let g_favorites = [];

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = async function (section = 0) {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();

  let loadedOptions = settings.loadToolOptions("tool-rss");
  if (
    loadedOptions &&
    loadedOptions.feeds &&
    Array.isArray(loadedOptions.feeds)
  ) {
    g_favorites = [];
    loadedOptions.feeds.forEach((feed) => {
      if (typeof feed == "object" && feed.constructor == Object) {
        if (feed.url && typeof feed.url === "string") {
          if (!feed.name || typeof feed.name !== "string") feed.name = "???";
          g_favorites.push(feed);
        }
      }
    });
    // g_feeds = structuredClone(loadedOptions.feeds);
  } else {
    g_favorites = structuredClone(g_defaultFeeds);
    // if (core.isDev() && !core.isRelease()) {
    //   g_feeds.unshift({
    //     name: "Bad Feed",
    //     url: "xfr",
    //   });
    // }
  }

  sendIpcToRenderer("show", section, g_favorites);
};

function saveSettings() {
  let options = {};
  options.feeds = g_favorites;
  settings.updateToolOptions("tool-rss", options);
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
  core.sendIpcToRenderer("tool-rss", ...args);
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

  on("show-context-menu", (params, isImg) => {
    if (isImg) {
      contextMenu.show("copy-img", params, onCloseClicked);
    } else {
      contextMenu.show("minimal", params, onCloseClicked);
    }
  });

  on("get-feed-content", async (url, index, switchToContent = true) => {
    if (index >= 0) {
      const feedData = await getFeedContent(g_favorites[index].url);
      sendIpcToRenderer("load-feed-content", feedData, index, switchToContent);
    } else {
      openFeedURL(url, switchToContent);
    }
  });

  on("open-url-in-browser", (urlString) => {
    // HACK: for /r/comicbooks
    if (urlString.startsWith("file:///r/comicbooks")) {
      urlString = urlString.replace("file://", "https://old.reddit.com");
    }
    utils.openURLInBrowser(urlString);
  });

  on("open-url-in-audio-player", (url, name, playlistOption) => {
    reader.showAudioPlayer(true, false);
    if (playlistOption === 0) {
      let files = [{ url: url, duration: -1, title: name }];
      sendIpcToAudioPlayerRenderer("add-to-playlist", files, true, false);
    } else {
      let playlist = {
        id: name,
        source: "rss",
        files: [{ url: url, duration: -1, title: name }],
      };
      sendIpcToAudioPlayerRenderer("open-playlist", playlist);
    }
  });

  //////////////////

  on("on-open-feed-url-clicked", () => {
    sendIpcToRenderer(
      "show-modal-open-feed-url",
      _("tool-shared-tab-openurl"),
      "URL",
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel")
    );
  });

  on(
    "on-modal-open-feed-url-ok-clicked",
    async (url, switchToContent = true) => {
      openFeedURL(url, switchToContent);
    }
  );

  on("on-reset-favorites-clicked", () => {
    sendIpcToRenderer(
      "show-modal-reset-favorites",
      _("tool-shared-modal-title-warning"),
      _("tool-shared-ui-reset-list-warning"),
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel")
    );
  });

  on("on-modal-reset-favorites-ok-clicked", () => {
    g_favorites = structuredClone(g_defaultFeeds);
    sendIpcToRenderer("on-favorites-reset", g_favorites);
  });

  on("on-clear-favorites-clicked", () => {
    sendIpcToRenderer(
      "show-modal-clear-favorites",
      _("tool-shared-modal-title-warning"),
      _("tool-shared-ui-clear-list-warning"),
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel")
    );
  });

  on("on-modal-clear-favorites-ok-clicked", () => {
    g_favorites = [];
    sendIpcToRenderer("on-favorites-clear", g_favorites);
  });

  //////////////////

  on("on-feed-options-clicked", (index) => {
    sendIpcToRenderer(
      "show-modal-feed-options",
      index,
      _("tool-shared-tab-options"),
      _("tool-shared-ui-back"),
      _("ui-modal-prompt-button-edit-name"),
      _("ui-modal-prompt-button-edit-url"),
      _("tool-shared-ui-search-item-open-browser")
    );
  });

  on("on-modal-feed-options-add-clicked", (name, url) => {
    if (url) {
      g_favorites.push({ name, url });
      sendIpcToRenderer("on-favorite-feed-added", g_favorites, name, url);
    } else {
      log.error("Tried to add a feed with no url");
    }
  });

  on("on-modal-feed-options-remove-clicked", (feedIndex, feedUrl) => {
    if (g_favorites[feedIndex].url === feedUrl) {
      sendIpcToRenderer(
        "show-modal-feed-remove-from-favorites",
        feedIndex,
        feedUrl,
        _("tool-rss-remove-from-favorites"),
        _("tool-rss-remove-from-favorites-warning"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to remove a feed with not matching index and url");
    }
  });

  on("on-modal-feed-options-remove-ok-clicked", (feedIndex, feedUrl) => {
    g_favorites.splice(feedIndex, 1);
    sendIpcToRenderer("on-favorite-feed-removed", g_favorites, feedIndex);
  });

  on("on-modal-feed-options-edit-name-clicked", (feedIndex, feedUrl) => {
    if (g_favorites[feedIndex].url === feedUrl) {
      let feedName = g_favorites[feedIndex].name;
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
    let feedName = g_favorites[feedIndex].name;
    if (newName && newName !== feedName) {
      g_favorites[feedIndex].name = newName;
      sendIpcToRenderer(
        "on-favorite-feed-name-updated",
        g_favorites,
        feedIndex
      );
    }
  });

  on("on-modal-feed-options-edit-url-clicked", (feedIndex, feedUrl) => {
    if (g_favorites[feedIndex].url === feedUrl) {
      let feedUrl = g_favorites[feedIndex].url;
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
    let feedUrl = g_favorites[feedIndex].url;
    if (newUrl && newUrl !== feedUrl) {
      g_favorites[feedIndex].url = newUrl;
      sendIpcToRenderer("on-favorite-feed-url-updated", g_favorites, feedIndex);
    }
  });

  on("on-modal-feed-options-move-clicked", (feedIndex, feedUrl, dir) => {
    if (g_favorites[feedIndex].url === feedUrl) {
      if (dir == 0) {
        // up
        if (feedIndex > 0) {
          let temp = g_favorites[feedIndex - 1];
          g_favorites[feedIndex - 1] = g_favorites[feedIndex];
          g_favorites[feedIndex] = temp;
          sendIpcToRenderer(
            "on-favorite-feeds-moved",
            g_favorites,
            feedIndex,
            feedIndex - 1
          );
        }
      } else if (dir == 1) {
        // down
        if (feedIndex < g_favorites.length - 1) {
          let temp = g_favorites[feedIndex + 1];
          g_favorites[feedIndex + 1] = g_favorites[feedIndex];
          g_favorites[feedIndex] = temp;
          sendIpcToRenderer(
            "on-favorite-feeds-moved",
            g_favorites,
            feedIndex,
            feedIndex + 1
          );
        }
      }
    } else {
      log.error("Tried to move a feed with not matching index and url");
    }
  });

  on("on-modal-feed-options-open-url-browser-clicked", (url) => {
    utils.openURLInBrowser(url);
  });

  ////

  on("search", async (text, type) => {
    if (type === "podcasts") {
      // Podcasts
      // ref: https://performance-partners.apple.com/search-api
      // ref: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
      try {
        if (text.trim().length === 0) {
          throw "query's text is empty";
        }
        const axios = require("axios").default;
        let searchQuery = encodeURIComponent(text);
        const response = await axios.get(
          `https://itunes.apple.com/search?entity=podcast&limit=200&term=${searchQuery}`,
          { timeout: 10000 }
        );
        sendIpcToRenderer("update-results", type, response.data.results);
      } catch (error) {
        log.error(error);
        sendIpcToRenderer("update-results", type, undefined);
      }
    } else {
      // Websites
      // ref: https://feedsearch.dev/api/v1/search?url=arstechnica.com
      try {
        if (text.trim().length === 0) {
          throw "query's text is empty";
        }
        const axios = require("axios").default;
        let searchQuery = encodeURIComponent(text);
        const response = await axios.get(
          `https://feedsearch.dev/api/v1/search?url=${searchQuery}`,
          { timeout: 10000 }
        );
        sendIpcToRenderer("update-results", type, response.data);
      } catch (error) {
        log.error(error);
        sendIpcToRenderer("update-results", type, undefined);
      }
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

async function openFeedURL(url, switchToContent) {
  if (url && url !== " ") {
    const feedData = await getFeedContent(url);
    if (feedData) {
      let favoritesIndex = -1;
      for (let index = 0; index < g_favorites.length; index++) {
        const feed = g_favorites[index];
        if (feed.url === url) {
          favoritesIndex = index;
          break;
        }
      }
      sendIpcToRenderer(
        "load-feed-content",
        feedData,
        favoritesIndex,
        switchToContent
      );
      return;
    }
  }
  sendIpcToRenderer(
    "show-modal-info",
    _("tool-shared-modal-title-error"),
    _("tool-rss-feed-error"),
    _("ui-modal-prompt-button-ok")
  );
}

async function getFeedContent(url) {
  try {
    const response = await axios.get(url, { timeout: 15000 });
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
    let data = parser.parse(response.data);
    ///////////
    let content = {};
    if (data) {
      // RSS //////////
      if (data.rss && data.rss.channel && data.rss.channel.item) {
        log.editor("RSS feed");
        content.url = url;
        content.name = data.rss.channel.title
          ? data.rss.channel.title
          : "RSS Feed";
        content.link = data.rss.channel.link
          ? data.rss.channel.link
          : undefined;
        if (data.rss.channel.description) {
          if (data.rss.channel.description["#text"]) {
            content.description = sanitizeHtml(
              data.rss.channel.description["#text"],
              {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
              }
            );
          } else {
            content.description = sanitizeHtml(data.rss.channel.description, {
              allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
            });
          }
        }
        content.items = [];
        data.rss.channel.item.forEach((item, index) => {
          let itemData = {};
          itemData.title = item.title;
          itemData.link = item.link;
          if (item.pubDate) {
            let date = new Date(item.pubDate);
            itemData.date = date.toLocaleString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          }
          if (item.enclosure && item.enclosure["@_url"]) {
            itemData.enclosureUrl = item.enclosure["@_url"];
          }
          itemData.description = item.description;
          if (itemData.description) {
            itemData.description = sanitizeHtml(itemData.description, {
              allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
            });
          }
          if (item["content:encoded"]) {
            itemData.contentEncoded = sanitizeHtml(item["content:encoded"], {
              allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
            });
          }
          content.items.push(itemData);
        });
        return content;
      }
      // ATOM //////////
      else {
        if (data.feed && data.feed.entry) {
          log.editor("Atom feed");
          content.url = url;
          if (data.feed.title) {
            if (data.feed.title["#text"]) {
              content.name = data.feed.title["#text"];
            } else {
              content.name = data.feed.title;
            }
          } else {
            content.name = "Atom Feed";
          }
          if (data.feed.subtitle) {
            if (data.feed.subtitle["#text"]) {
              content.description = data.feed.subtitle["#text"];
            } else {
              content.description = data.feed.subtitle;
            }
          } else {
            content.description = "";
          }
          if (data.feed.link) {
            if (Array.isArray(data.feed.link)) {
              for (let index = 0; index < data.feed.link.length; index++) {
                const link = data.feed.link[index];
                if (link["@_href"]) {
                  content.link = link["@_href"];
                  if (link["@_rel"] == undefined) break;
                }
              }
            } else {
              content.link = data.feed.link["@_href"];
            }
          }

          content.items = [];
          data.feed.entry.forEach((item, index) => {
            let itemData = {};

            if (item.title) {
              if (item.title["#text"]) {
                itemData.title = item.title["#text"];
              } else {
                itemData.title = item.title;
              }
            }

            if (item.link) {
              if (Array.isArray(item.link)) {
                for (let index = 0; index < item.link.length; index++) {
                  const link = item.link[index];
                  if (link["@_href"]) {
                    itemData.link = link["@_href"];
                    if (link["@_rel"] == "alternate") break;
                  }
                }
              } else {
                itemData.link = item.link["@_href"];
              }
            }

            if (item.updated) {
              let date = new Date(item.updated);
              itemData.date = date.toLocaleString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              });
            }
            itemData.description = item.content["#text"];
            if (itemData.description) {
              itemData.description = sanitizeHtml(itemData.description, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
              });
            }
            content.items.push(itemData);
          });
          return content;
        }
      }
    }
    //////////
    return undefined;
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
      text: _("menu-tools-rss-reader").toUpperCase(),
    },
    {
      id: "tool-rss-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-rss-add-button-text",
      text: _("tool-shared-tab-openurl").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-reset-favorites-button-text",
      text: _("tool-shared-ui-reset-list").toUpperCase(),
    },
    {
      id: "tool-rss-clear-favorites-button-text",
      text: _("tool-shared-ui-clear-list").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-section-0-text",
      text: _("tool-rss-favorites"),
    },
    {
      id: "tool-rss-section-1-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-rss-section-2-text",
      text: _("tool-rss-feed-content"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-favorites-text",
      text: _("tool-rss-favorites"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-rss-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-rss-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-rss-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
  ];
}

function getExtraLocalization() {
  return {
    edit: _("ui-modal-prompt-button-edit"),
    editName: _("ui-modal-prompt-button-edit-name"),
    reload: _("tool-shared-ui-reload"),
    addToFavorites: _("tool-rss-add-to-favorites"),
    removeFromFavorites: _("tool-rss-remove-from-favorites"),
    // remove: _("tool-shared-tooltip-remove-from-list"),
    moreOptions: _("tool-shared-tab-moreoptions"),
    feedError: _("tool-rss-feed-error"),
    openInBrowser: _("tool-shared-ui-search-item-open-browser"),
    loadingTitle: _("tool-shared-modal-title-loading"),

    openInAudioPlayer: _("ui-modal-prompt-button-open-in-audioplayer"),
    cancel: _("tool-shared-ui-cancel"),
    addToPlaylist: _("ui-modal-prompt-button-add-to-playlist"),
    startPlaylist: _("ui-modal-prompt-button-start-new-playlist"),
    // content
    noContent: _("tool-rss-no-content-message"),
    // favorites
    options: _("tool-shared-tab-options"),
    open: _("ui-modal-prompt-button-open"),
    back: _("tool-shared-ui-back"),
    removeFromList: _("tool-shared-tooltip-remove-from-list"),
    // _("ui-modal-prompt-button-edit-name"),
    // _("ui-modal-prompt-button-edit-url"),
    moveUpInList: _("tool-shared-tooltip-move-up-in-list"),
    moveDownInList: _("tool-shared-tooltip-move-down-in-list"),
    // search
    searching: _("tool-shared-modal-title-searching"),
    searchNoResults: _("tool-shared-ui-search-nothing-found"),
    searchType1: _("tool-rss-search-type-podcasts"),
    searchType2: _("tool-rss-search-type-websites"),
    searchPlaceholderType1: _(
      "tool-rss-search-type-podcasts-placeholder",
      "comic books"
    ),
    searchPlaceholderType2: _(
      "tool-rss-search-type-websites-placeholder",
      "binarynonsense.com"
    ),
  };
}
