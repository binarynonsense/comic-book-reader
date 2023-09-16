/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

let g_timers = {};

exports.start = function (label) {
  g_timers[label] = performance.now();
};

exports.stop = function (label) {
  const time = performance.now() - g_timers[label];
  delete g_timers[label];
  return (time / 1000).toFixed(3);
};
