const fs = window.require("fs");
const path = require("path");
const { ipcRenderer } = require("electron");
const { changeDpiDataUrl } = require("changedpi");
const { FileExtension } = require("../../constants");

let g_ipcChannel = "tool-cc--";

let g_inputFiles = [];
let g_inputFilesIndex = 0;
let g_inputFilesID = 0;

let g_cancel = false;

let g_inputFilePath;
let g_inputFileType;
let g_outputScale = "100";
let g_outputQuality = "80";
let g_outputFormat;
let g_outputFolderPath;
let g_outputPdfExtractionMethod = "embedded";

let g_textInputFilesDiv = document.querySelector("#text-input-files");
let g_inputListDiv = document.querySelector("#input-list");
let g_inputListButton = document.querySelector("#button-add-file");
let g_outputFolderDiv = document.querySelector("#output-folder");
let g_startButton = document.querySelector("#button-start");
let g_outputFormatSelect = document.querySelector("#output-format-select");
let g_scaleSlider = document.querySelector("#scale-slider");
let g_qualitySlider = document.querySelector("#quality-slider");

let g_modalInfoArea = document.querySelector("#modal-info");
let g_modalLogArea = document.querySelector("#modal-log");
let g_modalButtonClose = document.querySelector("#button-modal-close");
let g_modalButtonCancel = document.querySelector("#button-modal-cancel");
let g_modalLoadingBar = document.querySelector("#modal-loading-bar");
let g_modalTitle = document.querySelector("#modal-title");

g_localizedRemoveFromListText = "";

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
  if (g_outputFolderPath !== undefined && g_inputFiles.length > 0) {
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

ipcRenderer.on(g_ipcChannel + "add-file", (event, filePath, fileType) => {
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

exports.onOutputAdvancedPdfExtractionChanged = function (selectObject) {
  g_outputPdfExtractionMethod = selectObject.value;
};

exports.onOutputAdvancedPdfCreationChanged = function (selectObject) {
  ipcRenderer.send(
    g_ipcChannel + "set-pdf-creation-method",
    selectObject.value
  );
};

exports.onChooseOutputFolder = function () {
  ipcRenderer.send(
    g_ipcChannel + "choose-folder",
    g_inputFilePath,
    g_outputFolderPath
  );
};

function onStart(resetCounter = true) {
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
  g_inputFilePath = g_inputFiles[g_inputFilesIndex].path;
  g_inputFileType = g_inputFiles[g_inputFilesIndex].type;

  ipcRenderer.send(
    g_ipcChannel + "start",
    g_inputFilePath,
    g_inputFileType,
    g_inputFilesIndex + 1,
    g_inputFiles.length
  );
}
exports.onStart = onStart;

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

ipcRenderer.on(
  g_ipcChannel + "extract-pdf-images",
  (event, tempFolder, logText) => {
    extractPDFImages(tempFolder, logText);
  }
);

ipcRenderer.on(g_ipcChannel + "images-extracted", (event) => {
  ipcRenderer.send(
    g_ipcChannel + "resize-images",
    g_inputFilePath,
    g_outputScale,
    g_outputQuality,
    g_outputFormat,
    g_outputFolderPath
  );
});

ipcRenderer.on(g_ipcChannel + "finished-ok", (event) => {
  if (g_inputFilesIndex < g_inputFiles.length - 1) {
    g_inputFilesIndex++;
    onStart(false);
  } else {
    ipcRenderer.send(
      g_ipcChannel + "end",
      false,
      g_inputFiles.length,
      g_numErrors,
      g_inputFilesIndex + 1
    );
  }
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

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const pdfjsLib = require("../../assets/libs/pdfjs/build/pdf.js");

async function extractPDFImages(folderPath, logText) {
  try {
    // ref: https://kevinnadro.com/blog/parsing-pdfs-in-javascript/
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "../../assets/libs/pdfjs/build/pdf.worker.js";
    //pdfjsLib.disableWorker = true;
    const pdf = await pdfjsLib.getDocument(g_inputFilePath).promise;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (g_cancel) {
        pdf.cleanup();
        pdf.destroy();
        ipcRenderer.send(g_ipcChannel + "pdf-images-extracted", true);
        return;
      }
      let page = await pdf.getPage(pageNum);
      let pageWidth = page.view[2]; // [left, top, width, height]
      let pageHeight = page.view[3];
      let userUnit = page.userUnit; // 1 unit = 1/72 inch
      let dpi = 300; // use userUnit some day (if > 1) to set dpi?
      let iPerUnit = 1 / 72;
      let scaleFactor = dpi * iPerUnit; // default: output a 300dpi image instead of 72dpi, which is the pdf default?
      if (g_outputPdfExtractionMethod === "render72") {
        scaleFactor = 1;
        dpi = 72;
      }
      // resize if too big?
      let bigSide = pageHeight;
      if (pageHeight < pageWidth) bigSide = pageWidth;
      let scaledSide = bigSide * scaleFactor;
      if (scaledSide > 5000) {
        console.log("reducing PDF scale factor, img too big");
        scaleFactor = 5000 / bigSide;
        dpi = parseInt(scaleFactor / iPerUnit);
      }
      // RENDER
      const canvas = document.createElement("canvas");
      let viewport = page.getViewport({
        scale: scaleFactor,
      });
      let context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      ////////////////////////////
      if (g_outputPdfExtractionMethod === "embedded") {
        // check imgs size
        // ref: https://codepen.io/allandiego/pen/RwVGbyj
        const operatorList = await page.getOperatorList();
        const validTypes = [
          pdfjsLib.OPS.paintImageXObject,
          pdfjsLib.OPS.paintJpegXObject,
          //pdfjsLib.OPS.paintImageXObjectRepeat,
        ];
        let images = [];
        operatorList.fnArray.forEach((element, index) => {
          if (validTypes.includes(element)) {
            images.push(operatorList.argsArray[index][0]);
          }
        });
        if (images.length === 1) {
          // could be a comic book, let's extract the image
          const imageName = images[0];
          // page needs to have been rendered before for this to be filled
          let image = await page.objs.get(imageName);
          const imageWidth = image.width;
          const imageHeight = image.height;
          if (imageWidth >= pageWidth && imageHeight >= pageHeight) {
            scaleFactor = imageWidth / pageWidth;
            dpi = parseInt(scaleFactor / iPerUnit);
            // render again with new dimensions
            viewport = page.getViewport({
              scale: scaleFactor,
            });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport })
              .promise;
          }
        }
      }
      //////////////////////////////
      let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      let img = changeDpiDataUrl(dataUrl, dpi);
      let data = img.replace(/^data:image\/\w+;base64,/, "");
      let buf = Buffer.from(data, "base64");

      let filePath = path.join(folderPath, pageNum + "." + FileExtension.JPG);
      fs.writeFileSync(filePath, buf, "binary");
      updateLogText(logText + pageNum + " / " + pdf.numPages);

      page.cleanup();
    }
    pdf.cleanup();
    pdf.destroy();
    ipcRenderer.send(g_ipcChannel + "pdf-images-extracted", false);
  } catch (err) {
    ipcRenderer.send(g_ipcChannel + "stop-error", err);
  }
}
