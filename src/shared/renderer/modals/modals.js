/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// generic
export * from "./modal-loading-bar.js";
export * from "./modal-info.js";
export * from "./modal-search.js";
// custom
export * from "./modal-komga-login.js";

import * as input from "../input.js";

// NOTE: this is the new version of the modals, it's still a WIP and will
// build it as I go, for now it will not replace the old ones but the goal
// is for it to do so as I slowly convert old ones to these ones.
// I'm testing them in hte Komga Browser

//////////////////////////////////////////////////////////////////////////////
// SETUP /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

export const Level = {
  APP: "app",
  TOOLS: "tools",
  READER: "reader",
};

const g_activeModals = {};

export function init() {
  // NOTE: i'm using an array to be future proof, in case i want to
  // be able to have multiple at once per level
  for (const key in Level) {
    g_activeModals[Level[key]] = [];
  }
}

export function addActiveModal(modal, level, closeOthers = true) {
  if (closeOthers)
    g_activeModals[level].forEach((element) => {
      closeModal(element);
    });
  modal.style.zIndex = getLevelZIndex(level);
  g_activeModals[level] = [modal];
}

export function getActiveModal(level) {
  if (g_activeModals[level].length <= 0) return undefined;
  return g_activeModals[level][0];
}

export function closeActiveModal(level) {
  // NOTE: for now closing all
  if (g_activeModals[level].length <= 0) return;
  g_activeModals[level].forEach((element) => {
    closeModal(element);
  });
}

export function closeModal(modal) {
  if (modal) {
    modal.remove();
  }
}

//////////////////////////////////////////////////////////////////////////////
// HELPERS ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

export function getLevelZIndex(level) {
  switch (level) {
    case Level.APP:
      return 510;

    case Level.TOOLS:
      return 505;

    case Level.READER:
    default:
      return 50;
  }
}

//////////////////////////////////////////////////////////////////////////////
// INPUT /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

export function onInputEvent(modalDiv, type, event) {
  // TODO: adapt old modals code below
  return;
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
          downPressed,
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
  // TODO: adapt old modals code below
  return;
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
  downPressed,
) {
  // TODO: adapt old modals code below
  return;
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
