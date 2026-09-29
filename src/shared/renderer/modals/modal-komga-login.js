/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { getLevelZIndex, close, Level } from "./modals.js";

export function showKomgaLoginModal(
  titleText,
  urlText,
  emailText,
  passwordText,
  rememberText,
  okText,
  cancelText,
  defaults,
  callback,
) {
  const container = document.querySelector("#modals");
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.zIndex = getLevelZIndex(Level.TOOLS);
  modal.innerHTML = `
  <div class="modal-frame modal-frame-show">
    <div class="modal-topbar">
        <div class="modal-close-button" title="close">
            <i class="fas fa-times"></i>
        </div>
    </div>
    <div class="modal-title">${titleText}</div>
    <div class="modal-field">
        <label for="modal-server-url-input">${urlText}</label>
        <input type="text" id="modal-server-url-input" value="${defaults.url}" />
    </div>
    <div class="modal-field">
        <label for="modal-server-email-input">${emailText}</label>
        <input type="email" id="modal-server-email-input" placeholder="name@example.com" value="${defaults.email}"}" />
    </div>
    <div class="modal-field">
        <label for="modal-server-password-input">${passwordText}</label>
        <input type="password" id="modal-server-password-input" value="${defaults.password}"/>
    </div>
    <div class="modal-field">
        <label>
            <input type="checkbox" id="modal-server-remember-checkbox" checked />
            ${rememberText}
        </label>
    </div>
    <div class="modal-buttons">
        <button class="modal-button" id="modal-cancel-action-btn">${cancelText.toUpperCase()}</button>
        <button class="modal-button" id="modal-ok-action-btn" disabled>${okText.toUpperCase()}</button>
    </div>
  </div>`;
  container.appendChild(modal);
  ///
  const urlInput = modal.querySelector("#modal-server-url-input");
  urlInput.addEventListener("input", (event) => {
    inputUpdated();
  });
  const emailInput = modal.querySelector("#modal-server-email-input");
  emailInput.addEventListener("input", (event) => {
    inputUpdated();
  });
  const passwordInput = modal.querySelector("#modal-server-password-input");
  passwordInput.addEventListener("input", (event) => {
    inputUpdated();
  });
  ///
  const closeBtn = modal.querySelector(".modal-close-button");
  closeBtn.addEventListener("click", (event) => {
    close(modal);
    callback();
  });

  const cancelBtn = modal.querySelector("#modal-cancel-action-btn");
  cancelBtn.addEventListener("click", (event) => {
    close(modal);
    callback();
  });

  const addBtn = modal.querySelector("#modal-ok-action-btn");
  addBtn.addEventListener("click", (event) => {
    close(modal);
    callback({
      url: urlInput.value,
      email: emailInput.value,
      password: passwordInput.value,
      save: modal.querySelector("#modal-server-remember-checkbox").checked,
    });
  });
  ///
  function inputUpdated() {
    if (urlInput.value && passwordInput.value && emailInput.value) {
      addBtn.disabled = false;
    } else {
      addBtn.disabled = true;
    }
  }
  ///
  inputUpdated();
  return modal;
}
