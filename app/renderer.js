const { ipcRenderer, remote } = require("electron");
const { Menu } = remote;
const customTitlebar = require("custom-electron-titlebar");
const pdfjsLib = require("./assets/libs/pdfjs/build/pdf.js");
const EPub = require("epub");

let g_currentPdf = null;
let g_currentPdfPage = null;
let g_currentImg64 = null;

function cleanUp() {
  g_currentPdf = null;
  g_currentPdfPage = null;
  g_currentImg64 = null;
}

let g_titlebar = new customTitlebar.Titlebar({
  backgroundColor: customTitlebar.Color.fromHex("#818181"),
  itemBackgroundColor: customTitlebar.Color.fromHex("#bbb"),
  icon: "./assets/images/icon_256x256.png",
  titleHorizontalAlignment: "right",
});

function resetScrollBars() {
  document.querySelector(".container-after-titlebar").scrollTop = 0;
  document.querySelector(".container-after-titlebar").scrollLeft = 0;
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVED ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("update-loading", (event, isVisible) => {
  if (isVisible) {
    document.querySelector("#loading").classList.add("is-active");
  } else {
    document.querySelector("#loading").classList.remove("is-active");
  }
});

ipcRenderer.on("update-menubar", (event) => {
  g_titlebar.updateMenu(Menu.getApplicationMenu());
});

ipcRenderer.on("update-centered-block-text", (event, text) => {
  document.querySelector("#centered-block-text").innerHTML = text;
});

ipcRenderer.on(
  "update-toolbar-tooltips",
  (
    event,
    tOpenFile,
    tPrevious,
    tNext,
    tFitWidth,
    tFitHeight,
    tRotateCounter,
    tRotateClock,
    tFullScreen
  ) => {
    document.querySelector("#toolbar-button-open-href").title = tOpenFile;
    document.querySelector("#toolbar-button-prev-href").title = tPrevious;
    document.querySelector("#toolbar-button-next-href").title = tNext;
    document.querySelector(
      "#toolbar-button-fit-to-height-href"
    ).title = tFitHeight;
    document.querySelector(
      "#toolbar-button-fit-to-width-href"
    ).title = tFitWidth;
    document.querySelector(
      "#toolbar-button-rotate-counterclockwise-href"
    ).title = tRotateCounter;
    document.querySelector(
      "#toolbar-button-rotate-clockwise-href"
    ).title = tRotateClock;
    document.querySelector(
      "#toolbar-button-fullscreen-enter-href"
    ).title = tFullScreen;
    document.querySelector(
      "#toolbar-button-fullscreen-exit-href"
    ).title = tFullScreen;
  }
);

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
  toolbarUpdatePageInfo(pageNum, numPages);
});

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("file-closed", (event, img64, rotation) => {
  cleanUp();
  let container = document.getElementById("pages-container");
  container.innerHTML = "";
  document.querySelector(".centered-block").classList.remove("hide");
  toolbarUpdatePageInfo(0, 0);
});

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("render-img-page", (event, img64, rotation) => {
  cleanUp();
  document.querySelector(".centered-block").classList.add("hide");
  g_currentImg64 = img64;
  renderImg64(rotation);
  resetScrollBars();
});

ipcRenderer.on("refresh-img-page", (event, rotation) => {
  renderImg64(rotation);
});

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("load-pdf", (event, filePath, pageIndex) => {
  document.querySelector(".centered-block").classList.add("hide");
  loadPdf(filePath, pageIndex);
});

ipcRenderer.on("render-pdf-page", (event, pageIndex, rotation) => {
  renderPdfPage(pageIndex, rotation);
});

ipcRenderer.on("refresh-pdf-page", (event, rotation) => {
  refreshPdfPage(rotation);
});

ipcRenderer.on(
  "extract-pdf-image-buffer",
  (event, filePath, pageNum, outputFolderPath) => {
    extractPDFImageBuffer(filePath, pageNum, outputFolderPath);
  }
);

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("load-epub", (event, filePath, pageIndex) => {
  document.querySelector(".centered-block").classList.add("hide");
  loadEpub(filePath, pageIndex);
});

ipcRenderer.on("render-epub-image", (event, filePath, imageID, rotation) => {
  renderEpubImage(filePath, imageID, rotation);
});

ipcRenderer.on("refresh-epub-image", (event, rotation) => {
  renderImg64(rotation);
});

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on("show-modal-prompt", (event, question, defaultValue) => {
  showModalPrompt(question, defaultValue);
});

ipcRenderer.on("show-modal-info", (event, title, message) => {
  showModalAlert(title, message);
});

///////////////////////////////////////////////////////////////////////////////
// MODALS /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showModalPrompt(question, defaultValue) {
  //const smalltalk = require("./assets/libs/smalltalk/smalltalk.min.js");
  smalltalk
    .prompt(question, defaultValue)
    .then((value) => {
      // console.log(value);
      ipcRenderer.send("go-to-page", value);
    })
    .catch(() => {
      // console.log("cancel");
    });
}

function showModalAlert(title, message) {
  smalltalk.alert(title, message).then(() => {
    // console.log("ok");
  });
}

///////////////////////////////////////////////////////////////////////////////
// IMG64 //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function renderImg64(rotation) {
  let container = document.getElementById("pages-container");
  container.innerHTML = "";
  if (rotation === 0 || rotation === 180) {
    var image = new Image();
    image.onload = function () {
      container.appendChild(image);
    };
    image.src = g_currentImg64;
    image.classList.add("page");
    if (rotation === 180) {
      image.classList.add("set-rotate-180");
    }
  }
  // I use a different method here, I prefer the look of images in <img> when resizing but can't make them rotate
  // as I like, so I'll try canvas for these rotations
  else if (rotation === 90 || rotation === 270) {
    var canvas = document.createElement("canvas");
    canvas.id = "page-canvas";
    container.appendChild(canvas);
    var context = canvas.getContext("2d");
    var image = new Image();
    image.onload = function () {
      // ref: https://stackoverflow.com/questions/44076873/resize-image-and-rotate-canvas-90-degrees
      canvas.width = image.height;
      canvas.height = image.width;
      if (rotation === 90) {
        context.setTransform(
          0, // hScale
          1, // vSkew
          -1, // hSkew
          0, // vScale
          image.height, // hTrans
          0 // vTrans
        );
      } else if (rotation === 270) {
        context.setTransform(
          0, // hScale
          -1, // vSkew
          1, // hSkew
          0, // vScale
          0, // hTrans
          image.width // vTrans
        );
      }
      context.drawImage(image, 0, 0);
      context.setTransform(1, 0, 0, 1, 0, 0); // restore default
    };
    image.src = g_currentImg64;
  }
}

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function loadEpub(filePath, pageNum) {
  // ref: https://github.com/julien-c/epub/blob/master/example/example.js
  const epub = new EPub(filePath);
  epub.on("error", function (err) {
    ipcRenderer.send("epub-load-failed");
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

function renderEpubImage(filePath, imageID, rotation) {
  // Maybe I couldnot load it every time, keeping the epub object in memory, but this seems to work fine enough
  const epub = new EPub(filePath);
  epub.on("error", function (err) {
    console.log("ERROR\n-----");
    throw err;
  });
  epub.on("end", function (err) {
    document.querySelector(".centered-block").classList.add("hide");

    epub.getImage(imageID, function (err, data, mimeType) {
      // ref: https://stackoverflow.com/questions/54305759/how-to-encode-a-buffer-to-base64-in-nodejs
      let data64 = Buffer.from(data).toString("base64");
      g_currentImg64 = "data:" + mimeType + ";base64," + data64;
      renderImg64(rotation);
      resetScrollBars();
      ipcRenderer.send("epub-page-loaded");
    });
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
        // i.e. /images/img-0139/OPS/images/0139.jpeg
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

function loadPdf(filePath, pageIndex) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "./assets/libs/pdfjs/build/pdf.worker.js";
  var loadingTask = pdfjsLib.getDocument(filePath);
  loadingTask.promise
    .then(function (pdf) {
      cleanUp();
      g_currentPdf = pdf;
      ipcRenderer.send(
        "pdf-loaded",
        true,
        filePath,
        pageIndex,
        g_currentPdf.numPages
      );
    })
    .catch((e) => {
      ipcRenderer.send("pdf-load-failed");
    });
}

function refreshPdfPage(rotation) {
  if (g_currentPdfPage === undefined) return;
  renderCurrentPDFPage(rotation);
}

function renderPdfPage(pageIndex, rotation) {
  let pageNum = pageIndex + 1; // pdfjs counts from 1
  // ref: https://mozilla.github.io/pdf.js/examples/
  g_currentPdf.getPage(pageNum).then(
    function (page) {
      g_currentPdfPage = page;
      renderCurrentPDFPage(rotation);
      resetScrollBars();
    },
    function (reason) {
      // PDF loading error
      console.error(reason);
    }
  );
}

function renderCurrentPDFPage(rotation) {
  // I recreate the canvas every time to avoid some rendering issues when rotating (low res)
  // there's probably a better way, but performance seems similar
  let container = document.getElementById("pages-container");
  container.innerHTML = "";
  var canvas = document.createElement("canvas");
  canvas.id = "page-canvas";
  container.appendChild(canvas);

  var canvas = document.getElementById("page-canvas");
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
}

async function extractPDFImageBuffer(filePath, pageNum, outputFolderPath) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "./assets/libs/pdfjs/build/pdf.worker.js";
  try {
    const pdf = await pdfjsLib.getDocument(filePath).promise;
    let page = await pdf.getPage(pageNum);

    // RENDER
    const canvas = document.createElement("canvas");
    let viewport = page.getViewport({
      scale: 300 / 72,
    }); // defines the size in pixels(72DPI)
    let context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;

    let img = canvas.toDataURL("image/jpeg", 0.75);
    let data = img.replace(/^data:image\/\w+;base64,/, "");
    let buf = Buffer.from(data, "base64");

    page.cleanup();
    pdf.cleanup();
    pdf.destroy();
    ipcRenderer.send(
      "pdf-page-buffer-extracted",
      undefined,
      buf,
      outputFolderPath
    );
  } catch (err) {
    ipcRenderer.send("pdf-page-buffer-extracted", err, buf, outputFolderPath);
  }
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS ////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

document.onkeydown = function (event) {
  event = event || window.event;
  // ref: http://gcctech.org/csc/javascript/javascript_keycodes.htm
  if (event.keyCode == 34 || event.keyCode == 39) {
    // page down or arrow right
    ipcRenderer.send("mouse-click", true);
    event.stopPropagation();
  } else if (event.keyCode == 33 || event.keyCode == 37) {
    // page up or arrow left
    ipcRenderer.send("mouse-click", false);
    event.stopPropagation();
  } else if (event.keyCode == 36) {
    // home
    ipcRenderer.send("home-pressed");
  } else if (event.keyCode == 35) {
    // end
    ipcRenderer.send("end-pressed");
  } else if (event.keyCode == 40) {
    // arrow down
    let container = document.querySelector(".container-after-titlebar");
    let amount = container.offsetHeight / 5;
    container.scrollBy(0, amount);
    event.stopPropagation();
  } else if (event.keyCode == 38) {
    // arrow up
    let container = document.querySelector(".container-after-titlebar");
    let amount = container.offsetHeight / 5;
    document.querySelector(".container-after-titlebar").scrollBy(0, -amount);
    event.stopPropagation();
  } else if (event.keyCode == 27) {
    // escape
    ipcRenderer.send("escape-pressed");
  } else if (event.ctrlKey && event.shiftKey && event.keyCode == 73) {
    // ctrl + shift + i
    ipcRenderer.send("dev-tools-pressed");
  }
};

document.onclick = function (event) {
  if (
    event.target.classList.contains("page") ||
    event.target.id === "page-canvas" ||
    event.target.id === "pages-container" ||
    event.target.classList.contains("container-after-titlebar")
  ) {
    const mouseX = event.clientX;
    const bodyX = document.body.clientWidth;
    if (mouseX > bodyX / 2) {
      ipcRenderer.send("mouse-click", true); // next
    } else {
      ipcRenderer.send("mouse-click", false); // prev
    }
  }
};
// mouse right click: document.oncontextmenu

document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault();
};

document.body.ondrop = (ev) => {
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

addButtonEvent("toolbar-button-rotate-clockwise");
addButtonEvent("toolbar-button-rotate-counterclockwise");
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

function toolbarUpdatePageInfo(pageNum, numPages) {
  if (numPages === 0) pageNum = -1; // hack to make it show 00 / 00 @ start
  document.getElementById("page-slider").max = numPages;
  document.getElementById("page-slider").value = pageNum + 1;
  document.getElementById("toolbar-page-numbers").innerHTML =
    pageNum + 1 + " / " + numPages;
}

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
