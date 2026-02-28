/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */
let g_activePort = null;
let g_totalDuration = 0;
let g_videoTag;

let onPlaySucceeded, setPlayerState, sendIpcToMain;

// NOTE: this must be synced with the one in renderer
const PlayerState = {
  NOT_SET: "not set",
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED: "paused",
};

export function init(_setPlayerState, _sendIpcToMain) {
  setPlayerState = _setPlayerState;
  sendIpcToMain = _sendIpcToMain;
  sendIpcToMain("mp-ffmpeg-open-player");
}

export function initOnIpcCallbacks(on) {
  on("mp-ffmpeg-server-ready", (data) => {
    g_activePort = data.port;
  });

  on("mp-ffmpeg-video-metadata", (data) => {
    g_ffmpegSeekOffset = 0;
    g_totalDuration = data.duration;
    if (data.time && data.time >= g_totalDuration) data.time = 0;
    document.getElementById("mp-slider-time").max = Math.floor(g_totalDuration);
    document.getElementById("mp-text-time").innerText =
      formatTime(g_totalDuration);
    startStream(data.time);
  });

  on("mp-ffmpeg-player-error", (error) => {
    console.log(error);
    sendIpcToMain("on-play-error", "NotSupportedError");
  });
}

/////////////////////

let g_ffmpegSeekOffset = 0;

export function setTime(seconds) {
  setPlayerState(PlayerState.LOADING, true);
  g_ffmpegSeekOffset = Math.floor(seconds); // remember where we jumped to
  startStream(g_ffmpegSeekOffset);
}

export function onSliderTimeTimeUpdate(videoElement, inputSlider, textDiv) {
  const currentTotalSeconds = g_ffmpegSeekOffset + videoElement.currentTime;
  textDiv.innerHTML =
    formatTime(currentTotalSeconds) + " / " + formatTime(inputSlider.max);
  if (inputSlider.max > 0) {
    inputSlider.value = currentTotalSeconds;
  }
}

/////////////////////

function startStream(time) {
  g_ffmpegSeekOffset = Math.floor(time ?? 0);
  g_videoTag = document.getElementById("mp-html-video");
  g_videoTag.pause();
  g_videoTag.src = "";
  g_videoTag.load();
  const timestamp = g_ffmpegSeekOffset;
  console.log("timestamp: " + timestamp);
  g_videoTag.src = `http://127.0.0.1:${g_activePort}/video?t=${timestamp}&cb=${Date.now()}`;
  g_videoTag.play().catch((e) => {
    if (e.name !== "AbortError") console.error("[ffmpeg] Play failed:", e);
  });
}

// g_videoTag.oncanplay = () => {
//   g_videoTag.volume = savedVolume;
//   document.getElementById("loadingOverlay").classList.add("hidden");
// };

const formatTime = (s) => {
  if (!s || !isFinite(s)) return "00:00";
  const m = Math.floor(s / 60),
    ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
};
