/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { PlayerState } from "./constants.js";

let g_activePort = null;
let g_totalDuration = 0;
let g_videoTag;

let setPlayerState, sendIpcToMain, onError;

export function init(_setPlayerState, _sendIpcToMain, _onError) {
  setPlayerState = _setPlayerState;
  sendIpcToMain = _sendIpcToMain;
  onError = _onError;
}

export function initOnIpcCallbacks(on) {
  on("mp-ffmpeg-server-ready", (data) => {
    g_activePort = data.port;
  });

  on("mp-ffmpeg-video-metadata", (data) => {
    g_ffmpegSeekOffset = 0;
    g_totalDuration = data.duration;
    g_activePort = data.port;
    if (data.time && data.time >= g_totalDuration) data.time = 0;
    document.getElementById("mp-slider-time").max = Math.floor(g_totalDuration);
    startStream(data.time);
  });

  on("mp-ffmpeg-player-error", (error) => {
    onError("NotSupportedError");
  });
}

/////////////////////

let g_ffmpegSeekOffset = 0;

export function setTime(seconds, prevPlayerState) {
  setPlayerState(PlayerState.LOADING, true);
  g_ffmpegSeekOffset = Math.floor(seconds); // remember where we jumped to
  startStream(g_ffmpegSeekOffset, prevPlayerState);
}

export function onSliderTimeTimeUpdate(videoElement, inputSlider) {
  const currentTotalSeconds = g_ffmpegSeekOffset + videoElement.currentTime;
  if (inputSlider.max > 0) {
    inputSlider.value = currentTotalSeconds;
  }
}

/////////////////////

function startStream(time, prevPlayerState) {
  g_ffmpegSeekOffset = Math.floor(time ?? 0);
  g_videoTag = document.getElementById("mp-html-video");
  g_videoTag.pause();
  g_videoTag.src = "";
  g_videoTag.load();
  const timestamp = g_ffmpegSeekOffset;
  g_videoTag.src = `http://127.0.0.1:${g_activePort}/video?t=${timestamp}&cb=${Date.now()}`;
  g_videoTag.play().catch((e) => {
    if (e.name !== "AbortError") console.error("[ffmpeg] Play failed:", e);
  });
  if (prevPlayerState !== undefined && prevPlayerState === PlayerState.PAUSED) {
    g_videoTag.pause();
    setPlayerState(PlayerState.PAUSED);
  }
}
