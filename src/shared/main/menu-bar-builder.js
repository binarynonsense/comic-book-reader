/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const core = require("../../core/main");
const reader = require("../../reader/main");
const { _ } = require("./i18n");
const utils = require("./utils");

function getHelpSubmenu() {
  let menu = [];
  menu.push({
    label: _("menu-help-checkupdates"), // + "...",
    click() {
      core.onMenuCheckUpdates();
    },
  });
  menu.push({
    type: "separator",
  });
  menu.push({
    label: _("menu-help-about"),
    click() {
      core.onMenuAbout();
    },
  });
  if (core.isDev()) {
    menu.push({
      type: "separator",
    });
    menu.push({
      label: _("menu-help-devtools-toggle"),
      click() {
        core.onMenuToggleDevTools();
      },
    });
  }
  return menu;
}

function getScaleToHeightSubmenu(settings) {
  let menu = [];
  let defaults = [25, 50, 100, 150, 200, 300, 400];
  let found = false;
  defaults.forEach((scale) => {
    if (settings.zoom_scale == scale) found = true;
    menu.push({
      label: `${scale}%`,
      type: "radio",
      checked: settings.fit_mode == 2 && settings.zoom_scale == scale,
      click() {
        reader.onMenuScaleToHeight(scale);
      },
    });
  });
  // create one for the custom current zoom
  if (settings.zoom_scale !== undefined && !found) {
    menu.push({
      type: "separator",
    });
    menu.push({
      label: `${settings.zoom_scale}%`,
      type: "radio",
      checked: settings.fit_mode == 2 ? true : false,
      click() {
        reader.onMenuScaleToHeight(settings.zoom_scale);
      },
    });
  }

  menu.push({
    type: "separator",
  });
  menu.push({
    label: _("menu-view-zoom-scaleheight-enter"),
    click() {
      reader.onMenuScaleToHeightEnter();
    },
  });

  return menu;
}

function getOpenRecentSubmenu(history) {
  let menu = [];
  const reverseHistory = history.slice().reverse();
  let length = reverseHistory.length;
  if (length > 10) length = 10;

  for (let index = 0; index < length; index++) {
    const entry = reverseHistory[index];
    let label = utils.reduceStringFrontEllipsis(entry.filePath);
    if (entry.data && entry.data.source) {
      if (entry.data.name) {
        label = "[www] " + utils.reduceStringFrontEllipsis(entry.data.name);
      } else {
        label = "[www] " + label;
      }
    }
    menu.push({
      label: label,
      click() {
        reader.tryOpen(entry.filePath, undefined, entry);
      },
    });
  }

  menu.push({
    type: "separator",
  });

  menu.push({
    label: _("menu-file-openrecent-history"),
    accelerator: "acc-hist",
    click() {
      core.onMenuOpenHistoryManager();
    },
  });

  return menu;
}

function getToolsSubmenu() {
  return [
    {
      label: _("menu-tools-files"),
      submenu: [
        {
          label: _("menu-tools-convert"),
          submenu: [
            {
              id: "convert-files",
              label: _("menu-tools-convert-comics"),
              click() {
                core.onMenuToolConvertComics();
              },
            },
            {
              id: "convert-imgs",
              label: _("menu-tools-convert-images"),
              click() {
                core.onMenuToolConvertImages();
              },
            },
          ],
        },
        {
          label: _("menu-tools-create"),
          submenu: [
            {
              id: "create-file",
              label: _("menu-tools-create-comic"),
              enabled: true,
              click() {
                core.onMenuToolCreateComic();
              },
            },
            {
              id: "create-qr",
              label: _("menu-tools-create-qr"),
              enabled: true,
              click() {
                core.onMenuToolCreateQR();
              },
            },
          ],
        },
        {
          label: _("menu-tools-extract"),
          submenu: [
            {
              id: "extract-comics",
              label: _("menu-tools-extract-comics"),
              enabled: true,
              click() {
                core.onMenuToolExtractComics();
              },
            },
            {
              id: "extract-palette",
              label: _("menu-tools-extract-palette"),
              enabled: true,
              click() {
                core.onMenuToolExtractPalette();
              },
            },
            {
              id: "extract-text",
              label: _("menu-tools-extract-text"),
              enabled: true,
              click() {
                core.onMenuToolExtractText();
              },
            },
            {
              id: "extract-qr",
              label: _("menu-tools-extract-qr"),
              enabled: true,
              click() {
                core.onMenuToolExtractQR();
              },
            },
          ],
        },
      ],
    },
    {
      label: _("menu-tools-search"),
      submenu: [
        {
          label: _("menu-tools-dcm"),
          click() {
            core.onMenuToolDCM();
          },
        },
        {
          label: _("menu-tools-cbp"),
          click() {
            core.onMenuToolCBP();
          },
        },
        {
          label: _("menu-tools-iab"),
          click() {
            core.onMenuToolIArchive();
          },
        },
        {
          label: _("menu-tools-gut"),
          click() {
            core.onMenuToolGutenberg();
          },
        },
        {
          label: _("menu-tools-xkcd"),
          click() {
            core.onMenuToolXkcd();
          },
        },
        {
          label: _("menu-tools-librivox"),
          click() {
            core.onMenuToolLibrivox();
          },
        },
        {
          label: _("menu-tools-wiktionary"),
          click() {
            core.onMenuToolWiktionary();
          },
        },
        {
          label: _("menu-tools-radio"),
          click() {
            core.onMenuToolRadio(1);
          },
        },
        {
          label: _("menu-tools-rssfeeds"),
          click() {
            core.onMenuToolRssReader(1);
          },
        },
      ],
    },
    // {
    //   type: "separator",
    // },
    {
      id: "tools-art",
      label: _("menu-tools-art"),
      submenu: [
        {
          label: _("menu-tools-template-maker"),
          click() {
            core.onMenuToolTemplateMaker();
          },
        },
        {
          label: _("menu-tools-palette-extractor"),
          enabled: true,
          click() {
            core.onMenuToolExtractPalette();
          },
        },
      ],
    },
    {
      id: "tools-other",
      label: _("menu-tools-other"),
      submenu: [
        {
          label: _("menu-tools-rss-reader"),
          click() {
            core.onMenuToolRssReader();
          },
        },
        {
          label: _("menu-tools-radio"),
          click() {
            core.onMenuToolRadio(0);
          },
        },
      ],
    },
  ];
}

function getNormalMenu(settings, history) {
  let menu = [
    {
      label: _("menu-file"),
      submenu: [
        {
          id: "open-file",
          label: _("menu-file-open"),
          accelerator: "acc-file-open",
          click() {
            reader.onMenuOpenFile();
          },
        },
        {
          id: "openrecent-file",
          label: _("menu-file-openrecent"),
          submenu: getOpenRecentSubmenu(history),
        },
        {
          id: "close-file",
          label: _("menu-file-close"),
          enabled: false,
          click() {
            reader.onMenuCloseFile();
          },
        },
        {
          type: "separator",
        },
        {
          id: "convert-file",
          label: _("menu-file-convert"),
          enabled: false,
          click() {
            reader.onMenuConvertFile();
          },
        },
        {
          id: "extract-file",
          label: _("menu-file-extract"),
          enabled: false,
          click() {
            reader.onMenuExtractFile();
          },
        },
        {
          id: "file-properties",
          label: _("menu-file-properties"),
          enabled: false,
          click() {
            reader.onMenuFileProperties();
          },
        },
        {
          type: "separator",
        },
        // {
        //   id: "file-page",
        //   label: _("menu-file-page"),
        //   submenu: [
        //     {
        //       id: "file-page-export",
        //       label: _("menu-file-page-export"),
        //       enabled: false,
        //       click() {
        //         reader.onMenuPageExport();
        //       },
        //     },
        //     {
        //       id: "file-page-extract-palette",
        //       label: _("menu-file-page-extract-palette"),
        //       enabled: false,
        //       click() {
        //         reader.onMenuPageExtractPalette();
        //       },
        //     },
        //     {
        //       id: "file-page-extract-text",
        //       label: _("menu-file-page-extract-text"),
        //       enabled: false,
        //       click() {
        //         reader.onMenuPageExtractText();
        //       },
        //     },
        //     {
        //       id: "file-page-extract-qr",
        //       label: _("menu-file-page-extract-qr"),
        //       enabled: false,
        //       click() {
        //         reader.onMenuPageExtractQR();
        //       },
        //     },
        //   ],
        // },
        // {
        //   type: "separator",
        // },
        {
          id: "file-preferences",
          label: _("menu-file-preferences"),
          click() {
            core.onMenuPreferences();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("menu-file-quit"),
          accelerator: "acc-quit",
          click() {
            core.onMenuQuit();
          },
        },
      ],
    },
    {
      label: _("menu-view"),
      submenu: [
        {
          id: "view-layout",
          label: _("menu-view-layout"),
          submenu: [
            {
              id: "view-layout-show",
              label: _("menu-view-layout-show"),
              submenu: [
                {
                  label: _("menu-view-layout-show-scrollbar"),
                  id: "scrollbar",
                  type: "checkbox",
                  checked: settings.showScrollBar,
                  accelerator: "acc-scrollbar",
                  click() {
                    reader.onMenuToggleScrollBar();
                  },
                },
                {
                  label: _("menu-view-layout-show-toolbar"),
                  id: "toolbar",
                  type: "checkbox",
                  checked: settings.showToolBar,
                  accelerator: "acc-toolbar",
                  click() {
                    reader.onMenuToggleToolBar();
                  },
                },
                {
                  label: _("menu-view-layout-show-pagenum"),
                  id: "page-number",
                  type: "checkbox",
                  checked: settings.showPageNumber,
                  accelerator: "acc-pagenum",
                  click() {
                    reader.onMenuTogglePageNumber();
                  },
                },
                {
                  label: _("menu-view-layout-show-clock"),
                  id: "clock",
                  type: "checkbox",
                  checked: settings.showClock,
                  accelerator: "acc-clock",
                  click() {
                    reader.onMenuToggleClock();
                  },
                },
                {
                  label: _("menu-view-layout-show-battery"),
                  id: "battery",
                  type: "checkbox",
                  checked: settings.showBattery,
                  accelerator: "acc-battery",
                  click() {
                    reader.onMenuToggleBattery();
                  },
                },
                {
                  label: _("menu-view-layout-show-loading"),
                  id: "loading-indicator",
                  type: "checkbox",
                  checked: settings.showLoadingIndicator,
                  click() {
                    reader.onMenuToggleLoadingIndicator();
                  },
                },
              ],
            },
            {
              id: "view-layout-pagesdirection",
              label: _("menu-view-layout-pagesdirection"),
              submenu: [
                {
                  id: "pagesdirection-0",
                  label: _("menu-view-layout-pagesdirection-ltr"),
                  type: "radio",
                  checked: settings.pagesDirection === 0,
                  click() {
                    reader.onMenuPagesDirection(0);
                  },
                },
                {
                  id: "pagesdirection-1",
                  label: _("menu-view-layout-pagesdirection-rtl"),
                  type: "radio",
                  checked: settings.pagesDirection === 1,
                  click() {
                    reader.onMenuPagesDirection(1);
                  },
                },
              ],
            },
            {
              id: "view-layout-pagemode",
              label: _("menu-view-layout-pagemode"),
              submenu: [
                {
                  id: "pagemode-0",
                  label: _("menu-view-layout-pagemode-singlepage"),
                  type: "radio",
                  checked: settings.page_mode === 0,
                  click() {
                    reader.onMenuPageMode(0);
                  },
                },
                {
                  id: "pagemode-1",
                  label: _("menu-view-layout-pagemode-doublepage"),
                  type: "radio",
                  checked: settings.page_mode === 1,
                  click() {
                    reader.onMenuPageMode(1);
                  },
                },
                {
                  id: "pagemode-2",
                  label:
                    _("menu-view-layout-pagemode-doublepage") +
                    " (" +
                    _("menu-view-layout-pagemode-centerfirst") +
                    ")",
                  type: "radio",
                  checked: settings.page_mode === 2,
                  click() {
                    reader.onMenuPageMode(2);
                  },
                },
              ],
            },
            // {
            //   type: "separator",
            // },
          ],
        },
        {
          id: "view-zoom",
          label: _("menu-view-zoom"),
          enabled: true,
          submenu: [
            {
              id: "fit-to-width",
              label: _("menu-view-zoom-fitwidth"),
              type: "radio",
              checked: settings.fit_mode == 0,
              click() {
                reader.onMenuFitToWidth();
              },
            },
            {
              id: "fit-to-height",
              label: _("menu-view-zoom-fitheight"),
              type: "radio",
              checked: settings.fit_mode == 1,
              click() {
                reader.onMenuFitToHeight();
              },
            },
            {
              id: "scale-to-height",
              label: _("menu-view-zoom-scaleheight"),
              type: "radio",
              checked: settings.fit_mode == 2,
              submenu: getScaleToHeightSubmenu(settings),
            },
            {
              type: "separator",
            },
            {
              label: _("menu-view-zoom-scaleheight-in"),
              accelerator: "acc-zoom-in", //accelerator: "CommandOrControl++",
              click() {
                reader.onMenuScaleToHeightZoomInput(1);
              },
            },
            {
              label: _("menu-view-zoom-scaleheight-out"),
              accelerator: "acc-zoom-out",
              click() {
                reader.onMenuScaleToHeightZoomInput(-1);
              },
            },
            {
              label: _("menu-view-zoom-scaleheight-reset"),
              accelerator: "acc-zoom-reset",
              click() {
                reader.onMenuScaleToHeightZoomInput(0);
              },
            },
          ],
        },
        {
          id: "view-rotation",
          label: _("menu-view-rotation"),
          submenu: [
            {
              id: "rotation-0",
              label: "0º",
              type: "radio",
              checked: true,
              click() {
                reader.onMenuRotationValue(0);
              },
            },
            {
              id: "rotation-90",
              label: "90º",
              type: "radio",
              checked: false,
              click() {
                reader.onMenuRotationValue(90);
              },
            },
            {
              id: "rotation-180",
              label: "180º",
              type: "radio",
              checked: false,
              click() {
                reader.onMenuRotationValue(180);
              },
            },
            {
              id: "rotation-270",
              label: "270º",
              type: "radio",
              checked: false,
              click() {
                reader.onMenuRotationValue(270);
              },
            },
          ],
        },
        {
          id: "view-page",
          label: _("menu-view-page"),
          submenu: [
            {
              label: _("menu-view-page-first"),
              click() {
                reader.onGoToPageFirst();
              },
            },
            {
              label: _("menu-view-page-last"),
              click() {
                reader.onGoToPageLast();
              },
            },
            {
              label: _("menu-view-page-choose"),
              click() {
                reader.onGoToPageDialog();
              },
            },
          ],
        },
        {
          id: "view-filter",
          label: _("menu-view-filter"),
          submenu: [
            {
              id: "filter-0",
              label: _("menu-view-filter-0"),
              type: "radio",
              checked: settings.filterMode === 0,
              click() {
                reader.onMenuFilterValue(0);
              },
            },
            {
              id: "filter-1",
              label: _("menu-view-filter-1"),
              type: "radio",
              checked: settings.filterMode === 1,
              click() {
                reader.onMenuFilterValue(1);
              },
            },
          ],
        },
        {
          type: "separator",
        },
        {
          label: _("menu-view-layout-show-audioplayer"),
          id: "audio-player",
          type: "checkbox",
          checked: settings.showAudioPlayer,
          accelerator: "acc-audio-player",
          click() {
            core.onMenuToggleAudioPlayer();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("menu-view-togglefullscreen"),
          accelerator: "acc-fullscreen",
          click() {
            core.onMenuToggleFullScreen();
          },
        },
      ],
    },
    {
      id: "tools",
      label: _("menu-tools"),
      submenu: getToolsSubmenu(),
    },
    {
      label: _("menu-help"),
      submenu: getHelpSubmenu(),
    },
  ];

  // if (!core.isDev()) {
  //   menuTemplate[2].submenu = menuTemplate[2].submenu.slice(0, -1);
  // }
  return menu;
}

function getHomeScreenMenu(settings, history) {
  let menu = [
    {
      label: _("menu-file"),
      submenu: [
        {
          id: "open-file",
          label: _("menu-file-open"),
          accelerator: "acc-file-open",
          click() {
            reader.onMenuOpenFile();
          },
        },
        {
          id: "openrecent-file",
          label: _("menu-file-open"),
          submenu: getOpenRecentSubmenu(history),
        },
        {
          type: "separator",
        },
        {
          id: "file-preferences",
          label: _("menu-file-preferences"),
          click() {
            core.onMenuPreferences();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("menu-file-quit"),
          accelerator: "acc-quit",
          click() {
            core.onMenuQuit();
          },
        },
      ],
    },
    {
      label: _("menu-view"),
      submenu: [
        {
          label: _("menu-view-layout-show-audioplayer"),
          id: "audio-player",
          type: "checkbox",
          checked: settings.showAudioPlayer,
          accelerator: "acc-audio-player",
          click() {
            core.onMenuToggleAudioPlayer();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("menu-view-togglefullscreen"),
          accelerator: "acc-fullscreen",
          click() {
            core.onMenuToggleFullScreen();
          },
        },
      ],
    },
    {
      id: "tools",
      label: _("menu-tools"),
      submenu: getToolsSubmenu(),
    },
    {
      label: _("menu-help"),
      submenu: getHelpSubmenu(),
    },
  ];

  // if (!core.isDev()) {
  //   menuTemplate[2].submenu = menuTemplate[2].submenu.slice(0, -1);
  // }
  return menu;
}

function getToolMenu(settings, history, toolName) {
  let menu = [
    {
      label: _("menu-file"),
      submenu: [
        {
          id: "close-tool",
          label: toolName
            ? _("menu-file-closetoolname", toolName)
            : _("menu-file-closetool"),
          enabled: true,
          click() {
            core.onMenuCloseTool();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("menu-file-quit"),
          accelerator: "acc-quit",
          click() {
            core.onMenuQuit();
          },
        },
      ],
    },
    {
      label: _("menu-view"),
      submenu: [
        {
          label: _("menu-view-layout-show-audioplayer"),
          id: "audio-player",
          type: "checkbox",
          checked: settings.showAudioPlayer,
          accelerator: "acc-audio-player",
          click() {
            core.onMenuToggleAudioPlayer();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("menu-view-togglefullscreen"),
          accelerator: "acc-fullscreen",
          click() {
            core.onMenuToggleFullScreen();
          },
        },
      ],
    },
    {
      label: _("menu-help"),
      submenu: getHelpSubmenu(),
    },
  ];

  return menu;
}

function buildApplicationMenu(settings, history, isToolOpen, toolName) {
  // ref: https://stackoverflow.com/questions/54105224/electron-modify-a-single-menu-item
  // ref: https://github.com/electron/electron/issues/2717 (push items)
  let menuTemplate = [];
  if (isToolOpen) {
    menuTemplate = getToolMenu(settings, history, toolName);
  } else {
    if (reader.getFileData().path && reader.getFileData().path !== "") {
      menuTemplate = getNormalMenu(settings, history);
    } else {
      menuTemplate = getHomeScreenMenu(settings, history);
    }
  }
  const menuConfig = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menuConfig);
}
exports.buildApplicationMenu = buildApplicationMenu;

function buildEmptyMenu() {
  const menuConfig = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menuConfig);
}
exports.buildEmptyMenu = buildEmptyMenu;
