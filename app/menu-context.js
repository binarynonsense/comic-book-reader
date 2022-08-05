const { Menu } = require("electron");
const mainProcess = require("./main");

let contextMenu;

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.buildContextMenu = function (settings) {
  contextMenu = Menu.buildFromTemplate([
    {
      label: _("ctxmenu-nextpage"),
      click() {
        mainProcess.onMenuNextPage();
      },
    },
    {
      label: _("ctxmenu-prevpage"),
      click() {
        mainProcess.onMenuPreviousPage();
      },
    },
    {
      type: "separator",
    },
    {
      label: _("menu-view-zoom"),
      submenu: [
        {
          id: "fit-to-width",
          label: _("menu-view-zoom-fitwidth"),
          click() {
            mainProcess.onMenuFitToWidth();
          },
        },
        {
          id: "fit-to-height",
          label: _("menu-view-zoom-fitheight"),
          click() {
            mainProcess.onMenuFitToHeight();
          },
        },
        {
          id: "scale-to-height",
          label: _("menu-view-zoom-scaleheight"),
          submenu: getScaleToHeightSubmenu(settings),
        },
      ],
    },
    {
      label: _("ctxmenu-rotate"),
      submenu: [
        {
          id: "rotate-clockwise",
          label: _("ctxmenu-rotate-clockwise"),
          click() {
            mainProcess.onMenuRotateClockwise();
          },
        },
        {
          id: "rotation-counterclockwise",
          label: _("ctxmenu-rotate-counterclockwise"),
          click() {
            mainProcess.onMenuRotateCounterclockwise();
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
      label: _("ctxmenu-openfile"),
      accelerator: "CommandOrControl+O",
      click() {
        mainProcess.onMenuOpenFile();
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
  ]);
};

exports.getContextMenu = function () {
  return contextMenu;
};

function getScaleToHeightSubmenu(settings) {
  let menu = [];
  let defaults = [25, 50, 100, 150, 200, 300, 400];
  defaults.forEach((scale) => {
    menu.push({
      label: `${scale}%`,
      click() {
        mainProcess.onMenuScaleToHeight(scale);
      },
    });
  });
  if (settings.fit_mode == 2) {
    menu.push({
      type: "separator",
    });
    menu.push({
      label: _("menu-view-zoom-scaleheight-enter"),
      click() {
        mainProcess.onMenuScaleToHeightEnter();
      },
    });
  }

  return menu;
}
