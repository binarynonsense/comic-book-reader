/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// ref: https://developers.google.com/youtube/iframe_api_reference

let g_ytPlayer;
let g_checkYTInterval = null;
let g_connectionTimeout = null;

let rendererOnError;

window.onYouTubeIframeAPIReady = function () {
  // console.log("onYouTubeIframeAPIReady");
};

export function getPlayer() {
  return g_ytPlayer;
}

export function init(onError) {
  rendererOnError = onError;
}

///////////////////////////////////////////////////////////////////////////////
// CREATE / DESTROY ///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function createNewPlayer(
  videoId,
  time,
  volume,
  refreshUI,
  updateTrackData,
  onPlaySucceeded,
  onEnded,
) {
  if (g_connectionTimeout) clearTimeout(g_connectionTimeout);
  g_connectionTimeout = setTimeout(() => {
    console.error("MASTER WATCHDOG: YT failed to initialize in 6s");

    if (g_checkYTInterval) {
      clearInterval(g_checkYTInterval);
      g_checkYTInterval = null;
    }

    const iframe = document.getElementById("mp-iframe-ytvideo");
    if (iframe) iframe.remove();
    rendererOnError("connection error");

    g_connectionTimeout = null;
  }, 6000);

  const container = document.getElementById("mp-video-div");
  if (!container) return;

  if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      (document.head || document.documentElement).appendChild(tag);
    }
  }

  g_checkYTInterval = setInterval(() => {
    if (typeof YT !== "undefined" && YT.Player && YT.loaded) {
      clearInterval(g_checkYTInterval);

      // setTimeout to prevent a synchronous hang from blocking the timer above
      setTimeout(async () => {
        if (g_ytPlayer && typeof g_ytPlayer.destroy === "function") {
          g_ytPlayer.destroy();
        }

        const iframe = document.createElement("iframe");
        iframe.id = "mp-iframe-ytvideo";
        iframe.style.border = "none";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        //   iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=1&rel=0&origin=https://www.youtube.com&controls=0&modestbranding=1&showinfo=0&iv_load_policy=3`;
        // iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&controls=0&modestbranding=1&showinfo=0&iv_load_policy=3`;
        // iframe.style.pointerEvents = "none";
        const origin = window.location.origin;
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&controls=0&modestbranding=1&showinfo=0&iv_load_policy=3&origin=${origin}`;
        iframe.style.pointerEvents = "none";

        container.appendChild(iframe);
        refreshUI();

        window.YT.ready(async function () {
          try {
            // fast internet check
            const controller = new AbortController();
            const fetchTimeout = setTimeout(() => controller.abort(), 2500);
            await fetch("https://www.youtube.com", {
              mode: "no-cors",
              cache: "no-store",
              signal: controller.signal,
            });
            clearTimeout(fetchTimeout);
            // create player
            new window.YT.Player(iframe.id, {
              events: {
                onReady: (event) => {
                  clearTimeout(g_connectionTimeout);
                  onPlaySucceeded();
                  g_ytPlayer = event.target;
                  g_ytPlayer.playVideo();
                  if (time && time > 0) g_ytPlayer.seekTo(time, true);
                  updateVolume(volume);
                  const videoData = g_ytPlayer.getVideoData();
                  const videoTitle = videoData.title;
                  const duration = g_ytPlayer.getDuration();
                  updateTrackData(videoTitle, undefined, duration);
                },
                onError: (event) => {
                  clearTimeout(g_connectionTimeout);
                  const errorCode = event.data;
                  console.log("YT player onError code: ", errorCode);
                  if (errorCode === 100) {
                    console.log("video not found");
                  } else if (errorCode === 101 || errorCode === 150) {
                    console.log("can't play in embedded player");
                  } else {
                    console.log("an error occurred loading the video");
                  }
                  rendererOnError("loading error");
                },
                onStateChange: (event) => {
                  if (
                    event.data === YT.PlayerState.PLAYING ||
                    event.data === YT.PlayerState.BUFFERING
                  ) {
                    startProgressLoop();
                  } else if (event.data === YT.PlayerState.ENDED) {
                    stopProgressLoop();
                    // show 100% time
                    const duration = g_ytPlayer.getDuration();
                    updateUI(duration, duration);
                    onEnded();
                  } else {
                    stopProgressLoop();
                  }
                },
              },
            });
          } catch (error) {
            clearTimeout(g_connectionTimeout);
            rendererOnError("connection error");
          }
        });
      }, 0);
    }
  }, 100);
}

export function destroyPlayer() {
  if (g_checkYTInterval) {
    clearInterval(g_checkYTInterval);
    g_checkYTInterval = null;
  }
  if (g_connectionTimeout) {
    clearTimeout(g_connectionTimeout);
    g_connectionTimeout = null;
  }

  stopProgressLoop();
  if (g_ytPlayer && typeof g_ytPlayer.destroy === "function") {
    g_ytPlayer.destroy();
    g_ytPlayer = null;
  }

  const iframe = document.getElementById("mp-iframe-ytvideo");
  if (iframe) {
    iframe.remove();
  }
}

///////////////////////////////////////////////////////////////////////////////
// CONTROLS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onPlay() {
  if (g_ytPlayer && g_ytPlayer.getPlayerState) {
    const state = g_ytPlayer.getPlayerState();
    if (state !== 1) {
      g_ytPlayer.playVideo();
      return true;
    }
  }
  return false;
}

export function onPause() {
  if (g_ytPlayer && g_ytPlayer.getPlayerState) {
    const state = g_ytPlayer.getPlayerState();
    if (state === 1) {
      // 1 = playing
      g_ytPlayer.pauseVideo();
      return true;
    }
  }
  return false;
}

export function stopVideo() {
  if (g_ytPlayer) {
    g_ytPlayer.stopVideo();
  }
}

export function updateVolume(value) {
  if (g_ytPlayer && g_ytPlayer.setVolume) {
    if (g_ytPlayer.isMuted()) {
      g_ytPlayer.unMute();
    }
    g_ytPlayer.setVolume(value * 100);
  }
}

export function setTime(targetSeconds) {
  if (g_ytPlayer && g_ytPlayer.seekTo) {
    g_ytPlayer.seekTo(targetSeconds, true);
  }
}

export function getProgress() {
  if (g_ytPlayer && g_ytPlayer.getCurrentTime) {
    return {
      current: g_ytPlayer.getCurrentTime(),
      total: g_ytPlayer.getDuration(),
    };
  }
  return { current: 0, total: 0 };
}

// PROGRESS BAR //////////////////////

let g_progressInterval;

let g_stallCheckLastTime = -1;
let g_stallCheckCounter = 0;

function startProgressLoop() {
  if (g_progressInterval) clearInterval(g_progressInterval);

  g_progressInterval = setInterval(() => {
    if (!g_ytPlayer || typeof g_ytPlayer.getCurrentTime !== "function") {
      return;
    }

    const current = g_ytPlayer.getCurrentTime();
    const total = g_ytPlayer.getDuration();
    // const state = g_ytPlayer.getPlayerState();

    if (!isNaN(current) && !isNaN(total) && total > 0) {
      if (current === g_stallCheckLastTime) {
        g_stallCheckCounter++;
        if (g_stallCheckCounter >= 20) {
          // 10 seconds total -> kill it, no connection?
          rendererOnError("stall error");
          return;
        }
      } else {
        g_stallCheckCounter = 0;
        g_stallCheckLastTime = current;
        updateUI(current, total);
      }
    }
  }, 500);
}

function stopProgressLoop() {
  if (g_progressInterval) {
    clearInterval(g_progressInterval);
    g_progressInterval = null;

    g_stallCheckCounter = 0;
    g_stallCheckLastTime = -1;
  }
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateUI(current, total) {
  const slider = document.getElementById("mp-slider-time");
  const timeText = document.getElementById("mp-text-time");
  const currentSec = Math.round(current || 0);
  const totalSec = Math.round(total || 0);
  if (slider) {
    slider.max = totalSec;
    slider.value = currentSec;
  }
  if (timeText) {
    timeText.textContent = `${formatTime(currentSec)} / ${formatTime(totalSec)}`;
  }
}

function formatTime(time) {
  const totalSeconds = Math.round(time || 0);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getYouTubeVideoIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11,})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
