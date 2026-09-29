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
let g_servers = [];

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
    ////
    server.setIpcs(sendIpcToRenderer);
  }
}

exports.open = async function () {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();
  //////////////////
  let loadedOptions = settings.loadToolOptions("tool-komga");
  if (
    loadedOptions &&
    loadedOptions.servers &&
    Array.isArray(loadedOptions.servers)
  ) {
    g_servers = [];
    loadedOptions.servers.forEach((server) => {
      if (typeof server == "object" && server.constructor == Object) {
        if (server.url && typeof server.url === "string") {
          if (!server.name || typeof server.name !== "string")
            server.name = "???";
          g_servers.push(server);
        }
      }
    });
  } else {
    g_servers = [];
  }
  ///////////////////
  sendIpcToRenderer("show", 0, g_servers);
};

function saveSettings() {
  let options = {};
  options.feeds = g_servers;
  settings.updateToolOptions("tool-komga", options);
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

  on("open-book", (comicData, pageNum) => {
    comicData.url = server.getUrl() + "/book/" + comicData.comicId;
    comicData.serverUrl = server.getUrl();
    reader.openBookFromCallback(comicData, getPageCallback, pageNum - 1);
    onCloseClicked();
  });

  on("open-url-in-browser", (url) => {
    appUtils.openURLInBrowser(url);
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

  on("on-open-server-url-clicked", () => {
    const defaults = { url: "", email: "", password: "" };
    // TODO: TEMP!!! testing ///////////////////////////
    const komgaTxtPath = (absoluteFilePath = path.resolve(
      appUtils.getExeFolderPath(),
      "wip_komga.txt",
    ));
    if (fs.existsSync(komgaTxtPath)) {
      const content = fs.readFileSync(komgaTxtPath, "utf-8");
      const loginData = content.split(/\r?\n/);
      defaults.url = loginData[0];
      defaults.email = loginData[1];
      defaults.password = loginData[2];
    }
    /////////////
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

  on("on-modal-open-server-url-ok-clicked", async (data) => {
    const session = server.getSession();
    if (
      session.url === data.url &&
      session.email === data.email &&
      data.password === data.password
    ) {
      log.test("already logged as that user, skipping login");
      sendIpcToRenderer("show-modal-loading");
      showLibraries();
      return;
    }

    const result = await server.login(data.url, data.email, data.password);
    if (result.success) {
      if (data.save) {
        /////////
        // TODO: save in servers list
        let encodedPassword = "";
        if (safeStorage.isEncryptionAvailable()) {
          encodedPassword = safeStorage
            .encryptString(data.password)
            .toString("hex");
          log.test(encodedPassword);
          // log.test(safeStorage.decryptString(Buffer.from(encodedPassword, "hex")));
        } else {
          // can't encrypt -> don't save
          log.error("encryption NOT available!!");
        }
        /////////
      }
      sendIpcToRenderer("show-modal-loading");
      showLibraries();
    } else {
      log.error(result.error);
      sendIpcToRenderer(
        "show-modal-info",
        _("tool-shared-modal-title-error"),
        _("tool-shared-ui-search-network-error", data.url) +
          "\n\n" +
          result.error,
        _("ui-modal-prompt-button-ok"),
      );
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

////////////////////////////////////////////

let g_goBackHistory = [];

async function showLibraries() {
  const response = await server.getLibraries();
  sendIpcToRenderer("render-libraries", response);
  g_goBackHistory = [];
  g_goBackHistory.push(["render-libraries", response]);
  g_goBackHistory.push(["render-libraries", response]);
  g_goBackCurrentParams = ["render-libraries", response];
}

async function showSeriesInLibrary(libraryId, pageIndex = 0) {
  const response = await server.getSeriesInLibrary(libraryId, pageIndex);
  sendIpcToRenderer("render-series-in-library", libraryId, response);
  if (
    g_goBackHistory.length === 0 ||
    g_goBackHistory.at(-1)[0] !== "render-series-in-library"
  ) {
    g_goBackHistory.push(["render-series-in-library", libraryId, response]);
  }
}

async function showBooksInSeries(seriesId, pageIndex = 0) {
  const response = await server.getBooksInSeries(seriesId, pageIndex);
  sendIpcToRenderer("render-books-in-series", seriesId, response);
  if (
    g_goBackHistory.length === 0 ||
    g_goBackHistory.at(-1)[0] !== "render-books-in-series"
  ) {
    g_goBackHistory.push(["render-books-in-series", seriesId, response]);
  }
}

async function showBook(id) {
  const response = await server.getBook(id);
  sendIpcToRenderer("render-book", response);
  if (
    g_goBackHistory.length === 0 ||
    g_goBackHistory.at(-1)[0] !== "render-book"
  ) {
    g_goBackHistory.push(["render-book", response]);
  }
}

function goBack() {
  g_goBackHistory.pop();
  sendIpcToRenderer(...g_goBackHistory.at(-1));
}

////////////////////////////////////////////

async function getPageCallback(pageNumber, fileData) {
  try {
    const response = await server.loadPageImageBuffer(
      fileData.data.comicId,
      pageNumber,
    );
    return {
      pageImgBuffer: response.buffer,
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
  sendIpcToRenderer(
    "update-localization",
    localization.getLocalization(),
    localization.getExtraLocalization(),
  );
}
exports.updateLocalizedText = updateLocalizedText;
