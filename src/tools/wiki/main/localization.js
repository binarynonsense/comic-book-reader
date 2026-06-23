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
      id: "tool-wiki-title-text",
      text: _("tool-wiki-title").toUpperCase(),
    },
    {
      id: "tool-wiki-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-wiki-section-0-text",
      text: _("tool-rss-feed-content"),
    },
  ];
};

exports.getExtraLocalization = function () {
  return { loadingTitle: _("tool-shared-modal-title-loading") };
};
