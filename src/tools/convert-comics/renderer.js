/**
 * @license
 * Copyright 2020-2026 Álvaro García
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

const ToolMode = {
  CONVERT: 0,
  CREATE: 1,
};
let g_mode = ToolMode.CONVERT;

let g_inputList = [];
let g_inputFiles = [];
let g_inputFilesIndex = 0;
let g_inputListID = 0;

let g_cancel = false;
let g_numErrors = 0;
let g_failedFilePaths = [];

let g_inputFilePath;

let g_inputListDiv;
let g_outputFolderDiv;
let g_startButton;
let g_outputFormatSelect;
let g_outputImageScaleSelect;
let g_outputImageFormatSelect;
let g_outputSplitNumFilesInput;
let g_outputPasswordInput;

let g_outputNameInput;

let g_localizedTexts = {};

let g_uiSelectedOptions = {};

let g_defaultImageWorkers;

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;

export function needsScrollToTopButtonUpdate() {
  return true;
}

function init(
  mode,
  outputFolderPath,
  canEditRars,
  loadedOptions,
  defaultImageWorkers,
) {
  g_mode = mode;
  g_defaultImageWorkers = defaultImageWorkers;
  if (!g_isInitialized) {
    // things to start only once go here
    g_isInitialized = true;
  }
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "instant",
    block: "start",
    inline: "nearest",
  });

  g_inputList = [];
  g_inputListID = 0;

  g_inputFiles = [];
  g_inputFilesIndex = -1;

  g_cancel = false;
  g_numErrors = 0;
  g_failedFilePaths = [];

  // menu buttons
  document
    .getElementById("tool-cc-back-button")
    .addEventListener("click", (event) => {
      updateCurrentOptions();
      sendIpcToMain("save-settings-options", getChangedOptions());
      sendIpcToMain("close-clicked");
    });
  document
    .getElementById("tool-cc-start-button")
    .addEventListener("click", (event) => {
      updateUISelectedOptions();
      sendIpcToMain("start-clicked", g_inputList, g_uiSelectedOptions);
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
  document
    .getElementById("tool-cc-section-settings-button")
    .addEventListener("click", (event) => {
      switchSection(2);
    });
  ////////////////////////////////////////
  g_inputListDiv = document.querySelector("#tool-cc-input-list");

  g_outputFolderDiv = document.querySelector("#tool-cc-output-folder");
  g_outputFormatSelect = document.querySelector(
    "#tool-cc-output-format-select",
  );
  g_outputImageScaleSelect = document.querySelector(
    "#tool-cc-output-image-scale-select",
  );
  g_outputImageFormatSelect = document.querySelector(
    "#tool-cc-output-image-format-select",
  );
  g_outputSplitNumFilesInput = document.querySelector(
    "#tool-cc-split-num-files-input",
  );
  g_outputSplitNumFilesInput.value = 1;
  g_outputPasswordInput = document.querySelector("#tool-cc-password-input");

  g_startButton = document.querySelector("#tool-cc-start-button");

  document
    .getElementById("tool-cc-add-file-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputList && g_inputList.length > 0) {
        lastFilePath = g_inputList[g_inputList.length - 1].path;
      }
      sendIpcToMain("add-file-clicked", lastFilePath);
    });

  document
    .getElementById("tool-cc-add-folder-button")
    .addEventListener("click", (event) => {
      let lastFilePath = undefined;
      if (g_inputList && g_inputList.length > 0) {
        lastFilePath = g_inputList[g_inputList.length - 1].path;
      }
      sendIpcToMain("add-folder-clicked", lastFilePath);
    });

  document
    .getElementById("tool-cc-clear-list-button")
    .addEventListener("click", (event) => {
      // clear list
      g_inputList = [];
      g_inputListID = 0;
      g_inputListDiv.innerHTML = "";
      checkValidData();
    });

  document
    .getElementById("tool-cc-folders-recursively-checkbox")
    .addEventListener("change", (event) => {
      checkValidData();
    });

  const outputFolderChangeButton = document.getElementById(
    "tool-cc-change-folder-button",
  );
  outputFolderChangeButton.addEventListener("click", (event) => {
    let lastFilePath = undefined;
    if (g_inputList && g_inputList.length > 0) {
      lastFilePath = g_inputList[g_inputList.length - 1].path;
    }
    sendIpcToMain(
      "change-folder-clicked",
      lastFilePath,
      g_uiSelectedOptions.outputFolderPath,
    );
  });

  const outputFolderOpenButton = document.getElementById(
    "tool-cc-open-folder-button",
  );
  outputFolderOpenButton.addEventListener("click", (event) => {
    sendIpcToMain(
      "open-path-in-file-browser",
      g_uiSelectedOptions.outputFolderPath,
    );
  });

  const outputFolderOptionSelect = document.getElementById(
    "tool-cc-output-folder-option-select",
  );
  if (g_mode === ToolMode.CONVERT) {
    outputFolderOptionSelect.innerHTML =
      `<option value="0">${g_localizedTexts.outputFolderOption0}</option>` +
      `<option value="1">${g_localizedTexts.outputFolderOption1}</option>`;
    outputFolderOptionSelect.addEventListener("change", (event) => {
      // updateFolderOptionUI();
      // updateColumnsHeight();
      checkValidData();
    });
  } else {
    outputFolderOptionSelect.classList.add("set-display-none");
    document
      .getElementById("tool-cc-tooltip-output-folder")
      .classList.remove("set-display-none");
  }

  g_outputFormatSelect.innerHTML =
    '<option value="cbz">cbz</option>' +
    '<option value="pdf">pdf</option>' +
    '<option value="epub">epub</option>' +
    '<option value="cb7">cb7</option>';
  if (canEditRars) {
    g_outputFormatSelect.innerHTML += '<option value="cbr">cbr</option>';
  }
  g_outputFormatSelect.addEventListener("change", (event) => {
    checkValidData();
  });

  g_outputImageScaleSelect.addEventListener("change", (event) => {
    checkValidData();
  });

  g_outputImageFormatSelect.innerHTML =
    '<option value="' +
    FileExtension.NOT_SET +
    '">' +
    g_localizedTexts.outputImageFormatNotSet +
    "</option>" +
    '<option value="jpg">jpg</option>' +
    '<option value="png">png</option>' +
    '<option value="webp">webp</option>' +
    '<option value="avif">avif</option>';
  g_outputImageFormatSelect.addEventListener("change", (event) => {
    checkValidData();
  });

  toolsShared.initSliders();

  // image processing //

  const imageMultithreadingSelect = document.getElementById(
    "tool-cc-imageprocessing-multithreading-method-select",
  );
  imageMultithreadingSelect.addEventListener("change", (event) => {
    updateImageMultithreadingUI();
    updateColumnsHeight();
  });

  const imageMultithreadingWorkersInput = document.getElementById(
    "tool-cc-imageprocessing-multithreading-numworkers-input",
  );
  imageMultithreadingWorkersInput.addEventListener("change", (event) => {
    updateImageMultithreadingUI();
  });

  const imageMultithreadingSharpConcInput = document.getElementById(
    "tool-cc-imageprocessing-multithreading-sharpconcurrency-input",
  );
  imageMultithreadingSharpConcInput.addEventListener("change", (event) => {
    updateImageMultithreadingUI();
  });

  // conversion / creation //
  g_outputNameInput = document.querySelector("#tool-cc-output-name-input");
  if (g_mode === ToolMode.CONVERT) {
    document
      .getElementById("tool-cc-output-page-order-label")
      .classList.add("set-display-none");
    document
      .getElementById("tool-cc-output-name-label")
      .classList.add("set-display-none");
  } else {
    g_outputNameInput.addEventListener("input", (event) => {
      checkValidData();
    });
  }

  //////

  document
    .querySelector("#tool-cc-folders-contain-select")
    .addEventListener("change", (event) => {
      checkValidData();
    });

  const inputSearchFoldersFormatsDiv = document.querySelector(
    "#tool-cc-folders-file-formats-div",
  );
  let formats = [];
  if (g_mode === ToolMode.CONVERT) {
    formats = [".cbz", ".cbr", ".pdf", ".epub", ".cb7"];
  } else {
    formats = [
      ".cbz",
      ".cbr",
      ".pdf",
      ".epub",
      ".cb7",
      ".jpg",
      ".png",
      ".webp",
      ".avif",
    ];
  }
  formats.forEach((format) => {
    const label = document.createElement("label");
    label.classList.add("tools-checkbox-container");
    inputSearchFoldersFormatsDiv.appendChild(label);

    const input = document.createElement("input");
    input.id = "tool-cc-folders-file-formats-" + format.slice(1);
    input.type = "checkbox";
    input.checked = true;
    label.appendChild(input);

    const span = document.createElement("span");
    span.innerText = format;
    label.appendChild(span);
  });

  const outputFileSameNameSelect = document.getElementById(
    "tool-cc-output-file-same-name-select",
  );
  outputFileSameNameSelect.innerHTML =
    `<option value="rename">${g_localizedTexts.outputFileSameNameOption0}</option>` +
    `<option value="skip">${g_localizedTexts.outputFileSameNameOption2}</option>` +
    `<option value="overwrite">${g_localizedTexts.outputFileSameNameOption1}</option>`;

  ////////////////

  document
    .querySelector("#tool-cc-imageops-brightness-checkbox")
    .addEventListener("change", (event) => {
      updateImageOpsUI();
    });
  document
    .querySelector("#tool-cc-imageops-saturation-checkbox")
    .addEventListener("change", (event) => {
      updateImageOpsUI();
    });
  document
    .querySelector("#tool-cc-imageops-crop-checkbox")
    .addEventListener("change", (event) => {
      updateImageOpsUI();
    });
  document
    .querySelector("#tool-cc-imageops-extend-checkbox")
    .addEventListener("change", (event) => {
      updateImageOpsUI();
    });

  ////////////////////////////////////////
  // settings
  document
    .getElementById("tool-cc-settings-reset-button")
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
        element.getAttribute("data-info"),
      );
    });
  });
  ////////////////////////////////////////
  initOptions(outputFolderPath, loadedOptions, defaultImageWorkers);
  // initOptions calls checkValidData(); -> calls updateColumnsHeight();
}

export function initIpc() {
  initOnIpcCallbacks();
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
      document
        .getElementById("tool-cc-section-settings-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-cc-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-output-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-imageprocessing-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-advanced-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-imageprocessing-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-settings-section-div")
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
      document
        .getElementById("tool-cc-section-settings-button")
        .classList.remove("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-cc-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-imageprocessing-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-input-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-advanced-output-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-advanced-imageprocessing-options-section-div")
        .classList.remove("set-display-none");
      document
        .getElementById("tool-cc-settings-section-div")
        .classList.add("set-display-none");
      break;
    case 2:
      // buttons
      document
        .getElementById("tool-cc-section-general-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-cc-section-advanced-options-button")
        .classList.remove("tools-menu-button-selected");
      document
        .getElementById("tool-cc-section-settings-button")
        .classList.add("tools-menu-button-selected");
      // sections
      document
        .getElementById("tool-cc-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-imageprocessing-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-input-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-output-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-advanced-imageprocessing-options-section-div")
        .classList.add("set-display-none");
      document
        .getElementById("tool-cc-settings-section-div")
        .classList.remove("set-display-none");
      break;
  }
  updateColumnsHeight(true);
}

///////////////////////////////////////////////////////////////////////////////
// SELECTED OPTIONS TO SEND ///////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateUISelectedOptions() {
  g_uiSelectedOptions.outputBrightnessApply = document.querySelector(
    "#tool-cc-imageops-brightness-checkbox",
  ).checked;
  g_uiSelectedOptions.outputBrightnessMultiplier = document.querySelector(
    "#tool-cc-imageops-brightness-input",
  ).value;
  g_uiSelectedOptions.outputSaturationApply = document.querySelector(
    "#tool-cc-imageops-saturation-checkbox",
  ).checked;
  g_uiSelectedOptions.outputSaturationMultiplier = document.querySelector(
    "#tool-cc-imageops-saturation-input",
  ).value;
  g_uiSelectedOptions.outputCropApply = document.querySelector(
    "#tool-cc-imageops-crop-checkbox",
  ).checked;
  g_uiSelectedOptions.outputCropValue = document.querySelector(
    "#tool-cc-imageops-crop-input",
  ).value;
  g_uiSelectedOptions.outputExtendApply = document.querySelector(
    "#tool-cc-imageops-extend-checkbox",
  ).checked;
  g_uiSelectedOptions.outputExtendValue = document.querySelector(
    "#tool-cc-imageops-extend-input",
  ).value;
  g_uiSelectedOptions.outputExtendColor = document.querySelector(
    "#tool-cc-imageops-extend-color-input",
  ).value;
  /////////////////
  g_uiSelectedOptions.inputFoldersContain = document.getElementById(
    "tool-cc-folders-contain-select",
  ).value;
  g_uiSelectedOptions.inputSearchFoldersFormats = [];
  const inputSearchFoldersFormatsDiv = document.querySelector(
    "#tool-cc-folders-file-formats-div",
  );
  const inputSearchFoldersFormatsInputs =
    inputSearchFoldersFormatsDiv.querySelectorAll("input");
  inputSearchFoldersFormatsInputs.forEach((formatInput) => {
    if (formatInput.checked) {
      g_uiSelectedOptions.inputSearchFoldersFormats.push(
        formatInput.parentElement.querySelector("span").innerText,
      );
    }
  });
  g_uiSelectedOptions.inputSearchFoldersRecursively = document.querySelector(
    "#tool-cc-folders-recursively-checkbox",
  ).checked;
  //////////////////
  g_uiSelectedOptions.inputPdfExtractionMethod = document.getElementById(
    "tool-cc-pdf-extraction-select",
  ).value;
  g_uiSelectedOptions.inputPdfExtractionLib = document.getElementById(
    "tool-cc-pdf-extraction-lib-select",
  ).value;
  // g_selectedOptions.outputFolderPath is autoupdated
  g_uiSelectedOptions.outputKeepSubfoldersStructure = document.querySelector(
    "#tool-cc-keep-subfolders-structure-checkbox",
  ).checked;
  g_uiSelectedOptions.outputFolderOption = document.getElementById(
    "tool-cc-output-folder-option-select",
  ).value;
  g_uiSelectedOptions.outputFormat = g_outputFormatSelect.value;
  g_uiSelectedOptions.outputImageFormat = g_outputImageFormatSelect.value;
  if (g_mode === ToolMode.CONVERT) {
    g_uiSelectedOptions.outputFileBaseName = "";
  } else {
    g_uiSelectedOptions.outputFileBaseName = g_outputNameInput.value;
  }
  g_uiSelectedOptions.outputImageScaleOption = g_outputImageScaleSelect.value;
  g_uiSelectedOptions.outputImageScalePercentage = document.querySelector(
    "#tool-cc-output-image-scale-slider",
  ).value;
  g_uiSelectedOptions.outputImageScaleHeight = document.querySelector(
    "#tool-cc-output-image-scale-height-input",
  ).value;
  g_uiSelectedOptions.outputImageScaleWidth = document.querySelector(
    "#tool-cc-output-image-scale-width-input",
  ).value;
  g_uiSelectedOptions.outputSplitNumFiles = g_outputSplitNumFilesInput.value;
  g_uiSelectedOptions.outputPassword = g_outputPasswordInput.value;

  g_uiSelectedOptions.outputFileSameName = document.getElementById(
    "tool-cc-output-file-same-name-select",
  ).value;
  g_uiSelectedOptions.outputPageOrder = document.getElementById(
    "tool-cc-output-page-order-select",
  ).value;
  g_uiSelectedOptions.outputPdfCreationMethod = document.getElementById(
    "tool-cc-pdf-creation-select",
  ).value;
  g_uiSelectedOptions.outputEpubCreationImageFormat = document.getElementById(
    "tool-cc-epub-creation-image-format-select",
  ).value;
  g_uiSelectedOptions.outputEpubCreationImageStorage = document.getElementById(
    "tool-cc-epub-creation-image-storage-select",
  ).value;

  g_uiSelectedOptions.outputImageFormatParams = {
    jpgQuality: document.querySelector("#tool-cc-jpg-quality-slider").value,
    jpgMozjpeg: document.querySelector("#tool-cc-jpg-mozjpeg-checkbox").checked,
    pngQuality: document.querySelector("#tool-cc-png-quality-slider").value,
    avifQuality: document.querySelector("#tool-cc-avif-quality-slider").value,
    webpQuality: document.querySelector("#tool-cc-webp-quality-slider").value,
  };

  g_uiSelectedOptions.outputBrightnessApply = document.querySelector(
    "#tool-cc-imageops-brightness-checkbox",
  ).checked;
  g_uiSelectedOptions.outputBrightnessMultiplier = document.querySelector(
    "#tool-cc-imageops-brightness-input",
  ).value;
  g_uiSelectedOptions.outputSaturationApply = document.querySelector(
    "#tool-cc-imageops-saturation-checkbox",
  ).checked;
  g_uiSelectedOptions.outputSaturationMultiplier = document.querySelector(
    "#tool-cc-imageops-saturation-input",
  ).value;
  g_uiSelectedOptions.outputCropApply = document.querySelector(
    "#tool-cc-imageops-crop-checkbox",
  ).checked;
  g_uiSelectedOptions.outputCropValue = document.querySelector(
    "#tool-cc-imageops-crop-input",
  ).value;
  g_uiSelectedOptions.outputExtendApply = document.querySelector(
    "#tool-cc-imageops-extend-checkbox",
  ).checked;
  g_uiSelectedOptions.outputExtendValue = document.querySelector(
    "#tool-cc-imageops-extend-input",
  ).value;
  g_uiSelectedOptions.outputExtendColor = document.querySelector(
    "#tool-cc-imageops-extend-color-input",
  ).value;

  // advanced image operations

  g_uiSelectedOptions.imageProcessingMultithreadingMethod =
    document.getElementById(
      "tool-cc-imageprocessing-multithreading-method-select",
    ).value;
  g_uiSelectedOptions.imageProcessingNumWorkers = document.getElementById(
    "tool-cc-imageprocessing-multithreading-numworkers-input",
  ).value;
  g_uiSelectedOptions.imageProcessingSharpConcurrency = document.getElementById(
    "tool-cc-imageprocessing-multithreading-sharpconcurrency-input",
  ).value;
}

///////////////////////////////////////////////////////////////////////////////
// UPDATE UI //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateFolderOptionUI() {
  if (g_mode === ToolMode.CONVERT) {
    const outputFolderOptionSelect = document.getElementById(
      "tool-cc-output-folder-option-select",
    );
    const outputFolderUl = document.getElementById("tool-cc-output-folder");
    const outputFolderChangeButton = document.getElementById(
      "tool-cc-change-folder-button",
    );
    const outputFolderOpenButton = document.getElementById(
      "tool-cc-open-folder-button",
    );
    if (outputFolderOptionSelect.value === "0") {
      outputFolderUl.classList.remove("set-display-none");
      outputFolderChangeButton.classList.remove("set-display-none");
      outputFolderOpenButton.classList.remove("set-display-none");
      updateColumnsHeight();
    } else {
      outputFolderUl.classList.add("set-display-none");
      outputFolderChangeButton.classList.add("set-display-none");
      outputFolderOpenButton.classList.add("set-display-none");
      updateColumnsHeight();
    }
  }
}

function updateImageMultithreadingUI() {
  const imageMultithreadingSelect = document.getElementById(
    "tool-cc-imageprocessing-multithreading-method-select",
  );
  const method0Div = document.getElementById(
    "tool-cc-imageprocessing-multithreading-method-0-div",
  );
  if (imageMultithreadingSelect.value === "0") {
    method0Div.classList.remove("set-display-none");
    updateColumnsHeight();
  } else {
    method0Div.classList.add("set-display-none");
    updateColumnsHeight();
  }
  //
  const imageMultithreadingWorkersInput = document.getElementById(
    "tool-cc-imageprocessing-multithreading-numworkers-input",
  );
  if (imageMultithreadingWorkersInput.value <= 0) {
    imageMultithreadingWorkersInput.value = g_defaultImageWorkers;
  }
  //
  const imageMultithreadingSharpConcInput = document.getElementById(
    "tool-cc-imageprocessing-multithreading-sharpconcurrency-input",
  );
  if (imageMultithreadingSharpConcInput.value < 0) {
    imageMultithreadingSharpConcInput.value = 1;
  }
}

function updateImageOpsUI() {
  // TODO: validate input boxes values?
  const checkboxIds = [
    "#tool-cc-imageops-brightness-checkbox",
    "#tool-cc-imageops-saturation-checkbox",
    "#tool-cc-imageops-crop-checkbox",
    "#tool-cc-imageops-extend-checkbox",
  ];
  checkboxIds.forEach((checkboxId) => {
    const checkbox = document.querySelector(checkboxId);
    if (checkbox.checked) {
      checkbox.parentNode
        .querySelector(".tools-imageop-controls-div")
        .classList.remove("tools-disabled");
    } else {
      checkbox.parentNode
        .querySelector(".tools-imageop-controls-div")
        .classList.add("tools-disabled");
    }
  });
}

function updateOutputFolderUI() {
  g_outputFolderDiv.innerHTML = "";
  let li = document.createElement("li");
  li.className = "tools-collection-li";
  // text
  let text = document.createElement("span");
  text.innerText = reducePathString(g_uiSelectedOptions.outputFolderPath);
  li.appendChild(text);
  g_outputFolderDiv.appendChild(li);
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

///////////////////////////////////////////////////////////////////////////////
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

// function beforeUnloadHandler(event) {
//   updateCurrentOptions();
//   sendIpcToMain("set-unsaved-settings-options", getChangedOptions());
// }

function initOnIpcCallbacks() {
  on("show", (...args) => {
    init(...args);
    //window.addEventListener("beforeunload", beforeUnloadHandler);
  });

  on("hide", () => {
    //window.removeEventListener("beforeunload", beforeUnloadHandler);
  });

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
    sendIpcToMain("close-clicked");
  });

  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });

  on("show-modal-info", (...args) => {
    showModalInfo(...args);
  });

  on("add-item-to-input-list", (path, type) => {
    if (path === undefined || type === undefined) return;

    for (let index = 0; index < g_inputList.length; index++) {
      if (g_inputList[index].path === path) {
        return;
      }
    }
    let id = g_inputListID++;
    g_inputList.push({
      id: id,
      path: path,
      type: type,
    });

    let li = document.createElement("li");
    li.className = "tools-collection-li";
    // icon
    let icon = document.createElement("span");
    icon.innerHTML = `<i class="fas ${
      type === 0 ? "fa-file" : "fa-folder"
    }"></i>`;
    li.appendChild(icon);
    // text
    let text = document.createElement("span");
    text.innerText = reducePathString(path);
    li.appendChild(text);
    // buttons
    let buttons = document.createElement("span");
    buttons.className = "tools-collection-li-buttonset";
    li.appendChild(buttons);
    // up icon - clickable
    {
      let button = document.createElement("span");
      button.title = g_localizedTexts.moveUpInList;
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
      button.title = g_localizedTexts.moveDownInList;
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
      button.title = g_localizedTexts.removeFromList;
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
    changeOutputFolder(folderPath);
    checkValidData();
  });

  on("change-output-format", (format) => {
    g_outputFormatSelect.value = format;
    checkValidData();
  });

  /////////////////////////////////////////////////////////////////////////////

  on("modal-update-title-text", (text) => {
    updateModalTitleText(text);
  });

  on("update-info-text", (text) => {
    updateInfoText(text);
  });

  on("update-log-text", (...args) => {
    updateLogText(...args);
  });

  /////////////////////////////////////////////////////////////////////////////

  on("start-accepted", (inputFiles) => {
    onStart(inputFiles);
  });

  on("start-first-file", () => {
    onStartNextFile();
  });

  on("file-images-extracted", () => {
    if (g_mode === ToolMode.CONVERT) {
      // convert tool
      sendIpcToMain("process-content", g_inputFilePath);
    } else {
      // create tool
      if (
        g_inputFilePath === undefined || // special case, all images done at once
        g_inputFilesIndex === g_inputFiles.length - 1
      ) {
        // all done - resize and make file
        sendIpcToMain("process-content", g_inputFilePath);
      } else {
        onStartNextFile();
      }
    }
  });

  on("file-finished-ok", () => {
    if (g_mode === ToolMode.CREATE) {
      if (g_inputFilePath === undefined) {
        // special case, all images done at once
        sendIpcToMain(
          "end",
          false,
          g_inputFiles.length,
          0,
          g_inputFiles.length,
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
        g_inputFilesIndex + 1,
      );
    }
  });

  on("file-finished-error", () => {
    const modalButtonClose = g_openModal.querySelector(
      "#tool-cc-modal-close-button",
    );
    if (g_mode === ToolMode.CONVERT) {
      modalButtonClose.classList.remove("modal-button-success-color");
      modalButtonClose.classList.add("modal-button-danger-color");
      g_numErrors++;
      g_failedFilePaths.push(g_inputFiles[g_inputFilesIndex]);
      if (g_inputFilesIndex < g_inputFiles.length - 1) {
        onStartNextFile();
      } else {
        sendIpcToMain(
          "end",
          false,
          g_inputFiles.length,
          g_numErrors,
          g_inputFilesIndex + 1,
        );
      }
    } else {
      const modalButtonCancel = g_openModal.querySelector(
        "#tool-cc-modal-cancel-button",
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
        g_inputFilesIndex, // last one wasn't converted or error
      );
    }
  });

  on("file-finished-canceled", () => {
    const modalButtonCancel = g_openModal.querySelector(
      "#tool-cc-modal-cancel-button",
    );
    const modalButtonClose = g_openModal.querySelector(
      "#tool-cc-modal-close-button",
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
      g_inputFilesIndex, // last one wasn't converted or error
    );
  });

  on("show-result", (failedFilesText) => {
    if (g_failedFilePaths.length > 0) {
      updateLogText(
        "------------ " + failedFilesText + ": ------------\n",
        true,
      );
      g_failedFilePaths.forEach((fileData) => {
        updateLogText(fileData.path, true);
      });
    }

    // if the full log is huge I also crop it
    if (g_fullLogContent.length > 1000000) {
      g_fullLogContent =
        "[...]" +
        g_fullLogContent.substring(
          g_fullLogContent.length - 1000000,
          g_fullLogContent.length,
        );
    }
    g_modalLog.innerHTML = g_fullLogContent;
    g_modalLog.classList.remove("modal-log-noscrollbar");
    g_modalLog.scrollTop = g_modalLog.scrollHeight;

    const modalButtonCancel = g_openModal.querySelector(
      "#tool-cc-modal-cancel-button",
    );
    const modalButtonClose = g_openModal.querySelector(
      "#tool-cc-modal-close-button",
    );
    const modalButtonCopyLog = g_openModal.querySelector(
      "#tool-cc-modal-copylog-button",
    );
    const modalLoadingBar = g_openModal.querySelector(".modal-progress-bar");
    modalButtonCancel.classList.add("set-display-none");
    modalButtonClose.classList.remove("set-display-none");
    modalButtonCopyLog.classList.remove("set-display-none");
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
  updateImageMultithreadingUI();
  updateImageOpsUI();
  updateFolderOptionUI();
  updateOutputFolderUI();
  toolsShared.updateSliders();

  updateUISelectedOptions();

  if (
    g_uiSelectedOptions.outputFolderPath === undefined ||
    g_inputList.length <= 0 ||
    (g_mode === ToolMode.CONVERT && g_outputNameInput.value === "")
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
      '[data-type="move-down-in-list"]',
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
  const outputKeepSubfoldersStructureDiv = document.querySelector(
    "#tool-cc-keep-subfolders-structure-div",
  );
  const outputKeepSubfoldersStructureToggle = document.querySelector(
    "#tool-cc-keep-subfolders-structure-toggle",
  );

  if (g_mode === ToolMode.CONVERT) {
    outputKeepSubfoldersStructureDiv.classList.remove("set-display-none");
    if (
      document.getElementById("tool-cc-output-folder-option-select").value ===
        "0" &&
      document.getElementById("tool-cc-folders-recursively-checkbox").checked &&
      document.getElementById("tool-cc-folders-contain-select").value ===
        "comics"
    ) {
      outputKeepSubfoldersStructureToggle.classList.remove("tools-disabled");
    } else {
      outputKeepSubfoldersStructureToggle.classList.add("tools-disabled");
    }
  } else {
    outputKeepSubfoldersStructureDiv.classList.add("set-display-none");
  }
  ///////////////////
  const folderContentsSelect = document.querySelector(
    "#tool-cc-folders-contain-select",
  );
  if (g_mode === ToolMode.CONVERT) {
    folderContentsSelect.parentElement.classList.remove("set-display-none");
    if (folderContentsSelect.value === "comics") {
      document
        .querySelector("#tool-cc-folders-file-formats-div")
        .classList.remove("set-display-none");
      document
        .querySelector("#tool-cc-folders-file-formats-text")
        .parentElement.classList.remove("set-display-none");
    } else {
      document
        .querySelector("#tool-cc-folders-file-formats-div")
        .classList.add("set-display-none");
      document
        .querySelector("#tool-cc-folders-file-formats-text")
        .parentElement.classList.add("set-display-none");
    }
  } else {
    folderContentsSelect.parentElement.classList.add("set-display-none");
  }
  ///////////////////
  if (g_outputImageScaleSelect.value === "0") {
    document
      .getElementById("tool-cc-output-image-scale-slider")
      .parentElement.classList.remove("set-display-none");
    document
      .getElementById("tool-cc-output-image-scale-height-input")
      .classList.add("set-display-none");
    document
      .getElementById("tool-cc-output-image-scale-width-input")
      .classList.add("set-display-none");
  } else if (g_outputImageScaleSelect.value === "1") {
    document
      .getElementById("tool-cc-output-image-scale-slider")
      .parentElement.classList.add("set-display-none");
    document
      .getElementById("tool-cc-output-image-scale-height-input")
      .classList.remove("set-display-none");
    document
      .getElementById("tool-cc-output-image-scale-width-input")
      .classList.add("set-display-none");
  } else if (g_outputImageScaleSelect.value === "2") {
    document
      .getElementById("tool-cc-output-image-scale-slider")
      .parentElement.classList.add("set-display-none");
    document
      .getElementById("tool-cc-output-image-scale-height-input")
      .classList.add("set-display-none");
    document
      .getElementById("tool-cc-output-image-scale-width-input")
      .classList.remove("set-display-none");
  }
  ///////////////////
  updateColumnsHeight();
}

function changeOutputFolder(folderPath) {
  g_uiSelectedOptions.outputFolderPath = folderPath;
  // g_currentOptions.outputFolderPath = folderPath;
}

function onRemoveFileFromList(element, id) {
  element.parentElement.removeChild(element);
  let removeIndex;
  for (let index = 0; index < g_inputList.length; index++) {
    if (g_inputList[index].id === id) {
      removeIndex = index;
      break;
    }
  }
  if (removeIndex !== undefined) {
    g_inputList.splice(removeIndex, 1);
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
    for (let index = 0; index < g_inputList.length; index++) {
      if (g_inputList[index].id === id) {
        if (index !== currentIndex) {
          console.log("index !== currentIndex || this shouldn't happen!");
          return;
        }
        // hack to do a copy not by reference
        const currentData = JSON.parse(
          JSON.stringify(g_inputList[currentIndex]),
        );
        const desiredData = JSON.parse(
          JSON.stringify(g_inputList[desiredIndex]),
        );
        g_inputList[currentIndex] = desiredData;
        g_inputList[desiredIndex] = currentData;
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
    for (let index = 0; index < g_inputList.length; index++) {
      if (g_inputList[index].id === id) {
        if (index !== currentIndex) {
          console.log("index !== currentIndex || this shouldn't happen!");
          return;
        }
        // hack to do a copy not by reference
        const currentData = JSON.parse(
          JSON.stringify(g_inputList[currentIndex]),
        );
        const desiredData = JSON.parse(
          JSON.stringify(g_inputList[desiredIndex]),
        );
        g_inputList[currentIndex] = desiredData;
        g_inputList[desiredIndex] = currentData;
        // html
        parentNode.insertBefore(desiredNode, currentNode);
        checkValidData();
        break;
      }
    }
  }
}

function onStart(inputFiles) {
  if (!g_openModal) showLogModal(); // TODO: check if first time?

  g_inputFiles = inputFiles;
  g_inputFilePath = undefined;
  g_inputFilesIndex = -1;
  g_numErrors = 0;
  g_failedFilePaths = [];
  updateLogText("", false);

  g_cancel = false;
  const modalButtonCancel = g_openModal.querySelector(
    "#tool-cc-modal-cancel-button",
  );
  const modalButtonClose = g_openModal.querySelector(
    "#tool-cc-modal-close-button",
  );
  const modalButtonCopyLog = g_openModal.querySelector(
    "#tool-cc-modal-copylog-button",
  );
  modalButtonCancel.innerText = g_localizedTexts.modalCancelButton;
  modalButtonClose.innerText = g_localizedTexts.modalCloseButton;
  modalButtonCopyLog.innerText = g_localizedTexts.modalCopyLogButton;
  modalButtonCancel.classList.remove("set-display-none");
  modalButtonClose.classList.add("set-display-none");
  modalButtonCopyLog.classList.add("set-display-none");
  if (g_numErrors === 0) {
    modalButtonClose.classList.add("modal-button-success-color");
    modalButtonClose.classList.remove("modal-button-danger-color");
  }

  sendIpcToMain("start");
}

function onStartNextFile() {
  g_inputFilesIndex++;
  g_inputFilePath = g_inputFiles[g_inputFilesIndex].path;
  sendIpcToMain("start-file", g_inputFilesIndex, g_inputFiles.length);
}

function onCancel() {
  if (g_cancel === true) return;
  g_cancel = true;
  g_openModal
    .querySelector("#tool-cc-modal-cancel-button")
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
      g_currentOptions,
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
  g_currentOptions.outputFolderPath = g_uiSelectedOptions.outputFolderPath;
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
let g_modalLog;
let g_partialLogContent = "";
let g_fullLogContent = "";

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
        id: "tool-cc-modal-copylog-button",
        dontClose: true,
      },
      {
        text: " ",
        callback: () => {
          onCancel();
        },
        fullWidth: true,
        id: "tool-cc-modal-cancel-button",
        dontClose: true,
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

  g_modalLog = g_openModal.querySelector(".modal-log");
  g_modalLog.classList.add("modal-log-noscrollbar");
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
      g_partialLogContent += "\n" + text;
      g_fullLogContent += "\n" + text;
    } else {
      g_partialLogContent = text;
      g_fullLogContent = text;
    }
    // show only enough to fill the viewable area
    if (g_partialLogContent.length > 2000)
      g_partialLogContent = g_partialLogContent.substring(
        g_partialLogContent.length - 1500,
        g_partialLogContent.length,
      );
    g_modalLog.innerHTML = g_partialLogContent;
    g_modalLog.scrollTop = g_modalLog.scrollHeight;
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
            g_currentOptions,
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
  localizedTexts,
) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.querySelector("#" + element.id);
    if (domElement !== null) {
      domElement.innerHTML = element.text;
    }
  }

  for (let index = 0; index < tooltipsLocalization.length; index++) {
    const element = tooltipsLocalization[index];
    const domElement = document.querySelector("#" + element.id);
    if (domElement !== null) {
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

  g_localizedTexts = localizedTexts;
}

function reducePathString(input) {
  var length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}
