/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { FileExtension } = require("../shared/main/constants");
const appUtils = require("../shared/main/app-utils");
const core = require("../core/main");
const reader = require("../reader/main");
const settings = require("./settings");
const { _ } = require("../shared/main/i18n");
const log = require("../shared/main/logger");

let g_mainWindow;
let g_parentElementId;

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("audio-player", ...args);
}

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};

exports.onIpcFromRenderer = function (...args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
};

function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("update-config", (_settings, _playlist) => {
    settings.set(_settings);
    g_playlist = _playlist;
  });

  on("open-files", () => {
    callOpenFilesDialog(0);
  });

  on("add-files", () => {
    callOpenFilesDialog(1);
  });

  on("on-drop", (inputPaths) => {
    onDroppedFiles(inputPaths);
  });

  on("close", () => {
    reader.showAudioPlayer(false, true);
  });

  on("save-playlist", (playlist) => {
    let defaultPath = path.join(app.getPath("desktop"), "acbr-playlist.m3u");
    if (!playlist?.files[0]?.url) return;
    if (!/^http:\/\/|https:\/\//.test(playlist.files[0].url)) {
      defaultPath = path.join(
        path.dirname(playlist.files[0].url),
        "acbr-playlist.m3u"
      );
    }
    let allowedFileTypesName = "Playlists";
    let allowedFileTypesList = [FileExtension.M3U];
    let filePath = appUtils.chooseSaveAs(
      g_mainWindow,
      defaultPath,
      allowedFileTypesName,
      allowedFileTypesList
    );
    if (filePath === undefined) {
      return;
    }
    savePlaylistToFile(playlist, filePath, false);
  });
}

// HANDLE

let g_handleIpcCallbacks = {};

async function handleIpcFromRenderer(...args) {
  const callback = g_handleIpcCallbacks[args[0]];
  if (callback) return await callback(...args.slice(1));
  return;
}
exports.handleIpcFromRenderer = handleIpcFromRenderer;

function handle(id, callback) {
  g_handleIpcCallbacks[id] = callback;
}

function initHandleIpcCallbacks() {
  handle("test", async (value) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return value;
  });

  handle("fill-tags", async (files) => {
    const musicmetadata = require("music-metadata");
    let updatedFiles = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        if (file.title && file.artist) continue;
        if (!/^http:\/\/|https:\/\//.test(file.url)) {
          const metadata = await musicmetadata.parseFile(file.url);
          let didUpdate = false;
          if (metadata?.common?.artist) {
            file.artist = metadata.common.artist;
            didUpdate = true;
          }
          if (metadata?.common?.title) {
            file.title = metadata.common.title;
            didUpdate = true;
          }
          if (didUpdate) updatedFiles.push(file);
        }
      } catch (error) {
        log.error(error);
        return [];
      }
    }
    return updatedFiles;
  });
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_didShow = false;

exports.open = function (isVisible) {
  if (isVisible & !g_didShow) {
    sendIpcToRenderer("init", settings.get(), g_playlist);
    g_didShow = true;
  }
  sendIpcToRenderer("show", isVisible, g_parentElementId);
};

let g_playlist = {
  id: "",
  source: "", // filesystem, librivox...
  files: [],
};

exports.saveSettings = function () {
  settings.save();
  let playlistPath = path.join(appUtils.getConfigFolder(), "acbr-player.m3u");
  savePlaylistToFile(g_playlist, playlistPath, false);
  log.info("playlist saved to: " + playlistPath);
};

function loadSettings() {
  settings.init();
  let playlistPath = path.join(appUtils.getConfigFolder(), "acbr-player.m3u");
  let fileUrls = getPlaylistFiles(playlistPath);
  if (fileUrls && fileUrls.length > 0) {
    fileUrls.forEach((url) => {
      g_playlist.files.push({ url: url });
    });
  }
}

/////////////////////////////////////////////////////////////////////////

exports.init = function (mainWindow, parentElementId) {
  initOnIpcCallbacks();
  initHandleIpcCallbacks();
  g_mainWindow = mainWindow;
  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  g_parentElementId = parentElementId;
  sendIpcToCoreRenderer(
    "replace-inner-html",
    "#" + parentElementId,
    data.toString()
  );
  loadSettings();
  updateLocalizedText();
};

function updateLocalizedText() {
  if (g_mainWindow) sendIpcToRenderer("update-localization", getLocalization());
}
exports.updateLocalizedText = updateLocalizedText;

function onDroppedFiles(inputPaths) {
  let filePaths = [];
  for (let index = 0; index < inputPaths.length; index++) {
    const inputPath = inputPaths[index];
    if (!fs.existsSync(inputPath)) return;
    if (fs.lstatSync(inputPath).isDirectory()) {
      let inDirPaths = fs.readdirSync(inputPath);
      inDirPaths.forEach((inDirPath) => {
        filePaths.push(path.join(inputPath, inDirPath));
      });
    } else {
      filePaths.push(inputPath);
    }
  }
  let outputPaths = getValidFilePaths(filePaths);
  if (outputPaths.length == 0) {
    return;
  }
  // let playlist = {
  //   id: "",
  //   source: "filesystem",
  //   files: [],
  // };
  // outputPaths.forEach((element) => {
  //   playlist.files.push({ url: element });
  // });
  // sendIpcToRenderer("open-playlist", playlist);
  sendIpcToRenderer("add-to-playlist", outputPaths);
}

function isAlreadyInArray(inputArray, content) {
  for (let index = 0; index < inputArray.length; index++) {
    const element = inputArray[index];
    if (content === element) {
      return true;
    }
  }
  return false;
}

function getValidFilePaths(filePaths) {
  let outputPaths = [];
  filePaths.forEach((filePath) => {
    let ext = path.extname(filePath);
    if (ext !== "") ext = ext.substring(1);
    if (
      ext === FileExtension.MP3 ||
      ext === FileExtension.OGG ||
      ext === FileExtension.WAV
    ) {
      if (!isAlreadyInArray(outputPaths, filePath)) outputPaths.push(filePath);
    } else if (ext === FileExtension.M3U || ext === FileExtension.M3U8) {
      const listPaths = getPlaylistFiles(filePath);
      listPaths.forEach((listPath) => {
        if (!isAlreadyInArray(outputPaths, listPath))
          outputPaths.push(listPath);
      });
    }
  });
  return outputPaths;
}

function callOpenFilesDialog(mode) {
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
  let filePaths = appUtils.chooseOpenFiles(
    g_mainWindow,
    defaultPath,
    allowedFileTypesName,
    allowedFileTypesList,
    allowMultipleSelection
  );
  if (filePaths === undefined) {
    return;
  }
  let outputPaths = getValidFilePaths(filePaths);
  if (outputPaths.length == 0) {
    return;
  }
  if (mode === 1) {
    sendIpcToRenderer("add-to-playlist", outputPaths);
  } else if (mode === 0) {
    let playlist = {
      id: "",
      source: "filesystem",
      files: [],
    };
    outputPaths.forEach((element) => {
      playlist.files.push({ url: element });
    });
    sendIpcToRenderer("open-playlist", playlist);
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
        if (!/^http:\/\/|https:\/\//.test(line)) {
          if (!path.isAbsolute(line)) {
            line = path.join(path.dirname(filePath), line);
          }
          if (!fs.existsSync(line)) line = undefined;
        }
        if (line) files.push(line);
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
      let saveDir = path.dirname(filePath);
      url = path.relative(saveDir, url);
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
