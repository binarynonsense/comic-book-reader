/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain, on } from "../renderer.js";
import { updateZoom } from "./ui.js";

let g_toolbarSliderIsPercentage = false;

///////////////////////////////////////////////////////////////////////////////
// IPC ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function initToolbarOnIpcCallbacks() {
  on("set-toolbar-visibility", (isVisible) => {
    if (isVisible) {
      document.querySelector("#toolbar").classList.remove("set-display-none");
      document
        .querySelector("#reader")
        .classList.remove("set-margin-bottom-zero");
      document.documentElement.style.setProperty("--toolbar-height", "30px");
    } else {
      document.querySelector("#toolbar").classList.add("set-display-none");
      document.querySelector("#reader").classList.add("set-margin-bottom-zero");
      document.documentElement.style.setProperty("--toolbar-height", "0px");
    }
    updateZoom();
  });

  on("update-toolbar-menus-collapse-all", () => {
    collapseAllToolbarMenus();
  });

  on("update-toolbar-direction", (dir) => {
    document.querySelector("#toolbar").style.direction = dir;
  });

  on(
    "update-toolbar-tooltips",
    (
      tOpenFile,
      tPrevious,
      tNext,
      tRotateCounter,
      tRotateClock,
      tFullScreen,

      tCollapse,
      tZoom,
      tZoomModes,
      tPageMode,
      tPageModeModes,
      tPagesDirection,
      tPagesDirectionModes,
    ) => {
      document.querySelector("#toolbar-button-open-href").title = tOpenFile;
      document.querySelector("#toolbar-button-left-href").title = tPrevious;
      document.querySelector("#toolbar-button-right-href").title = tNext;
      document.querySelector(
        "#toolbar-button-rotate-counterclockwise-href",
      ).title = tRotateCounter;
      document.querySelector("#toolbar-button-rotate-clockwise-href").title =
        tRotateClock;
      document.querySelector("#toolbar-button-fullscreen-enter-href").title =
        tFullScreen;
      document.querySelector("#toolbar-button-fullscreen-exit-href").title =
        tFullScreen;
      setToolbarMenuButtonLocalization(
        "toolbar-button-zoom",
        tCollapse,
        tZoom,
        tZoomModes,
      );
      setToolbarMenuButtonLocalization(
        "toolbar-button-pagemode",
        tCollapse,
        tPageMode,
        tPageModeModes,
      );
      setToolbarMenuButtonLocalization(
        "toolbar-button-pagesdirection",
        tCollapse,
        tPagesDirection,
        tPagesDirectionModes,
      );
    },
  );

  on("update-toolbar-rotation-buttons", (areEnabled) => {
    const button1 = document.querySelector("#toolbar-button-rotate-clockwise");
    const button2 = document.querySelector(
      "#toolbar-button-rotate-counterclockwise",
    );
    if (areEnabled) {
      button1.classList.remove("set-no-click");
      button2.classList.remove("set-no-click");
      button1.classList.remove("set-low-opacity");
      button2.classList.remove("set-low-opacity");
    } else {
      button1.classList.add("set-no-click");
      button2.classList.add("set-no-click");
      button1.classList.add("set-low-opacity");
      button2.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-page-buttons", (areEnabled) => {
    const button1 = document.querySelector("#toolbar-button-left");
    const button2 = document.querySelector("#toolbar-button-right");
    if (areEnabled) {
      button1.classList.remove("set-no-click");
      button2.classList.remove("set-no-click");
      button1.classList.remove("set-low-opacity");
      button2.classList.remove("set-low-opacity");
    } else {
      button1.classList.add("set-no-click");
      button2.classList.add("set-no-click");
      button1.classList.add("set-low-opacity");
      button2.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-zoom-buttons", (areEnabled) => {
    const button = document.querySelector("#toolbar-button-zoom");
    if (areEnabled) {
      button.classList.remove("set-no-click");
      button.classList.remove("set-low-opacity");
    } else {
      button.classList.add("set-no-click");
      button.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-pagemode-buttons", (areEnabled) => {
    const button = document.querySelector("#toolbar-button-pagemode");
    if (areEnabled) {
      button.classList.remove("set-no-click");
      button.classList.remove("set-low-opacity");
    } else {
      button.classList.add("set-no-click");
      button.classList.add("set-low-opacity");
    }
  });

  on("update-toolbar-pagesdirection-buttons", (areEnabled) => {
    const button = document.querySelector("#toolbar-button-pagesdirection");
    if (areEnabled) {
      button.classList.remove("set-no-click");
      button.classList.remove("set-low-opacity");
    } else {
      button.classList.add("set-no-click");
      button.classList.add("set-low-opacity");
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// EXPORTS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function collapseAllToolbarMenus() {
  const menus = document.querySelectorAll(".toolbar-button-menu");
  menus.forEach((menu) => {
    expandToolbarMenuButton(menu.parentElement.id, false);
  });
}

export function setToolbarMenuButtonIcon(buttonName, buttonIndex) {
  const button = document.getElementById(buttonName);
  if (!button) return;
  const menu = button.children[2];
  button.children[0].innerHTML = menu.children[buttonIndex].innerHTML;
}

export function addToolbarEventListeners() {
  addButtonEvent("toolbar-button-rotate-clockwise");
  addButtonEvent("toolbar-button-rotate-counterclockwise");
  addButtonEvent("toolbar-button-right");
  addButtonEvent("toolbar-button-left");
  addToolbarMenuButtonEvent("toolbar-button-pagemode");
  addToolbarMenuButtonEvent("toolbar-button-pagesdirection");
  addToolbarMenuButtonEvent("toolbar-button-zoom");
  addButtonEvent("toolbar-button-fullscreen-enter");
  addButtonEvent("toolbar-button-fullscreen-exit");
  addButtonEvent("toolbar-button-open");

  document
    .getElementById("toolbar-page-slider-input")
    .addEventListener("mouseup", (event) => {
      collapseAllToolbarMenus();
      sendIpcToMain("toolbar-slider-changed", event.currentTarget.value);
    });
  document
    .getElementById("toolbar-page-slider-input")
    .addEventListener("input", (event) => {
      if (g_toolbarSliderIsPercentage) {
        document.getElementById("toolbar-page-numbers").innerHTML =
          `${event.currentTarget.value}.00%`;
      } else {
        document.getElementById("toolbar-page-numbers").innerHTML =
          event.currentTarget.value + " / " + event.currentTarget.max;
      }
    });
}

export function updateToolbarPageInfo(
  pageMode,
  pageNum,
  numPages,
  isPercentage,
) {
  g_toolbarSliderIsPercentage = isPercentage;
  if (isPercentage) {
    document.getElementById("toolbar-page-slider-input").max = 100;
    document.getElementById("toolbar-page-slider-input").min = 0;
    document.getElementById("toolbar-page-slider-input").value = pageNum;
    document.getElementById("toolbar-page-numbers").innerHTML = `${Number(
      pageNum,
    ).toFixed(2)}%`;
  } else {
    if (numPages === 0) pageNum = -1; // hack to make it show 00 / 00 @ start
    document.getElementById("toolbar-page-slider-input").max = numPages;
    document.getElementById("toolbar-page-slider-input").min = 1;
    document.getElementById("toolbar-page-slider-input").value = pageNum + 1;

    let currentPageText = `${pageNum + 1} / ${numPages}`;
    if (pageMode === 1) {
      if (numPages > 1 && pageNum + 1 < numPages) {
        currentPageText = `${pageNum + 1}-${pageNum + 2} / ${numPages}`;
        document.getElementById("toolbar-page-slider-input").value =
          pageNum + 2;
      }
    } else if (pageMode === 2) {
      if (numPages > 1 && pageNum !== 0 && pageNum + 1 < numPages) {
        currentPageText = `${pageNum + 1}-${pageNum + 2} / ${numPages}`;
        document.getElementById("toolbar-page-slider-input").value =
          pageNum + 2;
      }
    }
    document.getElementById("toolbar-page-numbers").innerHTML = currentPageText;

    // calc page text space so slider doesn't change sizes too widely
    let numChars = numPages.toString().length * (pageMode == 0 ? 2 : 3) + 5;
    document.getElementById("toolbar-page-numbers").style.minWidth =
      `${numChars}ch`;
  }
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function addToolbarMenuButtonEvent(buttonName) {
  const button = document.getElementById(buttonName);
  if (!button) return;
  //expand
  button.children[0].addEventListener("click", (event) => {
    collapseAllToolbarMenus();
    expandToolbarMenuButton(buttonName, true);
  });
  // collapse
  button.children[1].addEventListener("click", (event) => {
    collapseAllToolbarMenus();
    expandToolbarMenuButton(buttonName, false);
  });
  // menu buttons
  const menu = button.children[2];
  for (let index = 0; index < menu.children.length; index++) {
    const element = menu.children[index];
    element.addEventListener("click", (event) => {
      button.children[0].classList.remove("set-display-none");
      button.children[1].classList.add("set-display-none");
      button.children[2].classList.add("set-display-none");
      sendIpcToMain("toolbar-button-clicked", `${buttonName}-menu-${index}`);
    });
  }
}

function expandToolbarMenuButton(buttonName, value) {
  const button = document.getElementById(buttonName);
  if (value === true) {
    button.children[0].classList.add("set-display-none");
    button.children[1].classList.remove("set-display-none");
    button.children[2].classList.remove("set-display-none");
    // menu buttons
    const menu = button.children[2];
    for (let index = 0; index < menu.children.length; index++) {
      const element = menu.children[index];
      if (button.children[0].innerHTML === element.innerHTML) {
        element.classList.add("toolbar-button-menu-child-highlight");
      } else {
        element.classList.remove("toolbar-button-menu-child-highlight");
      }
    }
  } else {
    button.children[0].classList.remove("set-display-none");
    button.children[1].classList.add("set-display-none");
    button.children[2].classList.add("set-display-none");
  }
}

function setToolbarMenuButtonLocalization(
  buttonName,
  tCollapse,
  titleLocalization,
  menuLocalization,
) {
  const button = document.getElementById(buttonName);
  button.children[0].title = titleLocalization;
  button.children[1].title = tCollapse;
  // menu buttons
  const menu = button.children[2];
  for (let index = 0; index < menu.children.length; index++) {
    const element = menu.children[index];
    element.title = menuLocalization[index];
  }
}

function addButtonEvent(buttonName) {
  document.getElementById(buttonName).addEventListener("click", (event) => {
    collapseAllToolbarMenus();
    sendIpcToMain("toolbar-button-clicked", buttonName);
  });
}
