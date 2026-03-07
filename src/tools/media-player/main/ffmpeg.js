/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { spawn, exec } = require("node:child_process");
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
  // kill old response still hanging
  if (g_lastResponse) {
    log.editor("[ffmpeg] destroying g_lastResponse");
    try {
      g_lastResponse.end();
      g_lastResponse.destroy();
    } catch (error) {}
  }
  g_lastResponse = null;
  // kill the old ffmpeg
  if (g_ffmpegProcess) {
    log.editor("[ffmpeg] killing g_ffmpegProcess");
    g_ffmpegProcess.kill("SIGKILL");
    g_ffmpegProcess = null;
  }
}

async function startVideoServer() {
  if (g_videoServer) return g_videoServer;

  return new Promise((resolve, reject) => {
    g_videoServer = http.createServer((req, res) => {
      closeCurrentVideo();
      g_lastResponse = res;

      const requestUrl = new URL(req.url, `http://127.0.0.1`);
      const seekTime = requestUrl.searchParams.get("t") || "0";

      res.writeHead(200, { "Content-Type": "video/mp4" });

      g_ffmpegProcess = spawn(
        g_ffmpegPath,
        [
          "-ss",
          seekTime.toString(), // timestamp
          "-i",
          g_activeVideoPath, // file path
          "-loglevel",
          "quiet", // don't feel stderr
          "-c:v",
          "libx264", // convert to h264 so chromium can play it
          "-preset",
          "ultrafast", // quicker for seeking
          "-tune",
          "zerolatency", // no lookahead buffer and internal frame caching
          "-c:a",
          "aac", // aac audio for the mp4
          "-f",
          "mp4",
          "-movflags",
          // frag_keyframe: fragmented MP4 to play as it's built
          // empty_moov: allows stream to start without a fixed duration header
          // default_base_moof: helps the browser align the chunks of video
          "frag_keyframe+empty_moov+default_base_moof",
          "pipe:1", // directs data to stdout
        ],
        {
          // stdin: ignored, stdout: piped to res, stderr: ignored
          stdio: ["ignore", "pipe", "ignore"],
        },
      );

      g_ffmpegProcess.on("exit", (code, signal) => {
        log.editor(
          `[ffmpeg] ffmpeg exited with code ${code} and signal ${signal}`,
        );
      });

      g_ffmpegProcess.stdout.pipe(res);

      req.on("close", () => {
        if (g_ffmpegProcess) {
          g_ffmpegProcess.kill();
          g_ffmpegProcess = null;
        }
      });
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

exports.updateFfmpegPath = function (ffmpegPath) {
  g_ffmpegPath = ffmpegPath;
};

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.initOnIpcCallbacks = function (on, _sendIpcToRenderer) {
  sendIpcToRenderer = _sendIpcToRenderer;

  on("mp-ffmpeg-load-video", async (filePath, time) => {
    g_activeVideoPath = filePath;
    try {
      const server = await startVideoServer();
      const port = server.address().port;
      const duration = await getMetadataDuration(g_ffmpegPath, filePath);

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

// const fs = require("node:fs");
// async function getValidFfmpegPath(customPath) {
//   if (customPath && fs.existsSync(customPath)) return customPath;

//   return new Promise((resolve, reject) => {
//     const cmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";

//     exec(cmd, (err, stdout) => {
//       if (!err && stdout) {
//         const path = stdout.trim().split("\n")[0].trim();
//         resolve(path);
//       } else {
//         reject("ffmpeg binary not found in system PATH");
//       }
//     });
//   });
// }
// exports.getValidFfmpegPath = getValidFfmpegPath;

async function getMetadataDuration(bin, file) {
  const probe = bin.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
  return new Promise((resolve) => {
    // ffprobe
    const cmd = `"${probe}" -v error -select_streams v:0 -show_entries format=duration -of json "${file}"`;
    exec(cmd, (err, stdout) => {
      if (!err && stdout) {
        try {
          resolve(JSON.parse(stdout).format.duration);
        } catch (e) {
          resolve(null);
        }
      } else {
        // ffmpeg fallback
        exec(`"${bin}" -i "${file}" -f null -`, (fe, fo, fe2) => {
          const match = (fe2 || "").match(
            /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/,
          );
          if (match) {
            const total =
              parseInt(match[1]) * 3600 +
              parseInt(match[2]) * 60 +
              parseInt(match[3]);
            resolve(total);
          } else resolve(null);
        });
      }
    });
  });
}

// async function getMetadataExtended(bin, file) {
//   if (!bin) bin = g_ffmpegPath;
//   const probe = bin.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");

//   return new Promise((resolve) => {
//     const cmd = `"${probe}" -v error -show_entries format=duration,format_name -show_entries stream=codec_name,codec_type -show_entries stream_disposition=attached_pic -of json "${file}"`;

//     exec(cmd, (err, stdout) => {
//       if (!err && stdout) {
//         try {
//           const data = JSON.parse(stdout);
//           const streams = data.streams || [];

//           const realVideoStreams = streams.filter(
//             (s) =>
//               s.codec_type === "video" && s.disposition?.attached_pic !== 1,
//           );

//           const audioStreams = streams.filter((s) => s.codec_type === "audio");

//           resolve({
//             usedFFprobe: true,
//             duration: parseFloat(data.format?.duration) || null,
//             container: data.format?.format_name || "",
//             videoCodecs: realVideoStreams.map((s) => s.codec_name),
//             audioCodecs: audioStreams.map((s) => s.codec_name),
//             hasVideo: realVideoStreams.length > 0,
//             hasAudio: audioStreams.length > 0,
//           });
//           return;
//         } catch (error) {}
//       }

//       exec(`"${bin}" -i "${file}" -f null -`, (fe, fo, fe2) => {
//         const output = fe2 || "";
//         const match = output.match(
//           /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/,
//         );
//         let total = null;
//         if (match) {
//           total =
//             parseInt(match[1]) * 3600 +
//             parseInt(match[2]) * 60 +
//             parseInt(match[3]);
//         }

//         resolve({
//           usedFFprobe: false,
//           duration: total,
//           container: "",
//           videoCodecs: [],
//           audioCodecs: [],
//           hasVideo: output.toLowerCase().includes("video:"),
//           hasAudio: output.toLowerCase().includes("audio:"),
//         });
//       });
//     });
//   });
// }

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
    const cmd = `"${probe}" -v error -show_entries format=duration,format_name,size,bit_rate:format_tags:stream=index,codec_name,codec_type,width,height,sample_rate,channels,channel_layout:stream_tags:stream_disposition=attached_pic -of json "${file}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (!error && stdout) {
        try {
          const data = JSON.parse(stdout);
          const streams = data?.streams || [];
          const format = data?.format || {};
          const fTags = format?.tags || {};

          const vStreams = streams.filter(
            (s) =>
              s.codec_type === "video" && s.disposition?.attached_pic !== 1,
          );
          const aStreams = streams.filter((s) => s.codec_type === "audio");
          const sStreams = streams.filter((s) => s.codec_type === "subtitle");

          const mainVideo = vStreams[0] || {};
          const mainAudio = aStreams[0] || {};
          const vTags = mainVideo?.tags || {};

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

            audioTracks: aStreams.map((st, i) => ({
              index: st.index ?? i,
              codec: st.codec_name || "unknown",
              language: st.tags?.language || st.tags?.LANGUAGE || "und",
              name: st.tags?.title || st.tags?.TITLE || `Track ${i + 1}`,
            })),

            subtitles: sStreams.map((st, i) => ({
              index: st.index ?? i,
              codec: st.codec_name || "unknown",
              language: st.tags?.language || st.tags?.LANGUAGE || "und",
              title: st.tags?.title || st.tags?.TITLE || `Subtitle ${i + 1}`,
              isExternal: false,
            })),
          });
          return;
        } catch (error) {}
      }

      // fallback
      exec(
        `"${bin}" -i "${file}" -f null -`,
        (errorFallback, stdoutFallback, stderrFallback) => {
          const info = stderrFallback || "";
          const match = info.match(
            /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/,
          );
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
        },
      );
    });
  });
}

exports.getMetadataComplete = getMetadataComplete;

// async function extractSubtitleText(bin, file, index) {
//   if (!bin) bin = g_ffmpegPath;
//   return new Promise((resolve) => {
//     const cmd = `"${bin}" -i "${file}" -map 0:${index} -f srt -`;
//     exec(
//       cmd,
//       { encoding: "utf8", maxBuffer: 1024 * 1024 * 10 },
//       (error, stdout, stderr) => {
//         // remove any BOM/hidden whitespace
//         const cleanStdout = stdout ? stdout.toString().trim() : "";
//         if (!error && cleanStdout.length > 0) {
//           resolve(cleanStdout);
//         } else {
//           resolve(null);
//         }
//       },
//     );
//   });
// }
// exports.extractSubtitleText = extractSubtitleText;

const { spawn } = require("child_process");

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
