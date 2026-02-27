/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */
let g_activePort = null;
let g_totalDuration = 0;
let g_videoTag;

let sendIpcToMain;

export function init(_sendIpcToMain) {
  sendIpcToMain = _sendIpcToMain;
  sendIpcToMain("vp-open-player");
}

export function initOnIpcCallbacks(on) {
  on("vp-server-ready", (data) => {
    g_activePort = data.port;
  });

  on("vp-video-metadata", (data) => {
    g_ffmpegSeekOffset = 0;
    g_totalDuration = data.duration;
    document.getElementById("ap-slider-time").max = Math.floor(g_totalDuration);
    document.getElementById("ap-text-time").innerText =
      formatTime(g_totalDuration);
    startStream(0);
  });

  on("vp-player-error", (error) => {
    console.log(error);
    document
      .getElementById("ap-html-video-loading-div")
      .classList.add("set-display-none");
    sendIpcToMain("on-play-error", "NotSupportedError");
  });
}

/////////////////////

// function openPlayer(filePath = null) {
// document.getElementById("ap-html-video-loading-div").classList.remove("set-display-none");
//   sendToMain("vp-open-player");
//   if (filePath) {
// document.getElementById("ap-html-video-loading-div").classList.remove("set-display-none");
//     sendToMain("vp-load-video", filePath);
//   }
// }

let g_ffmpegSeekOffset = 0;

export function setTime(seconds) {
  document
    .getElementById("ap-html-video-loading-div")
    .classList.remove("set-display-none");
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
  g_videoTag = document.getElementById("ap-html-video");
  g_videoTag.pause();
  g_videoTag.src = "";
  g_videoTag.load();
  const timestamp = time ?? 0;
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
