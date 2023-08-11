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
const {
  FileExtension,
  FileDataState,
  FileDataType,
} = require("../../shared/main/constants");
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
  // console.log(ISO6391.validate("en"));
  sendIpcToRenderer(
    "show",
    fileData.comicInfoId !== undefined,
    fileData.type !== FileDataType.RAR,
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

function saveJsonToFile(json) {
  const { XMLBuilder } = require("fast-xml-parser");
  // rebuild
  const builderOptions = {
    ignoreAttributes: false,
    format: true,
    suppressBooleanAttributes: false, // write booleans with text
  };
  const builder = new XMLBuilder(builderOptions);
  let outputXmlData = builder.build(json);
  console.log(outputXmlData);
  // fs.writeFileSync(comicInfoFilePath, outputXmlData);
  sendIpcToRenderer("saving-done");
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    {
      updatingTitle: _("tool-shared-modal-title-updating"),
      savingTitle: _("tool-shared-modal-title-saving"),
      loadingTitle: _("tool-shared-modal-title-loading"),
      warningTitle: _("tool-shared-modal-title-warning"),
      errorTitle: _("tool-shared-modal-title-error"),
      successTitle: _("tool-shared-modal-title-success"),
      okButton: _("ui-modal-prompt-button-ok").toUpperCase(),
      cancelButton: _("ui-modal-prompt-button-cancel").toUpperCase(),
      savingMessageUpdate: _("tool-cix-warning-save-update"),
      savingMessageCreate: _("tool-cix-warning-save-create"),
    },
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
      id: "tool-cix-cbr-no-edit-text",
      text: _("tool-cix-warning-rar"),
    },
    {
      id: "tool-cix-update-pages-button-text",
      text: _("ui-modal-prompt-button-update").toUpperCase(),
    },
  ];
}
