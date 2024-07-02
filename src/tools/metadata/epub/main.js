/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../../core/main");
const base = require("../main");
const { _ } = require("../../../shared/main/i18n");

const epub = require("../../../shared/main/epub-metadata");

const log = require("../../../shared/main/logger");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_fileData;
let g_metadata;

exports.open = function (fileData) {
  base.sendIpcToCoreRenderer(
    "insert-html-afterbegin",
    ".tools-menu-sections",
    fs
      .readFileSync(path.join(__dirname, "index-section-buttons.html"))
      .toString()
  );
  base.sendIpcToCoreRenderer(
    "insert-html-afterend",
    "#tools-title",
    fs.readFileSync(path.join(__dirname, "index-sections.html")).toString()
  );
  base.sendIpcToRenderer("set-subtool", "epub");
  updateLocalizedText();
  base.sendIpcToRenderer("show", fileData);
  g_fileData = fileData;
};

exports.close = function () {};

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.loadMetadata = async function () {
  try {
    g_metadata = await epub.getMetadataFileData(
      g_fileData.path,
      g_fileData.password
    );
    base.sendIpcToRenderer(
      "load-metadata",
      g_metadata.json["package"]["metadata"],
      g_metadata.json["package"]["@_version"],
      undefined
    );
  } catch (error) {
    // TODO: recover or close with message?
  }
};

exports.saveMetadataToFile = async function (data) {};

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  let baseLocalizedText = base.getLocalizedText();
  base.sendIpcToRenderer(
    "update-localization",
    [...baseLocalizedText[0], ...getLocalization()],
    [...baseLocalizedText[1], ...getTooltipsLocalization()],
    {
      ...baseLocalizedText[2],
    },
    {
      uiTitles: _("tool-metadata-epub-titles"),
      uiTitle: _("ui-modal-info-metadata-title"),
      uiCreators: _("tool-metadata-section-creators"),
      uiCreator: _("ui-modal-info-metadata-creator"),
      uiFileAs: _("tool-metadata-epub-file-as"),
      uiRole: _("tool-metadata-epub-role"),
      uiAdd: _("tool-shared-ui-add").toUpperCase(),
      uiRemove: _("ui-modal-prompt-button-remove").toUpperCase(),
    }
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getTooltipsLocalization() {
  return [];
}

function getLocalization() {
  return [
    {
      id: "tool-metadata-title-text",
      text:
        _("tool-metadata-title").toUpperCase() +
        " (" +
        _("tool-shared-ui-experimental").toUpperCase() +
        ")",
    },
    //////////////////////////////////////////////
    {
      id: "tool-metadata-section-2-button-text",
      text: _("tool-metadata-section-details"),
    },
    ////////////////////////////////
    {
      id: "tool-metadata-section-2-text",
      text: _("tool-metadata-section-details"),
    },
    ////////////////////////////////
  ];
}

// refs:
// https://readium.org/architecture/streamer/parser/metadata.html
// https://www.w3.org/TR/epub/
// https://web.archive.org/web/20140715081956/http://epubzone.org/news/epub-3-packaging-and-metadata
// https://sketchytech.blogspot.com/2014/03/epub2-to-epub3-lessons-learnt-in.html
// https://wiki.kavitareader.com/guides/metadata/epubs
// https://komga.org/docs/guides/scan-analysis-refresh/

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
