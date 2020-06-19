const { app, Menu } = require("electron");
const mainProcess = require("./main");

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

exports.setPageRotation = function (value) {
  Menu.getApplicationMenu().getMenuItemById("rotation-0").checked = value === 0;
  Menu.getApplicationMenu().getMenuItemById("rotation-90").checked =
    value === 90;
  Menu.getApplicationMenu().getMenuItemById("rotation-180").checked =
    value === 180;
  Menu.getApplicationMenu().getMenuItemById("rotation-270").checked =
    value === 270;
};

exports.setConvertFile = function (isEnabled) {
  Menu.getApplicationMenu().getMenuItemById("convert-file").enabled = isEnabled;
};

// exports.setLanguage = function (locale) {
//   Menu.getApplicationMenu().getMenuItemById("language").checked = isChecked;
// };

function buildApplicationMenu(activeLocale, languages) {
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
        // {
        //   id: "export-page",
        //   label: _("Export Page..."),
        //   enabled: false,
        // },
        // {
        //   id: "batch-convert",
        //   label: _("Batch Convert..."),
        // },
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
              checked: true,
              click() {
                mainProcess.onMenuFitToWidth();
              },
            },
            {
              id: "fit-to-height",
              label: _("Fit to Height"),
              checked: false,
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
          checked: true,
          accelerator: "CommandOrControl+B",
          click() {
            mainProcess.onMenuToggleScrollBar();
          },
        },
        {
          label: _("Show Tool Bar"),
          id: "toolbar",
          checked: true,
          accelerator: "CommandOrControl+T",
          click() {
            mainProcess.onMenuToggleToolBar();
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
