const { app, Menu } = require("electron");
const mainProcess = require("./main");
const fileUtils = require("./file-utils");

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.setFitToWidth = function () {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = true;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = false;
};

exports.setFitToHeight = function () {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = false;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = true;
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

exports.setFileOpened = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("extract-file").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-page").enabled = isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-page-export").enabled =
    isEnabled;
  Menu.getApplicationMenu().getMenuItemById("file-page-extract").enabled =
    isEnabled;
  Menu.getApplicationMenu().getMenuItemById("close-file").enabled = isEnabled;
};

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
  // Menu.getApplicationMenu().items // all the items
  // Menu.getApplicationMenu().getMenuItemById('MENU_ITEM_ID') // get a single item by its id
  // ref: https://github.com/electron/electron/issues/2717 (push items)

  let languagesSubmenu = [];

  if (languages !== undefined) {
    for (let language of languages) {
      let nativeName = language.nativeName;
      if (fileUtils.isVersionOlder(language.acbrVersion, "2.0.0-beta1")) {
        nativeName +=
          " (" + _("menu-file-preferences-languages-incompletelanguage") + ")";
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
              id: "file-page-extract",
              label: _("menu-file-page-extract"),
              enabled: false,
              click() {
                mainProcess.onMenuPageExtractText();
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
              id: "extract-text",
              label: _("menu-tools-extract-text"),
              enabled: true,
              click() {
                mainProcess.onMenuToolExtractText();
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
