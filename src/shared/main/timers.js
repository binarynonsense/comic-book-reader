/**
 * @license
 * Copyright 2023-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

let g_timers = {};

exports.start = function (label) {
  if (!label || typeof label !== "string" || label.trim() === "") return;
  g_timers[label] = performance.now();
};

exports.stop = function (label) {
  if (!label || typeof label !== "string" || label.trim() === "") return;
  const time = performance.now() - g_timers[label];
  delete g_timers[label];
  return time / 1000;
};
