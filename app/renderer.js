const { ipcRenderer, remote } = require("electron");
const customTitlebar = require("custom-electron-titlebar");
const pdfjsLib = require("./assets/libs/pdfjs/build/pdf.js");
const path = require("path");

let titlebar = new customTitlebar.Titlebar({
  backgroundColor: customTitlebar.Color.fromHex("#818181"),
  itemBackgroundColor: customTitlebar.Color.fromHex("#bbb"),
  icon: "./assets/images/icon_256x256.png",
  titleHorizontalAlignment: "right",
});
// titlebar.updateTitle();

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVED ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("set-scrollbar-visibility", (event, isVisible) => {
  showScrollBar(isVisible);
});

ipcRenderer.on("set-menubar-visibility", (event, isVisible) => {
  showMenuBar(isVisible);
});

ipcRenderer.on("set-toolbar-visibility", (event, isVisible) => {
  showToolBar(isVisible);
});

ipcRenderer.on("set-fullscreen-ui", (event, isFullscreen) => {
  setFullscreenUI(isFullscreen);
});

ipcRenderer.on("set-fit-to-width", (event) => {
  setFitToWidth();
});

ipcRenderer.on("set-fit-to-height", (event) => {
  setFitToHeight();
});

ipcRenderer.on("render-page-info", (event, pageNum, numPages) => {
  if (numPages === 0) pageNum = -1; // hack to make it show 00 / 00 @ start
  document.getElementById("page-slider").max = numPages;
  document.getElementById("page-slider").value = pageNum + 1;
  document.getElementById("toolbar-page-numbers").innerHTML =
    pageNum + 1 + " / " + numPages;
});

ipcRenderer.on("render-pdf-page", (event, pageNum) => {
  renderPdfPage(pageNum);
});

ipcRenderer.on("refresh-pdf-page", (event) => {
  refreshPdfPage();
});

ipcRenderer.on("update-title", (event, title) => {
  document.title = title;
  titlebar.updateTitle();
});

ipcRenderer.on("render-img", (event, img64, side) => {
  document.querySelector(".centered-block").style.display = "none";

  //webFrame.clearCache();
  let element = '<img class="page" src="' + img64 + '" />';
  let container = document.getElementById("pages-container");
  container.innerHTML = element; // + element;

  // ref: https://www.w3schools.com/howto/howto_js_scroll_to_top.asp
  //document.documentElement.scrollTop = 0;
  document.querySelector(".container-after-titlebar").scrollTop = 0;
  //webFrame.clearCache(); // don't know if this does anything, haven't tested, I'm afraid of memory leaks changing imgs
});

ipcRenderer.on("load-pdf", (event, filePath, pageNum) => {
  document.querySelector(".centered-block").style.display = "none";

  let container = document.getElementById("pages-container");
  container.innerHTML = "";
  var canvas = document.createElement("canvas");
  canvas.id = "pdf-canvas";
  container.appendChild(canvas);

  loadPdf(filePath, pageNum);
});

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let currentPdf = null;
let currentPdfPage = null;

function loadPdf(filePath, pageNum) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "./assets/libs/pdfjs/build/pdf.worker.js";
  var loadingTask = pdfjsLib.getDocument(filePath);
  loadingTask.promise.then(function (pdf) {
    currentPdf = pdf;
    ipcRenderer.send("pdf-loaded", true, filePath, currentPdf.numPages);
    renderPdfPage(pageNum);
  });
}

function renderPdfPage(pageNum) {
  currentPdf.getPage(pageNum).then(function (page) {
    // var scale = 1.5;
    // var viewport = page.getViewport({ scale: scale });
    currentPdfPage = page;

    var canvas = document.getElementById("pdf-canvas");
    var context = canvas.getContext("2d");

    var desiredWidth = canvas.offsetWidth; //document.body.clientWidth;
    var viewport = currentPdfPage.getViewport({ scale: 1 });
    var scale = desiredWidth / viewport.width;
    var scaledViewport = currentPdfPage.getViewport({ scale: scale });

    canvas.height = scaledViewport.height; // viewport.height;
    canvas.width = desiredWidth; //scaledViewport.width; // viewport.width;

    var renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    };
    currentPdfPage.render(renderContext);

    document.querySelector(".container-after-titlebar").scrollTop = 0;
  });
}

function refreshPdfPage() {
  if (currentPdfPage === undefined) return;
  var desiredWidth = window.innerWidth;
  var viewport = currentPdfPage.getViewport({ scale: 1 });
  var scale = desiredWidth / viewport.width;
  var scaledViewport = currentPdfPage.getViewport({ scale: scale });

  var canvas = document.getElementById("pdf-canvas");
  var context = canvas.getContext("2d");
  canvas.height = scaledViewport.height; // viewport.height;
  canvas.width = scaledViewport.width; // viewport.width;

  var renderContext = {
    canvasContext: context,
    viewport: scaledViewport,
  };
  currentPdfPage.render(renderContext);
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

document.onkeydown = function (evt) {
  evt = evt || window.event;
  // ref: http://gcctech.org/csc/javascript/javascript_keycodes.htm
  if (evt.keyCode == 34 || evt.keyCode == 39) {
    // page down or arrow right
    ipcRenderer.send("mouse-click", true);
  } else if (evt.keyCode == 33 || evt.keyCode == 37) {
    // page up or arrow left
    ipcRenderer.send("mouse-click", false);
  } else if (evt.keyCode == 40) {
    // arrow down
    let container = document.querySelector(".container-after-titlebar");
    let amount = container.offsetHeight / 5;
    container.scrollBy(0, amount);
  } else if (evt.keyCode == 38) {
    // arrow up
    let container = document.querySelector(".container-after-titlebar");
    let amount = container.offsetHeight / 5;
    document.querySelector(".container-after-titlebar").scrollBy(0, -amount);
  } else if (evt.keyCode == 27) {
    // escape
    ipcRenderer.send("escape-pressed");
  } else if (evt.ctrlKey && evt.shiftKey && evt.keyCode == 73) {
    // ctrl + shift + i
    ipcRenderer.send("dev-tools-pressed");
  }
};

document.onclick = function (event) {
  if (
    event.target.className === "page" ||
    event.target.id === "pdf-canvas" ||
    event.target.id === "pages-container"
  ) {
    const mouseX = event.clientX;
    const bodyX = document.body.clientWidth;
    if (mouseX > bodyX / 2) {
      ipcRenderer.send("mouse-click", true); // next
    } else {
      ipcRenderer.send("mouse-click", false); // prev
    }
  }
  //if (event.target.className !== "container-after-titlebar") return;
};

// TODO: context menu on right click
// document.oncontextmenu = function (event) {
//   if (
//     event.target.className === "page" ||
//     event.target.id === "pdf-canvas" ||
//     event.target.id === "pages-container"
//   ) {
//     ipcRenderer.send("mouse-click", false);
//   }
// };

///////////////////////////////////////////////////////////////////////////////
// TOOLBAR ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function addButtonEvent(buttonName) {
  document.getElementById(buttonName).addEventListener("click", (event) => {
    ipcRenderer.send("toolbar-button-clicked", buttonName);
  });
}

addButtonEvent("toolbar-button-next");
addButtonEvent("toolbar-button-prev");
addButtonEvent("toolbar-button-fit-to-width");
addButtonEvent("toolbar-button-fit-to-height");
addButtonEvent("toolbar-button-fullscreen-enter");
addButtonEvent("toolbar-button-fullscreen-exit");
addButtonEvent("toolbar-button-open");

document.getElementById("page-slider").addEventListener("mouseup", (event) => {
  ipcRenderer.send("toolbar-slider-changed", event.currentTarget.value);
});
document.getElementById("page-slider").addEventListener("input", (event) => {
  document.getElementById("toolbar-page-numbers").innerHTML =
    event.currentTarget.value + " / " + event.currentTarget.max;
});

///////////////////////////////////////////////////////////////////////////////
// MODIFIERS //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showScrollBar(isVisible) {
  // ref: https://stackoverflow.com/questions/4481485/changing-css-pseudo-element-styles-via-javascript
  if (isVisible) {
    // generic:
    document.body.classList.remove("hidden-scrollbar");
    // if custom title bar enabled:
    document
      .querySelector(".container-after-titlebar")
      .classList.remove("hidden-scrollbar");
  } else {
    // generic:
    document.body.classList.add("hidden-scrollbar");
    // if custom title bar enabled:
    document
      .querySelector(".container-after-titlebar")
      .classList.add("hidden-scrollbar");
  }
}

function showMenuBar(isVisible) {
  if (isVisible) {
    document.querySelector(".titlebar").classList.remove("set-display-none");
    document
      .querySelector(".container-after-titlebar")
      .classList.remove("set-top-zero");
  } else {
    document.querySelector(".titlebar").classList.add("set-display-none");
    document
      .querySelector(".container-after-titlebar")
      .classList.add("set-top-zero");
  }
}

function showToolBar(isVisible) {
  if (isVisible) {
    document.querySelector("#toolbar").classList.remove("set-display-none");
    document
      .querySelector(".container-after-titlebar")
      .classList.remove("set-margin-bottom-zero");
  } else {
    document.querySelector("#toolbar").classList.add("set-display-none");
    document
      .querySelector(".container-after-titlebar")
      .classList.add("set-margin-bottom-zero");
  }
}

function setFullscreenUI(isFullscreen) {
  let buttonEnter = document.querySelector("#toolbar-button-fullscreen-enter");
  let buttonExit = document.querySelector("#toolbar-button-fullscreen-exit");
  if (isFullscreen) {
    buttonEnter.classList.add("set-display-none");
    buttonExit.classList.remove("set-display-none");
  } else {
    buttonEnter.classList.remove("set-display-none");
    buttonExit.classList.add("set-display-none");
  }
}

function setFitToWidth() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-fit-to-height");
  container.classList.add("set-fit-to-width");

  document
    .querySelector("#toolbar-button-fit-to-width")
    .classList.add("set-display-none");
  document
    .querySelector("#toolbar-button-fit-to-height")
    .classList.remove("set-display-none");
}

function setFitToHeight() {
  let container = document.querySelector("#pages-container");
  container.classList.remove("set-fit-to-width");
  container.classList.add("set-fit-to-height");

  document
    .querySelector("#toolbar-button-fit-to-width")
    .classList.remove("set-display-none");
  document
    .querySelector("#toolbar-button-fit-to-height")
    .classList.add("set-display-none");
}
