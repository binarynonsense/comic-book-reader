/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export let Buttons = {
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
};

export let Axes = {
  LS_X: 0,
  LS_Y: 1,
  RS_X: 2,
  RS_Y: 3,
};

let g_animationFrame;
let g_animationLastTime;
let g_prevButtons;
let g_prevAxes;
let g_deltaTime;
let g_gamepadId;
let g_gamepad;

let g_isActive = false;

export function init(callback) {
  setTimeout(() => {
    // allow some time between the app starting and allowing
    // gamepad inputs, to avoid problems detecting false pressed
    // buttons due to the g_prevButtons clearing done at the start
    g_isActive = true;
  }, "500");

  window.addEventListener("gamepadconnected", (e) => {
    const gp = navigator.getGamepads()[e.gamepad.index];
    console.log(
      `gamepad connected [${gp.index}|${gp.id}; ${gp.buttons.length} buttons; ${gp.axes.length} axes]`
    );
    if (g_gamepadId === undefined) {
      g_gamepadId = e.gamepad.index;
      g_animationLastTime = performance.now();
      g_prevButtons = [...gp.buttons];
      g_prevButtons.forEach((button, index) => {
        g_prevButtons[index] = { pressed: false, touched: false, value: 0 };
      });
      g_prevAxes = [...gp.axes];
      g_prevAxes.forEach((axis, index) => {
        g_prevAxes[index] = 0;
      });
      poll(callback);
    }
  });

  window.addEventListener("gamepaddisconnected", (e) => {
    console.log("gamepad disconnected");
    if (g_gamepadId === e.gamepad.index) {
      g_gamepadId = undefined;
      g_prevButtons = undefined;
      cancelAnimationFrame(g_animationFrame);
    }
  });

  // NOTE: from MDN: if a gamepad is already connected when the page loaded,
  // the gamepadconnected event is dispatched to the focused page WHEN the
  // user presses a button or moves an axis.
}

function poll(callback) {
  g_deltaTime = (performance.now() - g_animationLastTime) / 1000;
  const gamepads = navigator.getGamepads();
  if (!gamepads || !gamepads[g_gamepadId]) return;
  g_gamepad = gamepads[g_gamepadId];
  if (g_isActive) callback();
  // set up next frame
  g_prevButtons = [...g_gamepad.buttons];
  g_prevAxes = [...g_gamepad.axes];
  g_animationLastTime = performance.now();
  g_animationFrame = requestAnimationFrame(() => {
    poll(callback);
  });
}

export function getDeltaTime() {
  return g_deltaTime;
}

export function getButtonDown(id) {
  return g_gamepad.buttons[id].pressed;
}

export function getPrevButtonDown(id) {
  return g_prevButtons[id].pressed;
}

export function getButtonDownThisFrame(id) {
  if (g_gamepad.buttons[id].pressed && !g_prevButtons[id].pressed) {
    console.log("trueee");
    return true;
  }
  return false;
}

export function getAxis(id) {
  return g_gamepad.axes[id];
}

export function getPrevAxis(id) {
  return g_prevAxes[id];
}

export function getAxisDown(id, direction) {
  if (direction >= 0) return g_gamepad.axes[id] > 0.5;
  else return g_gamepad.axes[id] < -0.5;
}

export function getAxisDownThisFrame(id, direction) {
  if (direction >= 0) return g_gamepad.axes[id] > 0.5 && g_prevAxes[id] < 0.5;
  else return g_gamepad.axes[id] < -0.5 && g_prevAxes[id] > -0.5;
}

// ref: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
