/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  getTools,
  getCurrentTool,
  getCurrentToolName,
  getOpenModal,
} from "../../core/renderer.js";
import * as modals from "./modals.js";
import { init as setupGamepads } from "./gamepads.js";

export function init() {
  initKeyboard();
  initMouse();
  initTouchScreen();
  initGamepads();
}

///////////////////////////////////////////////////////////////////////////////
// KEYBOARD ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initKeyboard() {
  document.onkeydown = function (event) {
    if (getOpenModal()) {
      modals.onInputEvent(getOpenModal(), "onkeydown", event);
      return;
    }
    getCurrentTool().onInputEvent("onkeydown", event);
    // keys ref: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
    // keys ref: https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
  };
}
///////////////////////////////////////////////////////////////////////////////
// MOUSE //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initMouse() {
  document.onclick = function (event) {
    if (getOpenModal()) return;
    getCurrentTool().onInputEvent("onclick", event);
  };

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

  document.onmousemove = function () {
    if (getOpenModal()) return;
    getCurrentTool().onInputEvent("onmousemove");
  };

  document.addEventListener("wheel", function (event) {
    if (getOpenModal()) return;
    getCurrentTool().onInputEvent("wheel", event);
    event.stopPropagation();
    //event.preventDefault();
  });
}
///////////////////////////////////////////////////////////////////////////////
// TOUCHSCREEN ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initTouchScreen() {}

///////////////////////////////////////////////////////////////////////////////
// GAMEPADS ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initGamepads() {
  setupGamepads(() => {
    if (getOpenModal()) {
      modals.onGamepadPolled(getOpenModal());
      return;
    }
    if (getCurrentTool().onGamepadPolled) {
      getCurrentTool().onGamepadPolled();
    }
  });
}
