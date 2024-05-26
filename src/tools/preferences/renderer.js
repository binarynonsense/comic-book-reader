/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { sendIpcToMain as coreSendIpcToMain } from "../../core/renderer.js";
import { isVersionOlder } from "../../shared/renderer/utils.js";
import * as modals from "../../shared/renderer/modals.js";
import * as sound from "../../shared/renderer/sound.js";

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_tempFolderPathUl;
let g_tempFolderPathCheckbox;
let g_rarExeFolderPathUl;

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
        if (isVersionOlder(language.acbrVersion, "3.5.0-beta1")) {
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
  // layout battery select
  {
    let select = document.getElementById("tool-pre-layout-battery-select");
    select.value = settings.layoutBattery;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-layout-battery", parseInt(select.value));
    });
  }
  // toolbar direction select
  {
    let select = document.getElementById("tool-pre-toolbar-direction-select");
    select.value = settings.toolbarDirection;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-toolbar-direction", parseInt(select.value));
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
  // pdf reading library select
  {
    let select = document.getElementById(
      "tool-pre-pdf-reading-library-version-select"
    );
    select.value = settings.pdfReadingLib;
    select.addEventListener("change", function (event) {
      sendIpcToMain("set-pdf-reading-lib", parseInt(select.value));
    });
  }
  // cbr creation select
  {
    let select = document.getElementById(
      "tool-pre-cbr-creation-modification-select"
    );
    select.value = settings.cbrCreation;
    select.addEventListener("change", function (event) {
      if (select.value === "0") {
        document
          .getElementById("tool-pre-rarfolder-div")
          .classList.add("set-display-none");
      } else {
        document
          .getElementById("tool-pre-rarfolder-div")
          .classList.remove("set-display-none");
      }
      updateColumnsHeight();
      sendIpcToMain("set-setting", "cbrCreation", parseInt(select.value));
    });
  }
  // rar folder div, ul and buttons
  {
    g_rarExeFolderPathUl = document.getElementById("tool-pre-rarfolder-ul");
    updateRarFolder(settings.rarExeFolderPath);
    document
      .getElementById("tool-pre-rarfolder-update-button")
      .addEventListener("click", (event) => {
        sendIpcToMain("change-rar-folder", false);
      });
    document
      .getElementById("tool-pre-rarfolder-reset-button")
      .addEventListener("click", (event) => {
        sendIpcToMain("change-rar-folder", true);
      });
    if (settings.cbrCreation === 0) {
      document
        .getElementById("tool-pre-rarfolder-div")
        .classList.add("set-display-none");
    }
  }
  // temp folder ul and buttons
  {
    g_tempFolderPathUl = document.getElementById("tool-pre-tempfolder-ul");
    g_tempFolderPathCheckbox = document.getElementById(
      "tool-pre-tempfolder-checkbox"
    );
    document
      .getElementById("tool-pre-tempfolder-update-button")
      .addEventListener("click", (event) => {
        sendIpcToMain(
          "change-temp-folder",
          false,
          g_tempFolderPathCheckbox.checked
        );
      });
    document
      .getElementById("tool-pre-tempfolder-reset-button")
      .addEventListener("click", (event) => {
        sendIpcToMain(
          "change-temp-folder",
          true,
          g_tempFolderPathCheckbox.checked
        );
      });
  }

  switchSection(1);
  //updateColumnsHeight();
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
        .getElementById("tool-pre-advanced-section-div")
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
  on("show", (...args) => {
    init(...args);
  });

  on("update-localization", (...args) => {
    updateLocalization(...args);
  });

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("update-navkeys", (...args) => {
    updateNavKeys(...args);
  });

  on("set-temp-folder", (...args) => {
    updateTempFolder(...args);
  });

  on("set-rar-folder", (...args) => {
    updateRarFolder(...args);
  });

  on("show-ok-modal", (...args) => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
    showOKModal(...args);
  });

  on("show-nav-keys-change-modal", (...args) => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
    showNavKeysChangeModal(...args);
  });

  on("show-nav-keys-resetall-modal", (...args) => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
    showNavKeysResetAllModal(...args);
  });

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

function updateTempFolder(folderPath, saveAsRelative) {
  g_tempFolderPathUl.innerHTML = "";
  let li = document.createElement("li");
  li.className = "tools-collection-li";
  // text
  let text = document.createElement("span");
  text.innerText = reducePathString(folderPath);
  li.appendChild(text);
  g_tempFolderPathUl.appendChild(li);

  g_tempFolderPathCheckbox.checked = saveAsRelative;
}

function updateRarFolder(folderPath) {
  g_rarExeFolderPathUl.innerHTML = "";
  let li = document.createElement("li");
  li.className = "tools-collection-li";
  // text
  let text = document.createElement("span");
  if (!folderPath || folderPath.trim() === "") text.innerHTML = "&nbsp;";
  else text.innerText = reducePathString(folderPath);
  li.appendChild(text);
  g_rarExeFolderPathUl.appendChild(li);
}

function updateNavKeys(
  actionKeys,
  actionTexts,
  changeText,
  resetText,
  resetAllText,
  unassignedText
) {
  const parentDiv = document.getElementById("tool-pre-navkeys-div");
  parentDiv.innerHTML = "";
  ////
  const resetAllButton = document.createElement("button");
  parentDiv.appendChild(resetAllButton);
  const resetAllSpan = document.createElement("span");
  resetAllButton.appendChild(resetAllSpan);
  resetAllSpan.innerText = resetAllText;
  resetAllButton.addEventListener("click", function (event) {
    sendIpcToMain("click-nav-keys-resetall");
  });
  ////
  for (const action in actionKeys) {
    const parentLabel = document.createElement("label");
    parentDiv.appendChild(parentLabel);
    const span = document.createElement("span");
    span.innerText = actionTexts[action];
    parentLabel.appendChild(span);
    for (let index = 0; index < actionKeys[action].length; index++) {
      const keyText = actionKeys[action][index];
      ////
      const columnsDiv = document.createElement("div");
      parentDiv.appendChild(columnsDiv);
      columnsDiv.classList =
        "tool-shared-columns-parent tool-shared-columns-parent-alignv";
      columnsDiv.style = "padding-top: 0px";
      ////
      const keyDiv = document.createElement("div");
      columnsDiv.appendChild(keyDiv);
      keyDiv.classList = "tool-shared-columns-50-grow";
      const keyUl = document.createElement("ul");
      keyDiv.appendChild(keyUl);
      keyUl.classList = "tools-collection-ul";
      const keyLi = document.createElement("li");
      keyUl.appendChild(keyLi);
      keyLi.classList = "tools-collection-li";

      if (keyText === " ") {
        keyLi.innerText = "SpaceBar";
      } else if (keyText === "UNASSIGNED") {
        keyLi.innerText = unassignedText;
      } else {
        keyLi.innerText = keyText;
      }
      ////
      const changeButton = document.createElement("button");
      columnsDiv.appendChild(changeButton);
      changeButton.classList == "tool-shared-columns-25-grow";
      const changeSpan = document.createElement("span");
      changeButton.appendChild(changeSpan);
      changeSpan.innerText = changeText;
      changeButton.addEventListener("click", function (event) {
        sendIpcToMain("click-nav-keys-change", action, index);
      });
      ////
      const resetButton = document.createElement("button");
      columnsDiv.appendChild(resetButton);
      changeButton.classList == "tool-shared-columns-25-grow";
      const resetSpan = document.createElement("span");
      resetButton.appendChild(resetSpan);
      resetSpan.innerText = resetText;
      resetButton.addEventListener("click", function (event) {
        sendIpcToMain("reset-nav-keys", action, index);
      });
      ////
    }
  }
}

function reducePathString(input) {
  if (!input) return input;
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
  if (getOpenModal()) {
    if (g_openModalOnInputEvent) {
      if (g_openModalOnInputEvent(type, event)) {
        return;
      }
    }
    modals.onInputEvent(getOpenModal(), type, event);
    return;
  }
  switch (type) {
    case "onkeydown": {
      if (event.key == "Tab") {
        event.preventDefault();
      }
      break;
    }
  }
}

export function onContextMenu(params) {
  if (getOpenModal()) {
    return;
  }
  sendIpcToMain("show-context-menu", params);
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;
let g_openModalOnInputEvent;

export function getOpenModal() {
  return g_openModal;
}

function modalClosed() {
  g_openModal = undefined;
  g_openModalOnInputEvent = undefined;
}

function showOKModal(title, message, textButton) {
  if (g_openModal) {
    return;
  }
  let buttons = [];
  if (textButton) {
    buttons.push({
      text: textButton,
      callback: () => {
        modalClosed();
      },
      key: "Enter",
    });
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

function showNavKeysResetAllModal(title, message, yesText, cancelText) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: yesText.toUpperCase(),
        callback: () => {
          sendIpcToMain("resetall-nav-keys");
          modalClosed();
        },
        //key: "Enter",
      },
      {
        text: cancelText.toUpperCase(),
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}

function showNavKeysChangeModal(title, message, textButton, action, keyIndex) {
  if (g_openModal) {
    return;
  }
  let buttons = [];
  if (textButton) {
    buttons.push({
      text: textButton,
      callback: () => {
        modalClosed();
      },
    });
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: 5,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });

  g_openModalOnInputEvent = (type, event) => {
    switch (type) {
      case "onkeydown": {
        if (
          event.key === "Escape" ||
          event.key === "Meta" ||
          event.key === "AltGraph" ||
          event.key === "ContextMenu" ||
          event.key === "CapsLock" ||
          event.key === "Shift" ||
          event.shiftKey ||
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
          event.key === "F12"
        ) {
          // not allowed
          sound.playErrorSound();
          event.preventDefault();
        } else if (event.key === "Control" || event.key === "Alt") {
          // allowed only as modifiers
          event.preventDefault();
        } else {
          sendIpcToMain(
            "change-nav-keys",
            action,
            keyIndex,
            event.key,
            event.ctrlKey,
            event.altKey
          );
          modals.close(g_openModal);
          modalClosed();
          event.preventDefault();
        }
        // don't let generic modal onInputEvent run
        return true;
      }
    }
    return false;
  };
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization, tooltipsLocalization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.innerText = element.text;
    }
  }
  for (let index = 0; index < tooltipsLocalization.length; index++) {
    const element = tooltipsLocalization[index];
    const domElement = document.querySelector("#" + element.id);
    if (domElement !== null) {
      domElement.title = element.text;
    }
  }
}
