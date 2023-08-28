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

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
const g_queryPageSize = 50;

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

function onCloseClicked() {
  core.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-librivox", ...args);
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

  on("open", (identifier, fileUrls) => {
    let playlist = {
      id: identifier,
      source: "librivox",
      files: [],
    };
    fileUrls.forEach((url) => {
      playlist.files.push({ url: url, duration: -1 });
    });
    reader.showAudioPlayer(true, false);
    onCloseClicked();
    sendIpcToAudioPlayerRenderer("open-playlist", playlist);
  });

  on("search", async (text, pageNum) => {
    try {
      if (text.trim().length === 0) {
        throw "query's text is empty";
      }
      const axios = require("axios").default;
      let searchQuery = `q=(${encodeURIComponent(text)})`;
      let collectionQuery = `+AND+collection%3A(librivoxaudio)`;
      const response = await axios.get(
        `https://archive.org/advancedsearch.php?${searchQuery}${collectionQuery}+AND+mediatype%3A(audio)&fl[]=identifier&fl[]=title&fl[]=creator&sort[]=&sort[]=&sort[]=&rows=${g_queryPageSize}&page=${pageNum}&output=json`,
        { timeout: 10000 }
      );
      sendIpcToRenderer(
        "update-results",
        response.data,
        _("tool-shared-ui-search-nothing-found"),
        text,
        pageNum,
        g_queryPageSize,
        _("tool-shared-ui-search-item-open-acbr"),
        _("tool-shared-ui-search-item-open-browser")
      );
    } catch (error) {
      // console.error(error);
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

async function getPageCallback(pageNum, fileData) {
  try {
    const axios = require("axios").default;
    let comicData = fileData.data;
    let imgUrl = `https://archive.org/download/${comicData.comicId}/page/n${
      pageNum - 1
    }/mode/1up`;
    const response = await axios.get(imgUrl, {
      timeout: 10000,
      responseType: "arraybuffer",
    });
    let buf = Buffer.from(response.data, "binary");
    let img64 = "data:image/jpg;base64," + buf.toString("base64");
    return { pageImgSrc: img64, pageImgUrl: imgUrl };
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
    _("tool-shared-ui-search-placeholder"),
    _("tool-shared-modal-title-searching"),
    getLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-lvx-title-text",
      text: _("tool-lvx-title").toUpperCase(),
    },
    {
      id: "tool-lvx-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-lvx-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-lvx-section-1-text",
      text: _("tool-shared-tab-about"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-lvx-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-lvx-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-lvx-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-lvx-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-lvx-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-lvx-about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-audiobooks"),
        "LibriVox"
      ),
    },
    {
      id: "tool-lvx-about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-lvx-about-3-text",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "tool-lvx-open-lvx-browser-button-text",
      text: _("tool-lvx-button-open-lvx-browser").toUpperCase(),
    },
    {
      id: "tool-lvx-open-donate-browser-button-text",
      text: _("tool-iab-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-lvx-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
