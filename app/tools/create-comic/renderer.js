const fs = window.require("fs");
const path = require("path");
const { ipcRenderer } = require("electron");
const { FileExtension } = require("../../constants");

let g_ipcChannel = "tool-cr--";

let g_inputFiles = [];
let g_inputFilesIndex = 0;
let g_inputFilesID = 0;

let g_cancel = false;

let g_outputFileName;
let g_outputFormat;
let g_outputFolderPath;

let g_textInputFilesDiv = document.querySelector("#text-input-files");
let g_inputListDiv = document.querySelector("#input-list");
let g_inputListButton = document.querySelector("#button-add-file");
let g_outputFolderDiv = document.querySelector("#output-folder");
let g_startButton = document.querySelector("#button-start");
let g_outputNameDiv = document.querySelector("#output-name");
let g_outputNameInput = document.querySelector("#input-output-name");
let g_outputFormatSelect = document.querySelector("#output-format-select");

let g_modalInfoArea = document.querySelector("#modal-info");
let g_modalLogArea = document.querySelector("#modal-log");
let g_modalButtonClose = document.querySelector("#button-modal-close");
let g_modalButtonCancel = document.querySelector("#button-modal-cancel");
let g_modalLoadingBar = document.querySelector("#modal-loading-bar");
let g_modalTitle = document.querySelector("#modal-title");

g_localizedRemoveFromListText = "";

///////////////////////////////////////////////////////////////////////////////

function checkValidData() {
  g_outputNameDiv.classList.remove("hide");
  if (
    g_outputFolderPath !== undefined &&
    g_inputFiles.length > 0 &&
    g_outputNameInput.value !== ""
  ) {
    g_startButton.classList.remove("disabled");
  } else {
    g_startButton.classList.add("disabled");
  }
}

function reducePathString(input) {
  var length = 60;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(g_ipcChannel + "init", (event, outputFolderPath) => {
  g_outputFolderPath = outputFolderPath;
  g_outputFolderDiv.innerHTML = reducePathString(g_outputFolderPath);
  g_outputNameInput.value = "New File";
  g_inputListButton.classList.remove("hide");
  g_textInputFilesDiv.classList.remove("hide");
  g_outputFormatSelect.innerHTML =
    '<option value="cbz">.cbz (zip)</option>' +
    '<option value="pdf">.pdf</option>' +
    '<option value="epub">.epub</option>';

  checkValidData();
});

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (event, title, localization, tooltipsLocalization) => {
    document.title = title;
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
        domElement.title = element.text;
      }
      if (element.id === "tooltip-remove-from-list") {
        g_localizedRemoveFromListText = element.text;
      }
    }
  }
);

ipcRenderer.on(g_ipcChannel + "add-file", (event, filePath) => {
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

  g_inputListDiv.innerHTML +=
    "<li class='collection-item'><div>" +
    reducePathString(filePath) +
    "<a style='cursor: pointer;' onclick='renderer.onRemoveFile(this, " +
    id +
    ")' class='secondary-content'><i class='fas fa-window-close' title='" +
    g_localizedRemoveFromListText +
    "'></i></a>" +
    "</div></li>";
  checkValidData();
});

function onRemoveFile(element, id) {
  element.parentElement.parentElement.parentElement.removeChild(
    element.parentElement.parentElement
  );
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
exports.onRemoveFile = onRemoveFile;

ipcRenderer.on(g_ipcChannel + "change-output-folder", (event, folderPath) => {
  g_outputFolderPath = folderPath;
  g_outputFolderDiv.innerHTML = reducePathString(g_outputFolderPath);
  checkValidData();
});

///////////////////////////////////////////////////////////////////////////////

exports.onChooseInputFile = function () {
  let defaultPath = undefined;
  if (g_inputFiles.length > 0) {
    defaultPath = path.dirname(g_inputFiles[g_inputFiles.length - 1].path);
  }
  ipcRenderer.send(g_ipcChannel + "choose-file", defaultPath);
};

exports.onOutputFormatChanged = function (selectObject) {
  g_outputFormat = selectObject.value;
  checkValidData();
};

exports.onOutputNameChanged = function (selectObject) {
  g_outputName = selectObject.value;
  checkValidData();
};

exports.onOutputAdvancedPdfCreationChanged = function (selectObject) {
  ipcRenderer.send(
    g_ipcChannel + "set-pdf-creation-method",
    selectObject.value
  );
};

exports.onOutputPageOrderChanged = function (selectObject) {
  ipcRenderer.send(g_ipcChannel + "set-page-order", selectObject.value);
};

exports.onChooseOutputFolder = function () {
  ipcRenderer.send(
    g_ipcChannel + "choose-folder",
    g_outputFileName,
    g_outputFolderPath
  );
};

exports.onStart = function (resetCounter = true) {
  g_cancel = false;
  g_modalButtonCancel.classList.remove("hide");
  g_modalButtonClose.classList.add("hide");
  {
    g_modalButtonClose.classList.add("green");
    g_modalButtonClose.classList.remove("red");
  }
  g_modalLoadingBar.classList.remove("hide");

  if (resetCounter) {
    g_inputFilesIndex = 0;
    g_numErrors = 0;
    updateLogText("", false);
  }

  if (g_outputFormat === undefined) g_outputFormat = FileExtension.CBZ;
  ipcRenderer.send(g_ipcChannel + "start", g_inputFiles);
  g_outputFileName = g_outputNameInput.value;
};

exports.onCancel = function () {
  if (g_cancel === true) return;
  g_cancel = true;
  g_modalButtonCancel.classList.add("hide");
  ipcRenderer.send(g_ipcChannel + "cancel");
};

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(g_ipcChannel + "update-title-text", (event, text) => {
  updateTitleText(text);
});

function updateTitleText(text) {
  g_modalTitle.innerHTML = text;
}

ipcRenderer.on(g_ipcChannel + "update-log-text", (event, text) => {
  updateLogText(text);
});

function updateLogText(text, append = true) {
  if (append) {
    g_modalLogArea.innerHTML += "\n" + text;
  } else {
    g_modalLogArea.innerHTML = text;
  }
  g_modalLogArea.scrollTop = g_modalLogArea.scrollHeight;
}

ipcRenderer.on(g_ipcChannel + "update-info-text", (event, text) => {
  g_modalInfoArea.innerHTML = text;
});

//////////////////////////

ipcRenderer.on(g_ipcChannel + "images-extracted", (event) => {
  ipcRenderer.send(
    g_ipcChannel + "create-file-from-images",
    g_outputFileName,
    g_outputFormat,
    g_outputFolderPath
  );
});

ipcRenderer.on(g_ipcChannel + "finished-ok", (event) => {
  ipcRenderer.send(
    g_ipcChannel + "end",
    false,
    g_inputFiles.length,
    g_numErrors,
    g_inputFilesIndex + 1
  );
});

ipcRenderer.on(g_ipcChannel + "finished-error", (event) => {
  g_modalButtonCancel.classList.add("hide");
  g_modalButtonClose.classList.remove("hide");
  {
    g_modalButtonClose.classList.remove("green");
    g_modalButtonClose.classList.add("red");
  }
  g_modalLoadingBar.classList.add("hide");
  g_numErrors++;
});

ipcRenderer.on(g_ipcChannel + "finished-canceled", (event) => {
  g_modalButtonCancel.classList.add("hide");
  g_modalButtonClose.classList.remove("hide");
  {
    g_modalButtonClose.classList.remove("green");
    g_modalButtonClose.classList.add("red");
  }
  g_modalLoadingBar.classList.add("hide");
  ipcRenderer.send(
    g_ipcChannel + "end",
    true,
    g_inputFiles.length,
    g_numErrors,
    g_inputFilesIndex // last one wasn't converted or error
  );
});

ipcRenderer.on(g_ipcChannel + "show-result", (event) => {
  g_modalButtonCancel.classList.add("hide");
  g_modalButtonClose.classList.remove("hide");
  g_modalLoadingBar.classList.add("hide");
});
