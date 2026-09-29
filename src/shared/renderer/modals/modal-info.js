/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { getLevelZIndex, close, Level } from "./modals.js";

export function showInfoModal(titleText, messageText, okText) {
  const container = document.querySelector("#modals");
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.zIndex = getLevelZIndex(Level.TOOLS);
  messageText = messageText.replace(/\n/g, "<br>");
  modal.innerHTML = `
  <div class="modal-frame modal-frame-show">
    <div class="modal-topbar">
        <div class="modal-close-button" title="close">
            <i class="fas fa-times"></i>
        </div>
    </div>
    <div class="modal-title">${titleText}</div>
    <div class="modal-message">${messageText}</div>   
    <div class="modal-buttons">
        <button class="modal-button" id="modal-ok-action-btn">${okText.toUpperCase()}</button>
    </div>
  </div>`;
  container.appendChild(modal);
  ///
  const closeBtn = modal.querySelector(".modal-close-button");
  closeBtn.addEventListener("click", (event) => {
    close(modal);
  });
  const okBtn = modal.querySelector("#modal-ok-action-btn");
  okBtn.addEventListener("click", (event) => {
    close(modal);
  });
  ///
  return modal;
}
