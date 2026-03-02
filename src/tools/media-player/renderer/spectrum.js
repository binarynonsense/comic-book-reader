/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

let g_audioContext = null;
let g_analyser = null;
let g_source = null;
let g_animationId = null;
let g_dataArray = null;
let g_peaks = [];
let g_resizeObserver = null;

const GRAVITY = 1.2;
const FFT_SIZE = 128; // 64 bars

let g_pulseLight = true;
let g_pulseSensitivity = 1.9; //1.5; //1.8;
let g_pulseFloor = 0.1; //0.2;

export function start() {
  const video = document.getElementById("mp-html-video");
  const canvas = document.getElementById("mp-spectrum-canvas");
  const container = document.getElementById("mp-spectrum-div");

  if (!video || !canvas || !container) return;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (!g_resizeObserver) {
    g_resizeObserver = new ResizeObserver(() => {
      // resize canvas if parent width changes
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    });
    g_resizeObserver.observe(container);
  }

  if (!g_audioContext) {
    // use Web Audio analyzer for the heavy lifting
    g_audioContext = new (window.AudioContext || window.webkitAudioContext)();
    g_analyser = g_audioContext.createAnalyser();
    g_analyser.fftSize = FFT_SIZE;
    g_source = g_audioContext.createMediaElementSource(video);
    g_source.connect(g_analyser);
    g_analyser.connect(g_audioContext.destination);
    g_dataArray = new Uint8Array(g_analyser.frequencyBinCount);
    g_peaks = new Array(g_analyser.frequencyBinCount).fill(0);
  }

  if (g_audioContext.state === "suspended") g_audioContext.resume();

  function render() {
    g_animationId = requestAnimationFrame(render);
    g_analyser.getByteFrequencyData(g_dataArray);

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if (g_pulseLight) {
      // average the volume of all bars to control backlight intensity
      const sum = g_dataArray.reduce((a, b) => a + b, 0);
      const avg = sum / g_dataArray.length;
      const rawIntensity = (avg / 255) * g_pulseSensitivity;
      const finalIntensity = Math.min(1.0, g_pulseFloor + rawIntensity);
      container.style.setProperty(
        "--mp-spectrum-pulse-intensity",
        finalIntensity.toFixed(2),
      );
    } else {
      container.style.setProperty(
        "--mp-spectrum-pulse-intensity",
        g_pulseFloor.toString(),
      );
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // using Math.floor to ensure pixel perfect
    const barCount = g_dataArray.length;
    const barWidth = Math.floor(canvasWidth / barCount);
    const totalVisW = barCount * barWidth;
    // leftover space
    const sideGap = Math.floor((canvasWidth - totalVisW) / 2);
    const verticalGap = sideGap;
    // safe zone
    const availableH = canvasHeight - verticalGap * 2;

    const gradient = ctx.createLinearGradient(
      0,
      canvasHeight - verticalGap,
      0,
      verticalGap,
    );
    gradient.addColorStop(0, "#005500");
    gradient.addColorStop(0.3, "#00ff00");
    gradient.addColorStop(0.6, "#ffff00");
    gradient.addColorStop(1, "#ff0000");

    for (let i = 0; i < barCount; i++) {
      const x = sideGap + i * barWidth;
      // update peak white thin bar
      const barH = Math.floor((g_dataArray[i] / 255) * availableH);
      if (barH > g_peaks[i]) {
        g_peaks[i] = barH;
      } else {
        g_peaks[i] -= GRAVITY;
        if (g_peaks[i] < 0) g_peaks[i] = 0;
      }
      ctx.fillStyle = gradient;
      // bar
      ctx.fillRect(x, canvasHeight - verticalGap - barH, barWidth - 1, barH);
      // peak
      ctx.fillStyle = "#DCDCDC";
      const peakY = Math.floor(canvasHeight - verticalGap - g_peaks[i]);
      ctx.fillRect(x, peakY - 2, barWidth - 1, 2);
    }
  }

  if (!g_animationId) render();
}

export function stop() {
  if (g_animationId) {
    cancelAnimationFrame(g_animationId);
    g_animationId = null;
  }
  if (g_resizeObserver) {
    g_resizeObserver.disconnect();
    g_resizeObserver = null;
  }
}
