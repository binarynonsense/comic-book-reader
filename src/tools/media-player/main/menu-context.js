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

exports.show = function (type, params, settings, sendIpcToRenderer) {
  // ref: https://github.com/electron/electron/blob/main/docs/api/web-contents.md#event-context-menu
  // core.onMenuToggleFullScreen();

  ////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////
  const header = [
    {
      label: _("menu-view-layout-show-mediaplayer").toUpperCase(),
      enabled: false,
    },
    { type: "separator" },
  ];

  const openSubmenu = [
    {
      label: _("menu-tools-files") + "...",
      click() {
        sendIpcToRenderer("on-context-menu", "open-files");
      },
    },
    {
      label: "URL...",
      click() {
        sendIpcToRenderer(
          "show-modal-open-url",
          _("mp-menu-open-openurl"),
          "URL",
          _("ui-modal-prompt-button-ok"),
          _("ui-modal-prompt-button-cancel"),
          0,
        );
      },
    },
  ];

  function getCommonEntries(settings) {
    return [
      {
        label: _("tool-shared-ui-open"),
        submenu: [...openSubmenu],
      },
      ...getSizeSubmenu(settings),
      {
        label: _("mp-tooltip-button-playlist"),
        click() {
          sendIpcToRenderer("on-context-menu", "toggle-playlist");
        },
      },
      { type: "separator" },
      {
        label: _("mp-menu-hide"),
        click() {
          sendIpcToRenderer("on-context-menu", "hide");
        },
      },
    ];
  }

  function getSizeSubmenu(settings) {
    return [
      {
        label: _("mp-menu-size"),
        submenu: [
          {
            label: _("mp-menu-size-small"),
            type: "radio",
            checked: settings.size === 0,
            click() {
              sendIpcToRenderer("on-context-menu", "set-size", 0);
            },
          },
          {
            label: _("mp-menu-size-medium"),
            type: "radio",
            checked: settings.size === 1,
            click() {
              sendIpcToRenderer("on-context-menu", "set-size", 1);
            },
          },
          {
            label: _("mp-menu-size-big"),
            type: "radio",
            checked: settings.size === 2,
            click() {
              sendIpcToRenderer("on-context-menu", "set-size", 2);
            },
          },
        ],
      },
    ];
  }

  ////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////

  switch (type) {
    case "normal":
    case "settings":
    default:
      Menu.buildFromTemplate([...header, ...getCommonEntries(settings)]).popup(
        core.getMainWindow(),
        params.x,
        params.y,
      );
      break;

    case "open":
      Menu.buildFromTemplate([
        {
          label: _("tool-shared-ui-open").toUpperCase(),
          enabled: false,
        },
        { type: "separator" },
        ...openSubmenu,
      ]).popup(core.getMainWindow(), params.x, params.y);
      break;
  }
};
