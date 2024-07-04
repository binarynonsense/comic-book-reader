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
let g_xmlData;

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
    g_xmlData = await epub.getMetadataFileXmlData(
      g_fileData.path,
      g_fileData.password
    );
    base.sendIpcToRenderer(
      "load-metadata",
      g_xmlData.json["package"]["metadata"],
      g_xmlData.json["package"]["@_version"],
      undefined
    );
  } catch (error) {
    // TODO: recover or close with message?
  }
};

exports.saveMetadataToFile = async function (metadata) {
  let newXmlData = structuredClone(g_xmlData);
  newXmlData.json["package"]["metadata"] = structuredClone(metadata);
  let result = await epub.saveXmlDataToMetadataFile(newXmlData);
  if (result) {
    base.sendIpcToRenderer("saving-done");
  } else {
    base.sendIpcToRenderer("saving-done", "Xml Error");
  }
};

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
      savingMessageUpdate: _("tool-metadata-modal-message-warning-save-update"),
      savingMessageSuccessUpdate: _(
        "tool-metadata-modal-message-success-update"
      ),
      savingMessageErrorUpdate: _(
        "tool-metadata-modal-message-could-not-update"
      ),
      savingMessageInvalidChanges: _(
        "tool-metadata-modal-message-invalid-changes"
      ),
      ...baseLocalizedText[2],
    },
    {
      uiFileAs: _("tool-metadata-epub-file-as"),
      uiRole: _("tool-metadata-epub-role"),
      uiAdd: _("tool-shared-ui-add").toUpperCase(),
      uiRemove: _("ui-modal-prompt-button-remove").toUpperCase(),

      uiTagNames: {
        title: _("ui-modal-info-metadata-title"),
        creator: _("ui-modal-info-metadata-creator"),
        description: _("tool-metadata-data-summary"),
        subject: _("ui-modal-info-metadata-subject"),
        language: _("ui-modal-info-metadata-language"),
        publisher: _("ui-modal-info-metadata-publisher"),
        date: _("ui-modal-info-metadata-publicationdate"),
        series: _("tool-metadata-data-series"),
        number: _("tool-metadata-data-number"),
        //volume: _("tool-metadata-data-volume"),
      },

      role: {
        aut: _("ui-modal-info-metadata-author"),
        pbl: _("tool-metadata-data-publisher"),
        trl: _("tool-metadata-data-translator"),
        ill: _("tool-metadata-data-illustrator"),
        art: _("tool-metadata-data-artist"),
        clr: _("tool-metadata-data-colorist"),
        nrt: _("tool-metadata-data-narrator"),
        cov: _("tool-metadata-data-coverartist"),
        edt: _("tool-metadata-data-editor"),
      },
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
    {
      id: "tool-metadata-section-3-button-text",
      text: _("tool-metadata-section-creators"),
    },
    ////////////////////////////////
    {
      id: "tool-metadata-section-2-text",
      text: _("tool-metadata-section-details"),
    },
    {
      id: "tool-metadata-section-3-text",
      text: _("tool-metadata-section-creators"),
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
