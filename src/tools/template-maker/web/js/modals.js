/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function initModals() {
  document.querySelectorAll(".modal-close-button").forEach((element) =>
    element.addEventListener("click", (event) => {
      closeOpenModal();
    })
  );
  // close if clicking outside the modal
  // window.addEventListener("load", function () {
  //   document.addEventListener("click", (event) => {
  //     if (event.target.classList.contains("modal")) {
  //       closeOpenModal();
  //     }
  //   });
  // });
}

export function openModal(id) {
  document.getElementById(id).classList.add("modal-open");
}

export function closeOpenModal() {
  document.querySelector(".modal-open").classList.remove("modal-open");
}

// ref: https://stackblitz.com/edit/vanilla-js-css-modal-popup-example?file=index.html
