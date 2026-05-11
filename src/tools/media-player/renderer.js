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
let g_isPlayerMode = false;

///////////////////////////////////////////////////////////////////////////////
// PLAYER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_player = { html: {} };

function setPlayerState(state, doUIRefresh = false) {
  // console.log("setPlayerState " + state);
  // console.trace("stack trace");
  if (g_player.html.loadingWatchdog) {
    clearTimeout(g_player.html.loadingWatchdog);
    g_player.html.loadingWatchdog = null;
  }

  if (state === PlayerState.LOADING) {
    const watchdogId = g_currentLoadId;
    g_player.html.loadingWatchdog = setTimeout(() => {
      if (
        g_player.state === PlayerState.LOADING &&
        watchdogId === g_currentLoadId
      ) {
        onError("NotSupportedError");
      }
    }, 18000);
  }

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
  addCurrentToHistory();

  g_currentLoadId++;
  g_player.lastCrashResumeAttempt = 0;
  g_player.hasFixedDuration = false;
  g_player.triedAutoloadingSubtitle = false;

  clearPlayerSubtitle();
  g_player.externalSubtitles = [];

  if (g_player.engine && g_player.engine.hasAttribute("src")) {
    g_player.engine.pause();
    g_player.engine.removeAttribute("src");
    g_player.engine.load(); // reset the engine's memory
    g_player.html.sliderTime.max = 0;
    g_player.html.sliderTime.value = 0;
  }

  setPlayerState(PlayerState.NOT_SET);
  g_player.mediaType = PlayerMediaType.NOT_SET;
  g_player.engineType = PlayerEngineType.NOT_SET;

  if (g_player.engine) {
    g_player.usingHsl = false;
    if (g_player.engine.hls) {
      g_player.engine.hls.detachMedia();
      g_player.engine.hls.destroy();
      g_player.engine.hls = null;
    }
  }
  sendIpcToMain("mp-ffmpeg-close-video");
  yt.destroyPlayer();

  if (g_player.trackIndex) playlist.setCurrentTrackIndex(g_player.trackIndex);
  else {
    setPlayerTrackIndex(playlist.getCurrentTrackIndex());
  }
  // playlist.scrollToCurrent();
  g_player.trackMetadata = undefined;
  g_player.trackHasVideoMetadata = undefined;

  clearTimeout(g_player.html.topBarShowTimeOut);
  g_player.html.topBarShowTimeOut = undefined;
  clearTimeout(g_player.html.restoreMuteTimeOut);
  g_player.html.restoreMuteTimeOut = undefined;
  clearTimeout(g_player.html.loadingWatchdog);
  g_player.html.loadingWatchdog = undefined;
}

function setPlayerTrackIndex(index) {
  g_player.trackIndex = index;
  const track = playlist.getTrack(index);
  const list = playlist.getPlaylist();
  if (
    track !== undefined &&
    list !== undefined &&
    list.files.length > track.fileIndex
  ) {
    const name = playlist.getFileFullname(list.files[track.fileIndex]);
    setTopBarTrackName(name, index + 1, list.files.length);
  } else {
    setTopBarTrackName("");
  }
}

function initPlayer() {
  clearPlayer();

  g_player.engine = document.getElementById("mp-html-video");

  // ref: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement

  g_player.engine.addEventListener("canplay", function () {
    if (
      g_player.engineType === PlayerEngineType.NATIVE ||
      g_player.engineType === PlayerEngineType.FFMPEG
      //   &&
      // g_player.state !== PlayerState.PAUSED
    ) {
      // NOTE: onPlaySucceded will check PlayerState.PAUSED
      onPlaySucceeded();
    }
  });

  function updateDurationData() {
    const hasFixedDuration =
      !g_player.usingHsl &&
      !(
        g_player.engine.duration === Infinity ||
        (g_player.engine.seekable.length > 0 &&
          g_player.engine.seekable.start(0) > 0)
      );
    if (hasFixedDuration !== g_player.hasFixedDuration) {
      g_player.hasFixedDuration = hasFixedDuration;
      refreshUI();
    }
    ///
    if (
      // g_player.mediaType === PlayerMediaType.AUDIO &&
      !g_player.hasFixedDuration
    ) {
      playlist.updateTrackFileTags(
        g_player.trackIndex,
        undefined,
        undefined,
        -1,
      );
    } else if (
      g_player.trackIndex !== undefined &&
      g_player.engineType === PlayerEngineType.NATIVE
    ) {
      const duration = g_player.engine.duration;
      if (Number.isFinite(duration) && duration > 0) {
        const fileIndex = playlist.getTracks()[g_player.trackIndex].fileIndex;
        const file = playlist.getPlaylist().files[fileIndex];
        if (file.duration !== g_player.engine.duration) {
          if (file.url.endsWith(".m3u8")) return;
          playlist.updateTrackFileTags(
            g_player.trackIndex,
            undefined,
            undefined,
            g_player.engine.duration,
          );
        }
      }
    }
  }

  g_player.engine.addEventListener("durationchange", function () {
    updateDurationData();
  });

  g_player.engine.addEventListener("error", (error) => {
    // ref: https://developer.mozilla.org/en-US/docs/Web/API/MediaError/message
    const engineError = g_player.engine.error;
    if (!engineError) return;
    if (
      g_player.engineType === PlayerEngineType.NATIVE &&
      g_player.state === PlayerState.LOADING
    ) {
      if (engineError.code === MediaError.MEDIA_ERR_NETWORK) {
        if (g_player.state === PlayerState.LOADING) {
          onError("NotSupportedError");
        }
      }
    } else if (
      g_player.engineType === PlayerEngineType.NATIVE &&
      g_player.state === PlayerState.PLAYING
    ) {
      if (
        engineError.code === MediaError.MEDIA_ERR_NETWORK ||
        engineError.code === MediaError.MEDIA_ERR_DECODE
      ) {
        onError("NotSupportedError");
      }
    }
  });

  g_player.engine.addEventListener("timeupdate", function () {
    if (g_player.html.sliderTimeIsSeeking) return;
    updateSubtitleUI(g_player.engine.currentTime);
    if (g_player.engineType === PlayerEngineType.FFMPEG) {
      ffmpeg.onSliderTimeUpdate(g_player.engine, g_player.html.sliderTime);
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
    updateTimeUI();
  });

  g_player.engine.addEventListener("volumechange", function () {
    g_player.html.sliderVolume.value = getVolumeExponentialFromLinear(
      g_player.engine.volume,
    );
  });

  g_player.engine.addEventListener("loadedmetadata", async () => {
    if (g_player.engine.videoWidth > 0 || g_player.trackHasVideoMetadata) {
      g_player.mediaType = PlayerMediaType.VIDEO;
    } else {
      g_player.mediaType = PlayerMediaType.AUDIO;
    }
    updateDurationData();
  });

  g_player.engine.addEventListener("loadeddata", function () {
    // if (playlist.getTracks().length <= 0) return;
    // let fileIndex = playlist.getCurrentTrackFileIndex();
    // if (
    //   !playlist.getPlaylist().files[fileIndex].duration ||
    //   playlist.getPlaylist().files[fileIndex].duration == -1
    // ) {
    //   if (playlist.getPlaylist().files[fileIndex].url.endsWith(".m3u8")) return;
    //   playlist.getPlaylist().files[fileIndex].duration =
    //     g_player.engine.duration;
    //   playlist.updatePlaylistInfo();
    // }
    updateDurationData();
  });

  // g_player.engine.addEventListener('seeked', () => {
  // });

  g_player.engine.addEventListener("stalled", () => {
    console.warn("[Media Player] network stalled. ffmpeg might be hanging.");
  });

  g_player.engine.addEventListener("waiting", () => {
    // console.log("[Media Player] buffering... waiting for data.");
  });

  g_player.engine.addEventListener("ended", function () {
    if (g_player.engineType === PlayerEngineType.FFMPEG) {
      // NOTE: only tries once if attempting to repeat again too close in
      // time, to prevent files with multiple tracks with different duration
      // making the resume code go into an infinite loop of retries
      const now = Date.now();
      const currentPos =
        g_player.engine.currentTime + (ffmpeg.getTimeOffset() || 0);
      const totalDuration = g_player.trackMetadata?.duration || 0;
      const diff = Math.abs(totalDuration - currentPos);
      if (g_player.lastCrashResumeAttempt === undefined) {
        g_player.lastCrashResumeAttempt = 0;
      }
      if (diff > 5 && now - g_player.lastCrashResumeAttempt > 5000) {
        console.warn(
          "[ffmpeg] potential crash, attempting resume at:",
          currentPos,
        );
        g_player.lastCrashResumeAttempt = now;
        const resumeTime = Math.floor(currentPos);
        setTime(resumeTime, PlayerState.PLAYING);
        return;
      }
    }
    // normal end
    onEnded();
  });
}

///////////////////////////////////////////////////////////////////////////////
// BASE ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function onInit(settings, loadedPlaylist, isPlayerMode) {
  try {
    g_isPlayerMode = isPlayerMode;
    // load css ////
    await loadStylesheet("../../tools/media-player/html/style.css");

    // init UI ////
    initUI();

    // init player ////
    initPlayer();
    ffmpeg.init(setPlayerState, sendIpcToMain, onError);
    yt.init(onError, updateTimeUI);

    // console.log(await ffmpeg.getNativeCapabilities());

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
      setPlayerTrackIndex(loadTrackIndex);
      g_player.pendingTime = g_settings.currentTime;
      g_player.html.sliderTime.max = g_settings.currentDuration;
      g_player.html.sliderTime.value = g_player.pendingTime;
    }

    g_player.engine.muted = g_settings.muted;
    g_player.engine.volume = g_settings.volume;
    g_player.html.sliderVolume.value = getVolumeExponentialFromLinear(
      g_settings.volume,
    );

    showAdvancedControls(g_settings.showAdvancedControls);
    showPlaylist(g_settings.showPlaylist);
    showSpectrumVisualizer(g_settings.showSpectrum);

    setSubtitleHighContrastMode(g_settings.subtitleHighContrastMode);
    setSubtitleFontSize(g_settings.subtitleFontSize);

    ////////////////
    refreshUI();
    setTimeout(playlist.scrollToCurrent, 100);
  } catch (error) {
    console.log(error);
  }
}

function onSaveAndQuitRequested() {
  let historyData;
  try {
    // settings
    g_settings.volume = g_player.engine.volume;
    if (playlist.getTracks().length > 0)
      g_settings.currentFileIndex = playlist.getCurrentTrackFileIndex();
    else g_settings.currentFileIndex = undefined;
    g_settings.currentTime = parseInt(g_player.html.sliderTime.value);
    g_settings.currentDuration = parseInt(g_player.html.sliderTime.max);
    // history
    if (
      g_player.trackIndex !== undefined &&
      g_player.trackIndex === playlist.getCurrentTrackIndex()
    ) {
      const fileIndex = playlist.getCurrentTrackFileIndex();
      if (fileIndex === undefined) return;
      const file = playlist.getPlaylist().files[fileIndex];
      if (file === undefined) return;
      historyData = {
        url: file.url,
        currentTime: g_player.html.sliderTime.value,
        totalTime: g_player.html.sliderTime.max,
      };
    }
  } catch (error) {
  } finally {
    sendIpcToMain(
      "save-on-quit",
      g_settings,
      playlist.getPlaylist(),
      historyData,
    );
  }
}

function addCurrentToHistory() {
  try {
    if (
      g_player.trackIndex !== undefined &&
      g_player.trackIndex === playlist.getCurrentTrackIndex()
    ) {
      const fileIndex = playlist.getCurrentTrackFileIndex();
      const file = playlist.getPlaylist().files[fileIndex];
      sendIpcToMain(
        "add-to-history",
        file,
        g_player.html.sliderTime.value,
        g_player.html.sliderTime.max,
      );
    }
  } catch (error) {}
}

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
        await g_player.engine.play().catch(() => {});
        setPlayerState(PlayerState.PLAYING);
        refreshUI();
        playlist.scrollToCurrent();
        return;
      } else if (g_player.engineType === PlayerEngineType.YOUTUBE) {
        if (yt.onPlay()) {
          setPlayerState(PlayerState.PLAYING);
          refreshUI();
          playlist.scrollToCurrent();
        }
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
    setPlayerTrackIndex(trackIndex);
    playlist.setSelectedTrackFileIndex(
      playlist.getTracks()[trackIndex].fileIndex,
    );
    const loadId = ++g_currentLoadId;
    const wasMuted = g_player.engine.muted;
    setPlayerState(PlayerState.LOADING);
    try {
      if (
        g_ffmpegAvailable &&
        !playlist.getTracks()[trackIndex].fileUrl.startsWith("http")
      ) {
        // I skip getting the metadata for all urls
        // TODO: maybe also do it for urls with video extension?
        g_player.trackMetadata = await sendIpcToMainAndWait(
          "mp-get-file-metadata-complete",
          decodeURI(playlist.getTracks()[trackIndex].fileUrl),
        );
        // console.log(g_player.trackMetadata);
      } else {
        g_player.trackMetadata = undefined;
      }

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
          try {
            g_player.engine.hls.loadSource(
              playlist.getTracks()[trackIndex].fileUrl,
            );
            g_player.html.sliderTime.value = 0;
            g_player.engine.currentTime = 0;
            g_player.engineType = PlayerEngineType.NATIVE;
            await g_player.engine.play();
          } catch (error) {
            if (error.name?.includes("AbortError")) return;
            console.log("[Media Player] hls play failed:", error);
            onError(error);
          }
        });
        // ref: https://github.com/video-dev/hls.js/blob/master/docs/API.md#fatal-error-recovery
        g_player.engine.hls.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            const currentSrc = g_player.engine.getAttribute("src");
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
                if (!currentSrc || currentSrc === "") return;
                onError("NotSupportedError");
                break;
              default:
                if (!currentSrc || currentSrc === "") return;
                onError("NotSupportedError");
                break;
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
            g_settings.muted ? 0 : g_player.engine.volume,
            refreshUI,
            playlist.updateCurrentFileTags,
            onPlaySucceeded,
            onEnded,
          );
        } else {
          // NATIVE
          g_player.engine.muted = true;
          g_player.engineType = PlayerEngineType.NATIVE;

          // check metadata ////
          if (g_player.trackMetadata && g_player.trackMetadata.hasVideo) {
            g_player.trackHasVideoMetadata = true;

            const metadata = g_player.trackMetadata;
            const fileUrl = playlist
              .getTracks()
              [trackIndex].fileUrl.toLowerCase();
            const badAudioCodecs = ["ac3", "dts", "eac3", "truehd"];
            const heavyContainers = ["matroska", "avi", "flv", "mov", "wmv"];
            const riskyExtensions = [".mkv", ".avi", ".flv", ".mov", ".wmv"];

            let useFFmpeg = false;

            if (metadata.usedFFprobe) {
              const hasBadAudio = metadata.audioCodecs.some((c) =>
                badAudioCodecs.includes(c),
              );
              const isHeavyContainer = heavyContainers.some((c) =>
                metadata.container.includes(c),
              );

              if (hasBadAudio || isHeavyContainer) {
                useFFmpeg = true;
              }
            } else {
              // fallback
              const hasRiskyExt = riskyExtensions.some((ext) =>
                fileUrl.endsWith(ext),
              );
              if (hasRiskyExt) {
                useFFmpeg = true;
              }
            }
            if (useFFmpeg) {
              throw new Error("NotSupportedError");
            }
          }
          //////
          await g_player.engine.play();
          await new Promise((r) => setTimeout(r, 250));
          if (loadId !== g_currentLoadId) return;
          if (
            g_player.engine.videoWidth === 0 &&
            g_player.engine.webkitVideoDecodedByteCount === 0
          ) {
            if (loadId !== g_currentLoadId) return;
            if (g_player.trackMetadata && g_player.trackMetadata.hasVideo) {
              throw new Error("NotSupportedError");
            }
          }
          g_player.engine.muted = wasMuted;
        }
      }
    } catch (error) {
      g_player.engine.muted = wasMuted;
      if (error.name === "AbortError") {
        return;
      }
      if (
        error.name?.includes("NotSupportedError") ||
        error.message?.includes("NotSupportedError")
      ) {
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
          if (g_player.trackMetadata && g_player.trackMetadata.duration) {
            const fileIndex = playlist.getTracks()[trackIndex].fileIndex;
            const file = playlist.getPlaylist().files[fileIndex];
            if (file.duration !== g_player.trackMetadata.duration) {
              playlist.updateTrackFileTags(
                trackIndex,
                undefined,
                undefined,
                g_player.trackMetadata.duration,
              );
            }
          }
          sendIpcToMain(
            "mp-ffmpeg-load-video",
            playlist.getTracks()[trackIndex].fileUrl,
            time,
            g_player.trackMetadata,
          );
        } else {
          onError(error);
        }
      } else if (error.name === "AbortError") {
        return;
      } else {
        onError(error);
      }
    }
    //////
    refreshUI();
    // playlist.scrollToCurrent();
  } catch (error) {
    // TODO
  }
}

function onPlaySucceeded() {
  if (g_player.mediaType === PlayerMediaType.AUDIO && g_settings.fullView) {
    // just to make sure the sprectrum visualizer is on
    setFullView(g_settings.fullView);
  }
  if (g_player.engineType === PlayerEngineType.YOUTUBE) {
    g_player.hasFixedDuration = true;
  }
  ///////
  if (g_player.state === PlayerState.PAUSED) {
    // HACK: I set PAUSED in startStream in ffmpeg when comming from a seek
    // that was paused before doing it,to be able to know I shouldn't resume
    // playing.
    // TODO: find a better way to handle that.
  } else {
    setPlayerState(PlayerState.PLAYING);
  }
  playlist.setCurrentTrackIndex(g_player.trackIndex);
  refreshUI();
  playlist.scrollToCurrent();
  addCurrentToHistory();
  ///////
  if (
    !g_player.triedAutoloadingSubtitle &&
    g_player.engineType !== PlayerEngineType.YOUTUBE &&
    g_player.mediaType === PlayerMediaType.VIDEO
  ) {
    try {
      g_player.triedAutoloadingSubtitle = true;
      if (!playlist.getTracks()[g_player.trackIndex].fileUrl.startsWith("http"))
        sendIpcToMain(
          "load-subtitle-if-same-name",
          playlist.getTracks()[g_player.trackIndex].fileUrl,
        );
    } catch (error) {}
  }
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

async function onStop() {
  if (g_player.state !== PlayerState.NOT_SET) {
    clearPlayer();
    refreshUI();
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
    ffmpeg.setTime(
      targetSecond,
      g_player.state,
      g_player.trackMetadata.audioIndex,
      g_player.trackMetadata.videoIndex,
    );
  } else if (g_player.engineType === PlayerEngineType.YOUTUBE) {
    yt.setTime(targetSecond);
  } else if (!g_player.usingHsl) {
    if (g_player.engine.duration != Infinity) {
      g_player.engine.currentTime = targetSecond;
    }
  }
  g_player.html.sliderTime.value = targetSecond;
  updateTimeUI();
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
  setPlayerTrackIndex(playlist.getCurrentTrackIndex());
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
      setPlayerTrackIndex(0);
      playlist.setCurrentTrackIndex(0);
    }
  }
  playlist.scrollToCurrent();
  refreshUI();
}

//////

function onError(error) {
  const errorString = error?.message || error?.toString() || "Unknown Error";
  console.log("[Media Player] " + errorString);
  if (errorString.includes("NotSupportedError")) {
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

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function takeVideoScreenshot() {
  try {
    const videoElement = g_player.engine;
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    // const dataUrl = canvas.toDataURL("image/jpg");
    // const link = document.createElement("a");
    // link.href = dataUrl;
    // link.download = "screenshot.jpg";
    // link.click();
    //
    let blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    let arrayBuffer = await blob.arrayBuffer();
    let buffer = new Uint8Array(arrayBuffer);
    sendIpcToMain("save-screenshot", buffer);
  } catch (error) {
    // console.log(error);
  }
}

///////////////////////////////////////////////////////////////////////////////
// SUBTITLES //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function clearPlayerSubtitle() {
  g_player.subtitle = undefined;
  if (g_player?.html?.videoSubtitleDiv)
    g_player.html.videoSubtitleDiv.innerHTML = "&nbsp;";
  if (g_player?.html?.sliderTime)
    updateSubtitleUI(g_player.html.sliderTime.value);
}

async function loadEmbeddedSubtitle(filePath, subIndex) {
  if (
    g_player.trackMetadata &&
    g_player.trackMetadata.subtitles &&
    g_player.trackMetadata.subtitles.length >= subIndex
  ) {
    const data = await sendIpcToMainAndWait(
      "mp-get-embedded-subtitle",
      filePath,
      g_player.trackMetadata.subtitles[subIndex].index,
    );

    if (data) {
      g_player.subtitle = {
        type: "embedded",
        index: subIndex,
        data,
        dataIndex: -1,
      };
    }
  }
}

function addExternalSubtitleData(title, data, loadIt = true) {
  if (data && title) {
    g_player.externalSubtitles.push({
      title,
      data,
    });
    if (loadIt) loadExternalSubtitle(g_player.externalSubtitles.length - 1);
  }
}

async function loadExternalSubtitle(subIndex) {
  if (
    g_player.externalSubtitles &&
    g_player.externalSubtitles.length > subIndex
  ) {
    const subtitle = g_player.externalSubtitles[subIndex];
    if (subtitle.data) {
      g_player.subtitle = {
        type: "external",
        index: subIndex,
        data: subtitle.data,
        dataIndex: -1,
      };
    }
  }
}

function canLoadSubtitles() {
  return (
    g_player.state !== PlayerState.NOT_SET &&
    g_player.mediaType === PlayerMediaType.VIDEO &&
    g_player.engineType !== PlayerEngineType.YOUTUBE
  );
}

function canSetAudioVideo() {
  const data = {
    audio:
      g_player.state !== PlayerState.NOT_SET &&
      g_player.engineType !== PlayerEngineType.YOUTUBE &&
      g_player.mediaType !== PlayerMediaType.NOT_SET,
    video:
      g_player.state !== PlayerState.NOT_SET &&
      g_player.engineType !== PlayerEngineType.YOUTUBE &&
      g_player.mediaType === PlayerMediaType.VIDEO,
  };
  return data;
}

function setSubtitleHighContrastMode(isOn) {
  g_settings.subtitleHighContrastMode = isOn;
  if (isOn) {
    g_player.html.videoSubtitleDiv.classList.add(
      "mp-video-subtitle-high-contrast",
    );
  } else {
    g_player.html.videoSubtitleDiv.classList.remove(
      "mp-video-subtitle-high-contrast",
    );
  }
}

function setSubtitleFontSize(size) {
  g_settings.subtitleFontSize = size;
  const cssSize = `${5 * size}cqh`;
  document.documentElement.style.setProperty(
    "--mp-subtitle-font-size",
    cssSize,
  );
}

function updateSubtitleUI(relativeTime) {
  if (!g_player?.subtitle?.data || g_player.subtitle.data.length === 0) return;

  let absoluteTime = relativeTime;
  if (g_player.engineType === PlayerEngineType.FFMPEG) {
    absoluteTime += ffmpeg.getTimeOffset();
  }
  const index = g_player.subtitle.data.findIndex(
    (subtitle) =>
      absoluteTime >= subtitle.start && absoluteTime <= subtitle.end,
  );

  // NOTE: empty using "&nbsp;" instead of "" to fix a weird bug where on
  // Windows on fullscreen, if cropping to 4:3 for example, when the UI isn't
  // showing the video will be pushed to the right... don't know why this fixes
  // it
  // TODO: figure it out!
  if (index !== g_player.subtitle.dataIndex) {
    if (index !== -1) {
      const allowTags = true;
      const sub = g_player.subtitle.data[index];
      g_player.html.videoSubtitleDiv.innerHTML = "&nbsp;";
      if (allowTags) {
        // keep track of tags
        let activeTags = [];
        sub.text.split("\n").forEach((lineText) => {
          const span = document.createElement("span");
          span.className = "mp-video-subtitle-line";
          // add tags still open
          let formattedLine = activeTags.join("");
          formattedLine += lineText;
          // keep track of tags in this line
          const tagRegex = /<((\/?)(b|i|u|font)[^>]*)>/gi;
          let match;
          while ((match = tagRegex.exec(lineText)) !== null) {
            const fullTag = match[0];
            const isClosing = match[2] === "/";
            const tagName = match[3].toLowerCase();
            if (isClosing) {
              // closing -> remove
              activeTags = activeTags.filter(
                (t) => !t.toLowerCase().startsWith(`<${tagName}`),
              );
            } else {
              // opening -> add
              activeTags.push(fullTag);
            }
          }
          // close still open tags so they render correctly
          formattedLine += activeTags
            .slice()
            .reverse()
            .map((tag) => {
              const nameMatch = tag.match(/<([a-z]+)/i);
              const name = nameMatch ? nameMatch[1] : "";
              return name ? `</${name}>` : "";
            })
            .join("");
          span.innerHTML = formattedLine;
          g_player.html.videoSubtitleDiv.appendChild(span);
        });
      } else {
        sub.text.split("\n").forEach((lineText) => {
          const span = document.createElement("span");
          span.className = "mp-video-subtitle-line";
          // temp element to decode things like &lt; back to <
          const temp = document.createElement("div");
          temp.innerHTML = lineText;
          span.textContent = temp.textContent;
          g_player.html.videoSubtitleDiv.appendChild(span);
        });
      }
    } else {
      g_player.html.videoSubtitleDiv.innerHTML = "&nbsp;";
    }
    g_player.subtitle.dataIndex = index;
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
      !g_player.html.buttonPlay.classList.contains("mp-hidden"),
    pause:
      !g_player.html.buttonPause.classList.contains("mp-disabled") &&
      !g_player.html.buttonPause.classList.contains("mp-hidden"),
    stop:
      !g_player.html.buttonStop.classList.contains("mp-disabled") &&
      !g_player.html.buttonStop.classList.contains("mp-hidden"),
    next: !g_player.html.buttonNext.classList.contains("mp-disabled"),
    prev: !g_player.html.buttonPrev.classList.contains("mp-disabled"),
    takescreenshot:
      !g_player.html.buttonTakeScreenshot.classList.contains("mp-disabled") &&
      !g_player.html.buttonTakeScreenshot.classList.contains("mp-hidden"),
  };
}

function initUI() {
  g_player.html.topBarTrackName = document.getElementById(
    "mp-topbar-trackname",
  );
  g_player.html.topBarAdvancedRow = document.getElementById(
    "mp-topbar-advancedrow",
  );

  g_player.html.buttonClosePlayer = document.getElementById(
    "mp-button-close-player",
  );
  g_player.html.buttonClosePlayer.addEventListener("click", function () {
    onButtonClicked("close-player");
  });
  g_player.html.buttonHidePlayer = document.getElementById(
    "mp-button-hide-player",
  );
  g_player.html.buttonHidePlayer.addEventListener("click", function () {
    onButtonClicked("hide-player");
  });

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

  g_player.html.buttonStop = document.getElementById("mp-button-stop");
  g_player.html.buttonStop.addEventListener("click", function () {
    onButtonClicked("stop");
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
  g_player.html.buttonSettings = document.getElementById("mp-button-settings");
  g_player.html.buttonSettings.addEventListener("click", function () {
    onButtonClicked("settings");
  });

  g_player.html.buttonTogglePlaylist = document.getElementById(
    "mp-button-toggle-playlist",
  );
  g_player.html.buttonTogglePlaylist.addEventListener("click", function () {
    onButtonClicked("toggle-playlist");
  });
  g_player.html.buttonToggleVideoArea = document.getElementById(
    "mp-button-toggle-videoarea",
  );
  g_player.html.buttonToggleVideoArea.addEventListener("click", function () {
    onButtonClicked("toggle-videoarea");
  });
  g_player.html.buttonToggleSpectrum = document.getElementById(
    "mp-button-toggle-spectrum",
  );
  g_player.html.buttonToggleSpectrum.addEventListener("click", function () {
    onButtonClicked("toggle-spectrum");
  });
  g_player.html.buttonAdvancedControls = document.getElementById(
    "mp-button-toggle-advancedcontrols",
  );
  g_player.html.buttonAdvancedControls.addEventListener("click", function () {
    onButtonClicked("toggle-advancedcontrols");
  });

  g_player.html.buttonFullViewIsOn = document.getElementById(
    "mp-button-fullview-is-on",
  );
  g_player.html.buttonFullViewIsOn.addEventListener("click", function () {
    onButtonClicked("fullview-is-on");
  });

  g_player.html.buttonFullViewIsOff = document.getElementById(
    "mp-button-fullview-is-off",
  );
  g_player.html.buttonFullViewIsOff.addEventListener("click", function () {
    onButtonClicked("fullview-is-off");
  });
  g_player.html.buttonTakeScreenshot = document.getElementById(
    "mp-button-takescreenshot",
  );
  g_player.html.buttonTakeScreenshot.addEventListener("click", function () {
    onButtonClicked("takescreenshot");
  });
  //////
  g_player.html.divPlaylistTracks = document.getElementById(
    "mp-div-playlist-tracks",
  );

  g_player.html.buttonShuffleIsOn = document.getElementById(
    "mp-button-shuffle-is-on",
  );
  g_player.html.buttonShuffleIsOn.addEventListener("click", function () {
    onButtonClicked("shuffle-is-on");
  });
  g_player.html.buttonShuffleIsOff = document.getElementById(
    "mp-button-shuffle-is-off",
  );
  g_player.html.buttonShuffleIsOff.addEventListener("click", function () {
    onButtonClicked("shuffle-is-off");
  });
  g_player.html.buttonRepeatIsAll = document.getElementById(
    "mp-button-repeat-is-all",
  );
  g_player.html.buttonRepeatIsAll.addEventListener("click", function () {
    onButtonClicked("repeat-is-all");
  });
  g_player.html.buttonRepeatIsOff = document.getElementById(
    "mp-button-repeat-is-off",
  );
  g_player.html.buttonRepeatIsOff.addEventListener("click", function () {
    onButtonClicked("repeat-is-off");
  });
  g_player.html.buttonRepeatIs1 = document.getElementById(
    "mp-button-repeat-is-1",
  );
  g_player.html.buttonRepeatIs1.addEventListener("click", function () {
    onButtonClicked("repeat-is-1");
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
  g_player.html.videoSubtitleDiv = document.getElementById("mp-video-subtitle");
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
  g_player.html.topBar = document.getElementById("mp-div-topbar");
  g_player.html.topBar.addEventListener("wheel", function (event) {
    if (!g_settings.muted && event.target.closest("#mp-div-volume")) {
      let value = parseFloat(g_player.html.sliderVolume.value);
      if (event.deltaY < 0) {
        // up
        value += 0.01;
        if (value > 1) value = 1;
      } else if (event.deltaY > 0) {
        // down
        value -= 0.01;
        if (value < 0) value = 0;
      }
      g_player.html.sliderVolume.value = value;
      onSliderVolumeChanged(g_player.html.sliderVolume);
    }
    event.stopPropagation();
  });

  // hide/show topbar on mouse move if full size
  g_player.html.playerDiv = document.getElementById("media-player-container");
  g_player.html.topBarShowTimeOut;
  g_player.html.isHoveringTopBar = false;

  function showTopBar() {
    g_player.html.topBar.style.opacity = "1";
    g_player.html.topBar.style.visibility = "visible";
    g_player.html.videoTitleDiv.classList.remove("mp-hidden");
    g_player.html.spectrumTitleDiv.classList.remove("mp-hidden");
  }

  function hideTopBar() {
    if (g_settings.fullView && !g_player.html.isHoveringTopBar) {
      g_player.html.topBar.style.opacity = "0";
      g_player.html.topBar.style.visibility = "hidden";
      g_player.html.videoTitleDiv.classList.add("mp-hidden");
      g_player.html.spectrumTitleDiv.classList.add("mp-hidden");
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
  g_player.html.sliderTime = document.getElementById("mp-slider-time");

  const style = getComputedStyle(document.documentElement);
  const rawValue = style.getPropertyValue("--mp-slider-thumb-width").trim();
  g_player.html.sliderThumbWidth = parseInt(rawValue, 10);

  // only update on mouse up
  g_player.html.sliderTime.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    g_player.html.sliderTimeIsSeeking = true;
    // capture the events anywhere, not only over the slider
    g_player.html.sliderTime.setPointerCapture(event.pointerId);
    const endSeeking = () => {
      g_player.html.sliderTimeIsSeeking = false;
      onSliderTimeChanged(g_player.html.sliderTime, event);
    };
    g_player.html.sliderTime.addEventListener("pointerup", endSeeking, {
      once: true,
    });
    g_player.html.sliderTime.addEventListener("pointercancel", endSeeking, {
      once: true,
    });
  });
  //////
  g_player.html.sliderTime.addEventListener("mousemove", (event) => {
    if (g_player.hasFixedDuration) {
      const slider = g_player.html.sliderTime;
      const hoveredSeconds = getSliderValueAtMouse(slider, event);

      const formattedHover =
        playlist.getFormatedTimeFromSeconds(hoveredSeconds);
      const hoverT = g_player.html.sliderTimeHoverTooltip;
      hoverT.textContent = formattedHover;
      hoverT.style.display = "block";

      const rect = slider.getBoundingClientRect();

      // TODO: calculate the hardcoded offsets
      if (g_settings.showAdvancedControls) {
        g_player.html.sliderTimeStatusOverlay.style.display = "none";
        // TODO: why do I need the + 40 to make it centered?
        hoverT.style.left = event.clientX - rect.left + 40 + "px";
      } else {
        g_player.html.sliderTimeStatusOverlay.style.display = "block";
        hoverT.style.left = event.clientX - rect.left + "px";
      }
    } else {
      g_player.html.sliderTimeHoverTooltip.style.display = "none";
      g_player.html.sliderTimeStatusOverlay.style.display = "none";
    }

    updateTimeUI();
  });

  g_player.html.sliderTime.addEventListener("mouseleave", () => {
    g_player.html.sliderTimeHoverTooltip.style.display = "none";
    g_player.html.sliderTimeStatusOverlay.style.display = "none";
  });

  g_player.html.sliderTimeHoverTooltip = document.getElementById(
    "mp-slider-time-hover-tooltip",
  );
  g_player.html.sliderTimeStatusOverlay = document.getElementById(
    "mp-slider-time-status-overlay",
  );

  // slider volume///////////////////
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
    hoverT.textContent = Math.round(hoveredVal * 100) + "%";
    hoverT.style.display = "block";

    const rect = slider.getBoundingClientRect();
    hoverT.style.left = event.clientX - rect.left + "px";

    updateVolumeUI();
    g_player.html.sliderVolumeStatusOverlay.style.display = "block";
  });

  g_player.html.sliderVolume.addEventListener("mouseleave", () => {
    g_player.html.sliderVolumeHoverTooltip.style.display = "none";
    g_player.html.sliderVolumeStatusOverlay.style.display = "none";
  });
}

function setTopBarTrackName(name, current, total) {
  document.getElementById("mp-topbar-trackname").innerHTML =
    `<i class="fa-solid fa-compact-disc"></i>${current !== undefined && total !== undefined && total > 1 ? `<span>[${current}/${total}] </span>` : ""}<span>${name}</span>`;
}

function onSliderTimeChanged(slider, event) {
  // const targetSecond = parseFloat(slider.value);
  const targetSecond = parseFloat(
    g_player.engineType === PlayerEngineType.YOUTUBE
      ? getSliderValueAtMouse(slider, event)
      : slider.value,
  );
  setTime(targetSecond);
  updateSliderFill(slider);
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

const updateSliderFill = (slider) => {
  const value = parseFloat(slider.value);
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const percent = ((value - min) / (max - min)) * 100;
  if (value <= min) {
    slider.style.background = `var(--mp-slider-current-right-color)`;
  } else if (value >= max) {
    slider.style.background = `var(--mp-slider-current-left-color)`;
  } else {
    slider.style.background = `linear-gradient(to right, 
      var(--mp-slider-current-left-color) ${percent}%, 
      var(--mp-slider-current-right-color) ${percent}%)`;
  }
};

function onSliderVolumeChanged(slider) {
  g_player.engine.volume = getVolumeLinearFromExponential(
    parseFloat(slider.value),
  );
  updateVolumeUI();
  if (g_player.engineType === PlayerEngineType.YOUTUBE) {
    yt.updateVolume(g_player.engine.volume);
  }
}

function getVolumeLinearFromExponential(logVolume) {
  // return Math.pow(logVolume, 3);
  return Math.pow(logVolume, 2);
}

function getVolumeExponentialFromLinear(linearVolume) {
  // return Math.cbrt(linearVolume);
  return Math.sqrt(linearVolume);
}

function updateVolumeUI() {
  const slider = g_player.html.sliderVolume;
  const statusT = g_player.html.sliderVolumeStatusOverlay;
  if (slider && statusT) {
    const currentVal = parseFloat(slider.value) || 0;
    statusT.textContent = Math.floor(currentVal * 100) + "%";
  }
  updateSliderFill(slider);
  // buttons
  if (!g_settings.muted) {
    g_player.html.sliderVolume.classList.remove("mp-disabled");
    g_player.html.buttonVolumeOn.classList.add("mp-hidden");
    g_player.html.buttonVolumeOff.classList.remove("mp-hidden");

    const updateVolumeIcon = (id) => {
      const useTag = g_player.html.buttonVolumeOff.querySelector("use");
      if (useTag) {
        const spritePath =
          "../../assets/libs/fontawesome7/sprites_custom/volume_sheet.svg";
        useTag.setAttribute("href", `${spritePath}#${id}`);
      }
    };

    const volume = g_player.engine.volume;
    if (volume === 0) {
      updateVolumeIcon("volume-off");
    } else if (volume < 0.0625) {
      updateVolumeIcon("volume-low");
    } else if (volume < 0.36) {
      updateVolumeIcon("volume");
    } else {
      updateVolumeIcon("volume-high");
    }
  } else {
    g_player.html.sliderVolume.classList.add("mp-disabled");
    g_player.html.buttonVolumeOn.classList.remove("mp-hidden");
    g_player.html.buttonVolumeOff.classList.add("mp-hidden");
  }
}

function updateVideoView(video, crop, aspect, zoom) {
  if (!video) return;
  // const video = document.getElementById("mp-html-video");
  const container = document.getElementById("mp-video-div");
  const containerRatio = container.clientWidth / container.clientHeight;

  // reset
  video.style.setProperty("--video-zoom", zoom || 1);
  video.style.width = "100%";
  video.style.height = "100%";

  // aspect ratio
  if (aspect && aspect !== "original") {
    // fill the new ratio
    video.style.objectFit = "fill";
    video.style.aspectRatio = aspect;
  } else {
    // original video pixels
    video.style.objectFit = "contain";
    video.style.aspectRatio = "auto";
  }

  // crop
  if (crop && crop !== "original") {
    // change the element shape and force 'cover' (zoom)
    video.style.objectFit = "cover";
    video.style.aspectRatio = crop;
    // add bars to the container if the crop ratio
    // doesn't match the container ratio.
    const [w, h] = crop.split("/").map(Number);
    const targetRatio = w / h;
    if (targetRatio > containerRatio) {
      video.style.width = "100%";
      video.style.height = "auto";
    } else {
      video.style.width = "auto";
      video.style.height = "100%";
    }
  } else {
    // no crop, but add bars to the container if needed due to aspect
    const ratioToFit = aspect && aspect !== "original" ? aspect : "auto";
    if (ratioToFit !== "auto") {
      const [w, h] = ratioToFit.split("/").map(Number);
      const targetRatio = w / h;
      if (targetRatio > containerRatio) {
        video.style.width = "100%";
        video.style.height = "auto";
      } else {
        video.style.width = "auto";
        video.style.height = "100%";
      }
    }
  }
}

function refreshUI() {
  updateVideoView(
    document.getElementById("mp-html-video"),
    g_settings.videoCrop,
    g_settings.videoAspectRatio,
    1,
  );

  if (g_settings.trayIcon === 0) {
    g_player.html.buttonHidePlayer.classList.add("mp-hidden");
  } else {
    g_player.html.buttonHidePlayer.classList.remove("mp-hidden");
  }

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
  //
  g_player.html.videoTitleDiv.innerText = trackTitle ?? "";
  g_player.html.spectrumTitleDiv.innerText = trackTitle ?? "";

  // play buttons /////////////////////////////////////////////////////////////
  if (playlist.getTracks().length > 0) {
    if (
      g_player.trackIndex !== undefined &&
      g_player.state !== PlayerState.LOADING
    ) {
      if (g_player.state === PlayerState.PLAYING) {
        g_player.html.buttonPlay.classList.add("mp-disabled");
        g_player.html.buttonPause.classList.remove("mp-disabled");
      } else {
        g_player.html.buttonPlay.classList.remove("mp-disabled");
        g_player.html.buttonPause.classList.add("mp-disabled");
      }
    } else {
      g_player.html.buttonPlay.classList.add("mp-disabled");
      g_player.html.buttonPause.classList.add("mp-disabled");
    }
    if (g_settings.showAdvancedControls) {
      g_player.html.buttonStop.classList.remove("mp-hidden");
      if (g_player.state !== PlayerState.NOT_SET) {
        g_player.html.buttonStop.classList.remove("mp-disabled");
      } else {
        g_player.html.buttonStop.classList.add("mp-disabled");
      }
      if (g_player.state === PlayerState.PLAYING) {
        g_player.html.buttonPlay.classList.add("mp-hidden");
        g_player.html.buttonPause.classList.remove("mp-hidden");
      } else if (g_player.state === PlayerState.LOADING) {
        g_player.html.buttonPlay.classList.add("mp-hidden");
        g_player.html.buttonPause.classList.remove("mp-hidden");
      } else {
        g_player.html.buttonPlay.classList.remove("mp-hidden");
        g_player.html.buttonPause.classList.add("mp-hidden");
      }
    } else {
      if (g_player.state === PlayerState.PLAYING) {
        g_player.html.buttonPlay.classList.add("mp-hidden");
        g_player.html.buttonPause.classList.remove("mp-hidden");
        g_player.html.buttonStop.classList.add("mp-hidden");
      } else if (g_player.state === PlayerState.LOADING) {
        g_player.html.buttonPlay.classList.add("mp-hidden");
        g_player.html.buttonPause.classList.add("mp-hidden");
        g_player.html.buttonStop.classList.remove("mp-hidden");
      } else {
        g_player.html.buttonPlay.classList.remove("mp-hidden");
        g_player.html.buttonPause.classList.add("mp-hidden");
        g_player.html.buttonStop.classList.add("mp-hidden");
      }
    }

    if (g_player.state === PlayerState.LOADING) {
      if (
        g_player.engineType === PlayerEngineType.FFMPEG ||
        g_player.mediaType === PlayerMediaType.VIDEO ||
        g_player.engineType === PlayerEngineType.YOUTUBE
      ) {
        g_player.html.videoLoadingDiv.classList.remove("mp-hidden");
      } else {
        g_player.html.videoLoadingDiv.classList.add("mp-hidden");
      }
    } else {
      g_player.html.videoLoadingDiv.classList.add("mp-hidden");
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
    // no tracks in playlist
    if (g_settings.showAdvancedControls) {
      g_player.html.buttonPlay.classList.remove("mp-hidden");
      g_player.html.buttonPlay.classList.add("mp-disabled");
      g_player.html.buttonPause.classList.add("mp-hidden");
      g_player.html.buttonStop.classList.remove("mp-hidden");
      g_player.html.buttonStop.classList.add("mp-disabled");
    } else {
      g_player.html.buttonPlay.classList.remove("mp-hidden");
      g_player.html.buttonPlay.classList.add("mp-disabled");
      g_player.html.buttonPause.classList.add("mp-hidden");
      g_player.html.buttonStop.classList.add("mp-hidden");
    }

    g_player.html.buttonPrev.classList.add("mp-disabled");
    g_player.html.buttonNext.classList.add("mp-disabled");

    g_player.html.videoLoadingDiv.classList.add("mp-hidden");
    g_player.html.videoDiv.classList.add("mp-hidden");
  }
  ///////////////////////////////////////////////////////////////////////////
  if (g_settings.fullView) {
    g_player.html.playerDiv.classList.add("mp-layout-fullscreen");
    if (g_isPlayerMode) {
      document
        .querySelector("#modals")
        .classList.add("modals-layout-fullscreen");
    }
    document.documentElement.style.setProperty("--mp-frame-width", `500px`);
    //
    g_player.html.buttonTogglePlaylist.classList.add("mp-disabled");
  } else {
    g_player.html.playerDiv.classList.remove("mp-layout-fullscreen");
    if (g_isPlayerMode) {
      document
        .querySelector("#modals")
        .classList.remove("modals-layout-fullscreen");
    }
    g_player.html.topBar.style.opacity = "1";
    g_player.html.topBar.style.visibility = "visible";
    if (g_settings.size === 0) {
      document.documentElement.style.setProperty("--mp-frame-width", `300px`);
    } else if (g_settings.size === 1) {
      document.documentElement.style.setProperty("--mp-frame-width", `500px`);
    }
    //
    g_player.html.buttonTogglePlaylist.classList.remove("mp-disabled");
  }

  if (g_settings.showPlaylist) {
    g_player.html.buttonTogglePlaylist.classList.remove("mp-off-miniicon");
  } else {
    g_player.html.buttonTogglePlaylist.classList.add("mp-off-miniicon");
  }

  if (g_settings.showAdvancedControls) {
    if (g_settings.fullView) {
      g_player.html.buttonFullViewIsOn.classList.remove("mp-hidden");
      g_player.html.buttonFullViewIsOff.classList.add("mp-hidden");
    } else {
      g_player.html.buttonFullViewIsOn.classList.add("mp-hidden");
      g_player.html.buttonFullViewIsOff.classList.remove("mp-hidden");
    }
    //
    if (
      !g_settings.showPlaylist &&
      g_player.html.topBarTrackName.textContent != ""
    ) {
      g_player.html.topBarTrackName.classList.remove("mp-hidden");
    } else {
      g_player.html.topBarTrackName.classList.add("mp-hidden");
    }
    //
    g_player.html.topBarAdvancedRow.classList.remove("mp-hidden");
  } else {
    g_player.html.buttonFullViewIsOn.classList.add("mp-hidden");
    g_player.html.buttonFullViewIsOff.classList.add("mp-hidden");
    g_player.html.topBarTrackName.classList.add("mp-hidden");
    g_player.html.topBarAdvancedRow.classList.add("mp-hidden");
  }

  if (
    (g_settings.fullView || g_settings.showSpectrum) &&
    g_player.mediaType === PlayerMediaType.AUDIO
  ) {
    g_player.html.spectrumDiv.classList.remove("mp-hidden");
  } else {
    g_player.html.spectrumDiv.classList.add("mp-hidden");
  }
  if (!g_settings.fullView && g_player.mediaType === PlayerMediaType.AUDIO) {
    g_player.html.buttonToggleSpectrum.classList.remove("mp-disabled");
  } else {
    g_player.html.buttonToggleSpectrum.classList.add("mp-disabled");
  }
  if (g_settings.showSpectrum) {
    g_player.html.buttonToggleSpectrum.classList.remove("mp-off-miniicon");
  } else {
    g_player.html.buttonToggleSpectrum.classList.add("mp-off-miniicon");
  }

  if (
    (g_settings.fullView &&
      g_player.html.spectrumDiv.classList.contains("mp-hidden")) ||
    (g_settings.showVideo && g_player.mediaType === PlayerMediaType.VIDEO)
  ) {
    g_player.html.videoDiv.classList.remove("mp-hidden");
  } else {
    g_player.html.videoDiv.classList.add("mp-hidden");
  }
  if (!g_settings.fullView && g_player.mediaType === PlayerMediaType.VIDEO) {
    g_player.html.buttonToggleVideoArea.classList.remove("mp-disabled");
  } else {
    g_player.html.buttonToggleVideoArea.classList.add("mp-disabled");
  }
  if (g_settings.showVideo) {
    g_player.html.buttonToggleVideoArea.classList.remove("mp-off-miniicon");
  } else {
    g_player.html.buttonToggleVideoArea.classList.add("mp-off-miniicon");
  }

  if (g_settings.showAdvancedControls) {
    g_player.html.buttonTakeScreenshot.classList.remove("mp-hidden");
  } else {
    g_player.html.buttonTakeScreenshot.classList.add("mp-hidden");
  }
  if (
    g_player.mediaType === PlayerMediaType.VIDEO &&
    g_player.engine.videoWidth > 0 &&
    g_player.state !== PlayerState.LOADING
  ) {
    g_player.html.buttonTakeScreenshot.classList.remove("mp-disabled");
  } else {
    g_player.html.buttonTakeScreenshot.classList.add("mp-disabled");
  }

  updateVolumeUI();
  updateTimeUI();

  if (g_settings.shuffle === 1) {
    g_player.html.buttonShuffleIsOff.classList.add("mp-hidden");
    g_player.html.buttonShuffleIsOn.classList.remove("mp-hidden");
  } else {
    g_player.html.buttonShuffleIsOff.classList.remove("mp-hidden");
    g_player.html.buttonShuffleIsOn.classList.add("mp-hidden");
  }

  if (g_settings.repeat === 0) {
    g_player.html.buttonRepeatIsOff.classList.remove("mp-hidden");
    g_player.html.buttonRepeatIsAll.classList.add("mp-hidden");
    g_player.html.buttonRepeatIs1.classList.add("mp-hidden");
  } else if (g_settings.repeat === 1) {
    g_player.html.buttonRepeatIsOff.classList.add("mp-hidden");
    g_player.html.buttonRepeatIsAll.classList.add("mp-hidden");
    g_player.html.buttonRepeatIs1.classList.remove("mp-hidden");
  } else if (g_settings.repeat === 2) {
    g_player.html.buttonRepeatIsOff.classList.add("mp-hidden");
    g_player.html.buttonRepeatIsAll.classList.remove("mp-hidden");
    g_player.html.buttonRepeatIs1.classList.add("mp-hidden");
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

  ///////////////

  clearTimeout(g_updateContextDataTimeout);
  g_updateContextDataTimeout = setTimeout(
    () => sendIpcToMain("update-context-menu-data", getContextMenuData()),
    500,
  );
}
let g_updateContextDataTimeout;

function onButtonClicked(buttonName) {
  if (buttonName === "close-player") {
    sendIpcToMain("close");
  } else if (buttonName === "hide-player") {
    sendIpcToMain("hide");
  } else if (buttonName === "play") {
    onPlay();
  } else if (buttonName === "pause") {
    onPause();
  } else if (buttonName === "stop") {
    onStop();
  } else if (buttonName === "prev") {
    onPrevTrack();
  } else if (buttonName === "next") {
    onNextTrack();
  } else if (buttonName === "open") {
    sendIpcToMain("on-open-clicked", 0, playlist.getTracks().length);
  } else if (buttonName === "volume-off") {
    g_settings.muted = true;
    g_player.engine.muted = true;
    if (g_player.engineType === PlayerEngineType.YOUTUBE) {
      yt.updateVolume(0);
    }
  } else if (buttonName === "volume-on") {
    g_settings.muted = false;
    g_player.engine.muted = false;
    if (g_player.engineType === PlayerEngineType.YOUTUBE) {
      yt.updateVolume(g_player.engine.volume);
    }
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
  else if (buttonName === "shuffle-is-on") {
    onSetShuffleMode(0);
  } else if (buttonName === "shuffle-is-off") {
    onSetShuffleMode(1);
  }
  //
  else if (buttonName === "repeat-is-off") {
    onSetRepeatMode(1);
  } else if (buttonName === "repeat-is-1") {
    onSetRepeatMode(2);
  } else if (buttonName === "repeat-is-all") {
    onSetRepeatMode(0);
  }
  //
  else if (buttonName === "shuffle-is-on") {
    onSetShuffleMode(0);
  } else if (buttonName === "shuffle-is-off") {
    onSetShuffleMode(1);
  }
  //
  else if (buttonName === "fullview-is-on") {
    setFullView(false);
  } else if (buttonName === "fullview-is-off") {
    setFullView(true);
  }
  //
  else if (buttonName === "clear") {
    if (playlist.getTracks().length <= 0) return;
    onStop();
    playlist.clearPlaylist();
    playlist.setSelectedTrackFileIndex(undefined);
    setTopBarTrackName("");
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
          setPlayerTrackIndex(playlist.getCurrentTrackIndex());
        }
      } else {
        // the deleted one was the last
        onPause();
        playlist.setCurrentTrackIndex(playlist.getTracks().length - 1);
        if (playlist.getTracks().length > 0) {
          setPlayerTrackIndex(playlist.getTracks().length - 1);
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
      setTopBarTrackName("");
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
    showSpectrumVisualizer(false);
  } else if (buttonName === "toggle-playlist") {
    showPlaylist(!g_settings.showPlaylist);
  } else if (buttonName === "toggle-videoarea") {
    g_settings.showVideo = !g_settings.showVideo;
  } else if (buttonName === "toggle-spectrum") {
    showSpectrumVisualizer(!g_settings.showSpectrum);
  } else if (buttonName === "toggle-advancedcontrols") {
    showAdvancedControls(!g_settings.showAdvancedControls);
  } else if (buttonName === "takescreenshot") {
    takeVideoScreenshot();
  }
  //////
  refreshUI();
}

function updateTimeUI() {
  const slider = g_player.html.sliderTime;
  const statusT = g_player.html.sliderTimeStatusOverlay;

  updateSliderFill(g_player.html.sliderTime);

  if (slider && statusT) {
    const maxSeconds = parseFloat(slider.max) || 0;
    const currentSeconds = parseFloat(slider.value) || 0;

    let formattedTotal = g_player.hasFixedDuration
      ? playlist.getFormatedTimeFromSeconds(maxSeconds)
      : "--:--";
    let formattedCurrent = g_player.hasFixedDuration
      ? playlist.getFormatedTimeFromSeconds(
          currentSeconds,
          formattedTotal.length,
        )
      : "--:--";

    if (g_player.hasFixedDuration) {
      slider.classList.remove("mp-disabled");
    } else {
      slider.classList.add("mp-disabled");
    }

    if (g_settings.showAdvancedControls) {
      const currentDiv = document.getElementById("mp-time-current-span");
      const totalDiv = document.getElementById("mp-time-total-span");
      currentDiv.textContent = formattedCurrent;
      totalDiv.textContent = formattedTotal;
      if (g_player.hasFixedDuration) {
        currentDiv.classList.remove("mp-disabled");
        totalDiv.classList.remove("mp-disabled");
      } else {
        currentDiv.classList.add("mp-disabled");
        totalDiv.classList.add("mp-disabled");
      }
    } else {
      statusT.textContent = formattedCurrent + " / " + formattedTotal;
    }
  }
}

function getContextMenuData() {
  return {
    settings: g_settings,
    buttonStates: getButtonStates(),
    playlist: playlist.getPlaylist(),
    currentFileIndex: playlist.getCurrentTrackFileIndex(),
    trackMetadata: g_player.trackMetadata,
    subtitle: g_player.subtitle,
    canLoadSubtitles: canLoadSubtitles(),
    externalSubtitles: g_player.externalSubtitles,
    canSetAudioVideo: canSetAudioVideo(),
    isVideo: g_player.mediaType === PlayerMediaType.VIDEO,
    isYoutube: g_player.engineType === PlayerEngineType.YOUTUBE,
  };
}

function showVideoActionIcon(action, container) {
  const iconMap = {
    play: "fa-play",
    pause: "fa-pause",
    rewind: "fa-backward",
    ff: "fa-forward",
  };
  const icon = document.createElement("i");
  icon.className = `fa-solid ${iconMap[action] || "fa-circle"}`;
  Object.assign(icon.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: "33.3cqh", // 1/3 of the height
    color: "rgba(255, 255, 255, 0.8",
    textShadow: "0 0 15px rgba(0, 0, 0, 0.4)",
    pointerEvents: "none",
    zIndex: "11",
  });
  container.appendChild(icon);
  const animation = icon.animate(
    [
      { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
      { opacity: 0, transform: "translate(-50%, -50%) scale(1.5)" },
    ],
    {
      duration: 400,
      easing: "ease-out",
    },
  );
  // clean up after finish
  animation.onfinish = () => icon.remove();
}

function setFullView(isOn) {
  g_settings.fullView = isOn;
  if (isOn) {
    if (
      g_player.mediaType === PlayerMediaType.AUDIO &&
      !spectrumVisualizer.isRunning()
    ) {
      spectrumVisualizer.start();
    }
  } else {
    if (
      g_player.mediaType === PlayerMediaType.AUDIO &&
      !g_settings.showSpectrum &&
      spectrumVisualizer.isRunning()
    ) {
      spectrumVisualizer.stop();
    }
  }
  refreshUI();
  playlist.scrollToCurrent();
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

function showAdvancedControls(show) {
  if (show) {
    g_settings.showAdvancedControls = true;
    g_player.html.topBar.classList.add("mp-advanced-controls");
    g_player.html.topBar.children[3].appendChild(
      document.getElementById("mp-time-wrapper"),
    );
    g_player.html.topBar.children[3].appendChild(
      document.getElementById("mp-div-volume"),
    );
  } else {
    g_player.html.topBar.classList.remove("mp-advanced-controls");
    g_settings.showAdvancedControls = false;
    g_player.html.buttonNext.after(document.getElementById("mp-time-wrapper"));
    document
      .getElementById("mp-time-wrapper")
      .after(document.getElementById("mp-div-volume"));
  }
}

function showPlaylist(show) {
  g_settings.showPlaylist = show;
  if (show) {
    g_player.html.divPlaylist.classList.remove("mp-hidden");
    g_settings.showPlaylist = true;
    playlist.scrollToCurrent();
  } else {
    g_player.html.divPlaylist.classList.add("mp-hidden");
    g_settings.showPlaylist = false;
  }
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
      document.getElementById(elementId).classList.remove("set-display-none");
    } else {
      document.getElementById(elementId).classList.add("set-display-none");
    }
  });

  on("save-and-quit-request", (...args) => {
    onSaveAndQuitRequested(...args);
  });

  on("update-ffmpeg-available", (ffmpegAvailable) => {
    g_ffmpegAvailable = ffmpegAvailable;
  });

  on("open-playlist", (newPlaylist, currentTime) => {
    onStop();
    playlist.openPlaylist(newPlaylist);
    playlist.setCurrentTrackIndex(0);
    setPlayerTrackIndex(playlist.getCurrentTrackIndex());
    onPlay(g_player.trackIndex, currentTime ?? 0);
  });

  on("add-to-playlist", (...args) => {
    const [trackIndex, addedSome] = playlist.addToPlaylist(...args);
    if (trackIndex !== undefined) {
      onPlay(trackIndex, 0);
    } else if (addedSome) {
      setTimeout(playlist.scrollToLast, 100);
    }
    refreshUI();
  });

  on("add-subtitle-from-file", (...args) => {
    addExternalSubtitleData(...args);
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

      case "toggle-advancedcontrols":
        showAdvancedControls(!g_settings.showAdvancedControls);
        refreshUI();
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
        playlist.scrollToCurrent();
        break;

      case "toggle-fullview":
        setFullView(!g_settings.fullView);
        break;

      case "set-fullview":
        setFullView(args[1]);
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

      case "stop":
        onStop();
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

      ////

      case "load-disabled-subtitle-track":
        clearPlayerSubtitle();
        refreshUI();
        break;

      case "load-embedded-subtitle-track":
        loadEmbeddedSubtitle(
          decodeURI(playlist.getTracks()[g_player.trackIndex].fileUrl),
          args[1],
        );
        updateSubtitleUI(g_player.html.sliderTime.value);
        refreshUI();
        break;

      case "load-external-subtitle-track":
        loadExternalSubtitle(args[1]);
        updateSubtitleUI(g_player.html.sliderTime.value);
        refreshUI();
        break;

      case "set-subtitle-font-size":
        setSubtitleFontSize(args[1]);
        break;

      case "toggle-subtitle-high-contrast-mode":
        setSubtitleHighContrastMode(!g_settings.subtitleHighContrastMode);
        break;

      case "add-subtitle-file":
        sendIpcToMain(
          "on-add-subtitle-file-clicked",
          decodeURI(playlist.getTracks()[g_player.trackIndex].fileUrl),
        );
        break;

      case "load-audio-track":
        try {
          const newIndex = args[1];
          if (
            g_player.engineType === PlayerEngineType.FFMPEG &&
            newIndex !== g_player.trackMetadata.audioIndex
          ) {
            g_player.trackMetadata.audioIndex = newIndex;
            ffmpeg.setTime(
              parseFloat(g_player.html.sliderTime.value),
              g_player.state,
              newIndex,
              g_player.trackMetadata.videoIndex,
            );
          }
        } catch (error) {}
        break;

      case "load-video-track":
        try {
          const newIndex = args[1];
          if (
            g_player.engineType === PlayerEngineType.FFMPEG &&
            newIndex !== g_player.trackMetadata.videoIndex
          ) {
            g_player.trackMetadata.videoIndex = newIndex;
            ffmpeg.setTime(
              parseFloat(g_player.html.sliderTime.value),
              g_player.state,
              g_player.trackMetadata.audioIndex,
              newIndex,
            );
          }
        } catch (error) {}
        break;

      case "load-video-crop":
        g_settings.videoCrop = args[1];
        refreshUI();
        break;

      case "load-video-aspectratio":
        g_settings.videoAspectRatio = args[1];
        refreshUI();
        break;

      ////

      case "takescreenshot":
        takeVideoScreenshot();
        break;

      ////

      case "set-tray-icon":
        g_settings.trayIcon = args[1];
        sendIpcToMain("update-context-menu-data", getContextMenuData());
        sendIpcToMain("set-tray-icon", g_settings.trayIcon);
        refreshUI();
        break;
    }
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
          if (outputPaths.length > 0)
            sendIpcToMain("on-drop", outputPaths, element.id);
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
      } else if (event.key === "s" && event.ctrlKey) {
        if (g_settings.fullView) {
          takeVideoScreenshot();
        }
      } else if (event.key === "F11") {
        // TODO toggle fullscreen
        sendIpcToMain("log-test", "TODO toggle fullscreen");
      } else if (event.key === "F10") {
        sendIpcToMain("toggle-dev-tools");
      }
      break;
    case "mousemove":
      {
        onMouseMove();
      }
      break;
    case "click":
      {
        if (
          event.target.parentNode === g_player.html.buttonCloseVideoArea ||
          event.target.parentNode === g_player.html.buttonCloseSpectrum
        ) {
          return;
        }
        const videoElementClicked = event.target.closest("#mp-video-div");
        const spectrumElementCliked = event.target.closest("#mp-spectrum-div");
        if (videoElementClicked || spectrumElementCliked) {
          if (g_clickTimer) {
            clearTimeout(g_clickTimer);
            g_clickTimer = null;
            return;
          }

          g_clickTimer = setTimeout(() => {
            g_clickTimer = null;
            if (g_player.state === PlayerState.PLAYING) {
              showVideoActionIcon(
                "pause",
                spectrumElementCliked ?? videoElementClicked,
              );
              onPause();
            } else if (
              g_player.state === PlayerState.PAUSED ||
              g_player.state === PlayerState.NOT_SET
            ) {
              showVideoActionIcon(
                "play",
                spectrumElementCliked ?? videoElementClicked,
              );
              onPlay();
            }
          }, 250);

          return;
        }
      }
      break;
    case "dblclick":
      {
        if (
          event.target.parentNode === g_player.html.buttonCloseVideoArea ||
          event.target.parentNode === g_player.html.buttonCloseSpectrum
        ) {
          return;
        }
        const videoElementClicked = event.target.closest("#mp-video-div");
        const spectrumElementClicked = event.target.closest("#mp-spectrum-div");
        if (videoElementClicked || spectrumElementClicked) {
          clearTimeout(g_clickTimer);
          // 3 click zones
          const rect = (
            spectrumElementClicked
              ? g_player.html.spectrumDiv
              : g_player.html.videoDiv
          ).getBoundingClientRect();
          const x = event.clientX - rect.left;
          const width = rect.width;
          if (x < width * 0.25) {
            // left
            showVideoActionIcon(
              "rewind",
              spectrumElementClicked ?? videoElementClicked,
            );
            onRewind();
          } else if (x < width * 0.75) {
            // center
            setFullView(!g_settings.fullView);
          } else {
            // right
            showVideoActionIcon(
              "ff",
              spectrumElementClicked ?? videoElementClicked,
            );
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
  message,
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
    title,
    message,
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
