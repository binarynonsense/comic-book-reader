const { app, ipcMain } = require("electron");
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

/////////////////////////////////////////////////////////////////////////

let g_settings = {
  version: app.getVersion(),
  date: "",
  volume: 0.8,
  shuffle: false,
  repeat: false,
  currentFileIndex: undefined,
  currentTime: 0,
  showPlaylist: true,
};

let g_playlist = {
  id: "",
  source: "", // filesystem, librivox...
  files: [],
};

exports.saveSettings = function () {
  fileUtils.saveSettings(g_settings, "acbr-player.cfg");
  let playlistPath = path.join(fileUtils.getConfigFolder(), "acbr-player.m3u");
  savePlaylistToFile(g_playlist, playlistPath, false);
  console.log("playlist saved to: " + playlistPath);
};

function loadSettings() {
  g_settings = fileUtils.loadSettings(g_settings, "acbr-player.cfg");
  sanitizeSettings();
  let playlistPath = path.join(fileUtils.getConfigFolder(), "acbr-player.m3u");
  let fileUrls = getPlaylistFiles(playlistPath);
  if (fileUrls && fileUrls.length > 0) {
    fileUrls.forEach((url) => {
      g_playlist.files.push({ url: url });
    });
  }
}

function sanitizeSettings() {
  if (isNaN(g_settings.volume)) {
    g_settings.volume = 0.8;
  }
  if (g_settings.volume < 0 || g_settings.volume > 1) {
    g_settings.volume = 0.8;
  }
  if (typeof g_settings.shuffle !== "boolean") {
    g_settings.shuffle = false;
  }
  if (typeof g_settings.repeat !== "boolean") {
    g_settings.repeat = false;
  }
  if (isNaN(g_settings.currentFileIndex)) {
    g_settings.currentFileIndex = undefined;
  }
  if (isNaN(g_settings.currentTime)) {
    g_settings.currentTime = 0;
  }
  if (typeof g_settings.showPlaylist !== "boolean") {
    g_settings.showPlaylist = true;
  }
}

/////////////////////////////////////////////////////////////////////////

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

  loadSettings();
  g_mainWindow.webContents.send(
    "audio-player",
    "init",
    g_settings,
    g_playlist,
    getLocalization()
  );
};

ipcMain.on("audio-player", (event, ...args) => {
  if (args[0] === "update-config") {
    g_settings = args[1];
    g_playlist = args[2];
  } else if (args[0] === "open-files") {
    openFiles(0);
  } else if (args[0] === "add-files") {
    openFiles(1);
  } else if (args[0] === "close") {
    mainProcess.showAudioPlayer(false, true);
  } else if (args[0] === "save-playlist") {
    let defaultPath = path.join(app.getPath("desktop"), "acbr-playlist.m3u");
    let playlist = args[1];
    if (!playlist?.files[0]?.url) return;
    if (!/^http:\/\/|https:\/\//.test(playlist.files[0].url)) {
      defaultPath = path.join(
        path.dirname(playlist.files[0].url),
        "acbr-playlist.m3u"
      );
    }
    let allowedFileTypesName = "Playlists";
    let allowedFileTypesList = [FileExtension.M3U];
    let filePath = fileUtils.chooseSaveAs(
      g_mainWindow,
      defaultPath,
      allowedFileTypesName,
      allowedFileTypesList
    );
    if (filePath === undefined) {
      return;
    }
    savePlaylistToFile(playlist, filePath, false);
  }
});

function openFiles(mode) {
  let defaultPath;
  let allowMultipleSelection = true;
  let allowedFileTypesName = "Audio Files / Playlists";
  let allowedFileTypesList = [
    FileExtension.MP3,
    FileExtension.OGG,
    FileExtension.WAV,
    FileExtension.M3U,
    FileExtension.M3U8,
  ];
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
  let filePaths = [];
  //////////////////////

  fileList.forEach((file) => {
    let ext = path.extname(file);
    if (ext !== "") ext = ext.substring(1);
    if (
      ext === FileExtension.MP3 ||
      ext === FileExtension.OGG ||
      ext === FileExtension.WAV
    ) {
      filePaths.push(file);
    } else if (ext === FileExtension.M3U || ext === FileExtension.M3U8) {
      filePaths = filePaths.concat(getPlaylistFiles(file));
    }
  });

  //////////////////////
  if (filePaths.length == 0) {
    return;
  }
  if (mode === 1) {
    g_mainWindow.webContents.send("audio-player", "add-to-playlist", filePaths);
  } else if (mode === 0) {
    let playlist = {
      id: "",
      source: "filesystem",
      files: [],
    };
    filePaths.forEach((element) => {
      playlist.files.push({ url: element });
    });
    g_mainWindow.webContents.send("audio-player", "open-playlist", playlist);
  }
}

function getPlaylistFiles(filePath) {
  // TODO: this is a quick and dirty implementation, maybe do a more elegant/efficient one
  // TODO: read duration, title, artist...
  try {
    const fileContents = fs.readFileSync(filePath, "utf-8");
    let files = [];
    fileContents.split(/\r?\n/).forEach((line) => {
      if (/.mp3|.ogg|.wav$/.test(line)) {
        line = decodeURI(line);
        if (!/^http:\/\/|https:\/\//.test(line) && !path.isAbsolute(line)) {
          line = path.join(path.dirname(filePath), line);
        }
        files.push(line);
      }
    });
    return files;
  } catch (error) {
    return [];
  }
}

function savePlaylistToFile(playlist, filePath, saveAsAbsolutePaths) {
  /*
    ref: https://en.wikipedia.org/wiki/M3u
    #EXTINF: 	track information: runtime in seconds and display title of the following resource 	
    #EXTINF:123,Artist Name – Track Title␤
    artist - title.mp3
    additional properties as key-value pairs
    #EXTINF:123 logo="cover.jpg",Track Title
  */
  let content = "#EXTM3U\n";
  playlist.files.forEach((file) => {
    let url = file.url;
    if (!saveAsAbsolutePaths && !/^http:\/\/|https:\/\//.test(url)) {
      // make paths relative to playlist file folder
      let fileDir = path.dirname(url);
      let saveDir = path.dirname(filePath);
      if (fileDir !== saveDir) {
        url = path.relative(saveDir, url);
      }
    }
    let timeText =
      !file.duration || isNaN(file.duration) ? -1 : parseInt(file.duration);
    let artistTitleText =
      file.title && file.artist ? file.artist + " - " + file.title : "";
    content += `#EXTINF:${timeText},${artistTitleText}\n`;
    content += encodeURI(url) + "\n";
  });
  fs.writeFileSync(filePath, content, "utf8");
}

exports.getSettings = function () {};

/////////////////////////////////////////////////////////////////////////////

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
      id: "ap-button-clear",
      text: _("ap-tooltip-button-clear"),
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
