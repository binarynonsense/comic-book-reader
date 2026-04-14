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
const history = require("./main/history");
const { _ } = require("../../shared/main/i18n");
const log = require("../../shared/main/logger");
const { getLocalization } = require("./main/localization");
const ffmpeg = require("./main/ffmpeg");
const subtitles = require("./main/subtitles");
const contextMenu = require("./main/menu-context");
const tools = require("../../shared/main/tools");

let g_mainWindow;
let g_parentElementId;
let g_ffmpegPath;
let g_launchInfo = {};
let g_radioFavorites = [];
let g_contextMenuData;

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("media-player", ...args);
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

  on("log-test", (value) => {
    log.test(value);
  });

  on("toggle-dev-tools", () => {
    if (core.isDev()) g_mainWindow.toggleDevTools();
  });

  on("save-on-quit", (_settings, _playlist, _historyData) => {
    try {
      settings.set(_settings);
      if (g_launchInfo.isPlayerMode) {
        if (!settings.getValue("fullView")) {
          g_lastPosition = g_mainWindow.getPosition();
        }
        if (g_lastPosition) {
          settings.setValue("lastStandAlonePosition", g_lastPosition);
        }
      }
      g_playlist = _playlist;
      if (_historyData) {
        history.addEntryToRecent(
          _historyData.url,
          _historyData.currentTime,
          _historyData.totalTime,
        );
      }
      //
      history.save();
      settings.save();
      let playlistPath = path.join(
        appUtils.getConfigFolder(),
        "acbr-player.m3u",
      );
      savePlaylistToFile(g_playlist, playlistPath, false);
      log.info("playlist saved to: " + playlistPath);
    } catch (error) {
    } finally {
      core.startToolsQuit();
    }
  });

  on("add-to-history", (file, currentTime, totalTime) => {
    if (file && file.url) {
      history.addEntryToRecent(file.url, currentTime, totalTime);
    }
  });

  on("update-context-menu-data", (data) => {
    g_contextMenuData = data;
    if (g_tray) {
      updateTrayMenu();
    }
  });

  on("set-tray-icon", (trayIcon) => {
    if (g_launchInfo.isPlayerMode) {
      setTrayIcon(trayIcon);
    } else {
      log.warning("trying to set tray icon in non player mode");
    }
  });

  on("load-subtitle-if-same-name", async (...args) => {
    autoLoadVideoSubtitles(...args);
  });

  on("on-open-clicked", (mode, trackNum) => {
    if (mode === 0) {
      sendIpcToRenderer(
        "show-modal-open",
        _("ui-modal-prompt-button-open-in-mediaplayer"),
        trackNum
          ? _("tool-shared-modal-title-note") +
              ": " +
              _("mp-modal-info-open-will-start-new-playlist")
          : "",
        _("ui-modal-prompt-button-cancel"),
        _("menu-tools-files"),
        "URL",
        0,
      );
    } else {
      sendIpcToRenderer(
        "show-modal-open",
        _("ui-modal-prompt-button-add-to-playlist"),
        "",
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

  on("on-drop", (...args) => {
    onDroppedFiles(...args);
  });

  on("close", () => {
    if (g_launchInfo.isPlayerMode) {
      core.requestQuit();
    } else {
      reader.showMediaPlayer(false, true);
    }
  });

  on("hide", () => {
    showWindow(false);
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
        if (file.title && file.artist && file.duration !== undefined) continue;
        // if (!/^http:\/\/|https:\/\//.test(file.url)) {
        const lowercaseUrl = file.url.toLowerCase();
        if (
          !lowercaseUrl.startsWith("http") &&
          (lowercaseUrl.endsWith(".mp3") ||
            lowercaseUrl.endsWith(".ogg") ||
            lowercaseUrl.endsWith(".flac"))
        ) {
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
          if (file.duration === undefined && metadata?.format?.duration) {
            file.duration = metadata.format.duration;
            didUpdate = true;
          }
          if (didUpdate) {
            updatedFiles.push(file);
          }
        }
      } catch (error) {
        log.debug(
          `[Media Player] couldn't fill tags for ${file.url}: ${error}`,
        );
        sendIpcToRenderer("tags-filled", []);
      }
    }
    sendIpcToRenderer("tags-filled", updatedFiles);
  });

  on("on-play-error", (error) => {
    if (error == "NotSupportedError") {
      sendIpcToRenderer(
        "show-modal-info",
        _("ui-modal-title-mediaplayererror"),
        `${_("ui-modal-info-mediaerror-play")}\n${_(
          "ui-modal-info-mediaerror-4",
        )}`,
        _("ui-modal-prompt-button-ok"),
      );
    }
  });

  on("show-context-menu", (params, data) => {
    data.isPlayerMode = g_launchInfo.isPlayerMode;
    data.radioFavorites = g_radioFavorites;
    contextMenu.show(
      "normal",
      params,
      data,
      sendIpcToRenderer,
      openFromContextMenu,
    );
  });

  on("show-button-menu", (type, rect, data) => {
    data.isPlayerMode = g_launchInfo.isPlayerMode;
    data.radioFavorites = g_radioFavorites;
    contextMenu.show(
      type,
      { x: rect.top, y: rect.left },
      data,
      sendIpcToRenderer,
      openFromContextMenu,
    );
  });

  on("on-add-subtitle-file-clicked", (...args) => {
    callAddSubtitleFromFileDialog(...args);
  });

  on("save-screenshot", (buffer) => {
    try {
      function getScreenshotName() {
        const now = new Date();
        const pad = (num, size = 2) => String(num).padStart(size, "0");
        const date =
          now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
        const time =
          pad(now.getHours()) +
          pad(now.getMinutes()) +
          pad(now.getSeconds()) +
          pad(now.getMilliseconds(), 3);
        return `Screenshot_${date}_${time}.jpg`;
      }
      const outputFolderPath = appUtils.getScreenshotsFolderPath();
      if (!fs.existsSync(outputFolderPath)) {
        log.editor("creating screenshots folder: " + outputFolderPath);
        fs.mkdirSync(outputFolderPath, { recursive: true });
      }
      const outputFilePath = path.join(outputFolderPath, getScreenshotName());
      try {
        fs.writeFileSync(outputFilePath, buffer, { flag: "wx" });
      } catch (error) {
        // error.code === "EEXIST"
        throw error;
      }
      log.debug(_("ui-modal-info-imagesaved") + ": " + outputFilePath);
      core.sendIpcToCoreRenderer(
        "show-toast-open-path-in-browser",
        _("ui-modal-info-imagesaved"),
        4000,
        outputFilePath,
        true,
      );
    } catch (error) {
      log.editorError(error);
    }
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
  handle("mp-get-file-metadata-complete", async (filePath) => {
    try {
      const metadata = await ffmpeg.getMetadataComplete(undefined, filePath);
      // const capabilities = await ffmpeg.getFfmpegCapabilities();
      return metadata;
    } catch (error) {
      log.editor(error);
      return undefined;
    }
  });

  handle("mp-get-embedded-subtitle", async (filePath, index) => {
    try {
      const srtText = await ffmpeg.extractSubtitleText(
        undefined,
        filePath,
        index,
      );

      if (srtText) {
        const subtitleData = subtitles.parseSRT(srtText);
        if (subtitleData.length > 0) {
          return subtitleData;
        }
      } else {
        log.editor("extractSubtitleText: srtText is null or empty");
      }
      return undefined;
    } catch (error) {
      log.editor(error);
      return undefined;
    }
  });

  // old code
  // handle("mp-get-file-metadata", async (filePath) => {
  //   try {
  //     const mm = require("music-metadata");
  //     const metadata = await mm.parseFile(filePath, { skipCovers: true });
  //     return metadata;
  //   } catch (error) {
  //     return undefined;
  //   }
  // });
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_didShow = false;
let g_lastBounds = null;
let g_tray;
let g_lastPosition;

exports.open = async function (isVisible) {
  if (isVisible & !g_didShow) {
    sendIpcToRenderer(
      "init",
      settings.get(),
      g_playlist,
      g_launchInfo.isPlayerMode,
    );
    g_didShow = true;
    if (g_launchInfo.isPlayerMode) {
      const lastPos = settings.getValue("lastStandAlonePosition");
      if (lastPos) {
        setTimeout(() => g_mainWindow.setPosition(...lastPos), 300);
      } else {
        setTimeout(() => g_mainWindow.center(), 300);
      }
    }
  }
  sendIpcToRenderer("show", isVisible, g_parentElementId);
};

exports.updateLastPosition = function () {
  g_lastPosition = g_mainWindow.getPosition();
};

exports.createTray = function () {
  if (settings.getValue("trayIcon") === 0) return;
  createTrayIcon();
};

function createTrayIcon() {
  // ref: https://www.electronjs.org/docs/latest/api/tray
  const { Tray } = require("electron");

  g_tray = new Tray(getTrayIconPath());
  // nativeTheme.on("updated", () => {
  //   g_tray.setImage(getTrayIconPath());
  // });
  g_tray.setToolTip("ACBR Player");
  updateTrayMenu();
  //tray.setIgnoreDoubleClickEvents(true)
  g_tray.on("click", function (event) {
    toggleWindow();
  });
  g_tray.on("right-click", function (event) {});
}

function destroyTrayIcon() {
  // NOTE: doesn't work on Kubuntu 24.04
  if (g_tray) {
    g_tray.setContextMenu(null);
    g_tray.destroy();
    g_tray = undefined;
  }
}

function updateTrayMenu() {
  let data;
  if (g_contextMenuData) {
    data = g_contextMenuData;
    data.isPlayerMode = g_launchInfo.isPlayerMode;
    data.radioFavorites = g_radioFavorites;
  }
  g_tray.setContextMenu(
    contextMenu.getTrayContextMenu(
      [
        {
          label: _("menu-view-layout-showhide"),
          click() {
            toggleWindow();
          },
        },
        {
          label: _("menu-file-quit"),
          click() {
            core.requestQuit();
          },
        },
      ],
      data,
      sendIpcToRenderer,
    ),
  );
}

function getTrayIconPath(useTheme = false) {
  let trayIcon = settings.getValue("trayIcon");
  const isWindows = process.platform === "win32";
  const ext = isWindows ? ".ico" : ".png";
  // if (useTheme) {
  //   const mode = nativeTheme.shouldUseDarkColors ? "dark" : "light";
  //   return path.join(
  //     __dirname,
  //     "../../assets/images",
  //     `tray_${mode}_mode${ext}`,
  //   );
  // } else {
  //   return path.join(__dirname, "../../assets/images", `tray_color${ext}`);
  // }
  if (trayIcon === 3) {
    return path.join(__dirname, "../../assets/images", `tray_light_mode${ext}`);
  } else if (trayIcon === 2) {
    return path.join(__dirname, "../../assets/images", `tray_dark_mode${ext}`);
  } else {
    return path.join(__dirname, "../../assets/images", `tray_color${ext}`);
  }
}

function setTrayIcon(trayIcon) {
  settings.setValue("trayIcon", trayIcon);
  if (trayIcon === 0) {
    if (process.platform === "win32") {
      destroyTrayIcon();
    }
  } else if (g_tray) {
    g_tray.setImage(getTrayIconPath());
    updateTrayMenu();
  } else {
    createTrayIcon();
  }
}

function toggleWindow() {
  if (g_mainWindow.isVisible()) {
    showWindow(false);
  } else {
    showWindow(true);
  }
}
function showWindow(show) {
  if (show) {
    g_mainWindow.show();
    if (g_lastBounds) {
      g_mainWindow.setBounds(g_lastBounds);
    }
  } else {
    g_lastBounds = g_mainWindow.getBounds();
    g_mainWindow.hide();
  }
}

let g_playlist = {
  id: "",
  source: "", // filesystem, librivox...
  files: [],
};

function loadSettings() {
  settings.init();
  let playlistPath = path.join(appUtils.getConfigFolder(), "acbr-player.m3u");
  if (fs.existsSync(playlistPath)) {
    let files = getPlaylistFiles(playlistPath);
    if (files && files.length > 0) {
      files.forEach((file) => {
        g_playlist.files.push(file);
      });
    }
  }
}

/////////////////////////////////////////////////////////////////////////

exports.init = function (launchInfo, mainWindow, parentElementId, ffmpegPath) {
  g_launchInfo = launchInfo;
  exports.updateFfmpegPath(ffmpegPath);
  g_radioFavorites = tools.getTools()["tool-radio"].getFavorites();
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
  if (g_launchInfo.isPlayerMode)
    g_lastPosition = settings.getValue("lastStandAlonePosition");
  history.init();
  updateLocalizedText();
};

exports.saveAndQuit = function () {
  if (g_didShow) {
    sendIpcToRenderer("save-and-quit-request");
  } else {
    core.startToolsQuit();
  }
};

exports.updateFfmpegPath = function (ffmpegPath) {
  g_ffmpegPath = ffmpegPath;
  ffmpeg.updateFfmpegPath(ffmpegPath);
  sendIpcToRenderer("update-ffmpeg-available", ffmpegPath ? true : false);
};

function updateLocalizedText() {
  if (g_mainWindow) sendIpcToRenderer("update-localization", getLocalization());
}
exports.updateLocalizedText = updateLocalizedText;

///////////////////////////////////////////////////////////////////////////////
// ADD FILES //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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

function openNewPlaylistFromFiles(files) {
  let playlist = {
    id: "",
    source: "filesystem",
    files: [],
  };
  files.forEach((element) => {
    playlist.files.push(element);
  });
  //
  let recent = history.getRecent();
  let currentTime = 0;
  for (let index = 0; index < recent.length; index++) {
    if (recent[index].filePath === files[0].url) {
      currentTime = recent[index].currentTime;
      break;
    }
  }
  //
  sendIpcToRenderer("open-playlist", playlist, currentTime);
}

function onDroppedFiles(inputPaths, targetId) {
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
  if (targetId && targetId.startsWith("mp-div-playlist")) {
    sendIpcToRenderer("add-to-playlist", files, false);
  } else {
    openNewPlaylistFromFiles(files);
  }
}
exports.onDroppedFiles = onDroppedFiles;

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
    openNewPlaylistFromFiles(files);
  }
}

function openFromContextMenu({ url, title, source, currentTime }) {
  let playlist = {
    id: "",
    source,
    files: [],
  };
  playlist.files.push({ title, url });
  sendIpcToRenderer("open-playlist", playlist, currentTime);
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
// SUBTITLES //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function callAddSubtitleFromFileDialog(filePath) {
  try {
    let allowMultipleSelection = false;
    let allowedFileTypesName = _("mp-menu-subtitle") + " (.srt)";
    let allowedFileTypesList = ["srt"];
    let filePaths = appUtils.chooseFiles(
      g_mainWindow,
      path.dirname(filePath),
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection,
    );
    if (filePaths === undefined || filePaths.length <= 0) {
      return;
    }
    const data = await subtitles.loadExternalSRT(filePaths[0]);
    if (!data || data.length <= 0) return;
    const title = path.basename(filePaths[0]);
    sendIpcToRenderer("add-subtitle-from-file", title, data);
  } catch (error) {}
}

function getMatchingSrtFilesInSameFolder(videoPath) {
  if (!videoPath) return [];
  try {
    const dir = path.dirname(videoPath);
    const ext = path.extname(videoPath);
    const name = path.basename(videoPath, ext);
    const exactMatch = `${name}.srt`;
    const files = fs.readdirSync(dir);
    const srtFilePaths = files
      .filter((file) => {
        const fileLower = file.toLowerCase();
        return (
          fileLower.startsWith(name.toLowerCase()) && fileLower.endsWith(".srt")
        );
      })
      .sort((a, b) => {
        // exact name match gets priority
        if (a.toLowerCase() === exactMatch.toLowerCase()) return -1;
        if (b.toLowerCase() === exactMatch.toLowerCase()) return 1;
        return a.localeCompare(b);
      })
      .map((file) => path.join(dir, file));
    return srtFilePaths;
  } catch (error) {
    return [];
  }
}

function getMatchingSrtFiles(videoPath) {
  if (!videoPath) return [];
  try {
    const dir = path.dirname(videoPath);
    const ext = path.extname(videoPath);
    const name = path.basename(videoPath, ext);
    const exactMatch = `${name}.srt`;
    const subDirs = ["", "subs", "subtitles"];
    if (process.platform === "linux") {
      subDirs.push("Subs", "Subtitles");
    }
    let allSrtPaths = [];
    subDirs.forEach((sub) => {
      const targetDir = path.join(dir, sub);
      if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
        const files = fs.readdirSync(targetDir);
        const matches = files
          .filter((file) => {
            const fileLower = file.toLowerCase();
            return (
              fileLower.startsWith(name.toLowerCase()) &&
              fileLower.endsWith(".srt")
            );
          })
          .map((file) => path.join(targetDir, file));
        allSrtPaths = allSrtPaths.concat(matches);
      }
    });
    // use set so there're no repeats, just in case
    return [...new Set(allSrtPaths)].sort((a, b) => {
      const baseA = path.basename(a).toLowerCase();
      const baseB = path.basename(b).toLowerCase();
      const targetLower = exactMatch.toLowerCase();
      // exact name match gets priority
      if (baseA === targetLower) return -1;
      if (baseB === targetLower) return 1;
      return baseA.localeCompare(baseB);
    });
  } catch (error) {
    return [];
  }
}

async function autoLoadVideoSubtitles(videoPath) {
  try {
    if (!videoPath) return;
    const subs = getMatchingSrtFiles(videoPath);
    if (!subs || subs.length <= 0) return;
    for (const [index, srtPath] of subs.entries()) {
      const data = await subtitles.loadExternalSRT(srtPath);
      if (!data || data.length <= 0) continue;
      const title = path.basename(srtPath);
      log.editor("auto loading subtitle: " + srtPath);
      sendIpcToRenderer("add-subtitle-from-file", title, data, index === 0);
    }
  } catch (error) {}
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
