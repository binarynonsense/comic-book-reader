/**
 * @license
 * Copyright 2023-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as input from "./input.js";

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
      modalDiv.querySelector(".modal-title").innerHTML = options.title.replace(
        /\n/g,
        "<br>"
      );
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
    let logTextAreaElement = modalDiv.querySelector(".modal-log");
    let logDivElement = modalDiv.querySelector(".modal-log-div");
    if (options.log && isObject(options.log)) {
      if (options.log.useDiv) {
        logDivElement.classList.remove("set-display-none");
        logTextAreaElement.classList.add("set-display-none");
        if (options.log.message) {
          logDivElement.innerHTML = options.log.message;
        }
      } else {
        logDivElement.classList.add("set-display-none");
        logTextAreaElement.classList.remove("set-display-none");
        if (options.log.message) {
          logTextAreaElement.textContent = options.log.message;
        }
      }
    } else {
      logTextAreaElement.classList.add("set-display-none");
      logDivElement.classList.add("set-display-none");
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
        close(modalDiv);
        if (options.close?.callback) options.close.callback();
      });
      if (options.close?.key && typeof options.close.key === "string") {
        button.setAttribute("data-key", options.close.key);
      }
      if (
        options.close?.gpCommand &&
        typeof options.close.gpCommand === "string"
      ) {
        button.setAttribute("data-gp-button", options.close.gpCommand);
      }
    }
    // bottom buttons
    if (options.buttons && Array.isArray(options.buttons)) {
      const buttonsDiv = modalDiv.querySelector(".modal-buttons");
      for (let index = 0; index < options.buttons.length; index++) {
        const buttonOptions = options.buttons[index];
        if (buttonOptions && isObject(buttonOptions)) {
          const buttonDiv = document.createElement("button");
          buttonDiv.className = "modal-button";
          buttonDiv.innerHTML =
            buttonOptions.text && typeof buttonOptions.text === "string"
              ? buttonOptions.text
              : "OK";
          buttonsDiv.appendChild(buttonDiv);
          buttonDiv.addEventListener("click", (event) => {
            if (!buttonOptions.dontClose) close(modalDiv);
            if (buttonOptions.callback)
              buttonOptions.callback(inputElement.value);
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
    // focus
    if (options.showFocus) {
      const buttons = modalDiv.querySelectorAll(".modal-button");
      let enabledButtons = [];
      const inputElement = modalDiv.querySelector(".modal-input");
      if (!inputElement.classList.contains("set-display-none")) {
        enabledButtons.push(inputElement);
      }
      buttons.forEach((button) => {
        if (!button.classList.contains("set-display-none")) {
          enabledButtons.push(button);
        }
      });
      enabledButtons[0].focus();
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
      // input
      const inputElement = modalDiv.querySelector(".modal-input");
      const isInputElementFocused =
        !inputElement.classList.contains("set-display-none") &&
        inputElement == document.activeElement;
      if (isInputElementFocused && event.key == "Enter") {
        const buttons = modalDiv.querySelectorAll(".modal-button");
        buttons.forEach((button) => {
          const key = button.getAttribute("data-key");
          if (
            key &&
            event.key &&
            key === event.key &&
            !button.classList.contains("set-display-none")
          ) {
            button.click();
          }
        });
      } else if (
        isInputElementFocused &&
        (event.key == "ArrowLeft" || event.key == "ArrowRight")
      ) {
        // just let input do its thing
      } else {
        const dir = document.documentElement.getAttribute("dir");
        const upPressed =
          dir !== "rtl"
            ? event.key == "ArrowUp" || event.key == "ArrowLeft"
            : event.key == "ArrowUp" || event.key == "ArrowRight";
        const downPressed =
          dir !== "rtl"
            ? event.key == "ArrowDown" || event.key == "ArrowRight"
            : event.key == "ArrowDown" || event.key == "ArrowLeft";
        navigate(
          modalDiv,
          undefined,
          event.key == "Enter",
          upPressed,
          downPressed
        );
        // close x button
        {
          const button = modalDiv.querySelector(".modal-close-button");
          const data = button.getAttribute("data-key");
          if (data && !button.classList.contains("set-display-none")) {
            const keys = data.split(",");
            for (let index = 0; index < keys.length; index++) {
              const key = keys[index];
              if (key && event.key && key === event.key) {
                button.click();
                break;
              }
            }
          }
        }
      }
      if (
        !inputElement.classList.contains("set-display-none") &&
        inputElement == document.activeElement &&
        event.key != "Tab" &&
        event.key != "Enter"
      ) {
      } else if (
        event.key == "Tab" ||
        event.key == "Enter" ||
        event.key == " "
      ) {
        event.preventDefault();
      }
      break;

    case "acbr-click":
      {
        if (event.target.classList.contains("modal")) {
          const button = modalDiv.querySelector(".modal-close-button");
          if (!button.classList.contains("set-display-none")) {
            button.click();
          }
        }
      }
      break;
  }
}

export function onGamepadPolled(modalDiv) {
  const dir = document.documentElement.getAttribute("dir");
  let upPressed, downPressed;
  if (dir !== "rtl") {
    upPressed =
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_UP"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_LEFT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_UP"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_LEFT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_UP"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_LEFT"],
      });
    downPressed =
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_DOWN"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_RIGHT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_DOWN"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_RIGHT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_DOWN"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_RIGHT"],
      });
  } else {
    upPressed =
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_UP"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_RIGHT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_UP"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_RIGHT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_UP"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_RIGHT"],
      });
    downPressed =
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_DOWN"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["DPAD_LEFT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_DOWN"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["RS_LEFT"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_DOWN"],
      }) ||
      input.isActionDownThisFrame({
        source: input.Source.GAMEPAD,
        commands: ["LS_LEFT"],
      });
  }
  const actionPressed = input.isActionDownThisFrame({
    source: input.Source.GAMEPAD,
    commands: ["A"],
  });
  let backPressed = input.isActionDownThisFrame({
    source: input.Source.GAMEPAD,
    commands: ["B"],
  });
  if (!backPressed) {
    const button = modalDiv.querySelector(".modal-close-button");
    const data = button.getAttribute("data-gp-button");
    if (data && !button.classList.contains("set-display-none")) {
      const gpCommands = data.split(",");
      for (let index = 0; index < gpCommands.length; index++) {
        const gpCommand = gpCommands[index];
        if (
          gpCommand &&
          input.isActionDownThisFrame({
            source: input.Source.GAMEPAD,
            commands: [gpCommand],
          })
        ) {
          backPressed = true;
          break;
        }
      }
    }
  }
  navigate(modalDiv, backPressed, actionPressed, upPressed, downPressed);
}

function navigate(
  modalDiv,
  backPressed,
  actionPressed,
  upPressed,
  downPressed
) {
  // close x button
  if (backPressed) {
    const button = modalDiv.querySelector(".modal-close-button");
    if (!button.classList.contains("set-display-none")) {
      button.click();
    }
  }
  // bottom buttons
  const buttons = modalDiv.querySelectorAll(".modal-button");
  let enabledButtons = [];
  const inputElement = modalDiv.querySelector(".modal-input");
  if (!inputElement.classList.contains("set-display-none")) {
    enabledButtons.push(inputElement);
  }
  buttons.forEach((button) => {
    if (!button.classList.contains("set-display-none")) {
      enabledButtons.push(button);
    }
  });
  const focusedElement = document.activeElement;
  if (actionPressed) {
    for (let index = 0; index < enabledButtons.length; index++) {
      const button = enabledButtons[index];
      if (button === focusedElement && button !== inputElement) {
        button.click();
        break;
      }
    }
  } else {
    if (upPressed || downPressed) {
      let buttonIndex = undefined;
      for (let index = 0; index < enabledButtons.length; index++) {
        const button = enabledButtons[index];
        if (button === focusedElement) {
          buttonIndex = index;
          break;
        }
      }
      if (buttonIndex === undefined) {
        enabledButtons[0].focus();
      } else {
        // check direction
        //console.log(enabledButtons[0].style.width === "100%");
        // TODO: use direction?
        if (upPressed) {
          buttonIndex--;
          if (buttonIndex < 0) buttonIndex = enabledButtons.length - 1;
        } else if (downPressed) {
          buttonIndex++;
          if (buttonIndex > enabledButtons.length - 1) buttonIndex = 0;
        }
        enabledButtons[buttonIndex].focus();
      }
    }
  }
}

function getHTMLElement(parent) {
  const modalDiv = document.createElement("div");
  modalDiv.className = "modal";
  modalDiv.innerHTML = `<div class="modal-frame modal-frame-show">
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
  <textarea class="modal-log"  readonly></textarea>
  <div class="modal-log-div set-display-none"></div>
  <div class="modal-buttons"></div>       
</div>`;
  parent.appendChild(modalDiv);
  return modalDiv;
}
