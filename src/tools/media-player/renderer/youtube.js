/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// ref: https://developers.google.com/youtube/iframe_api_reference

let g_ytPlayer;
let g_rendererErrorHandler;

window.onYouTubeIframeAPIReady = function () {
  // console.log("onYouTubeIframeAPIReady");
};

export function getPlayer() {
  return g_ytPlayer;
}

export function init(handler) {
  g_rendererErrorHandler = handler;
  addSliderHandler();
}

///////////////////////////////////////////////////////////////////////////////
// CREATE / DESTROY ///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const onError = (type) => {
  console.error(type);
  destroyPlayer();

  // TODO: real localized messages, not the type string
  const playerDiv = document.getElementById("mp-div-ytvideo");
  playerDiv.innerHTML = `
        <div style="background:#000; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
            <p>${type}</p>
        </div>
    `;

  g_rendererErrorHandler(type);
};

export function createNewPlayer(videoId, volume, refreshUI, updateTrackData) {
  if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  const checkYT = setInterval(() => {
    if (typeof YT !== "undefined" && YT.Player && YT.loaded) {
      clearInterval(checkYT);

      const container = document.getElementById("mp-div-ytvideo");
      if (!container) return;

      if (g_ytPlayer && typeof g_ytPlayer.destroy === "function") {
        g_ytPlayer.destroy();
      }
      container.innerHTML = "";

      const iframe = document.createElement("iframe");
      iframe.id = "mp-iframe-ytvideo";
      iframe.style.border = "none";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      //   iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=1&rel=0&origin=https://www.youtube.com&controls=0&modestbranding=1&showinfo=0&iv_load_policy=3`;
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&controls=0&modestbranding=1&showinfo=0&iv_load_policy=3`;
      iframe.style.pointerEvents = "none";

      container.appendChild(iframe);
      refreshUI();

      window.YT.ready(async function () {
        // fast internet check
        const isYoutubeUp = await fetch("https://www.youtube.com", {
          mode: "no-cors",
          cache: "no-store",
        })
          .then(() => true)
          .catch(() => false);

        if (!isYoutubeUp) {
          onError("connection error");
          return;
        }

        const connectionTimeout = setTimeout(() => {
          onError("connection error");
        }, 3000);

        new window.YT.Player(iframe.id, {
          events: {
            onReady: (event) => {
              clearTimeout(connectionTimeout);
              g_ytPlayer = event.target;
              g_ytPlayer.playVideo();
              updateVolume(volume);
              const videoData = g_ytPlayer.getVideoData();
              const videoTitle = videoData.title;
              const duration = g_ytPlayer.getDuration();
              updateTrackData(videoTitle, undefined, duration);
            },
            onError: (event) => {
              clearTimeout(connectionTimeout);
              const errorCode = event.data;
              console.log("YT player onError code: ", errorCode);
              if (errorCode === 100) {
                console.log("video not found");
              } else if (errorCode === 101 || errorCode === 150) {
                console.log("can't play in embedded player");
              } else {
                console.log("an error occurred loading the video");
              }
              onError("loading error");
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
              } else {
                stopProgressLoop();
              }
            },
          },
        });
      });
    }
  }, 100);
}

export function destroyPlayer() {
  stopProgressLoop();
  if (g_ytPlayer && typeof g_ytPlayer.destroy === "function") {
    g_ytPlayer.destroy();
    g_ytPlayer = null;
  }
  const container = document.getElementById("mp-div-ytvideo");
  if (container) container.innerHTML = "";
}

///////////////////////////////////////////////////////////////////////////////
// CONTROLS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onPlayClicked() {
  if (g_ytPlayer && g_ytPlayer.getPlayerState) {
    const state = g_ytPlayer.getPlayerState();
    if (state !== 1) {
      g_ytPlayer.playVideo();
      return true;
    }
  }
  return false;
}

export function onPauseClicked() {
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

export function seekToTime(seconds) {
  if (g_ytPlayer && g_ytPlayer.seekTo) {
    g_ytPlayer.seekTo(seconds, true);
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
          onError("stall error");
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

function addSliderHandler() {
  const slider = document.getElementById("mp-slider-time");
  const timeText = document.getElementById("mp-text-time");
  slider.addEventListener("input", (e) => {
    if (g_ytPlayer && g_ytPlayer.seekTo) {
      const seekTarget = Math.floor(e.target.value);
      const total = Math.floor(g_ytPlayer.getDuration());
      g_ytPlayer.seekTo(seekTarget, true);
      if (timeText && total > 1) {
        timeText.textContent = `${formatTime(seekTarget)} / ${formatTime(total)}`;
      }
    }
  });
}

export function getYouTubeVideoIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11,})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
