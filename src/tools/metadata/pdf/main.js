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
  base.sendIpcToRenderer("set-subtool", "pdf");
  updateLocalizedText();
  base.sendIpcToRenderer("show", fileData);
  g_fileData = fileData;
};

exports.close = function () {};

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.loadMetadata = async function () {
  const { PDFDocument } = require("pdf-lib");
  const pdf = await PDFDocument.load(fs.readFileSync(g_fileData.path), {
    updateMetadata: false,
  });

  g_metadata = {};
  g_metadata["title"] = pdf.getTitle();
  g_metadata["author"] = pdf.getAuthor();
  g_metadata["subject"] = pdf.getSubject();
  g_metadata["keywords"] = pdf.getKeywords();
  g_metadata["creator"] = pdf.getCreator();
  g_metadata["producer"] = pdf.getProducer();
  g_metadata["creationDate"] = pdf.getCreationDate();
  g_metadata["modificationDate"] = pdf.getModificationDate();

  base.sendIpcToRenderer("load-metadata", g_metadata);
};

exports.saveMetadataToFile = async function (data) {
  const { PDFDocument } = require("pdf-lib");
  const pdf = await PDFDocument.load(fs.readFileSync(g_fileData.path));

  if (data["title"]) pdf.setTitle(data["title"]);
  if (data["author"]) pdf.setAuthor(data["author"]);
  if (data["subject"]) pdf.setSubject(data["subject"]);
  if (data["keywords"]) {
    if (
      !Array.isArray(data["keywords"]) &&
      typeof data["keywords"] === "string"
    ) {
      data["keywords"] = [data["keywords"]];
    }
    pdf.setKeywords(data["keywords"]); // must be array
  }
  if (data["producer"]) pdf.setProducer(data["producer"]);
  if (data["creator"]) pdf.setCreator(data["creator"]);
  let creationDate = new Date(data["creationDate"]);
  if (creationDate && creationDate.toString() !== "Invalid Date") {
    pdf.setCreationDate(creationDate);
  }
  let modificationDate = new Date(data["creationDate"]);
  if (modificationDate && modificationDate.toString() !== "Invalid Date") {
    pdf.setCreationDate(modificationDate);
  }

  const pdfBytes = await pdf.save();
  fs.writeFileSync(g_fileData.path, pdfBytes);
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
      ...baseLocalizedText[2],
    },
    {
      title: _("ui-modal-info-metadata-title"),
      author: _("ui-modal-info-metadata-author"),
      subject: _("ui-modal-info-metadata-subject"),
      keywords: _("ui-modal-info-metadata-keywords"),
      creator: _("ui-modal-info-metadata-creator"),
      producer: _("ui-modal-info-metadata-producer"),
      creationDate: _("ui-modal-info-metadata-created"),
      modificationDate: _("ui-modal-info-metadata-modified"),
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
      text: _("tool-metadata-title").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-metadata-section-2-button-text",
      text: _("tool-metadata-section-details"),
    },
    {
      id: "tool-metadata-section-3-button-text",
      text: _("tool-metadata-section-other-data"),
    },
    ////////////////////////////////
    {
      id: "tool-metadata-section-2-text",
      text: _("tool-metadata-section-details"),
    },
    {
      id: "tool-metadata-section-3-text",
      text: _("tool-metadata-section-other-data"),
    },
    ////////////////////////////////
  ];
}
