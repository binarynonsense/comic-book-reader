/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { closeModal, Level, addActiveModal } from "./modals.js";

export function showKomgaLoginModal(
  titleText,
  urlText,
  typeText,
  typeOptionText1,
  typeOptionText2,
  apiKeyText,
  emailText,
  passwordText,
  rememberText,
  okText,
  cancelText,
  defaults,
  callback,
) {
  const level = Level.TOOLS;
  const container = document.querySelector("#modals");
  const modal = document.createElement("div");
  modal.className = "modal";
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
      <label for="modal-server-type-select">${typeText}</label>
      <select id="modal-server-type-select">
        <option value="0">${typeOptionText1}</option>
        <option value="1">${typeOptionText2}</option>
      </select>
    </div>
    <div class="modal-field">
      <label for="modal-server-apikey-input">${apiKeyText}</label>
      <input id="modal-server-apikey-input" value="${defaults.apiKey}"}" />
    </div>
    <div class="modal-field">
      <label for="modal-server-email-input">${emailText}</label>
      <input type="email" id="modal-server-email-input" value="${defaults.email}"}" />
    </div>
    <div class="modal-field">
      <label for="modal-server-password-input">${passwordText}</label>
      <input type="password" id="modal-server-password-input" value="${defaults.password}"/>
    </div>
    ${
      rememberText
        ? `
    <div class="modal-field">
        <label>
            <input type="checkbox" id="modal-server-remember-checkbox" checked />
            ${rememberText}
        </label>
    </div>
    `
        : ""
    }    
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
  const typeSelect = modal.querySelector("#modal-server-type-select");
  typeSelect.addEventListener("change", (event) => {
    inputUpdated();
  });
  urlInput.focus();
  //
  const apiKeyInput = modal.querySelector("#modal-server-apikey-input");
  apiKeyInput.addEventListener("input", (event) => {
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
    closeModal(modal);
    callback();
  });

  const cancelBtn = modal.querySelector("#modal-cancel-action-btn");
  cancelBtn.addEventListener("click", (event) => {
    closeModal(modal);
    callback();
  });

  const addBtn = modal.querySelector("#modal-ok-action-btn");
  addBtn.addEventListener("click", (event) => {
    closeModal(modal);
    callback({
      url: urlInput.value,
      email: emailInput.value,
      password: passwordInput.value,
      apiKey: apiKeyInput.value,
      save: rememberText
        ? modal.querySelector("#modal-server-remember-checkbox").checked
        : false,
    });
  });
  ///
  function inputUpdated() {
    if (typeSelect.value === "0") {
      // api key
      apiKeyInput.parentElement.classList.remove("set-display-none");
      emailInput.parentElement.classList.add("set-display-none");
      passwordInput.parentElement.classList.add("set-display-none");
      if (urlInput.value && apiKeyInput.value) {
        addBtn.disabled = false;
      } else {
        addBtn.disabled = true;
      }
    } else {
      apiKeyInput.parentElement.classList.add("set-display-none");
      emailInput.parentElement.classList.remove("set-display-none");
      passwordInput.parentElement.classList.remove("set-display-none");
      if (urlInput.value && passwordInput.value && emailInput.value) {
        addBtn.disabled = false;
      } else {
        addBtn.disabled = true;
      }
    }
  }
  ///
  inputUpdated();
  ///
  addActiveModal(modal, level);
  return modal;
}
