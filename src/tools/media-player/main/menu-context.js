/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const core = require("../../../core/main");
const { _ } = require("../../../shared/main/i18n");
const log = require("../../../shared/main/logger");

exports.show = function (type, params, sendIpcToRenderer) {
  // ref: https://github.com/electron/electron/blob/main/docs/api/web-contents.md#event-context-menu
  // core.onMenuToggleFullScreen();
  const commonEntries = [
    {
      label: _("menu-view-layout-show-mediaplayer").toUpperCase(),
      enabled: false,
    },
    { type: "separator" },
    {
      label: _("mp-tooltip-button-playlist"),
      click() {
        sendIpcToRenderer("on-context-menu", "toggle-playlist");
      },
    },
    {
      label: _("mp-tooltip-button-close"),
      click() {
        sendIpcToRenderer("on-context-menu", "hide");
      },
    },
  ];
  switch (type) {
    case "normal":
    default:
      Menu.buildFromTemplate([...commonEntries]).popup(
        core.getMainWindow(),
        params.x,
        params.y,
      );
      break;
  }
};
