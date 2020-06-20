const fs = window.require("fs");
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
let outputFormat = "cbz";
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
    if (inputFileType === FileDataType.ZIP) {
      if (!(outputFormat === "cbz" && outputSize === "100")) {
        convertButton.classList.remove("disabled");
        return;
      }
    } else if (inputFileType === FileDataType.PDF) {
      if (!(outputFormat === "pdf" && outputSize === "100")) {
        convertButton.classList.remove("disabled");
        return;
      }
    } else if (inputFileType === FileDataType.EPUB) {
      if (!(outputFormat === "epub" && outputSize === "100")) {
        convertButton.classList.remove("disabled");
        return;
      }
    } else if (inputFileType === FileDataType.RAR) {
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

function outputFormatChanged(selectObject) {
  outputFormat = selectObject.value;
  checkValidData();
}
exports.outputFormatChanged = outputFormatChanged;

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

//////////////////////////

ipcRenderer.on("convert-extract-pdf-images", (event, tempFolder) => {
  extractPDFImages(tempFolder);
});

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

ipcRenderer.on("convert-finished-error", (event) => {
  modalButtonClose.classList.remove("hide");
  modalLoadingBar.classList.add("hide");
});

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const pdfjsLib = require("../assets/libs/pdfjs/build/pdf.js");

async function extractPDFImages(folderPath) {
  try {
    // ref: https://kevinnadro.com/blog/parsing-pdfs-in-javascript/
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "../assets/libs/pdfjs/build/pdf.worker.js";
    //pdfjsLib.disableWorker = true;
    const pdf = await pdfjsLib.getDocument(inputFilePath).promise;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      let page = await pdf.getPage(pageNum);
      //console.log("page: " + pageNum + " - " + page);

      // RENDER
      const canvas = document.createElement("canvas");
      let viewport = page.getViewport({
        scale: 300 / 72,
      }); // defines the size in pixels(72DPI)
      let context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      //console.log(viewport.width + "x" + viewport.height);
      await page.render({ canvasContext: context, viewport: viewport }).promise;

      let filePath = path.join(folderPath, pageNum + ".jpg");
      var img = canvas.toDataURL("image/jpeg", 0.75);
      var data = img.replace(/^data:image\/\w+;base64,/, "");
      var buf = Buffer.from(data, "base64");
      await new Promise((resolve, reject) =>
        fs.writeFile(filePath, buf, "binary", (err) => {
          if (err === null) {
            resolve();
          } else {
            reject(err);
          }
        })
      );

      page.cleanup();
    }
    pdf.cleanup();
    pdf.destroy();
    ipcRenderer.send("convert-pdf-images-extracted");
  } catch (err) {
    ipcRenderer.send("convert-stop-error", err);
  }
}
