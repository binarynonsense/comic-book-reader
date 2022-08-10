const { ipcRenderer, clipboard } = require("electron");

let g_ipcChannel = "tool-cq--";

let g_image = document.querySelector("#image");
let g_inputTextArea = document.querySelector("#textarea-input");

let g_startButton = document.querySelector("#button-start");
let g_clearButton = document.querySelector("#button-clear");
let g_exportButton = document.querySelector("#button-export");

let g_modalInfoArea = document.querySelector("#modal-info");
let g_modalLogArea = document.querySelector("#modal-log");
let g_modalTitle = document.querySelector("#modal-title");

let g_modalInstance;
exports.initModal = function (instance) {
  g_modalInstance = instance;
};

///////////////////////////////////////////////////////////////////////////////

exports.onExport = function () {
  ipcRenderer.send(g_ipcChannel + "export-to-file");
};

exports.onStart = function () {
  ipcRenderer.send(g_ipcChannel + "start", g_inputTextArea.value);
};

exports.onClearTextAreaText = function () {
  g_inputTextArea.value = "";
  onInputTextChanged(g_inputTextArea);
};

exports.onInputTextChanged = onInputTextChanged = function (textArea) {
  if (textArea.value !== "") {
    g_startButton.classList.remove("disabled");
    g_clearButton.classList.remove("disabled");
  } else {
    g_startButton.classList.add("disabled");
    g_clearButton.classList.add("disabled");
  }
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

ipcRenderer.on(g_ipcChannel + "update-image", (event, base64) => {
  if (base64) {
    g_image.src = base64;
    g_exportButton.classList.remove("disabled");
  }
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

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(g_ipcChannel + "show-modal-alert", (event, title, message) => {
  showModalAlert(title, message);
});

function showModalAlert(title, message) {
  smalltalk.alert(title, message).then(() => {});
}
