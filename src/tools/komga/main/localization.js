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
  ];
};

exports.getExtraLocalization = function () {
  return {
    loadingTitle: _("tool-shared-modal-title-loading"),
    // content
    noContent: _("tool-komga-no-content-message"),
  };
};
