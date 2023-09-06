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

export function init(callback) {
  window.addEventListener("gamepadconnected", (e) => {
    const gp = navigator.getGamepads()[e.gamepad.index];
    console.log(
      `gamepad connected [${gp.index}|${gp.id}; ${gp.buttons.length} buttons; ${gp.axes.length} axes]`
    );
    if (g_gamepadId === undefined) {
      g_gamepadId = e.gamepad.index;
      g_animationLastTime = performance.now();
      g_prevButtons = [...gp.buttons];
      g_prevAxes = [...gp.axes];
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
}

function poll(callback) {
  g_deltaTime = (performance.now() - g_animationLastTime) / 1000;
  const gamepads = navigator.getGamepads();
  if (!gamepads || !gamepads[g_gamepadId]) return;
  g_gamepad = gamepads[g_gamepadId];
  callback();
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

export function getButton(id) {
  // returns true while the button identified by id is held down
  return g_gamepad.buttons[id].pressed;
}

export function getPrevButton(id) {
  return g_prevButtons[id].pressed;
}

export function getButtonDown(id) {
  // returns true during the frame the button identified by id was pressed down
  if (g_gamepad.buttons[id].pressed && !g_prevButtons[id].pressed) {
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

// TODO: naming could be confusing but I'm trying use something as similar
// to the names for the button functions (which are inspired by Unity's)
export function getAxisDown(id, direction) {
  if (direction >= 0) return g_gamepad.axes[id] > 0.5 && g_prevAxes[id] < 0.5;
  else return g_gamepad.axes[id] < -0.5 && g_prevAxes[id] > -0.5;
}

// ref: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
