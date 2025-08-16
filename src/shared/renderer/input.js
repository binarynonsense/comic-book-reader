/**
 * @license
 * Copyright 2024-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { getOpenModal, sendIpcToMain } from "../../core/renderer.js";
import { getTools, getCurrentTool, getCurrentToolName } from "./tools.js";
import * as modals from "./modals.js";
import * as gamepads from "./gamepads.js";
import { getNavKeys } from "../../reader/renderer-ui.js";

///////////////////////////////////////////////////////////////////////////////
// INPUT  /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function init() {
  initKeyboard();
  initMouse();
  initTouchScreen();
  initGamepads();
}

// TODO: move to top
export const Source = {
  KEYBOARD: "keyboard",
  MOUSE: "mouse",
  GAMEPAD: "gamepad",
};

export function getGamepadsDeltaTime() {
  return gamepads.getDeltaTime();
}

export function isActionDown(action) {
  if (!action.commands || !action.source) {
    return false;
  }
  switch (action.source) {
    case Source.KEYBOARD:
      if (areKeyboardCommandsDown(action.commands, action.event)) {
        return true;
      }
      break;
    case Source.GAMEPAD:
      if (areGamepadCommandsDown(action.commands)) {
        return true;
      }
      break;
  }
  return false;
}

export function isActionDownThisFrame(action) {
  if (!action.commands || !action.source) {
    return false;
  }
  switch (action.source) {
    case Source.KEYBOARD:
      if (areKeyboardCommandsDownThisFrame(action.commands, action.event)) {
        return true;
      }
      break;
    case Source.GAMEPAD:
      if (areGamepadCommandsDownThisFrame(action.commands)) {
        return true;
      }
      break;
  }
  return false;
}

export function separateCommand(command) {
  let parts = command.split("+");
  /*             
   examples:
   w -> ["w"]
   + -> ["", ""]
   Control+2 -> ["Control", "2"]
   Control++ -> ["Control", "", ""]
   Control+Shift+2 -> ['Control', 'Shift', '2']
   Control+Shift++ -> ['Control', 'Shift', '', '']
  */
  if (parts[parts.length - 1] === "") {
    parts[parts.length - 1] = "+";
  }
  parts = parts.filter((part) => part !== "");
  return parts;
}

///////////////////////////////////////////////////////////////////////////////
// DRAG & DROP  ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

document.ondragover = document.ondrop = (event) => {
  event.preventDefault();
};

document.body.ondrop = (event) => {
  if (getOpenModal()) return;
  if (getCurrentToolName() === "reader") {
    if (!getTools()["audio-player"].onInputEvent("body.ondrop", event)) {
      getTools()["reader"].onInputEvent("body.ondrop", event);
    }
  } else {
    getCurrentTool().onInputEvent("body.ondrop", event);
  }
  event.preventDefault();
};

///////////////////////////////////////////////////////////////////////////////
// KEYBOARD ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initKeyboard() {
  document.onkeydown = function (event) {
    // TODO: check open file, open history, audio player, scrollbar... accelerators pressed and act accordingly
    if (
      event.key === "PageDown" ||
      event.key === "PageUp" ||
      event.key === "F1" ||
      event.key === "F2" ||
      event.key === "F3" ||
      event.key === "F4" ||
      event.key === "F5" ||
      event.key === "F6" ||
      event.key === "F7" ||
      event.key === "F8" ||
      event.key === "F9" ||
      event.key === "F10" ||
      event.key === "F11" ||
      event.key === "F12" ||
      (event.key === "-" && event.ctrlKey) ||
      (event.key === "+" && event.ctrlKey) ||
      (event.key === "0" && event.ctrlKey)
    ) {
      event.preventDefault();
    } // modals need arrows and enter default, tab?

    // shortcuts - all /////////////////////////////////////////

    if (checkShortcut("toggleFullScreen", "fullscreen")) {
      return;
    } else if (checkShortcut("quit", "quit")) {
      return;
    } else if (checkShortcut("toggleAudioPlayer", "audio-player")) {
      return;
    }

    //////////////////////////////////////////////////////////

    if (getOpenModal()) {
      modals.onInputEvent(getOpenModal(), "onkeydown", event);
      return;
    }

    //////////////////////////////////////////////////////////

    getCurrentTool().onInputEvent("onkeydown", event);
  };
}

export function checkShortcut(navKey, message) {
  if (
    isActionDownThisFrame({
      source: Source.KEYBOARD,
      commands: getNavKeys()[navKey],
      event: event,
    })
  ) {
    sendIpcToMain("menu-accelerator-pressed", message);
    return true;
  }
  return false;
}

function areKeyboardCommandsDown(commands, event) {
  if (!commands || !event) {
    return false;
  }
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    if (!command || command === "" || command === "UNASSIGNED") {
      continue;
    }
    const keys = separateCommand(command);
    let key = keys[keys.length - 1];
    let requiresCtrl = false;
    for (const value of keys) {
      if (value === "Control") {
        requiresCtrl = true;
        break;
      }
    }
    let requiresShift = false;
    for (const value of keys) {
      if (value === "Shift") {
        requiresShift = true;
        break;
      }
    }
    let requiresAlt = false;
    for (const value of keys) {
      if (value === "Alt") {
        requiresAlt = true;
        break;
      }
    }

    let matches = true;
    if (event.key !== key) {
      matches = false;
    }
    // modifiers
    if (event.ctrlKey !== requiresCtrl) {
      matches = false;
    }
    if (event.shiftKey !== requiresShift) {
      matches = false;
    }
    if (event.altKey !== requiresAlt) {
      matches = false;
    }
    if (matches) return true;
  }
  return false;
}

function areKeyboardCommandsDownThisFrame(commands, event) {
  if (!event.repeat && areKeyboardCommandsDown(commands, event)) return true;
  return false;
}

///////////////////////////////////////////////////////////////////////////////
// MOUSE //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isMouseDown = false;
let g_mouseLastX, g_mouseLastY;
let g_mouseMovedX, g_mouseMovedY;
let g_mouseDownTime;

function initMouse() {
  document.addEventListener("mousedown", function (event) {
    g_isMouseDown = true;
    g_mouseLastX = event.pageX;
    g_mouseLastY = event.pageY;
    g_mouseMovedX = 0;
    g_mouseMovedY = 0;
    g_mouseDownTime = Date.now();
  });

  document.addEventListener("mousemove", function (event) {
    if (!getOpenModal()) {
      getCurrentTool().onInputEvent("mousemove", event);
    }
    if (g_isMouseDown) {
      const mouseDeltaX = event.pageX - g_mouseLastX;
      const mouseDeltaY = event.pageY - g_mouseLastY;
      if (!getOpenModal()) {
        getCurrentTool().onInputEvent("acbr-onmousedownmove", [
          mouseDeltaX,
          mouseDeltaY,
          event,
        ]);
      }
      g_mouseLastX = event.pageX;
      g_mouseLastY = event.pageY;
      g_mouseMovedX += Math.abs(mouseDeltaX);
      g_mouseMovedY += Math.abs(mouseDeltaY);
    }
  });

  document.addEventListener("mouseup", function (event) {
    g_isMouseDown = false;
    getCurrentTool().onInputEvent("acbr-mouseup", event);
    switch (event.button) {
      case 1: // middle
        getCurrentTool().onInputEvent("acbr-middleclick");
        break;
      case 2: // right
        if (getOpenModal()) return;
        if (getCurrentTool().onContextMenu)
          getCurrentTool().onContextMenu(
            [event.pageX, event.pageY],
            event.target
          );
    }
  });

  //mouseleave

  document.addEventListener("click", function (event) {
    if (getOpenModal()) {
      modals.onInputEvent(getOpenModal(), "acbr-click", {
        event: event,
        target: event.target,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    getCurrentTool().onInputEvent("click", event);
    // // TODO: make margin a percentage of the window height?
    // const margin = 10;
    // const deltaTime = Date.now() - g_mouseDownTime;
    // const wasDrag =
    //   (deltaTime > 1500 && (g_mouseMovedX > 0 || g_mouseMovedY > 0)) ||
    //   (deltaTime > 500 && (g_mouseMovedX > margin || g_mouseMovedY > margin));
    const wasDrag = g_mouseMovedX > 0 || g_mouseMovedY > 0;
    if (!wasDrag && event.pointerType === "mouse") {
      getCurrentTool().onInputEvent("acbr-click", {
        event: event,
        target: event.target,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }
  });

  document.addEventListener("dblclick", function (event) {
    // disabled for now, maybe add an option to enable some day
    // if (getOpenModal()) return;
    // getCurrentTool().onInputEvent("acbr-doubleclick", event);
  });

  document.addEventListener("wheel", function (event) {
    if (getOpenModal()) return;
    getCurrentTool().onInputEvent("wheel", event);
    event.stopPropagation();
    //event.preventDefault();
  });

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}
///////////////////////////////////////////////////////////////////////////////
// TOUCHSCREEN ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isTouching = false;
let g_touchLastX, g_touchLastY;
let g_touchMovedX, g_touchMovedY;
let g_touchTime;
let g_touches = [],
  g_prevTouches = [];
let g_touchClickTimer = null;
let g_lastTouchEndTime = 0;

function initTouchScreen() {
  document.addEventListener("touchstart", function (event) {
    g_isTouching = true;
    g_touches = g_prevTouches = event.touches; // event.targetTouches;
    g_touchLastX = g_touches[0].clientX;
    g_touchLastY = g_touches[0].clientY;
    g_touchMovedX = 0;
    g_touchMovedY = 0;
    g_touchTime = Date.now();
  });

  document.addEventListener(
    "touchmove",
    function (event) {
      g_isTouching = true;
      g_prevTouches = g_touches;
      g_touches = event.touches;

      if (g_touches.length === 1) {
        // drag to scroll
        // NOTE: used mouse code as reference to do it mostly the same way
        const touchDeltaX = g_touches[0].clientX - g_touchLastX;
        const touchDeltaY = g_touches[0].clientY - g_touchLastY;
        if (!getOpenModal()) {
          getCurrentTool().onInputEvent("acbr-onmousedownmove", [
            touchDeltaX,
            touchDeltaY,
            event,
          ]);
        }
        g_touchLastX = g_touches[0].clientX;
        g_touchLastY = g_touches[0].clientY;
        g_touchMovedX += Math.abs(touchDeltaX);
        g_touchMovedY += Math.abs(touchDeltaY);
        // NOTE: work in progress
        // TODO: delete false to continue working on this
      } else if (g_touches.length === 2) {
        // pinch-zoom
        // NOTE: added user-scalable:none to index-X.html files to prevent the
        // default pinch zoom
        let a = g_touches[0].clientX - g_touches[1].clientX;
        let b = g_touches[0].clientY - g_touches[1].clientY;
        const touchesDistance = Math.sqrt(a * a + b * b);
        a = g_prevTouches[0].clientX - g_prevTouches[1].clientX;
        b = g_prevTouches[0].clientY - g_prevTouches[1].clientY;
        const prevTouchesDistance = Math.sqrt(a * a + b * b);
        if (touchesDistance > 0) {
          if (!getOpenModal()) {
            getCurrentTool().onInputEvent("acbr-pinchzoom", {
              touchesDistance,
              prevTouchesDistance,
            });
          }
        }
      }
      // prevent default drag-scroll
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { passive: false }
  );

  document.addEventListener("touchend", function (event) {
    g_isTouching = false;
    if (g_touches.length === 1) {
      const currentTime = Date.now();
      const deltaTime = currentTime - g_lastTouchEndTime;
      g_lastTouchEndTime = currentTime;
      if (!getOpenModal()) {
        if (deltaTime < 500) {
          getCurrentTool().onInputEvent("acbr-doubleclick", {
            event: event,
            target: g_touches[0].target,
          });
          if (g_touchClickTimer) {
            clearTimeout(g_touchClickTimer);
          }
        } else {
          g_touchClickTimer = setTimeout(() => {
            // trying to make more or less the same as in mouse "click"
            // TODO: should I pass the data as parameters and not just use
            // the globals? seems to work fine but couldn't they be outdated
            // when the function is actually called doing it this way?
            const margin = 10;
            const deltaTime = Date.now() - g_touchTime;
            const wasDrag =
              (deltaTime > 1500 && (g_touchMovedX > 0 || g_touchMovedY > 0)) ||
              (deltaTime > 500 &&
                (g_touchMovedX > margin || g_touchMovedY > margin));
            if (!wasDrag) {
              getCurrentTool().onInputEvent("acbr-click", {
                event: event,
                target: g_touches[0].target,
                clientX: g_touches[0].clientX,
                clientY: g_touches[0].clientY,
              });
            }
          }, 500);
        }
      }
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// GAMEPADS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export const GamepadButtons = {
  // Real buttons
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  LS_PRESS: 10,
  RS_PRESS: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  GUIDE: 16,
  // Axes as buttons
  LS_UP: 17,
  LS_DOWN: 18,
  LS_LEFT: 19,
  LS_RIGHT: 20,
  RS_UP: 21,
  RS_DOWN: 22,
  RS_LEFT: 23,
  RS_RIGHT: 24,
};

const GamepadButtonToIdAndDirection = {
  17: { id: gamepads.Axes.LS_Y, direction: -1 },
  18: { id: gamepads.Axes.LS_Y, direction: 1 },
  19: { id: gamepads.Axes.LS_X, direction: -1 },
  20: { id: gamepads.Axes.LS_X, direction: 1 },
  21: { id: gamepads.Axes.RS_Y, direction: -1 },
  22: { id: gamepads.Axes.RS_Y, direction: 1 },
  23: { id: gamepads.Axes.RS_X, direction: -1 },
  24: { id: gamepads.Axes.RS_X, direction: 1 },
};

function initGamepads() {
  gamepads.init(() => {
    refreshGamepadButtonsDownList();
    if (getOpenModal()) {
      modals.onGamepadPolled(getOpenModal());
      return;
    }
    if (getCurrentTool().onGamepadPolled) {
      getCurrentTool().onGamepadPolled();
    }
  });
}

let g_gamepadButtonsDownList = [];
function refreshGamepadButtonsDownList() {
  g_gamepadButtonsDownList = [];
  for (const buttonId in GamepadButtons) {
    if (areGamepadCommandsDown([buttonId], false)) {
      g_gamepadButtonsDownList.push(buttonId);
    }
  }
}

function compareGamepadButtonIdArrays(a, b) {
  if (a.sort().join(",") === b.sort().join(",")) {
    return true;
  }
  return false;
}

function areGamepadCommandsDownThisFrame(commands, strict = true) {
  return areGamepadCommandsDown(commands, strict, true);
}

function areGamepadCommandsDown(commands, strict = true, thisFrame = false) {
  if (!commands) {
    return false;
  }
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    if (!command || command === "" || command === "UNASSIGNED") {
      continue;
    }
    const buttons = separateCommand(command);

    if (strict) {
      if (!compareGamepadButtonIdArrays(buttons, g_gamepadButtonsDownList)) {
        return false;
      }
    }

    let allTrue = true;
    for (let index = 0; index < buttons.length; index++) {
      const button = buttons[index];
      const buttonId = GamepadButtons[button];
      if (buttonId === undefined) continue;
      if (buttonId <= 16) {
        // buttons
        if (thisFrame && index === buttons.length - 1) {
          if (!gamepads.getButtonDownThisFrame(buttonId)) {
            allTrue = false;
            break;
          }
        } else {
          if (!gamepads.getButtonDown(buttonId)) {
            allTrue = false;
            break;
          }
        }
      } else if (buttonId > 16) {
        if (thisFrame && index === buttons.length - 1) {
          if (
            !gamepads.getAxisDownThisFrame(
              GamepadButtonToIdAndDirection[buttonId].id,
              GamepadButtonToIdAndDirection[buttonId].direction
            )
          ) {
            allTrue = false;
            break;
          }
        } else {
          if (
            !gamepads.getAxisDown(
              GamepadButtonToIdAndDirection[buttonId].id,
              GamepadButtonToIdAndDirection[buttonId].direction
            )
          ) {
            allTrue = false;
            break;
          }
        }
      }
    }
    if (allTrue) return true;
  }
  return false;
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// refs:
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
// https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
