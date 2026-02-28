/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { spawn, exec } = require("child_process");
const http = require("node:http");
const fs = require("node:fs");

const log = require("../../../shared/main/logger");

let g_ffmpegProcess = null;
let g_videoServer = null;
let g_activeVideoPath = "";
let g_userFfmpegPath = "";

let sendIpcToRenderer;

///////////////////////////////////////////////////////////////////////////////
// SERVER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_lastResponse = null;

function closeCurrentVideo() {
  // kill old response still hanging
  if (g_lastResponse) {
    try {
      g_lastResponse.end();
      g_lastResponse.destroy();
    } catch (error) {}
  }
  g_lastResponse = null;
  // kill the old ffmpeg
  if (g_ffmpegProcess) {
    g_ffmpegProcess.kill("SIGKILL");
    g_ffmpegProcess = null;
  }
}

function startVideoServer() {
  if (g_videoServer) return;
  g_videoServer = http.createServer((req, res) => {
    closeCurrentVideo();
    g_lastResponse = res;
    const requestUrl = new URL(req.url, `http://127.0.0.1`);
    const seekTime = requestUrl.searchParams.get("t") || "0";

    res.writeHead(200, { "Content-Type": "video/mp4" });

    g_ffmpegProcess = spawn(
      g_userFfmpegPath,
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
      console.log(`FFmpeg exited with code ${code} and signal ${signal}`);
    });

    g_ffmpegProcess.stdout.pipe(res);
    req.on("close", () => g_ffmpegProcess?.kill());
  });

  g_videoServer.listen(0, "127.0.0.1", () => {
    sendIpcToRenderer("mp-ffmpeg-server-ready", {
      port: g_videoServer.address().port,
    });
  });
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.initOnIpcCallbacks = function (on, _sendIpcToRenderer) {
  sendIpcToRenderer = _sendIpcToRenderer;

  on("mp-ffmpeg-open-player", () => {
    startVideoServer();
  });

  on("mp-ffmpeg-load-video", async (filePath, time) => {
    g_activeVideoPath = filePath;
    try {
      const savedPath = undefined; //getStoredPathFromPrefs();
      g_userFfmpegPath = await getValidFfmpegPath(savedPath);
      const duration = await getMetadata(g_userFfmpegPath, filePath);
      if (duration)
        sendIpcToRenderer("mp-ffmpeg-video-metadata", { duration, time });
      else
        sendIpcToRenderer("mp-ffmpeg-player-error", {
          message: "Invalid video format.",
        });
    } catch (error) {
      sendIpcToRenderer("mp-ffmpeg-player-error", {
        message: error.message || error,
      });
    }
  });

  on("mp-ffmpeg-close-video", () => {
    try {
      log.editor("mp-ffmpeg-close-video");
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

async function getValidFfmpegPath(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;

  return new Promise((resolve, reject) => {
    const cmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";

    exec(cmd, (err, stdout) => {
      if (!err && stdout) {
        const path = stdout.trim().split("\n")[0].trim();
        resolve(path);
      } else {
        reject("ffmpeg binary not found in system PATH");
      }
    });
  });
}
exports.getValidFfmpegPath = getValidFfmpegPath;

async function getMetadata(bin, file) {
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

///////////////////////////////////////////////////////////////////////////////
// CLEANUP ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const { app } = require("electron");

app.on("will-quit", () => {
  log.debug("cleaning up ffmpeg");
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
