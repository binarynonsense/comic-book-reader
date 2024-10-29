/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

let g_panzoom;

export function initView() {
  const elem = document.getElementById("result-div");
  g_panzoom = Panzoom(elem, {
    maxScale: 5,
  });
  elem.parentElement.addEventListener("wheel", g_panzoom.zoomWithWheel);

  document
    .getElementById("zoom-button-1")
    .addEventListener("click", g_panzoom.zoomIn);
  document
    .getElementById("zoom-button-2")
    .addEventListener("click", g_panzoom.zoomOut);
  document
    .getElementById("zoom-button-3")
    .addEventListener("click", g_panzoom.reset);

  document
    .getElementById("result-div")
    .parentElement.addEventListener("dblclick", function (e) {
      g_panzoom.reset();
      e.preventDefault();
    });
}

export function resetView() {
  g_panzoom.reset();
}
