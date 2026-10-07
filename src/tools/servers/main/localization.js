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
      id: "tool-servers-title-text",
      text: _("tool-servers-title-alt").toUpperCase(),
    },
    {
      id: "tool-servers-back-button-text",
      text: _("menu-file-closetool").toUpperCase(),
    },
    {
      id: "tool-servers-add-button-text",
      text: _("tool-servers-button-connect").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-servers-section-0-text",
      text: _("tool-servers-servers-list"),
    },
    {
      id: "tool-servers-section-1-text",
      text: _("tool-servers-server-content"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-servers-saved-servers-text",
      text: _("tool-servers-saved-servers"),
    },
    //////////////////////////////////////////////
  ];
};

exports.getExtraLocalization = function () {
  return {
    loadingTitle: _("tool-shared-modal-title-loading"),
    downloadingTitle: _("tool-shared-modal-title-downloading"),
    cancelButton: _("tool-shared-ui-cancel"),
    okButton: _("ui-modal-prompt-button-ok"),
    errorTitle: _("tool-shared-modal-title-error"),
    // sections
    activity: _("tool-servers-section-activity"),
    libraries: _("tool-servers-section-libraries"),
    series: _("tool-servers-section-series"),
    books: _("tool-servers-section-books"),
    keepReading: _("tool-servers-subsection-keepreading"),
    recentlyAddedBooks: _("tool-servers-subsection-recentlyaddedbooks"),
    recentlyAddedSeries: _("tool-servers-subsection-recentlyaddedseries"),
    recentlyUpdatedSeries: _("tool-servers-subsection-recentlyupdatedseries"),
    recentlyFinished: _("tool-servers-subsection-recentlyfinished"),
    // servers
    noServers: _("tool-servers-no-servers-message"),
    passwordType: _("tool-servers-modal-credentials-type-password"),
    // content
    back: _("tool-shared-ui-back"),
    search: _("menu-tools-search"),
    noContent: _("tool-servers-no-content-message"),
    noSearchResults: _("tool-shared-ui-search-nothing-found"),
    // favorites
    options: _("tool-shared-tab-options"),
    connect: _("tool-servers-button-connect"),
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
    progress: _("tool-servers-reading-progress"),
    completed: _("tool-servers-reading-progress-completed"),
    noSummary: _("tool-servers-no-summary"),
    summary: _("tool-metadata-data-summary"),
    // activity
    keepReading: _("tool-servers-subsection-keepreading"),
    wantToRead: _("tool-servers-subsection-wanttoread"),
    recentlyAddedBooks: _("tool-servers-subsection-recentlyaddedbooks"),
    recentlyAddedSeries: _("tool-servers-subsection-recentlyaddedseries"),
    recentlyUpdatedSeries: _("tool-servers-subsection-recentlyupdatedseries"),
    recentlyFinished: _("tool-servers-subsection-recentlyfinished"),
    btnSeeAllBooks: _("tool-servers-button-see-all-books"),
    btnSeeAllSeries: _("tool-servers-button-see-all-series"),
  };
};
