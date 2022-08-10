const { app, Menu, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const mainProcess = require("../../main");
const fileUtils = require("../../file-utils");
const { FileExtension } = require("../../constants");
const QRCode = require("qrcode");

let g_window;
let g_ipcChannel = "tool-cq--";

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

const selectionMenu = Menu.buildFromTemplate([
  { role: "paste" },
  { type: "separator" },
  { role: "selectall" },
]);

exports.showWindow = function (parentWindow) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
  let [width, height] = parentWindow.getSize();
  height = (90 * height) / 100;
  if (height < 700) height = 700;
  width = 1024;

  g_window = new BrowserWindow({
    width: parseInt(width),
    height: parseInt(height),
    icon: path.join(__dirname, "../../assets/images/icon_256x256.png"),
    resizable: true,
    backgroundColor: "white",
    parent: parentWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  g_window.menuBarVisible = false;
  g_window.loadFile(`${__dirname}/index.html`);

  // if (isDev()) g_window.toggleDevTools();

  g_window.on("closed", () => {
    g_window = undefined;
    fileUtils.cleanUpTempFolder();
  });

  g_window.webContents.on("did-finish-load", function () {
    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("tool-cq-title"),
      getLocalization()
    );
  });

  // ref: https://github.com/electron/electron/issues/4068#issuecomment-274159726
  g_window.webContents.on("context-menu", (event, props) => {
    const { selectionText, isEditable } = props;
    if (isEditable || (selectionText && selectionText.trim() !== "")) {
      selectionMenu.popup(g_window);
    }
  });
};

////////////////////////////////////////////////////////////////////////

let g_imgBase64;

ipcMain.on(g_ipcChannel + "start", (event, text) => {
  try {
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-creating").toUpperCase()
    );

    QRCode.toDataURL(text, {
      type: "image/jpeg",
    })
      .then((base64Img) => {
        if (base64Img) {
          g_imgBase64 = base64Img;
          g_window.webContents.send(g_ipcChannel + "update-image", g_imgBase64);
          g_window.webContents.send(g_ipcChannel + "modal-close");
        } else {
          throw {
            name: "GenericError",
            message: "the generated image is empty",
          };
        }
      })
      .catch((error) => {
        if (error?.message.includes("big to be stored")) {
          error = {
            name: "GenericError",
            message: _("tool-cq-modal-alert-msg-toomuchdata"),
          };
        }
        if (error?.name !== "GenericError") {
          console.log(error);
        }
        g_window.webContents.send(g_ipcChannel + "modal-close");
        g_window.webContents.send(
          g_ipcChannel + "show-modal-alert",
          _("tool-cq-modal-alert-title-errorcreating"),
          error.message,
          true
        );
      });
  } catch (error) {
    console.log(error);
    g_window.webContents.send(g_ipcChannel + "modal-close");
    g_window.webContents.send(
      g_ipcChannel + "show-modal-alert",
      _("tool-cq-modal-alert-title-errorcreating"),
      error.message,
      true
    );
  }
});

ipcMain.on(g_ipcChannel + "export-to-file", (event) => {
  let outputFilePath;
  try {
    let defaultPath = app.getPath("desktop");
    let folderList = fileUtils.chooseFolder(g_window, defaultPath);
    if (folderList === undefined) {
      return;
    }
    let outputFolderPath = folderList[0];
    if (outputFolderPath === undefined || outputFolderPath === "") return;

    let fileName = "acbr_qr_code";
    let fileExtension = `.${FileExtension.JPG}`;
    outputFilePath = path.join(outputFolderPath, fileName + fileExtension);
    let i = 1;
    while (fs.existsSync(outputFilePath)) {
      i++;
      outputFilePath = path.join(
        outputFolderPath,
        fileName + "(" + i + ")" + fileExtension
      );
    }
    if (!g_imgBase64) {
      throw { name: "GenericError", message: "base64 data is null" };
    }
    let data = g_imgBase64.replace(/^data:image\/\w+;base64,/, "");
    let buf = Buffer.from(data, "base64");
    fs.writeFileSync(outputFilePath, buf, "binary");
    g_window.webContents.send(
      g_ipcChannel + "show-modal-alert",
      _("tool-cq-modal-alert-title-successexporting"),
      outputFilePath,
      false
    );
  } catch (error) {
    console.log(error);
    g_window.webContents.send(
      g_ipcChannel + "show-modal-alert",
      _("tool-cq-modal-alert-title-errorexporting"),
      error.message,
      true
    );
  }
});

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "header-input-text",
      text: _("tool-cq-header-input-text"),
    },
    {
      id: "header-output-text",
      text: _("tool-cq-header-output-text"),
    },
    {
      id: "button-clear",
      text: _("tool-cq-button-clear").toUpperCase(),
    },
    {
      id: "button-export",
      text: _("tool-cq-button-export").toUpperCase(),
    },
    {
      id: "button-start",
      text: _("tool-cq-button-start").toUpperCase(),
    },
    {
      id: "button-modal-close",
      text: _("tool-shared-ui-close").toUpperCase(),
    },
  ];
}
