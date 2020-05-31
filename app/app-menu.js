const { app, Menu, BrowserWindow } = require("electron");

const mainProcess = require("./main");

function setFitToWidth() {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = true;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = false;
}
exports.setFitToWidth = setFitToWidth;

function setFitToHeight() {
  Menu.getApplicationMenu().getMenuItemById("fit-to-width").checked = false;
  Menu.getApplicationMenu().getMenuItemById("fit-to-height").checked = true;
}
exports.setFitToHeight = setFitToHeight;

function buildApplicationMenu() {
  // ref: https://stackoverflow.com/questions/54105224/electron-modify-a-single-menu-item
  //   Menu.getApplicationMenu().items // all the items
  // Menu.getApplicationMenu().getMenuItemById('MENU_ITEM_ID') // get a single item by its id

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
        // {
        //   type: "separator",
        // },
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
          id: "fit-to-width",
          label: "Fit to Width",
          //type: "checkbox",
          checked: true,
          click() {
            mainProcess.onMenuFitToWidth();
          },
        },
        {
          id: "fit-to-height",
          label: "Fit to Height",
          //type: "checkbox",
          checked: false,
          click() {
            mainProcess.onMenuFitToHeight();
          },
        },

        // {
        //   type: "separator",
        // },
        // {
        //   id: "single-page",
        //   label: "Single Page",
        //   checked: true,
        //   click() {
        //     Menu.getApplicationMenu().getMenuItemById(
        //       "single-page"
        //     ).checked = true;
        //     Menu.getApplicationMenu().getMenuItemById(
        //       "double-page"
        //     ).checked = false;
        //     mainProcess.renderMenuBar();

        //     mainProcess.setSinglePage();
        //   },
        // },
        // {
        //   id: "double-page",
        //   label: "Double Page",
        //   checked: false,
        //   click() {
        //     Menu.getApplicationMenu().getMenuItemById(
        //       "single-page"
        //     ).checked = false;
        //     Menu.getApplicationMenu().getMenuItemById(
        //       "double-page"
        //     ).checked = true;
        //     mainProcess.renderMenuBar();

        //     mainProcess.setDoublePage();
        //   },
        // },
        {
          type: "separator",
        },
        {
          label: "Toggle Full Screen",
          accelerator: "F11",
          click() {
            mainProcess.onMenuToggleFullScreen();
            //mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
      ],
    },
    {
      label: "Settings",
      submenu: [
        {
          label: "Toggle Scroll Bar",
          accelerator: "CommandOrControl+B",
          click() {
            mainProcess.onMenuToggleScrollBar();
          },
        },
        // {
        //   type: "separator",
        // },
        // {
        //   label: "Toggle Dev Tools",
        //   accelerator: "CommandOrControl+Shift+I",
        //   click() {
        //     mainProcess.onMenuToggleDevTools();
        //   },
        // },
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
