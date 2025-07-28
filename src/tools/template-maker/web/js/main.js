/**
 * @license
 * Copyright 2023-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { initRenderer, drawCompositeImage } from "./draw.js";
import {
  initPresets,
  setPreset,
  setGridPreset,
  setHeaderPreset,
} from "./presets.js";
import { initSaveLoad } from "./save-load.js";
import { initView, resetView } from "./view.js";
import { initPanels } from "./panels.js";
import { initHeaderText } from "./header.js";
import { initModals } from "./modals.js";
import { showLoading } from "./loading.js";

const g_version = "1.3.1";

init();

function init() {
  showLoading(true);
  // time out to let electron app load localization
  setTimeout(() => {
    initBase();
    initRenderer();
    initPresets();
    initSaveLoad();
    initView();
    initPanels();
    initHeaderText();
    initModals();
    drawCompositeImage();
  }, "100");
}

export function getVersion() {
  return g_version;
}

function initBase() {
  document.getElementById("info-version-p").innerHTML = `${g_version}`;

  document
    .getElementById("refresh-button")
    .addEventListener("click", function () {
      drawCompositeImage();
    });

  let refreshable = document.querySelectorAll(".refresh");
  for (let i = 0; i < refreshable.length; i++) {
    refreshable[i].addEventListener("change", function (event) {
      if (event.target.id === "units-select") {
        // document.getElementById("units-select").value === "inches" ? 1 : 0.393701;
        let unitElements = document.querySelectorAll(".unit-value");
        unitElements.forEach((element) => {
          element.value *= event.target.value === "inches" ? 1 / 2.54 : 2.54;
          element.value = parseFloat(parseFloat(element.value).toFixed(5));
        });
      } else if (event.target.id === "preset-select") {
        if (event.target.value != 0) {
          setPreset(-1, true); // load all defaults
          setPreset(event.target.value - 1, true);
          if (document.getElementById("autorefresh-checkbox").checked) {
            drawCompositeImage();
            resetView();
          }
          event.target.value = 0;
        }
      } else if (event.target.id === "grid-preset-select") {
        if (event.target.value != 0) {
          setGridPreset(event.target.value - 1);
          if (document.getElementById("autorefresh-checkbox").checked) {
            drawCompositeImage();
            resetView();
          }
          event.target.value = 0;
        }
      } else if (event.target.id === "header-preset-select") {
        if (event.target.value != 0) {
          setHeaderPreset(event.target.value - 1);
          if (document.getElementById("autorefresh-checkbox").checked) {
            drawCompositeImage();
            resetView();
          }
          event.target.value = 0;
        }
      } else {
        if (event.target.id === "layout-template-select") {
          if (
            document.getElementById("layout-template-select").value === "page"
          ) {
            document
              .getElementById("layout-page-div")
              .classList.remove("hidden");
            document
              .getElementById("layout-thumbnails-div")
              .classList.add("hidden");
          } else {
            document.getElementById("layout-page-div").classList.add("hidden");
            document
              .getElementById("layout-thumbnails-div")
              .classList.remove("hidden");
          }
        }
        if (document.getElementById("autorefresh-checkbox").checked)
          drawCompositeImage();
      }
    });
  }

  for (let i = 1; i < 9; i++) {
    const tab = document.getElementById(`tab-${i}`);
    tab.addEventListener("click", function () {
      if (!tab.classList.contains("tab-selected")) {
        for (let j = 1; j < 9; j++) {
          if (i === j) {
            document.getElementById(`tab-${j}`).classList.add("tab-selected");
            document
              .getElementById(`tab-${j}-content`)
              .classList.remove("hidden");
          } else {
            document
              .getElementById(`tab-${j}`)
              .classList.remove("tab-selected");
            document.getElementById(`tab-${j}-content`).classList.add("hidden");
          }
        }
      }
    });
  }
}

// document.onkeydown = function (event) {
//   if (window.bridge) {
//     // electron
//     if (
//       event.ctrlKey &&
//       event.shiftKey &&
//       (event.key == "i" || event.key == "I")
//     ) {
//       event.preventDefault();
//       window.bridge.toggleDevTools();
//     }
//   }
// };
