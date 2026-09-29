/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");
const { safeStorage } = require("electron");

const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const reader = require("../../reader/main");
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");
const appUtils = require("../../shared/main/app-utils");
const settings = require("../../shared/main/settings");
const localization = require("./main/localization");
const log = require("../../shared/main/logger");

const server = require("./server");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_servers;
let g_goBackHistory = [];

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
    ////
    server.setIpcs(sendIpcToRenderer);
  }
}

function loadOptions() {
  let loadedOptions = settings.loadToolOptions("tool-komga");
  if (
    loadedOptions &&
    loadedOptions.servers &&
    Array.isArray(loadedOptions.servers)
  ) {
    g_servers = [];
    loadedOptions.servers.forEach((server) => {
      // TODO: proper error checking and fixes
      if (typeof server == "object" && server.constructor == Object) {
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
  sendIpcToRenderer("show", 0, g_servers);
  if (g_goBackHistory.length > 0) {
    sendIpcToRenderer(...g_goBackHistory.at(-1));
  }
};

function saveSettings() {
  let options = {};
  options.servers = g_servers;
  settings.updateToolOptions("tool-komga", options);
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
  return _("tool-komga-title");
};

function onCloseClicked() {
  tools.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-komga", ...args);
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
    comicData.url = server.getUrl() + "/book/" + comicData.comicId;
    comicData.serverUrl = server.getUrl();
    reader.openBookFromServer(comicData, pageNumber - 1);
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
        _("tool-komga-remove-server-from-list"),
        _("tool-komga-remove-server-from-list-warning"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel"),
      );
    } else {
      log.error("index out of bounds");
    }
  });

  on("on-modal-remove-server-from-list-ok-clicked", async (index) => {
    g_servers.splice(index, 1);
    sendIpcToRenderer("build-servers", g_servers);
  });

  //////////////////

  on("download-book", async (bookId, name) => {
    await server.downloadBook(bookId, name ?? "book");
  });

  //////////////////

  on("show-libraries", async (...args) => {
    await showLibraries(...args);
  });

  on("show-series-in-library", async (...args) => {
    await showSeriesInLibrary(...args);
  });

  on("show-books-in-series", async (...args) => {
    await showBooksInSeries(...args);
  });

  on("get-books-thumbs", async (ids) => {
    server.loadBooksThumbs(ids);
  });

  on("get-series-thumbs", async (ids) => {
    server.loadSeriesThumbs(ids);
  });

  on("show-book", async (...args) => {
    await showBook(...args);
  });

  on("go-back", (...args) => {
    goBack(...args);
  });

  //////////////////

  on("on-connect-button-clicked", () => {
    const defaults = { url: "", email: "", password: "" };
    // TODO: save last accessed and used that for defaults?
    sendIpcToRenderer(
      "show-modal-login",
      _("tool-komga-modal-connect-to-server"),
      "URL",
      _("tool-komga-modal-email"),
      _("tool-shared-ui-creation-password"),
      _("tool-komga-modal-remember"),
      _("tool-komga-button-connect"),
      _("ui-modal-prompt-button-cancel"),
      defaults,
    );
  });

  on("on-modal-connect-ok-clicked", async (data) => {
    logToServer(data.url, data.email, data.password, data.save);
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

exports.getSavedServerDataFromUrl = function (url) {
  if (!g_servers) loadOptions();
  const index = g_servers.findIndex((server) => server.url === url);
  if (index >= 0) {
    if (safeStorage.isEncryptionAvailable()) {
      const data = g_servers[index];
      const password = safeStorage.decryptString(
        Buffer.from(data.encodedPassword, "hex"),
      );
      return { url: data.url, email: data.email, password };
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
      const password = safeStorage.decryptString(
        Buffer.from(data.encodedPassword, "hex"),
      );
      logToServer(data.url, data.email, password, false);
    } else {
      log.error("encryption NOT available!!");
    }
  } else {
    log.error("index out of bounds");
  }
}
exports.connectToServerInList = connectToServerInList;

async function logToServer(url, email, password, save) {
  const session = server.getSession();
  if (
    session.url === url &&
    session.email === email &&
    session.password === password
  ) {
    log.editor("already logged as that user, skipping login");
  } else {
    const result = await server.login(url, email, password);
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
  if (save) {
    let encodedPassword = "";
    if (safeStorage.isEncryptionAvailable()) {
      encodedPassword = safeStorage.encryptString(password).toString("hex");
      const existingServer = g_servers.find(
        (server) => server.url === url && server.email === email,
      );
      if (existingServer) {
        // just in case
        existingServer.encodedPassword = encodedPassword;
      } else {
        g_servers.push({
          url,
          email,
          encodedPassword,
        });
      }
      sendIpcToRenderer("build-servers", g_servers);
    } else {
      // can't encrypt -> don't save
      log.error("encryption NOT available!!");
    }
  }
  sendIpcToRenderer("show-modal-loading");
  showLibraries();
}

////////////////////////////////////////////

async function showLibraries() {
  const response = await server.getLibraries();
  sendIpcToRenderer("build-content-libraries", response);
  g_goBackHistory = [];
  g_goBackHistory.push(["build-content-libraries", response]);
  g_goBackHistory.push(["build-content-libraries", response]);
  g_goBackCurrentParams = ["build-content-libraries", response];
}

async function showSeriesInLibrary(libraryId, pageIndex = 0) {
  const response = await server.getSeriesInLibrary(libraryId, pageIndex);
  sendIpcToRenderer("build-content-series-in-library", libraryId, response);
  if (
    g_goBackHistory.length === 0 ||
    g_goBackHistory.at(-1)[0] !== "build-content-series-in-library"
  ) {
    g_goBackHistory.push([
      "build-content-series-in-library",
      libraryId,
      response,
    ]);
  }
}

async function showBooksInSeries(seriesId, pageIndex = 0) {
  const response = await server.getBooksInSeries(seriesId, pageIndex);
  sendIpcToRenderer("build-content-books-in-series", seriesId, response);
  if (
    g_goBackHistory.length === 0 ||
    g_goBackHistory.at(-1)[0] !== "build-content-books-in-series"
  ) {
    g_goBackHistory.push(["build-content-books-in-series", seriesId, response]);
  }
}

async function showBook(id) {
  const response = await server.getBook(id);
  sendIpcToRenderer("build-content-book", response);
  if (
    g_goBackHistory.length === 0 ||
    g_goBackHistory.at(-1)[0] !== "build-content-book"
  ) {
    g_goBackHistory.push(["build-content-book", response]);
  }
}

function goBack() {
  g_goBackHistory.pop();
  sendIpcToRenderer(...g_goBackHistory.at(-1));
}

////////////////////////////////////////////

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
