/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const reader = require("../../reader/main");
const shell = require("electron").shell;

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
  core.sendIpcToRenderer("tool-dcm", ...args);
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
    // ref: https://github.com/electron/electron/blob/main/docs/api/web-contents.md#event-context-menu
    const { selectionText, isEditable } = params;
    const commonEntries = [
      {
        label: _("tool-shared-ui-back-to-reader"),
        click() {
          onCloseClicked();
        },
      },
      {
        label: _("menu-view-togglefullscreen"),
        accelerator: "F11",
        click() {
          core.onMenuToggleFullScreen();
        },
      },
    ];
    if (isEditable && selectionText && selectionText.trim() !== "") {
      Menu.buildFromTemplate([
        { label: _("ctxmenu-copy"), role: "copy" },
        { label: _("ctxmenu-paste"), role: "paste" },
        { type: "separator" },
        { label: _("ctxmenu-select-all"), role: "selectall" },
        { type: "separator" },
        ...commonEntries,
      ]).popup(core.getMainWindow(), params.x, params.y);
    } else if (isEditable) {
      Menu.buildFromTemplate([
        { label: _("ctxmenu-paste"), role: "paste" },
        { type: "separator" },
        { label: _("ctxmenu-select-all"), role: "selectall" },
        { type: "separator" },
        ...commonEntries,
      ]).popup(core.getMainWindow(), params.x, params.y);
    } else {
      Menu.buildFromTemplate([...commonEntries]).popup(
        core.getMainWindow(),
        params.x,
        params.y
      );
    }
  });

  on("open", (comicData) => {
    reader.openBookFromCallback(comicData, getPageCallback);
    onCloseClicked();
  });

  on("search", async (data) => {
    // NOTE: tried to use the form-data package but couldn't make it work so I do the
    // axios request in the renderer and send the result here
    try {
      const jsdom = require("jsdom");
      const { JSDOM } = jsdom;

      const dom = new JSDOM(data);
      const table = dom.window.document.querySelector("#search-results");
      let results = [];
      const links = table?.getElementsByTagName("a");
      if (links && links.length > 0) {
        for (let index = 0; index < links.length; index++) {
          const link = links[index];
          // e.g. index.php?dlid=33252
          if (link.href.startsWith("index.php?dlid=")) {
            const name = link.innerHTML;
            const parts = link.href.split("dlid=");
            if (parts.length === 2 && isValidBookId(parts[1])) {
              let result = {
                name: name,
                dlid: parts[1],
              };
              results.push(result);
            }
          }
        }
      }
      if (results.length === 0) throw "0 results";
      sendIpcToRenderer(
        "update-results",
        results,
        _("tool-shared-ui-search-item-open-acbr"),
        _("tool-shared-ui-search-item-open-browser")
      );
    } catch (error) {
      if (error !== "0 results") log.error(error);
      sendIpcToRenderer(
        "update-results",
        [],
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
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    let comicData = fileData.data;
    const response = await axios.get(
      `https://digitalcomicmuseum.com/preview/index.php?did=${comicData.comicId}&page=${pageNum}`,
      { timeout: 10000 }
    );
    const dom = new JSDOM(response.data);
    let images = dom.window.document.getElementsByTagName("img");

    let imageUrl;
    for (let i = 0; i < images.length; i++) {
      if (images[i].alt === "Comic Page") {
        imageUrl = images[i].src;
        continue;
      }
    }
    return { pageImgSrc: imageUrl, pageImgUrl: imageUrl };
  } catch (error) {
    // console.error(error);
    return undefined;
  }
}
exports.getPageCallback = getPageCallback;

function isValidBookId(str) {
  let n = Math.floor(Number(str));
  return n !== Infinity && String(n) === str && n >= 0;
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    _("tool-shared-ui-search-placeholder"),
    _("tool-dcm-select-publisher-text"),
    _("tool-dcm-select-title-text"),
    _("tool-dcm-select-comic-text"),
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
      id: "tool-dcm-title-text",
      text: _("tool-dcm-title").toUpperCase(),
    },
    {
      id: "tool-dcm-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-dcm-start-button-text",
      text: _("tool-shared-ui-convert").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-dcm-section-1-text",
      text: _("tool-shared-tab-catalog"),
    },
    {
      id: "tool-dcm-section-2-text",
      text: _("tool-shared-tab-openurl"),
    },
    {
      id: "tool-dcm-section-3-text",
      text: _("tool-shared-tab-about"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-dcm-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-dcm-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-dcm-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-catalog-text",
      text: _("tool-shared-tab-catalog"),
    },
    {
      id: "tool-dcm-publishers-text",
      text: _("tool-dcm-publishers-text"),
    },
    {
      id: "tool-dcm-titles-text",
      text: _("tool-dcm-titles-text"),
    },
    {
      id: "tool-dcm-comics-text",
      text: _("tool-dcm-comics-text"),
    },
    {
      id: "tool-dcm-open-selected-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-dcm-open-selected-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-url-text",
      text: _("tool-dcm-dcm-url-text"),
    },
    {
      id: "tool-dcm-open-input-url-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-dcm-open-input-url-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-dcm--about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-comicbooks"),
        "Digital Comic Museum"
      ),
    },
    {
      id: "tool-dcm--about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-dcm--about-3-text",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "tool-dcm-open-dcm-browser-button-text",
      text: _("tool-dcm-button-open-dcm-browser").toUpperCase(),
    },
    {
      id: "tool-dcm-open-donate-browser-button-text",
      text: _("tool-dcm-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-dcm-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-dcm-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "tool-dcm-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
