/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { getLevelZIndex } from "./modals.js";

export function showLoadingModal(level, title) {
  const container = document.querySelector("#modals");
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.zIndex = getLevelZIndex(level);
  modal.innerHTML = `
  <div class="modal-frame modal-frame-show" style="width: 600px;">
    <div class="modal-title">${title ?? ""}</div>
    <div class="modal-progress-bar">
      <div class="modal-progress-bar-animation"></div>
    </div>
  </div>`;
  container.appendChild(modal);
  ///
  return modal;
}
