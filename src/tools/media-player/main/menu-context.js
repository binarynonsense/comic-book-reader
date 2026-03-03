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

exports.show = function (type, params, data, sendIpcToRenderer) {
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

  function getCommonEntries(data) {
    return [
      {
        label: _("tool-shared-ui-open"),
        submenu: [...openSubmenu],
      },
      {
        label: _("menu-view"),
        submenu: [
          ...getSizeSubmenu(data),
          { type: "separator" },
          {
            label: _("mp-menu-videoarea"),
            type: "checkbox",
            checked: data.settings.showVideo,
            enabled: !data.settings.fullView,
            click() {
              sendIpcToRenderer("on-context-menu", "toggle-video");
            },
          },
          {
            label: _("mp-menu-spectrum"),
            type: "checkbox",
            checked: data.settings.showSpectrum,
            enabled: !data.settings.fullView,
            click() {
              sendIpcToRenderer("on-context-menu", "toggle-spectrum");
            },
          },
          {
            label: _("mp-menu-playlist"),
            type: "checkbox",
            checked: data.settings.showPlaylist,
            enabled: !data.settings.fullView,
            click() {
              sendIpcToRenderer("on-context-menu", "toggle-playlist");
            },
          },
          { type: "separator" },
          {
            label: _("mp-menu-fullview"),
            type: "checkbox",
            checked: data.settings.fullView,
            click() {
              sendIpcToRenderer("on-context-menu", "toggle-fullview");
            },
          },
        ],
      },
      ...getPlaylistSubmenu(data),
      { type: "separator" },
      {
        label: _("mp-tooltip-button-play"),
        enabled: data.buttonStates.play,
        click() {
          sendIpcToRenderer("on-context-menu", "play");
        },
      },
      {
        label: _("mp-tooltip-button-pause"),
        enabled: data.buttonStates.pause,
        click() {
          sendIpcToRenderer("on-context-menu", "pause");
        },
      },
      {
        label: _("mp-tooltip-button-next"),
        enabled: data.buttonStates.next,
        click() {
          sendIpcToRenderer("on-context-menu", "next");
        },
      },
      {
        label: _("mp-tooltip-button-prev"),
        enabled: data.buttonStates.prev,
        click() {
          sendIpcToRenderer("on-context-menu", "prev");
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

  function getSizeSubmenu(data) {
    return [
      {
        label: _("mp-menu-miniplayer"),
        enabled: !data.settings.fullView,
        submenu: [
          {
            label: _("mp-menu-size-small"),
            type: "radio",
            checked: data.settings.size === 0,
            click() {
              sendIpcToRenderer("on-context-menu", "set-size", 0);
            },
          },
          {
            label: _("mp-menu-size-medium"),
            type: "radio",
            checked: data.settings.size === 1,
            click() {
              sendIpcToRenderer("on-context-menu", "set-size", 1);
            },
          },
        ],
      },
    ];
  }

  function getPlaylistSubmenu(data) {
    try {
      return [
        {
          label: _("mp-menu-playlist"),
          submenu: [
            {
              label: _("mp-menu-playlist-tracks"),
              submenu: data.playlist.files.map((file, index) => ({
                label: `${index === data.currentFileIndex ? `[${index + 1}]` : index + 1} - ${file.title ?? file.url}`,
                click: () =>
                  sendIpcToRenderer("on-context-menu", "play-track", index),
              })),
            },
            { type: "separator" },
            {
              label: _("mp-menu-playlist-repeattracks"),
              submenu: [
                {
                  label: _("mp-menu-playlist-repeattracks-off"),
                  type: "radio",
                  checked: data.settings.repeat === 0,
                  click() {
                    sendIpcToRenderer("on-context-menu", "set-repeat", 0);
                  },
                },
                {
                  label: _("mp-menu-playlist-repeattracks-one"),
                  type: "radio",
                  checked: data.settings.repeat === 1,
                  click() {
                    sendIpcToRenderer("on-context-menu", "set-repeat", 1);
                  },
                },
                {
                  label: _("mp-menu-playlist-repeattracks-all"),
                  type: "radio",
                  checked: data.settings.repeat === 2,
                  click() {
                    sendIpcToRenderer("on-context-menu", "set-repeat", 2);
                  },
                },
              ],
            },
            {
              label: _("mp-menu-playlist-shuffletracks"),
              type: "checkbox",
              checked: data.settings.shuffle === 1,
              click() {
                sendIpcToRenderer("on-context-menu", "toggle-shuffle");
              },
            },
          ],
        },
      ];
    } catch (error) {
      log.error(error);
      return "";
    }
  }

  ////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////

  switch (type) {
    case "normal":
    case "data.settings":
    default:
      Menu.buildFromTemplate([...header, ...getCommonEntries(data)]).popup(
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
