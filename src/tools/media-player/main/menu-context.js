/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const core = require("../../../core/main");
const { _ } = require("../../../shared/main/i18n");
const utils = require("../../../shared/main/utils");
const log = require("../../../shared/main/logger");
const history = require("./history");

exports.show = function (type, params, data, sendIpcToRenderer, openEntry) {
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

  function getOpenSubmenu(data) {
    return [
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
            "",
            "URL",
            _("ui-modal-prompt-button-ok"),
            _("ui-modal-prompt-button-cancel"),
            0,
          );
        },
      },
      {
        label: _("tool-radio-radio-station"),
        submenu: [
          {
            label: _("tool-radio-favorites"),
            submenu: [...getOpenRadioFavoritesMenu(data)],
          },
        ],
      },
      {
        label: _("home-section-recent"),
        submenu: [...getOpenRecentMenu()],
      },
    ];
  }

  function getOpenRecentMenu() {
    let menu = [];
    let recent = history.getRecent();
    const reverseHistory = recent.slice().reverse();
    let length = reverseHistory.length;
    if (length > 10) length = 10;
    for (let index = 0; index < length; index++) {
      const entry = reverseHistory[index];
      let label = utils.reduceStringFrontEllipsis(entry.filePath);
      menu.push({
        label,
        click() {
          openEntry({ url: entry.filePath, currentTime: entry.currentTime });
        },
      });
    }
    menu.push({
      type: "separator",
    });
    menu.push({
      label: _("tool-hst-button-clear-all"),
      enabled: history.getRecentLength() > 0,
      click() {
        history.clear();
      },
    });
    return menu;
  }

  function getOpenRadioFavoritesMenu(data) {
    const favorites = data.radioFavorites;
    let menu = [];
    for (let index = 0; index < favorites.length; index++) {
      const entry = favorites[index];
      let label = entry.name ?? utils.reduceStringFrontEllipsis(entry.url);
      menu.push({
        label,
        click() {
          openEntry({ url: entry.url, title: entry.name, source: "radio" });
        },
      });
    }
    return menu;
  }

  function getCommonEntries(data) {
    return [
      {
        label: _("tool-shared-ui-open"),
        submenu: [...getOpenSubmenu(data)],
      },
      { type: "separator" },
      ...getVideoSubmenu(data),
      ...getAudioSubmenu(data),
      ...getSubtitleSubmenu(data),
      { type: "separator" },
      {
        label: _("menu-view"),
        submenu: [
          {
            label: _("mp-menu-advancedcontrols"),
            type: "checkbox",
            checked: data.settings.showAdvancedControls,
            click() {
              sendIpcToRenderer("on-context-menu", "toggle-advancedcontrols");
            },
          },
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
          ...getSystemTraySubmenu(data, sendIpcToRenderer),
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
      { type: "separator" },
      ...getPlaylistSubmenu(data),
      ...getPlayButtons(data, sendIpcToRenderer),
      { type: "separator" },
      {
        label: data.isPlayerMode
          ? _("tool-shared-ui-close")
          : _("mp-menu-hide"),
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
    // tracks
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
      } catch (error) {
        return [];
      }
    }
    // crop & aspect
    const aspectRatios = {
      "1:1": "1/1",
      "4:3": "4/3",
      "5:4": "5/4",
      "16:9": "16/9", // hd standard
      "16:10": "16/10",
      "21:9": "21/9", // ultrawide
      "1.85:1": "185/100", // us widescreen cinema
      "2.21:1": "221/100", // 70 mm cinema
      "2.35:1": "235/100", // anamorphic
      "2.39:1": "239/100", // modern panavision
    };

    function getVideoCrops(data) {
      try {
        let result = [];
        for (const key in aspectRatios) {
          result.push({
            label: key,
            type: "radio",
            checked: data.settings.videoCrop === aspectRatios[key],
            click() {
              sendIpcToRenderer(
                "on-context-menu",
                "load-video-crop",
                aspectRatios[key],
              );
            },
          });
        }
        return result;
      } catch (error) {
        return [];
      }
    }
    function getVideoAspectRatios(data) {
      try {
        let result = [];
        for (const key in aspectRatios) {
          result.push({
            label: key,
            type: "radio",
            checked: data.settings.videoAspectRatio === aspectRatios[key],
            click() {
              sendIpcToRenderer(
                "on-context-menu",
                "load-video-aspectratio",
                aspectRatios[key],
              );
            },
          });
        }
        return result;
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
          {
            label: _("tool-shared-ui-imageops-crop"),
            enabled: data.isVideo && !data.isYoutube,
            submenu: [
              {
                label: _("tool-pre-zoom-default"),
                type: "radio",
                checked: data.settings.videoCrop === "original",
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "load-video-crop",
                    "original",
                  );
                },
              },
              ...getVideoCrops(data),
            ],
          },
          {
            label: _("mp-menu-video-aspectratio"),
            enabled: data.isVideo && !data.isYoutube,
            submenu: [
              {
                label: _("tool-pre-zoom-default"),
                type: "radio",
                checked: data.settings.videoAspectRatio === "original",
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "load-video-aspectratio",
                    "original",
                  );
                },
              },
              ...getVideoAspectRatios(data),
            ],
          },
          {
            label: _("mp-tooltip-button-takescreenshot"),
            enabled: data.buttonStates.takescreenshot,
            click() {
              sendIpcToRenderer("on-context-menu", "takescreenshot");
            },
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
            label: _("tool-shared-ui-ebook-rendering-fontsize"),
            submenu: [
              {
                label: "80%",
                type: "radio",
                checked: data.settings.subtitleFontSize === 0.8,
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "set-subtitle-font-size",
                    0.8,
                  );
                },
              },
              {
                label: "90%",
                type: "radio",
                checked: data.settings.subtitleFontSize === 0.9,
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "set-subtitle-font-size",
                    0.9,
                  );
                },
              },
              {
                label: "100%",
                type: "radio",
                checked: data.settings.subtitleFontSize === 1,
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "set-subtitle-font-size",
                    1,
                  );
                },
              },
              {
                label: "110%",
                type: "radio",
                checked: data.settings.subtitleFontSize === 1.1,
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "set-subtitle-font-size",
                    1.1,
                  );
                },
              },
              {
                label: "120%",
                type: "radio",
                checked: data.settings.subtitleFontSize === 1.2,
                click() {
                  sendIpcToRenderer(
                    "on-context-menu",
                    "set-subtitle-font-size",
                    1.2,
                  );
                },
              },
            ],
          },
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
    default:
      Menu.buildFromTemplate([...header, ...getCommonEntries(data)]).popup(
        core.getMainWindow(),
        params.x,
        params.y,
      );
      break;
  }
};

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function getPlayButtons(data, sendIpcToRenderer) {
  return [
    {
      label: _("mp-tooltip-button-play"),
      visible: data.buttonStates.play,
      click() {
        sendIpcToRenderer("on-context-menu", "play");
      },
    },
    {
      label: _("mp-tooltip-button-pause"),
      visible: data.buttonStates.pause,
      click() {
        sendIpcToRenderer("on-context-menu", "pause");
      },
    },
    {
      label: _("mp-tooltip-button-stop"),
      visible: data.buttonStates.stop,
      click() {
        sendIpcToRenderer("on-context-menu", "stop");
      },
    },
    {
      label: _("mp-tooltip-button-next"),
      visible: data.buttonStates.next,
      click() {
        sendIpcToRenderer("on-context-menu", "next");
      },
    },
    {
      label: _("mp-tooltip-button-prev"),
      visible: data.buttonStates.prev,
      click() {
        sendIpcToRenderer("on-context-menu", "prev");
      },
    },
  ];
}

function getSystemTraySubmenu(data, sendIpcToRenderer) {
  if (!data.isPlayerMode) return [];
  const isWindows = process.platform === "win32";
  return [
    {
      label: _("ctxmenu-systemtray"),
      submenu: [
        {
          label: _("ctxmenu-systemtray-icon"),
          submenu: [
            {
              label: `${_("ctxmenu-systemtray-icon-disabled")}${!isWindows ? ` (${_("ctxmenu-systemtray-icon-disabled-restartrequired")})` : ""}`,
              type: "radio",
              checked: data.settings.trayIcon === 0,
              click() {
                sendIpcToRenderer("on-context-menu", "set-tray-icon", 0);
              },
            },
            {
              label: _("ctxmenu-systemtray-icon-default"),
              type: "radio",
              checked: data.settings.trayIcon === 1,
              click() {
                sendIpcToRenderer("on-context-menu", "set-tray-icon", 1);
              },
            },
            {
              label: _("ctxmenu-systemtray-icon-white"),
              type: "radio",
              checked: data.settings.trayIcon === 2,
              click() {
                sendIpcToRenderer("on-context-menu", "set-tray-icon", 2);
              },
            },
            {
              label: _("ctxmenu-systemtray-icon-black"),
              type: "radio",
              checked: data.settings.trayIcon === 3,
              click() {
                sendIpcToRenderer("on-context-menu", "set-tray-icon", 3);
              },
            },
          ],
        },
      ],
    },
    { type: "separator" },
  ];
}

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

exports.getTrayContextMenu = function (basicEntries, data, sendIpcToRenderer) {
  if (data) {
    return Menu.buildFromTemplate([
      ...getPlayButtons(data, sendIpcToRenderer),
      { type: "separator" },
      ...getSystemTraySubmenu(data, sendIpcToRenderer),
      { type: "separator" },
      ...basicEntries,
    ]);
  } else {
    return Menu.buildFromTemplate([...basicEntries]);
  }
};
