/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  sendIpcToMain as coreSendIpcToMain,
  sendIpcToMainAndWait as coreSendIpcToMainAndWait,
} from "../../core/renderer.js";
import * as modals from "../../shared/renderer/modals.js";
import { FileExtension } from "../../shared/renderer/constants.js";

let g_mode = 0; // 0 = convert, 1 = create

let g_inputFiles = [];
let g_inputFilesIndex = 0;
let g_inputFilesID = 0;

let g_cancel = false;
let g_numErrors = 0;

let g_inputFilePath;
let g_inputFileType;
let g_outputFormat;
let g_outputFolderPath;
let g_outputPdfExtractionMethod = "embedded";

let g_outputImageFormatNotSetText = "";

let g_inputListDiv;
let g_outputFolderDiv;
let g_startButton;
let g_outputFormatSelect;
let g_outputImageScaleSlider;
let g_outputImageFormatSelect;
let g_outputSplitNumFilesInput;
let g_outputPasswordInput;

let g_outputNameInput;

let g_localizedRemoveFromListText;
let g_localizedMoveUpInListText;
let g_localizedMoveDownInListText;
let g_localizedModalCancelButtonText;
let g_localizedModalCloseButtonText;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

function init(mode, outputFolderPath, canEditRars) {
  g_mode = mode;
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });

  g_outputFormat = undefined;
  g_outputPdfExtractionMethod = "embedded";
  g_inputFiles = [];
  g_inputFilesIndex = -1;
  g_inputFilesID = 0;
  g_cancel = false;
  g_numErrors = 0;

  // menu buttons
  document
    .getElementById("tool-cc-back-button")
    .addEventListener("click", (event) => {
      sendIpcToMain("close");
    });
  document
    .getElementById("tool-cc-start-button")
    .addEventListener("click", (event) => {
      onStart();
    });
  // sections menu
  document
    .getElementById("tool-cc-section-general-options-button")
    .addEventListener("click", (event) => {
      switchSection(0);
    });
  document
    .getElementById("tool-cc-section-advanced-options-button")
    .addEventListener("click", (event) => {
      switchSection(1);
    });
  ////////////////////////////////////////
  g_inputListDiv = document.querySelector("#tool-cc-input-list");

  g_outputFolderDiv = document.querySelector("#tool-cc-output-folder");
  g_outputFormatSelect = document.querySelector(
    "#tool-cc-output-format-select"
  );
  g_outputImageScaleSlider = document.querySelector(
    "#tool-cc-output-image-scale-slider"
  );
  g_outputImageFormatSelect = document.querySelector(
    "#tool-cc-output-image-format-select"
  );
  g_outputSplitNumFilesInput = document.querySelector(
    "#tool-cc-split-num-files-input"
  );
  g_outputSplitNumFilesInput.value = 1;
  g_outputPasswordInput = document.querySelector("#tool-cc-password-input");

  g_startButton = document.querySelector("#tool-cc-start-button");

  g_localizedRemoveFromListText = "";
  g_localizedMoveUpInListText = "";
  g_localizedMoveDownInListText = "";

  document
    .getElementById("tool-cc-add-file-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputFiles && g_inputFiles.length > 0) {
        lastFilePath = g_inputFiles[g_inputFiles.length - 1].path;
      }
      sendIpcToMain("choose-file", lastFilePath);
    });

  updateOutputFolder(outputFolderPath);
  document
    .getElementById("tool-cc-change-folder-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputFiles && g_inputFiles.length > 0) {
        lastFilePath = g_inputFiles[g_inputFiles.length - 1].path;
      }
      sendIpcToMain("choose-folder", lastFilePath, g_outputFolderPath);
    });

  g_outputFormatSelect.innerHTML =
    '<option value="cbz">cbz</option>' +
    '<option value="pdf">pdf</option>' +
    '<option value="epub">epub</option>' +
    '<option value="cb7">cb7</option>';
  if (canEditRars) {
    g_outputFormatSelect.innerHTML += '<option value="cbr">cbr</option>';
  }
  g_outputFormatSelect.addEventListener("change", (event) => {
    g_outputFormat = g_outputFormatSelect.value;
    checkValidData();
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
    sendIpcToMain("set-image-format", g_outputImageFormatSelect.value);
  });

  document
    .getElementById("tool-cc-pdf-extraction-select")
    .addEventListener("change", (event) => {
      g_outputPdfExtractionMethod = event.target.value;
    });

  document
    .getElementById("tool-cc-pdf-creation-select")
    .addEventListener("change", (event) => {
      sendIpcToMain("set-pdf-creation-method", event.target.value);
    });

  document
    .getElementById("tool-cc-epub-creation-image-format-select")
    .addEventListener("change", (event) => {
      sendIpcToMain("set-epub-creation-image-format", event.target.value);
    });

  document
    .getElementById("tool-cc-epub-creation-image-storage-select")
    .addEventListener("change", (event) => {
      sendIpcToMain("set-epub-creation-image-storage", event.target.value);
    });

  // ref: https://css-tricks.com/value-bubbles-for-range-inputs/
  const sliders = document.querySelectorAll(".tools-range-wrap");
  sliders.forEach((wrap) => {
    const range = wrap.querySelector(".tools-range");
    const bubble = wrap.querySelector(".tools-range-bubble");
    range.addEventListener("input", () => {
      updateSliderBubble(range, bubble);
    });
    range.addEventListener("mousedown", () => {
      bubble.classList.remove("set-display-none");
    });
    range.addEventListener("mouseup", () => {
      bubble.classList.add("set-display-none");
    });
    updateSliderBubble(range, bubble);
  });

  // conversion / creation
  g_outputNameInput = document.querySelector("#tool-cc-output-name-input");
  if (g_mode === 0) {
    document
      .getElementById("tool-cc-output-page-order-label")
      .classList.add("set-display-none");
    document
      .getElementById("tool-cc-output-name-label")
      .classList.add("set-display-none");
  } else {
    document
      .getElementById("tool-cc-output-page-order-select")
      .addEventListener("click", (event) => {
        sendIpcToMain("set-page-order", event.target.value);
      });
    g_outputNameInput.addEventListener("input", (event) => {
      checkValidData();
    });
  }
  ////////////////////////////////////////
  checkValidData();
  updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
}

function updateColumnsHeight() {
  const left = document.getElementById("tools-columns-left");
  const right = document.getElementById("tools-columns-right");
  left.style.minHeight = right.offsetHeight + "px";
}

function updateSliderBubble(range, bubble) {
  const val = range.value;
  const min = range.min ? range.min : 0;
  const max = range.max ? range.max : 100;
  const newVal = Number(((val - min) * 100) / (max - min));
  bubble.innerHTML = range.value;
  // magic numbers
  bubble.style.left = `calc(${newVal}% - (${newVal * 0.15}px))`;
}

function switchSection(id) {
  switch (id) {
    case 0:
      // buttons
      document
        .getElementById("tool-cc-section-general-options-button")
        .classList.add("tools-menu-button-selected");
      document
        .getElementById("tool-cc-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-cc-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-output-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-advanced-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-output-options-section-div")
        .classList.add("set-display-none");
      break;
    case 1:
      // buttons
      document
        .getElementById("tool-cc-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-cc-section-advanced-options-button")
        .classList.add("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-cc-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-advanced-output-options-section-div")
        .classList.remove("set-display-none");
      break;
      break;
  }
  updateColumnsHeight();
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export function sendIpcToMain(...args) {
  coreSendIpcToMain("tool-convert-comics", ...args);
}

async function sendIpcToMainAndWait(...args) {
  return await coreSendIpcToMainAndWait("tool-convert-comics", ...args);
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

  on("update-localization", (localization, tooltipsLocalization) => {
    updateLocalization(localization, tooltipsLocalization);
  });

  on("update-window", () => {
    updateColumnsHeight();
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
    // buttons
    let buttons = document.createElement("span");
    buttons.className = "tools-collection-li-buttonset";
    li.appendChild(buttons);
    // up icon - clickable
    {
      let button = document.createElement("span");
      button.title = g_localizedMoveUpInListText;
      button.addEventListener("click", (event) => {
        onMoveFileUpInList(li, id);
      });
      button.innerHTML = `<i class="fas fa-caret-square-up"></i>`;
      button.setAttribute("data-type", "move-up-in-list");
      buttons.appendChild(button);
    }
    // down icon - clickable
    {
      let button = document.createElement("span");
      button.title = g_localizedMoveDownInListText;
      button.addEventListener("click", (event) => {
        onMoveFileDownInList(li, id);
      });
      button.innerHTML = `<i class="fas fa-caret-square-down"></i>`;
      button.setAttribute("data-type", "move-down-in-list");
      buttons.appendChild(button);
    }
    // remove icon - clickable
    {
      let button = document.createElement("span");
      button.title = g_localizedRemoveFromListText;
      button.addEventListener("click", (event) => {
        onRemoveFileFromList(li, id);
      });
      button.innerHTML = `<i class="fas fa-window-close"></i>`;
      button.setAttribute("data-type", "remove-from-list");
      buttons.appendChild(button);
    }
    //
    g_inputListDiv.appendChild(li);

    checkValidData();
  });

  on("change-output-folder", (folderPath) => {
    updateOutputFolder(folderPath);
    checkValidData();
  });

  on("change-output-format", (format) => {
    g_outputFormatSelect.value = format;
    g_outputFormat = format;
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

  /////////////////////////////////////////////////////////////////////////////

  on("start-first-file", () => {
    onStartNextFile();
  });

  on("file-images-extracted", () => {
    let imageFormatParams = {
      jpgQuality: document.querySelector("#tool-cc-jpg-quality-slider").value,
      jpgMozjpeg: document.querySelector("#tool-cc-jpg-mozjpeg-checkbox")
        .checked,
      pngQuality: document.querySelector("#tool-cc-png-quality-slider").value,
      avifQuality: document.querySelector("#tool-cc-avif-quality-slider").value,
      webpQuality: document.querySelector("#tool-cc-webp-quality-slider").value,
    };
    if (g_mode === 0) {
      // convert tool
      sendIpcToMain(
        "resize-images",
        g_inputFilePath,
        g_outputImageScaleSlider.value,
        imageFormatParams,
        g_outputFormat,
        g_outputFolderPath,
        g_outputSplitNumFilesInput.value,
        g_outputPasswordInput.value
      );
    } else {
      // create tool
      if (
        g_inputFilePath === undefined || // special case, all images done at once
        g_inputFilesIndex === g_inputFiles.length - 1
      ) {
        // all done - resize and make file
        sendIpcToMain(
          "resize-images",
          g_inputFilePath,
          g_outputImageScaleSlider.value,
          imageFormatParams,
          g_outputFormat,
          g_outputFolderPath,
          g_outputSplitNumFilesInput.value,
          g_outputPasswordInput.value
        );
      } else {
        onStartNextFile();
      }
    }
  });

  on("file-finished-ok", () => {
    if (g_mode === 1) {
      if (g_inputFilePath === undefined) {
        // special case, all images done at once
        sendIpcToMain(
          "end",
          false,
          g_inputFiles.length,
          0,
          g_inputFiles.length
        );
        return;
      }
    }
    if (g_inputFilesIndex < g_inputFiles.length - 1) {
      onStartNextFile();
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

  on("file-finished-error", () => {
    const modalButtonClose = g_openModal.querySelector(
      "#tool-cc-modal-close-button"
    );
    if (g_mode === 0) {
      modalButtonClose.classList.remove("modal-button-success-color");
      modalButtonClose.classList.add("modal-button-danger-color");
      g_numErrors++;
      if (g_inputFilesIndex < g_inputFiles.length - 1) {
        onStartNextFile();
      } else {
        sendIpcToMain(
          "end",
          false,
          g_inputFiles.length,
          g_numErrors,
          g_inputFilesIndex + 1
        );
      }
    } else {
      const modalButtonCancel = g_openModal.querySelector(
        "#tool-cc-modal-cancel-button"
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
        false,
        g_inputFiles.length,
        g_inputFiles.length,
        g_inputFilesIndex // last one wasn't converted or error
      );
    }
  });

  on("file-finished-canceled", () => {
    const modalButtonCancel = g_openModal.querySelector(
      "#tool-cc-modal-cancel-button"
    );
    const modalButtonClose = g_openModal.querySelector(
      "#tool-cc-modal-close-button"
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
      "#tool-cc-modal-cancel-button"
    );
    const modalButtonClose = g_openModal.querySelector(
      "#tool-cc-modal-close-button"
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
  if (
    g_outputFolderPath === undefined ||
    g_inputFiles.length <= 0 ||
    (g_mode === 0 && g_outputNameInput.value === "")
  ) {
    g_startButton.classList.add("tools-disabled");
  } else {
    g_startButton.classList.remove("tools-disabled");
  }
  ///////////////////
  for (let index = 0; index < g_inputListDiv.childElementCount; ++index) {
    const element = g_inputListDiv.children[index];
    const moveUpSpan = element.querySelector('[data-type="move-up-in-list"]');
    const moveDownSpan = element.querySelector(
      '[data-type="move-down-in-list"]'
    );
    if (index === 0) {
      moveUpSpan.classList.add("tools-disabled");
    } else {
      moveUpSpan.classList.remove("tools-disabled");
    }
    if (index === g_inputListDiv.childElementCount - 1) {
      moveDownSpan.classList.add("tools-disabled");
    } else {
      moveDownSpan.classList.remove("tools-disabled");
    }
  }
  ///////////////////
  updateColumnsHeight();
}

function updateOutputFolder(folderPath) {
  g_outputFolderPath = folderPath;
  g_outputFolderDiv.innerHTML = "";
  let li = document.createElement("li");
  li.className = "tools-collection-li";
  // text
  let text = document.createElement("span");
  text.innerText = reducePathString(g_outputFolderPath);
  li.appendChild(text);
  g_outputFolderDiv.appendChild(li);
}

function onRemoveFileFromList(element, id) {
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

function onMoveFileUpInList(element, id) {
  let parentNode = element.parentNode;
  let currentIndex = [...parentNode.children].indexOf(element);
  let desiredIndex = currentIndex - 1;
  if (desiredIndex >= 0) {
    let currentNode = parentNode.children[currentIndex];
    let desiredNode = parentNode.children[desiredIndex];
    // swap
    for (let index = 0; index < g_inputFiles.length; index++) {
      if (g_inputFiles[index].id === id) {
        if (index !== currentIndex) {
          console.log("index !== currentIndex || this shouldn't happen!");
          return;
        }
        // hack to do a copy not by reference
        const currentData = JSON.parse(
          JSON.stringify(g_inputFiles[currentIndex])
        );
        const desiredData = JSON.parse(
          JSON.stringify(g_inputFiles[desiredIndex])
        );
        g_inputFiles[currentIndex] = desiredData;
        g_inputFiles[desiredIndex] = currentData;
        // html
        parentNode.insertBefore(currentNode, desiredNode);
        checkValidData();
        break;
      }
    }
  }
}

function onMoveFileDownInList(element, id) {
  let total = element.parentElement.childElementCount;
  let parentNode = element.parentNode;
  let currentIndex = [...parentNode.children].indexOf(element);
  let desiredIndex = currentIndex + 1;
  if (desiredIndex < total) {
    let currentNode = parentNode.children[currentIndex];
    let desiredNode = parentNode.children[desiredIndex];
    // swap
    for (let index = 0; index < g_inputFiles.length; index++) {
      if (g_inputFiles[index].id === id) {
        if (index !== currentIndex) {
          console.log("index !== currentIndex || this shouldn't happen!");
          return;
        }
        // hack to do a copy not by reference
        const currentData = JSON.parse(
          JSON.stringify(g_inputFiles[currentIndex])
        );
        const desiredData = JSON.parse(
          JSON.stringify(g_inputFiles[desiredIndex])
        );
        g_inputFiles[currentIndex] = desiredData;
        g_inputFiles[desiredIndex] = currentData;
        // html
        parentNode.insertBefore(desiredNode, currentNode);
        checkValidData();
        break;
      }
    }
  }
}

function onStart() {
  if (!g_openModal) showLogModal(); // TODO: check if first time?

  g_inputFilePath = undefined;
  g_inputFilesIndex = -1;
  g_numErrors = 0;
  updateLogText("", false);

  g_cancel = false;
  const modalButtonCancel = g_openModal.querySelector(
    "#tool-cc-modal-cancel-button"
  );
  const modalButtonClose = g_openModal.querySelector(
    "#tool-cc-modal-close-button"
  );
  modalButtonCancel.innerText = g_localizedModalCancelButtonText;
  modalButtonClose.innerText = g_localizedModalCloseButtonText;
  modalButtonCancel.classList.remove("set-display-none");
  modalButtonClose.classList.add("set-display-none");
  if (g_numErrors === 0) {
    modalButtonClose.classList.add("modal-button-success-color");
    modalButtonClose.classList.remove("modal-button-danger-color");
  }

  if (g_outputFormat === undefined) g_outputFormat = FileExtension.CBZ;

  sendIpcToMain(
    "start",
    g_inputFiles,
    g_mode === 0 ? undefined : g_outputNameInput.value
  );
}

function onStartNextFile() {
  g_inputFilesIndex++;
  g_inputFilePath = g_inputFiles[g_inputFilesIndex].path;
  g_inputFileType = g_inputFiles[g_inputFilesIndex].type;
  sendIpcToMain(
    "start-file",
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
    .querySelector("#tool-cc-modal-cancel-button")
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
            filePaths.push(file.path);
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
        id: "tool-cc-modal-cancel-button",
        dontClose: true,
        key: "Escape",
      },
      {
        text: " ",
        callback: () => {
          modalClosed();
        },
        fullWidth: true,
        id: "tool-cc-modal-close-button",
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

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalization(localization, tooltipsLocalization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.querySelector("#" + element.id);
    if (element.id === "tool-cc-keep-format-text") {
      g_outputImageFormatNotSetText = element.text;
    } else if (element.id === "tool-cc-modal-close-button-text") {
      g_localizedModalCloseButtonText = element.text;
    } else if (element.id === "tool-cc-modal-cancel-button-text") {
      g_localizedModalCancelButtonText = element.text;
    } else if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }

  for (let index = 0; index < tooltipsLocalization.length; index++) {
    const element = tooltipsLocalization[index];
    const domElement = document.querySelector("#" + element.id);
    if (element.id === "tool-cc-tooltip-remove-from-list") {
      g_localizedRemoveFromListText = element.text;
    } else if (element.id === "tool-cc-tooltip-move-up-in-list") {
      g_localizedMoveUpInListText = element.text;
    } else if (element.id === "tool-cc-tooltip-move-down-in-list") {
      g_localizedMoveDownInListText = element.text;
    } else if (domElement !== null) {
      domElement.title = element.text;
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
