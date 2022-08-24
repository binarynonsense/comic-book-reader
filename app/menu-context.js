const { Menu } = require("electron");
const mainProcess = require("./main");

let g_contextMenu;

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

function buildContextMenu(showRotation, showGotoPage) {
  let contextMenu = Menu.buildFromTemplate([
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
          submenu: getScaleToHeightSubmenu(),
        },
      ],
    },
    {
      label: _("ctxmenu-rotate"),
      enabled: showRotation,
      submenu: [
        {
          id: "rotate-clockwise",
          label: _("ctxmenu-rotate-clockwise"),
          enabled: showRotation,
          click() {
            mainProcess.onMenuRotateClockwise();
          },
        },
        {
          id: "rotation-counterclockwise",
          enabled: showRotation,
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
          enabled: showGotoPage,
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
  return contextMenu;
}

exports.getContextMenu = function (showRotation, showGotoPage) {
  // if (g_contextMenu === undefined) buildContextMenu(showRotation, showGotoPage);
  // return g_contextMenu;
  return buildContextMenu(showRotation, showGotoPage);
};

function getScaleToHeightSubmenu() {
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
