/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { addActiveModal, closeActiveModal } from "./modals.js";

export function showLoadingModal(
  level,
  animateBar,
  titleText,
  messageText,
  cancelText,
  cancelCallBack,
) {
  const container = document.querySelector("#modals");
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
  <div class="modal-frame modal-frame-show" style="width: 600px;">
    <div class="modal-title">${titleText ?? ""}</div>     
    ${messageText ? `<div class="modal-message">${messageText}</div>` : ""}
    <div class="modal-progress-bar">
      <div class="${animateBar ? `modal-progress-bar-animation` : `modal-progress-bar-fill`}"></div>
    </div>   
    <div class="modal-buttons">
    ${
      cancelText
        ? `<button class="modal-button" id="modal-cancel-action-btn">
          ${cancelText.toUpperCase()}
        </button>`
        : ""
    }
    </div>
  </div>`;
  container.appendChild(modal);
  ///
  if (cancelText) {
    const cancelBtn = modal.querySelector("#modal-cancel-action-btn");
    cancelBtn.addEventListener("click", (event) => {
      closeActiveModal(level, modal);
      if (cancelCallBack) cancelCallBack();
    });
  }
  ///
  addActiveModal(modal, level);
  return modal;
}
