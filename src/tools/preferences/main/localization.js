/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const i18n = require("../../../shared/main/i18n");
const { _ } = require("../../../shared/main/i18n");

exports.getExtraLocalization = function () {
  return {
    infoTooltip: _("tool-shared-modal-title-info"),
    unassignedMouseButton: _("tool-pre-navkeys-unassigned-key"),
    modalTitleWarning: _("tool-shared-modal-title-warning"),
    modalButtonOK: _("tool-shared-ui-restart-program"),
    modalButtonCancel: _("ui-modal-prompt-button-cancel"),
    resetAllWarning:
      _("tool-pre-modal-resetall-message") +
      "\n\n" +
      _("tool-shared-modal-info-changes-needs-restart"),
    openInSystemFileBrowser: _(
      "ui-modal-prompt-button-open-in-system-file-browser",
    ),
    modalChangeMaxTitleText: _("tool-shared-modal-title-warning"),
    modalChangeMaxMessageText: _("tool-hst-modal-changemaxfiles-message"),
    modalClearAllOkText: _("ui-modal-prompt-button-yes"),
    modalClearAllCancelText: _("ui-modal-prompt-button-cancel"),
  };
};

exports.getTooltipsLocalization = function () {
  return [
    {
      id: "tool-pre-tooltip-rarfolder",
      text: `${_(
        "tool-pre-rarfolder-tooltip",
        process.platform === "win32" ? '"Rar.exe"' : '"rar"',
      )}${
        process.platform === "win32"
          ? " " + _("tool-pre-rarfolder-example", '"C:\\Program Files\\WinRAR"')
          : ""
      }`,
    },
  ];
};

exports.getLocalization = function () {
  return [
    {
      id: "tool-pre-title-text",
      text: _("tool-pre-title").toUpperCase(),
    },
    {
      id: "tool-pre-back-button-text",
      text: _("tool-shared-ui-back-to-reader").toUpperCase(),
    },
    {
      id: "tool-pre-reset-all-button-text",
      text: _("tool-pre-button-resetall").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-section-0-text",
      text: _("tool-pre-appearance"),
    },
    {
      id: "tool-pre-section-1-text",
      text: _("tool-pre-ui"),
    },
    {
      id: "tool-pre-section-2-text",
      text: _("tool-reader"),
    },
    {
      id: "tool-pre-section-3-text",
      text: _("home-screen"),
    },
    {
      id: "tool-pre-section-4-text",
      text: _("tool-pre-file-formats"),
    },
    {
      id: "tool-pre-section-5-text",
      text: _("tool-pre-updates"),
    },
    {
      id: "tool-pre-section-6-text",
      text: _("tool-pre-advanced-preferences"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-text-colors-text",
      text: _("tool-pre-text-colors"),
    },
    {
      id: "tool-pre-languages-text",
      text: _("tool-pre-language"),
    },
    {
      id: "tool-pre-themes-text",
      text: _("tool-pre-theme"),
    },
    {
      id: "tool-pre-themes-select-0",
      text: `${_("tool-shared-ui-color-mode-automatic")} (${_(
        "tool-shared-ui-color-mode-automatic-basedonsystem",
      )})`,
    },
    {
      id: "tool-pre-themes-select-1",
      text: `${_("tool-shared-ui-color-mode-automatic")} (${_(
        "tool-shared-ui-color-mode-automatic-basedontime",
      )})`,
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-history-text",
      text: _("tool-hst-title"),
    },
    {
      id: "tool-pre-history-recent-max-text",
      text: _("tool-hst-recentfiles-max"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-zoom-text",
      text: _("tool-pre-zoom"),
    },
    {
      id: "tool-pre-zoom-default-text",
      text: _("tool-pre-zoom-default"),
    },
    {
      id: "tool-pre-zoom-default-fitwidth-text",
      text: _("tool-pre-zoom-default-fitwidth"),
    },
    {
      id: "tool-pre-zoom-default-fitheight-text",
      text: _("tool-pre-zoom-default-fitheight"),
    },
    {
      id: "tool-pre-zoom-default-lastused-text",
      text: _("tool-pre-zoom-default-lastused"),
    },
    {
      id: "tool-pre-zoom-fileloading-text",
      text: _("tool-pre-zoom-fileloading"),
    },
    {
      id: "tool-pre-zoom-fileloading-default-text",
      text: _("tool-pre-zoom-fileloading-default"),
    },
    {
      id: "tool-pre-zoom-fileloading-history-text",
      text: _("tool-pre-zoom-fileloading-history"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-pagemode-text",
      text: _("menu-view-layout-pagemode"),
    },
    {
      id: "tool-pre-pagemode-default-text",
      text: _("tool-pre-zoom-default"),
    },
    {
      id: "tool-pre-pagemode-default-0-text",
      text: _("menu-view-layout-pagemode-singlepage"),
    },
    {
      id: "tool-pre-pagemode-default-1-text",
      text: _("menu-view-layout-pagemode-doublepage"),
    },
    {
      id: "tool-pre-pagemode-default-2-text",
      text:
        _("menu-view-layout-pagemode-doublepage") +
        " (" +
        _("menu-view-layout-pagemode-centerfirst") +
        ")",
    },
    {
      id: "tool-pre-pagemode-default-lastused-text",
      text: _("tool-pre-zoom-default-lastused"),
    },
    {
      id: "tool-pre-pagemode-fileloading-text",
      text: _("tool-pre-zoom-fileloading"),
    },
    {
      id: "tool-pre-pagemode-fileloading-default-text",
      text: _("tool-pre-zoom-fileloading-default"),
    },
    {
      id: "tool-pre-pagemode-fileloading-history-text",
      text: _("tool-pre-zoom-fileloading-history"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-layout-text",
      text: _("tool-pre-layout"),
    },

    {
      id: "tool-pre-layout-clock-text",
      text: _("tool-pre-layout-clock"),
    },
    {
      id: "tool-pre-layout-clock-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-clock-1-text",
      text: _("menu-shared-top-center"),
    },
    {
      id: "tool-pre-layout-clock-2-text",
      text: _("menu-shared-top-right"),
    },
    {
      id: "tool-pre-layout-clock-3-text",
      text: _("menu-shared-bottom-left"),
    },
    {
      id: "tool-pre-layout-clock-4-text",
      text: _("menu-shared-bottom-center"),
    },
    {
      id: "tool-pre-layout-clock-5-text",
      text: _("menu-shared-bottom-right"),
    },

    {
      id: "tool-pre-clock-format-text",
      text: _("tool-pre-clock-format"),
    },

    {
      id: "tool-pre-layout-pagenum-text",
      text: _("tool-pre-layout-pagenum"),
    },
    {
      id: "tool-pre-layout-pagenum-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-pagenum-1-text",
      text: _("menu-shared-top-center"),
    },
    {
      id: "tool-pre-layout-pagenum-2-text",
      text: _("menu-shared-top-right"),
    },
    {
      id: "tool-pre-layout-pagenum-3-text",
      text: _("menu-shared-bottom-left"),
    },
    {
      id: "tool-pre-layout-pagenum-4-text",
      text: _("menu-shared-bottom-center"),
    },
    {
      id: "tool-pre-layout-pagenum-5-text",
      text: _("menu-shared-bottom-right"),
    },
    {
      id: "tool-pre-layout-audioplayer-text",
      text: _("tool-pre-layout-audioplayer"),
    },

    {
      id: "tool-pre-layout-audioplayer-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-audioplayer-1-text",
      text: _("menu-shared-bottom-left"),
    },

    {
      id: "tool-pre-layout-battery-text",
      text: _("tool-pre-layout-battery"),
    },
    {
      id: "tool-pre-layout-battery-0-text",
      text: _("menu-shared-top-left"),
    },
    {
      id: "tool-pre-layout-battery-1-text",
      text: _("menu-shared-top-center"),
    },
    {
      id: "tool-pre-layout-battery-2-text",
      text: _("menu-shared-top-right"),
    },
    {
      id: "tool-pre-layout-battery-3-text",
      text: _("menu-shared-bottom-left"),
    },
    {
      id: "tool-pre-layout-battery-4-text",
      text: _("menu-shared-bottom-center"),
    },
    {
      id: "tool-pre-layout-battery-5-text",
      text: _("menu-shared-bottom-right"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-toolbar-text",
      text: _("tool-pre-toolbar"),
    },
    {
      id: "tool-pre-toolbar-direction-text",
      text: _("tool-pre-toolbar-direction"),
    },
    {
      id: "tool-pre-toolbar-direction-0-text",
      text: _("tool-shared-ui-direction-fromlanguage"),
    },
    {
      id: "tool-pre-toolbar-direction-1-text",
      text: _("tool-shared-ui-direction-ltr"),
    },
    {
      id: "tool-pre-toolbar-direction-2-text",
      text: _("tool-shared-ui-direction-rtl"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-loading-text",
      text: _("tool-pre-loading"),
    },
    {
      id: "tool-pre-loading-bg-text",
      text: _("tool-pre-loading-bg"),
    },
    {
      id: "tool-pre-loading-bg-0-text",
      text: _("tool-pre-loading-bg-0"),
    },
    {
      id: "tool-pre-loading-bg-1-text",
      text: _("tool-pre-loading-bg-1"),
    },
    {
      id: "tool-pre-loading-isize-text",
      text: _("tool-pre-loading-isize"),
    },
    {
      id: "tool-pre-loading-isize-0-text",
      text: _("tool-pre-loading-isize-0"),
    },
    {
      id: "tool-pre-loading-isize-1-text",
      text: _("tool-pre-loading-isize-1"),
    },
    {
      id: "tool-pre-loading-ipos-text",
      text: _("tool-pre-loading-ipos"),
    },
    {
      id: "tool-pre-loading-ipos-0-text",
      text: _("tool-pre-loading-ipos-0"),
    },
    {
      id: "tool-pre-loading-ipos-1-text",
      text: _("tool-pre-loading-ipos-1"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-home-screen-text",
      text: _("home-screen"),
    },
    {
      id: "tool-pre-home-screen-latest-position-text",
      text: `${_("home-section-recent")}: ${_("home-list-position")}`,
    },
    {
      id: "tool-pre-home-screen-latest-position-0-text",
      text: _("home-list-position-0", `"${_("home-section-favorites")}"`),
    },
    {
      id: "tool-pre-home-screen-latest-position-1-text",
      text: _("home-list-position-1"),
    },
    {
      id: "tool-pre-home-screen-latest-position-2-text",
      text: _("home-list-position-2"),
    },
    {
      id: "tool-pre-home-screen-latest-max-rows-text",
      text: `${_("home-section-recent")}: ${_("home-list-setting-max-rows")}`,
    },
    {
      id: "tool-pre-home-screen-latest-max-rows-collapsed-text",
      text: `${_("home-section-recent")}: ${_(
        "home-list-setting-max-rows",
      )} ${_("home-list-setting-max-rows-ifcollapsed")}`,
    },
    {
      id: "tool-pre-home-screen-favorites-max-rows-collapsed-text",
      text: `${_("home-section-favorites")}: ${_(
        "home-list-setting-max-rows",
      )} ${_("home-list-setting-max-rows-ifcollapsed")}`,
    },
    {
      id: "tool-pre-home-screen-other-max-rows-collapsed-text",
      text: `${_("home-section-other-lists")}: ${_(
        "home-list-setting-max-rows",
      )} ${_("home-list-setting-max-rows-ifcollapsed")}`,
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-epub-ebook-text",
      text:
        _("tool-pre-epub-ebook") +
        " (" +
        _("tool-shared-ui-experimental") +
        ")",
    },
    {
      id: "tool-pre-epub-ebook-color-mode-text",
      text: _("tool-shared-ui-color-mode"),
    },
    {
      id: "tool-pre-epub-ebook-color-mode-0-text",
      text: _("tool-shared-ui-color-mode-light"),
    },
    {
      id: "tool-pre-epub-ebook-color-mode-1-text",
      text: _("tool-shared-ui-color-mode-dark"),
    },
    {
      id: "tool-pre-epub-ebook-color-mode-2-text",
      text: _("tool-shared-ui-color-mode-custom"),
    },
    {
      id: "tool-pre-epub-ebook-color-text-text",
      text: _("tool-shared-ui-color-text"),
    },
    {
      id: "tool-pre-epub-ebook-color-background-text",
      text: _("tool-shared-ui-color-background"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-mouse-text",
      text: _("tool-pre-mouse"),
    },
    {
      id: "tool-pre-mouse2-text",
      text: _("tool-pre-mouse"),
    },
    {
      id: "tool-pre-hotspots-text",
      text: _("tool-pre-hotspots"),
    },
    {
      id: "tool-pre-hotspots-disabled-text",
      text: _("tool-pre-hotspots-disabled"),
    },
    {
      id: "tool-pre-hotspots-2columns-text",
      text: _(
        "tool-pre-hotspots-2columns",
        _("toolbar-go-left"),
        _("toolbar-go-right"),
      ),
    },
    {
      id: "tool-pre-hotspots-3columns-text",
      text: _(
        "tool-pre-hotspots-3columns",
        _("toolbar-go-left"),
        _("toolbar-go-right"),
      ),
    },
    {
      id: "tool-pre-cursor-text",
      text: _("tool-pre-cursor"),
    },
    {
      id: "tool-pre-cursor-always-text",
      text: _("tool-pre-cursor-always"),
    },
    {
      id: "tool-pre-cursor-hide-inactive-text",
      text: _("tool-pre-cursor-hide-inactive"),
    },
    {
      id: "tool-pre-mousebuttons-text",
      text: _("tool-pre-mouse") + ": " + _("tool-pre-navbuttons"),
    },
    {
      id: "tool-pre-mousebuttons-quickmenu-text",
      text: i18n._object("tool-pre-navkeys-actions").quickMenu,
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-navigation-text",
      text: _("tool-pre-navigation"),
    },
    {
      id: "tool-pre-autoopen-text",
      text: _("tool-pre-autoopen"),
    },
    {
      id: "tool-pre-autoopen-disabled-text",
      text: _("tool-pre-autoopen-disabled"),
    },
    {
      id: "tool-pre-autoopen-next-text",
      text: _("tool-pre-autoopen-next"),
    },
    {
      id: "tool-pre-autoopen-nextandprev-text",
      text: _("tool-pre-autoopen-nextandprev"),
    },
    {
      id: "tool-pre-page-turn-text",
      text: _("tool-pre-page-turn"),
    },
    {
      id: "tool-pre-page-turn-default-text",
      text: _("tool-pre-page-turn-default"),
    },
    {
      id: "tool-pre-page-turn-onscroll-text",
      text: _("tool-pre-page-turn-onscroll"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-navkeys-text",
      text: _("tool-pre-keyboard") + ": " + _("tool-pre-navkeys"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-navbuttons-text",
      text: _("tool-pre-gamepad") + ": " + _("tool-pre-navbuttons"),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-epub-text",
      text: _("tool-pre-epub"),
    },
    {
      id: "tool-pre-epub-openas-text",
      text: _("tool-pre-epub-openas"),
    },
    {
      id: "tool-pre-epub-openas-0-text",
      text: _("tool-pre-epub-openas-0"),
    },
    {
      id: "tool-pre-epub-openas-1-text",
      text: _("tool-pre-epub-openas-1"),
    },

    {
      id: "tool-pre-pdf-text",
      text: _("tool-pre-pdf"),
    },
    {
      id: "tool-pre-pdf-reading-library-version-text",
      text: _("tool-pre-pdf-reading-library-version"),
    },
    // {
    //   id: "tool-pre-pdf-reading-library-version-0-text",
    //   text: `${_("tool-pre-pdf-library-version-oldest")} (${_(
    //     "tool-pre-pdf-library-version-oldest-desc",
    //   )})`,
    // },
    // {
    //   id: "tool-pre-pdf-reading-library-version-1-text",
    //   text: `${_("tool-pre-pdf-library-version-newest")} (${_(
    //     "tool-pre-pdf-library-version-newest-desc",
    //   )})`,
    // },
    {
      id: "tool-pre-pdf-reading-library-version-0-text",
      text: `PDF.js ${_("tool-pre-pdf-library-version-oldest")} (${_(
        "tool-pre-pdf-library-version-oldest-desc",
      )})`,
    },
    {
      id: "tool-pre-pdf-reading-library-version-1-text",
      text: `PDF.js ${_("tool-pre-pdf-library-version-newest")} (${_(
        "tool-pre-pdf-library-version-newest-desc",
      )})`,
    },
    {
      id: "tool-pre-pdf-reading-library-version-2-text",
      text: `PDFium (${_("tool-shared-ui-experimental").toLowerCase()})`,
    },

    {
      id: "tool-pre-pdf-reading-dpi-text",
      text: _("tool-pre-pdf-reading-dpi"),
    },
    {
      id: "tool-pre-pdf-reading-dpi-0-text",
      text: `${_("tool-pre-pdf-library-version-oldest")} (${_(
        "tool-pre-pdf-library-version-oldest-desc",
      )})`,
    },
    {
      id: "tool-pre-pdf-reading-dpi-1-text",
      text: `${_("tool-pre-pdf-library-version-newest")} (${_(
        "tool-pre-pdf-library-version-newest-desc",
      )})`,
    },

    {
      id: "tool-pre-cbr-text",
      text: _("tool-pre-cbr"),
    },
    {
      id: "tool-pre-cbr-creation-modification-text",
      text: _("tool-pre-cbr-creation-modification"),
    },
    {
      id: "tool-pre-cbr-creation-modification-0-text",
      text: _("tool-pre-cbr-creation-modification-disabled"),
    },
    {
      id: "tool-pre-cbr-creation-modification-1-text",
      text:
        _("tool-pre-cbr-creation-modification-enabled") +
        " (" +
        _("tool-pre-use-system-exe") +
        ")",
    },
    {
      id: "tool-pre-rarfolder-text",
      text: _("tool-pre-rarfolder"),
    },
    {
      id: "tool-pre-rarfolder-update-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-pre-rarfolder-reset-button-text",
      text: _("tool-shared-ui-reset").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-updates-autocheck-text",
      text: _("tool-pre-updates-autocheck"),
    },
    {
      id: "tool-pre-updates-checkonstart-text",
      text: _("tool-pre-updates-checkonstart"),
    },
    {
      id: "tool-pre-updates-checkonstart-0-text",
      text: _("tool-pre-updates-checkonstart-0"),
    },
    {
      id: "tool-pre-updates-checkonstart-1-text",
      text: _("tool-pre-updates-checkonstart-1"),
    },
    {
      id: "tool-pre-updates-checkonstart-2-text",
      text: _("tool-pre-updates-checkonstart-2"),
    },
    {
      id: "tool-pre-updates-checkonstart-3-text",
      text: _("tool-pre-updates-checkonstart-3"),
    },
    {
      id: "tool-pre-updates-checkonstart-4-text",
      text: _("tool-pre-updates-checkonstart-4"),
    },

    {
      id: "tool-pre-updates-checknotify-text",
      text: _("tool-pre-updates-checknotify"),
    },
    {
      id: "tool-pre-updates-checknotify-0-text",
      text: _("tool-pre-updates-checknotify-0"),
    },
    {
      id: "tool-pre-updates-checknotify-1-text",
      text: _("tool-pre-updates-checknotify-1"),
    },
    {
      id: "tool-pre-updates-manualcheck-text",
      text: _("tool-pre-updates-manualcheck"),
    },
    {
      id: "tool-pre-updates-manualcheck-button-text",
      text: _("menu-help-checkupdates").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-pre-tempfolder-text",
      text: _("tool-pre-tempfolder"),
    },
    {
      id: "tool-pre-tempfolder-update-button-text",
      text: _("tool-shared-ui-change").toUpperCase(),
    },
    {
      id: "tool-pre-tempfolder-reset-button-text",
      text: _("tool-shared-ui-reset").toUpperCase(),
    },
    {
      id: "tool-pre-tempfolder-checkbox-text",
      text: _("tool-shared-ui-save-as-relative-path"),
    },
    //
    {
      id: "tool-pre-configfiles-text",
      text: _("tool-pre-configfiles"),
    },
    //
    {
      id: "tool-pre-externalfiles-text",
      text: _("tool-pre-externalfiles"),
    },
    {
      id: "tool-pre-externalfiles-load-text",
      text: _("tool-pre-externalfiles-load"),
    },
    {
      id: "tool-pre-externalfiles-load-types-localizations-text",
      text: _("tool-pre-externalfiles-type-localizations"),
    },
    {
      id: "tool-pre-externalfiles-load-types-themes-text",
      text: _("tool-pre-externalfiles-type-themes"),
    },
    {
      id: "tool-pre-externalfiles-folder-text",
      text: _("tool-pre-externalfiles-folder"),
    },
    {
      id: "tool-pre-externalfiles-folder-open-button-text",
      text: _("tool-shared-ui-open").toUpperCase(),
    },
  ];
};
