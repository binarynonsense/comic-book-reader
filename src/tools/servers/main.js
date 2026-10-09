/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");
const { safeStorage } = require("electron");

const core = require("../../core/main.js");
const { _ } = require("../../shared/main/i18n.js");
const reader = require("../../reader/main.js");
const contextMenu = require("../../shared/main/tools-menu-context.js");
const tools = require("../../shared/main/tools.js");
const appUtils = require("../../shared/main/app-utils.js");
const settings = require("../../shared/main/settings.js");
const localization = require("./main/localization.js");
const log = require("../../shared/main/logger.js");

const komga = require("./komga.js");
const kavita = require("./kavita.js");
const { Section } = require("./constants.js");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_servers;
let g_server;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
    ////
    komga.setIpcs(sendIpcToRenderer);
    kavita.setIpcs(sendIpcToRenderer);
    g_server = komga;
  }
}

function loadOptions() {
  let loadedOptions = settings.loadToolOptions("tool-servers");
  if (
    loadedOptions &&
    loadedOptions.servers &&
    Array.isArray(loadedOptions.servers)
  ) {
    g_servers = [];
    loadedOptions.servers.forEach((server) => {
      // TODO: proper error checking and fixes
      if (typeof server == "object" && server.constructor == Object) {
        if (!server.type) server.type = "komga";
        if (server.url && typeof server.url === "string") {
          // if (!server.name || typeof server.name !== "string")
          //   server.name = "???";
          g_servers.push(server);
        }
      }
    });
  } else {
    g_servers = [];
  }
}

exports.open = async function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();
  //////////////////
  loadOptions();
  ///////////////////
  sendIpcToRenderer("show", 0, getUIServersList());
  if (g_navState.section) {
    loadState(g_navState);
  }
};

function saveSettings() {
  let options = {};
  options.servers = g_servers;
  settings.updateToolOptions("tool-servers", options);
}

exports.close = function () {
  // called by switchTool when closing tool
  saveSettings();
  sendIpcToRenderer("close-active-modal");
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
  return _("tool-servers-title-alt");
};

function onCloseClicked() {
  tools.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-servers", ...args);
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

  on("open-book", (comicData, pageNumber) => {
    comicData.source = g_server.getType();
    if (g_server.getType() === "komga") {
      comicData.url = g_server.getUrl() + "/book/" + comicData.comicId;
    } else {
      // don't know of a real url i could use only from the chapterid
      comicData.url = g_server.getUrl() + "::chapter-" + comicData.comicId;
      {
        const { series, volume, book } = g_navState || {};
        const navNames = [series?.name, volume?.name, book?.name].filter(
          (item) => {
            return item; // returns item when if(item) is true
          },
        );
        comicData.name = navNames.join(" - ");
      }
    }
    comicData.serverUrl = g_server.getUrl();
    // reader.openBookFromServer(
    //   comicData,
    //   pageNumber ? pageNumber - 1 : undefined,
    // );
    const { FileDataType } = require("../../shared/main/constants");
    reader.tryOpen("", FileDataType.WWW, { data: comicData });
    onCloseClicked();
  });

  on("open-url-in-browser", (url) => {
    appUtils.openURLInBrowser(url);
  });

  //////////////////

  on("connect-to-server-in-list", async (...args) => {
    connectToServerInList(...args);
  });

  on("remove-server-from-list-request", async (index, refData) => {
    // TODO: check refData to make sure it's the same
    if (index >= 0 && index < g_servers.length) {
      const data = g_servers[index];
      sendIpcToRenderer(
        "show-modal-remove-server-from-list-warning",
        index,
        _("tool-servers-remove-server-from-list"),
        _("tool-servers-remove-server-from-list-warning"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel"),
      );
    } else {
      log.error("index out of bounds");
    }
  });

  on("on-modal-remove-server-from-list-ok-clicked", async (index) => {
    g_servers.splice(index, 1);
    sendIpcToRenderer("build-servers", getUIServersList());
  });

  on("on-server-in-list-move-clicked", (index, dir) => {
    if (dir == 0) {
      // up
      if (index > 0) {
        let temp = g_servers[index - 1];
        g_servers[index - 1] = g_servers[index];
        g_servers[index] = temp;
        sendIpcToRenderer("build-servers", getUIServersList());
      }
    } else if (dir == 1) {
      // down
      if (index < g_servers.length - 1) {
        let temp = g_servers[index + 1];
        g_servers[index + 1] = g_servers[index];
        g_servers[index] = temp;
        sendIpcToRenderer("build-servers", getUIServersList());
      }
    }
  });

  //////////////////

  on("download-book", async (bookId, name) => {
    await g_server.downloadBook(bookId, name ?? "book");
  });

  on("cancel-download-book", async () => {
    g_server.cancelDownloadBook();
  });

  //////////////////

  on("show-libraries", async (...args) => {
    await showLibraries(...args);
  });

  on("show-series-in-library", async (...args) => {
    await showSeriesInLibrary(...args);
  });

  on("show-volumes-in-series", async (...args) => {
    await showVolumesInSeries(...args);
  });

  on("show-books-in-series", async (...args) => {
    if (g_server.getType() === "komga") {
      await showBooksInSeries(...args);
    } else {
      await showVolumesInSeries(...args);
    }
  });

  on("show-books-in-volume", async (...args) => {
    await showBooksInVolume(...args);
  });

  on("show-book", async (...args) => {
    await showBook(...args);
  });

  /////////////////

  on("get-thumbs", async (bookIds, seriesIds) => {
    g_server.loadThumbs(bookIds, seriesIds);
  });

  on("get-books-thumbs", async (ids) => {
    g_server.loadThumbs(ids, undefined, undefined);
  });

  on("get-series-thumbs", async (ids) => {
    g_server.loadThumbs(undefined, ids, undefined);
  });

  on("get-volumes-thumbs", async (ids) => {
    g_server.loadThumbs(undefined, undefined, ids);
  });

  /////////////////

  on("show-books-in-search", async (...args) => {
    await showBooksInSearch(...args);
  });

  on("show-series-in-search", async (...args) => {
    await showSeriesInSearch(...args);
  });

  /////////////////

  on("show-books-in-keepreading", async (...args) => {
    await showBooksInKeepReading(...args);
  });

  on("show-books-in-recentbooks", async (...args) => {
    await showBooksInRecentBooks(...args);
  });

  on("show-series-in-recentseries", async (...args) => {
    await showSeriesInRecentSeries(...args);
  });

  on("show-series-in-updatedseries", async (...args) => {
    await showSeriesInUpdatedSeries(...args);
  });

  on("show-series-in-ondeckseries", async (...args) => {
    await showSeriesInOnDeckSeries(...args);
  });

  on("show-series-in-wanttoreadseries", async (...args) => {
    await showSeriesInWantToReadSeries(...args);
  });

  /////////////////

  on("on-nav-button-clicked", (...args) => {
    navButtonClicked(...args);
  });

  on("on-modal-search-ok-clicked", (...args) => {
    search(...args);
  });

  //////////////////

  on("on-connect-button-clicked", () => {
    const defaults = {};
    // TODO: save last accessed and used that for defaults?
    sendIpcToRenderer(
      "show-modal-login",
      _("tool-servers-modal-connect-to-server"),
      "URL",
      _("tool-servers-modal-server-type"),
      _("tool-servers-modal-credentials-type"),
      "API Key",
      _("tool-servers-modal-credentials-type-password"),
      _("tool-servers-modal-credentials-type-password-2"),
      "API Key",
      _("tool-servers-modal-username"),
      _("tool-servers-modal-email"),
      _("tool-shared-ui-creation-password"),
      true,
      _("tool-servers-modal-remember"),
      _("tool-servers-button-connect"),
      _("ui-modal-prompt-button-cancel"),
      defaults,
    );
  });

  on("on-modal-connect-ok-clicked", async (data) => {
    logToServer(
      data.type,
      data.url,
      data.apiKey,
      data.username,
      data.email,
      data.password,
      data.save,
    );
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
// SERVERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.getSavedServerDataFromUrl = function (url) {
  if (!g_servers) loadOptions();
  const index = g_servers.findIndex((server) => server.url === url);
  if (index >= 0) {
    if (safeStorage.isEncryptionAvailable()) {
      const data = g_servers[index];
      if (data.encodedApiKey) {
        const apiKey = safeStorage.decryptString(
          Buffer.from(data.encodedApiKey, "hex"),
        );
        return { url: data.url, apiKey };
      } else {
        const password = safeStorage.decryptString(
          Buffer.from(data.encodedPassword, "hex"),
        );
        return {
          url: data.url,
          username: data.username,
          email: data.email,
          password,
        };
      }
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
};

async function connectToServerInList(index, refData) {
  // TODO: check refData if any to make sure it's the same
  if (index >= 0 && index < g_servers.length) {
    if (safeStorage.isEncryptionAvailable()) {
      const data = g_servers[index];
      if (data.encodedApiKey) {
        const apiKey = safeStorage.decryptString(
          Buffer.from(data.encodedApiKey, "hex"),
        );
        logToServer(data.type, data.url, apiKey, undefined, undefined, false);
      } else {
        const password = safeStorage.decryptString(
          Buffer.from(data.encodedPassword, "hex"),
        );
        logToServer(
          data.type,
          data.url,
          undefined,
          data.username,
          data.email,
          password,
          false,
        );
      }
    } else {
      log.error("encryption NOT available!!");
    }
  } else {
    log.error("index out of bounds");
  }
}
exports.connectToServerInList = connectToServerInList;

function isSameAsLoggedServer(type, url, apiKey, username, email, password) {
  const session = g_server.getSession();
  if (!session || !session.url) return false;
  if (type === "kavita") {
    if (password) {
      return (
        g_server.getType() === type &&
        session.url === url &&
        session.username === username &&
        session.password === password
      );
    }
    if (apiKey) {
      return session.url === url && session.apiKey === apiKey;
    }
  } else if (type === "komga") {
    if (password) {
      return (
        g_server.getType() === type &&
        session.url === url &&
        session.email === email &&
        session.password === password
      );
    }
    if (apiKey) {
      return session.url === url && session.apiKey === apiKey;
    }
  }
}

async function logToServer(type, url, apiKey, username, email, password, save) {
  let server;
  if (type === "kavita") {
    server = kavita;
  } else {
    server = komga;
  }
  if (isSameAsLoggedServer(type, url, apiKey, username, email, password)) {
    log.editor("[SERVERS] already logged as that user, skipping login");
    sendIpcToRenderer("hide-modal-loading");
    return;
  } else {
    let result;
    if (apiKey) {
      result = await server.login(url, { apiKey });
    } else {
      result = await server.login(url, { username, email, password });
    }
    if (!result.success) {
      log.error(result.error);
      sendIpcToRenderer(
        "show-modal-info",
        _("tool-shared-modal-title-error"),
        _("tool-shared-ui-search-network-error", url) + "\n\n" + result.error,
        _("ui-modal-prompt-button-ok"),
      );
      return;
    }
  }
  g_server = server;
  if (save) {
    if (safeStorage.isEncryptionAvailable()) {
      if (apiKey) {
        let encodedApiKey = "";
        encodedApiKey = safeStorage.encryptString(apiKey).toString("hex");
        const existingServer = g_servers.find(
          (server) =>
            server.url === url && server.encodedApiKey === encodedApiKey,
        );
        if (!existingServer) {
          g_servers.push({
            type,
            url,
            encodedApiKey,
          });
        }
      } else {
        let encodedPassword = "";
        encodedPassword = safeStorage.encryptString(password).toString("hex");
        const existingServer = g_servers.find(
          (server) =>
            (server.type === "komga" &&
              server.url === url &&
              server.email === email) ||
            (server.type === "kavita" &&
              server.url === url &&
              server.username === username),
        );
        if (existingServer) {
          // just in case
          existingServer.encodedPassword = encodedPassword;
        } else {
          g_servers.push({
            type,
            url,
            username,
            email,
            encodedPassword,
          });
        }
      }
    } else {
      // can't encrypt -> don't save
      log.error("encryption NOT available!!");
    }
  }
  const currentFileData = reader.getFileData();
  if (
    currentFileData?.data?.source === "komga" ||
    currentFileData?.data?.source === "kavita"
  ) {
    reader.onMenuCloseFile();
  }
  sendIpcToRenderer("build-servers", getUIServersList());
  sendIpcToRenderer("show-modal-loading");
  showLibraries();
}

function getUIServersList() {
  const servers = g_servers.map((server) => {
    const serverCopy = { ...server };
    if (serverCopy.encodedApiKey) {
      try {
        // decode
        const apiKey = safeStorage.decryptString(
          Buffer.from(serverCopy.encodedApiKey, "hex"),
        );
        // mask
        if (!apiKey || apiKey.length < 8) {
          serverCopy.maskedApiKey = "..."; // too short, offuscate all
        } else {
          const start = apiKey.substring(0, 4);
          const end = apiKey.substring(apiKey.length - 4);
          serverCopy.maskedApiKey = `${start}...${end}`;
        }
      } catch (error) {
        serverCopy.maskedApiKey = "????";
      }
    } else if (serverCopy.email) {
      try {
        const [name, domain] = serverCopy.email.split("@");
        if (!name || !domain) {
          serverCopy.maskedEmail = serverCopy.email;
        } else {
          const visibleLength = name.length > 2 ? 2 : 1;
          const maskedName =
            name.substring(0, visibleLength) +
            "*".repeat(Math.max(3, name.length - visibleLength));
          serverCopy.maskedEmail = `${maskedName}@${domain}`;
        }
      } catch (error) {
        serverCopy.maskedEmail = "????";
      }
    } else if (serverCopy.username) {
      try {
        // TODO: kavita
        serverCopy.maskedEmail = serverCopy.username;
      } catch (error) {
        serverCopy.maskedEmail = "????";
      }
    }
    serverCopy.isSelected = isSameAsLoggedServer(
      serverCopy.type,
      serverCopy.url,
      serverCopy.encodedApiKey
        ? safeStorage.decryptString(
            Buffer.from(serverCopy.encodedApiKey, "hex"),
          )
        : undefined,
      serverCopy.username,
      serverCopy.email,
      serverCopy.encodedPassword
        ? safeStorage.decryptString(
            Buffer.from(serverCopy.encodedPassword, "hex"),
          )
        : undefined,
    );
    return serverCopy;
  });
  return servers;
}

///////////////////////////////////////////////////////////////////////////////
// CONTENT ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_navState = {
  section: undefined,
  library: undefined,
  series: undefined,
  volume: undefined,
  book: undefined,
};
let g_navHistory = [];
function clearNavData() {
  g_navState = {};
  g_navHistory = [];
  log.editor("[SERVERS] cleared nav history");
}
function addCurrentNavStateToHistory() {
  g_navHistory.push(structuredClone(g_navState));
  log.editor(
    "[SERVERS] added state to history: " + g_navHistory.at(-1).section,
  );
}
function removeLastNavStateFromHistory() {
  log.editor(
    "[SERVERS] removed last state from history: " + g_navHistory.at(-1).section,
  );
  return g_navHistory.pop();
}

async function showLibraries() {
  const response = await g_server.getLibraries();
  sendIpcToRenderer("build-content-libraries", response);
  ////
  clearNavData();
  g_navState.section = Section.LIBRARIES;
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showSeriesInLibrary(
  libraryId,
  libraryName,
  letter,
  pageIndex = 0,
) {
  const letters = await g_server.getAlphabeticalGroups(libraryId);
  const series = await g_server.getSeriesInLibrary(
    libraryId,
    letter,
    pageIndex,
  );
  sendIpcToRenderer(
    "build-content-series-in-library",
    libraryId,
    libraryName,
    series,
    letters,
    letter,
  );
  ////
  if (g_navState.section !== Section.LIBRARY_SERIES) {
    addCurrentNavStateToHistory();
  }
  g_navState.section = Section.LIBRARY_SERIES;
  g_navState.library = { id: libraryId, name: libraryName, letter, pageIndex };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showBooksInSeries(
  seriesId,
  seriesName,
  pageIndex = 0,
  altLibraryName = undefined,
) {
  const response = await g_server.getBooksInSeries(seriesId, pageIndex);
  sendIpcToRenderer(
    "build-content-books-in-series",
    seriesId,
    seriesName,
    response,
  );
  ////
  if (g_navState.section !== Section.SERIES_BOOKS) {
    addCurrentNavStateToHistory();
  }
  g_navState.section = Section.SERIES_BOOKS;
  g_navState.series = { id: seriesId, name: seriesName, pageIndex };
  if (altLibraryName) g_navState.library = { name: altLibraryName };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showBooksInVolume(
  volumeId,
  volumeName,
  pageIndex = 0,
  altLibraryName = undefined,
) {
  const response = await g_server.getBooksInVolume(volumeId, pageIndex);
  sendIpcToRenderer(
    "build-content-books-in-volume",
    volumeId,
    volumeName,
    response,
  );
  ////
  if (g_navState.section !== Section.VOLUME_BOOKS) {
    addCurrentNavStateToHistory();
  }
  g_navState.section = Section.VOLUME_BOOKS;
  g_navState.volume = { id: volumeId, name: volumeName, pageIndex };
  if (altLibraryName) g_navState.library = { name: altLibraryName };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showBook(id, name, altLibraryName) {
  const response = await g_server.getBook(id);
  sendIpcToRenderer("build-content-book", response);
  ////
  if (g_navState.section !== Section.BOOK) {
    addCurrentNavStateToHistory();
  }
  g_navState.section = Section.BOOK;
  g_navState.book = { id, name };
  if (altLibraryName) g_navState.library = { name: altLibraryName };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

////// kavita volumes

async function showVolumesInSeries(
  seriesId,
  seriesName,
  pageIndex = 0,
  altLibraryName = undefined,
) {
  const response = await g_server.getVolumesInSeries(seriesId, pageIndex);
  sendIpcToRenderer(
    "build-content-volumes-in-series",
    seriesId,
    seriesName,
    response,
  );
  ////
  if (g_navState.section !== Section.SERIES_VOLUMES) {
    addCurrentNavStateToHistory();
  }
  g_navState.section = Section.SERIES_VOLUMES;
  g_navState.series = { id: seriesId, name: seriesName, pageIndex };
  if (altLibraryName) g_navState.library = { name: altLibraryName };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

////////////////////////////////////////////////////////

async function showBooksInSearch(query, pageIndex = 0) {
  sendIpcToRenderer("show-modal-loading");
  const response = await g_server.getSearchBooks(query, pageIndex);
  sendIpcToRenderer("build-content-search-books", query, response);
  ////
  if (g_navState.section !== Section.SEARCH_BOOKS) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.SEARCH_BOOKS;
  g_navState.search = { query };
  g_navState.series = { pageIndex };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showSeriesInSearch(query, pageIndex = 0) {
  sendIpcToRenderer("show-modal-loading");
  const response = await g_server.getSearchSeries(query, pageIndex);
  sendIpcToRenderer("build-content-search-series", query, response || []);
  ////
  if (g_navState.section !== Section.SEARCH_SERIES) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.SEARCH_SERIES;
  g_navState.search = { query };
  g_navState.library = { pageIndex };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

////////////////////////////////////////////////////////////

async function showActivity() {
  const response = await g_server.getActivity();
  sendIpcToRenderer("build-content-activity", response);
  ////
  if (g_navState.section !== Section.ACTIVITY) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.ACTIVITY;
  g_navState.library = { name: _("tool-servers-section-activity") };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showBooksInKeepReading(pageIndex = 0) {
  const response = await g_server.getInProgressBooks(pageIndex);
  sendIpcToRenderer("build-content-books-in-keepreading", response);
  ////
  if (g_navState.section !== Section.KEEP_READING) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.KEEP_READING;
  g_navState.library = { name: _("tool-servers-subsection-keepreading") };
  g_navState.series = { pageIndex };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showBooksInRecentBooks(pageIndex = 0) {
  const response = await g_server.getRecentlyAddedBooks(pageIndex);
  sendIpcToRenderer("build-content-books-in-recentbooks", response);
  ////
  if (g_navState.section !== Section.RECENT_BOOKS) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.RECENT_BOOKS;
  g_navState.library = {
    name: _("tool-servers-subsection-recentlyaddedbooks"),
  };
  g_navState.series = { pageIndex };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showSeriesInRecentSeries(pageIndex = 0) {
  const response = await g_server.getRecentlyAddedSeries(pageIndex);
  sendIpcToRenderer("build-content-series-in-recentseries", response);
  ////
  if (g_navState.section !== Section.RECENT_SERIES) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.RECENT_SERIES;
  g_navState.library = {
    pageIndex,
    name: _("tool-servers-subsection-recentlyaddedseries"),
  };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showSeriesInUpdatedSeries(pageIndex = 0) {
  const response = await g_server.getRecentlyUpdatedSeries(pageIndex);
  sendIpcToRenderer("build-content-series-in-updatedseries", response);
  ////
  if (g_navState.section !== Section.UPDATED_SERIES) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.UPDATED_SERIES;
  g_navState.library = {
    pageIndex,
    name: _("tool-servers-subsection-recentlyupdatedseries"),
  };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showSeriesInOnDeckSeries(pageIndex = 0) {
  const response = await g_server.getOnDeckSeries(pageIndex);
  sendIpcToRenderer("build-content-series-in-ondeckseries", response);
  ////
  if (g_navState.section !== Section.ON_DECK_SERIES) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.ON_DECK_SERIES;
  g_navState.library = {
    pageIndex,
    name: _("tool-servers-subsection-keepreading"),
  };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

async function showSeriesInWantToReadSeries(pageIndex = 0) {
  const response = await g_server.getWantToReadSeries(pageIndex);
  sendIpcToRenderer("build-content-series-in-wanttoreadseries", response);
  ////
  if (g_navState.section !== Section.WANT_TO_READ_SERIES) {
    addCurrentNavStateToHistory();
  }
  g_navState = {};
  g_navState.section = Section.WANT_TO_READ_SERIES;
  g_navState.library = {
    pageIndex,
    name: _("tool-servers-subsection-wanttoread"),
  };
  sendIpcToRenderer("build-content-navbar", g_navState, g_navHistory.length);
}

///////////////////////////////////////////////////////////////////////////////
// NAVBAR /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function navButtonClicked(buttonName) {
  switch (buttonName) {
    case "back":
      goBack(); //
      break;

    case "libraries":
      showLibraries();
      break;

    case "activity":
      showActivity();
      break;

    case "search":
      sendIpcToRenderer(
        "show-modal-search",
        _("menu-tools-search"),
        undefined,
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel"),
      );
      break;

    default:
      break;
  }
}

async function search(query, selectValue) {
  // 0 -> books, 1 -> series
  if (selectValue === "0") {
    showBooksInSearch(query);
  } else {
    showSeriesInSearch(query);
  }
}

async function goBack() {
  if (g_navHistory.length < 1) return;
  await loadState(removeLastNavStateFromHistory());
}

async function loadState(state) {
  sendIpcToRenderer("show-modal-loading");
  g_navState = state;
  try {
    if (state.section === Section.LIBRARIES) {
      await showLibraries();
    } else if (state.section === Section.LIBRARY_SERIES) {
      await showSeriesInLibrary(
        state.library.id,
        state.library.name,
        state.library.letter,
        state.library.pageIndex,
      );
    } else if (state.section === Section.SERIES_BOOKS) {
      await showBooksInSeries(
        state.series.id,
        state.series.name,
        state.series.pageIndex,
      );
    } else if (state.section === Section.SERIES_VOLUMES) {
      await showVolumesInSeries(
        state.series.id,
        state.series.name,
        state.series.pageIndex,
      );
    } else if (state.section === Section.VOLUME_BOOKS) {
      await showBooksInVolume(
        state.volume.id,
        state.volume.name,
        state.volume.pageIndex,
      );
    } else if (state.section === Section.BOOK) {
      await showBook(state.book.id, state.book.name);
    }
    ////
    else if (state.section === Section.SEARCH_BOOKS) {
      await showBooksInSearch(state.search.query, state.series.pageIndex);
    } else if (state.section === Section.SEARCH_SERIES) {
      await showSeriesInSearch(state.search.query, state.library.pageIndex);
    }
    ////
    else if (state.section === Section.ACTIVITY) {
      await showActivity();
    } else if (state.section === Section.KEEP_READING) {
      await showBooksInKeepReading(state.series.pageIndex);
    } else if (state.section === Section.RECENT_BOOKS) {
      await showBooksInRecentBooks(state.series.pageIndex);
    } else if (state.section === Section.RECENT_SERIES) {
      await showSeriesInRecentSeries(state.library.pageIndex);
    } else if (state.section === Section.UPDATED_SERIES) {
      await showSeriesInUpdatedSeries(state.library.pageIndex);
    } else if (state.section === Section.ON_DECK_SERIES) {
      await showSeriesInOnDeckSeries(state.library.pageIndex);
    } else if (state.section === Section.WANT_TO_READ_SERIES) {
      await showSeriesInWantToReadSeries(state.library.pageIndex);
    }
  } catch (error) {
    log.error(error);
    sendIpcToRenderer("hide-modal-loading");
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
