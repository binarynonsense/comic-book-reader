/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { closeActiveModal, addActiveModal } from "./modals.js";

export function showSearchModal(
  level,
  titleText,
  messageText,
  selectOptions,
  okText,
  cancelText,
  okCallback,
  cancelCallBack,
) {
  const container = document.querySelector("#modals");
  const modal = document.createElement("div");
  modal.className = "modal";
  let selectHtml = "";
  if (selectOptions) {
    selectHtml = `<select id="modal-search-select">`;
    selectOptions.forEach((option) => {
      selectHtml += `<option value="${option.value}">${option.name}</option>`;
    });
    selectHtml += `</select>`;
  }
  modal.innerHTML = `
  <div class="modal-frame modal-frame-show">
    <div class="modal-topbar">
        <div class="modal-close-button" title="close">
            <i class="fas fa-times"></i>
        </div>
    </div>
    <div class="modal-title">${titleText}</div>
    <div class="modal-field">
        <input type="text" id="modal-search-input" >
        ${selectHtml}        
    </div>
    <div class="modal-buttons">
        <button class="modal-button" id="modal-ok-action-btn">${okText.toUpperCase()}</button>
        <button class="modal-button" id="modal-cancel-action-btn">${cancelText.toUpperCase()}</button>
    </div>
  </div>`;
  container.appendChild(modal);
  ///
  const searchInput = modal.querySelector("#modal-search-input");
  searchInput.addEventListener("input", (event) => {
    inputUpdated();
  });
  function inputUpdated() {
    if (searchInput.value.trim()) {
      okBtn.disabled = false;
    } else {
      okBtn.disabled = true;
    }
  }
  searchInput.focus();
  ///
  const closeBtn = modal.querySelector(".modal-close-button");
  closeBtn.addEventListener("click", (event) => {
    closeActiveModal(level, modal);
  });
  const okBtn = modal.querySelector("#modal-ok-action-btn");
  okBtn.addEventListener("click", (event) => {
    closeActiveModal(level, modal);
    if (okCallback)
      okCallback(
        searchInput.value.trim(),
        selectOptions
          ? modal.querySelector("#modal-search-select").value
          : null,
      );
  });
  const cancelBtn = modal.querySelector("#modal-cancel-action-btn");
  cancelBtn.addEventListener("click", (event) => {
    closeActiveModal(level, modal);
    if (cancelCallBack) cancelCallBack();
  });
  ///
  inputUpdated();
  ///
  addActiveModal(modal, level);
  return modal;
}
