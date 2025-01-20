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
const shell = require("electron").shell;
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");
const log = require("../../shared/main/logger");
const axios = require("axios").default;
const sanitizeHtml = require("sanitize-html");
const { link } = require("pdfkit");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

let g_defaultFeeds = [
  {
    name: "CBR Comic News",
    url: "https://www.cbr.com/feed/category/comics/news/",
  },
  {
    name: "r/comicbooks",
    url: "https://old.reddit.com/r/comicbooks/.rss", // atom
  },
  {
    name: "ComicList: Shipping This Week",
    url: "http://feeds.feedburner.com/ncrl", // atom
  },
  {
    name: "xkcd.com",
    url: "https://xkcd.com/rss.xml",
  },
  // {
  //   name: "Comics and graphic novels | The Guardian",
  //   url: "https://www.theguardian.com/books/comics/rss",
  // },
  // {
  //   name: "Blog | Binary Nonsense",
  //   url: "http://blog.binarynonsense.com/feed.xml", // atom
  // },
  {
    name: "ACBR Release Notes",
    url: "https://github.com/binarynonsense/comic-book-reader/releases.atom",
  }, // atom
];

let g_feeds = {};

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

  // TODO: load feeds from settings
  if (true) {
    g_feeds = structuredClone(g_defaultFeeds);
    if (core.isDev() && !core.isRelease()) {
      g_feeds.unshift({
        name: "Bad Feed",
        url: "xfr",
      });
    }
  } else {
  }
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
    const feedData = await getFeedContent(g_feeds[index].url);
    sendIpcToRenderer("show-feed-content", feedData);
  });

  on("open-url-in-browser", (url) => {
    shell.openExternal(url);
  });

  //////////////////

  on("on-add-feed-clicked", () => {
    sendIpcToRenderer(
      "show-modal-add-feed",
      "URL",
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel")
    );
  });

  on("on-modal-add-feed-ok-clicked", async (url) => {
    if (url && url !== " ") {
      const data = await getFeedContent(url);
      if (data) {
        g_feeds.push({
          name: data.name,
          url,
        });
        sendIpcToRenderer("update-feeds", g_feeds, g_feeds.length - 1);
        return;
      }
    }
    sendIpcToRenderer(
      "show-modal-info",
      _("tool-shared-modal-title-error"),
      _("tool-rss-feed-error"),
      _("ui-modal-prompt-button-ok")
    );
  });

  on("on-reset-feeds-clicked", () => {
    sendIpcToRenderer(
      "show-modal-reset-feeds",
      _("tool-shared-modal-title-warning"),
      _("tool-rss-reset-feeds-warning"),
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel")
    );
  });

  on("on-modal-reset-feeds-ok-clicked", () => {
    g_feeds = structuredClone(g_defaultFeeds);
    sendIpcToRenderer("update-feeds", g_feeds, 0);
  });

  //////////////////

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

  on("on-modal-feed-options-remove-clicked", (feedIndex, feedUrl) => {
    if (g_feeds[feedIndex].url === feedUrl) {
      sendIpcToRenderer(
        "show-modal-feed-remove",
        feedIndex,
        feedUrl,
        _("tool-rss-remove-feed"),
        _("tool-rss-remove-feed-warning"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to remove a feed with not matching index and url");
    }
  });

  on("on-modal-feed-options-remove-ok-clicked", (feedIndex, feedUrl) => {
    g_feeds.splice(feedIndex, 1);
    sendIpcToRenderer("update-feeds", g_feeds, feedIndex);
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

  on("on-modal-feed-options-move-clicked", (feedIndex, feedUrl, dir) => {
    if (g_feeds[feedIndex].url === feedUrl) {
      if (dir == 0) {
        // up
        if (feedIndex > 0) {
          let temp = g_feeds[feedIndex - 1];
          g_feeds[feedIndex - 1] = g_feeds[feedIndex];
          g_feeds[feedIndex] = temp;
          sendIpcToRenderer("update-feeds", g_feeds, feedIndex - 1);
        }
      } else if (dir == 1) {
        // down
        if (feedIndex < g_feeds.length - 1) {
          let temp = g_feeds[feedIndex + 1];
          g_feeds[feedIndex + 1] = g_feeds[feedIndex];
          g_feeds[feedIndex] = temp;
          sendIpcToRenderer("update-feeds", g_feeds, feedIndex + 1);
        }
      }
    } else {
      log.error("Tried to move a feed with not matching index and url");
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
        content.url = url;
        content.name = data.rss.channel.title
          ? data.rss.channel.title
          : "RSS Feed";
        content.description = data.rss.channel.description;
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
            itemData.enclosureImgUrl = item.enclosure["@_url"];
          }
          itemData.description = item.description;
          if (itemData.description) {
            itemData.description = sanitizeHtml(itemData.description, {
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
    {
      id: "tool-rss-reset-button-text",
      text: _("tool-rss-reset-feeds").toUpperCase(),
    },
    //////////////////////////////////////////////
  ];
}

function getExtraLocalization() {
  return {
    edit: _("ui-modal-prompt-button-edit"),
    options: _("tool-shared-tab-options"),
    feedError: _("tool-rss-feed-error"),
    openInBrowser: _("tool-shared-ui-search-item-open-browser"),
    loadingTitle: _("tool-shared-modal-title-loading"),
  };
}
