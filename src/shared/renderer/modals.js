/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function show(options) {
  let modalDiv;
  if (isObject(options)) {
    // generate html
    let modalsDiv = document.querySelector("#modals");
    modalDiv = getHTMLElement(modalsDiv);
    // frame options
    if (options.frameWidth && Number.isInteger(options.frameWidth)) {
      modalDiv.firstChild.style.width = `${options.frameWidth}px`;
    }
    // fill data ///
    // TODO: sanitize input more thoroughly
    // zindex
    if (options.zIndexDelta && Number.isInteger(options.zIndexDelta)) {
      modalDiv.style.zIndex = `${
        parseInt(
          window.getComputedStyle(modalsDiv).getPropertyValue("z-index")
        ) + options.zIndexDelta
      }`;
    }
    // title
    if (options.title && typeof options.title === "string") {
      modalDiv.querySelector(".modal-title").innerHTML = options.title;
      modalDiv
        .querySelector(".modal-title")
        .classList.remove("set-display-none");
    }
    // message
    if (options.message && typeof options.message === "string") {
      modalDiv.querySelector(".modal-message").innerHTML =
        options.message.replace(/\n/g, "<br>");
      modalDiv
        .querySelector(".modal-message")
        .classList.remove("set-display-none");
    }
    // progress-bar
    let barElement = modalDiv.querySelector(".modal-progress-bar");
    if (options.progressBar && isObject(options.progressBar)) {
      barElement.classList.remove("set-display-none");
    } else {
      barElement.classList.add("set-display-none");
    }
    // input
    let inputElement = modalDiv.querySelector(".modal-input");
    if (options.input && isObject(options.input)) {
      inputElement.classList.remove("set-display-none");
      if (options.input.type) {
        inputElement.type = options.input.type;
      }
      if (options.input.default) {
        inputElement.value = options.input.default;
      }
      inputElement.focus();
    }
    // log
    let logElement = modalDiv.querySelector(".modal-log");
    if (options.log && isObject(options.log)) {
      logElement.classList.remove("set-display-none");
    } else {
      logElement.classList.add("set-display-none");
    }
    // close x button
    if (options.close) {
      let button = modalDiv.querySelector(".modal-close-button");
      if (options.close.hide) {
        button.classList.add("set-display-none");
        modalDiv
          .querySelector(".modal-topbar")
          .classList.add("set-display-none");
      }
      button.addEventListener("click", (event) => {
        if (options.close?.callback) options.close.callback();
        close(modalDiv);
      });
      if (options.close?.key && typeof options.close.key === "string") {
        button.setAttribute("data-key", options.close.key);
      }
    }
    // bottom buttons
    if (options.buttons && Array.isArray(options.buttons)) {
      let buttonsDiv = modalDiv.querySelector(".modal-buttons");
      for (let index = 0; index < options.buttons.length; index++) {
        let buttonOptions = options.buttons[index];
        if (buttonOptions && isObject(buttonOptions)) {
          const buttonDiv = document.createElement("button");
          buttonDiv.className = "modal-button";
          buttonDiv.innerHTML =
            buttonOptions.text && typeof buttonOptions.text === "string"
              ? buttonOptions.text
              : "OK";
          buttonsDiv.appendChild(buttonDiv);
          buttonDiv.addEventListener("click", (event) => {
            if (buttonOptions.callback)
              buttonOptions.callback(inputElement.value);
            if (!buttonOptions.dontClose) close(modalDiv);
          });
          if (buttonOptions.key && typeof buttonOptions.key === "string") {
            buttonDiv.setAttribute("data-key", buttonOptions.key);
          }
          if (buttonOptions.fullWidth) {
            buttonDiv.style.width = "100%";
            buttonsDiv.classList.add("set-flex-direction-column");
          }
          if (buttonOptions.id && typeof buttonOptions.id === "string") {
            buttonDiv.id = buttonOptions.id;
          }
        }
      }
    }
  }
  return modalDiv;
}

function isObject(object) {
  return (
    typeof object === "object" && !Array.isArray(object) && object !== null
  );
}

export function close(modal) {
  if (modal) modal.remove();
}

export function onInputEvent(modalDiv, type, event) {
  switch (type) {
    case "onkeydown":
      // TODO: check if hidden
      // close x button
      {
        let button = modalDiv.querySelector(".modal-close-button");
        let key = button.getAttribute("data-key");
        if (
          key &&
          event.key &&
          key === event.key &&
          !button.classList.contains("set-display-none")
        ) {
          button.click();
        }
      }
      let buttons = modalDiv.querySelectorAll(".modal-button");
      // bottom buttons
      buttons.forEach((button) => {
        let key = button.getAttribute("data-key");
        if (
          key &&
          event.key &&
          key === event.key &&
          !button.classList.contains("set-display-none")
        ) {
          button.click();
        }
      });
      break;
  }
}

function getHTMLElement(parent) {
  const modalDiv = document.createElement("div");
  modalDiv.className = "modal";
  modalDiv.innerHTML = `<div class="modal-frame">
  <div class="modal-topbar">
    <div class="modal-close-button" title="close">
      <i class="fas fa-times"></i>
    </div>
  </div>
  <div class="modal-title set-display-none">Title</div>
  <div class="modal-message set-display-none">the message</div>
  <div class="modal-progress-bar">
    <div class="modal-progress-bar-animation"></div>
  </div>
  <input class="modal-input set-display-none" />
  <textarea class="modal-log" readonly></textarea>
  <div class="modal-buttons"></div>       
</div>`;
  parent.appendChild(modalDiv);
  return modalDiv;
}
