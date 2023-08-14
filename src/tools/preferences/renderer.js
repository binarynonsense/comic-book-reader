/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import { isVersionOlder } from "../../shared/renderer/utils.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_tempFolderPathUl;

function init(activeLocale, languages, activeTheme, themes, settings) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });
  // close/back button
  document
    .getElementById("tool-pre-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  // sections menu
  document
    .getElementById("tool-pre-section-all-button")
    .addEventListener("click", (event) => {
      switchSection(0);
    });
  document
    .getElementById("tool-pre-section-appearance-button")
    .addEventListener("click", (event) => {
      switchSection(1);
    });
  document
    .getElementById("tool-pre-section-ui-button")
    .addEventListener("click", (event) => {
      switchSection(2);
    });
  document
    .getElementById("tool-pre-section-file-formats-button")
    .addEventListener("click", (event) => {
      switchSection(3);
    });
  document
    .getElementById("tool-pre-section-advanced-button")
    .addEventListener("click", (event) => {
      switchSection(4);
    });
  // languages select
  {
    let select = document.getElementById("tool-pre-language-select");
    // generate options
    if (languages !== undefined) {
      for (let language of languages) {
        let nativeName = language.nativeName;
        if (isVersionOlder(language.acbrVersion, "3.0.0-beta1")) {
          nativeName += " (" + language.outdatedText + ")";
        }
        let opt = document.createElement("option");
        opt.value = language.locale;
        opt.textContent = nativeName;
        opt.selected = language.locale === activeLocale;
        select.appendChild(opt);
      }
    }
    // add listener
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-language", select.value);
    });
  }
  // themes select
  {
    let select = document.getElementById("tool-pre-themes-select");
    // generate options
    if (themes !== undefined) {
      for (let theme of themes) {
        let opt = document.createElement("option");
        opt.value = theme.filename;
        opt.textContent = theme.name;
        opt.selected = theme.filename === activeTheme;
        select.appendChild(opt);
      }
    }
    // add listener
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-theme", select.value);
    });
  }
  // zoom default select
  {
    let select = document.getElementById("tool-pre-zoom-default-select");
    select.value = settings.zoomDefault;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-setting", "zoomDefault", parseInt(select.value));
    });
  }
  // zoom file loading select
  {
    let select = document.getElementById("tool-pre-zoom-fileloading-select");
    select.value = settings.zoomFileLoading;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-setting", "zoomFileLoading", parseInt(select.value));
    });
  }
  // layout clock select
  {
    let select = document.getElementById("tool-pre-layout-clock-select");
    select.value = settings.layoutClock;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-layout-clock", parseInt(select.value));
    });
  }
  // layout pagenum select
  {
    let select = document.getElementById("tool-pre-layout-pagenum-select");
    select.value = settings.layoutPageNum;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-layout-pagenum", parseInt(select.value));
    });
  }
  // layout audioplayer select
  {
    let select = document.getElementById("tool-pre-layout-audioplayer-select");
    select.value = settings.layoutAudioPlayer;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-layout-audioplayer", parseInt(select.value));
    });
  }
  // loading bg select
  {
    let select = document.getElementById("tool-pre-loading-bg-select");
    select.value = settings.loadingIndicatorBG;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-loading-bg", parseInt(select.value));
    });
  }
  // loading isize select
  {
    let select = document.getElementById("tool-pre-loading-isize-select");
    select.value = settings.loadingIndicatorIconSize;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-loading-isize", parseInt(select.value));
    });
  }
  // loading ipos select
  {
    let select = document.getElementById("tool-pre-loading-ipos-select");
    select.value = settings.loadingIndicatorIconPos;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-loading-ipos", parseInt(select.value));
    });
  }
  // hotspots select
  {
    let select = document.getElementById("tool-pre-hotspots-select");
    select.value = settings.hotspots_mode;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-setting", "hotspots_mode", parseInt(select.value));
    });
  }
  // cursor select
  {
    let select = document.getElementById("tool-pre-cursor-select");
    select.value = settings.cursorVisibility;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-cursor", parseInt(select.value));
    });
  }
  // autoopen select
  {
    let select = document.getElementById("tool-pre-autoopen-select");
    select.value = settings.autoOpen;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-setting", "autoOpen", parseInt(select.value));
    });
  }
  // turn-page select
  {
    let select = document.getElementById("tool-pre-page-turn-select");
    select.value = settings.turnPageOnScrollBoundary ? "true" : "false";
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-page-turn", select.value === "true");
    });
  }
  // epub openas select
  {
    let select = document.getElementById("tool-pre-epub-openas-select");
    select.value = settings.epubOpenAs;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-setting", "epubOpenAs", parseInt(select.value));
    });
  }
  // temp folder ul and button
  {
    g_tempFolderPathUl = document.getElementById("tool-pre-tempfolder-ul");
    updateTempFolder(settings.tempFolderPath);
    document
      .getElementById("tool-pre-tempfolder-update-button")
      .addEventListener("click", (event) => {
        sendIpcToMain("change-temp-folder", false);
      });
    document
      .getElementById("tool-pre-tempfolder-reset-button")
      .addEventListener("click", (event) => {
        sendIpcToMain("change-temp-folder", true);
      });
  }

  updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight() {
  // NOTE: a bit of a hack, this should be doable with css but I wasn't able :)
  // Ultimately done so the back button stays fixed even when scrolling and the
  // right column is bigger than a certain ammount
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
}

function switchSection(id) {
  switch (id) {
    case 0:
      // buttons
      document
        .getElementById("tool-pre-section-all-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-appearance-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-ui-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-file-formats-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-advanced-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-pre-appearance-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-pre-ui-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-pre-file-formats-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-pre-file-advanced-div")
        .classList.remove("set-display-none");
      break;
    case 1:
      // buttons
      document
        .getElementById("tool-pre-section-all-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-appearance-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-ui-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-file-formats-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-advanced-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-pre-appearance-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-pre-ui-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-file-formats-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-advanced-section-div")
        .classList.add("set-display-none");
      break;
    case 2:
      // buttons
      document
        .getElementById("tool-pre-section-all-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-appearance-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-ui-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-file-formats-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-advanced-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-pre-appearance-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-ui-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-pre-file-formats-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-advanced-section-div")
        .classList.add("set-display-none");
      break;
    case 3:
      // buttons
      document
        .getElementById("tool-pre-section-all-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-appearance-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-ui-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-file-formats-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-advanced-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-pre-appearance-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-ui-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-file-formats-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-pre-advanced-section-div")
        .classList.add("set-display-none");
      break;
    case 4:
      // buttons
      document
        .getElementById("tool-pre-section-all-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-appearance-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-ui-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-file-formats-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-pre-section-advanced-button")
        .classList.add("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-pre-appearance-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-ui-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-file-formats-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-pre-advanced-section-div")
        .classList.remove("set-display-none");
      break;
  }
  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-preferences", ...args);
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
  on("show", (activeLocale, languages, activeTheme, themes, settings) => {
    init(activeLocale, languages, activeTheme, themes, settings);
  });

  on("update-localization", (callback) => {
    updateLocalization(callback);
  });

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("set-temp-folder", (folderPath) => {
    updateTempFolder(folderPath);
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateTempFolder(folderPath) {
  g_tempFolderPathUl.innerHTML = "";
  let li = document.createElement("li");
  li.className = "tools-collection-li";
  // text
  let text = document.createElement("span");
  text.innerText = reducePathString(folderPath);
  li.appendChild(text);
  g_tempFolderPathUl.appendChild(li);
}

function reducePathString(input) {
  var length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  // if (getOpenModal()) {
  //   modals.onInputEvent(getOpenModal(), type, event);
  //   return;
  // }
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.innerText = element.text;
    }
  }
}
