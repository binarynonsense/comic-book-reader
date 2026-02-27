/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import * as playlist from "./renderer/playlist.js";
import * as yt from "./renderer/youtube.js";
import * as ffmpeg from "./renderer/ffmpeg.js";

let g_settings;
let g_player = {};
let g_ffmpegAvailable = false;

let g_loadedTrackIndex = -1;
let g_currentLoadId = 0;

const PlayerState = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED: "paused",
};

export function initIpc() {
  initOnIpcCallbacks();
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToMain(...args) {
  coreSendIpcToMain("media-player", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("media-player", ...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};

export function onIpcFromMain(args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
}

export function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  ffmpeg.initOnIpcCallbacks(on);

  on("init", (settings, loadedPlaylist, ffmpegAvailable) => {
    initPlayer(settings, loadedPlaylist, ffmpegAvailable);
    // load css
    var head = document.getElementsByTagName("head")[0];
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = "../tools/media-player/html/style.css";
    head.appendChild(link);
  });

  on("show", (isVisible, elementId) => {
    if (isVisible) {
      document.getElementById(elementId).classList.remove("mp-hidden");
    } else {
      document.getElementById(elementId).classList.add("mp-hidden");
    }
  });

  on("open-playlist", (playlist) => {
    playlist.openPlaylist(playlist);
    playTrack(playlist.getCurrentTrackIndex(), 0);
  });

  on("add-to-playlist", (...args) => {
    const trackIndex = playlist.addToPlaylist(...args);
    if (trackIndex !== undefined) {
      playTrack(trackIndex, 0);
    }
    refreshUI();
  });

  on("update-layout-pos", (position) => {
    let container = document.getElementById("media-player-container");
    if (position == 0) {
      container.classList.remove("mp-layout-bottom-left");
      container.classList.add("mp-layout-top-left");
    } else {
      container.classList.add("mp-layout-bottom-left");
      container.classList.remove("mp-layout-top-left");
    }
  });

  on("update-localization", (callback) => {
    updateLocalization(callback);
  });

  on("tags-filled", (...args) => {
    playlist.onTagsFilled(...args);
  });

  on("show-modal-info", (...args) => {
    showModalAlert(...args);
  });

  on("show-modal-open", (...args) => {
    showModalOpen(...args);
  });

  on("show-modal-open-url", (...args) => {
    showModalOpenURL(...args);
  });
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.title = element.text;
    }
  }
}

function clearPlayer() {
  g_player.engine.pause();
  g_player.engine.src = "";
  g_player.engine.load();
  g_player.isPlaying = false;
  g_player.isYoutube = false;
  g_player.isVideo = false;
  g_player.usingFfmpeg = false;
}

/////////////////////////////////////////////////////////////////////

export function loadTrack(index, time) {
  clearPlayer();
  refreshUI();
  try {
    playlist.setCurrentTrackIndex(index);
    playlist.setSelectedTrackFileIndex(
      playlist.getTracks()[playlist.getCurrentTrackIndex()].fileIndex,
    );
    if (
      playlist
        .getTracks()
        [playlist.getCurrentTrackIndex()].fileUrl.startsWith("http") &&
      yt.getYouTubeVideoIdFromUrl(
        playlist.getTracks()[playlist.getCurrentTrackIndex()].fileUrl,
      )
    ) {
      g_player.isYoutube = true;
    } else {
      if (
        playlist
          .getTracks()
          [playlist.getCurrentTrackIndex()].fileUrl.endsWith(".m3u8") &&
        Hls.isSupported()
      ) {
        g_player.engine.usingHsl = true;
        g_player.sliderTime.value = 0;
        g_player.engine.currentTime = 0;
      } else {
        g_player.engine.usingHsl = false;
        if (g_player.engine.hls) {
          g_player.engine.hls.destroy();
        }
        g_player.engine.src =
          playlist.getTracks()[playlist.getCurrentTrackIndex()].fileUrl;
        g_player.sliderTime.value = time;
        g_player.engine.currentTime = time;
      }
      g_loadedTrackIndex = playlist.getCurrentTrackIndex();
    }
    return true;
  } catch (error) {
    g_loadedTrackIndex = -1;
    console.log(error);
    return false;
  }
}

export async function playTrack(index, time) {
  let useHsl = false;
  if (index >= 0) {
    useHsl =
      playlist.getTracks()[index].fileUrl.endsWith(".m3u8") &&
      Hls.isSupported();
  } else {
    useHsl =
      playlist
        .getTracks()
        [playlist.getCurrentTrackIndex()].fileUrl.endsWith(".m3u8") &&
      Hls.isSupported();
  }
  if (useHsl) {
    if (index === -1) {
      index = playlist.getCurrentTrackIndex();
    }
    if (g_player.engine.hls) {
      g_player.engine.hls.destroy();
      g_player.engine.usingHsl = false;
    }
    g_player.engine.hls = new Hls();
    g_player.engine.hls.attachMedia(g_player.engine);
    g_player.engine.hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      g_player.engine.hls.loadSource(playlist.getTracks()[index].fileUrl);
      if (!loadTrack(index, time)) return;
      g_player.engine.play();
      g_player.isPlaying = true;
      refreshUI();
      playlist.scrollToCurrent();
    });
    // ref: https://github.com/video-dev/hls.js/blob/master/docs/API.md#fatal-error-recovery
    g_player.engine.hls.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("hls: fatal media error encountered, try to recover");
            hls.recoverMediaError();
            break;
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error("hls: fatal network error encountered", data);
            sendIpcToMain("on-play-error", "NotSupportedError");
            clearPlayer();
            refreshUI();
            g_player.engine.hls.destroy();
            g_player.engine.usingHsl = false;
            break;
          default:
            sendIpcToMain("on-play-error", "NotSupportedError");
            clearPlayer();
            refreshUI();
            g_player.engine.hls.destroy();
            g_player.engine.usingHsl = false;
            break;
        }
      }
    });
  } else {
    const loadId = ++g_currentLoadId;
    const wasMuted = g_player.engine.muted;
    try {
      if (g_loadedTrackIndex > -1 && index === -1) {
        g_player.isPlaying = true;
        if (g_player.isYoutube) {
          if (yt.onPlayClicked()) g_player.isPlaying = true;
          refreshUI();
          playlist.scrollToCurrent();
          return;
        }
        // await g_player.engine.play();
        // refreshUI();
        // playlist.scrollToCurrent();
        // TODO: check if already initialized, and just play pause?
        // load "normal" track
        g_player.engine.muted = true;
        await g_player.engine.play();
        await new Promise((r) => setTimeout(r, 250));
        if (loadId !== g_currentLoadId) return;
        if (
          g_player.engine.videoWidth === 0 &&
          g_player.engine.webkitVideoDecodedByteCount === 0
        ) {
          const isActuallyVideo = await sendIpcToMainAndWait(
            "mp-is-video-stream",
            decodeURI(
              playlist.getTracks()[playlist.getCurrentTrackIndex()].fileUrl,
            ),
          );

          if (loadId !== g_currentLoadId) return;

          if (isActuallyVideo) {
            clearPlayer();
            throw new Error("NotSupportedError");
          }
        }
        g_player.engine.muted = wasMuted;
        g_player.isPlaying = true;
      } else {
        if (index === -1) index = playlist.getCurrentTrackIndex();
        yt.destroyPlayer();
        if (!loadTrack(index, time)) return;
        if (playlist.getTracks()[index].fileUrl.startsWith("http")) {
          const ytId = yt.getYouTubeVideoIdFromUrl(
            playlist.getTracks()[index].fileUrl,
          );
          if (ytId) {
            yt.createNewPlayer(
              ytId,
              g_player.engine.volume,
              refreshUI,
              playlist.updateCurrentFileTags,
            );
            clearPlayer();
            g_player.isPlaying = true;
            g_player.isYoutube = true;
            g_loadedTrackIndex = index;
            refreshUI();
            playlist.scrollToCurrent();
            return;
          }
        }
        // load "normal" track
        g_player.engine.muted = true;
        await g_player.engine.play();
        await new Promise((r) => setTimeout(r, 250));
        if (loadId !== g_currentLoadId) return;
        if (
          g_player.engine.videoWidth === 0 &&
          g_player.engine.webkitVideoDecodedByteCount === 0
        ) {
          const isActuallyVideo = await sendIpcToMainAndWait(
            "mp-is-video-stream",
            decodeURI(
              playlist.getTracks()[playlist.getCurrentTrackIndex()].fileUrl,
            ),
          );

          if (loadId !== g_currentLoadId) return;

          if (isActuallyVideo) {
            clearPlayer();
            throw new Error("NotSupportedError");
          }
        }
        g_player.engine.muted = wasMuted;
        g_player.isPlaying = true;
      }
    } catch (error) {
      g_player.engine.muted = wasMuted;
      if (error.toString().includes("NotSupportedError")) {
        if (g_ffmpegAvailable) {
          if (loadId !== g_currentLoadId) {
            return;
          }
          if (g_player.usingFfmpeg) {
            console.log("unsupported even with ffmpeg");
            clearPlayer();
            refreshUI();
            sendIpcToMain("on-play-error", "NotSupportedError");
            return;
          }
          g_player.usingFfmpeg = true;
          g_player.isPlaying = true;
          console.log("unsupported natively, try loading with ffmpeg");
          sendIpcToMain(
            "mp-ffmpeg-load-video",
            playlist.getTracks()[playlist.getCurrentTrackIndex()].fileUrl,
          );
        } else {
          // normal native path
          clearPlayer();
          refreshUI();
          sendIpcToMain("on-play-error", "NotSupportedError");
        }
      } else {
        console.log(error);
      }
    }
  }
  refreshUI();
  playlist.scrollToCurrent();
}

function pauseTrack(refresh = true) {
  if (g_player.isYoutube) {
    if (yt.onPauseClicked()) g_player.isPlaying = false;
  } else {
    g_player.engine.pause();
    g_player.isPlaying = false;
  }
  if (refresh) refreshUI();
}

function onPlaylistTrackDoubleClicked(fileIndex) {
  let newTrackIndex;
  for (let index = 0; index < playlist.getTracks().length; index++) {
    if (playlist.getTracks()[index].fileIndex === fileIndex) {
      newTrackIndex = index;
      break;
    }
  }
  if (newTrackIndex !== undefined) playTrack(newTrackIndex, 0);
}

/////////////////////////////////////////////////////////////////////

function refreshUI() {
  if (g_player.isVideo) {
    g_player.engine.parentNode.classList.remove("set-display-none");
  } else {
    g_player.engine.parentNode.classList.add("set-display-none");
  }
  if (
    g_player.isYoutube &&
    document.getElementById("mp-div-ytvideo").childElementCount > 0
  ) {
    document
      .getElementById("mp-div-ytvideo")
      .classList.remove("set-display-none");
  } else {
    document.getElementById("mp-div-ytvideo").classList.add("set-display-none");
  }
  if (playlist.getTracks().length > 0) {
    if (g_player.isYoutube || g_player.engine.src || g_player.engine.usingHsl) {
      g_player.buttonPlay.classList.remove("mp-disabled");
      g_player.buttonPause.classList.remove("mp-disabled");
    } else {
      g_player.buttonPlay.classList.add("mp-disabled");
      g_player.buttonPause.classList.add("mp-disabled");
    }

    if (g_player.isPlaying) {
      g_player.buttonPlay.classList.add("set-display-none");
      g_player.buttonPause.classList.remove("set-display-none");
    } else {
      g_player.buttonPlay.classList.remove("set-display-none");
      g_player.buttonPause.classList.add("set-display-none");
    }

    if (g_settings.repeat || playlist.getCurrentTrackIndex() > 0) {
      g_player.buttonPrev.classList.remove("mp-disabled");
    } else {
      g_player.buttonPrev.classList.add("mp-disabled");
    }
    if (
      g_settings.repeat ||
      playlist.getTracks().length - 1 > playlist.getCurrentTrackIndex()
    ) {
      g_player.buttonNext.classList.remove("mp-disabled");
    } else {
      g_player.buttonNext.classList.add("mp-disabled");
    }
  } else {
    g_player.buttonPlay.classList.remove("set-display-none");
    g_player.buttonPlay.classList.add("mp-disabled");
    g_player.buttonPause.classList.add("set-display-none");
    g_player.buttonPrev.classList.add("mp-disabled");
    g_player.buttonNext.classList.add("mp-disabled");
  }

  if (g_player.engine.volume > 0) {
    g_player.buttonVolumeOn.classList.add("mp-hidden");
    g_player.buttonVolumeOff.classList.remove("mp-hidden");
  } else {
    g_player.buttonVolumeOn.classList.remove("mp-hidden");
    g_player.buttonVolumeOff.classList.add("mp-hidden");
  }

  if (g_settings.shuffle) {
    g_player.buttonShuffleOff.classList.remove("mp-hidden");
    g_player.buttonShuffleOn.classList.add("mp-hidden");
  } else {
    g_player.buttonShuffleOff.classList.add("mp-hidden");
    g_player.buttonShuffleOn.classList.remove("mp-hidden");
  }
  if (g_settings.repeat) {
    g_player.buttonRepeatOff.classList.remove("mp-hidden");
    g_player.buttonRepeatOn.classList.add("mp-hidden");
  } else {
    g_player.buttonRepeatOff.classList.add("mp-hidden");
    g_player.buttonRepeatOn.classList.remove("mp-hidden");
  }

  if (playlist.getTracks().length > 0) {
    g_player.buttonClear.classList.remove("mp-disabled");
    g_player.buttonSave.classList.remove("mp-disabled");
  } else {
    g_player.buttonClear.classList.add("mp-disabled");
    g_player.buttonSave.classList.add("mp-disabled");
  }
  if (
    playlist.getTracks().length > 0 &&
    playlist.getSelectedTrackFileIndex() !== undefined
  ) {
    g_player.buttonDelete.classList.remove("mp-disabled");
  } else {
    g_player.buttonDelete.classList.add("mp-disabled");
  }
  playlist.updatePlaylistInfo();
}

function onButtonClicked(buttonName) {
  if (buttonName === "play") {
    playTrack(-1, -1);
  } else if (buttonName === "pause") {
    pauseTrack(false);
  } else if (buttonName === "prev") {
    if (g_settings.repeat && playlist.getCurrentTrackIndex() === 0)
      playTrack(playlist.getTracks().length - 1, 0);
    else playTrack(playlist.getCurrentTrackIndex() - 1, 0);
  } else if (buttonName === "next") {
    if (
      g_settings.repeat &&
      playlist.getCurrentTrackIndex() === playlist.getTracks().length - 1
    )
      playTrack(0, 0);
    else playTrack(playlist.getCurrentTrackIndex() + 1, 0);
  } else if (buttonName === "open") {
    sendIpcToMain("on-open-clicked", 0);
  } else if (buttonName === "playlist") {
    if (g_player.divPlaylist.classList.contains("mp-hidden")) {
      g_player.divPlaylist.classList.remove("mp-hidden");
      g_settings.showPlaylist = true;
    } else {
      g_player.divPlaylist.classList.add("mp-hidden");
      g_settings.showPlaylist = false;
    }
  } else if (buttonName === "volume-off") {
    g_player.lastVolume = g_player.engine.volume;
    g_player.engine.volume = 0;
    if (g_player.isYoutube) {
      yt.updateVolume(g_player.engine.volume);
    }
  } else if (buttonName === "volume-on") {
    if (g_player.lastVolume) g_player.engine.volume = g_player.lastVolume;
    else g_player.engine.volume = 1;
    if (g_player.isYoutube) {
      yt.updateVolume(g_player.engine.volume);
    }
  } else if (buttonName === "close") {
    sendIpcToMain("close");
  }
  // playlist
  else if (buttonName === "shuffle-on") {
    g_settings.shuffle = true;
    createTracksList(true);
  } else if (buttonName === "shuffle-off") {
    g_settings.shuffle = false;
    createTracksList(true);
  } else if (buttonName === "repeat-on") {
    g_settings.repeat = true;
  } else if (buttonName === "repeat-off") {
    g_settings.repeat = false;
  } else if (buttonName === "clear") {
    if (playlist.getTracks().length <= 0) return;
    playlist.getPlaylist().files = [];
    playlist.setTracks([]);
    playlist.setSelectedTrackFileIndex(undefined);
    pauseTrack(true);
  } else if (buttonName === "add") {
    sendIpcToMain("on-open-clicked", 1);
  } else if (buttonName === "delete") {
    if (
      playlist.getTracks().length <= 0 ||
      playlist.getSelectedTrackFileIndex() === undefined
    )
      return;
    let currentTrackFileIndex =
      playlist.getTracks()[playlist.getCurrentTrackIndex()].fileIndex;
    // delete
    playlist
      .getPlaylist()
      .files.splice(playlist.getSelectedTrackFileIndex(), 1);
    let selectedTrackIndex = 0;
    for (let index = 0; index < playlist.getTracks().length; index++) {
      const track = playlist.getTracks()[index];
      if (track.fileIndex === playlist.getSelectedTrackFileIndex())
        selectedTrackIndex = index;
      if (track.fileIndex > playlist.getSelectedTrackFileIndex()) {
        track.fileIndex--;
        track.fileUrl = playlist.getPlaylist().files[track.fileIndex].url;
      }
    }
    playlist.getTracks().splice(selectedTrackIndex, 1);
    // update current index / playing track if needed
    if (currentTrackFileIndex === playlist.getSelectedTrackFileIndex()) {
      // deleting the current one
      if (playlist.getCurrentTrackIndex() < playlist.getTracks().length) {
        if (g_player.isPlaying) {
          playTrack(playlist.getCurrentTrackIndex(), 0);
        } else {
          loadTrack(playlist.getCurrentTrackIndex(), 0);
        }
      } else {
        // the deleted one was the last
        pauseTrack(false);
        playlist.setCurrentTrackIndex(playlist.getTracks().length - 1);
        if (playlist.getTracks().length > 0)
          loadTrack(playlist.getTracks().length - 1, 0);
      }
    } else {
      if (playlist.getCurrentTrackIndex() < selectedTrackIndex) {
        // keep the same
      } else {
        playlist.setCurrentTrackIndex(playlist.getCurrentTrackIndex() - 1);
      }
    }
    if (playlist.getTracks().length > 0) {
      playlist.setSelectedTrackFileIndex(
        playlist.getTracks()[playlist.getCurrentTrackIndex()].fileIndex,
      );
    } else {
      playlist.setSelectedTrackFileIndex(undefined);
    }
    playlist.updatePlaylistInfo();
  } else if (buttonName === "save-playlist") {
    if (playlist.getPlaylist().files.length > 0)
      sendIpcToMain("save-playlist", playlist.getPlaylist());
  }

  refreshUI();
}

function onSliderTimeChanged(slider) {
  const targetSecond = parseInt(slider.value);
  if (g_player.usingFfmpeg) {
    ffmpeg.setTime(targetSecond);
  } else if (!g_player.engine.usingHsl && !isNaN(g_player.engine.duration)) {
    if (g_player.engine.duration != Infinity) {
      g_player.engine.currentTime =
        (targetSecond * g_player.engine.duration) / 100;
    }
  }
}

function onSliderVolumeChanged(slider) {
  g_player.engine.volume = slider.value / 100;
  if (g_player.isYoutube) {
    yt.updateVolume(g_player.engine.volume);
  }
}

function onYTError(type) {
  // TODO ?
  clearPlayer();
  g_loadedTrackIndex = -1;
  refreshUI();
}

function initPlayer(settings, loadedPlaylist, ffmpegAvailable) {
  g_ffmpegAvailable = ffmpegAvailable;
  ffmpeg.init(sendIpcToMain);
  yt.init(onYTError);

  // init engine ////
  g_player.engine = document.getElementById("mp-html-video");

  g_player.engine.addEventListener("error", (error) => {
    // ref: https://developer.mozilla.org/en-US/docs/Web/API/MediaError/message
    let message;
    switch (error.target.error.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        message = "Canceled audio playback.";
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        message = "A network error occurred while fetching the audio.";
        break;
      case MediaError.MEDIA_ERR_DECODE:
        message = "An error occurred while decoding the audio.";
        break;
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        message = "Audio is missing or is an unsupported format.";
        break;
      default:
        message = "An unknown error occurred.";
        break;
    }
  });
  g_player.engine.addEventListener("timeupdate", function () {
    if (g_player.usingFfmpeg) {
      ffmpeg.onSliderTimeTimeUpdate(
        g_player.engine,
        g_player.sliderTime,
        g_player.textTime,
      );
    } else {
      if (g_player.engine.usingHsl) {
        g_player.textTime.innerHTML = "--/--";
        g_player.sliderTime.value = 0;
      } else if (isNaN(this.duration) || !isFinite(this.duration)) {
        g_player.textTime.innerHTML = playlist.getFormatedTimeFromSeconds(
          this.currentTime,
        );
        g_player.sliderTime.value = 0;
      } else {
        g_player.textTime.innerHTML =
          playlist.getFormatedTimeFromSeconds(this.currentTime) +
          " / " +
          playlist.getFormatedTimeFromSeconds(this.duration);
        g_player.sliderTime.value = (100 * this.currentTime) / this.duration;
      }
    }
  });

  g_player.engine.addEventListener("volumechange", function () {
    g_player.textVolume.innerHTML = `${Math.floor(this.volume * 100)}%`;
    g_player.sliderVolume.value = this.volume * 100;
  });

  g_player.engine.addEventListener("loadedmetadata", () => {
    if (g_player.engine.videoWidth > 0) {
      g_player.isVideo = true;
    } else {
      g_player.isVideo = false;
    }
    refreshUI();
  });

  g_player.engine.addEventListener("loadeddata", function () {
    if (playlist.getTracks().length <= 0) return;
    let fileIndex =
      playlist.getTracks()[playlist.getCurrentTrackIndex()].fileIndex;
    if (
      !playlist.getPlaylist().files[fileIndex].duration ||
      playlist.getPlaylist().files[fileIndex].duration == -1
    ) {
      if (playlist.getPlaylist().files[fileIndex].url.endsWith(".m3u8")) return;
      playlist.getPlaylist().files[fileIndex].duration =
        g_player.engine.duration;
      playlist.updatePlaylistInfo();
    }
  });

  g_player.engine.addEventListener("ended", function () {
    if (playlist.getTracks().length - 1 > playlist.getCurrentTrackIndex()) {
      playTrack(playlist.getCurrentTrackIndex() + 1, 0);
    } else {
      if (g_settings.repeat) {
        playTrack(0, 0);
      } else {
        pauseTrack(false);
        loadTrack(0, 0);
      }
    }
    refreshUI();
  });

  // init UI ////
  g_player.buttonOpen = document.getElementById("mp-button-open");
  g_player.buttonOpen.addEventListener("click", function () {
    onButtonClicked("open");
  });

  g_player.buttonPlay = document.getElementById("mp-button-play");
  g_player.buttonPlay.addEventListener("click", function () {
    onButtonClicked("play");
  });
  g_player.buttonPause = document.getElementById("mp-button-pause");
  g_player.buttonPause.addEventListener("click", function () {
    onButtonClicked("pause");
  });
  g_player.buttonPrev = document.getElementById("mp-button-prev");
  g_player.buttonPrev.addEventListener("click", function () {
    onButtonClicked("prev");
  });
  g_player.buttonNext = document.getElementById("mp-button-next");
  g_player.buttonNext.addEventListener("click", function () {
    onButtonClicked("next");
  });

  g_player.textTime = document.getElementById("mp-text-time");
  g_player.sliderTime = document.getElementById("mp-slider-time");
  g_player.sliderTime.addEventListener("input", function () {
    onSliderTimeChanged(g_player.sliderTime);
  });

  g_player.buttonVolumeOff = document.getElementById("mp-button-volume-off");
  g_player.buttonVolumeOff.addEventListener("click", function () {
    onButtonClicked("volume-off");
  });
  g_player.buttonVolumeOn = document.getElementById("mp-button-volume-on");
  g_player.buttonVolumeOn.addEventListener("click", function () {
    onButtonClicked("volume-on");
  });
  g_player.textVolume = document.getElementById("mp-text-volume");
  g_player.sliderVolume = document.getElementById("mp-slider-volume");
  g_player.sliderVolume.addEventListener("input", function () {
    onSliderVolumeChanged(g_player.sliderVolume);
  });
  g_player.sliderVolume.addEventListener("change", function () {
    refreshUI();
  });

  g_player.divPlaylist = document.getElementById("mp-div-playlist");
  g_player.buttonPlaylist = document.getElementById("mp-button-playlist");
  g_player.buttonPlaylist.addEventListener("click", function () {
    onButtonClicked("playlist");
  });
  g_player.buttonClose = document.getElementById("mp-button-close");
  g_player.buttonClose.addEventListener("click", function () {
    onButtonClicked("close");
  });
  //////
  g_player.divPlaylistTracks = document.getElementById(
    "mp-div-playlist-tracks",
  );

  g_player.buttonShuffleOn = document.getElementById("mp-button-shuffle-on");
  g_player.buttonShuffleOn.addEventListener("click", function () {
    onButtonClicked("shuffle-on");
  });
  g_player.buttonShuffleOff = document.getElementById("mp-button-shuffle-off");
  g_player.buttonShuffleOff.addEventListener("click", function () {
    onButtonClicked("shuffle-off");
  });
  g_player.buttonRepeatOn = document.getElementById("mp-button-repeat-on");
  g_player.buttonRepeatOn.addEventListener("click", function () {
    onButtonClicked("repeat-on");
  });
  g_player.buttonRepeatOff = document.getElementById("mp-button-repeat-off");
  g_player.buttonRepeatOff.addEventListener("click", function () {
    onButtonClicked("repeat-off");
  });

  g_player.buttonClear = document.getElementById("mp-button-clear");
  g_player.buttonClear.addEventListener("click", function () {
    onButtonClicked("clear");
  });
  g_player.buttonAdd = document.getElementById("mp-button-add");
  g_player.buttonAdd.addEventListener("click", function () {
    onButtonClicked("add");
  });
  g_player.buttonDelete = document.getElementById("mp-button-delete");
  g_player.buttonDelete.addEventListener("click", function () {
    onButtonClicked("delete");
  });
  g_player.buttonSave = document.getElementById("mp-button-save");
  g_player.buttonSave.addEventListener("click", function () {
    onButtonClicked("save-playlist");
  });

  // stop wheel scroll from propagating through the player
  g_player.divPlaylist.addEventListener("wheel", function (event) {
    event.stopPropagation();
  });
  document
    .getElementById("mp-div-topbar")
    .addEventListener("wheel", function (event) {
      event.stopPropagation();
    });

  // load settings & playlist ////////////
  g_settings = settings;

  const loadTrackIndex = playlist.init(
    g_player,
    loadedPlaylist,
    g_settings,
    g_ffmpegAvailable,
    sendIpcToMain,
    onPlaylistTrackDoubleClicked,
  );
  if (loadTrackIndex !== undefined)
    loadTrack(loadTrackIndex, g_settings.currentTime ?? 0);

  g_player.isPlaying = false;
  g_player.engine.volume = g_settings.volume;
  g_player.textVolume.innerHTML = `${Math.floor(g_settings.volume * 100)}%`;
  g_player.sliderVolume.value = g_settings.volume * 100;
  if (g_settings.showPlaylist)
    g_player.divPlaylist.classList.remove("mp-hidden");
  else g_player.divPlaylist.classList.add("mp-hidden");

  refreshUI();
  setTimeout(playlist.scrollToCurrent, 100);

  // will send settings and playlist to main
  // so on quit the info is immediately available
  // TODO: maybe do it a more efficient way
  sendConfigUpdateTimeout();
}

let g_configUpdateTimeout;
function sendConfigUpdateTimeout() {
  g_settings.volume = g_player.engine.volume;
  if (playlist.getTracks().length > 0)
    g_settings.currentFileIndex =
      playlist.getTracks()[playlist.getCurrentTrackIndex()].fileIndex;
  else g_settings.currentFileIndex = undefined;
  g_settings.currentTime = g_player.engine.currentTime;
  sendIpcToMain("update-config", g_settings, playlist.getPlaylist());
  g_configUpdateTimeout = setTimeout(sendConfigUpdateTimeout, 2000);
}
// TODO: call clearTimeout(g_configUpdateTimeout); on exit?

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getOpenModal()) {
    modals.onInputEvent(getOpenModal(), type, event);
    return;
  }
  switch (type) {
    case "body.ondrop": {
      const composedPath = event.composedPath();
      for (let index = 0; index < composedPath.length; index++) {
        const element = composedPath[index];
        if (element?.id?.includes("mp-")) {
          let outputPaths = [];
          for (
            let index = 0;
            index < event.dataTransfer.files.length;
            index++
          ) {
            const file = event.dataTransfer.files[index];
            outputPaths.push(ipc.showFilePath(file));
          }
          if (outputPaths.length > 0) sendIpcToMain("on-drop", outputPaths);
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function showModal(config) {
  g_openModal = modals.show(config);
}

function modalClosed() {
  g_openModal = undefined;
}

function showModalAlert(title, message, textButton1) {
  if (g_openModal) {
    return;
  }
  showModal({
    title: title,
    message: message,
    zIndexDelta: 6,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          modalClosed();
        },
        key: "Enter",
      },
    ],
  });
}

function showModalOpen(
  title,
  textButtonBack,
  textButtonOpenFile,
  textButtonOpenUrl,
  mode,
  showFocus,
) {
  if (getOpenModal()) {
    return;
  }

  let buttons = [];
  buttons.push({
    text: textButtonOpenFile.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("on-open-file-clicked", mode);
    },
  });
  buttons.push({
    text: textButtonOpenUrl.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("on-open-url-clicked", mode);
    },
  });
  buttons.push({
    text: textButtonBack.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
    },
  });

  g_openModal = modals.show({
    showFocus: showFocus,
    title: title,
    frameWidth: 400,
    zIndexDelta: 6,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

function showModalOpenURL(title, message, textButton1, textButton2, mode) {
  if (g_openModal) {
    return;
  }

  g_openModal = modals.show({
    title,
    message,
    zIndexDelta: 6,
    input: { type: "text", default: "" },
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: (showFocus, value) => {
          const ytId = yt.getYouTubeVideoIdFromUrl(value);
          sendIpcToMain("on-modal-open-url-ok-clicked", {
            value,
            ytId: ytId,
            mode,
          });
          modalClosed();
          showLoadingModal();
        },
        key: "Enter",
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}
