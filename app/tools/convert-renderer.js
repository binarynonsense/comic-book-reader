const fs = window.require("fs");
const path = require("path");
const os = require("os");
const { ipcRenderer } = require("electron");

let g_mode;
let g_inputFiles = [];
let g_inputFilesCounter = 0;
let g_inputFilesIndex = 0;

const FileDataType = {
  NOT_SET: "not set",
  PDF: "pdf",
  IMGS: "imgs",
  ZIP: "zip",
  RAR: "rar",
  EPUB: "epub",
};

let g_inputFilePath;
let g_inputFileType;
let g_outputScale = "100";
let g_outputQuality = "60";
let g_outputFormat = "cbz";
let g_outputFolderPath;

let g_textInputFileDiv = document.querySelector("#text-input-file");
let g_textInputFilesDiv = document.querySelector("#text-input-files");
let g_inputListDiv = document.querySelector("#input-list");
let g_inputListButton = document.querySelector("#button-add-file");
let g_outputFolderDiv = document.querySelector("#output-folder");
let g_convertButton = document.querySelector("#button-convert");
let g_scaleSlider = document.querySelector("#scale-slider");
let g_qualitySlider = document.querySelector("#quality-slider");
let g_modalInfoArea = document.querySelector("#modal-info");
let g_modalLogArea = document.querySelector("#modal-log");
let g_modalButtonContainer = document.querySelector("#modal-button-container");
let g_modalButtonClose = document.querySelector("#button-modal-close");
let g_modalLoadingBar = document.querySelector("#modal-loading-bar");
let g_modalTitle = document.querySelector("#modal-title");

g_scaleSlider.addEventListener("mouseup", (event) => {
  g_outputScale = event.currentTarget.value;
  checkValidData();
});
g_qualitySlider.addEventListener("mouseup", (event) => {
  g_outputQuality = event.currentTarget.value;
  checkValidData();
});

///////////////////////////////////////////////////////////////////////////////

function checkValidData() {
  if (g_outputScale === "100") {
    g_qualitySlider.parentElement.classList.add("hide");
  } else {
    g_qualitySlider.parentElement.classList.remove("hide");
  }

  if (g_mode === 0) {
    if (g_outputFolderPath !== undefined && g_inputFiles.length > 0) {
      if (g_inputFiles[0].type === FileDataType.ZIP) {
        if (!(g_outputFormat === "cbz" && g_outputScale === "100")) {
          g_convertButton.classList.remove("disabled");
          return;
        }
      } else if (g_inputFiles[0].type === FileDataType.PDF) {
        if (!(g_outputFormat === "pdf" && g_outputScale === "100")) {
          g_convertButton.classList.remove("disabled");
          return;
        }
      } else if (g_inputFiles[0].type === FileDataType.EPUB) {
        if (!(g_outputFormat === "epub" && g_outputScale === "100")) {
          g_convertButton.classList.remove("disabled");
          return;
        }
      } else if (g_inputFiles[0].type === FileDataType.RAR) {
        g_convertButton.classList.remove("disabled");
        return;
      }
    }
    g_convertButton.classList.add("disabled");
  } else {
    // mode 1 / batch
    if (g_outputFolderPath !== undefined && g_inputFiles.length > 0) {
      g_convertButton.classList.remove("disabled");
    } else {
      g_convertButton.classList.add("disabled");
    }
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

ipcRenderer.on("set-mode", (event, mode, outputFolderPath) => {
  g_mode = mode;
  g_outputFolderPath = outputFolderPath;
  g_outputFolderDiv.innerHTML = reducePathString(g_outputFolderPath);
  // 0
  if (g_mode === 0) {
    g_inputListButton.classList.add("hide");
    g_textInputFileDiv.classList.remove("hide");
    g_textInputFilesDiv.classList.add("hide");
  } else {
    // batch conversion
    g_inputListButton.classList.remove("hide");
    g_textInputFileDiv.classList.add("hide");
    g_textInputFilesDiv.classList.remove("hide");
  }
  checkValidData();
});

ipcRenderer.on(
  "update-localization",
  (event, title, localization, tooltipsLocalization) => {
    document.title = title;
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      document.querySelector("#" + element.id).innerHTML = element.text;
    }

    for (let index = 0; index < tooltipsLocalization.length; index++) {
      const element = tooltipsLocalization[index];
      document.querySelector("#" + element.id).title = element.text;
    }
  }
);

ipcRenderer.on("add-file", (event, filePath, fileType) => {
  if (filePath === undefined || fileType === undefined) return;

  for (let index = 0; index < g_inputFiles.length; index++) {
    if (g_inputFiles[index].path === filePath) {
      return;
    }
  }
  let id = g_inputFilesCounter++; // not the best solution, but if it works...
  g_inputFiles.push({
    id: id,
    path: filePath,
    type: fileType,
  });

  g_inputListDiv.innerHTML +=
    "<li class='collection-item'><div>" +
    reducePathString(filePath) +
    (g_mode === 1
      ? "<a style='cursor: pointer;' onclick='renderer.onRemoveFile(this, " +
        id +
        ")' class='secondary-content'><i class='fas fa-window-close' title='remove from list'></i></a>"
      : "") +
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

ipcRenderer.on("change-output-folder", (event, folderPath) => {
  g_outputFolderPath = folderPath;
  g_outputFolderDiv.innerHTML = reducePathString(g_outputFolderPath);
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
  g_outputFormat = selectObject.value;
  checkValidData();
}
exports.outputFormatChanged = outputFormatChanged;

function onConvert(resetCounter = true) {
  g_modalTitle.innerHTML = "";
  g_modalButtonClose.classList.add("hide");
  g_modalLoadingBar.classList.remove("hide");

  if (resetCounter) g_inputFilesIndex = 0;

  g_inputFilePath = g_inputFiles[g_inputFilesIndex].path;
  g_inputFileType = g_inputFiles[g_inputFilesIndex].type;

  ipcRenderer.send(
    "convert-start-conversion",
    g_inputFilePath,
    g_inputFileType
  );
}
exports.onConvert = onConvert;

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("convert-update-text-title", (event, text) => {
  g_modalTitle.innerHTML = text;
});

ipcRenderer.on("convert-update-text-log", (event, text) => {
  g_modalLogArea.innerHTML = text;
});

ipcRenderer.on("convert-update-text-info", (event, text) => {
  g_modalInfoArea.innerHTML = text;
});

//////////////////////////

ipcRenderer.on("convert-extract-pdf-images", (event, tempFolder) => {
  extractPDFImages(tempFolder);
});

ipcRenderer.on("convert-images-extracted", (event) => {
  ipcRenderer.send(
    "convert-create-file-from-images",
    g_inputFilePath,
    g_outputScale,
    g_outputQuality,
    g_outputFormat,
    g_outputFolderPath
  );
});

ipcRenderer.on("convert-finished-ok", (event) => {
  if (g_inputFilesIndex < g_inputFiles.length - 1) {
    g_inputFilesIndex++;
    onConvert(false);
  } else {
    g_modalButtonClose.classList.remove("hide");
    g_modalLoadingBar.classList.add("hide");
  }
});

ipcRenderer.on("convert-finished-error", (event) => {
  g_modalButtonClose.classList.remove("hide");
  g_modalLoadingBar.classList.add("hide");
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
    const pdf = await pdfjsLib.getDocument(g_inputFilePath).promise;
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
