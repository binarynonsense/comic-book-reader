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

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_fileData;

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
  sendIpcToRenderer("show");

  g_fileData = fileData;

  loadXml();
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
    xmlFileData = buf.toString();
  } else {
    // TODO: read empty comicinfo xml  and generate json
    //const xmlFileData = fs.readFileSync(../../assets....base.xml, "utf8");
    // OR NOT and build json in renderer!! think!!
    // input xmls can lack some fields anyway, so I'll have to add them
    // manually in those cases too.. think!!
  }

  // TODO move to asyn func

  try {
    const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser");
    // console.log(xmlFileData);
    const isValidXml = XMLValidator.validate(xmlFileData);
    if (isValidXml === true) {
      // open
      const parserOptions = {
        ignoreAttributes: false,
      };
      const parser = new XMLParser(parserOptions);
      let json = parser.parse(xmlFileData);
      console.log(json);
      // TODO: send json
    } else {
      throw "ComicInfo.xml is not a valid xml file";
    }
  } catch (error) {
    console.log(
      "Warning: couldn't read the contents of ComicInfo.xml: " + error
    );
    // TODO: send stop and open modal
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    _("tool-shared-modal-title-updating"),
    _("tool-shared-modal-title-saving"),
    getLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

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
    ////////////////////////////////
    {
      id: "tool-cix-metadata-text",
      text: _("ui-modal-info-metadata").toUpperCase(),
    },
  ];
}
