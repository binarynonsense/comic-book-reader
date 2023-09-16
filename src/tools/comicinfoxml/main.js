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
const fileUtils = require("../../shared/main/file-utils");
const appUtils = require("../../shared/main/app-utils");
const fileFormats = require("../../shared/main/file-formats");
const utils = require("../../shared/main/utils");
const { FileDataType } = require("../../shared/main/constants");
const ISO6391 = require("iso-639-1");
const { fork } = require("child_process");
const settings = require("../../shared/main/settings");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_fileData;
let g_worker;

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
  updateLocalizedText();
  let languages = ISO6391.getLanguages(ISO6391.getAllCodes());
  sendIpcToRenderer("show", fileData, languages, settings.canEditRars());
  g_fileData = fileData;

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
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
  sendIpcToRenderer("hide"); // clean up

  if (g_worker !== undefined) {
    // kill it after one use
    g_worker.kill();
    g_worker = undefined;
  }
  fileUtils.cleanUpTempFolder();
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
  core.switchTool("reader");
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-comicinfoxml", ...args);
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

  on("load-xml", () => {
    loadXml();
  });

  on("update-pages", (json) => {
    updatePages(json);
  });

  on("save-json-to-file", (json) => {
    saveJsonToFile(json);
  });

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
    let filePaths = appUtils.chooseOpenFiles(
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
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function loadXml() {
  let xmlFileData;
  if (g_fileData.metadata && g_fileData.metadata.comicInfoId) {
    let buf;
    switch (g_fileData.type) {
      case FileDataType.ZIP:
        buf = fileFormats.extractZipEntryBuffer(
          g_fileData.path,
          g_fileData.metadata.comicInfoId,
          g_fileData.password
        );
        break;
      case FileDataType.RAR:
        buf = await fileFormats.extractRarEntryBuffer(
          g_fileData.path,
          g_fileData.metadata.comicInfoId,
          g_fileData.password
        );
        break;
      case FileDataType.SEVENZIP:
        buf = await fileFormats.extract7ZipEntryBuffer(
          g_fileData.path,
          g_fileData.metadata.comicInfoId,
          g_fileData.password,
          fileUtils.createTempFolder(false)
        );
        break;
    }
    if (buf) xmlFileData = buf.toString();
  }

  const { XMLParser, XMLValidator } = require("fast-xml-parser");
  try {
    if (xmlFileData === undefined) {
      throw "no comicinfo";
    }
    const isValidXml = XMLValidator.validate(xmlFileData);
    if (isValidXml !== true) {
      throw "invalid xml";
    }
    // open
    const parserOptions = {
      ignoreAttributes: false,
      allowBooleanAttributes: true,
    };
    const parser = new XMLParser(parserOptions);
    let json = parser.parse(xmlFileData);
    if (!json["ComicInfo"]) {
      throw "invalid comicinfo";
    }
    sendIpcToRenderer("load-json", json, undefined);
  } catch (error) {
    try {
      xmlFileData = `<?xml version="1.0"?>
  <ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">  
  </ComicInfo>`;
      // open
      const parserOptions = {
        ignoreAttributes: false,
        allowBooleanAttributes: true,
      };
      const parser = new XMLParser(parserOptions);
      let json = parser.parse(xmlFileData);
      sendIpcToRenderer(
        "load-json",
        json,
        error === "no comicinfo" ? undefined : error
      );
    } catch (error) {
      // TODO: can't recuperate from this!!
      // close???
    }
  }
}

function updatePages(json) {
  let tempFolderPath = fileUtils.createTempFolder();
  if (g_worker !== undefined) {
    // kill it after one use
    g_worker.kill();
    g_worker = undefined;
  }
  if (g_worker === undefined) {
    g_worker = fork(path.join(__dirname, "../../shared/main/tools-worker.js"));
    g_worker.on("message", (message) => {
      g_worker.kill(); // kill it after one use
      if (message === "success") {
        updatePagesDataFromImages(json);
        return;
      } else {
        sendIpcToRenderer("pages-updated", undefined);
        fileUtils.cleanUpTempFolder();
        return;
      }
    });
  }
  g_worker.send([
    "extract",
    g_fileData.path,
    g_fileData.type,
    tempFolderPath,
    g_fileData.password,
  ]);
}

async function updatePagesDataFromImages(json) {
  try {
    const sharp = require("sharp");
    let tempFolderPath = fileUtils.getTempFolderPath();
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    imgFilePaths.sort(utils.compare);

    if (!json["ComicInfo"]["Pages"]) {
      json["ComicInfo"]["Pages"] = {};
    }
    if (!json["ComicInfo"]["Pages"]["Page"]) {
      json["ComicInfo"]["Pages"]["Page"] = [];
    }
    let oldPagesArray = json["ComicInfo"]["Pages"]["Page"].slice();
    json["ComicInfo"]["Pages"]["Page"] = [];
    for (let index = 0; index < imgFilePaths.length; index++) {
      let pageData = {
        "@_Image": "",
        "@_ImageSize": "",
        "@_ImageWidth": "",
        "@_ImageHeight": "",
      };
      if (oldPagesArray.length > index) {
        pageData = oldPagesArray[index];
      }
      let filePath = imgFilePaths[index];
      pageData["@_Image"] = index;
      let fileStats = fs.statSync(filePath);
      let fileSizeInBytes = fileStats.size;
      pageData["@_ImageSize"] = fileSizeInBytes;
      const metadata = await sharp(filePath).metadata();
      pageData["@_ImageWidth"] = metadata.width;
      pageData["@_ImageHeight"] = metadata.height;
      json["ComicInfo"]["Pages"]["Page"].push(pageData);
    }

    fileUtils.cleanUpTempFolder();
    sendIpcToRenderer("pages-updated", json);
  } catch (error) {
    sendIpcToRenderer("pages-updated", undefined);
    fileUtils.cleanUpTempFolder();
  }
}

async function saveJsonToFile(json) {
  try {
    const { XMLBuilder } = require("fast-xml-parser");
    // rebuild
    const builderOptions = {
      ignoreAttributes: false,
      format: true,
      suppressBooleanAttributes: false, // write booleans with text
    };
    const builder = new XMLBuilder(builderOptions);
    const outputXmlData = builder.build(json);
    const isUpdate = g_fileData.metadata.comicInfoId !== undefined;
    const entryName = isUpdate
      ? g_fileData.metadata.comicInfoId
      : "ComicInfo.xml";
    if (g_fileData.type === FileDataType.ZIP) {
      let buf = Buffer.from(outputXmlData, "utf8");
      if (
        !fileFormats.updateZipEntry(g_fileData.path, entryName, buf, isUpdate)
      ) {
        throw "error updating zip entry";
      }
    } else if (g_fileData.type === FileDataType.SEVENZIP) {
      const tempFolderPath = fileUtils.createTempFolder();
      const xmlFilePath = path.resolve(tempFolderPath, entryName);
      fs.writeFileSync(xmlFilePath, outputXmlData);
      let success = await fileFormats.update7ZipEntry(
        g_fileData.path,
        xmlFilePath,
        tempFolderPath,
        g_fileData.password
      );
      if (!success) {
        fileUtils.cleanUpTempFolder();
        throw "error updating 7zip entry";
      }
      fileUtils.cleanUpTempFolder();
    } else if (g_fileData.type === FileDataType.RAR) {
      const tempFolderPath = fileUtils.createTempFolder();
      const xmlFilePath = path.resolve(tempFolderPath, entryName);
      fs.writeFileSync(xmlFilePath, outputXmlData);
      let success = fileFormats.updateRarEntry(
        utils.getRarCommand(settings.getValue("rarExeFolderPath")),
        g_fileData.path,
        entryName,
        tempFolderPath
      );
      if (!success) {
        fileUtils.cleanUpTempFolder();
        throw "error updating RAR entry";
      }
      fileUtils.cleanUpTempFolder();
    }
    if (!isUpdate) {
      reader.updateFileDataMetadataEntry("comicInfoId", entryName);
    }
    sendIpcToRenderer("saving-done");
  } catch (error) {
    log.error(error);
    sendIpcToRenderer("saving-done", error);
  }
}

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
        errorMsg = _("tool-cix-search-error-invalid-api-key");
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
        errorMsg = _("tool-cix-search-error-invalid-api-key");
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
        errorMsg = _("tool-cix-search-error-invalid-api-key");
      else errorMsg += " (Error: )" + error.response.data.error;
    }
    await utils.delay(1);
    sendIpcToRenderer("search-issue-results", undefined, errorMsg);
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    {
      updatingTitle: _("tool-shared-modal-title-updating"),

      warningTitle: _("tool-shared-modal-title-warning"),
      errorTitle: _("tool-shared-modal-title-error"),
      successTitle: _("tool-shared-modal-title-success"),

      okButton: _("ui-modal-prompt-button-ok").toUpperCase(),
      cancelButton: _("ui-modal-prompt-button-cancel").toUpperCase(),

      savingTitle: _("tool-shared-modal-title-saving"),
      savingMessageUpdate: _("tool-cix-warning-save-update"),
      savingMessageCreate: _("tool-cix-warning-save-create"),
      savingMessageSuccessUpdate: _("tool-cix-modal-message-success-update"),
      savingMessageSuccessCreate: _("tool-cix-modal-message-success-create"),
      savingMessageErrorUpdate: _("tool-cix-modal-message-could-not-update"),
      savingMessageErrorCreate: _("tool-cix-modal-message-could-not-create"),

      loadingTitle: _("tool-shared-modal-title-loading"),
      loadingMessageErrorInvalid: _(
        "The ComicInfo.xml file is not a valid xml file"
      ),

      // TODO: some of this should go elsewhere
      searchingTitle: _("tool-shared-modal-title-searching"),
      searchPlaceholder: _("tool-cix-search-placeholder-series"),
      importingTitle: _("tool-shared-modal-title-importing"),
      importingMessage: _("tool-cix-search-import-warning"),
      searchResultsShowIssues: _("tool-cix-search-results-show-issues-list"),
      searchResultsShowMetadata: _("tool-cix-search-results-show-issue-info"),
    },
    [
      _("tool-cix-data-page-type-frontcover"),
      _("tool-cix-data-page-type-innercover"),
      _("tool-cix-data-page-type-roundup"),
      _("tool-cix-data-page-type-story"),
      _("tool-cix-data-page-type-advertisement"),
      _("tool-cix-data-page-type-editorial"),
      _("tool-cix-data-page-type-letters"),
      _("tool-cix-data-page-type-preview"),
      _("tool-cix-data-page-type-backCover"),
      _("tool-cix-data-page-type-other"),
      _("tool-cix-data-page-type-deleted"),
    ],
    [
      _("tool-cix-data-page-table-header-image"),
      _("tool-cix-data-page-table-header-imagesize"),
      _("tool-cix-data-page-table-header-imagewidth"),
      _("tool-cix-data-page-table-header-imageheight"),
      _("tool-cix-data-page-table-header-doublepage"),
      _("tool-cix-data-page-table-header-type"),
    ],

    getLocalization(),
    getTooltipsLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getTooltipsLocalization() {
  return [
    {
      id: "tool-cix-tooltip-page-data",
      text: _("tool-cix-tooltip-update-pages"),
    },
    {
      id: "tool-cix-tooltip-comicvine-api-key-file",
      text: _("tool-cix-search-api-key-file-path-info", "Comic Vine"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "tool-cix-title-text",
      text: _("tool-cix-title").toUpperCase(),
    },
    {
      id: "tool-cix-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-cix-save-button-text",
      text: _("ui-modal-prompt-button-save").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cix-section-0-button-text",
      text: _("tool-cix-section-details"),
    },
    {
      id: "tool-cix-section-1-button-text",
      text: _("tool-cix-section-creators"),
    },
    {
      id: "tool-cix-section-2-button-text",
      text: _("tool-cix-section-pages"),
    },
    {
      id: "tool-cix-section-3-button-text",
      text: _("tool-cix-section-other-data"),
    },
    {
      id: "tool-cix-section-4-button-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-cix-section-5-button-text",
      text: _("tool-shared-tab-search-settings"),
    },
    ////////////////////////////////
    {
      id: "tool-cix-section-0-text",
      text: _("tool-cix-section-details"),
    },
    {
      id: "tool-cix-section-1-text",
      text: _("tool-cix-section-creators"),
    },
    {
      id: "tool-cix-section-2-text",
      text: _("tool-cix-section-pages"),
    },
    {
      id: "tool-cix-section-3-text",
      text: _("tool-cix-section-other-data"),
    },
    ////////////////////////////////
    {
      id: "tool-cix-cbr-no-edit-rar-text",
      text: _("tool-cix-warning-rar"),
    },
    {
      id: "tool-cix-cbr-no-edit-encrypted-text",
      text: _("tool-cix-warning-encrypted"),
    },
    {
      id: "tool-cix-update-pages-button-text",
      text: _("ui-modal-prompt-button-update").toUpperCase(),
    },
    ////////////////////////////////
    {
      id: "tool-cix-data-title-text",
      text: _("tool-cix-data-title"),
    },
    {
      id: "tool-cix-data-series-text",
      text: _("tool-cix-data-series"),
    },
    {
      id: "tool-cix-data-number-text",
      text: _("tool-cix-data-number"),
    },
    {
      id: "tool-cix-data-count-text",
      text: _("tool-cix-data-count"),
    },
    {
      id: "tool-cix-data-volume-text",
      text: _("tool-cix-data-volume"),
    },
    {
      id: "tool-cix-data-summary-text",
      text: _("tool-cix-data-summary"),
    },
    {
      id: "tool-cix-data-year-text",
      text: _("tool-cix-data-year"),
    },
    {
      id: "tool-cix-data-month-text",
      text: _("tool-cix-data-month"),
    },
    {
      id: "tool-cix-data-day-text",
      text: _("tool-cix-data-day"),
    },
    {
      id: "tool-cix-data-genre-text",
      text: _("tool-cix-data-genre"),
    },

    {
      id: "tool-cix-data-languageiso-text",
      text: _("tool-cix-data-languageiso"),
    },
    {
      id: "tool-cix-data-writer-text",
      text: _("tool-cix-data-writer"),
    },
    {
      id: "tool-cix-data-penciller-text",
      text: _("tool-cix-data-penciller"),
    },
    {
      id: "tool-cix-data-inker-text",
      text: _("tool-cix-data-inker"),
    },
    {
      id: "tool-cix-data-colorist-text",
      text: _("tool-cix-data-colorist"),
    },
    {
      id: "tool-cix-data-letterer-text",
      text: _("tool-cix-data-letterer"),
    },
    {
      id: "tool-cix-data-coverartist-text",
      text: _("tool-cix-data-coverartist"),
    },
    {
      id: "tool-cix-data-editor-text",
      text: _("tool-cix-data-editor"),
    },
    {
      id: "tool-cix-data-publisher-text",
      text: _("tool-cix-data-publisher"),
    },
    {
      id: "tool-cix-data-imprint-text",
      text: _("tool-cix-data-imprint"),
    },
    {
      id: "tool-cix-data-pagecount-text",
      text: _("tool-cix-data-pagecount"),
    },
    {
      id: "tool-cix-data-pages-text",
      text: _("tool-cix-data-pages"),
    },
    {
      id: "tool-cix-data-format-text",
      text: _("tool-cix-data-format"),
    },
    {
      id: "tool-cix-data-notes-text",
      text: _("tool-cix-data-notes"),
    },
    {
      id: "tool-cix-data-alternateseries-text",
      text: _("tool-cix-data-alternateseries"),
    },
    {
      id: "tool-cix-data-alternatenumber-text",
      text: _("tool-cix-data-alternatenumber"),
    },
    {
      id: "tool-cix-data-alternatecount-text",
      text: _("tool-cix-data-alternatecount"),
    },
    {
      id: "tool-cix-data-web-text",
      text: _("tool-cix-data-web"),
    },
    {
      id: "tool-cix-data-blackwhite-text",
      text: _("tool-cix-data-blackwhite"),
    },
    {
      id: "tool-cix-data-blackwhite-option-unknown-text",
      text: _("tool-cix-data-blackwhite-option-unknown"),
    },
    {
      id: "tool-cix-data-blackwhite-option-no-text",
      text: _("tool-cix-data-blackwhite-option-no"),
    },
    {
      id: "tool-cix-data-blackwhite-option-yes-text",
      text: _("tool-cix-data-blackwhite-option-yes"),
    },
    {
      id: "tool-cix-data-manga-text",
      text: _("tool-cix-data-manga"),
    },
    {
      id: "tool-cix-data-manga-option-unknown-text",
      text: _("tool-cix-data-manga-option-unknown"),
    },
    {
      id: "tool-cix-data-manga-option-no-text",
      text: _("tool-cix-data-manga-option-no"),
    },
    {
      id: "tool-cix-data-manga-option-yes-text",
      text: _("tool-cix-data-manga-option-yes"),
    },
    {
      id: "tool-cix-data-manga-option-yesrightleft-text",
      text: _("tool-cix-data-manga-option-yesrightleft"),
    },
    {
      id: "tool-cix-data-scaninformation-text",
      text: _("tool-cix-data-scaninformation"),
    },
    {
      id: "tool-cix-data-characters-text",
      text: _("tool-cix-data-characters"),
    },
    {
      id: "tool-cix-data-maincharacterorteam-text",
      text: _("tool-cix-data-maincharacterorteam"),
    },
    {
      id: "tool-cix-data-teams-text",
      text: _("tool-cix-data-teams"),
    },
    {
      id: "tool-cix-data-locations-text",
      text: _("tool-cix-data-locations"),
    },
    {
      id: "tool-cix-data-storyarc-text",
      text: _("tool-cix-data-storyarc"),
    },
    {
      id: "tool-cix-data-seriesgroup-text",
      text: _("tool-cix-data-seriesgroup"),
    },
    {
      id: "tool-cix-data-agerating-text",
      text: _("tool-cix-data-agerating"),
    },
    {
      id: "tool-cix-data-communityrating-text",
      text: _("tool-cix-data-communityrating"),
    },
    {
      id: "tool-cix-data-review-text",
      text: _("tool-cix-data-review"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cix-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-cix-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-cix-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-cix-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cix-comicvine-text",
      text: "Comic Vine",
    },
    {
      id: "tool-cix-comicvine-api-key-file-text",
      text: _("tool-cix-search-api-key-file-path"),
    },
    {
      id: "tool-cix-comicvine-api-key-file-change-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-cix-comicvine-api-key-checkbox-text",
      text: _("tool-shared-ui-save-as-relative-path"),
    },
  ];
}
