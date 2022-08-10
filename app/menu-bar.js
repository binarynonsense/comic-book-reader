const { app, Menu } = require("electron");
const mainProcess = require("./main");
const fileUtils = require("./file-utils");

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.setFitToWidth = function () {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = true;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = false;
  Menu.getApplicationMenu().getMenuItemById("scale-to-height").checked = false;
};

exports.setFitToHeight = function () {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = false;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = true;
  Menu.getApplicationMenu().getMenuItemById("scale-to-height").checked = false;
};

exports.setScaleToHeight = function () {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = false;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = false;
  Menu.getApplicationMenu().getMenuItemById("scale-to-height").checked = true;
};

exports.setScrollBar = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("scrollbar").checked = isChecked;
};

exports.setToolBar = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("toolbar").checked = isChecked;
};

exports.setPageNumber = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("page-number").checked = isChecked;
};

exports.setClock = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("clock").checked = isChecked;
};

exports.setPageRotation = function (value) {
  Menu.getApplicationMenu().getMenuItemById("rotation-0").checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById("rotation-90").checked =
    value === 90;
  Menu.getApplicationMenu().getMenuItemById("rotation-180").checked =
    value === 180;
  Menu.getApplicationMenu().getMenuItemById("rotation-270").checked =
    value === 270;
};

exports.setHotspotsMode = function (mode) {
  Menu.getApplicationMenu().getMenuItemById("hotspots-0").checked = mode === 0;
  Menu.getApplicationMenu().getMenuItemById("hotspots-1").checked = mode === 1;
  Menu.getApplicationMenu().getMenuItemById("hotspots-2").checked = mode === 2;
};

exports.setAutoOpen = function (mode) {
  Menu.getApplicationMenu().getMenuItemById("auto-open-0").checked = mode === 0;
  Menu.getApplicationMenu().getMenuItemById("auto-open-1").checked = mode === 1;
  Menu.getApplicationMenu().getMenuItemById("auto-open-2").checked = mode === 2;
};

exports.setMouseCursorMode = function (mode) {
  Menu.getApplicationMenu().getMenuItemById("cursor-visibility-0").checked =
    mode === 0;
  Menu.getApplicationMenu().getMenuItemById("cursor-visibility-1").checked =
    mode === 1;
};

exports.setZoomDefault = function (mode) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-zoom-default-fitwidth"
  ).checked = mode === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-zoom-default-fitheight"
  ).checked = mode === 1;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-zoom-default-lastused"
  ).checked = mode === 2;
};
exports.setZoomFileLoading = function (mode) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-zoom-fileloading-default"
  ).checked = mode === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-zoom-fileloading-history"
  ).checked = mode === 1;
};

exports.setLoadingIndicatorBG = function (value) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-loading-bg-0"
  ).checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-loading-bg-1"
  ).checked = value === 1;
};
exports.setLoadingIndicatorIconSize = function (value) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-loading-isize-0"
  ).checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-loading-isize-1"
  ).checked = value === 1;
};
exports.setLoadingIndicatorIconPos = function (value) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-loading-ipos-0"
  ).checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-loading-ipos-1"
  ).checked = value === 1;
};

exports.setFileOpened = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-page").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-page-export").enabled =
    isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-page-extract-text").enabled =
    isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-page-extract-qr").enabled =
    isEnabled;
  Menu.getApplicationMenu().getMenuItemById(
    "file-page-extract-palette"
  ).enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("close-file").enabled = isEnabled;
};

exports.setImageOpened = function () {
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("file-page").enabled = true;
  Menu.getApplicationMenu().getMenuItemById("file-page-export").enabled = false;
  Menu.getApplicationMenu().getMenuItemById(
    "file-page-extract-text"
  ).enabled = true;
  Menu.getApplicationMenu().getMenuItemById(
    "file-page-extract-qr"
  ).enabled = true;
  Menu.getApplicationMenu().getMenuItemById(
    "file-page-extract-palette"
  ).enabled = true;
  Menu.getApplicationMenu().getMenuItemById("close-file").enabled = true;
};

function getScaleToHeightSubmenu(settings) {
  let menu = [];
  let defaults = [25, 50, 100, 150, 200, 300, 400];
  let found = false;
  defaults.forEach((scale) => {
    if (settings.zoom_scale == scale) found = true;
    menu.push({
      label: `${scale}%`,
      type: "checkbox",
      checked: settings.fit_mode == 2 && settings.zoom_scale == scale,
      click() {
        mainProcess.onMenuScaleToHeight(scale);
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
      type: "checkbox",
      checked: settings.fit_mode == 2 ? true : false,
      click() {
        mainProcess.onMenuScaleToHeight(settings.zoom_scale);
      },
    });
  }

  //if (settings.fit_mode == 2) {
  menu.push({
    type: "separator",
  });
  menu.push({
    label: _("menu-view-zoom-scaleheight-enter"),
    click() {
      mainProcess.onMenuScaleToHeightEnter();
    },
  });
  //}

  return menu;
}

function getOpenRecentSubmenu(history) {
  let menu = [];
  const reverseHistory = history.slice().reverse();

  for (let index = 0; index < reverseHistory.length; index++) {
    const entry = reverseHistory[index];
    let path = entry.filePath;
    menu.push({
      label: fileUtils.reducePathString(path),
      click() {
        mainProcess.onMenuOpenFile(path);
      },
    });
  }

  menu.push({
    type: "separator",
  });

  menu.push({
    label: _("menu-file-openrecent-clear"),
    click() {
      mainProcess.onMenuClearHistory();
    },
  });

  return menu;
}

function buildEmptyMenu() {
  const menuConfig = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menuConfig);
}
exports.buildEmptyMenu = buildEmptyMenu;

function buildApplicationMenu(
  activeLocale,
  languages,
  activeTheme,
  themes,
  settings,
  history
) {
  // ref: https://stackoverflow.com/questions/54105224/electron-modify-a-single-menu-item
  // ref: https://github.com/electron/electron/issues/2717 (push items)

  let languagesSubmenu = [];

  if (languages !== undefined) {
    let incompleteLanguages = [];
    for (let language of languages) {
      let nativeName = language.nativeName;
      if (fileUtils.isVersionOlder(language.acbrVersion, "2.0.0")) {
        incompleteLanguages.push(language);
        continue;
      }
      languagesSubmenu.push({
        label: nativeName,
        type: "checkbox",
        checked: language.locale === activeLocale,
        click() {
          mainProcess.onMenuChangeLanguage(language.locale);
        },
      });
    }

    if (incompleteLanguages.length > 0) {
      let incompleteSubmenu = [];
      for (let language of incompleteLanguages) {
        incompleteSubmenu.push({
          label: language.nativeName,
          type: "checkbox",
          checked: language.locale === activeLocale,
          click() {
            mainProcess.onMenuChangeLanguage(language.locale);
          },
        });
      }
      languagesSubmenu.push({
        label: _("menu-file-preferences-languages-incompletelanguages"),
        submenu: incompleteSubmenu,
      });
    }
  } else {
    languagesSubmenu = [
      {
        label: "English",
        type: "checkbox",
        checked: true,
        click() {
          mainProcess.onMenuChangeLanguage("en");
        },
      },
    ];
  }

  let themesSubmenu = [];

  if (themes !== undefined) {
    for (let theme of themes) {
      themesSubmenu.push({
        label: theme.name,
        type: "checkbox",
        checked: theme.filename === activeTheme,
        click() {
          mainProcess.onMenuChangeTheme(theme.filename);
        },
      });
    }
  } else {
    themesSubmenu = [
      {
        label: "ACBR Gray",
        type: "checkbox",
        checked: true,
        click() {
          mainProcess.onMenuChangeTheme("acbr-gray");
        },
      },
    ];
  }

  const menuConfig = Menu.buildFromTemplate([
    {
      label: _("menu-file"),
      submenu: [
        {
          label: _("menu-file-open"),
          accelerator: "CommandOrControl+O",
          click() {
            mainProcess.onMenuOpenFile();
          },
        },
        {
          label: _("menu-file-openrecent"),
          submenu: getOpenRecentSubmenu(history),
        },
        {
          id: "close-file",
          label: _("menu-file-close"),
          enabled: false,
          click() {
            mainProcess.onMenuCloseFile();
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
            mainProcess.onMenuConvertFile();
          },
        },
        {
          id: "extract-file",
          label: _("menu-file-extract"),
          enabled: false,
          click() {
            mainProcess.onMenuExtractFile();
          },
        },
        {
          type: "separator",
        },
        {
          id: "file-page",
          label: _("menu-file-page"),
          submenu: [
            {
              id: "file-page-export",
              label: _("menu-file-page-export"),
              enabled: false,
              click() {
                mainProcess.onMenuPageExport();
              },
            },
            {
              id: "file-page-extract-palette",
              label: _("menu-file-page-extract-palette"),
              enabled: false,
              click() {
                mainProcess.onMenuPageExtractPalette();
              },
            },
            {
              id: "file-page-extract-text",
              label: _("menu-file-page-extract-text"),
              enabled: false,
              click() {
                mainProcess.onMenuPageExtractText();
              },
            },
            {
              id: "file-page-extract-qr",
              label: _("menu-file-page-extract-qr"),
              enabled: false,
              click() {
                mainProcess.onMenuPageExtractQR();
              },
            },
          ],
        },

        {
          type: "separator",
        },
        {
          label: _("menu-file-preferences"),
          submenu: [
            {
              label: _("menu-file-preferences-languages"),
              submenu: languagesSubmenu,
            },
            {
              label: _("menu-file-preferences-zoom"),
              submenu: [
                {
                  label: _("menu-file-preferences-zoom-default"),
                  submenu: [
                    {
                      id: "preferences-zoom-default-fitwidth",
                      type: "checkbox",
                      checked: settings.zoomDefault === 0,
                      label: _("menu-file-preferences-zoom-default-fitwidth"),
                      click() {
                        mainProcess.onMenuChangeZoomDefault(0);
                      },
                    },
                    {
                      id: "preferences-zoom-default-fitheight",
                      type: "checkbox",
                      checked: settings.zoomDefault === 1,
                      label: _("menu-file-preferences-zoom-default-fitheight"),
                      click() {
                        mainProcess.onMenuChangeZoomDefault(1);
                      },
                    },
                    {
                      id: "preferences-zoom-default-lastused",
                      type: "checkbox",
                      checked: settings.zoomDefault === 2,
                      label: _("menu-file-preferences-zoom-default-lastused"),
                      click() {
                        mainProcess.onMenuChangeZoomDefault(2);
                      },
                    },
                  ],
                },
                ,
                {
                  label: _("menu-file-preferences-zoom-fileloading"),
                  submenu: [
                    {
                      id: "preferences-zoom-fileloading-default",
                      type: "checkbox",
                      checked: settings.zoomFileLoading === 0,
                      label: _(
                        "menu-file-preferences-zoom-fileloading-default"
                      ),
                      click() {
                        mainProcess.onMenuChangeZoomFileLoading(0);
                      },
                    },
                    {
                      id: "preferences-zoom-fileloading-history",
                      type: "checkbox",
                      checked: settings.zoomFileLoading === 1,
                      label: _(
                        "menu-file-preferences-zoom-fileloading-history"
                      ),
                      click() {
                        mainProcess.onMenuChangeZoomFileLoading(1);
                      },
                    },
                  ],
                },
              ],
            },
            {
              label: _("menu-file-preferences-themes"),
              submenu: themesSubmenu,
            },
            {
              label: _("menu-file-preferences-hotspots"),
              submenu: [
                {
                  id: "hotspots-0",
                  type: "checkbox",
                  checked: settings.hotspots_mode === 0,
                  label: _("menu-file-preferences-hotspots-disabled"),
                  click() {
                    mainProcess.onMenuChangeHotspotsMode(0);
                  },
                },
                {
                  id: "hotspots-1",
                  type: "checkbox",
                  checked: settings.hotspots_mode === 1,
                  label: _("menu-file-preferences-hotspots-2columns"),
                  click() {
                    mainProcess.onMenuChangeHotspotsMode(1);
                  },
                },
                {
                  id: "hotspots-2",
                  type: "checkbox",
                  checked: settings.hotspots_mode === 2,
                  label: _("menu-file-preferences-hotspots-3columns"),
                  click() {
                    mainProcess.onMenuChangeHotspotsMode(2);
                  },
                },
              ],
            },
            {
              label: _("menu-file-preferences-autoopen"),
              submenu: [
                {
                  id: "auto-open-0",
                  type: "checkbox",
                  checked: settings.autoOpen === 0,
                  label: _("menu-file-preferences-autoopen-disabled"),
                  click() {
                    mainProcess.onMenuChangeAutoOpen(0);
                  },
                },
                {
                  id: "auto-open-1",
                  type: "checkbox",
                  checked: settings.autoOpen === 1,
                  label: _("menu-file-preferences-autoopen-next"),
                  click() {
                    mainProcess.onMenuChangeAutoOpen(1);
                  },
                },
                {
                  id: "auto-open-2",
                  type: "checkbox",
                  checked: settings.autoOpen === 2,
                  label: _("menu-file-preferences-autoopen-nextandprev"),
                  click() {
                    mainProcess.onMenuChangeAutoOpen(2);
                  },
                },
              ],
            },
            {
              label: _("menu-file-preferences-cursor"),
              submenu: [
                {
                  id: "cursor-visibility-0",
                  type: "checkbox",
                  checked: settings.cursorVisibility === 0,
                  label: _("menu-file-preferences-cursor-always"),
                  click() {
                    mainProcess.onMenuChangeMouseCursorVisibility(0);
                  },
                },
                {
                  id: "cursor-visibility-1",
                  type: "checkbox",
                  checked: settings.cursorVisibility === 1,
                  label: _("menu-file-preferences-cursor-hide-inactive"),
                  click() {
                    mainProcess.onMenuChangeMouseCursorVisibility(1);
                  },
                },
              ],
            },
            {
              label: _("menu-file-preferences-loading"),
              submenu: [
                {
                  label: _("menu-file-preferences-loading-bg"),
                  submenu: [
                    {
                      id: "preferences-loading-bg-0",
                      type: "checkbox",
                      checked: settings.loadingIndicatorBG === 0,
                      label: _("menu-file-preferences-loading-bg-0"),
                      click() {
                        mainProcess.onMenuChangeLoadingIndicatorBG(0);
                      },
                    },
                    {
                      id: "preferences-loading-bg-1",
                      type: "checkbox",
                      checked: settings.loadingIndicatorBG === 1,
                      label: _("menu-file-preferences-loading-bg-1"),
                      click() {
                        mainProcess.onMenuChangeLoadingIndicatorBG(1);
                      },
                    },
                  ],
                },
                {
                  label: _("menu-file-preferences-loading-isize"),
                  submenu: [
                    {
                      id: "preferences-loading-isize-0",
                      type: "checkbox",
                      checked: settings.loadingIndicatorIconSize === 0,
                      label: _("menu-file-preferences-loading-isize-0"),
                      click() {
                        mainProcess.onMenuChangeLoadingIndicatorIconSize(0);
                      },
                    },
                    {
                      id: "preferences-loading-isize-1",
                      type: "checkbox",
                      checked: settings.loadingIndicatorIconSize === 1,
                      label: _("menu-file-preferences-loading-isize-1"),
                      click() {
                        mainProcess.onMenuChangeLoadingIndicatorIconSize(1);
                      },
                    },
                  ],
                },
                {
                  label: _("menu-file-preferences-loading-ipos"),
                  submenu: [
                    {
                      id: "preferences-loading-ipos-0",
                      type: "checkbox",
                      checked: settings.loadingIndicatorIconPos === 0,
                      label: _("menu-file-preferences-loading-ipos-0"),
                      click() {
                        mainProcess.onMenuChangeLoadingIndicatorIconPos(0);
                      },
                    },
                    {
                      id: "preferences-loading-ipos-1",
                      type: "checkbox",
                      checked: settings.loadingIndicatorIconPos === 1,
                      label: _("menu-file-preferences-loading-ipos-1"),
                      click() {
                        mainProcess.onMenuChangeLoadingIndicatorIconPos(1);
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "separator",
        },
        {
          label: _("menu-file-quit"),
          accelerator: "CommandOrControl+Q",
          click() {
            app.quit();
          },
        },
      ],
    },
    {
      label: _("menu-view"),
      submenu: [
        {
          label: _("menu-view-zoom"),
          submenu: [
            {
              id: "fit-to-width",
              label: _("menu-view-zoom-fitwidth"),
              type: "checkbox",
              checked: settings.fit_mode == 0,
              click() {
                mainProcess.onMenuFitToWidth();
              },
            },
            {
              id: "fit-to-height",
              label: _("menu-view-zoom-fitheight"),
              type: "checkbox",
              checked: settings.fit_mode == 1,
              click() {
                mainProcess.onMenuFitToHeight();
              },
            },
            {
              id: "scale-to-height",
              label: _("menu-view-zoom-scaleheight"),
              type: "checkbox",
              checked: settings.fit_mode == 2,
              submenu: getScaleToHeightSubmenu(settings),
            },

            {
              type: "separator",
            },
            {
              label: _("menu-view-zoom-scaleheight-in"),
              accelerator: "CommandOrControl++",
              click() {
                mainProcess.onMenuScaleToHeightZoomInput(1);
              },
            },
            {
              label: _("menu-view-zoom-scaleheight-out"),
              accelerator: "CommandOrControl+-",
              click() {
                mainProcess.onMenuScaleToHeightZoomInput(-1);
              },
            },
            {
              label: _("menu-view-zoom-scaleheight-reset"),
              accelerator: "CommandOrControl+0",
              click() {
                mainProcess.onMenuScaleToHeightZoomInput(0);
              },
            },
          ],
        },
        {
          label: _("menu-view-rotation"),
          submenu: [
            {
              id: "rotation-0",
              label: "0º",
              type: "checkbox",
              checked: true,
              click() {
                mainProcess.onMenuRotationValue(0);
              },
            },
            {
              id: "rotation-90",
              label: "90º",
              type: "checkbox",
              checked: false,
              click() {
                mainProcess.onMenuRotationValue(90);
              },
            },
            {
              id: "rotation-180",
              label: "180º",
              type: "checkbox",
              checked: false,
              click() {
                mainProcess.onMenuRotationValue(180);
              },
            },
            {
              id: "rotation-270",
              label: "270º",
              type: "checkbox",
              checked: false,
              click() {
                mainProcess.onMenuRotationValue(270);
              },
            },
          ],
        },
        {
          label: _("menu-view-page"),
          submenu: [
            {
              label: _("menu-view-page-first"),
              click() {
                mainProcess.onGoToPageFirst();
              },
            },
            {
              label: _("menu-view-page-last"),
              click() {
                mainProcess.onGoToPageLast();
              },
            },
            {
              label: _("menu-view-page-choose"),
              click() {
                mainProcess.onGoToPageDialog();
              },
            },
          ],
        },
        {
          type: "separator",
        },
        {
          label: _("menu-view-showscrollbar"),
          id: "scrollbar",
          type: "checkbox",
          checked: settings.showScrollBar,
          accelerator: "CommandOrControl+B",
          click() {
            mainProcess.onMenuToggleScrollBar();
          },
        },
        {
          label: _("menu-view-showtoolbar"),
          id: "toolbar",
          type: "checkbox",
          checked: settings.showToolBar,
          accelerator: "CommandOrControl+T",
          click() {
            mainProcess.onMenuToggleToolBar();
          },
        },
        {
          label: _("menu-view-showpagenum"),
          id: "page-number",
          type: "checkbox",
          checked: settings.showPageNumber,
          accelerator: "CommandOrControl+P",
          click() {
            mainProcess.onMenuTogglePageNumber();
          },
        },
        {
          label: _("menu-view-showclock"),
          id: "clock",
          type: "checkbox",
          checked: settings.showClock,
          accelerator: "CommandOrControl+J",
          click() {
            mainProcess.onMenuToggleClock();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("menu-view-togglefullscreen"),
          accelerator: "F11",
          click() {
            mainProcess.onMenuToggleFullScreen();
          },
        },
      ],
    },
    {
      label: _("menu-tools"),
      submenu: [
        {
          label: _("menu-tools-convert"),
          submenu: [
            {
              id: "convert-files",
              label: _("menu-tools-convert-comics"),
              click() {
                mainProcess.onMenuToolConvertComics();
              },
            },
            {
              id: "convert-imgs",
              label: _("menu-tools-convert-images"),
              click() {
                mainProcess.onMenuToolConvertImages();
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
                mainProcess.onMenuToolCreateComic();
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
                mainProcess.onMenuToolExtractComics();
              },
            },
            {
              id: "extract-palette",
              label: _("menu-tools-extract-palette"),
              enabled: true,
              click() {
                mainProcess.onMenuToolExtractPalette();
              },
            },
            {
              id: "extract-text",
              label: _("menu-tools-extract-text"),
              enabled: true,
              click() {
                mainProcess.onMenuToolExtractText();
              },
            },
            {
              id: "extract-qr",
              label: _("menu-tools-extract-qr"),
              enabled: true,
              click() {
                mainProcess.onMenuToolExtractQR();
              },
            },
          ],
        },
      ],
    },
    {
      label: _("menu-help"),
      submenu: [
        {
          label: _("menu-help-about"),
          click() {
            mainProcess.onMenuAbout();
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menuConfig);
}
exports.buildApplicationMenu = buildApplicationMenu;

function getMenu() {
  return Menu.getApplicationMenu();
}
exports.getMenu = getMenu;
