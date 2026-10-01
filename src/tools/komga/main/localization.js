/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const i18n = require("../../../shared/main/i18n");
const { _ } = require("../../../shared/main/i18n");

exports.getLocalization = function () {
  return [
    {
      id: "tool-komga-title-text",
      text: _("tool-komga-title").toUpperCase(),
    },
    {
      id: "tool-komga-back-button-text",
      text: _("menu-file-closetool").toUpperCase(),
    },
    {
      id: "tool-komga-add-button-text",
      text: _("tool-komga-button-connect").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-komga-section-0-text",
      text: _("tool-komga-servers-list"),
    },
    {
      id: "tool-komga-section-1-text",
      text: _("tool-komga-server-content"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-komga-saved-servers-text",
      text: _("tool-komga-saved-servers"),
    },
    //////////////////////////////////////////////
  ];
};

exports.getExtraLocalization = function () {
  return {
    loadingTitle: _("tool-shared-modal-title-loading"),
    // sections
    libraries: _("tool-komga-section-libraries"),
    series: _("tool-komga-section-series"),
    books: _("tool-komga-section-books"),
    keepReading: _("tool-komga-subsection-keepreading"),
    recentlyAddedBooks: _("tool-komga-subsection-recentlyaddedbooks"),
    recentlyAddedSeries: _("tool-komga-subsection-recentlyaddedseries"),
    recentlyUpdatedSeries: _("tool-komga-subsection-recentlyupdatedseries"),
    recentlyFinished: _("tool-komga-subsection-recentlyfinished"),
    // servers
    noServers: _("tool-komga-no-servers-message"),
    // content
    back: _("tool-shared-ui-back"),
    search: _("menu-tools-search"),
    history: _("tool-hst-title"),
    noContent: _("tool-komga-no-content-message"),
    // favorites
    options: _("tool-shared-tab-options"),
    connect: _("tool-komga-button-connect"),
    open: _("ui-modal-prompt-button-open"),
    back: _("tool-shared-ui-back"),
    removeFromList: _("tool-shared-tooltip-remove-from-list"),
    moveUpInList: _("tool-shared-tooltip-move-up-in-list"),
    moveDownInList: _("tool-shared-tooltip-move-down-in-list"),
    // book
    creators: _("tool-metadata-section-creators"),
    fileSize: _("ui-modal-info-metadata-filesize"),
    numPages: _("tool-metadata-section-pages"),
    tags: "Tags",
    filePath: _("ui-modal-info-metadata-filepath"),
    unknown: _("tool-metadata-data-manga-option-unknown"),
    none: _("menu-view-filter-none"),
    format: _("tool-metadata-data-format"),
    file: _("tool-shared-ui-output-options-file"),
    progress: _("tool-komga-reading-progress"),
    completed: _("tool-komga-reading-progress-completed"),
    noSummary: _("tool-komga-no-summary"),
    //tool-metadata-data-summary
  };
};
