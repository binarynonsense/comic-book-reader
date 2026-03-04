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
import * as spectrumVisualizer from "./renderer/spectrum.js";
import {
  PlayerState,
  PlayerMediaType,
  PlayerEngineType,
} from "./renderer/constants.js";

let g_settings;
let g_ffmpegAvailable = false;
let g_currentLoadId = 0;

///////////////////////////////////////////////////////////////////////////////
// PLAYER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_player = { html: {} };

function setPlayerState(state, doUIRefresh = false) {
  // console.log("setPlayerState " + state);
  // console.trace("stack trace");
  g_player.state = state;
  clearTimeout(g_player.html.restoreMuteTimeOut);

  if (state === PlayerState.PLAYING) {
    g_player.html.restoreMuteTimeOut = setTimeout(() => {
      g_player.engine.muted = g_settings.muted;
      g_player.html.restoreMuteTimeOut = undefined;
    }, 1000);
  }

  if (doUIRefresh) refreshUI();
}

function clearPlayer() {
  if (g_player.engine && g_player.engine.src !== "") {
    g_player.engine.pause();
    g_player.engine.src = "";
    g_player.engine.load();
    g_player.html.sliderTime.max = 100;
    g_player.html.sliderTime.value = 0;
  }

  setPlayerState(PlayerState.NOT_SET);
  // g_player.mediaType = PlayerMediaType.NOT_SET;
  g_player.engineType = PlayerEngineType.NOT_SET;

  if (g_player.engine) {
    g_player.usingHsl = false;
    if (g_player.engine.hls) {
      g_player.engine.hls.destroy();
    }
  }
  sendIpcToMain("mp-ffmpeg-close-video");
  yt.destroyPlayer();

  g_player.trackIndex = playlist.getCurrentTrackIndex();
  g_player.trackMetadata = undefined;
  g_player.trackHasVideoMetadata = undefined;
}

function initPlayer() {
  clearPlayer();

  g_player.engine = document.getElementById("mp-html-video");

  // ref: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement

  g_player.engine.addEventListener("canplay", function () {
    if (
      (g_player.engineType === PlayerEngineType.NATIVE ||
        g_player.engineType === PlayerEngineType.FFMPEG) &&
      g_player.state !== PlayerState.PAUSED
    ) {
      onPlaySucceeded();
    }
  });

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
    g_player.html.updateTimeStatusText();
    if (g_player.engineType === PlayerEngineType.FFMPEG) {
      ffmpeg.onSliderTimeTimeUpdate(g_player.engine, g_player.html.sliderTime);
    } else if (g_player.engineType === PlayerEngineType.NATIVE) {
      if (g_player.usingHsl) {
        g_player.html.sliderTime.value = 0;
      } else if (isNaN(this.duration) || !isFinite(this.duration)) {
        g_player.html.sliderTime.value = 0;
      } else {
        g_player.html.sliderTime.max = this.duration;
        g_player.html.sliderTime.value = this.currentTime;
      }
    }
  });

  g_player.engine.addEventListener("volumechange", function () {
    g_player.html.sliderVolume.value = this.volume * 100;
  });

  g_player.engine.addEventListener("loadedmetadata", async () => {
    if (g_player.engine.videoWidth > 0 || g_player.trackHasVideoMetadata) {
      g_player.mediaType = PlayerMediaType.VIDEO;
    } else {
      g_player.mediaType = PlayerMediaType.AUDIO;
    }
    refreshUI();
  });

  g_player.engine.addEventListener("loadeddata", function () {
    if (playlist.getTracks().length <= 0) return;
    let fileIndex = playlist.getCurrentTrackFileIndex();
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
    onEnded();
  });
}

///////////////////////////////////////////////////////////////////////////////
// BASE ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onInit(settings, loadedPlaylist, ffmpegAvailable) {
  try {
    g_ffmpegAvailable = ffmpegAvailable;

    // load css ////
    await loadStylesheet("../tools/media-player/html/style.css");

    // init UI ////
    initUI();

    // init player ////
    initPlayer();
    ffmpeg.init(setPlayerState, sendIpcToMain);
    yt.init(onError);

    // load settings & playlist ////
    g_settings = settings;

    const loadTrackIndex = playlist.init(
      g_player,
      loadedPlaylist,
      g_settings,
      sendIpcToMain,
      onPlaylistTrackDoubleClicked,
      refreshUI,
    );
    if (loadTrackIndex !== undefined) {
      playlist.setCurrentTrackIndex(loadTrackIndex);
      playlist.setSelectedTrackFileIndex(
        playlist.getTracks()[loadTrackIndex].fileIndex,
      );
      g_player.trackIndex = loadTrackIndex;
      g_player.pendingTime = g_settings.currentTime;
      g_player.html.sliderTime.max = g_settings.currentDuration;
      g_player.html.sliderTime.value = g_player.pendingTime;
    }

    g_player.engine.volume = g_settings.volume;
    g_player.html.sliderVolume.value = g_settings.volume * 100;
    if (g_settings.showPlaylist)
      g_player.html.divPlaylist.classList.remove("mp-hidden");
    else g_player.html.divPlaylist.classList.add("mp-hidden");

    if (g_settings.showSpectrum) spectrumVisualizer.start();

    ////////////////
    refreshUI();
    setTimeout(playlist.scrollToCurrent, 100);
    // will send settings and playlist to main
    // so on quit the info is immediately available
    // TODO: maybe do it a more efficient way
    sendConfigUpdateTimeout();
  } catch (error) {
    console.log(error);
  }
}

let g_configUpdateTimeout;
function sendConfigUpdateTimeout() {
  g_settings.volume = g_player.engine.volume;
  if (playlist.getTracks().length > 0)
    g_settings.currentFileIndex = playlist.getCurrentTrackFileIndex();
  else g_settings.currentFileIndex = undefined;

  g_settings.currentTime = parseInt(g_player.html.sliderTime.value);
  g_settings.currentDuration = parseInt(g_player.html.sliderTime.max);

  sendIpcToMain("update-config", g_settings, playlist.getPlaylist());
  g_configUpdateTimeout = setTimeout(sendConfigUpdateTimeout, 2000);
}
// TODO: call clearTimeout(g_configUpdateTimeout); on exit?

async function onPlay(trackIndex = undefined, time = 0) {
  try {
    if (trackIndex === undefined && g_player.pendingTime && time === 0) {
      time = g_player.pendingTime;
    }
    g_player.pendingTime = undefined;

    if (trackIndex === undefined && g_player.trackIndex === undefined) {
      // TODO: ?
      return;
    }

    if (
      trackIndex === undefined &&
      g_player.trackIndex !== undefined &&
      g_player.state === PlayerState.PAUSED
    ) {
      // already loaded
      if (
        g_player.engineType === PlayerEngineType.NATIVE ||
        g_player.engineType === PlayerEngineType.FFMPEG
      ) {
        g_player.engine.play();
        setPlayerState(PlayerState.PLAYING);
        refreshUI();
        return;
      } else if (g_player.engineType === PlayerEngineType.YOUTUBE) {
        if (yt.onPlay()) {
          setPlayerState(PlayerState.PLAYING);
        }
        refreshUI();
        playlist.scrollToCurrent();
        return;
      }
    }

    if (trackIndex === undefined && g_player.trackIndex !== undefined) {
      trackIndex = g_player.trackIndex;
    }

    if (
      trackIndex === g_player.trackIndex &&
      g_player.state === PlayerState.LOADING
    ) {
      // already loading
      return;
    }

    // load and play
    clearPlayer();
    g_player.trackIndex = trackIndex;
    playlist.setSelectedTrackFileIndex(
      playlist.getTracks()[trackIndex].fileIndex,
    );
    g_player.trackIndex = trackIndex;
    const loadId = ++g_currentLoadId;
    const wasMuted = g_player.engine.muted;
    setPlayerState(PlayerState.LOADING);
    try {
      g_player.trackMetadata = await sendIpcToMainAndWait(
        "mp-get-file-metadata",
        decodeURI(playlist.getTracks()[trackIndex].fileUrl),
      );
      g_player.engine.src = playlist.getTracks()[trackIndex].fileUrl;

      const useHsl =
        playlist.getTracks()[trackIndex].fileUrl.endsWith(".m3u8") &&
        Hls.isSupported();
      if (useHsl) {
        // NATIVE HSL
        g_player.usingHsl = true;
        g_player.engine.hls = new Hls();
        g_player.engine.hls.attachMedia(g_player.engine);
        g_player.engine.hls.on(Hls.Events.MEDIA_ATTACHED, async function () {
          g_player.engine.hls.loadSource(
            playlist.getTracks()[trackIndex].fileUrl,
          );
          g_player.html.sliderTime.value = 0;
          g_player.engine.currentTime = 0;
          g_player.engineType = PlayerEngineType.NATIVE;
          await g_player.engine.play();
        });
        // ref: https://github.com/video-dev/hls.js/blob/master/docs/API.md#fatal-error-recovery
        g_player.engine.hls.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log(
                  "[Media Player] hls: fatal media error encountered, try to recover",
                );
                hls.recoverMediaError();
                break;
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error(
                  "[Media Player] hls: fatal network error encountered",
                  data,
                );
                onError("NotSupportedError");
              default:
                onError("NotSupportedError");
            }
          }
        });
      } else {
        g_player.html.sliderTime.value = time;
        g_player.engine.currentTime = time;
        if (
          playlist.getTracks()[trackIndex].fileUrl.startsWith("http") &&
          yt.getYouTubeVideoIdFromUrl(playlist.getTracks()[trackIndex].fileUrl)
        ) {
          g_player.engineType = PlayerEngineType.YOUTUBE;
          g_player.mediaType = PlayerMediaType.VIDEO;
          const ytId = yt.getYouTubeVideoIdFromUrl(
            playlist.getTracks()[trackIndex].fileUrl,
          );
          yt.createNewPlayer(
            ytId,
            time,
            g_player.engine.volume,
            refreshUI,
            playlist.updateCurrentFileTags,
            onPlaySucceeded,
            onEnded,
          );
        } else {
          // NATIVE
          g_player.engine.muted = true;
          g_player.engineType = PlayerEngineType.NATIVE;
          g_player.trackHasVideoMetadata = await isVideoMetadata(
            g_player.trackMetadata,
          );
          await g_player.engine.play();
          await new Promise((r) => setTimeout(r, 250));
          if (loadId !== g_currentLoadId) return;
          if (
            g_player.engine.videoWidth === 0 &&
            g_player.engine.webkitVideoDecodedByteCount === 0
          ) {
            if (loadId !== g_currentLoadId) return;
            if (g_player.trackHasVideoMetadata) {
              throw new Error("NotSupportedError");
            }
          }
          g_player.engine.muted = wasMuted;
        }
      }
    } catch (error) {
      g_player.engine.muted = wasMuted;
      if (error.toString().includes("NotSupportedError")) {
        if (g_ffmpegAvailable) {
          if (loadId !== g_currentLoadId) {
            return;
          }
          if (g_player.engineType === PlayerEngineType.FFMPEG) {
            console.log("[Media Player] unsupported even with ffmpeg");
            onError(error);
            return;
          }
          setPlayerState(PlayerState.LOADING);
          g_player.engineType = PlayerEngineType.FFMPEG;
          g_player.mediaType = PlayerMediaType.VIDEO;
          g_player.engine.pause();
          // console.log(
          //   "[Media Player] unsupported natively, will try loading with ffmpeg",
          // );
          sendIpcToMain(
            "mp-ffmpeg-load-video",
            playlist.getTracks()[trackIndex].fileUrl,
            time,
          );
        } else {
          onError(error);
        }
      } else {
        onError(error);
      }
    }
    //////
    refreshUI();
    playlist.scrollToCurrent();
  } catch (error) {
    // TODO
  }
}

function onPlaySucceeded() {
  setPlayerState(PlayerState.PLAYING);
  playlist.setCurrentTrackIndex(g_player.trackIndex);
  refreshUI();
  playlist.scrollToCurrent();
}

async function onPause() {
  if (g_player.trackIndex === undefined) {
    // TODO: ?
    return;
  }
  if (g_player.state === PlayerState.PLAYING) {
    if (g_player.engineType === PlayerEngineType.YOUTUBE) {
      if (yt.onPause()) setPlayerState(PlayerState.PAUSED);
      refreshUI();
    } else if (
      g_player.engineType === PlayerEngineType.NATIVE ||
      g_player.engineType === PlayerEngineType.FFMPEG
    ) {
      await g_player.engine.pause();
      setPlayerState(PlayerState.PAUSED);
      refreshUI();
    }
  }
}

function onPlaylistTrackDoubleClicked(fileIndex) {
  let newTrackIndex;
  for (let index = 0; index < playlist.getTracks().length; index++) {
    if (playlist.getTracks()[index].fileIndex === fileIndex) {
      newTrackIndex = index;
      break;
    }
  }
  if (newTrackIndex !== undefined) onPlay(newTrackIndex, 0);
}

function onFastForward() {
  setTime(parseFloat(g_player.html.sliderTime.value) + 10);
}

function onRewind() {
  setTime(parseFloat(g_player.html.sliderTime.value) - 10);
}

function setTime(targetSecond) {
  if (g_player.pendingTime !== undefined) {
    g_player.pendingTime = targetSecond;
  }

  if (
    g_player.engineType !== PlayerEngineType.YOUTUBE &&
    isNaN(g_player.engine.duration)
  )
    return;
  if (targetSecond < 0) targetSecond = 0;
  if (targetSecond > g_player.html.sliderTime.max)
    targetSecond = g_player.html.sliderTime.max;

  if (g_player.engineType === PlayerEngineType.FFMPEG) {
    ffmpeg.setTime(targetSecond, g_player.state);
  } else if (g_player.engineType === PlayerEngineType.YOUTUBE) {
    yt.setTime(targetSecond);
  } else if (!g_player.usingHsl) {
    if (g_player.engine.duration != Infinity) {
      g_player.engine.currentTime = targetSecond;
    }
  }
  g_player.html.sliderTime.value = targetSecond;
  g_player.html.updateTimeStatusText();
}

function onNextTrack() {
  if (
    g_settings.repeat === 2 ||
    playlist.getTracks().length - 1 > playlist.getCurrentTrackIndex()
  ) {
    if (
      g_settings.repeat === 2 &&
      playlist.getCurrentTrackIndex() === playlist.getTracks().length - 1
    )
      onPlay(0, 0);
    else onPlay(playlist.getCurrentTrackIndex() + 1, 0);
  }
}

function onPrevTrack() {
  if (g_settings.repeat === 2 || playlist.getCurrentTrackIndex() > 0) {
    if (g_settings.repeat === 2 && playlist.getCurrentTrackIndex() === 0)
      onPlay(playlist.getTracks().length - 1, 0);
    else onPlay(playlist.getCurrentTrackIndex() - 1, 0);
  }
}

function onSetRepeatMode(mode) {
  g_settings.repeat = mode;
}

function onSetShuffleMode(mode) {
  g_settings.shuffle = mode;
  playlist.createTracksList(true);
  g_player.trackIndex = playlist.getCurrentTrackIndex();
}

function onEnded() {
  if (g_settings.repeat === 1) {
    onPlay();
    return;
  }
  if (playlist.getTracks().length - 1 > playlist.getCurrentTrackIndex()) {
    onPlay(playlist.getCurrentTrackIndex() + 1, 0);
  } else {
    if (g_settings.repeat === 2) {
      onPlay(0, 0);
    } else {
      onPause();
      clearPlayer();
      g_player.trackIndex = 0;
      playlist.setCurrentTrackIndex(0);
    }
  }
  playlist.scrollToCurrent();
  refreshUI();
}

//////

function onError(error) {
  console.log("[Media Player] " + error);
  if (error.toString().includes("NotSupportedError")) {
    sendIpcToMain("on-play-error", "NotSupportedError");
  } else {
    sendIpcToMain("on-play-error", "NotSupportedError");
  }
  clearPlayer();
  refreshUI();
}

///////

export function onContextMenu(params) {
  if (getOpenModal()) {
    return;
  }
  sendIpcToMain("show-context-menu", params, getContextMenuData());
}

function showSpectrumVisualizer(show) {
  if (show) {
    g_settings.showSpectrum = true;
    spectrumVisualizer.start();
  } else {
    g_settings.showSpectrum = false;
    spectrumVisualizer.stop();
  }
}

///////

async function isVideoMetadata(metadata) {
  if (!metadata) return false;
  try {
    const hasExplicitVideo =
      metadata.streams?.some((s) => s.codec_type === "video") ||
      JSON.stringify(metadata.native).toLowerCase().includes("video");

    const videoContainers = ["matroska", "isom", "mp42", "mov", "avi"];
    const container = metadata.format.tagTypes?.[0]?.toLowerCase() || "";
    const isVideoContainer = videoContainers.some((ext) =>
      container.includes(ext),
    );

    const trackCount =
      metadata.native?.matroska?.length ||
      metadata.native?.["ISO/IEC 14496-12"]?.length ||
      0;

    const isVideo = !!(
      hasExplicitVideo ||
      (isVideoContainer && trackCount > 1)
    );

    return isVideo;
  } catch (error) {
    return false;
  }
}

///////////////////////////////////////////////////////////////////////////////
// UI /////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = href;

    link.onload = () => resolve(link);
    link.onerror = () => reject(new Error(`style load failed for ${href}`));

    document.head.appendChild(link);
  });
}

function getButtonStates() {
  return {
    play:
      !g_player.html.buttonPlay.classList.contains("mp-disabled") &&
      !g_player.html.buttonPlay.classList.contains("set-display-none"),
    pause:
      !g_player.html.buttonPause.classList.contains("mp-disabled") &&
      !g_player.html.buttonPause.classList.contains("set-display-none"),
    next: !g_player.html.buttonNext.classList.contains("mp-disabled"),
    prev: !g_player.html.buttonPrev.classList.contains("mp-disabled"),
  };
}

function initUI() {
  g_player.html.buttonOpen = document.getElementById("mp-button-open");
  g_player.html.buttonOpen.addEventListener("click", function () {
    onButtonClicked("open");
  });

  g_player.html.buttonPlay = document.getElementById("mp-button-play");
  g_player.html.buttonPlay.addEventListener("click", function () {
    onButtonClicked("play");
  });
  g_player.html.buttonPause = document.getElementById("mp-button-pause");
  g_player.html.buttonPause.addEventListener("click", function () {
    onButtonClicked("pause");
  });
  g_player.html.buttonPrev = document.getElementById("mp-button-prev");
  g_player.html.buttonPrev.addEventListener("click", function () {
    onButtonClicked("prev");
  });
  g_player.html.buttonNext = document.getElementById("mp-button-next");
  g_player.html.buttonNext.addEventListener("click", function () {
    onButtonClicked("next");
  });

  g_player.html.buttonVolumeOff = document.getElementById(
    "mp-button-volume-off",
  );
  g_player.html.buttonVolumeOff.addEventListener("click", function () {
    onButtonClicked("volume-off");
  });
  g_player.html.buttonVolumeOn = document.getElementById("mp-button-volume-on");
  g_player.html.buttonVolumeOn.addEventListener("click", function () {
    onButtonClicked("volume-on");
  });

  g_player.html.divPlaylist = document.getElementById("mp-div-playlist");
  // g_player.html.buttonPlaylist = document.getElementById("mp-button-playlist");
  // g_player.html.buttonPlaylist.addEventListener("click", function () {
  //   onButtonClicked("playlist");
  // });
  // g_player.html.buttonClose = document.getElementById("mp-button-close");
  // g_player.html.buttonClose.addEventListener("click", function () {
  //   onButtonClicked("close");
  // });
  g_player.html.buttonSettings = document.getElementById("mp-button-settings");
  g_player.html.buttonSettings.addEventListener("click", function () {
    onButtonClicked("settings");
  });
  //////
  g_player.html.divPlaylistTracks = document.getElementById(
    "mp-div-playlist-tracks",
  );

  g_player.html.buttonShuffleOn = document.getElementById(
    "mp-button-shuffle-on",
  );
  g_player.html.buttonShuffleOn.addEventListener("click", function () {
    onButtonClicked("shuffle-on");
  });
  g_player.html.buttonShuffleOff = document.getElementById(
    "mp-button-shuffle-off",
  );
  g_player.html.buttonShuffleOff.addEventListener("click", function () {
    onButtonClicked("shuffle-off");
  });
  g_player.html.buttonRepeatAll = document.getElementById(
    "mp-button-repeat-all",
  );
  g_player.html.buttonRepeatAll.addEventListener("click", function () {
    onButtonClicked("repeat-all");
  });
  g_player.html.buttonRepeatOff = document.getElementById(
    "mp-button-repeat-off",
  );
  g_player.html.buttonRepeatOff.addEventListener("click", function () {
    onButtonClicked("repeat-off");
  });
  g_player.html.buttonRepeat1 = document.getElementById("mp-button-repeat-1");
  g_player.html.buttonRepeat1.addEventListener("click", function () {
    onButtonClicked("repeat-1");
  });

  g_player.html.buttonClear = document.getElementById("mp-button-clear");
  g_player.html.buttonClear.addEventListener("click", function () {
    onButtonClicked("clear");
  });
  g_player.html.buttonAdd = document.getElementById("mp-button-add");
  g_player.html.buttonAdd.addEventListener("click", function () {
    onButtonClicked("add");
  });
  g_player.html.buttonDelete = document.getElementById("mp-button-delete");
  g_player.html.buttonDelete.addEventListener("click", function () {
    onButtonClicked("delete");
  });
  g_player.html.buttonSave = document.getElementById("mp-button-save");
  g_player.html.buttonSave.addEventListener("click", function () {
    onButtonClicked("save-playlist");
  });
  g_player.html.buttonClosePlaylist = document.getElementById(
    "mp-button-close-playlist",
  );
  g_player.html.buttonClosePlaylist.addEventListener("click", function () {
    onButtonClicked("close-playlist");
  });
  g_player.html.buttonCloseVideoArea = document.getElementById(
    "mp-video-close-button",
  );
  g_player.html.buttonCloseVideoArea.addEventListener("click", function () {
    onButtonClicked("close-videoarea");
  });
  g_player.html.buttonCloseSpectrum = document.getElementById(
    "mp-spectrum-close-button",
  );
  g_player.html.buttonCloseSpectrum.addEventListener("click", function () {
    onButtonClicked("close-spectrum");
  });

  g_player.html.videoTitleDiv = document.getElementById("mp-video-title");
  g_player.html.spectrumTitleDiv = document.getElementById("mp-spectrum-title");

  //////

  g_player.html.videoDiv = document.getElementById("mp-video-div");
  g_player.html.videoLoadingDiv = document.getElementById(
    "mp-html-video-loading-div",
  );

  g_player.html.spectrumDiv = document.getElementById("mp-spectrum-div");

  // stop wheel scroll from propagating through the player
  g_player.html.divPlaylist.addEventListener("wheel", function (event) {
    event.stopPropagation();
  });
  document
    .getElementById("mp-div-topbar")
    .addEventListener("wheel", function (event) {
      event.stopPropagation();
    });

  // Hide Show Topbar on mouse move if full size
  g_player.html.playerDiv = document.getElementById("media-player-container");
  g_player.html.topBar = document.getElementById("mp-div-topbar");
  g_player.html.topBarShowTimeOut;
  g_player.html.isHoveringTopBar = false;

  function showTopBar() {
    g_player.html.topBar.style.opacity = "1";
    g_player.html.topBar.style.visibility = "visible";
    g_player.html.videoTitleDiv.classList.remove("set-display-none");
    g_player.html.spectrumTitleDiv.classList.remove("set-display-none");
  }

  function hideTopBar() {
    if (g_settings.fullView && !g_player.html.isHoveringTopBar) {
      g_player.html.topBar.style.opacity = "0";
      g_player.html.topBar.style.visibility = "hidden";
      g_player.html.videoTitleDiv.classList.add("set-display-none");
      g_player.html.spectrumTitleDiv.classList.add("set-display-none");
    }
  }

  g_player.html.playerDiv.addEventListener("mousemove", () => {
    showTopBar();
    clearTimeout(g_player.html.topBarShowTimeOut);
    if (g_settings.fullView && !g_player.html.isHoveringTopBar) {
      g_player.html.topBarShowTimeOut = setTimeout(hideTopBar, 3000);
    }
  });

  g_player.html.topBar.addEventListener("mouseenter", () => {
    g_player.html.isHoveringTopBar = true;
    clearTimeout(g_player.html.topBarShowTimeOut);
    showTopBar();
  });

  g_player.html.topBar.addEventListener("mouseleave", () => {
    g_player.html.isHoveringTopBar = false;
    if (g_settings.fullView) {
      clearTimeout(g_player.html.topBarShowTimeOut);
      g_player.html.topBarShowTimeOut = setTimeout(hideTopBar, 5000);
    }
  });

  // slider Time ///////////
  function updateTimeStatusText() {
    const slider = g_player.html.sliderTime;
    const statusT = g_player.html.sliderTimeStatusOverlay;

    if (slider && statusT) {
      const maxSeconds = parseFloat(slider.max) || 0;
      const currentSeconds = parseFloat(slider.value) || 0;

      const formattedCurrent =
        playlist.getFormatedTimeFromSeconds(currentSeconds);
      const formattedTotal = playlist.getFormatedTimeFromSeconds(maxSeconds);

      statusT.textContent = formattedCurrent + " / " + formattedTotal;
    }
  }
  g_player.html.updateTimeStatusText = updateTimeStatusText;

  g_player.html.sliderTime = document.getElementById("mp-slider-time");

  const style = getComputedStyle(document.documentElement);
  const rawValue = style.getPropertyValue("--mp-slider-thumb-width").trim();
  g_player.html.sliderThumbWidth = parseInt(rawValue, 10);

  g_player.html.sliderTime.addEventListener("input", function () {
    onSliderTimeChanged(g_player.html.sliderTime);
  });

  g_player.html.sliderTimeHoverTooltip = document.getElementById(
    "mp-slider-time-hover-tooltip",
  );
  g_player.html.sliderTimeStatusOverlay = document.getElementById(
    "mp-slider-time-status-overlay",
  );

  g_player.html.sliderTime.addEventListener("mousemove", (event) => {
    const slider = g_player.html.sliderTime;
    const hoveredSeconds = getSliderValueAtMouse(slider, event);

    const formattedHover = playlist.getFormatedTimeFromSeconds(hoveredSeconds);
    const hoverT = g_player.html.sliderTimeHoverTooltip;
    hoverT.textContent = formattedHover;
    hoverT.style.display = "block";

    const rect = slider.getBoundingClientRect();
    hoverT.style.left = event.clientX - rect.left + "px";

    updateTimeStatusText();
    g_player.html.sliderTimeStatusOverlay.style.display = "block";
  });

  g_player.html.sliderTime.addEventListener("mouseleave", () => {
    g_player.html.sliderTimeHoverTooltip.style.display = "none";
    g_player.html.sliderTimeStatusOverlay.style.display = "none";
  });

  // slider volume///////////////////

  function updateVolumeStatusText() {
    const slider = g_player.html.sliderVolume;
    const statusT = g_player.html.sliderVolumeStatusOverlay;
    if (slider && statusT) {
      const currentVal = parseFloat(slider.value) || 0;
      statusT.textContent = Math.floor(currentVal) + "%";
    }
  }
  g_player.html.updateVolumeStatusText = updateVolumeStatusText;

  g_player.html.sliderVolume = document.getElementById("mp-slider-volume");

  g_player.html.sliderVolume.addEventListener("input", function () {
    onSliderVolumeChanged(g_player.html.sliderVolume);
  });

  g_player.html.sliderVolume.addEventListener("change", function () {
    refreshUI();
  });

  g_player.html.sliderVolumeHoverTooltip = document.getElementById(
    "mp-slider-volume-hover-tooltip",
  );
  g_player.html.sliderVolumeStatusOverlay = document.getElementById(
    "mp-slider-volume-status-overlay",
  );

  g_player.html.sliderVolume.addEventListener("mousemove", (event) => {
    const slider = g_player.html.sliderVolume;
    const hoveredVal = getSliderValueAtMouse(slider, event);

    const hoverT = g_player.html.sliderVolumeHoverTooltip;
    hoverT.textContent = Math.round(hoveredVal) + "%";
    hoverT.style.display = "block";

    const rect = slider.getBoundingClientRect();
    hoverT.style.left = event.clientX - rect.left + "px";

    updateVolumeStatusText();
    g_player.html.sliderVolumeStatusOverlay.style.display = "block";
  });

  g_player.html.sliderVolume.addEventListener("mouseleave", () => {
    g_player.html.sliderVolumeHoverTooltip.style.display = "none";
    g_player.html.sliderVolumeStatusOverlay.style.display = "none";
  });
}

function onSliderTimeChanged(slider) {
  const targetSecond = parseFloat(slider.value);
  setTime(targetSecond);
}

function getSliderValueAtMouse(slider, event) {
  const rect = slider.getBoundingClientRect();
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const step = parseFloat(slider.step) || 1;

  const thumbWidth = g_player.html.sliderThumbWidth;
  const activeWidth = rect.width - thumbWidth;
  let x = event.clientX - rect.left - thumbWidth / 2;
  x = Math.max(0, Math.min(x, activeWidth));
  const percent = x / activeWidth;
  const rawValue = min + (max - min) * percent;

  return Math.round(rawValue / step) * step;
}

function onSliderVolumeChanged(slider) {
  g_player.engine.volume = parseFloat(slider.value) / 100;
  g_player.html.updateVolumeStatusText();
  if (g_player.engineType === PlayerEngineType.YOUTUBE) {
    yt.updateVolume(g_player.engine.volume);
  }
}

function refreshUI() {
  let trackTitle;
  const track = playlist.getTrack(g_player.trackIndex);
  if (
    track !== undefined &&
    playlist.getPlaylist().files.length > track.fileIndex
  ) {
    const file = playlist.getPlaylist().files[track.fileIndex];
    let fullName;
    if (file.title && file.artist) {
      fullName = `${file.title} - ${file.artist}`;
    } else if (file.title) {
      fullName = `${file.title}`;
    }
    trackTitle = fullName ?? file.url;
    if (
      !trackTitle.startsWith("http://") &&
      !trackTitle.startsWith("https://")
    ) {
      trackTitle = trackTitle.split(/[\\/]/).pop();
    }
  }
  g_player.html.videoTitleDiv.innerText = trackTitle ?? "";
  g_player.html.spectrumTitleDiv.innerText = trackTitle ?? "";

  if (g_settings.fullView) {
    g_player.html.playerDiv.classList.add("mp-layout-fullscreen");
    document.documentElement.style.setProperty("--mp-frame-width", `500px`);
  } else {
    g_player.html.playerDiv.classList.remove("mp-layout-fullscreen");
    g_player.html.topBar.style.opacity = "1";
    g_player.html.topBar.style.visibility = "visible";
    if (g_settings.size === 0) {
      document.documentElement.style.setProperty("--mp-frame-width", `300px`);
    } else if (g_settings.size === 1) {
      document.documentElement.style.setProperty("--mp-frame-width", `500px`);
    }
  }

  if (
    (g_settings.fullView || g_settings.showSpectrum) &&
    g_player.mediaType === PlayerMediaType.AUDIO
  ) {
    g_player.html.spectrumDiv.classList.remove("set-display-none");
  } else {
    g_player.html.spectrumDiv.classList.add("set-display-none");
  }

  if (
    (g_settings.fullView &&
      g_player.html.spectrumDiv.classList.contains("set-display-none")) ||
    (g_settings.showVideo && g_player.mediaType === PlayerMediaType.VIDEO)
  ) {
    g_player.html.videoDiv.classList.remove("set-display-none");
  } else {
    g_player.html.videoDiv.classList.add("set-display-none");
  }

  if (playlist.getTracks().length > 0) {
    if (
      g_player.trackIndex !== undefined &&
      g_player.state !== PlayerState.LOADING
    ) {
      g_player.html.buttonPlay.classList.remove("mp-disabled");
      g_player.html.buttonPause.classList.remove("mp-disabled");
    } else {
      g_player.html.buttonPlay.classList.add("mp-disabled");
      g_player.html.buttonPause.classList.add("mp-disabled");
    }

    if (g_player.state === PlayerState.LOADING) {
      if (
        g_player.engineType === PlayerEngineType.FFMPEG ||
        g_player.mediaType === PlayerMediaType.VIDEO ||
        g_player.engineType === PlayerEngineType.YOUTUBE
      ) {
        g_player.html.videoLoadingDiv.classList.remove("set-display-none");
      } else {
        g_player.html.videoLoadingDiv.classList.add("set-display-none");
      }
    } else {
      g_player.html.videoLoadingDiv.classList.add("set-display-none");
    }

    if (g_player.state === PlayerState.PLAYING) {
      g_player.html.buttonPlay.classList.add("set-display-none");
      g_player.html.buttonPause.classList.remove("set-display-none");
    } else {
      g_player.html.buttonPlay.classList.remove("set-display-none");
      g_player.html.buttonPause.classList.add("set-display-none");
    }

    if (g_settings.repeat === 2 || playlist.getCurrentTrackIndex() > 0) {
      g_player.html.buttonPrev.classList.remove("mp-disabled");
    } else {
      g_player.html.buttonPrev.classList.add("mp-disabled");
    }
    if (
      g_settings.repeat === 2 ||
      playlist.getTracks().length - 1 > playlist.getCurrentTrackIndex()
    ) {
      g_player.html.buttonNext.classList.remove("mp-disabled");
    } else {
      g_player.html.buttonNext.classList.add("mp-disabled");
    }
  } else {
    g_player.html.buttonPlay.classList.remove("set-display-none");
    g_player.html.buttonPlay.classList.add("mp-disabled");
    g_player.html.buttonPause.classList.add("set-display-none");
    g_player.html.buttonPrev.classList.add("mp-disabled");
    g_player.html.buttonNext.classList.add("mp-disabled");

    g_player.html.videoLoadingDiv.classList.add("set-display-none");
    g_player.html.videoDiv.classList.add("set-display-none");
  }

  if (!g_settings.muted) {
    g_player.html.buttonVolumeOn.classList.add("mp-hidden");
    g_player.html.buttonVolumeOff.classList.remove("mp-hidden");
    g_player.html.sliderVolume.classList.remove("mp-disabled");
  } else {
    g_player.html.buttonVolumeOn.classList.remove("mp-hidden");
    g_player.html.buttonVolumeOff.classList.add("mp-hidden");
    g_player.html.sliderVolume.classList.add("mp-disabled");
  }

  if (g_settings.shuffle === 1) {
    g_player.html.buttonShuffleOff.classList.add("mp-hidden");
    g_player.html.buttonShuffleOn.classList.remove("mp-hidden");
  } else {
    g_player.html.buttonShuffleOff.classList.remove("mp-hidden");
    g_player.html.buttonShuffleOn.classList.add("mp-hidden");
  }

  if (g_settings.repeat === 0) {
    g_player.html.buttonRepeatOff.classList.remove("mp-hidden");
    g_player.html.buttonRepeatAll.classList.add("mp-hidden");
    g_player.html.buttonRepeat1.classList.add("mp-hidden");
  } else if (g_settings.repeat === 1) {
    g_player.html.buttonRepeatOff.classList.add("mp-hidden");
    g_player.html.buttonRepeatAll.classList.add("mp-hidden");
    g_player.html.buttonRepeat1.classList.remove("mp-hidden");
  } else if (g_settings.repeat === 2) {
    g_player.html.buttonRepeatOff.classList.add("mp-hidden");
    g_player.html.buttonRepeatAll.classList.remove("mp-hidden");
    g_player.html.buttonRepeat1.classList.add("mp-hidden");
  }

  if (playlist.getTracks().length > 0) {
    g_player.html.buttonClear.classList.remove("mp-disabled");
    g_player.html.buttonSave.classList.remove("mp-disabled");
  } else {
    g_player.html.buttonClear.classList.add("mp-disabled");
    g_player.html.buttonSave.classList.add("mp-disabled");
  }
  if (
    playlist.getTracks().length > 0 &&
    playlist.getSelectedTrackFileIndex() !== undefined
  ) {
    g_player.html.buttonDelete.classList.remove("mp-disabled");
  } else {
    g_player.html.buttonDelete.classList.add("mp-disabled");
  }
  playlist.updatePlaylistInfo();
}

function onButtonClicked(buttonName) {
  if (buttonName === "play") {
    onPlay();
  } else if (buttonName === "pause") {
    onPause();
  } else if (buttonName === "prev") {
    onPrevTrack();
  } else if (buttonName === "next") {
    onNextTrack();
  } else if (buttonName === "open") {
    sendIpcToMain("on-open-clicked", 0);
  } else if (buttonName === "volume-off") {
    g_settings.muted = true;
    g_player.engine.muted = true;
  } else if (buttonName === "volume-on") {
    g_settings.muted = false;
    g_player.engine.muted = false;
  } else if (buttonName === "settings") {
    sendIpcToMain(
      "show-button-menu",
      "settings",
      g_player.html.buttonSettings.getBoundingClientRect(),
      getContextMenuData(),
    );
  }
  // else if (buttonName === "close") {
  //   sendIpcToMain("close");
  // }
  // playlist
  // NOTE: suffle and repeat are a bit different in meaning (on, off, 1)
  // they are meant to signify the actual state, not the desired action
  else if (buttonName === "shuffle-on") {
    onSetShuffleMode(0);
  } else if (buttonName === "shuffle-off") {
    onSetShuffleMode(1);
  }
  //
  else if (buttonName === "repeat-off") {
    onSetRepeatMode(1);
  } else if (buttonName === "repeat-1") {
    onSetRepeatMode(2);
  } else if (buttonName === "repeat-all") {
    onSetRepeatMode(0);
  }
  //
  else if (buttonName === "clear") {
    if (playlist.getTracks().length <= 0) return;
    playlist.getPlaylist().files = [];
    playlist.setTracks([]);
    playlist.setSelectedTrackFileIndex(undefined);
    onPause();
  } else if (buttonName === "add") {
    sendIpcToMain("on-open-clicked", 1);
  } else if (buttonName === "delete") {
    if (
      playlist.getTracks().length <= 0 ||
      playlist.getSelectedTrackFileIndex() === undefined
    )
      return;
    let currentTrackFileIndex = playlist.getCurrentTrackFileIndex();
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
      onPause();
      clearPlayer();
      if (playlist.getCurrentTrackIndex() < playlist.getTracks().length) {
        if (g_player.state === PlayerState.PLAYING) {
          onPlay(playlist.getCurrentTrackIndex(), 0);
        } else {
          g_player.trackIndex = playlist.getCurrentTrackIndex();
        }
      } else {
        // the deleted one was the last
        onPause();
        playlist.setCurrentTrackIndex(playlist.getTracks().length - 1);
        if (playlist.getTracks().length > 0) {
          g_player.trackIndex = playlist.getTracks().length - 1;
        }
      }
    } else {
      if (playlist.getCurrentTrackIndex() < selectedTrackIndex) {
        // keep the same
      } else {
        playlist.setCurrentTrackIndex(playlist.getCurrentTrackIndex() - 1);
      }
    }
    if (playlist.getTracks().length > 0) {
      playlist.setSelectedTrackFileIndex(playlist.getCurrentTrackFileIndex());
    } else {
      playlist.setSelectedTrackFileIndex(undefined);
    }
    playlist.updatePlaylistInfo();
  } else if (buttonName === "save-playlist") {
    if (playlist.getPlaylist().files.length > 0)
      sendIpcToMain("save-playlist", playlist.getPlaylist());
  } else if (buttonName === "close-playlist") {
    showPlaylist(false);
  } else if (buttonName === "close-videoarea") {
    g_settings.showVideo = false;
  } else if (buttonName === "close-spectrum") {
    g_settings.showSpectrum = false;
  }
  //////
  refreshUI();
}

function getContextMenuData() {
  return {
    settings: g_settings,
    buttonStates: getButtonStates(),
    playlist: playlist.getPlaylist(),
    currentFileIndex: playlist.getCurrentTrackFileIndex(),
  };
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

export function initIpc() {
  initOnIpcCallbacks();
}

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

  on("init", (...args) => {
    onInit(...args);
  });

  on("show", (isVisible, elementId) => {
    if (isVisible) {
      document.getElementById(elementId).classList.remove("mp-hidden");
    } else {
      document.getElementById(elementId).classList.add("mp-hidden");
    }
  });

  on("open-playlist", (newPlaylist) => {
    onPause();
    playlist.openPlaylist(newPlaylist);
    onPlay(playlist.getCurrentTrackIndex(), 0);
  });

  on("add-to-playlist", (...args) => {
    const trackIndex = playlist.addToPlaylist(...args);
    if (trackIndex !== undefined) {
      onPlay(trackIndex, 0);
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

  on("on-context-menu", (...args) => {
    switch (args[0]) {
      case "play-track":
        onPlaylistTrackDoubleClicked(args[1]);
        break;

      case "toggle-playlist":
        showPlaylist(!g_settings.showPlaylist);
        break;

      case "toggle-video":
        g_settings.showVideo = !g_settings.showVideo;
        refreshUI();
        break;

      case "toggle-spectrum":
        showSpectrumVisualizer(!g_settings.showSpectrum);
        refreshUI();
        break;

      case "hide":
        sendIpcToMain("close");
        break;

      case "hide":
        sendIpcToMain("close");
        break;

      case "open-files":
        sendIpcToMain("on-open-file-clicked", 0);
        break;

      case "set-size":
        g_settings.size = args[1];
        refreshUI();
        break;

      case "toggle-fullview":
        g_settings.fullView = !g_settings.fullView;
        refreshUI();
        break;

      case "set-repeat":
        onSetRepeatMode(args[1]);
        refreshUI();
        break;

      case "toggle-shuffle":
        onSetShuffleMode(g_settings.shuffle === 0 ? 1 : 0);
        refreshUI();
        break;

      case "set-show-video":
        g_settings.showVideo = args[1];
        refreshUI();
        break;

      case "play":
        onPlay();
        refreshUI();
        break;

      case "pause":
        onPause();
        refreshUI();
        break;

      case "next":
        onNextTrack();
        refreshUI();
        break;

      case "prev":
        onPrevTrack();
        refreshUI();
        break;
    }
  });
}

function showPlaylist(show) {
  g_settings.showPlaylist = show;
  if (show) {
    g_player.html.divPlaylist.classList.remove("mp-hidden");
    g_settings.showPlaylist = true;
  } else {
    g_player.html.divPlaylist.classList.add("mp-hidden");
    g_settings.showPlaylist = false;
  }
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

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_clickTimer = null;

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
    case "onkeydown":
      if (event.key === " ") {
        if (g_settings.fullView) {
          event.preventDefault();
          if (g_player.state === PlayerState.PLAYING) onPause();
          else if (
            g_player.state === PlayerState.PAUSED ||
            g_player.state === PlayerState.NOT_SET
          )
            onPlay();
        }
      }
      break;
    case "mousemove":
      {
        onMouseMove();
      }
      break;
    case "click":
      {
        const videoCliked = event.target.closest("#mp-video-div");
        const spectrumCliked = event.target.closest("#mp-spectrum-div");
        if (videoCliked || spectrumCliked) {
          if (g_clickTimer) {
            clearTimeout(g_clickTimer);
            g_clickTimer = null;
            return;
          }

          g_clickTimer = setTimeout(() => {
            g_clickTimer = null;
            if (g_player.state === PlayerState.PLAYING) onPause();
            else if (
              g_player.state === PlayerState.PAUSED ||
              g_player.state === PlayerState.NOT_SET
            )
              onPlay();
          }, 250);

          return;
        }
      }
      break;
    case "dblclick":
      {
        const videoCliked = event.target.closest("#mp-video-div");
        const spectrumCliked = event.target.closest("#mp-spectrum-div");
        if (videoCliked || spectrumCliked) {
          clearTimeout(g_clickTimer);
          // 3 click zones
          const rect = (
            spectrumCliked ? g_player.html.spectrumDiv : g_player.html.videoDiv
          ).getBoundingClientRect();
          const x = event.clientX - rect.left;
          const width = rect.width;
          if (x < width * 0.25) {
            // left
            onRewind();
          } else if (x < width * 0.75) {
            // center
            g_settings.fullView = !g_settings.fullView;
            refreshUI();
          } else {
            // right
            onFastForward();
          }
          return;
        }
      }
      break;
    default:
      return false;
  }
}

let g_hideMouseCursor = true;
let g_mouseCursorTimer;
let g_isMouseCursorVisible = true;
let g_mouseCursorHideTime = 3000;

function onMouseMove() {
  if (!g_settings) return;
  if (g_mouseCursorTimer) {
    clearTimeout(g_mouseCursorTimer);
  }
  if (!g_isMouseCursorVisible) {
    document.querySelector("#mp-html-video").style.cursor = "default";
    if (document.querySelector("#mp-iframe-ytvideo"))
      document.querySelector("#mp-iframe-ytvideo").style.cursor = "default";
    document.querySelector("#mp-spectrum-div").style.cursor = "default";
    g_isMouseCursorVisible = true;
  }
  if (!g_settings.fullView) {
    document.querySelector("#mp-html-video").style.cursor = "default";
    if (document.querySelector("#mp-iframe-ytvideo"))
      document.querySelector("#mp-iframe-ytvideo").style.cursor = "default";
    document.querySelector("#mp-spectrum-div").style.cursor = "default";
    g_isMouseCursorVisible = true;
  } else if (g_hideMouseCursor) {
    g_mouseCursorTimer = setTimeout(() => {
      g_mouseCursorTimer = undefined;
      document.querySelector("#mp-html-video").style.cursor = "none";
      if (document.querySelector("#mp-iframe-ytvideo"))
        document.querySelector("#mp-iframe-ytvideo").style.cursor = "none";
      document.querySelector("#mp-spectrum-div").style.cursor = "none";
      g_isMouseCursorVisible = false;
    }, g_mouseCursorHideTime);
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
