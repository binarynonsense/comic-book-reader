const { ipcRenderer } = require("electron");
const Cropper = require("../../assets/libs/cropperjs/dist/cropper.js");

let g_ipcChannel = "tool-ep--";

let g_cropper;
let g_image = document.querySelector("#image");

let g_saveButton = document.querySelector("#button-export-to-file");
let g_exportFormatSelect = document.querySelector("#export-format-select");

let g_modalInfoArea = document.querySelector("#modal-info");
let g_modalButtonClose = document.querySelector("#button-modal-close");
let g_modalButtonCancel = document.querySelector("#button-modal-cancel");
let g_modalLogArea = document.querySelector("#modal-log");
let g_modalLoadingBar = document.querySelector("#modal-loading-bar");
let g_modalTitle = document.querySelector("#modal-title");

function initCropper() {
  g_cropper = new Cropper(g_image, {
    ready: function () {},
    dragMode: "move",
    viewMode: 2,
    rotatable: false,
    toggleDragModeOnDblclick: true,
  });
}
exports.initCropper = initCropper;

let g_modalInstance;
exports.initModal = function (instance) {
  g_modalInstance = instance;
};

///////////////////////////////////////////////////////////////////////////////

exports.onChooseInputFile = function () {
  ipcRenderer.send(g_ipcChannel + "choose-file");
};

exports.onStart = function () {
  g_modalButtonCancel.classList.add("hide");
  g_modalButtonClose.classList.add("hide");
  {
    g_modalButtonClose.classList.add("green");
    g_modalButtonClose.classList.remove("red");
  }
  g_modalLoadingBar.classList.remove("hide");
  g_modalTitle.innerHTML = "";
  g_modalInfoArea.innerHTML = "";

  const paletteContainer = document.getElementById("palette");
  paletteContainer.innerHTML = "";
  let canvas = g_cropper.getCroppedCanvas();
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let distanceMethod = document.getElementById("distance-method-select").value;
  let distanceThreshold = 120;
  if (distanceMethod === "deltae") {
    distanceThreshold = parseInt(
      document.getElementById("input-deltae-threshold").value
    );
    if (distanceThreshold < 0) distanceThreshold = 2;
    else if (distanceThreshold > 49) distanceThreshold = 49;
  }

  let maxQuantizationDepth = 4;
  let maxNumColors = parseInt(
    document.getElementById("max-num-colors-select").value
  );
  if (maxNumColors === 32) {
    maxQuantizationDepth = 5;
  }

  ipcRenderer.send(
    g_ipcChannel + "start",
    imageData.data,
    distanceMethod,
    distanceThreshold,
    maxQuantizationDepth
  );
};

exports.onCancel = function () {
  ipcRenderer.send(g_ipcChannel + "cancel");
};

exports.onExport = function () {
  ipcRenderer.send(g_ipcChannel + "export-to-file", g_exportFormatSelect.value);
};

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (event, title, localization) => {
    document.title = title;
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }
  }
);

ipcRenderer.on(g_ipcChannel + "update-image", (event, filePath) => {
  console.log(filePath);
  g_cropper.replace(filePath);
});

ipcRenderer.on(g_ipcChannel + "update-palette", (event, palette) => {
  const paletteContainer = document.getElementById("palette");
  paletteContainer.innerHTML = "";

  if (palette === undefined || palette.rgbColors.length <= 0) {
    g_saveButton.classList.add("disabled");
    return;
  }

  for (let index = 0; index < palette.hexColors.length; index++) {
    const colorElement = document.createElement("div");
    colorElement.style.backgroundColor = palette.hexColors[index];
    paletteContainer.appendChild(colorElement);
    const textElement = document.createElement("div");
    textElement.innerHTML = palette.hexColors[index];
    colorElement.appendChild(textElement);
  }
  g_saveButton.classList.remove("disabled");
});

ipcRenderer.on(
  g_ipcChannel + "export-file-created",
  (event, titleText, infoText) => {
    g_modalButtonCancel.classList.add("hide");
    g_modalButtonClose.classList.remove("hide");
    {
      g_modalButtonClose.classList.add("green");
      g_modalButtonClose.classList.remove("red");
    }
    g_modalLoadingBar.classList.add("hide");
    g_modalTitle.innerHTML = titleText;
    g_modalInfoArea.innerHTML = infoText;
    g_modalInstance.open();
  }
);

ipcRenderer.on(
  g_ipcChannel + "export-file-error",
  (event, titleText, infoText) => {
    g_modalButtonCancel.classList.add("hide");
    g_modalButtonClose.classList.remove("hide");
    {
      g_modalButtonClose.classList.remove("green");
      g_modalButtonClose.classList.add("red");
    }
    g_modalLoadingBar.classList.add("hide");
    g_modalTitle.innerHTML = titleText;
    g_modalInfoArea.innerHTML = infoText;
    g_modalInstance.open();
  }
);

ipcRenderer.on(g_ipcChannel + "modal-close", (event) => {
  g_modalInstance.close();
});

ipcRenderer.on(g_ipcChannel + "modal-update-log", (event, text) => {
  modalUpdateLog(text);
});

function modalUpdateLog(text, append = true) {
  if (append) {
    g_modalLogArea.innerHTML += "\n" + text;
  } else {
    g_modalLogArea.innerHTML = text;
  }
  g_modalLogArea.scrollTop = g_modalLogArea.scrollHeight;
}

ipcRenderer.on(g_ipcChannel + "modal-update-title", (event, text) => {
  g_modalTitle.innerHTML = text;
});

ipcRenderer.on(g_ipcChannel + "modal-update-info", (event, text) => {
  g_modalInfoArea.innerHTML = text;
});
