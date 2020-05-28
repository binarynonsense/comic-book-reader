const { app, Menu, BrowserWindow } = require("electron");

const mainProcess = require("./main");

function AddApplicationMenu() {
  // ref: https://stackoverflow.com/questions/54105224/electron-modify-a-single-menu-item
  //   Menu.getApplicationMenu().items // all the items
  // Menu.getApplicationMenu().getMenuItemById('MENU_ITEM_ID') // get a single item by its id

  const template = [
    {
      label: "Edit",
      submenu: [
        {
          label: "Copy",
          accelerator: "CommandOrControl+C",
          role: "copy",
        },
        {
          label: "Paste",
          accelerator: "CommandOrControl+V",
          role: "paste",
        },
      ],
    },
  ];

  const menuConfig = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open File...",
          accelerator: "CommandOrControl+O",
          click() {
            mainProcess.openFile();
          },
        },
        {
          label: "Quit",
          accelerator: "CommandOrControl+Q",
          click() {
            app.quit();
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Full Screen",
          accelerator: "F11",
          click() {
            mainProcess.toggleFullScreen();
            //mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
        {
          label: "Toggle Scroll Bar",
          accelerator: "CommandOrControl+B",
          click() {
            mainProcess.toggleScrollBar();
          },
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menuConfig);
}
exports.AddApplicationMenu = AddApplicationMenu;
