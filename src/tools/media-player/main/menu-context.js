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
      ...getVideoSubmenu(data),
      ...getAudioSubmenu(data),
      ...getSubtitleSubmenu(data),
      {
        label: _("menu-view"),
        submenu: [
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
          ...getSizeSubmenu(data),
          { type: "separator" },
          // {
          //   label: _("mp-menu-fullview"),
          //   type: "checkbox",
          //   checked: data.settings.fullView,
          //   click() {
          //     sendIpcToRenderer("on-context-menu", "toggle-fullview");
          //   },
          // },
          {
            label: _("mp-menu-compactview"),
            type: "radio",
            checked: !data.settings.fullView,
            click() {
              sendIpcToRenderer("on-context-menu", "set-fullview", false);
            },
          },
          {
            label: _("mp-menu-fullview"),
            type: "radio",
            checked: data.settings.fullView,
            click() {
              sendIpcToRenderer("on-context-menu", "set-fullview", true);
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
        label: _("mp-menu-compactviewsize"),
        // enabled: !data.settings.fullView,
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

  function getVideoSubmenu(data) {
    function getVideoTracks(data) {
      try {
        let result = [];
        if (data?.trackMetadata?.videoTracks) {
          const tracks = data.trackMetadata.videoTracks;
          for (let index = 0; index < tracks.length; index++) {
            const track = data.trackMetadata.videoTracks[index];
            result.push({
              label: track.title,
              type: "radio",
              checked: data.trackMetadata.videoIndex === track.index,
              click() {
                sendIpcToRenderer(
                  "on-context-menu",
                  "load-video-track",
                  track.index,
                );
              },
            });
          }
        }
        return result;
        audio;
      } catch (error) {
        return [];
      }
    }
    // final return
    return [
      {
        label: _("mp-menu-video"),
        submenu: [
          {
            label: _("mp-menu-media-track"),
            enabled: data.canSetAudioVideo.video,
            submenu: [
              {
                label: _("mp-menu-media-track-automatic"),
                type: "radio",
                checked:
                  data.trackMetadata === undefined ||
                  data.trackMetadata.videoIndex === undefined,
                click() {
                  sendIpcToRenderer("on-context-menu", "load-video-track", -1);
                },
              },
              ...getVideoTracks(data),
            ],
          },
        ],
      },
    ];
  }

  function getAudioSubmenu(data) {
    function getAudioTracks(data) {
      try {
        let result = [];
        if (data?.trackMetadata?.audioTracks) {
          const tracks = data.trackMetadata.audioTracks;
          for (let index = 0; index < tracks.length; index++) {
            const track = data.trackMetadata.audioTracks[index];
            result.push({
              label: track.title,
              type: "radio",
              checked: data.trackMetadata.audioIndex === track.index,
              click() {
                sendIpcToRenderer(
                  "on-context-menu",
                  "load-audio-track",
                  track.index,
                );
              },
            });
          }
        }
        return result;
      } catch (error) {
        return [];
      }
    }
    // final return
    return [
      {
        label: _("mp-menu-audio"),
        submenu: [
          {
            label: _("mp-menu-media-track"),
            enabled: data.canSetAudioVideo.audio,
            submenu: [
              {
                label: _("mp-menu-media-track-automatic"),
                type: "radio",
                checked:
                  data.trackMetadata === undefined ||
                  data.trackMetadata.audioIndex === undefined,
                click() {
                  sendIpcToRenderer("on-context-menu", "load-audio-track", -1);
                },
              },
              ...getAudioTracks(data),
            ],
          },
        ],
      },
    ];
  }

  function getSubtitleSubmenu(data) {
    function getExternalSubtitleTracks(data) {
      try {
        let result = [];
        if (data?.externalSubtitles?.length > 0) {
          const subtitles = data.externalSubtitles;
          for (let index = 0; index < subtitles.length; index++) {
            const subtitle = subtitles[index];
            result.push({
              label: subtitle.title,
              type: "radio",
              checked:
                data.subtitle &&
                data.subtitle.type === "external" &&
                data.subtitle.index === index,
              click() {
                sendIpcToRenderer(
                  "on-context-menu",
                  "load-external-subtitle-track",
                  index,
                );
              },
            });
          }
        }
        return result;
      } catch (error) {
        return [];
      }
    }
    function getEmbeddedSubtitleTracks(data) {
      try {
        let result = [];
        if (data?.trackMetadata?.subtitles) {
          const subtitles = data.trackMetadata.subtitles;
          for (let index = 0; index < subtitles.length; index++) {
            const subtitle = subtitles[index];
            result.push({
              label: subtitle.title,
              type: "radio",
              checked:
                data.subtitle &&
                data.subtitle.type === "embedded" &&
                data.subtitle.index === index,
              click() {
                sendIpcToRenderer(
                  "on-context-menu",
                  "load-embedded-subtitle-track",
                  index,
                );
              },
            });
          }
        }
        return result;
      } catch (error) {
        return [];
      }
    }
    // final return
    return [
      {
        label: _("mp-menu-subtitle"),
        submenu: [
          {
            label: _("mp-menu-subtitle-addfile") + "...",
            enabled: data.canLoadSubtitles,
            click() {
              sendIpcToRenderer("on-context-menu", "add-subtitle-file");
            },
          },
          {
            label: _("mp-menu-media-track"),
            enabled: data.canLoadSubtitles,
            submenu: [
              {
                label: _("mp-menu-media-track-disabled"),
                type: "radio",
                checked: !data.subtitle,
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "load-disabled-subtitle-track",
                  );
                },
              },
              ...getExternalSubtitleTracks(data),
              ...getEmbeddedSubtitleTracks(data),
            ],
          },
          { type: "separator" },
          {
            label: _("mp-menu-subtitle-highcontrastmode"),
            type: "checkbox",
            checked: data.settings.subtitleHighContrastMode,
            click() {
              sendIpcToRenderer(
                "on-context-menu",
                "toggle-subtitle-high-contrast-mode",
              );
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
