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

exports.setConvertFile = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = isEnabled;
};

exports.setExportPage = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("export-page").enabled = isEnabled;
};

exports.setCloseFile = function (isEnabled) {
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
    label: _("Clear History"),
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
      languagesSubmenu.push({
        label: language.nativeName,
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
        checked: true,
        click() {
          mainProcess.onMenuChangeTheme("acbr-gray");
        },
      },
    ];
  }

  const menuConfig = Menu.buildFromTemplate([
    {
      label: _("File"),
      submenu: [
        {
          label: _("Open..."),
          accelerator: "CommandOrControl+O",
          click() {
            mainProcess.onMenuOpenFile();
          },
        },
        {
          label: _("Open Recent"),
          submenu: getOpenRecentSubmenu(history),
        },
        {
          id: "close-file",
          label: _("Close..."),
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
          label: _("Convert..."),
          enabled: false,
          click() {
            mainProcess.onMenuConvertFile();
          },
        },
        {
          id: "export-page",
          label: _("Export Page..."),
          enabled: false,
          click() {
            mainProcess.onMenuExportPage();
          },
        },
        {
          type: "separator",
        },
        {
          id: "batch-convert",
          label: _("Batch Convert..."),
          click() {
            mainProcess.onMenuBatchConvert();
          },
        },
        {
          id: "create-file",
          label: _("Create..."),
          enabled: true,
          click() {
            mainProcess.onMenuCreateFile();
          },
        },
        {
          type: "separator",
        },
        {
          label: _("Preferences"),
          submenu: [
            {
              label: _("Languages"),
              submenu: languagesSubmenu,
            },
            {
              label: _("Color Themes"),
              submenu: themesSubmenu,
            },
            {
              label: _("Hotspots-Config"),
              submenu: [
                {
                  id: "hotspots-0",
                  checked: settings.hotspots_mode === 0,
                  label: _("Hotspots-Disabled"),
                  click() {
                    mainProcess.onMenuChangeHotspotsMode(0);
                  },
                },
                {
                  id: "hotspots-1",
                  checked: settings.hotspots_mode === 1,
                  label: _("Hotspots-2-Columns"),
                  click() {
                    mainProcess.onMenuChangeHotspotsMode(1);
                  },
                },
                {
                  id: "hotspots-2",
                  checked: settings.hotspots_mode === 2,
                  label: _("Hotspots-3-Columns"),
                  click() {
                    mainProcess.onMenuChangeHotspotsMode(2);
                  },
                },
              ],
            },
            {
              label: _("AutoOpen-Config"),
              submenu: [
                {
                  id: "auto-open-0",
                  checked: settings.autoOpen === 0,
                  label: _("AutoOpen-Disabled"),
                  click() {
                    mainProcess.onMenuChangeAutoOpen(0);
                  },
                },
                {
                  id: "auto-open-1",
                  checked: settings.autoOpen === 1,
                  label: _("AutoOpen-Next"),
                  click() {
                    mainProcess.onMenuChangeAutoOpen(1);
                  },
                },
                {
                  id: "auto-open-2",
                  checked: settings.autoOpen === 2,
                  label: _("AutoOpen-NextAndPrev"),
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
          label: _("Quit"),
          accelerator: "CommandOrControl+Q",
          click() {
            app.quit();
          },
        },
      ],
    },
    {
      label: _("View"),
      submenu: [
        {
          label: _("Zoom"),
          submenu: [
            {
              id: "fit-to-width",
              label: _("Fit to Width"),
              checked: settings.fit_mode == 0,
              click() {
                mainProcess.onMenuFitToWidth();
              },
            },
            {
              id: "fit-to-height",
              label: _("Fit to Height"),
              checked: settings.fit_mode == 1,
              click() {
                mainProcess.onMenuFitToHeight();
              },
            },
          ],
        },
        {
          label: _("Rotation"),
          submenu: [
            {
              id: "rotation-0",
              label: "0º",
              checked: true,
              click() {
                mainProcess.onMenuRotationValue(0);
              },
            },
            {
              id: "rotation-90",
              label: "90º",
              checked: false,
              click() {
                mainProcess.onMenuRotationValue(90);
              },
            },
            {
              id: "rotation-180",
              label: "180º",
              checked: false,
              click() {
                mainProcess.onMenuRotationValue(180);
              },
            },
            {
              id: "rotation-270",
              label: "270º",
              checked: false,
              click() {
                mainProcess.onMenuRotationValue(270);
              },
            },
          ],
        },
        {
          label: _("Page"),
          submenu: [
            {
              label: _("Go to First"),
              click() {
                mainProcess.onGoToPageFirst();
              },
            },
            {
              label: _("Go to Last"),
              click() {
                mainProcess.onGoToPageLast();
              },
            },
            {
              label: _("Go to..."),
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
          label: _("Show Scroll Bar"),
          id: "scrollbar",
          checked: settings.showScrollBar,
          accelerator: "CommandOrControl+B",
          click() {
            mainProcess.onMenuToggleScrollBar();
          },
        },
        {
          label: _("Show Tool Bar"),
          id: "toolbar",
          checked: settings.showToolBar,
          accelerator: "CommandOrControl+T",
          click() {
            mainProcess.onMenuToggleToolBar();
          },
        },
        {
          label: _("Show Page Number"),
          id: "page-number",
          checked: settings.showPageNumber,
          accelerator: "CommandOrControl+P",
          click() {
            mainProcess.onMenuTogglePageNumber();
          },
        },
        {
          label: _("Show Clock"),
          id: "clock",
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
          label: _("Toggle Full Screen"),
          accelerator: "F11",
          click() {
            mainProcess.onMenuToggleFullScreen();
          },
        },
      ],
    },
    {
      label: _("Help"),
      submenu: [
        {
          label: _("About"),
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
