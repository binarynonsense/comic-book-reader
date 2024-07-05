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
const log = require("../../shared/main/logger");
const reader = require("../../reader/main");
const shell = require("electron").shell;
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");

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
  core.sendIpcToRenderer("tool-cbp", ...args);
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
    contextMenu.show("edit", params, onCloseClicked);
  });

  on("open", (comicData) => {
    reader.openBookFromCallback(comicData, getPageCallback);
    onCloseClicked();
  });

  on("search", async (text, url, useragent) => {
    log.test("+++++++++++");
    console.log(useragent);
    // NOTE: using duckduckgo.com as the search engine
    try {
      if (!url) {
        if (text.trim().length === 0) {
          throw "query's text is empty";
        }
        // ref: https://duckduckgo.com/duckduckgo-help-pages/results/syntax/
        url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(
          text + " inurl:dlid site:comicbookplus.com"
        )}`;
        // NOTE: inurl:dlid doesn't really seem to work
      }
      log.test(url);
      const axios = require("axios").default;
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { "User-Agent": useragent },
      });
      let nextUrl;
      // e.g. <a rel="next" href="/lite/?q=mars+site%3Acomicbookplus.com&amp;v=l&amp;kl=wt-wt&amp;l=us-en&amp;p=&amp;s=73&amp;ex=-1&amp;o=json&amp;dl=en&amp;ct=ES&amp;sp=0&amp;vqd=4-111953606416844614702827187214412193094&amp;host_region=eun&amp;dc=97&amp;api=%2Fd.js">
      let regex = /rel="next" href="\/lite\/\?q=(.*)">/;
      let match = response.data.match(regex);
      if (match && match[1]) {
        nextUrl = `https://lite.duckduckgo.com/lite/?q=${match[1]}`;
      }
      let prevUrl;
      //  <a rel="prev" href="/lite/?q=mars+inurl%3Adlid+site%3Acomicbookplus.com&amp;s=23&amp;v=l&amp;kl=us-en&amp;dc=-74&amp;nextParams=&amp;api=d.js&amp;vqd=4-218811986882710962361145831623280930728&amp;o=json">&lt; Previous Page</a> //
      regex = /rel="prev" href="\/lite\/\?q=(.*)">/;
      match = response.data.match(regex);
      if (match && match[1]) {
        prevUrl = `https://lite.duckduckgo.com/lite/?q=${match[1]}`;
      }
      const jsdom = require("jsdom");
      const { JSDOM } = jsdom;
      const dom = new JSDOM(response.data);
      const resultLinks = dom.window.document.querySelectorAll(".result-link");
      let results = { nextUrl, prevUrl, links: [], text, url };
      if (resultLinks && resultLinks.length > 0) {
        resultLinks.forEach((element) => {
          if (element.nodeName.toLowerCase() === "a" && element.href) {
            const href = element.href;
            // e.g. <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcomicbookplus.com%2F%3Fdlid%3D78597&amp;rut=cf36420565b1828fec62912e62aaedffc513ed9762220eaa4579cbbaa85c670e" class="result-link">Jim Solar Space Sheriff - Battle for Mars - Comic Book Plus</a>
            const regex = /uddg=(.*)&rut=/;
            const match = href.match(regex);
            if (match && match[1] && match[1].includes("dlid")) {
              let comicId;
              let parts = decodeURIComponent(match[1]).split("dlid=");
              if (parts.length === 2) {
                comicId = parts[1];
              }
              if (comicId) {
                results.links.push({
                  title: element.textContent.replace(" - Comic Book Plus", ""),
                  id: comicId,
                });
              }
            }
          }
        });
      } else {
        if (response.data.includes("Unfortunately, bots use DuckDuckGo too")) {
          log.test("DuckDuckGo thinks you are a bot");
        }
      }
      log.test("+++++++++++");
      sendIpcToRenderer(
        "update-results",
        results,
        _("tool-shared-ui-search-nothing-found"),
        _("tool-shared-ui-search-item-open-acbr"),
        _("tool-shared-ui-search-item-open-browser")
      );
    } catch (error) {
      console.error(error);
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

let g_pageCallbackLastComicId, g_pageCallbackLastImageUrlRoot;

async function getPageCallback(pageNum, fileData) {
  try {
    const axios = require("axios").default;
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    let comicData = fileData.data;

    if (
      !g_pageCallbackLastComicId ||
      g_pageCallbackLastComicId != comicData.comicId
    ) {
      const response = await axios.get(
        `https://comicbookplus.com/?dlid=${comicData.comicId}`,
        { timeout: 15000 }
      );
      const dom = new JSDOM(response.data);
      let imageUrl = dom.window.document.getElementById("maincomic").src;
      let imageUrlRoot = imageUrl.substring(0, imageUrl.lastIndexOf("/"));

      g_pageCallbackLastComicId = comicData.comicId;
      g_pageCallbackLastImageUrlRoot = imageUrlRoot;
    }

    let imageUrl = `${g_pageCallbackLastImageUrlRoot}/${pageNum - 1}.jpg`;
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
      id: "tool-cbp-title-text",
      text: _("tool-cbp-title").toUpperCase(),
    },
    {
      id: "tool-cbp-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-section-0-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-cbp-section-1-text",
      text: _("tool-shared-tab-openurl"),
    },
    {
      id: "tool-cbp-section-2-text",
      text: _("tool-shared-tab-about"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-cbp-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-cbp-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-cbp-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-url-text",
      text: _("tool-cbp-url-text"),
    },
    {
      id: "tool-cbp-open-input-url-acbr-button-text",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "tool-cbp-open-input-url-browser-button-text",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-about-text",
      text: _("tool-shared-tab-about"),
    },
    {
      id: "tool-cbp--about-1-text",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-comicbooks"),
        _("tool-cbp-title")
      ),
    },
    {
      id: "tool-cbp--about-2-text",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "tool-cbp--about-3-text",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "tool-cbp-open-cbp-browser-button-text",
      text: _(
        "tool-shared-ui-button-open-websitename-in-browser",
        _("tool-cbp-title")
      ).toUpperCase(),
    },
    {
      id: "tool-cbp-open-donate-browser-button-text",
      text: _("tool-dcm-button-open-donate-browser").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cbp-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-cbp-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "tool-cbp-modal-searching-title-text",
      text: _("tool-shared-modal-title-searching").toUpperCase(),
    },
  ];
}
