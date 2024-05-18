/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { getOpenModal } from "../../core/renderer.js";
import { getTools, getCurrentTool, getCurrentToolName } from "./tools.js";
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

  document.addEventListener("mouseup", function (event) {
    g_isMouseDown = false;
  });

  document.addEventListener("mousemove", function (event) {
    if (!getOpenModal()) {
      getCurrentTool().onInputEvent("mousemove");
    }
    if (g_isMouseDown) {
      const mouseDeltaX = event.pageX - g_mouseLastX;
      const mouseDeltaY = event.pageY - g_mouseLastY;
      if (!getOpenModal()) {
        getCurrentTool().onInputEvent("acbr-onmousedownmove", [
          mouseDeltaX,
          mouseDeltaY,
        ]);
      }
      g_mouseLastX = event.pageX;
      g_mouseLastY = event.pageY;
      g_mouseMovedX += Math.abs(mouseDeltaX);
      g_mouseMovedY += Math.abs(mouseDeltaY);
    }
  });

  //document.addEventListener("mouseleave", function (event) {});

  document.addEventListener("click", function (event) {
    if (getOpenModal()) return;
    getCurrentTool().onInputEvent("click", event);
    // TODO: make marging a percentage of the window height?
    const margin = 10;
    const deltaTime = Date.now() - g_mouseDownTime;
    console.log(deltaTime);
    const wasDrag =
      (deltaTime > 1500 && (g_mouseMovedX > 0 || g_mouseMovedY > 0)) ||
      (deltaTime > 500 && (g_mouseMovedX > margin || g_mouseMovedY > margin));
    if (!wasDrag) {
      getCurrentTool().onInputEvent("acbr-click", event);
    }
  });

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

  document.addEventListener("wheel", function (event) {
    if (getOpenModal()) return;
    getCurrentTool().onInputEvent("wheel", event);
    event.stopPropagation();
    //event.preventDefault();
  });
}

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
