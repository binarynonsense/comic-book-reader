/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _ } = require("../../shared/main/i18n");
const appUtils = require("../../shared/main/app-utils");
const utils = require("../../shared/main/utils");
const settings = require("../../shared/main/settings");
const tools = require("../../shared/main/tools");
const { FileDataType } = require("../../shared/main/constants");

const comicInfo = require("./comicinfo/main");
const epub = require("./epub/main");
const pdf = require("./pdf/main");

const log = require("../../shared/main/logger");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_subTool;
let g_isInitialized = false;
let g_fileData;

let g_cvApiKey;
let g_cvApiKeyFilePath;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    initHandleIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function (fileData) {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  g_fileData = fileData;
  if (
    g_fileData.type === FileDataType.EPUB_COMIC ||
    g_fileData.type === FileDataType.EPUB_EBOOK
  ) {
    g_subTool = epub;
  } else if (g_fileData.type === FileDataType.PDF) {
    g_subTool = pdf;
  } else {
    g_subTool = comicInfo;
  }
  g_subTool.open(g_fileData, settings);
  // comic vine search
  g_cvApiKeyFilePath = settings.getValue("toolCixApiKeyPath");
  let saveAsRelative = false;
  if (g_cvApiKeyFilePath) {
    let absoluteFilePath = g_cvApiKeyFilePath;
    if (!path.isAbsolute(g_cvApiKeyFilePath)) {
      absoluteFilePath = path.resolve(
        appUtils.getExeFolderPath(),
        g_cvApiKeyFilePath
      );
      saveAsRelative = true;
    }
    if (
      fs.existsSync(absoluteFilePath) &&
      !fs.lstatSync(absoluteFilePath).isDirectory()
    ) {
      g_cvApiKey = fs.readFileSync(absoluteFilePath).toString().trim();
    } else {
      g_cvApiKey = undefined;
      g_cvApiKeyFilePath = undefined;
      saveAsRelative = false;
    }
  }
  sendIpcToRenderer("set-api-key-file", g_cvApiKeyFilePath, saveAsRelative);
};

exports.close = function () {
  g_subTool.close();
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
  core.sendIpcToRenderer("tool-metadata", ...args);
}
exports.sendIpcToRenderer = sendIpcToRenderer;

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}
exports.sendIpcToCoreRenderer = sendIpcToCoreRenderer;

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

  on("show-context-menu", (params, g_isEditable) => {
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
    if (selectionText) {
      if (g_isEditable && isEditable && selectionText.trim() !== "") {
        Menu.buildFromTemplate([
          { label: _("ctxmenu-copy"), role: "copy" },
          { label: _("ctxmenu-paste"), role: "paste" },
          { type: "separator" },
          { label: _("ctxmenu-select-all"), role: "selectall" },
          { type: "separator" },
          ...commonEntries,
        ]).popup(core.getMainWindow(), params.x, params.y);
      } else if (selectionText.trim() !== "") {
        Menu.buildFromTemplate([
          { label: _("ctxmenu-copy"), role: "copy" },
          { type: "separator" },
          { label: _("ctxmenu-select-all"), role: "selectall" },
          { type: "separator" },
          ...commonEntries,
        ]).popup(core.getMainWindow(), params.x, params.y);
      }
    } else if (g_isEditable && isEditable) {
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

  on("tooltip-button-clicked", (text) => {
    sendIpcToRenderer(
      "show-modal-info",
      _("tool-shared-modal-title-info"),
      text,
      _("tool-shared-ui-close").toUpperCase()
    );
  });

  ///////////////////////

  on("load-metadata", () => {
    g_subTool.loadMetadata();
  });

  on("update-pages", (json) => {
    g_subTool.updatePages(json);
  });

  on("save-metadata-to-file", (metadata) => {
    g_subTool.saveMetadataToFile(metadata);
  });

  ///////////////////////

  on("search", (...args) => {
    search(...args);
  });

  on("get-volume-data", (...args) => {
    getVolumeData(...args);
  });

  on("get-issue-data", (...args) => {
    getIssueData(...args);
  });

  on("change-api-key-file", (saveAsRelative) => {
    let defaultPath = settings.getValue("toolCixApiKeyPath");

    let allowMultipleSelection = false;
    let allowedFileTypesName = _("dialog-file-types-text");
    let allowedFileTypesList = ["txt"];
    let filePaths = appUtils.chooseFiles(
      core.getMainWindow(),
      defaultPath,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection
    );
    if (filePaths === undefined) {
      return;
    }
    let filePath = filePaths[0];
    if (filePath === undefined || filePath === "") return;
    g_cvApiKeyFilePath = filePath;
    g_cvApiKey = fs.readFileSync(g_cvApiKeyFilePath).toString().trim();
    if (saveAsRelative) {
      filePath = path.relative(appUtils.getExeFolderPath(), filePath);
    }
    settings.setValue("toolCixApiKeyPath", filePath);
    sendIpcToRenderer("set-api-key-file", filePath, saveAsRelative);
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
// COMIC VINE /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function search(text, pageNum) {
  try {
    if (text.trim().length === 0) {
      throw "query text is empty";
    }
    const axios = require("axios").default;

    let resources = "volume";

    // usage examples
    // https://comicvine.gamespot.com/api/volumes/?api_key=YOUR-KEY&format=json&sort=name:asc&filter=name:Walking%20Dead
    // https://comicvine.gamespot.com/api/search/?api_key=YOUR-KEY&format=json&sort=name:asc&resources=issue&query=%22Master%20of%20kung%20fu%22
    // https://comicvine.gamespot.com/api/issue/4000-14582/?api_key=YOUR-KEY&format=json

    let searchQuery = encodeURIComponent(text);
    const response = await axios.get(
      `https://comicvine.gamespot.com/api/search/?api_key=${g_cvApiKey}&format=json&resources=${resources}&page=${pageNum}&limit=50&query=${searchQuery}`,
      { timeout: 10000 }
    ); //&sort=name:asc
    // TODO: &field_list=name,publisher,id,count_of_issues...
    await utils.delay(1); // to not get banned from the api
    sendIpcToRenderer(
      "search-volumes-results",
      response.data,
      _("tool-shared-ui-search-nothing-found"),
      text,
      pageNum
    );
  } catch (error) {
    let errorMsg = _("tool-shared-ui-search-network-error", "Comic Vine");
    if (error?.response?.data) {
      if (error.response.data.error === "Invalid API Key")
        errorMsg = _("tool-metadata-search-error-invalid-api-key");
      else errorMsg += " (Error: )" + error.response.data.error;
    }
    await utils.delay(1);
    sendIpcToRenderer("search-volumes-results", undefined, errorMsg);
  }
}

async function getVolumeData(url) {
  try {
    const axios = require("axios").default;
    const response = await axios.get(
      `${url}?api_key=${g_cvApiKey}&format=json`,
      {
        timeout: 10000,
      }
    );
    //&sort=issue_number:asc didn't work, I sort them in renderer
    await utils.delay(1); // to not get banned from the api
    sendIpcToRenderer(
      "search-issues-results",
      response.data,
      _("tool-shared-ui-search-nothing-found")
    );
  } catch (error) {
    let errorMsg = _("tool-shared-ui-search-network-error", "Comic Vine");
    if (error?.response?.data) {
      if (error.response.data.error === "Invalid API Key")
        errorMsg = _("tool-metadata-search-error-invalid-api-key");
      else errorMsg += " (Error: )" + error.response.data.error;
    }
    await utils.delay(1);
    sendIpcToRenderer("search-volumes-results", undefined, errorMsg);
  }
}

async function getIssueData(url) {
  try {
    const axios = require("axios").default;
    const response = await axios.get(
      `${url}?api_key=${g_cvApiKey}&format=json`,
      {
        timeout: 10000,
      }
    );
    await utils.delay(1); // to not get banned from the api
    sendIpcToRenderer(
      "search-issue-results",
      response.data,
      _("tool-shared-ui-import").toUpperCase()
    );
  } catch (error) {
    let errorMsg = _("tool-shared-ui-search-network-error", "Comic Vine");
    if (error?.response?.data) {
      if (error.response.data.error === "Invalid API Key")
        errorMsg = _("tool-metadata-search-error-invalid-api-key");
      else errorMsg += " (Error: )" + error.response.data.error;
    }
    await utils.delay(1);
    sendIpcToRenderer("search-issue-results", undefined, errorMsg);
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.updateLocalizedText = function () {
  g_subTool.updateLocalizedText();
};

exports.getLocalizedText = function () {
  return [
    getLocalization(),
    getTooltipsLocalization(),
    {
      updatingTitle: _("tool-shared-modal-title-updating"),
      warningTitle: _("tool-shared-modal-title-warning"),
      errorTitle: _("tool-shared-modal-title-error"),
      successTitle: _("tool-shared-modal-title-success"),
      okButton: _("ui-modal-prompt-button-ok").toUpperCase(),
      cancelButton: _("ui-modal-prompt-button-cancel").toUpperCase(),
      savingTitle: _("tool-shared-modal-title-saving"),
      loadingTitle: _("tool-shared-modal-title-loading"),
      // TODO: some of this should go elsewhere
      searchingTitle: _("tool-shared-modal-title-searching"),
      searchPlaceholder: _("tool-metadata-search-placeholder-series"),
      importingTitle: _("tool-shared-modal-title-importing"),
      importingMessage: _("tool-metadata-search-import-warning"),
      searchResultsShowIssues: _(
        "tool-metadata-search-results-show-issues-list"
      ),
      searchResultsShowMetadata: _(
        "tool-metadata-search-results-show-issue-info"
      ),
      infoTooltip: _("tool-shared-modal-title-info"),
    },
  ];
};

function getTooltipsLocalization() {
  return [
    {
      id: "tool-metadata-tooltip-comicvine-api-key-file",
      text: _("tool-metadata-search-api-key-file-path-info", "Comic Vine"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "tool-metadata-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-metadata-save-button-text",
      text: _("ui-modal-prompt-button-save").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-metadata-section-0-button-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-metadata-section-1-button-text",
      text: _("tool-shared-tab-search-settings"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-metadata-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-metadata-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-metadata-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-metadata-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-metadata-comicvine-text",
      text: "Comic Vine",
    },
    {
      id: "tool-metadata-comicvine-api-key-file-text",
      text: _("tool-metadata-search-api-key-file-path"),
    },
    {
      id: "tool-metadata-comicvine-api-key-file-change-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-metadata-comicvine-api-key-checkbox-text",
      text: _("tool-shared-ui-save-as-relative-path"),
    },
  ];
}
