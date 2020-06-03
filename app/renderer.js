const { ipcRenderer, remote } = require("electron");
const { Menu } = remote;
const customTitlebar = require("custom-electron-titlebar");
const pdfjsLib = require("./assets/libs/pdfjs/build/pdf.js");
const EPub = require("epub");

let g_titlebar = new customTitlebar.Titlebar({
  backgroundColor: customTitlebar.Color.fromHex("#818181"),
  itemBackgroundColor: customTitlebar.Color.fromHex("#bbb"),
  icon: "./assets/images/icon_256x256.png",
  titleHorizontalAlignment: "right",
});
// titlebar.updateTitle();

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVED ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("update-menubar", (event, isVisible) => {
  g_titlebar.updateMenu(Menu.getApplicationMenu());
});

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

ipcRenderer.on("update-title", (event, title) => {
  document.title = title;
  g_titlebar.updateTitle();
});

ipcRenderer.on("render-page-info", (event, pageNum, numPages) => {
  if (numPages === 0) pageNum = -1; // hack to make it show 00 / 00 @ start
  document.getElementById("page-slider").max = numPages;
  document.getElementById("page-slider").value = pageNum + 1;
  document.getElementById("toolbar-page-numbers").innerHTML =
    pageNum + 1 + " / " + numPages;
});

ipcRenderer.on("render-img", (event, img64, side) => {
  document.querySelector(".centered-block").style.display = "none";

  //webFrame.clearCache();
  let element = '<img class="page" src="' + img64 + '" />';
  let container = document.getElementById("pages-container");
  container.innerHTML = element; // + element;

  // ref: https://www.w3schools.com/howto/howto_js_scroll_to_top.asp
  document.querySelector(".container-after-titlebar").scrollTop = 0;
  //webFrame.clearCache(); // don't know if this does anything, haven't tested, I'm afraid of memory leaks changing imgs
});

ipcRenderer.on("render-pdf-page", (event, pageIndex) => {
  renderPdfPage(pageIndex);
});

ipcRenderer.on("refresh-pdf-page", (event, rotation) => {
  refreshPdfPage(rotation);
});

ipcRenderer.on("load-pdf", (event, filePath, pageIndex) => {
  document.querySelector(".centered-block").style.display = "none";

  let container = document.getElementById("pages-container");
  container.innerHTML = "";
  var canvas = document.createElement("canvas");
  canvas.id = "pdf-canvas";
  container.appendChild(canvas);

  loadPdf(filePath, pageIndex);
});

ipcRenderer.on("render-epub-image", (event, filePath, imageID) => {
  renderEpubImage(filePath, imageID);
});

ipcRenderer.on("load-epub", (event, filePath, pageIndex) => {
  document.querySelector(".centered-block").style.display = "none";
  loadEpub(filePath, pageIndex);
});

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function renderEpubImage(filePath, imageID) {
  console.log("renderEpubImage: " + imageID + " from: " + filePath);
  // Maybe I couldnot load it every time, keeping the epub object in memory, but this seems to work fine enough
  const epub = new EPub(filePath);
  epub.on("error", function (err) {
    console.log("ERROR\n-----");
    throw err;
  });
  epub.on("end", function (err) {
    document.querySelector(".centered-block").style.display = "none";

    epub.getImage(imageID, function (err, data, mimeType) {
      // ref: https://stackoverflow.com/questions/54305759/how-to-encode-a-buffer-to-base64-in-nodejs
      let data64 = Buffer.from(data).toString("base64");
      let img64 = "data:" + mimeType + ";base64," + data64;
      let element = '<img class="page" src="' + img64 + '" />';
      let container = document.getElementById("pages-container");
      container.innerHTML = element; // + element;
      document.querySelector(".container-after-titlebar").scrollTop = 0;
      ipcRenderer.send("epub-page-loaded");
    });
  });
  epub.parse();
}

function loadEpub(filePath, pageNum) {
  // ref: https://github.com/julien-c/epub/blob/master/example/example.js
  console.log("load epub: " + filePath);
  const epub = new EPub(filePath);
  epub.on("error", function (err) {
    console.log("ERROR\n-----");
    throw err;
  });
  epub.on("end", function (err) {
    // console.log(epub.metadata);
    // console.log(epub.flow); // spine
    // console.log(epub.toc);

    // This will send a message to main at the end (epub-loaded)
    extractEpubImagesSrcRecursive(epub, 0, filePath, pageNum, []);
  });

  epub.parse();
}

function extractEpubImagesSrcRecursive(
  epub,
  chapterIndex,
  filePath,
  pageNum,
  imageIDs
) {
  epub.getChapter(epub.spine.contents[chapterIndex].id, function (err, data) {
    let isEnd = false;
    if (err) {
      console.log(err);
      isEnd = true;
    } else {
      // ref: https://stackoverflow.com/questions/14939296/extract-image-src-from-a-string/14939476
      //const rex = /<img[^>]+src="?([^"\s]+)"?\s*\/>/g;
      const rex = /<img[^>]+src="([^">]+)/g;
      while ((m = rex.exec(data))) {
        // i.e. /images/img-0139/OPS/images/0139.jpeg -> TODO extract id: img-0139
        let id = m[1].split("/")[2];
        imageIDs.push(id);
      }
      if (chapterIndex + 1 < epub.spine.contents.length) {
        extractEpubImagesSrcRecursive(
          epub,
          chapterIndex + 1,
          filePath,
          pageNum,
          imageIDs
        );
      } else {
        isEnd = true;
      }
    }
    if (isEnd) {
      ipcRenderer.send("epub-loaded", true, filePath, pageNum, imageIDs);
    }
  });
}

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentPdf = null;
let g_currentPdfPage = null;
// TODO clean those up when closing file!

function loadPdf(filePath, pageIndex) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "./assets/libs/pdfjs/build/pdf.worker.js";
  var loadingTask = pdfjsLib.getDocument(filePath);
  loadingTask.promise.then(function (pdf) {
    g_currentPdf = pdf;
    ipcRenderer.send(
      "pdf-loaded",
      true,
      filePath,
      pageIndex,
      g_currentPdf.numPages
    );
  });
}

function renderPdfPage(pageIndex, rotation) {
  let pageNum = pageIndex + 1; // pdfjs counts from 1
  // ref: https://mozilla.github.io/pdf.js/examples/
  g_currentPdf.getPage(pageNum).then(
    function (page) {
      g_currentPdfPage = page;

      var canvas = document.getElementById("pdf-canvas");
      var context = canvas.getContext("2d");

      var desiredWidth = canvas.offsetWidth;
      var viewport = g_currentPdfPage.getViewport({
        scale: 1,
        rotation,
      });
      var scale = desiredWidth / viewport.width;
      var scaledViewport = g_currentPdfPage.getViewport({
        scale: scale,
        rotation,
      });

      canvas.height = scaledViewport.height;
      canvas.width = desiredWidth;

      var renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      let renderTask = g_currentPdfPage.render(renderContext);
      renderTask.promise.then(function () {
        ipcRenderer.send("pdf-page-loaded");
      });

      document.querySelector(".container-after-titlebar").scrollTop = 0;
    },
    function (reason) {
      // PDF loading error
      console.error(reason);
    }
  );
}

function refreshPdfPage(rotation) {
  if (g_currentPdfPage === undefined) return;
  var desiredWidth = window.innerWidth;

  var viewport = g_currentPdfPage.getViewport({ scale: 1, rotation });
  var scale = desiredWidth / viewport.width;
  var scaledViewport = g_currentPdfPage.getViewport({ scale: scale, rotation });

  var canvas = document.getElementById("pdf-canvas");
  var context = canvas.getContext("2d");
  canvas.height = scaledViewport.height; // viewport.height;
  canvas.width = scaledViewport.width; // viewport.width;

  var renderContext = {
    canvasContext: context,
    viewport: scaledViewport,
  };
  g_currentPdfPage.render(renderContext);
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
  } else if (evt.keyCode == 36) {
    // home
    ipcRenderer.send("home-pressed");
  } else if (evt.keyCode == 35) {
    // end
    ipcRenderer.send("end-pressed");
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
    event.target.id === "pages-container" ||
    event.target.className === "container-after-titlebar"
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
// mouse right click: document.oncontextmenu

document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault();
};

document.body.ondrop = (ev) => {
  //console.log(ev.dataTransfer.files[0].path);
  ipcRenderer.send("open-file", ev.dataTransfer.files[0].path);
  ev.preventDefault();
};

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
