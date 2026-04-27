/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export const PlayerState = {
  NOT_SET: "not_set",
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED: "paused",
};

export const PlayerMediaType = {
  NOT_SET: "not_set",
  AUDIO: "audio",
  VIDEO: "video",
};

export const PlayerEngineType = {
  NOT_SET: "not_set",
  NATIVE: "native",
  FFMPEG: "ffmpeg",
  YOUTUBE: "youtube",
};
