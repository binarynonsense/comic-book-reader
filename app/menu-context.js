const { Menu } = require("electron");
const mainProcess = require("./main");

let contextMenu;

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.buildContextMenu = function () {
  contextMenu = Menu.buildFromTemplate([
    {
      label: _("Next Page"),
      click() {
        mainProcess.onMenuNextPage();
      },
    },
    {
      label: _("Previous Page"),
      click() {
        mainProcess.onMenuPreviousPage();
      },
    },
    {
      type: "separator",
    },
    {
      label: _("Zoom"),
      submenu: [
        {
          id: "fit-to-width",
          label: _("Fit to Width"),
          click() {
            mainProcess.onMenuFitToWidth();
          },
        },
        {
          id: "fit-to-height",
          label: _("Fit to Height"),
          click() {
            mainProcess.onMenuFitToHeight();
          },
        },
      ],
    },
    {
      label: _("Rotate"),
      submenu: [
        {
          id: "rotate-clockwise",
          label: _("Clockwise"),
          click() {
            mainProcess.onMenuRotateClockwise();
          },
        },
        {
          id: "rotation-counterclockwise",
          label: _("Counterclockwise"),
          click() {
            mainProcess.onMenuRotateCounterclockwise();
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
      label: _("Open File..."),
      accelerator: "CommandOrControl+O",
      click() {
        mainProcess.onMenuOpenFile();
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
  ]);
};

exports.getContextMenu = function () {
  return contextMenu;
};
