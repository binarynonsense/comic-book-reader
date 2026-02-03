/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { _, _raw } = require("../../../shared/main/i18n");

exports.getLocalizedTexts = function () {
  return {
    infoTooltip: _("tool-shared-modal-title-info"),
  };
};

exports.getTooltipsLocalization = function () {
  return [
    {
      id: "tool-ec-tooltip-output-size",
      text: _("tool-shared-tooltip-output-scale-options"),
    },
    {
      id: "tool-ec-tooltip-output-folder",
      text: _("tool-shared-tooltip-output-folder"),
    },
    {
      id: "tool-ec-tooltip-remove-from-list",
      text: _("tool-shared-tooltip-remove-from-list"),
    },
    // {
    //   id: "tool-ec-tooltip-pdf-extraction",
    //   text: _("tool-shared-ui-pdf-extraction-tooltip"),
    // },
    {
      id: "tool-ec-tooltip-imageops-crop",
      text: _("tool-shared-ui-imageops-order-before-tooltip"),
    },
    {
      id: "tool-ec-tooltip-imageops-extend",
      text: _("tool-shared-ui-imageops-order-after-tooltip"),
    },
  ];
};

exports.getLocalization = function () {
  return [
    {
      id: "tool-ec-title-text",
      text: (_raw("tool-ec-title-alt", false)
        ? _raw("tool-ec-title-alt", false)
        : _("tool-ec-title")
      ).toUpperCase(),
    },
    {
      id: "tool-ec-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-ec-start-button-text",
      text: _("tool-shared-ui-extract").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-section-general-options-text",
      text: _("tool-shared-ui-general-options"),
    },
    {
      id: "tool-ec-section-advanced-options-text",
      text: _("tool-shared-ui-advanced-options"),
    },
    {
      id: "tool-ec-section-settings-text",
      text: _("tool-shared-tab-settings"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-input-options-text",
      text: _("tool-shared-ui-input-options"),
    },
    {
      id: "tool-ec-input-files-text",
      text: _("tool-shared-ui-input-files"),
    },
    {
      id: "tool-ec-add-file-button-text",
      text: _("tool-shared-ui-add").toUpperCase(),
    },
    {
      id: "tool-ec-clear-list-button-text",
      text: _("tool-shared-ui-clear-list").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-output-options-text",
      text: _("tool-shared-ui-output-options"),
    },

    {
      id: "tool-ec-output-image-scale-text",
      text: _("tool-shared-ui-output-options-scale").replace(" (%)", ""),
    },
    {
      id: "tool-ec-output-image-scale-select-0-text",
      text: _("tool-shared-ui-output-options-scale-percentage"),
    },
    {
      id: "tool-ec-output-image-scale-select-1-text",
      text: _("tool-shared-ui-output-options-scale-height"),
    },
    {
      id: "tool-ec-output-image-scale-select-2-text",
      text: _("tool-shared-ui-output-options-scale-width"),
    },

    {
      id: "tool-ec-output-format-text",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "tool-ec-output-image-format-text",
      text: _("tool-shared-ui-output-options-image-format"),
    },
    {
      id: "tool-ec-output-image-quality-text",
      text: _("tool-shared-ui-output-options-image-quality"),
    },
    {
      id: "tool-ec-output-folder-text",
      text: _("tool-shared-ui-output-folder"),
    },
    {
      id: "tool-ec-change-folder-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-ec-open-folder-button-text",
      text: _("tool-shared-ui-open").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-imageprocessing-options-text",
      text: _("tool-shared-ui-imageprocessing-options"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-advanced-input-options-text",
      text: _("tool-shared-ui-advanced-input-options"),
    },
    {
      id: "tool-ec-pdf-extraction-text",
      text: _("tool-shared-ui-pdf-extraction"),
    },

    //////////////////////////////////////////////
    {
      id: "tool-ec-advanced-output-options-text",
      text: _("tool-shared-ui-advanced-output-options"),
    },
    {
      id: "tool-ec-pdf-extraction-lib-o-pdfjs1-text",
      text: `PDF.js ${_("tool-pre-pdf-library-version-oldest")} (${_(
        "tool-pre-pdf-library-version-oldest-desc",
      )})`,
    },
    {
      id: "tool-ec-pdf-extraction-lib-o-pdfjs2-text",
      text: `PDF.js ${_("tool-pre-pdf-library-version-newest")} (${_(
        "tool-pre-pdf-library-version-newest-desc",
      )})`,
    },
    {
      id: "tool-ec-pdf-extraction-lib-o-pdfium-text",
      text: `PDFium (${_("tool-shared-ui-experimental").toLowerCase()})`,
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-advanced-imageprocessing-options-text",
      text: _("tool-shared-ui-advanced-imageprocessing-options"),
    },
    {
      id: "tool-ec-imageprocessing-multithreading-method-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-method"),
    },
    {
      id: "tool-ec-imageprocessing-multithreading-method-0-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-method-0"),
    },
    {
      id: "tool-ec-imageprocessing-multithreading-method-1-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-method-1"),
    },
    {
      id: "tool-ec-imageprocessing-multithreading-numworkers-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-numworkers"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-keep-format-text",
      text: _("tool-shared-ui-output-options-format-keep"),
    },

    {
      id: "tool-ec-modal-close-button-text",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
    {
      id: "tool-ec-modal-cancel-button-text",
      text: _("tool-shared-ui-cancel").toUpperCase(),
    },
    {
      id: "tool-ec-modal-copylog-button-text",
      text: _("ui-modal-prompt-button-copy-log").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-settings-text",
      text: _("tool-shared-tab-settings"),
    },
    {
      id: "tool-ec-setting-remember-text",
      text: _("tool-shared-ui-settings-remember"),
    },
    {
      id: "tool-ec-settings-reset-button-text",
      text: _("tool-shared-ui-settings-reset").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-ec-imageops-apply-text",
      text: _("tool-shared-ui-creation-imageops-apply"),
    },
    {
      id: "tool-ec-imageops-brightness-text",
      text: _("tool-shared-ui-creation-brightnessmultiplier"),
    },
    {
      id: "tool-ec-imageops-saturation-text",
      text: _("tool-shared-ui-creation-saturationmultiplier"),
    },
    {
      id: "tool-ec-imageops-crop-text",
      text: `${_("tool-shared-ui-imageops-crop-border")} (px)`,
    },
    {
      id: "tool-ec-imageops-extend-text",
      text: `${_("tool-shared-ui-imageops-add-border")} (px)`,
    },
    //////////////////////////////////////////////
  ];
};
