/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { _ } = require("../../../shared/main/i18n");

exports.getLocalization = function () {
  return [
    {
      id: "mp-button-play",
      text: _("mp-tooltip-button-play"),
    },
    {
      id: "mp-button-pause",
      text: _("mp-tooltip-button-pause"),
    },
    {
      id: "mp-button-next",
      text: _("mp-tooltip-button-next"),
    },
    {
      id: "mp-button-prev",
      text: _("mp-tooltip-button-prev"),
    },
    {
      id: "mp-button-open",
      text: _("tool-shared-ui-open"),
    },
    {
      id: "mp-button-volume-off",
      text: _("mp-tooltip-button-volume-off"),
    },
    {
      id: "mp-button-volume-on",
      text: _("mp-tooltip-button-volume-on"),
    },
    {
      id: "mp-button-close-playlist",
      text: _("mp-tooltip-button-playlist-hide"),
    },
    {
      id: "mp-video-close-button",
      text: _("mp-tooltip-button-videoarea-hide"),
    },
    {
      id: "mp-spectrum-close-button",
      text: _("mp-tooltip-button-spectrum-hide"),
    },
    {
      id: "mp-button-settings",
      text: _("tool-shared-tab-settings"),
    },
    {
      id: "mp-button-shuffle-off",
      text: _("mp-tooltip-button-playlist-shuffletracks"),
    },
    {
      id: "mp-button-shuffle-on",
      text: _("mp-tooltip-button-playlist-shuffletracks"),
    },
    {
      id: "mp-button-repeat-off",
      text: _("mp-tooltip-button-playlist-repeattracks"),
    },
    {
      id: "mp-button-repeat-1",
      text: _("mp-tooltip-button-playlist-repeattracks"),
    },
    {
      id: "mp-button-repeat-all",
      text: _("mp-tooltip-button-playlist-repeattracks"),
    },

    {
      id: "mp-button-clear",
      text: _("mp-tooltip-button-playlist-clear"),
    },
    {
      id: "mp-button-add",
      text: _("mp-tooltip-button-playlist-add"),
    },
    {
      id: "mp-button-delete",
      text: _("mp-tooltip-button-playlist-delete"),
    },
    {
      id: "mp-button-save",
      text: _("mp-tooltip-button-playlist-save"),
    },
  ];
};
