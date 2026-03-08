/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { spawn } = require("node:child_process");
const http = require("node:http");

const log = require("../../../shared/main/logger");

let g_ffmpegProcess = null;
let g_videoServer = null;
let g_activeVideoPath = "";
let g_ffmpegPath = "";

let sendIpcToRenderer;

///////////////////////////////////////////////////////////////////////////////
// SERVER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_lastResponse = null;

function closeCurrentVideo() {
  if (g_ffmpegProcess) {
    log.editor("[ffmpeg] killing g_ffmpegProcess");
    if (g_ffmpegProcess.stdout) {
      g_ffmpegProcess.stdout.unpipe();
      g_ffmpegProcess.stdout.destroy();
    }
    g_ffmpegProcess.kill("SIGKILL");
    g_ffmpegProcess = null;
  }
  if (g_lastResponse) {
    log.editor("[ffmpeg] destroying g_lastResponse");
    g_lastResponse.end();
    g_lastResponse.destroy();
    g_lastResponse = null;
  }
}

async function startVideoServer(metadata) {
  if (g_videoServer) return g_videoServer;

  return new Promise((resolve, reject) => {
    g_videoServer = http.createServer((req, res) => {
      closeCurrentVideo();
      g_lastResponse = res;

      req.on("close", () => {
        if (g_lastResponse === res) {
          closeCurrentVideo();
        }
      });

      const requestUrl = new URL(req.url, `http://127.0.0.1`);
      const seekTime = requestUrl.searchParams.get("t") || "0";
      const videoIndex =
        requestUrl.searchParams.get("v") || metadata?.videoIndex;
      const audioIndex =
        requestUrl.searchParams.get("a") || metadata?.audioIndex;

      res.writeHead(200, {
        "Content-Type": "video/mp4",
        Connection: "close", // drop the old connection
      });

      const sTime = parseFloat(seekTime) || 0;
      const totalDuration = parseFloat(metadata?.duration);
      const remainingTime =
        totalDuration && totalDuration > sTime ? totalDuration - sTime : null;

      const avFlags = getAudioVideoFlags(metadata, videoIndex, audioIndex);
      const flags = [
        "-ss",
        seekTime.toString(), // timestamp
        "-i",
        g_activeVideoPath, // file path
        "-loglevel",
        "quiet", // don't fill stderr
        ...avFlags, // dynamic mapping and codecs
      ];

      if (remainingTime !== null) {
        // t: if there is video and audio, freeze the last frame to fill any gap
        flags.push("-t", remainingTime.toString());
        if (metadata?.hasVideo && metadata?.hasAudio) {
          // tpad=stop=-1: repeat the last frame indefinitely, -t cuts it at end
          // tpad=stop=-1:stop_mode=clone: would clone the last frame
          flags.push("-vf", "tpad=stop=-1");
        }
      }

      flags.push(
        "-preset",
        "ultrafast", // quicker for seeking
        "-tune",
        "zerolatency", // no lookahead buffer and internal frame caching
        "-f",
        "mp4",
        "-movflags",
        // frag_keyframe: fragmented MP4 to play as it's built
        // empty_moov: allows stream to start without a fixed duration header
        // default_base_moof: helps the browser align the chunks of video
        "frag_keyframe+empty_moov+default_base_moof",
        "pipe:1", // directs data to stdout
      );
      log.editor(`[ffmpeg] flags: ${flags}`);

      g_ffmpegProcess = spawn(g_ffmpegPath, flags, {
        // stdin: ignored, stdout: piped to res, stderr: ignored
        stdio: ["ignore", "pipe", "ignore"],
      });

      g_ffmpegProcess.on("exit", (code, signal) => {
        log.editor(
          `[ffmpeg] ffmpeg exited with code ${code} and signal ${signal}`,
        );
      });
      g_ffmpegProcess.stdout.on("error", (err) => {
        log.editor(`[ffmpeg] stdout error: ${err.message}`);
      });

      g_ffmpegProcess.stdout.pipe(res);
    });

    g_videoServer.once("error", (error) => {
      g_videoServer = null;
      reject(error);
    });

    g_videoServer.listen(0, "127.0.0.1", () => {
      const port = g_videoServer.address().port;
      log.editor(`[ffmpeg] server active on port ${port}`);
      resolve(g_videoServer);
    });
  });
}

function getAudioVideoFlags(metadata, videoIndex, audioIndex) {
  if (!metadata || (videoIndex === undefined && audioIndex === undefined)) {
    // let ffmpeg decide the best tracks
    const autoFlags = [];
    if (!metadata || metadata.hasVideo) {
      autoFlags.push("-c:v", "libx264");
    } else {
      autoFlags.push("-vn"); // no video
    }
    if (!metadata || metadata.hasAudio) {
      autoFlags.push("-c:a", "aac", "-ac", "2");
    } else {
      autoFlags.push("-an"); // no audio
    }
    return autoFlags;
  }

  const flags = [];
  if (metadata.hasVideo) {
    const vIdx = videoIndex ?? metadata.videoTracks[0]?.index;
    flags.push("-map", `0:${vIdx}`, "-c:v", "libx264");
  } else {
    flags.push("-vn");
  }
  if (metadata.hasAudio) {
    const aIdx = audioIndex ?? metadata.audioTracks[0]?.index;
    flags.push("-map", `0:${aIdx}`, "-c:a", "aac", "-ac", "2");
  } else {
    flags.push("-an");
  }
  return flags;
}

exports.updateFfmpegPath = function (ffmpegPath) {
  g_ffmpegPath = ffmpegPath;
};

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.initOnIpcCallbacks = function (on, _sendIpcToRenderer) {
  sendIpcToRenderer = _sendIpcToRenderer;

  on("mp-ffmpeg-load-video", async (filePath, time, metadata) => {
    g_activeVideoPath = filePath;
    try {
      const server = await startVideoServer(metadata);
      const port = server.address().port;
      const duration = metadata.duration;

      if (duration) {
        sendIpcToRenderer("mp-ffmpeg-video-metadata", {
          duration,
          time,
          port,
        });
      } else {
        sendIpcToRenderer("mp-ffmpeg-player-error", {
          message: "Invalid video format.",
        });
      }
    } catch (error) {
      sendIpcToRenderer("mp-ffmpeg-player-error", {
        message: error.message || error,
      });
    }
  });

  on("mp-ffmpeg-close-video", () => {
    try {
      closeCurrentVideo();
    } catch (error) {}
  });

  on("mp-ffmpeg-close-player", () => {
    if (g_ffmpegProcess) {
      g_ffmpegProcess.kill("SIGKILL");
      g_ffmpegProcess = null;
    }
    setTimeout(() => {
      if (g_videoServer) {
        g_videoServer.close();
        g_videoServer = null;
      }
    }, 200);
  });
};

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function getMetadataComplete(bin, file) {
  if (!bin) bin = g_ffmpegPath;
  const probe = bin.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");

  const fallbackObj = {
    usedFFprobe: false,
    duration: null,
    container: "",
    sizeBytes: 0,
    bitrate: 0,
    title: "",
    artist: "",
    comment: "",
    hasVideo: false,
    width: 0,
    height: 0,
    videoCodecs: [],
    hasAudio: false,
    audioCodecs: [],
    sampleRate: null,
    channels: null,
    audioTracks: [],
    subtitles: [],
  };

  return new Promise((resolve) => {
    const TIMEOUT_MS = 5000;
    let resolved = false;

    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration,format_name,size,bit_rate:format_tags:stream=index,codec_name,codec_type,width,height,sample_rate,channels,channel_layout,duration:stream_tags:stream_disposition=attached_pic",
      "-of",
      "json",
      file,
    ];

    const child = spawn(probe, args);
    let stdout = "";

    // timer just in case it hangs
    const timer = setTimeout(() => {
      if (!resolved) {
        child.kill("SIGKILL");
      }
    }, TIMEOUT_MS);

    child.stdout.on("data", (data) => {
      stdout += data;
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (resolved) return;

      if (code === 0 && stdout) {
        try {
          const data = JSON.parse(stdout);
          const streams = data?.streams || [];
          const format = data?.format || {};
          const fTags = format?.tags || {};

          const vStreams = streams.filter(
            (s) =>
              s.codec_type === "video" &&
              s.disposition?.attached_pic !== 1 &&
              s.codec_name !== "mjpeg" &&
              s.codec_name !== "png" &&
              s.codec_name !== "bmp",
          );
          const aStreams = streams.filter((s) => s.codec_type === "audio");
          const sStreams = streams.filter((s) => s.codec_type === "subtitle");

          const mainVideo = vStreams[0] || {};
          const mainAudio = aStreams[0] || {};
          const vTags = mainVideo?.tags || {};

          resolved = true;
          resolve({
            usedFFprobe: true,
            duration: parseFloat(format.duration) || null,
            container: format.format_name || "",
            sizeBytes: parseInt(format.size) || 0,
            bitrate: parseInt(format.bit_rate) || 0,

            title:
              fTags.title || fTags.TITLE || vTags.title || vTags.TITLE || "",
            artist: fTags.artist || fTags.ARTIST || fTags.composer || "",
            comment:
              fTags.comment || fTags.DESCRIPTION || fTags.description || "",

            hasVideo: vStreams.length > 0,
            width: mainVideo.width || 0,
            height: mainVideo.height || 0,
            videoCodecs: vStreams.map((st) => st.codec_name).filter(Boolean),

            hasAudio: aStreams.length > 0,
            audioCodecs: aStreams.map((st) => st.codec_name).filter(Boolean),
            sampleRate: mainAudio.sample_rate
              ? parseInt(mainAudio.sample_rate)
              : null,
            channels: mainAudio.channels || null,

            audioTracks: aStreams.map((st, i) => {
              const lang = (
                st.tags?.language ||
                st.tags?.LANGUAGE ||
                "und"
              ).toUpperCase();
              const codec = (st.codec_name || "unknown").toUpperCase();
              const title =
                st.tags?.title || st.tags?.TITLE || `Track ${i + 1}`;
              return {
                index: st.index ?? i,
                codec: codec,
                duration:
                  parseDuration(st.duration) ||
                  parseDuration(st.tags?.DURATION) ||
                  parseDuration(data.format?.duration),
                language: lang.toLowerCase(),
                title: `${title} [${codec}]`,
                // isDefault: st.disposition?.default === 1,
                // isForced: st.disposition?.forced === 1,
              };
            }),

            videoTracks: vStreams.map((st, i) => ({
              index: st.index ?? i,
              codec: st.codec_name || "unknown",
              duration:
                parseDuration(st.duration) ||
                parseDuration(st.tags?.DURATION) ||
                parseDuration(data.format?.duration),
              width: st.width || 0,
              height: st.height || 0,
              language: st.tags?.language || st.tags?.LANGUAGE || "und",
              title:
                st.tags?.title || st.tags?.TITLE || `${st.width}x${st.height}`,
              // isDefault: st.disposition?.default === 1,
              // isForced: st.disposition?.forced === 1,
            })),

            subtitles: sStreams
              .filter((st) =>
                ["subrip", "ass", "ssa", "mov_text", "webvtt", "text"].includes(
                  st.codec_name?.toLowerCase(),
                ),
              )
              .map((st, i) => {
                const lang = (
                  st.tags?.language ||
                  st.tags?.LANGUAGE ||
                  "und"
                ).toUpperCase();
                const codec = (st.codec_name || "SRT").toUpperCase();
                const displayTitle =
                  st.tags?.title || st.tags?.TITLE || `${lang} [${codec}]`;
                return {
                  index: st.index ?? i,
                  codec: st.codec_name || "unknown",
                  language: lang.toLowerCase(),
                  title: displayTitle,
                  isExternal: false,
                };
              }),
          });
          return;
        } catch (error) {}
      }

      // fallback using spawn for the null muxer check
      const fallbackChild = spawn(bin, ["-i", file, "-f", "null", "-"]);
      let fallbackStderr = "";

      // timer just in case it hangs
      const fallbackTimer = setTimeout(() => {
        if (!resolved) {
          fallbackChild.kill("SIGKILL");
        }
      }, TIMEOUT_MS);

      fallbackChild.stderr.on("data", (data) => {
        fallbackStderr += data;
      });

      fallbackChild.on("close", () => {
        clearTimeout(fallbackTimer);
        if (resolved) return;
        resolved = true;

        const info = fallbackStderr || "";
        const match = info.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        let total = null;
        if (match) {
          total =
            parseInt(match[1]) * 3600 +
            parseInt(match[2]) * 60 +
            parseInt(match[3]);
        }

        resolve({
          ...fallbackObj,
          duration: total,
          hasVideo: info.toLowerCase().includes("video:"),
          hasAudio: info.toLowerCase().includes("audio:"),
        });
      });
    });
  });
}
exports.getMetadataComplete = getMetadataComplete;

function parseDuration(val) {
  if (!val || val === "N/A") return null;
  if (!isNaN(val)) return parseFloat(val);
  // handle HH:MM:SS.ms strings
  const parts = val.split(":").map(parseFloat);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseFloat(val) || null;
}

async function extractSubtitleText(bin, file, index) {
  const ffmpegPath = bin || g_ffmpegPath;

  return new Promise((resolve) => {
    try {
      const args = [
        "-loglevel",
        "error", // only show errors
        "-i",
        file,
        "-map",
        `0:${index}`,
        "-c:s",
        "srt", // force conversion to SRT text format
        "-f",
        "srt",
        "-", // output to stdout
      ];

      const child = spawn(ffmpegPath, args);
      let stdoutData = [];
      let stderrData = [];

      // 30 seconds timeout to prevent hanging on corrupted files
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        console.error("FFmpeg extraction timed out for file:", file);
        resolve(null);
      }, 30000);

      child.stdout.on("data", (chunk) => {
        stdoutData.push(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderrData.push(chunk);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          if (code !== null) {
            console.error(
              `ffmpeg failed (code ${code}):`,
              Buffer.concat(stderrData).toString(),
            );
          }
          return resolve(null);
        }
        // combine chunks and strip the Byte Order Mark (\uFEFF)
        const fullOutput = Buffer.concat(stdoutData).toString("utf8");
        const cleanOutput = fullOutput.replace(/^\uFEFF/, "").trim();
        resolve(cleanOutput.length > 0 ? cleanOutput : null);
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        console.error("failed to start FFmpeg process:", error);
        resolve(null);
      });
    } catch (error) {
      console.error("unexpected error during extraction:", error);
      resolve(null);
    }
  });
}
exports.extractSubtitleText = extractSubtitleText;

///////////////////////////////////////////////////////////////////////////////
// CLEANUP ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const { app } = require("electron");

app.on("will-quit", () => {
  if (g_ffmpegProcess || g_videoServer) log.debug("[ffmpeg] cleaning up");
  if (g_ffmpegProcess) {
    try {
      g_ffmpegProcess.kill("SIGKILL");
    } catch (e) {}
    g_ffmpegProcess = null;
  }

  if (g_videoServer) {
    try {
      g_videoServer.close();
    } catch (e) {}
    g_videoServer = null;
  }
});

process.on("exit", () => {
  if (g_ffmpegProcess) g_ffmpegProcess.kill("SIGKILL");
});
