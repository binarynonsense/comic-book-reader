const { Menu } = require("electron");
const mainProcess = require("./main");

let contextMenu;

exports.buildContextMenu = function () {
  contextMenu = Menu.buildFromTemplate([
    {
      label: "Next Page",
      click() {
        mainProcess.onMenuNextPage();
      },
    },
    {
      label: "Previous Page",
      click() {
        mainProcess.onMenuPreviousPage();
      },
    },
    {
      type: "separator",
    },
    {
      label: "Zoom",
      submenu: [
        {
          id: "fit-to-width",
          label: "Fit to Width",
          click() {
            mainProcess.onMenuFitToWidth();
          },
        },
        {
          id: "fit-to-height",
          label: "Fit to Height",
          click() {
            mainProcess.onMenuFitToHeight();
          },
        },
      ],
    },
    {
      label: "Rotate",
      submenu: [
        {
          id: "rotate-clockwise",
          label: "Clockwise",
          click() {
            mainProcess.onMenuRotateClockwise();
          },
        },
        {
          id: "rotation-counterclockwise",
          label: "Counterclockwise",
          click() {
            mainProcess.onMenuRotateCounterclockwise();
          },
        },
      ],
    },
    {
      label: "Page",
      submenu: [
        {
          label: "Go To First",
          click() {
            mainProcess.onGoToPageFirst();
          },
        },
        {
          label: "Go To Last",
          click() {
            mainProcess.onGoToPageLast();
          },
        },
        {
          label: "Go To...",
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
      label: "Open File...",
      accelerator: "CommandOrControl+O",
      click() {
        mainProcess.onMenuOpenFile();
      },
    },
    {
      type: "separator",
    },
    {
      label: "Toggle Full Screen",
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
