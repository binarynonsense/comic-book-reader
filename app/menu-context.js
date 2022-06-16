const { Menu } = require("electron");
const mainProcess = require("./main");

let contextMenu;

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.buildContextMenu = function () {
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
