const { ipcRenderer, clipboard } = require("electron");
const Cropper = require("../../assets/libs/cropperjs/dist/cropper.js");

let g_ipcChannel = "tool-eq--";

let g_cropper;
let g_image = document.querySelector("#image");

let g_outputTextArea = document.querySelector("#textarea-output");

let g_modalInfoArea = document.querySelector("#modal-info");
let g_modalLogArea = document.querySelector("#modal-log");
let g_modalTitle = document.querySelector("#modal-title");

function initCropper() {
  g_cropper = new Cropper(g_image, {
    //zoomable: false,
    ready: function () {},
    dragMode: "move",
    viewMode: 2,
    rotatable: false,
    toggleDragModeOnDblclick: true,
    autoCropArea: 1, // 0-1, default 0.8
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
  try {
    g_outputTextArea.innerHTML = "";
    let canvas = g_cropper.getCroppedCanvas();
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ipcRenderer.send(
      g_ipcChannel + "start",
      imageData,
      canvas.width,
      canvas.height
    );
  } catch (error) {
    console.log(error);
    ipcRenderer.send(g_ipcChannel + "cancel-extraction");
  }
};

exports.onCancelConversion = function () {
  ipcRenderer.send(g_ipcChannel + "cancel-extraction");
};

exports.onCopyTextAreaText = function () {
  clipboard.writeText(g_outputTextArea.innerHTML);
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

ipcRenderer.on(g_ipcChannel + "fill-textarea", (event, text) => {
  g_outputTextArea.innerHTML = text;
});

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
