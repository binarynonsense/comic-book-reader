const { app, Menu, MenuItem } = require("electron");
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
  //   contextMenu = new Menu();
  //   contextMenu.append(
  //     new MenuItem({
  //       label: "Next Page",
  //       click: function () {
  //         //mainProcess.onMenuNextPage();
  //       },
  //     })
  //   );
};

exports.getContextMenu = function () {
  return contextMenu;
};
