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
const reader = require("../../reader/main");
const contextMenu = require("../../shared/main/tools-menu-context");
const tools = require("../../shared/main/tools");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init() {
  if (!g_isInitialized) {
    initOnIpcCallbacks();
    g_isInitialized = true;
  }
}

exports.open = function (fileData) {
  // called by switchTool when opening tool
  init();
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#tools", data.toString());
  updateLocalizedText();
  sendIpcToRenderer("show", fileData);
};

exports.close = function () {
  // called by switchTool when closing tool
  sendIpcToRenderer("close-modal");
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
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("tool-metadata", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}

function sendIpcToPreload(...args) {
  core.sendIpcToPreload(...args);
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
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-localization",
    getLocalization(),
    getExtraLocalization()
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getLocalization() {
  return [
    {
      id: "tool-metadata-title-text",
      text: _("tool-metadata-title").toUpperCase(),
    },
    {
      id: "tool-metadata-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
  ];
}

function getExtraLocalization() {
  return [];
}

// json metadata examples:

// waroftheworlds gutenberg
// {
//     'dc:rights': 'Public domain in the USA.',
//     'dc:identifier': { '#text': 'http://www.gutenberg.org/36', '@_id': 'id' },
//     'dc:creator': { '#text': 'H. G. Wells', '@_id': 'author_0' },
//     meta: [
//       {
//         '#text': 'Wells, H. G. (Herbert George)',
//         '@_property': 'file-as',
//         '@_refines': '#author_0'
//       },
//       {
//         '#text': 'aut',
//         '@_property': 'role',
//         '@_refines': '#author_0',
//         '@_scheme': 'marc:relators'
//       },
//       {
//         '#text': '2024-06-01T07:58:20Z',
//         '@_property': 'dcterms:modified'
//       },
//       { '@_name': 'cover', '@_content': 'id-5537589769737049517' }
//     ],
//     'dc:title': 'The War of the Worlds',
//     'dc:language': 'en',
//     'dc:subject': [
//       'Science fiction',
//       'War stories',
//       'Martians -- Fiction',
//       'Mars (Planet) -- Fiction',
//       'Space warfare -- Fiction',
//       'Imaginary wars and battles -- Fiction',
//       'Life on other planets -- Fiction'
//     ],
//     'dc:date': '2004-10-01',
//     'dc:source': 'https://www.gutenberg.org/files/36/36-h/36-h.htm'
//   }

// comicinfotextfile acbr
// {
//     'dc:title': { '#text': 'cbr_test_comicinfoxml', '@_id': 't1' },
//     'dc:identifier': {
//       '#text': 'f3db6b05-4904-422c-8c59-b31322e076f0',
//       '@_id': 'book-id'
//     },
//     meta: [
//       {
//         '#text': 'uuid',
//         '@_refines': '#book-id',
//         '@_property': 'identifier-type',
//         '@_scheme': 'xsd:string'
//       },
//       {
//         '#text': '2024-06-22T15:07:19Z',
//         '@_property': 'dcterms:modified'
//       },
//       { '@_name': 'cover', '@_content': 'image_cover' },
//       { '@_name': 'generator', '@_content': 'acbr' }
//     ],
//     'dc:language': 'en'
//   }

// spawn humble

// {
//     'dc:identifier': {
//       '#text': 'urn:isbn:SPAWN0149',
//       '@_id': 'bookid',
//       '@_opf:scheme': 'ISBN'
//     },
//     'dc:title': 'Spawn #149',
//     'dc:creator': [
//       {
//         '#text': 'Brian Holguin, Todd McFarlane',
//         '@_opf:role': 'aut',
//         '@_opf:file-as': 'McFarlane,  Brian Holguin, Todd'
//       },
//       {
//         '#text': 'Angel Medina, Allen Martinez, Danny Miki, Victor Olazaba, Brian Haberlin',
//         '@_opf:role': 'art',
//         '@_opf:file-as': 'Haberlin,  Angel Medina, Allen Martinez, Danny Miki, Victor Olazaba, Brian'
//       },
//       { '@_opf:role': 'ill', '@_opf:file-as': ',' },
//       { '@_opf:role': 'ill', '@_opf:file-as': ',' },
//       { '@_opf:role': 'cov', '@_opf:file-as': ',' },
//       { '@_opf:role': 'edt', '@_opf:file-as': ',' }
//     ],
//     'dc:description': `"Spawn sifts through the rubble of his life -- broken shards of memory and lost pieces of the past -- in a desperate attempt to find a terrible secret that the fallen angel Mammon has hidden inside of him. As the Hellspawn's searching leads him into unexpected quarters and face-to-face with enemies old and new, he can't shake the feeling that no matter what he does, no matter which path he chooses, he is doing precisely what Mammon wants."`,
//     'dc:publisher': 'Image Comics',
//     'dc:date': '2005-09-01',
//     'dc:language': 'en-US',
//     'dc:rights': 'Copyright #x00A9; Image Comics',
//     meta: { '@_name': 'cover', '@_content': 'cover' },
//     '@_xmlns:opf': 'http://www.idpf.org/2007/opf',
//     '@_xmlns:dc': 'http://purl.org/dc/elements/1.1/'
//   }
