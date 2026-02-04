/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { _, _raw } = require("../../../shared/main/i18n");

const ToolMode = {
  CONVERT: 0,
  CREATE: 1,
};

exports.getLocalizedTexts = function () {
  return {
    infoTooltip: _("tool-shared-modal-title-info"),
    removeFromList: _("tool-shared-tooltip-remove-from-list"),
    moveUpInList: _("tool-shared-tooltip-move-up-in-list"),
    moveDownInList: _("tool-shared-tooltip-move-down-in-list"),
    outputImageFormatNotSet: _("tool-shared-ui-output-options-format-keep"),
    modalCloseButton: _("tool-shared-ui-close").toUpperCase(),
    modalCancelButton: _("tool-shared-ui-cancel").toUpperCase(),
    modalCopyLogButton: _("ui-modal-prompt-button-copy-log").toUpperCase(),
    outputFolderOption0: _("tool-shared-ui-output-folder-0"),
    outputFolderOption1: _("tool-shared-ui-output-folder-1"),
    outputFileSameNameOption0: _("tool-shared-ui-output-file-same-name-0"),
    outputFileSameNameOption1:
      "⚠ " + _("tool-shared-ui-output-file-same-name-1") + " ⚠",
    outputFileSameNameOption2: _("tool-shared-ui-output-file-same-name-2"),
  };
};

exports.getTooltipsLocalization = function () {
  return [
    {
      id: "tool-cc-tooltip-output-size",
      text: _("tool-shared-tooltip-output-scale-options"),
    },
    {
      id: "tool-cc-tooltip-output-page-order",
      text: _("tool-shared-tooltip-output-page-order"),
    },
    {
      id: "tool-cc-tooltip-output-folder",
      text: _("tool-shared-tooltip-output-folder"),
    },
    // {
    //   id: "tool-cc-tooltip-pdf-extraction",
    //   text: _("tool-shared-ui-pdf-extraction-tooltip"),
    // },
    {
      id: "tool-cc-tooltip-password",
      text: _("tool-shared-ui-creation-password-tooltip", "cbz, cb7, cbr, pdf"),
    },
    {
      id: "tool-cc-tooltip-pdf-creation",
      text: _("tool-shared-ui-pdf-creation-tooltip"),
    },
    {
      id: "tool-cc-tooltip-imageops-crop",
      text: _("tool-shared-ui-imageops-order-before-tooltip"),
    },
    {
      id: "tool-cc-tooltip-imageops-extend",
      text: _("tool-shared-ui-imageops-order-after-tooltip"),
    },
    {
      id: "tool-cc-tooltip-keep-subfolders-structure",
      text: _(
        "tool-shared-ui-output-options-keep-subfolders-tooltip",
        _("tool-shared-ui-output-folder"),
        _("tool-shared-ui-output-folder-0"),
        _("tool-shared-ui-input-folders-recursively"),
      ),
    },
  ];
};

exports.getLocalization = function (mode) {
  return [
    {
      id: "tool-cc-title-text",
      text:
        mode === ToolMode.CONVERT
          ? (_raw("tool-cc-title-alt", false)
              ? _raw("tool-cc-title-alt", false)
              : _("tool-cc-title")
            ).toUpperCase()
          : (_raw("tool-cr-title-alt", false)
              ? _raw("tool-cr-title-alt", false)
              : _("tool-cr-title")
            ).toUpperCase(),
    },
    {
      id: "tool-cc-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-cc-start-button-text",
      text:
        mode === ToolMode.CONVERT
          ? _("tool-shared-ui-convert").toUpperCase()
          : _("tool-shared-ui-create").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-section-general-options-text",
      text: _("tool-shared-ui-general-options"),
    },
    {
      id: "tool-cc-section-advanced-options-text",
      text: _("tool-shared-ui-advanced-options"),
    },
    {
      id: "tool-cc-section-settings-text",
      text: _("tool-shared-tab-settings"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-input-options-text",
      text: _("tool-shared-ui-input-options"),
    },
    {
      id: "tool-cc-input-files-text",
      text: _("tool-shared-ui-input-list"),
    },
    {
      id: "tool-cc-add-file-button-text",
      text: _("tool-shared-ui-add-files").toUpperCase(),
    },
    {
      id: "tool-cc-add-folder-button-text",
      text: _("tool-shared-ui-add-folders").toUpperCase(),
    },
    {
      id: "tool-cc-clear-list-button-text",
      text: _("tool-shared-ui-clear-list").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-output-options-text",
      text: _("tool-shared-ui-output-options"),
    },
    {
      id: "tool-cc-output-format-text",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "tool-cc-output-name-text",
      text: _("tool-shared-ui-output-options-file-name"),
    },
    {
      id: "tool-cc-output-page-order-text",
      text: _("tool-shared-ui-output-options-page-order"),
    },
    {
      id: "tool-cc-output-page-order-o1-text",
      text: _("tool-shared-ui-output-options-page-order-o1"),
    },
    {
      id: "tool-cc-output-page-order-o2-text",
      text: _("tool-shared-ui-output-options-page-order-o2"),
    },

    {
      id: "tool-cc-output-image-scale-text",
      text: _("tool-shared-ui-output-options-scale").replace(" (%)", ""),
    },
    {
      id: "tool-cc-output-image-scale-select-0-text",
      text: _("tool-shared-ui-output-options-scale-percentage"),
    },
    {
      id: "tool-cc-output-image-scale-select-1-text",
      text: _("tool-shared-ui-output-options-scale-height"),
    },
    {
      id: "tool-cc-output-image-scale-select-2-text",
      text: _("tool-shared-ui-output-options-scale-width"),
    },

    {
      id: "tool-cc-output-format-text",
      text: _("tool-shared-ui-output-options-format"),
    },
    {
      id: "tool-cc-output-image-format-text",
      text: _("tool-shared-ui-output-options-image-format"),
    },
    {
      id: "tool-cc-output-image-quality-text",
      text: _("tool-shared-ui-output-options-image-quality"),
    },
    {
      id: "tool-cc-output-folder-text",
      text: _("tool-shared-ui-output-folder"),
    },
    {
      id: "tool-cc-change-folder-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-cc-open-folder-button-text",
      text: _("tool-shared-ui-open").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-imageprocessing-options-text",
      text: _("tool-shared-ui-imageprocessing-options"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-input-folders-text",
      text: _("tool-shared-ui-input-folders"),
    },
    {
      id: "tool-cc-folders-contain-text",
      text: _("tool-shared-ui-input-folders-contain"),
    },
    {
      id: "tool-cc-folders-contain-o0-text",
      text: _("tool-shared-ui-input-folders-contain-0"),
    },
    {
      id: "tool-cc-folders-contain-o1-text",
      text: _("tool-shared-ui-input-folders-contain-1"),
    },
    {
      id: "tool-cc-advanced-input-options-text",
      text: _("tool-shared-ui-advanced-input-options"),
    },
    {
      id: "tool-cc-folders-file-formats-text",
      text: _("tool-shared-ui-input-folders-file-type"),
    },
    {
      id: "tool-cc-folders-recursively-text",
      text: _("tool-shared-ui-input-folders-recursively"),
    },
    {
      id: "tool-cc-pdf-extraction-text",
      text: _("tool-shared-ui-pdf-extraction"),
    },
    {
      id: "tool-cc-pdf-extraction-method-select-0-text",
      text: "dpi",
    },
    {
      id: "tool-cc-pdf-extraction-method-select-1-text",
      text: _("tool-shared-ui-output-options-scale-height"),
    },
    {
      id: "tool-cc-pdf-extraction-lib-o-pdfjs1-text",
      text: `PDF.js ${_("tool-pre-pdf-library-version-oldest")} (${_(
        "tool-pre-pdf-library-version-oldest-desc",
      )})`,
    },
    {
      id: "tool-cc-pdf-extraction-lib-o-pdfjs2-text",
      text: `PDF.js ${_("tool-pre-pdf-library-version-newest")} (${_(
        "tool-pre-pdf-library-version-newest-desc",
      )})`,
    },
    {
      id: "tool-cc-pdf-extraction-lib-o-pdfium-text",
      text: `PDFium (${_("tool-shared-ui-experimental").toLowerCase()})`,
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-advanced-imageprocessing-options-text",
      text: _("tool-shared-ui-advanced-imageprocessing-options"),
    },
    {
      id: "tool-cc-imageprocessing-multithreading-method-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-method"),
    },
    {
      id: "tool-cc-imageprocessing-multithreading-method-0-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-method-0"),
    },
    {
      id: "tool-cc-imageprocessing-multithreading-method-1-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-method-1"),
    },
    {
      id: "tool-cc-imageprocessing-multithreading-numworkers-text",
      text: _("tool-shared-ui-imageprocessing-multithreading-numworkers"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-advanced-output-options-text",
      text: _("tool-shared-ui-advanced-output-options"),
    },
    {
      id: "tool-cc-keep-subfolders-structure-text",
      text: _("tool-shared-ui-output-options-keep-subfolders"),
    },
    {
      id: "tool-cc-output-file-same-name-text",
      text: _("tool-shared-ui-output-file-same-name"),
    },
    {
      id: "tool-cc-split-num-files-text",
      text: _("tool-shared-ui-creation-split-number"),
    },
    {
      id: "tool-cc-password-text",
      text: _("tool-shared-ui-creation-password"),
    },
    {
      id: "tool-cc-pdf-creation-text",
      text: _("tool-shared-ui-pdf-creation"),
    },
    {
      id: "tool-cc-pdf-creation-o1-text",
      text: _("tool-shared-ui-pdf-creation-o1"),
    },
    {
      id: "tool-cc-pdf-creation-o2-text",
      text: _("tool-shared-ui-pdf-creation-o2"),
    },
    {
      id: "tool-cc-pdf-creation-o3-text",
      text: _("tool-shared-ui-pdf-creation-o3"),
    },

    {
      id: "tool-cc-epub-creation-text",
      text: _("tool-shared-ui-epub-creation"),
    },
    {
      id: "tool-cc-epub-creation-image-format-o1-text",
      text: _("tool-shared-ui-epub-creation-image-format-o1"),
    },
    {
      id: "tool-cc-epub-creation-image-format-o2-text",
      text: _("tool-shared-ui-epub-creation-image-format-o2"),
    },
    {
      id: "tool-cc-epub-creation-image-storage-o1-text",
      text: _("tool-shared-ui-epub-creation-image-storage-o1"),
    },
    {
      id: "tool-cc-epub-creation-image-storage-o2-text",
      text: _("tool-shared-ui-epub-creation-image-storage-o2"),
    },
    {
      id: "tool-cc-imageops-apply-text",
      text: _("tool-shared-ui-creation-imageops-apply"),
    },
    {
      id: "tool-cc-imageops-brightness-text",
      text: _("tool-shared-ui-creation-brightnessmultiplier"),
    },
    {
      id: "tool-cc-imageops-saturation-text",
      text: _("tool-shared-ui-creation-saturationmultiplier"),
    },
    {
      id: "tool-cc-imageops-crop-text",
      text: `${_("tool-shared-ui-imageops-crop-border")} (px)`,
    },
    {
      id: "tool-cc-imageops-extend-text",
      text: `${_("tool-shared-ui-imageops-add-border")} (px)`,
    },
    //////////////////////////////////////////////
    {
      id: "tool-cc-settings-text",
      text: _("tool-shared-tab-settings"),
    },
    {
      id: "tool-cc-setting-remember-text",
      text: _("tool-shared-ui-settings-remember"),
    },
    {
      id: "tool-cc-settings-reset-button-text",
      text: _("tool-shared-ui-settings-reset").toUpperCase(),
    },
    //////////////////////////////////////////////
  ];
};
