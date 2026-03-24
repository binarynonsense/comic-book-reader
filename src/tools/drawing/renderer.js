/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */
import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

async function init() {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  ////////////////////////////////////////

  await toggleEasyBrush(true);
  initComicPage("drawing-page", 1200, 3000);
  window.addEventListener("pointerup", handlePointerUp);
  g_layers.ink.addEventListener("pointerdown", handlePointerDown);
  g_layers.ink.addEventListener("pointermove", handlePointerMove);
  g_layers.sketch.addEventListener("pointerdown", handlePointerDown);
  g_layers.sketch.addEventListener("pointermove", handlePointerMove);
}

export function initIpc() {
  initOnIpcCallbacks();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-drawing", ...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};

export function onIpcFromMain(args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
}

function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}

function initOnIpcCallbacks() {
  on("show", (...args) => {
    init(...args);
  });

  on("hide", async () => {
    await toggleEasyBrush(false);
    // TODO: !!!!!!!!!!!!!
    // set brush/module instances to null
    // remove event listeners
    // clear canvases
    // const ctx = canvas.getContext('2d');
    // ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  //   on("update-localization", (...args) => {
  //     updateLocalization(...args);
  //   });

  /////////////////////////////////

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentBrush = { instance: null, type: "inking" };
let g_brushes = {};
let g_layers = {};
let g_isDrawing = false;
let g_mousePressure;
let g_lastPos = { x: 0, y: 0 };

function initComicPage(containerId, width, height) {
  const root = document.getElementById(containerId);
  root.style = `position:relative; width:${width}px; height:${height}px; background:#fff;`;

  const createLayer = (id, zIndex) => {
    const cvs = document.createElement("canvas");
    cvs.id = id;
    cvs.width = width;
    cvs.height = height;
    cvs.style = `position:absolute; top:0; left:0; z-index:${zIndex}; touch-action:none;`;
    root.appendChild(cvs);
    return cvs;
  };

  g_layers.sketch = createLayer("sketch-layer", 1);
  g_layers.ink = createLayer("ink-layer", 2);

  setupBrushes();
  selectTool("inking");
}

function setupBrushes() {
  // ref: https://github.com/DQLean/Easy-Brush?tab=readme-ov-file
  const {
    Brush,
    DynamicShapeModule,
    DynamicTransparencyModule,
    SpreadModule,
    MousePressure,
  } = window.EasyBrush;
  // G-PEN
  g_brushes.gPen = new Brush(g_layers.ink);
  const brushConfig = {
    color: "#000000", // Brush color
    size: 8, // Size
    flow: 1, //0.8, // Flow
    opacity: 1, //0.5, // Opacity
    spacing: 0.1, //0.15, // Spacing
    roundness: 1.0, // Roundness
    angle: 0.49, //0.0, // Angle
  };
  g_brushes.gPen.bindConfig(brushConfig);

  const gPenDynamics = new DynamicShapeModule();
  const dynamicShapeConfig = {
    sizeJitter: 0.05, //0.0, // Brush size jitter
    sizeJitterTrigger: "pressure", // Brush size jitter trigger (pressure: pen pressure, none: random)
    minDiameter: 0.0, // Minimum brush size
    angleJitter: 0.0, // Brush angle jitter
    angleJitterTrigger: "none", // Brush angle jitter trigger (pressure: pen pressure, none: random)
    roundJitter: 0.0, // Brush roundness jitter
    roundJitterTrigger: "none", // Brush roundness jitter trigger (pressure: pen pressure, none: random)
    minRoundness: 0.0, // Minimum brush roundness
  };
  gPenDynamics.bindConfig(dynamicShapeConfig);
  g_brushes.gPen.useModule(gPenDynamics);

  const gPenSpread = new SpreadModule();
  const spreadConfig = {
    spreadRange: 0.18, //0.0, // Brush scatter range
    spreadTrigger: "none", // Brush scatter trigger (pressure: pen pressure, none: random)
    count: 0, // Number of scatter points
    countJitter: 0.0, // Jitter for scatter count
    countJitterTrigger: "none", // Scatter count jitter trigger (pressure: pen pressure, none: random)
  };
  gPenSpread.bindConfig(spreadConfig);
  g_brushes.gPen.useModule(gPenSpread);

  // TODO: real values
  // PENCIL
  g_brushes.pencil = new Brush(g_layers.sketch);
  g_brushes.pencil.bindConfig({
    color: "#555555",
    size: 8,
    flow: 0.5,
    opacity: 0.4,
    spacing: 0.15,
  });

  const pencilTrans = new DynamicTransparencyModule();
  pencilTrans.bindConfig({
    opacityJitter: 0.2,
    flowJitter: 0.3,
    flowJitterTrigger: "none",
  });

  const pencilSpread = new SpreadModule();
  pencilSpread.bindConfig({ spreadRange: 0.15, count: 2, countJitter: 0.5 });

  g_brushes.pencil.useModule(pencilTrans);
  g_brushes.pencil.useModule(pencilSpread);

  // TODO: test
  // ERASER
  g_brushes.eraser = new Brush(g_layers.ink);
  g_brushes.eraser.bindConfig({
    size: 40,
    flow: 1,
    opacity: 1,
    spacing: 0.05,
    roundness: 1,
  });

  g_mousePressure = new MousePressure();

  /////////////

  // logDefaultBrushes();
}

function logDefaultBrushes() {
  const { Brush, DynamicShapeModule, SpreadModule } = window.EasyBrush;

  console.log("--- BRUSH DEFAULTS ---");
  console.table(new Brush(document.createElement("canvas")).config);

  console.log("--- DYNAMICS DEFAULTS ---");
  console.table(new DynamicShapeModule().config);

  console.log("--- SPREAD DEFAULTS ---");
  console.table(new SpreadModule().config);
}

function selectTool(type) {
  g_currentBrush.type = type;

  if (type === "inking") {
    g_currentBrush.instance = g_brushes.gPen;
    g_layers.active = g_layers.ink;
  } else if (type === "sketching") {
    g_currentBrush.instance = g_brushes.pencil;
    g_layers.active = g_layers.sketch;
  } else if (type === "eraser") {
    g_currentBrush.instance = g_brushes.eraser;
    g_layers.active = g_layers.ink;
  }

  g_layers.ink.style.pointerEvents =
    g_layers.active === g_layers.ink ? "auto" : "none";
  g_layers.sketch.style.pointerEvents =
    g_layers.active === g_layers.sketch ? "auto" : "none";
}

function handlePointerDown(event) {
  if (event.buttons !== 1) return;
  g_isDrawing = true;
  g_lastPos = { x: event.offsetX, y: event.offsetY };
  draw(event);
}

function handlePointerMove(event) {
  if (!g_isDrawing) return;
  draw(event);
}

function handlePointerUp() {
  if (g_isDrawing) {
    g_isDrawing = false;
    g_currentBrush.instance.finalizeStroke();
  }
}

function draw(event) {
  let rawPressure;
  if (event.pointerType === "pen") {
    rawPressure = event.pressure; // 0.0 to 1.0
  } else {
    // simulated pressure: fast mouse = thin line, slow mouse = thick line
    rawPressure = g_mousePressure.getPressure(event.offsetX, event.offsetY);
  }
  // curveFactor > 1: less sensitive
  // curveFactor < 1: more sensitive
  const curveFactor = 1.5; // 0.8
  const curvedPressure = Math.pow(rawPressure, curveFactor);

  const ctx = g_layers.active.getContext("2d");
  ctx.globalCompositeOperation =
    g_currentBrush.type === "eraser" ? "destination-out" : "source-over";

  g_currentBrush.instance.putPoint(
    event.offsetX,
    event.offsetY,
    curvedPressure,
  );
  g_currentBrush.instance.render();
}
//   const dx = event.offsetX - g_lastPos.x;
//   const dy = event.offsetY - g_lastPos.y;
//   const distance = Math.sqrt(dx * dx + dy * dy);
//   console.log(distance);
//   if (distance > 1) {
//     const angleInDegrees = Math.atan2(dy, dx) * (180 / Math.PI);
//     console.log(angleInDegrees);
//     g_lastPos = { x: event.offsetX, y: event.offsetY };
//   }
//   // g_currentBrush.instance.bindConfig({ angle: 90 });

function undo() {
  g_currentBrush.instance.undo();
}
function redo() {
  g_currentBrush.instance.redo();
}
function clearActiveLayer() {
  const ctx = g_layers.active.getContext("2d");
  ctx.clearRect(0, 0, g_layers.active.width, g_layers.active.height);
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  //   if (getOpenModal()) {
  //     modals.onInputEvent(getOpenModal(), type, event);
  //     return;
  //   }
  //   switch (type) {
  //     case "onkeydown": {
  //       if (event.key == "Tab") {
  //         event.preventDefault();
  //       }
  //       break;
  //     }
  //   }
}

export function onContextMenu(params) {
  //   if (getOpenModal()) {
  //     return;
  //   }
  //   sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// LIBRARY ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function toggleEasyBrush(active) {
  const libPath = "../assets/libs/easy-brush/easy-brush-browser.js";
  const scriptClass = "easy-brush-script";
  // clean up ////
  // remove the script tag
  document
    .querySelectorAll(`.${scriptClass}`)
    .forEach((element) => element.remove());
  // remove the lib itself
  if (window.EasyBrush) {
    delete window.EasyBrush;
  }
  // load ////
  if (active) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.className = scriptClass;
      script.src = `${libPath}?t=${Date.now()}`;
      script.onload = () => {
        if (window.EasyBrush) {
          resolve(window.EasyBrush);
        } else {
          reject(new Error("EasyBrush global not found"));
        }
      };
      document.head.appendChild(script);
    });
  }
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
