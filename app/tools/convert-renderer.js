const path = require("path");
const os = require("os");
const { ipcRenderer } = require("electron");

const FileDataType = {
  NOT_SET: "not set",
  PDF: "pdf",
  IMGS: "imgs",
  ZIP: "zip",
  RAR: "rar",
  EPUB: "epub",
};

let inputFilePath;
let inputFileType;
let outputSize = "100";
let outputFormat = 1;
let outputFolderPath;

let inputListDiv = document.querySelector("#input-list");
let inputListButton = document.querySelector("#input-list-add");
let outputFolderDiv = document.querySelector("#output-folder");
let convertButton = document.querySelector("#convert-button");
let sizeSlider = document.querySelector("#size-slider");
let modalInfoArea = document.querySelector("#modal-info");
let modalLogArea = document.querySelector("#modal-log");
let modalButtonContainer = document.querySelector("#modal-button-container");
let modalButtonClose = document.querySelector("#modal-button-close");
let modalLoadingBar = document.querySelector("#modal-loading-bar");
let modalTitle = document.querySelector("#modal-title");

sizeSlider.addEventListener("mouseup", (event) => {
  outputSize = event.currentTarget.value;
  checkValidData();
});
// sizeSlider.addEventListener("input", (event) => {
//   document.getElementById("toolbar-page-numbers").innerHTML =
//     event.currentTarget.value + " / " + event.currentTarget.max;
// });

///////////////////////////////////////////////////////////////////////////////

function checkValidData() {
  if (outputFolderPath !== undefined && inputFilePath !== undefined) {
    if (outputSize !== "100" || inputFileType !== FileDataType.ZIP) {
      convertButton.classList.remove("disabled");
      return;
    }
  }
  convertButton.classList.add("disabled");
}

function reducePathString(input) {
  var length = 70;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("add-file", (event, filePath, fileType) => {
  // TEMP do this on future init function
  inputListButton.classList.add("hide");

  inputFilePath = filePath;
  inputFileType = fileType;

  inputListDiv.innerHTML +=
    "<li class='collection-item'><div>" +
    reducePathString(inputFilePath) +
    (false
      ? "<a href='#!' class='secondary-content'><i class='fas fa-window-close' title='remove from list'></i></a>"
      : "") +
    "</div></li>";

  outputFolderPath = path.dirname(filePath);
  outputFolderDiv.innerHTML = reducePathString(outputFolderPath);

  checkValidData();
});

ipcRenderer.on("change-output-folder", (event, folderPath) => {
  outputFolderPath = folderPath;
  outputFolderDiv.innerHTML = reducePathString(outputFolderPath);
  checkValidData();
});

///////////////////////////////////////////////////////////////////////////////

function onChooseInputFile() {
  ipcRenderer.send("convert-choose-file");
}
exports.onChooseInputFile = onChooseInputFile;

function onChooseOutputFolder() {
  ipcRenderer.send("convert-choose-folder");
}
exports.onChooseOutputFolder = onChooseOutputFolder;

function onConvert() {
  modalTitle.innerHTML = "";
  modalButtonClose.classList.add("hide");
  modalLoadingBar.classList.remove("hide");

  ipcRenderer.send("convert-start-conversion", inputFilePath, inputFileType);
}
exports.onConvert = onConvert;

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("convert-update-text-title", (event, text) => {
  modalTitle.innerHTML = text;
});

ipcRenderer.on("convert-update-text-log", (event, text) => {
  modalLogArea.innerHTML = text;
});

ipcRenderer.on("convert-update-text-info", (event, text) => {
  modalInfoArea.innerHTML = text;
});

ipcRenderer.on(
  "convert-extract-pdf-images",
  (event, filePath, tempFolder) => {}
);

ipcRenderer.on("convert-images-extracted", (event) => {
  ipcRenderer.send(
    "convert-create-file-from-images",
    inputFilePath,
    outputSize,
    outputFormat,
    outputFolderPath
  );
});

ipcRenderer.on("convert-finished-ok", (event) => {
  modalButtonClose.classList.remove("hide");
  modalLoadingBar.classList.add("hide");
});
