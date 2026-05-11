/**
 * @license
 * Copyright 2025-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const i18n = require("../../../shared/main/i18n");
const { _ } = require("../../../shared/main/i18n");

exports.getLocalization = function () {
  return [
    {
      id: "tool-rss-title-text",
      text: _("menu-tools-rss-reader").toUpperCase(),
    },
    {
      id: "tool-rss-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-rss-add-button-text",
      text: _("tool-shared-tab-openurl").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-reset-favorites-button-text",
      text: _("tool-shared-ui-reset-list").toUpperCase(),
    },
    {
      id: "tool-rss-clear-favorites-button-text",
      text: _("tool-shared-ui-clear-list").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-section-0-text",
      text: _("tool-rss-favorites"),
    },
    {
      id: "tool-rss-section-1-text",
      text: _("tool-shared-tab-search"),
    },
    {
      id: "tool-rss-section-2-text",
      text: _("tool-rss-feed-content"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-favorites-text",
      text: _("tool-rss-favorites"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-rss-search-input-text",
      text: _("tool-shared-ui-search-input"),
    },
    {
      id: "tool-rss-search-input-placeholder-text",
      text: _("tool-shared-ui-search-placeholder"),
    },
    {
      id: "tool-rss-search-button-text",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },
    {
      id: "tool-rss-search-results-text",
      text: _("tool-shared-ui-search-results"),
    },
  ];
};

exports.getExtraLocalization = function () {
  return {
    edit: _("ui-modal-prompt-button-edit"),
    editName: _("ui-modal-prompt-button-edit-name"),
    reload: _("tool-shared-ui-reload"),
    addToFavorites: _("tool-rss-add-to-favorites"),
    removeFromFavorites: _("tool-rss-remove-from-favorites"),
    // remove: _("tool-shared-tooltip-remove-from-list"),
    moreOptions: _("tool-shared-tab-moreoptions"),
    feedError: _("tool-rss-feed-error"),
    openInBrowser: _("tool-shared-ui-search-item-open-browser"),
    loadingTitle: _("tool-shared-modal-title-loading"),
    openInAudioPlayer: _("ui-modal-prompt-button-open-in-mediaplayer"),
    cancel: _("tool-shared-ui-cancel"),
    addToPlaylist: _("ui-modal-prompt-button-add-to-playlist"),
    startPlaylist: _("ui-modal-prompt-button-start-new-playlist"),
    // content
    noContent: _("tool-rss-no-content-message"),
    expandContent: _("tool-shared-ui-expand-list"),
    collapseContent: _("tool-shared-ui-collapse-list"),
    // favorites
    options: _("tool-shared-tab-options"),
    open: _("ui-modal-prompt-button-open"),
    back: _("tool-shared-ui-back"),
    removeFromList: _("tool-shared-tooltip-remove-from-list"),
    // _("ui-modal-prompt-button-edit-name"),
    // _("ui-modal-prompt-button-edit-url"),
    moveUpInList: _("tool-shared-tooltip-move-up-in-list"),
    moveDownInList: _("tool-shared-tooltip-move-down-in-list"),
    // search
    searching: _("tool-shared-modal-title-searching"),
    searchNoResults: _("tool-shared-ui-search-nothing-found"),
    searchType1: _("tool-rss-search-type-podcasts"),
    searchType2: _("tool-rss-search-type-websites"),
    searchPlaceholderType1: _(
      "tool-rss-search-type-podcasts-placeholder",
      "comic books",
    ),
    searchPlaceholderType2: _(
      "tool-rss-search-type-websites-placeholder",
      "binarynonsense.com",
    ),
  };
};
