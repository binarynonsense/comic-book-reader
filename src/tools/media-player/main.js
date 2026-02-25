/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { FileExtension } = require("../../shared/main/constants");
const appUtils = require("../../shared/main/app-utils");
const core = require("../../core/main");
const reader = require("../../reader/main");
const settings = require("./main/settings");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const { getLocalization } = require("./main/localization");
const ffmpeg = require("./main/ffmpeg");

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
  ffmpeg.initOnIpcCallbacks(on, sendIpcToRenderer);

  on("update-config", (_settings, _playlist) => {
    settings.set(_settings);
    g_playlist = _playlist;
  });

  on("on-open-clicked", (mode) => {
    if (mode === 0) {
      sendIpcToRenderer(
        "show-modal-open",
        _("ui-modal-prompt-button-open"),
        _("ui-modal-prompt-button-cancel"),
        _("menu-tools-files"),
        "URL",
        0,
      );
    } else {
      sendIpcToRenderer(
        "show-modal-open",
        _("tool-shared-ui-add"),
        _("ui-modal-prompt-button-cancel"),
        _("menu-tools-files"),
        "URL",
        1,
      );
    }
  });

  on("on-open-url-clicked", (mode) => {
    sendIpcToRenderer(
      "show-modal-open-url",
      "", //_("tool-shared-tab-openurl"),
      "URL",
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel"),
      mode,
    );
  });

  on("on-modal-open-url-ok-clicked", (urlData) => {
    addUrl(urlData);
  });

  on("on-open-file-clicked", (mode) => {
    if (mode === 0) {
      callOpenFilesDialog(0);
    } else {
      callOpenFilesDialog(1);
    }
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
        "acbr-playlist.m3u",
      );
    }
    let allowedFileTypesName = _("dialog-file-types-playlists");
    let allowedFileTypesList = [FileExtension.M3U];
    let filePath = appUtils.chooseSaveAs(
      g_mainWindow,
      defaultPath,
      allowedFileTypesName,
      allowedFileTypesList,
    );
    if (!filePath || filePath === "") {
      return;
    }
    savePlaylistToFile(playlist, filePath, false);
  });

  on("fill-tags", async (files) => {
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
        sendIpcToRenderer("tags-filled", []);
      }
    }
    sendIpcToRenderer("tags-filled", updatedFiles);
  });

  on("on-play-error", (error) => {
    if (error == "NotSupportedError") {
      sendIpcToRenderer(
        "show-modal-info",
        _("ui-modal-title-audioplayererror"),
        `${_("ui-modal-info-mediaerror-play")}\n${_(
          "ui-modal-info-mediaerror-4",
        )}`,
        _("ui-modal-prompt-button-ok"),
      );
    }
  });
}

// HANDLE

let g_handleIpcCallbacks = {};

async function handleIpcFromRenderer(...args) {
  log.test("handleIpcFromRenderer");
  const callback = g_handleIpcCallbacks[args[0]];
  if (callback) return await callback(...args.slice(1));
  return;
}
exports.handleIpcFromRenderer = handleIpcFromRenderer;

function handle(id, callback) {
  g_handleIpcCallbacks[id] = callback;
}

function initHandleIpcCallbacks() {
  //////////////////////
  handle("mp-is-video-stream", async (filePath) => {
    try {
      const mm = require("music-metadata");
      const metadata = await mm.parseFile(filePath, { skipCovers: true });

      // 1. Explicit Video Flags (The "Gold Standard")
      const hasExplicitVideo =
        metadata.streams?.some((s) => s.codec_type === "video") ||
        JSON.stringify(metadata.native).toLowerCase().includes("video");

      // 2. Container + Multi-Track Check (The "Reliable Fallback")
      // If it's a container known for video (MKV/MP4/AVI/MOV) and has > 1 track, it's a video.
      const videoContainers = ["matroska", "isom", "mp42", "mov", "avi"];
      const container = metadata.format.tagTypes?.[0]?.toLowerCase() || "";
      const isVideoContainer = videoContainers.some((ext) =>
        container.includes(ext),
      );

      const trackCount =
        metadata.native?.matroska?.length ||
        metadata.native?.["ISO/IEC 14496-12"]?.length ||
        0;

      const finalDecision = !!(
        hasExplicitVideo ||
        (isVideoContainer && trackCount > 1)
      );

      log.test(
        `Tracks: ${trackCount} | Container: ${container} | Decision: ${finalDecision}`,
      );

      return finalDecision;
    } catch (error) {
      return false;
    }
  });

  // handle("mp-is-video-stream", async (filePath) => {
  //   log.test("--- MP IS VIDEO STREAM PROBE ---");
  //   try {
  //     const mm = require("music-metadata");
  //     // Using skipCovers: true makes it slightly faster
  //     const metadata = await mm.parseFile(filePath, { skipCovers: true });

  //     // 1. Check if ANY native track (Matroska, MP4, etc) contains "video"
  //     const hasVideoInNative = Object.values(metadata.native || {}).some(
  //       (tracks) =>
  //         tracks.some((track) => {
  //           // Stringify the whole track object and look for "video"
  //           const trackData = JSON.stringify(track).toLowerCase();
  //           return (
  //             trackData.includes("video") ||
  //             trackData.includes("v_hevc") ||
  //             trackData.includes("avc")
  //           );
  //         }),
  //     );

  //     // 2. Check for common video codec hints if strings fail
  //     const videoCodecs = ["hevc", "h265", "h264", "avc", "vp8", "vp9", "av1"];
  //     const hasVideoCodec =
  //       metadata.format.codec &&
  //       videoCodecs.some((c) =>
  //         metadata.format.codec.toLowerCase().includes(c),
  //       );

  //     // 3. The "Last Stand" check:
  //     // If it's a Matroska or MP4 and has more than 1 native track entry, it's almost certainly video+audio
  //     const nativeTrackCount = metadata.native?.matroska?.length || 0;
  //     const isMultiTrackContainer = nativeTrackCount > 1;

  //     const finalDecision = !!(
  //       hasVideoInNative ||
  //       hasVideoCodec ||
  //       isMultiTrackContainer
  //     );

  //     log.test(
  //       `Tracks Count: ${nativeTrackCount} | Found Video in Native: ${hasVideoInNative}`,
  //     );
  //     log.test(`Final Decision: ${finalDecision}`);

  //     return finalDecision;
  //   } catch (error) {
  //     console.error("Metadata probe failed:", error);
  //     return false;
  //   }
  // });

  //////////////////////
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_didShow = false;

exports.open = async function (isVisible) {
  if (isVisible & !g_didShow) {
    sendIpcToRenderer(
      "init",
      settings.get(),
      g_playlist,
      await ffmpeg.getValidFfmpegPath(), // TODO: get setting if available
    );
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
  let files = getPlaylistFiles(playlistPath);
  if (files && files.length > 0) {
    files.forEach((file) => {
      g_playlist.files.push(file);
    });
  }
}

/////////////////////////////////////////////////////////////////////////

exports.init = function (mainWindow, parentElementId) {
  initOnIpcCallbacks();
  initHandleIpcCallbacks();
  g_mainWindow = mainWindow;
  const data = fs.readFileSync(path.join(__dirname, "html/index.html"));
  g_parentElementId = parentElementId;
  sendIpcToCoreRenderer(
    "replace-inner-html",
    "#" + parentElementId,
    data.toString(),
  );
  loadSettings();
  updateLocalizedText();
};

function updateLocalizedText() {
  if (g_mainWindow) sendIpcToRenderer("update-localization", getLocalization());
}
exports.updateLocalizedText = updateLocalizedText;

///////////////////////////////////////////////////////////////////////////////
// ADD FILES //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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
  let files = getValidFiles(filePaths);
  if (files.length == 0) {
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
  sendIpcToRenderer("add-to-playlist", files, false);
}

function getValidFiles(filePaths) {
  function isAlreadyInArray(inputArray, content) {
    for (let index = 0; index < inputArray.length; index++) {
      const element = inputArray[index];
      if (content === element) {
        return true;
      }
    }
    return false;
  }
  let outputPaths = [];
  let files = [];
  filePaths.forEach((filePath) => {
    let ext = path.extname(filePath);
    if (ext !== "") ext = ext.substring(1);
    if (
      ext === FileExtension.MP3 ||
      ext === FileExtension.OGG ||
      ext === FileExtension.WAV ||
      ext === FileExtension.WEBM ||
      ext === FileExtension.AVI ||
      ext === FileExtension.MP4 ||
      ext === FileExtension.MKV ||
      ext === FileExtension.OGV
    ) {
      if (!isAlreadyInArray(outputPaths, filePath)) outputPaths.push(filePath);
      files.push({ url: filePath });
    } else if (ext === FileExtension.M3U || ext === FileExtension.M3U8) {
      const listFiles = getPlaylistFiles(filePath);
      listFiles.forEach((listFile) => {
        if (!isAlreadyInArray(outputPaths, listFile.url)) {
          outputPaths.push(listFile.url);
          files.push(listFile);
        }
      });
    }
  });
  return files;
}

function callOpenFilesDialog(mode) {
  let defaultPath;
  let allowMultipleSelection = true;
  let allowedFileTypesName = _("dialog-file-types-video-audio-playlists");
  let allowedFileTypesList = [
    FileExtension.MP3,
    FileExtension.OGG,
    FileExtension.WAV,
    FileExtension.M3U,
    FileExtension.M3U8,
    FileExtension.WEBM,
    FileExtension.AVI,
    FileExtension.MP4,
    FileExtension.MKV,
    FileExtension.OGV,
  ];
  let filePaths = appUtils.chooseFiles(
    g_mainWindow,
    defaultPath,
    allowedFileTypesName,
    allowedFileTypesList,
    allowMultipleSelection,
  );
  if (filePaths === undefined) {
    return;
  }
  let files = getValidFiles(filePaths);
  if (files.length == 0) {
    return;
  }
  if (mode === 1) {
    sendIpcToRenderer("add-to-playlist", files, false);
  } else if (mode === 0) {
    let playlist = {
      id: "",
      source: "filesystem",
      files: [],
    };
    files.forEach((element) => {
      playlist.files.push(element);
    });
    sendIpcToRenderer("open-playlist", playlist);
  }
}

function addUrl(urlData) {
  // test: https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // test: https://www.youtube.com/watch?v=zKhEkRhhnO0
  if (/^http:\/\/|https:\/\//.test(urlData.value)) {
    if (urlData.mode === 1) {
      let files = [];
      files.push({ url: urlData.value });
      sendIpcToRenderer("add-to-playlist", files, false);
    } else if (urlData.mode === 0) {
      let playlist = {
        id: "",
        source: "filesystem",
        files: [],
      };
      playlist.files.push({ url: urlData.value });
      sendIpcToRenderer("open-playlist", playlist);
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
// PLAYLIST ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getPlaylistFiles(filePath) {
  // TODO: this is a quick and dirty implementation, maybe do a more elegant/efficient one
  try {
    let fileContents = fs.readFileSync(filePath, "utf-8");
    // remove blank lines
    fileContents = fileContents.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
    let files = [];
    let lastLineWasExInf = false;
    let duration, artist, title;
    fileContents.split(/\r?\n/).forEach((line) => {
      line = line.trim();
      if (line.startsWith("#EXTINF:")) {
        duration = undefined;
        artist = "";
        title = "";
        line = line.replace("#EXTINF:", "");
        let parts = line.split(",");
        if (parts.length > 0) {
          duration = parts[0].trim();
        }
        if (parts.length > 1) {
          let artistAndTitle = parts[1].trim().split("-");
          if (artistAndTitle.length > 0) {
            if (artistAndTitle.length > 1) {
              artist = artistAndTitle[0].trim();
              title = artistAndTitle[1].trim();
            } else {
              artist = "";
              title = artistAndTitle[0].trim();
            }
          }
        }
        lastLineWasExInf = true;
      } else {
        if (lastLineWasExInf) {
          if (
            /.mp3|.ogg|.wav|.mkv|.mp4|.avi|.ogv|.webm|.wmv$/.test(line) ||
            /^http:\/\/|https:\/\//.test(line)
          ) {
            line = decodeURI(line);
            if (!/^http:\/\/|https:\/\//.test(line)) {
              if (!path.isAbsolute(line)) {
                line = path.join(path.dirname(filePath), line);
              }
              if (!fs.existsSync(line)) line = undefined;
            }
            if (line) {
              let file = {
                url: line,
                duration,
                title: decodeM3UName(title),
                artist: decodeM3UName(artist),
              };
              files.push(file);
            }
          }
        }
        lastLineWasExInf = false;
      }
    });
    return files;
  } catch (error) {
    log.error(error);
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
  try {
    let content = "#EXTM3U\n";
    playlist.files.forEach((file) => {
      let url = file.url;
      if (!saveAsAbsolutePaths && !/^http:\/\/|https:\/\//.test(url)) {
        // make paths relative to playlist file folder
        let saveDir = path.dirname(filePath);
        url = path.relative(saveDir, url);
      }
      let timeText =
        !file.duration || isNaN(file.duration) || !isFinite(file.duration)
          ? -1
          : parseInt(file.duration);
      let artistTitleText = "";
      if (file.title && file.artist) {
        artistTitleText =
          encodeM3UName(file.artist) + " - " + encodeM3UName(file.title);
      } else if (file.title) {
        artistTitleText = encodeM3UName(file.title);
      }
      content += `#EXTINF:${timeText},${artistTitleText}\n`;
      content += encodeURI(url) + "\n";
    });
    fs.writeFileSync(filePath, content, "utf8");
  } catch (error) {}
}

function encodeM3UName(text) {
  if (!text) return;
  text = text.replace("-", "%2D");
  text = text.replace(",", "%2C");
  return text;
}
function decodeM3UName(text) {
  if (!text) return;
  text = text.replace("%2D", "-");
  text = text.replace("%2C", ",");
  return text;
}
