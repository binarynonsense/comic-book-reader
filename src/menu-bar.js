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

exports.setAudioPlayer = function (isChecked) {
  Menu.getApplicationMenu().getMenuItemById("audio-player").checked = isChecked;
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

exports.setEpubOpenAs = function (mode) {
  Menu.getApplicationMenu().getMenuItemById("epub-openas-0").checked =
    mode === 0;
  Menu.getApplicationMenu().getMenuItemById("epub-openas-1").checked =
    mode === 1;
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

exports.setLayoutClock = function (value) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-clock-top-left"
  ).checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-clock-top-center"
  ).checked = value === 1;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-clock-top-right"
  ).checked = value === 2;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-clock-bottom-left"
  ).checked = value === 3;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-clock-bottom-center"
  ).checked = value === 4;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-clock-bottom-right"
  ).checked = value === 5;
};
exports.setLayoutPageNum = function (value) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-pagenum-top-left"
  ).checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-pagenum-top-center"
  ).checked = value === 1;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-pagenum-top-right"
  ).checked = value === 2;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-pagenum-bottom-left"
  ).checked = value === 3;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-pagenum-bottom-center"
  ).checked = value === 4;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-pagenum-bottom-right"
  ).checked = value === 5;
};
exports.setLayoutAudioPlayer = function (value) {
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-audioplayer-top-left"
  ).checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById(
    "preferences-layout-audioplayer-bottom-left"
  ).checked = value === 3;
};

exports.setComicBookOpened = setComicBookOpened = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("file-page"),
    isEnabled
  );
  Menu.getApplicationMenu().getMenuItemById("close-file").enabled = isEnabled;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-rotation"),
    isEnabled
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-page"),
    isEnabled
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-zoom"),
    isEnabled
  );
};

exports.setEpubEbookOpened = function () {
  setComicBookOpened(true);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("file-page"),
    false
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-rotation"),
    false
  );
  EnableItemRecursive(
    Menu.getApplicationMenu().getMenuItemById("view-page"),
    true
  );
};

function EnableItemRecursive(item, isEnabled) {
  item.enabled = isEnabled;
  if (item.submenu) {
    item.submenu.items.forEach((subitem) => {
      EnableItemRecursive(subitem, isEnabled);
    });
  }
}

exports.setImageOpened = function () {
  setComicBookOpened(true);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("file-page-export").enabled = false;
};

exports.setWWWOpened = function () {
  setComicBookOpened(true);
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = false;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = false;
};

function getHelpSubmenu() {
  let menu = [];
  menu.push({
    label: _("menu-help-about"),
    click() {
      mainProcess.onMenuAbout();
    },
  });
  if (mainProcess.isDev()) {
    menu.push({
      type: "separator",
    });
    menu.push({
      label: _("menu-help-devtools-toggle"),
      click() {
        mainProcess.onMenuToggleDevTools();
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

  menu.push({
    type: "separator",
  });
  menu.push({
    label: _("menu-view-zoom-scaleheight-enter"),
    click() {
      mainProcess.onMenuScaleToHeightEnter();
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
    let label = fileUtils.reducePathString(entry.filePath);
    if (entry.data && entry.data.source) {
      if (entry.data.name) {
        label = "[www] " + fileUtils.reducePathString(entry.data.name);
      } else {
        label = "[www] " + label;
      }
    }
    menu.push({
      label: label,
      click() {
        mainProcess.tryOpen(entry.filePath, undefined, entry);
      },
    });
  }

  menu.push({
    type: "separator",
  });

  menu.push({
    label: _("menu-file-openrecent-history"),
    accelerator: "CommandOrControl+H",
    click() {
      mainProcess.onMenuOpenHistoryManager();
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
              label: _("menu-file-preferences-layout"),
              submenu: [
                {
                  label: _("menu-file-preferences-layout-clock"),
                  submenu: [
                    {
                      id: "preferences-layout-clock-top-left",
                      type: "checkbox",
                      checked: settings.layoutClock === 0,
                      label: _("menu-shared-top-left"),
                      click() {
                        mainProcess.onMenuChangeLayoutClock(0);
                      },
                    },
                    {
                      id: "preferences-layout-clock-top-center",
                      type: "checkbox",
                      checked: settings.layoutClock === 1,
                      label: _("menu-shared-top-center"),
                      click() {
                        mainProcess.onMenuChangeLayoutClock(1);
                      },
                    },
                    {
                      id: "preferences-layout-clock-top-right",
                      type: "checkbox",
                      checked: settings.layoutClock === 2,
                      label: _("menu-shared-top-right"),
                      click() {
                        mainProcess.onMenuChangeLayoutClock(2);
                      },
                    },
                    {
                      id: "preferences-layout-clock-bottom-left",
                      type: "checkbox",
                      checked: settings.layoutClock === 3,
                      label: _("menu-shared-bottom-left"),
                      click() {
                        mainProcess.onMenuChangeLayoutClock(3);
                      },
                    },
                    {
                      id: "preferences-layout-clock-bottom-center",
                      type: "checkbox",
                      checked: settings.layoutClock === 4,
                      label: _("menu-shared-bottom-center"),
                      click() {
                        mainProcess.onMenuChangeLayoutClock(4);
                      },
                    },
                    {
                      id: "preferences-layout-clock-bottom-right",
                      type: "checkbox",
                      checked: settings.layoutClock === 5,
                      label: _("menu-shared-bottom-right"),
                      click() {
                        mainProcess.onMenuChangeLayoutClock(5);
                      },
                    },
                  ],
                },
                {
                  label: _("menu-file-preferences-layout-pagenum"),
                  submenu: [
                    {
                      id: "preferences-layout-pagenum-top-left",
                      type: "checkbox",
                      checked: settings.layoutPageNum === 0,
                      label: _("menu-shared-top-left"),
                      click() {
                        mainProcess.onMenuChangeLayoutPageNum(0);
                      },
                    },
                    {
                      id: "preferences-layout-pagenum-top-center",
                      type: "checkbox",
                      checked: settings.layoutPageNum === 1,
                      label: _("menu-shared-top-center"),
                      click() {
                        mainProcess.onMenuChangeLayoutPageNum(1);
                      },
                    },
                    {
                      id: "preferences-layout-pagenum-top-right",
                      type: "checkbox",
                      checked: settings.layoutPageNum === 2,
                      label: _("menu-shared-top-right"),
                      click() {
                        mainProcess.onMenuChangeLayoutPageNum(2);
                      },
                    },
                    {
                      id: "preferences-layout-pagenum-bottom-left",
                      type: "checkbox",
                      checked: settings.layoutPageNum === 3,
                      label: _("menu-shared-bottom-left"),
                      click() {
                        mainProcess.onMenuChangeLayoutPageNum(3);
                      },
                    },
                    {
                      id: "preferences-layout-pagenum-bottom-center",
                      type: "checkbox",
                      checked: settings.layoutPageNum === 4,
                      label: _("menu-shared-bottom-center"),
                      click() {
                        mainProcess.onMenuChangeLayoutPageNum(4);
                      },
                    },
                    {
                      id: "preferences-layout-pagenum-bottom-right",
                      type: "checkbox",
                      checked: settings.layoutPageNum === 5,
                      label: _("menu-shared-bottom-right"),
                      click() {
                        mainProcess.onMenuChangeLayoutPageNum(5);
                      },
                    },
                  ],
                },
                {
                  label: _("menu-file-preferences-layout-audioplayer"),
                  submenu: [
                    {
                      id: "preferences-layout-audioplayer-top-left",
                      type: "checkbox",
                      checked: settings.layoutAudioPlayer === 0,
                      label: _("menu-shared-top-left"),
                      click() {
                        mainProcess.onMenuChangeLayoutAudioPlayer(0);
                      },
                    },
                    {
                      id: "preferences-layout-audioplayer-bottom-left",
                      type: "checkbox",
                      checked: settings.layoutAudioPlayer === 3,
                      label: _("menu-shared-bottom-left"),
                      click() {
                        mainProcess.onMenuChangeLayoutAudioPlayer(3);
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
            {
              label: _("menu-file-preferences-epub"),
              submenu: [
                {
                  label: _("menu-file-preferences-epub-openas"),
                  submenu: [
                    {
                      id: "epub-openas-0",
                      type: "checkbox",
                      checked: settings.epubOpenAs === 0,
                      label: _("menu-file-preferences-epub-openas-0"),
                      click() {
                        mainProcess.onMenuChangeEpubOpenAs(0);
                      },
                    },
                    {
                      id: "epub-openas-1",
                      type: "checkbox",
                      checked: settings.epubOpenAs === 1,
                      label: _("menu-file-preferences-epub-openas-1"),
                      click() {
                        mainProcess.onMenuChangeEpubOpenAs(1);
                      },
                    },
                  ],
                },
              ],
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
          id: "view-zoom",
          label: _("menu-view-zoom"),
          enabled: true,
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
          id: "view-rotation",
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
          id: "view-page",
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
          label: _("menu-view-showaudioplayer"),
          id: "audio-player",
          type: "checkbox",
          checked: settings.showAudioPlayer,
          accelerator: "CommandOrControl+M",
          click() {
            mainProcess.onMenuToggleAudioPlayer();
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
            {
              id: "create-file",
              label: _("menu-tools-create-qr"),
              enabled: true,
              click() {
                mainProcess.onMenuToolCreateQR();
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
        {
          type: "separator",
        },
        {
          label: _("menu-tools-other"),
          submenu: [
            {
              label: _("menu-tools-other-dcm"),
              click() {
                mainProcess.onMenuToolDCM();
              },
            },
            {
              label: _("menu-tools-other-iab"),
              click() {
                mainProcess.onMenuToolIArchive();
              },
            },
            {
              label: _("menu-tools-other-gut"),
              click() {
                mainProcess.onMenuToolGutenberg();
              },
            },
            {
              label: _("menu-tools-other-xkcd"),
              click() {
                mainProcess.onMenuToolXkcd();
              },
            },
            {
              label: _("menu-tools-other-librivox"),
              click() {
                mainProcess.onMenuToolLibrivox();
              },
            },
            {
              label: _("menu-tools-other-wiktionary"),
              click() {
                mainProcess.onMenuToolWiktionary();
              },
            },
          ],
        },
      ],
    },
    {
      label: _("menu-help"),
      submenu: getHelpSubmenu(),
    },
  ]);
  Menu.setApplicationMenu(menuConfig);
}
exports.buildApplicationMenu = buildApplicationMenu;

function getMenu() {
  return Menu.getApplicationMenu();
}
exports.getMenu = getMenu;
