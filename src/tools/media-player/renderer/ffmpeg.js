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

export function setTime(seconds, prevPlayerState, audioIndex, videoIndex) {
  setPlayerState(PlayerState.LOADING, true);
  g_ffmpegSeekOffset = Math.floor(seconds); // remember where we jumped to
  startStream(g_ffmpegSeekOffset, prevPlayerState, audioIndex, videoIndex);
}

export function onSliderTimeUpdate(videoElement, inputSlider) {
  const currentTotalSeconds = g_ffmpegSeekOffset + videoElement.currentTime;
  if (inputSlider.max > 0) {
    inputSlider.value = currentTotalSeconds;
  }
}

export function getTimeOffset() {
  return g_ffmpegSeekOffset;
}

/////////////////////

function startStream(time, prevPlayerState, audioIndex, videoIndex) {
  g_videoTag = document.getElementById("mp-html-video");
  if (!g_videoTag) return;

  g_videoTag.pause();
  g_ffmpegSeekOffset = Math.floor(time ?? 0);
  const timestamp = g_ffmpegSeekOffset;
  let url = `http://127.0.0.1:${g_activePort}/video?t=${timestamp}&cb=${Date.now()}`;
  if (audioIndex !== undefined && audioIndex >= 0) {
    url += `&a=${audioIndex}`;
  }
  if (videoIndex !== undefined && videoIndex >= 0) {
    url += `&v=${videoIndex}`;
  }
  g_videoTag.src = url;

  g_videoTag.play().catch((error) => {
    if (error.name !== "AbortError") {
      console.error("[ffmpeg] Play failed:", error);
      // TODO: ?
    }
  });

  if (prevPlayerState !== undefined && prevPlayerState === PlayerState.PAUSED) {
    g_videoTag.pause();
    setPlayerState(PlayerState.PAUSED);
  }
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export async function getNativeCapabilities() {
  const videoCodecs = [
    "avc1.42E01E", // H.264 (Base)
    "avc1.64001E", // H.264 (High)
    "vp8",
    "vp09.00.10.08", // VP9
    "av01.0.04M.08", // AV1
    "hev1.1.6.L93.B0", // HEVC/H.265
  ];

  const audioCodecs = [
    "mp4a.40.2", // AAC
    "opus",
    "vorbis",
    "mp3",
    "flac",
  ];

  const check = async (type, codec) => {
    if (!window.navigator.mediaCapabilities) return false;

    let contentType = "";
    if (type === "video") {
      if (codec.includes("avc1") || codec.includes("hev1")) {
        contentType = `video/mp4; codecs="${codec}"`;
      } else if (codec.includes("vp") || codec.includes("av01")) {
        contentType = `video/webm; codecs="${codec}"`;
      } else {
        contentType = `video/mp4; codecs="${codec}"`; // fallback
      }
    } else {
      if (codec.includes("mp4a")) {
        contentType = `audio/mp4; codecs="${codec}"`;
      } else if (codec === "mp3") {
        contentType = "audio/mpeg";
      } else if (codec === "flac") {
        contentType = "audio/flac";
      } else if (codec === "opus" || codec === "vorbis") {
        contentType = `audio/webm; codecs="${codec}"`;
      } else {
        contentType = `audio/mp4; codecs="${codec}"`; // fallback
      }
    }

    const config = {
      type: "file",
      [type]: {
        contentType: contentType,
        width: 1920,
        height: 1080,
        bitrate: 5000000,
        framerate: 30,
      },
    };

    try {
      const result = await navigator.mediaCapabilities.decodingInfo(config);
      return result.supported;
    } catch (e) {
      return false;
    }
  };

  const results = {
    video: [],
    audio: [],
    formats: ["mp4", "webm", "ogg", "mov", "matroska"],
  };

  for (const codec of videoCodecs) {
    if (await check("video", codec)) {
      if (codec.startsWith("avc1")) results.video.push("h264");
      else if (codec.startsWith("vp09")) results.video.push("vp9");
      else if (codec.startsWith("hev1")) results.video.push("hevc");
      else if (codec.startsWith("av01")) results.video.push("av1");
      else results.video.push(codec.toLowerCase());
    }
  }
  for (const codec of audioCodecs) {
    if (await check("audio", codec)) {
      if (codec.startsWith("mp4a")) results.audio.push("aac");
      else results.audio.push(codec.toLowerCase());
    }
  }

  // use Set to ensure no repetitions (like h264)
  return {
    video: [...new Set(results.video)],
    audio: [...new Set(results.audio)],
    formats: results.formats,
  };
}

// TODO: tests
export function isFileNative(metadata, nativeCaps) {
  if (!metadata || !nativeCaps) return false;
  const videoCodecs = metadata.videoCodecs || [];
  const audioCodecs = metadata.audioCodecs || [];
  const container = (metadata.container || "").toLowerCase();
  //
  const isContainerOk = (nativeCaps.formats || []).some((format) =>
    container.includes(format.toLowerCase()),
  );
  if (!isContainerOk) return false;
  // every track must be supported
  const videoOk = videoCodecs.every((codec) =>
    (nativeCaps.video || []).includes(codec.toLowerCase()),
  );
  if (!videoOk) return false;
  // every track must be supported
  const audioOk = audioCodecs.every((codec) =>
    (nativeCaps.audio || []).includes(codec.toLowerCase()),
  );
  return audioOk;
}
