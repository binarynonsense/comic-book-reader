/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import { FileExtension } from "../../shared/renderer/constants.js";
import * as toolsSettings from "../../shared/renderer/tools-settings.js";
import * as toolsShared from "../../shared/renderer/tools-shared.js";

let g_inputFiles = [];
let g_inputFilesIndex = 0;
let g_inputFilesID = 0;

let g_cancel = false;
let g_numErrors = 0;

let g_inputFilePath;
let g_inputFileType;

let g_outputFolderPath;
let g_outputPdfExtractionMethod = "embedded";

let g_outputImageFormatNotSetText = "";

let g_inputListDiv;
let g_outputFolderDiv;
let g_startButton;
let g_outputImageScaleSlider;
let g_outputImageFormatSelect;

let g_localizedRemoveFromListText;
let g_localizedModalCancelButtonText;
let g_localizedModalCloseButtonText;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init(outputFolderPath, loadedOptions) {
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });

  g_inputFiles = [];
  g_inputFilesIndex = 0;
  g_inputFilesID = 0;
  g_cancel = false;
  g_numErrors = 0;
  g_outputPdfExtractionMethod = "embedded";

  // menu buttons
  document
    .getElementById("tool-ec-back-button")
    .addEventListener("click", (event) => {
      updateCurrentOptions();
      sendIpcToMain("save-settings-options", getChangedOptions());
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-ec-start-button")
    .addEventListener("click", (event) => {
      onStart();
    });
  // sections menu
  document
    .getElementById("tool-ec-section-general-options-button")
    .addEventListener("click", (event) => {
      switchSection(0);
    });
  document
    .getElementById("tool-ec-section-advanced-options-button")
    .addEventListener("click", (event) => {
      switchSection(1);
    });
  document
    .getElementById("tool-ec-section-settings-button")
    .addEventListener("click", (event) => {
      switchSection(2);
    });
  ////////////////////////////////////////
  g_inputListDiv = document.querySelector("#tool-ec-input-list");

  g_outputFolderDiv = document.querySelector("#tool-ec-output-folder");
  g_outputImageScaleSlider = document.querySelector(
    "#tool-ec-output-image-scale-slider"
  );
  g_outputImageFormatSelect = document.querySelector(
    "#tool-ec-output-image-format-select"
  );

  g_startButton = document.querySelector("#tool-ec-start-button");

  g_localizedRemoveFromListText = "";

  document
    .getElementById("tool-ec-add-file-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputFiles.length > 0) {
        lastFilePath = g_inputFiles[g_inputFiles.length - 1].path;
      }
      sendIpcToMain("choose-file", lastFilePath);
    });

  document
    .getElementById("tool-ec-change-folder-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputFiles && g_inputFiles.length > 0) {
        lastFilePath = g_inputFiles[g_inputFiles.length - 1].path;
      }
      sendIpcToMain("choose-folder", lastFilePath, g_outputFolderPath);
    });

  g_outputImageFormatSelect.innerHTML =
    '<option value="' +
    FileExtension.NOT_SET +
    '">' +
    g_outputImageFormatNotSetText +
    "</option>" +
    '<option value="jpg">jpg</option>' +
    '<option value="png">png</option>' +
    '<option value="webp">webp</option>' +
    '<option value="avif">avif</option>';

  g_outputImageFormatSelect.addEventListener("change", (event) => {
    checkValidData();
  });

  document
    .getElementById("tool-ec-pdf-extraction-select")
    .addEventListener("change", (event) => {
      g_outputPdfExtractionMethod = event.target.value;
    });

  toolsShared.initSliders();

  ////////////////////////////////////////
  // settings
  document
    .getElementById("tool-ec-settings-reset-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("click-reset-options");
    });
  ////////////////////////////////////////
  // tooltips
  const tooltipButtons = document.querySelectorAll(".tools-tooltip-button");
  tooltipButtons.forEach((element) => {
    element.addEventListener("click", (event) => {
      sendIpcToMain(
        "tooltip-button-clicked",
        element.getAttribute("data-info")
      );
    });
  });
  ////////////////////////////////////////
  initOptions(outputFolderPath, loadedOptions);
  // initOptions calls checkValidData(); -> calls updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight(scrollTop = false) {
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
  if (scrollTop) {
    document.getElementById("tools-columns-right").scrollIntoView({
      behavior: "instant",
      block: "start",
      inline: "nearest",
    });
  }
}

function switchSection(id) {
  switch (id) {
    case 0:
      // buttons
      document
        .getElementById("tool-ec-section-general-options-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-ec-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ec-section-settings-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ec-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ec-output-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ec-advanced-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-advanced-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-settings-section-div")
        .classList.add("set-display-none");
      break;
    case 1:
      // buttons
      document
        .getElementById("tool-ec-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ec-section-advanced-options-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-ec-section-settings-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ec-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-advanced-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ec-advanced-output-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ec-settings-section-div")
        .classList.add("set-display-none");
      break;
    case 2:
      // buttons
      document
        .getElementById("tool-ec-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ec-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ec-section-settings-button")
        .classList.add("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ec-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-advanced-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-advanced-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ec-settings-section-div")
        .classList.remove("set-display-none");
      break;
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-extract-comics", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-extract-comics", ...args);
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

  on("hide", () => {});

  on("update-localization", (...args) => {
    updateLocalization(...args);
  });

  on("update-window", () => {
    updateColumnsHeight();
  });

  on("show-reset-options-modal", (...args) => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
    showResetOptionsModal(...args);
  });

  on("save-and-quit-request", (...args) => {
    updateCurrentOptions();
    sendIpcToMain("save-settings-options", getChangedOptions(), true);
  });

  on("save-and-close-request", (...args) => {
    updateCurrentOptions();
    sendIpcToMain("save-settings-options", getChangedOptions());
    sendIpcToMain("close");
  });

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });

  on("add-file", (filePath, fileType) => {
    if (filePath === undefined || fileType === undefined) return;

    for (let index = 0; index < g_inputFiles.length; index++) {
      if (g_inputFiles[index].path === filePath) {
        return;
      }
    }
    let id = g_inputFilesID++;
    g_inputFiles.push({
      id: id,
      path: filePath,
      type: fileType,
    });

    let li = document.createElement("li");
    li.className = "tools-collection-li";
    // text
    let text = document.createElement("span");
    text.innerText = reducePathString(filePath);
    li.appendChild(text);
    // remove icon - clickable
    let button = document.createElement("span");
    button.title = g_localizedRemoveFromListText;
    button.className = "tools-collection-li-button";
    button.addEventListener("click", (event) => {
      onRemoveFile(li, id);
    });
    button.innerHTML = `<i class="fas fa-window-close"></i>`;
    li.appendChild(button);
    g_inputListDiv.appendChild(li);

    checkValidData();
  });

  on("change-output-folder", (folderPath) => {
    changeOutputFolder(folderPath);
    checkValidData();
  });

  /////////////////////////////////////////////////////////////////////////////

  on("modal-update-title-text", (text) => {
    updateModalTitleText(text);
  });

  on("update-info-text", (text) => {
    updateInfoText(text);
  });

  on("update-log-text", (text) => {
    updateLogText(text);
  });

  on("show-modal-info", (...args) => {
    showModalInfo(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("images-extracted", () => {
    let imageFormatParams = {
      jpgQuality: document.querySelector("#tool-ec-jpg-quality-slider").value,
      jpgMozjpeg: document.querySelector("#tool-ec-jpg-mozjpeg-checkbox")
        .checked,
      pngQuality: document.querySelector("#tool-ec-png-quality-slider").value,
      avifQuality: document.querySelector("#tool-ec-avif-quality-slider").value,
      webpQuality: document.querySelector("#tool-ec-webp-quality-slider").value,
    };
    sendIpcToMain(
      "resize-images",
      g_inputFilePath,
      g_outputImageScaleSlider.value,
      imageFormatParams,
      g_outputImageFormatSelect.value,
      g_outputFolderPath
    );
  });

  on("finished-ok", () => {
    if (g_inputFilesIndex < g_inputFiles.length - 1) {
      g_inputFilesIndex++;
      onStart(false);
    } else {
      sendIpcToMain(
        "end",
        false,
        g_inputFiles.length,
        g_numErrors,
        g_inputFilesIndex + 1
      );
    }
  });

  on("finished-error", () => {
    const modalButtonClose = g_openModal.querySelector(
      "#tool-ec-modal-close-button"
    );
    modalButtonClose.classList.remove("modal-button-success-color");
    modalButtonClose.classList.add("modal-button-danger-color");
    g_numErrors++;
    if (g_inputFilesIndex < g_inputFiles.length - 1) {
      g_inputFilesIndex++;
      onStart(false);
    } else {
      sendIpcToMain(
        "end",
        false,
        g_inputFiles.length,
        g_numErrors,
        g_inputFilesIndex + 1
      );
    }
  });

  on("finished-canceled", () => {
    const modalButtonCancel = g_openModal.querySelector(
      "#tool-ec-modal-cancel-button"
    );
    const modalButtonClose = g_openModal.querySelector(
      "#tool-ec-modal-close-button"
    );
    const modalLoadingBar = g_openModal.querySelector(".modal-progress-bar");

    modalButtonCancel.classList.add("set-display-none");
    modalButtonClose.classList.remove("set-display-none");
    {
      modalButtonClose.classList.remove("modal-button-success-color");
      modalButtonClose.classList.add("modal-button-danger-color");
    }
    modalLoadingBar.classList.add("set-display-none");
    sendIpcToMain(
      "end",
      true,
      g_inputFiles.length,
      g_numErrors,
      g_inputFilesIndex // last one wasn't converted or error
    );
  });

  on("show-result", () => {
    const modalButtonCancel = g_openModal.querySelector(
      "#tool-ec-modal-cancel-button"
    );
    const modalButtonClose = g_openModal.querySelector(
      "#tool-ec-modal-close-button"
    );
    const modalLoadingBar = g_openModal.querySelector(".modal-progress-bar");
    modalButtonCancel.classList.add("set-display-none");
    modalButtonClose.classList.remove("set-display-none");
    modalLoadingBar.classList.add("set-display-none");
    g_openModal
      .querySelector(".modal-close-button")
      .classList.remove("set-display-none");
    g_openModal
      .querySelector(".modal-topbar")
      .classList.remove("set-display-none");
  });
}

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function checkValidData() {
  if (g_outputFolderPath !== undefined && g_inputFiles.length > 0) {
    g_startButton.classList.remove("tools-disabled");
  } else {
    g_startButton.classList.add("tools-disabled");
  }
  toolsShared.updateSliders();
  updateOutputFolderUI();
  updateColumnsHeight();
}

function updateOutputFolderUI() {
  g_outputFolderDiv.innerHTML = "";
  let li = document.createElement("li");
  li.className = "tools-collection-li";
  // text
  let text = document.createElement("span");
  text.innerText = reducePathString(g_outputFolderPath);
  li.appendChild(text);
  g_outputFolderDiv.appendChild(li);
}

function changeOutputFolder(folderPath) {
  g_outputFolderPath = folderPath;
}

function onRemoveFile(element, id) {
  element.parentElement.removeChild(element);
  let removeIndex;
  for (let index = 0; index < g_inputFiles.length; index++) {
    if (g_inputFiles[index].id === id) {
      removeIndex = index;
      break;
    }
  }
  if (removeIndex !== undefined) {
    g_inputFiles.splice(removeIndex, 1);
    checkValidData();
  }
}

function onStart(resetCounter = true) {
  if (!g_openModal) showLogModal(); // TODO: check if first time?

  if (resetCounter) {
    g_inputFilesIndex = 0;
    g_numErrors = 0;
    updateLogText("", false);
  }

  g_cancel = false;
  const modalButtonCancel = g_openModal.querySelector(
    "#tool-ec-modal-cancel-button"
  );
  const modalButtonClose = g_openModal.querySelector(
    "#tool-ec-modal-close-button"
  );
  modalButtonCancel.innerText = g_localizedModalCancelButtonText;
  modalButtonClose.innerText = g_localizedModalCloseButtonText;
  modalButtonCancel.classList.remove("set-display-none");
  modalButtonClose.classList.add("set-display-none");
  if (g_numErrors === 0) {
    modalButtonClose.classList.add("modal-button-success-color");
    modalButtonClose.classList.remove("modal-button-danger-color");
  }
  //g_modalLoadingBar.classList.remove("hide");

  g_inputFilePath = g_inputFiles[g_inputFilesIndex].path;
  g_inputFileType = g_inputFiles[g_inputFilesIndex].type;

  sendIpcToMain(
    "start",
    g_inputFilePath,
    g_inputFileType,
    g_inputFilesIndex + 1,
    g_inputFiles.length,
    g_outputPdfExtractionMethod
  );
}

function onCancel() {
  if (g_cancel === true) return;
  g_cancel = true;
  g_openModal
    .querySelector("#tool-ec-modal-cancel-button")
    .classList.add("set-display-none");
  sendIpcToMain("cancel");
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getOpenModal()) {
    modals.onInputEvent(getOpenModal(), type, event);
    return;
  }
  switch (type) {
    case "body.ondrop":
      {
        let filePaths = [];
        for (let index = 0; index < event.dataTransfer.files.length; index++) {
          const file = event.dataTransfer.files[index];
          filePaths.push(ipc.showFilePath(file));
        }
        sendIpcToMain("dragged-files", filePaths);
      }
      break;
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
// OPTIONS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_defaultOptions;
let g_currentOptions;
function initOptions(outputFolderPath, loadedOptions) {
  g_defaultOptions = toolsSettings.getOptions("tools-columns-right");
  g_defaultOptions.outputFolderPath = outputFolderPath;
  if (loadedOptions) {
    g_currentOptions = loadedOptions;
    toolsSettings.restoreOptions(
      document.getElementById("tools-columns-right"),
      g_currentOptions
    );
    if (!g_currentOptions.outputFolderPath)
      g_currentOptions.outputFolderPath = g_defaultOptions.outputFolderPath;
  } else {
    g_currentOptions = g_defaultOptions;
  }
  changeOutputFolder(g_currentOptions.outputFolderPath);
  checkValidData();
}

function updateCurrentOptions() {
  g_currentOptions = toolsSettings.getOptions("tools-columns-right");
  g_currentOptions.outputFolderPath = g_outputFolderPath;
}

function getChangedOptions() {
  let options;
  if (g_currentOptions) {
    options = {};
    for (const key in g_currentOptions) {
      if (g_currentOptions[key] !== g_defaultOptions[key]) {
        options[key] = g_currentOptions[key];
      }
    }
  }
  return options;
}

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_openModal;

export function getOpenModal() {
  return g_openModal;
}

function modalClosed() {
  g_openModal = undefined;
}

function showLogModal() {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: " ",
    message: " ",
    zIndexDelta: 5,
    frameWidth: 600,
    close: {
      callback: () => {
        modalClosed();
      },
      hide: true,
    },
    log: {},
    progressBar: {},
    buttons: [
      {
        text: " ",
        callback: () => {
          onCancel();
        },
        fullWidth: true,
        id: "tool-ec-modal-cancel-button",
        dontClose: true,
        key: "Escape",
      },
      {
        text: " ",
        callback: () => {
          modalClosed();
        },
        fullWidth: true,
        id: "tool-ec-modal-close-button",
        key: "Escape",
      },
    ],
  });
}

function updateModalTitleText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-title").innerHTML = text;
}

function updateInfoText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-message").innerHTML = text;
}

function updateLogText(text, append = true) {
  if (g_openModal) {
    const log = g_openModal.querySelector(".modal-log");
    if (append) {
      log.innerHTML += "\n" + text;
    } else {
      log.innerHTML = text;
    }
    log.scrollTop = log.scrollHeight;
  }
}

function showModalInfo(title, message, textButton1) {
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
        text: textButton1.toUpperCase(),
        callback: () => {
          modalClosed();
        },
        key: "Enter",
      },
    ],
  });
}

function showResetOptionsModal(title, message, yesText, cancelText) {
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
          g_currentOptions = g_defaultOptions;
          toolsSettings.restoreOptions(
            document.getElementById("tools-columns-right"),
            g_currentOptions
          );
          changeOutputFolder(g_defaultOptions.outputFolderPath);
          checkValidData();
          modalClosed();
        },
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

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(
  localization,
  tooltipsLocalization,
  localizedTexts
) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.querySelector("#" + element.id);
    if (element.id === "tool-ec-keep-format-text") {
      g_outputImageFormatNotSetText = element.text;
    } else if (element.id === "tool-ec-modal-close-button-text") {
      g_localizedModalCloseButtonText = element.text;
    } else if (element.id === "tool-ec-modal-cancel-button-text") {
      g_localizedModalCancelButtonText = element.text;
    } else if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }

  for (let index = 0; index < tooltipsLocalization.length; index++) {
    const element = tooltipsLocalization[index];
    const domElement = document.querySelector("#" + element.id);
    if (element.id === "tool-ec-tooltip-remove-from-list") {
      g_localizedRemoveFromListText = element.text;
    } else if (domElement !== null) {
      if (
        domElement.classList &&
        domElement.classList.contains("tools-tooltip-button")
      ) {
        domElement.setAttribute("data-info", element.text);
        domElement.title = localizedTexts.infoTooltip;
      } else {
        domElement.title = element.text;
      }
    }
  }
}

function reducePathString(input) {
  var length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}
