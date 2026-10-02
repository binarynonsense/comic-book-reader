/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { closeActiveModal, addActiveModal } from "./modals.js";

export function showInfoModal(
  level,
  titleText,
  messageText,
  okText,
  cancelText,
  okCallback,
  cancelCallBack,
) {
  console.log(level);
  const container = document.querySelector("#modals");
  const modal = document.createElement("div");
  modal.className = "modal";
  if (messageText) messageText = messageText.replace(/\n/g, "<br>");
  modal.innerHTML = `
  <div class="modal-frame modal-frame-show">
    <div class="modal-topbar">
        <div class="modal-close-button" title="close">
            <i class="fas fa-times"></i>
        </div>
    </div>
    <div class="modal-title">${titleText}</div>
    ${messageText ? `<div class="modal-message">${messageText}</div>` : ""}
    <div class="modal-buttons">
        <button class="modal-button" id="modal-ok-action-btn">${okText.toUpperCase()}</button>
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
  const closeBtn = modal.querySelector(".modal-close-button");
  closeBtn.addEventListener("click", (event) => {
    closeActiveModal(level, modal);
  });
  const okBtn = modal.querySelector("#modal-ok-action-btn");
  okBtn.addEventListener("click", (event) => {
    closeActiveModal(level, modal);
    if (okCallback) okCallback();
  });
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
