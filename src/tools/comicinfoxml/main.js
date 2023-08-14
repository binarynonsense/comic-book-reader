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
const fileUtils = require("../../shared/main/file-utils");
const fileFormats = require("../../shared/main/file-formats");
const { FileDataType } = require("../../shared/main/constants");
const ISO6391 = require("iso-639-1");
const { fork } = require("child_process");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_fileData;
let g_worker;

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
  sendIpcToRenderer(
    "show",
    fileData,
    ISO6391.getAllNativeNames(),
    ISO6391.getAllCodes()
  );
  g_fileData = fileData;
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

  on("load-xml", () => {
    loadXml();
  });

  on("update-pages", (json) => {
    updatePages(json);
  });

  on("save-json-to-file", (json) => {
    saveJsonToFile(json);
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
          g_fileData.password
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
    // TODO: xml with no pages data!!!!
    const sharp = require("sharp");
    let tempFolderPath = fileUtils.getTempFolderPath();
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    imgFilePaths.sort(fileUtils.compare);

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
    }
    if (!isUpdate) {
      reader.updateFileDataMetadataEntry("comicInfoId", entryName);
    }
    sendIpcToRenderer("saving-done");
  } catch (error) {
    console.log(error);
    sendIpcToRenderer("saving-done", error);
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
      text: _("tool-shared-ui-back-button").toUpperCase(),
    },
    {
      id: "tool-cix-save-button-text",
      text: _("ui-modal-prompt-button-save").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cix-section-0-button-text",
      text: _("tool-cix-section-basic-data"),
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
    ////////////////////////////////
    {
      id: "tool-cix-section-0-text",
      text: _("tool-cix-section-basic-data"),
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
  ];
}
