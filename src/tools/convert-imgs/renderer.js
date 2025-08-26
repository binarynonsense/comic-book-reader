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
let g_inputFilesID = 0;

let g_cancel = false;

let g_outputFolderPath;

let g_inputListDiv;
let g_outputFolderDiv;
let g_startButton;
let g_outputImageScaleSlider;
let g_outputImageScaleSelect;
let g_outputImageFormatSelect;

let g_localizedRemoveFromListText;
let g_localizedModalCancelButtonText;
let g_localizedModalCloseButtonText;
let g_localizedModalCopyLogButtonText;

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
  g_inputFilesID = 0;
  g_cancel = false;

  // menu buttons
  document
    .getElementById("tool-ci-back-button")
    .addEventListener("click", (event) => {
      updateCurrentOptions();
      sendIpcToMain("save-settings-options", getChangedOptions());
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-ci-start-button")
    .addEventListener("click", (event) => {
      onStart();
    });
  // sections menu
  document
    .getElementById("tool-ci-section-general-options-button")
    .addEventListener("click", (event) => {
      switchSection(0);
    });
  document
    .getElementById("tool-ci-section-advanced-options-button")
    .addEventListener("click", (event) => {
      switchSection(1);
    });
  document
    .getElementById("tool-ci-section-settings-button")
    .addEventListener("click", (event) => {
      switchSection(2);
    });
  ////////////////////////////////////////
  g_inputListDiv = document.querySelector("#tool-ci-input-list");
  g_outputFolderDiv = document.querySelector("#tool-ci-output-folder");
  g_outputImageScaleSlider = document.querySelector(
    "#tool-ci-output-image-scale-slider"
  );
  g_outputImageScaleSelect = document.querySelector(
    "#tool-ci-output-image-scale-select"
  );
  g_outputImageScaleSelect.addEventListener("change", (event) => {
    checkValidData();
  });
  g_outputImageFormatSelect = document.querySelector(
    "#tool-ci-output-image-format-select"
  );
  g_startButton = document.querySelector("#tool-ci-start-button");

  g_localizedRemoveFromListText = "";

  document
    .getElementById("tool-ci-add-file-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputFiles && g_inputFiles.length > 0) {
        lastFilePath = g_inputFiles[g_inputFiles.length - 1].path;
      }
      sendIpcToMain("choose-file", lastFilePath);
    });

  document
    .getElementById("tool-ci-clear-list-button")
    .addEventListener("click", (event) => {
      // clear list
      g_inputFiles = [];
      g_inputFilesID = 0;
      g_inputListDiv.innerHTML = "";
      checkValidData();
    });

  document
    .getElementById("tool-ci-change-folder-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputFiles && g_inputFiles.length > 0) {
        lastFilePath = g_inputFiles[g_inputFiles.length - 1].path;
      }
      sendIpcToMain("choose-folder", lastFilePath, g_outputFolderPath);
    });

  document
    .getElementById("tool-ci-open-folder-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("open-path-in-file-browser", g_outputFolderPath);
    });

  g_outputImageFormatSelect.innerHTML =
    '<option value="jpg">jpg</option>' +
    '<option value="png">png</option>' +
    '<option value="webp">webp</option>' +
    '<option value="avif">avif</option>';

  toolsShared.initSliders();

  ////////////////////////////////////////
  // settings
  document
    .getElementById("tool-ci-settings-reset-button")
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
        .getElementById("tool-ci-section-general-options-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-ci-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ci-section-settings-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ci-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ci-output-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ci-advanced-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ci-settings-section-div")
        .classList.add("set-display-none");
      break;
    case 1:
      // buttons
      document
        .getElementById("tool-ci-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ci-section-advanced-options-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-ci-section-settings-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ci-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ci-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ci-advanced-output-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-ci-settings-section-div")
        .classList.add("set-display-none");
      break;
    case 2:
      // buttons
      document
        .getElementById("tool-ci-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ci-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-ci-section-settings-button")
        .classList.add("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-ci-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ci-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ci-advanced-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-ci-settings-section-div")
        .classList.remove("set-display-none");
      break;
  }
  updateColumnsHeight(true);
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-convert-imgs", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-convert-imgs", ...args);
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

  on("add-file", (filePath) => {
    if (filePath === undefined) return;

    for (let index = 0; index < g_inputFiles.length; index++) {
      if (g_inputFiles[index].path === filePath) {
        return;
      }
    }
    let id = g_inputFilesID++;
    g_inputFiles.push({
      id: id,
      path: filePath,
    });

    let li = document.createElement("li");
    li.className = "tools-collection-li";
    // text
    let text = document.createElement("span");
    text.innerText = reducePathString(filePath);
    li.appendChild(text);
    // buttons
    let buttons = document.createElement("span");
    buttons.className = "tools-collection-li-buttonset";
    li.appendChild(buttons);
    // remove icon - clickable
    {
      let button = document.createElement("span");
      button.title = g_localizedRemoveFromListText;
      button.addEventListener("click", (event) => {
        onRemoveFile(li, id);
      });
      button.innerHTML = `<i class="fas fa-window-close"></i>`;
      buttons.appendChild(button);
    }
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

  on(
    "show-result",
    (failedFilesText, numFiles, numErrors, failedFilePaths, numAttempts) => {
      // if the full log is huge I also crop it
      if (fullLogContent.length > 1000000)
        fullLogContent =
          "[...]" +
          fullLogContent.substring(
            fullLogContent.length - 1000000,
            fullLogContent.length
          );
      modalLog.innerHTML = fullLogContent;
      modalLog.classList.remove("modal-log-noscrollbar");
      modalLog.scrollTop = modalLog.scrollHeight;

      if (failedFilePaths.length > 0) {
        updateLogText(
          "\n------------ " + failedFilesText + ": ------------\n",
          true
        );
        failedFilePaths.forEach((filePath) => {
          updateLogText(filePath, true);
        });
      }

      const modalButtonCancel = g_openModal.querySelector(
        "#tool-ci-modal-cancel-button"
      );
      const modalButtonClose = g_openModal.querySelector(
        "#tool-ci-modal-close-button"
      );
      const modalButtonCopyLog = g_openModal.querySelector(
        "#tool-ci-modal-copylog-button"
      );
      const modalLoadingBar = g_openModal.querySelector(".modal-progress-bar");
      modalButtonCancel.classList.add("set-display-none");
      modalButtonClose.classList.remove("set-display-none");
      modalButtonCopyLog.classList.remove("set-display-none");
      modalLoadingBar.classList.add("set-display-none");

      console.log(numFiles);
      console.log(numAttempts);
      if (numErrors > 0 || numAttempts < numFiles) {
        modalButtonClose.classList.remove("modal-button-success-color");
        modalButtonClose.classList.add("modal-button-danger-color");
      }

      g_openModal
        .querySelector(".modal-close-button")
        .classList.remove("set-display-none");
      g_openModal
        .querySelector(".modal-topbar")
        .classList.remove("set-display-none");
    }
  );
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
  ///////////////////
  if (g_outputImageScaleSelect.value === "0") {
    document
      .getElementById("tool-ci-output-image-scale-slider")
      .parentElement.classList.remove("set-display-none");
    document
      .getElementById("tool-ci-output-image-scale-height-input")
      .classList.add("set-display-none");
    document
      .getElementById("tool-ci-output-image-scale-width-input")
      .classList.add("set-display-none");
  } else if (g_outputImageScaleSelect.value === "1") {
    document
      .getElementById("tool-ci-output-image-scale-slider")
      .parentElement.classList.add("set-display-none");
    document
      .getElementById("tool-ci-output-image-scale-height-input")
      .classList.remove("set-display-none");
    document
      .getElementById("tool-ci-output-image-scale-width-input")
      .classList.add("set-display-none");
  } else if (g_outputImageScaleSelect.value === "2") {
    document
      .getElementById("tool-ci-output-image-scale-slider")
      .parentElement.classList.add("set-display-none");
    document
      .getElementById("tool-ci-output-image-scale-height-input")
      .classList.add("set-display-none");
    document
      .getElementById("tool-ci-output-image-scale-width-input")
      .classList.remove("set-display-none");
  }
  ///////////////////
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

function onStart() {
  if (!g_openModal) showLogModal(); // TODO: check if first time?

  updateLogText("", false);

  g_cancel = false;
  const modalButtonCancel = g_openModal.querySelector(
    "#tool-ci-modal-cancel-button"
  );
  const modalButtonClose = g_openModal.querySelector(
    "#tool-ci-modal-close-button"
  );
  const modalButtonCopyLog = g_openModal.querySelector(
    "#tool-ci-modal-copylog-button"
  );
  modalButtonCancel.innerText = g_localizedModalCancelButtonText;
  modalButtonClose.innerText = g_localizedModalCloseButtonText;
  modalButtonCopyLog.innerText = g_localizedModalCopyLogButtonText;
  modalButtonCancel.classList.remove("set-display-none");
  modalButtonClose.classList.add("set-display-none");
  modalButtonCopyLog.classList.add("set-display-none");
  {
    modalButtonClose.classList.add("modal-button-success-color");
    modalButtonClose.classList.remove("modal-button-danger-color");
  }
  //g_modalLoadingBar.classList.remove("hide");

  let outputFormat = g_outputImageFormatSelect.value;
  if (outputFormat === undefined) outputFormat = FileExtension.JPG;
  let imageFormatParams = {
    jpgQuality: document.querySelector("#tool-ci-jpg-quality-slider").value,
    jpgMozjpeg: document.querySelector("#tool-ci-jpg-mozjpeg-checkbox").checked,
    pngQuality: document.querySelector("#tool-ci-png-quality-slider").value,
    avifQuality: document.querySelector("#tool-ci-avif-quality-slider").value,
    webpQuality: document.querySelector("#tool-ci-webp-quality-slider").value,
  };
  let scaleParams = {
    option: g_outputImageScaleSelect.value,
    value: g_outputImageScaleSlider.value,
  };
  if (g_outputImageScaleSelect.value === "1") {
    scaleParams.value = document.getElementById(
      "tool-ci-output-image-scale-height-input"
    ).value;
  } else if (g_outputImageScaleSelect.value === "2") {
    scaleParams.value = document.getElementById(
      "tool-ci-output-image-scale-width-input"
    ).value;
  }
  sendIpcToMain(
    "start",
    g_inputFiles,
    scaleParams,
    imageFormatParams,
    outputFormat,
    g_outputFolderPath
  );
}

function onCancel() {
  if (g_cancel === true) return;
  g_cancel = true;
  g_openModal
    .querySelector("#tool-ci-modal-cancel-button")
    .classList.add("set-display-none");
  sendIpcToMain("cancel");
}

function onCopyLog() {
  const log = g_openModal.querySelector(".modal-log");
  sendIpcToMain("copy-text-to-clipboard", log.innerHTML);
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function onInputEvent(type, event) {
  if (getOpenModal()) {
    modals.onInputEvent(getOpenModal(), type, event);
    return;
  } else {
    switch (type) {
      case "body.ondrop":
        {
          let filePaths = [];
          for (
            let index = 0;
            index < event.dataTransfer.files.length;
            index++
          ) {
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
let modalLog;
let partialLogContent = "";
let fullLogContent = "";

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
          onCopyLog();
        },
        fullWidth: true,
        id: "tool-ci-modal-copylog-button",
        dontClose: true,
      },
      {
        text: " ",
        callback: () => {
          onCancel();
        },
        fullWidth: true,
        id: "tool-ci-modal-cancel-button",
        dontClose: true,
      },
      {
        text: " ",
        callback: () => {
          modalClosed();
        },
        fullWidth: true,
        id: "tool-ci-modal-close-button",
        key: "Escape",
      },
    ],
  });

  modalLog = g_openModal.querySelector(".modal-log");
  modalLog.classList.add("modal-log-noscrollbar");
}

function updateModalTitleText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-title").innerHTML = text;
}

function updateInfoText(text) {
  if (g_openModal) g_openModal.querySelector(".modal-message").innerHTML = text;
}

function updateLogText(text, append = true) {
  if (g_openModal) {
    if (append) {
      partialLogContent += "\n" + text;
      fullLogContent += "\n" + text;
    } else {
      partialLogContent = text;
      fullLogContent = text;
    }
    // show only enough to fill the viewable area
    if (partialLogContent.length > 2000)
      partialLogContent = partialLogContent.substring(
        partialLogContent.length - 1500,
        partialLogContent.length
      );
    modalLog.innerHTML = partialLogContent;
    modalLog.scrollTop = modalLog.scrollHeight;
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
    if (element.id === "tool-ci-modal-close-button-text") {
      g_localizedModalCloseButtonText = element.text;
    } else if (element.id === "tool-ci-modal-cancel-button-text") {
      g_localizedModalCancelButtonText = element.text;
    } else if (element.id === "tool-ci-modal-copylog-button-text") {
      g_localizedModalCopyLogButtonText = element.text;
    } else if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }

  for (let index = 0; index < tooltipsLocalization.length; index++) {
    const element = tooltipsLocalization[index];
    const domElement = document.querySelector("#" + element.id);
    if (element.id === "tool-ci-tooltip-remove-from-list") {
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
