const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { FileExtension } = require("../constants");
const fileUtils = require("../file-utils");
const mainProcess = require("../main");

let g_mainWindow;
let _;
let g_parentElementId;

exports.show = function (isVisible) {
  g_mainWindow.webContents.send(
    "audio-player",
    "show",
    isVisible,
    g_parentElementId
  );
};

exports.init = function (mainWindow, parentElementId, localizer) {
  _ = localizer;
  g_mainWindow = mainWindow;
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  g_parentElementId = parentElementId;
  g_mainWindow.webContents.send(
    "append-html",
    parentElementId,
    data.toString()
  );

  g_mainWindow.webContents.send("audio-player", "init", getLocalization());
};

ipcMain.on("audio-player", (event, ...args) => {
  if (args[0] === "open-files") {
    let defaultPath;
    let allowMultipleSelection = true;
    let allowedFileTypesName = "Audio Files";
    let allowedFileTypesList = [FileExtension.MP3];
    let fileList = fileUtils.chooseOpenFiles(
      g_mainWindow,
      defaultPath,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection
    );
    if (fileList === undefined) {
      return;
    }
    let playlist = {
      id: "",
      source: "filesystem",
      files: [],
    };
    fileList.forEach((element) => {
      playlist.files.push({ url: element });
    });
    g_mainWindow.webContents.send("audio-player", "open-playlist", playlist);
  } else if (args[0] === "add-files") {
    let defaultPath;
    let allowMultipleSelection = true;
    let allowedFileTypesName = "Audio Files";
    let allowedFileTypesList = [FileExtension.MP3];
    let fileList = fileUtils.chooseOpenFiles(
      g_mainWindow,
      defaultPath,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection
    );
    if (fileList === undefined) {
      return;
    }
    g_mainWindow.webContents.send("audio-player", "add-to-playlist", fileList);
  } else if (args[0] === "close") {
    mainProcess.showAudioPlayer(false, true);
  }
});

function getLocalization() {
  return [
    {
      id: "ap-button-play",
      text: _("ap-tooltip-button-play"),
    },
    {
      id: "ap-button-pause",
      text: _("ap-tooltip-button-pause"),
    },
    {
      id: "ap-button-next",
      text: _("ap-tooltip-button-next"),
    },
    {
      id: "ap-button-prev",
      text: _("ap-tooltip-button-prev"),
    },
    {
      id: "ap-button-open",
      text: _("ap-tooltip-button-open"),
    },
    {
      id: "ap-button-volume-off",
      text: _("ap-tooltip-button-volume-off"),
    },
    {
      id: "ap-button-volume-on",
      text: _("ap-tooltip-button-volume-on"),
    },
    {
      id: "ap-button-playlist",
      text: _("ap-tooltip-button-playlist"),
    },
    {
      id: "ap-button-close",
      text: _("ap-tooltip-button-close"),
    },
    {
      id: "ap-button-shuffle-off",
      text: _("ap-tooltip-button-shuffle-off"),
    },
    {
      id: "ap-button-shuffle-on",
      text: _("ap-tooltip-button-shuffle-on"),
    },
    {
      id: "ap-button-repeat-off",
      text: _("ap-tooltip-button-repeat-off"),
    },
    {
      id: "ap-button-repeat-on",
      text: _("ap-tooltip-button-repeat-on"),
    },

    {
      id: "ap-button-add",
      text: _("ap-tooltip-button-add"),
    },
    {
      id: "ap-button-delete",
      text: _("ap-tooltip-button-delete"),
    },
    {
      id: "ap-button-save",
      text: _("ap-tooltip-button-save"),
    },
  ];
}
