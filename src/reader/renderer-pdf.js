/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { on, sendIpcToMain, showNoBookContent } from "./renderer.js";
import {
  setScrollBarsPosition,
  setFilterClass,
  getPageMode,
} from "./renderer-ui.js";

export function initIpc() {
  initOnIpcCallbacks();
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initOnIpcCallbacks() {
  on("load-pdf", (filePath, pageIndex, password) => {
    loadPdf(filePath, pageIndex, password);
  });

  on("render-pdf-page", (pageIndexes, rotation, scrollBarPos) => {
    showNoBookContent(false);
    renderPdfPages(pageIndexes, rotation, scrollBarPos);
  });

  on("refresh-pdf-page", (rotation) => {
    refreshPdfPages(rotation);
  });

  on(
    "extract-pdf-image-buffer",
    (filePath, pageNum, outputFolderPath, password, sendToTool) => {
      extractPDFImageBuffer(
        filePath,
        pageNum,
        outputFolderPath,
        password,
        sendToTool
      );
    }
  );
}

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_currentPdf = {};
let g_renderJobPages;
let g_latestRenderJobId = 0;

export function cleanUp() {
  g_currentPdf = {};
  g_renderJobPages = undefined;
}

function loadPdf(filePath, pageIndex, password) {
  // pdfjsLib.GlobalWorkerOptions.workerSrc =
  //   "../assets/libs/pdfjs-2.3.200/build/pdf.worker.js";
  let escapedInputFilePath = filePath.replaceAll("#", "%23");
  // hashtags must be escaped so PDF.js doesn't break trying to parse
  // the path, as it looks for patterns like #page=2&zoom=200
  let loadingTask = pdfjsLib.getDocument({
    url: escapedInputFilePath,
    password: password,
    isEvalSupported: false,
  });
  loadingTask.promise
    .then(function (pdf) {
      cleanUp();
      g_currentPdf.pdf = pdf;
      //console.log(g_currentPdf.pdf);
      g_currentPdf.pdf
        .getMetadata()
        .then(function (metadata) {
          sendIpcToMain(
            "pdf-loaded",
            filePath,
            pageIndex,
            g_currentPdf.pdf.numPages,
            {
              encrypted: password && password.trim() !== "",
              creator: metadata.info.Creator,
              producer: metadata.info.Producer,
              created: metadata.info.CreationDate,
              modified: metadata.info.ModDate,
              format: "PDF " + metadata.info.PDFFormatVersion,
              author: metadata.info.Author,
              subject: metadata.info.Subject,
              keywords: metadata.info.Keywords,
              title: metadata.info.Title,
            }
          );
        })
        .catch(function (error) {
          // keep on anyway
          sendIpcToMain(
            "pdf-loaded",
            filePath,
            pageIndex,
            g_currentPdf.pdf.numPages,
            { encrypted: password && password.trim() !== "" }
          );
        });
    })
    .catch((error) => {
      sendIpcToMain("pdf-load-failed", error);
    });
}

function refreshPdfPages(rotation) {
  if (g_currentPdf.pages && g_currentPdf.pages.length > 0) {
    if (g_renderJobPages)
      for (let i = 0; i < g_currentPdf.pages.length; i++) {
        if (g_renderJobPages[i].renderTask) {
          return;
        }
      }
    renderOpenPDFPages(rotation, undefined, false);
  }
}

async function renderPdfPages(pageIndexes, rotation, scrollBarPos) {
  // NOTE: pdfjs counts from 1
  // ref: https://mozilla.github.io/pdf.js/examples/
  const isDoublePages = pageIndexes.length === 2;
  if (!isDoublePages) {
    g_currentPdf.pdf.getPage(pageIndexes[0] + 1).then(
      function (page) {
        g_currentPdf.pages = [];
        g_currentPdf.pages.push(page);
        renderOpenPDFPages(rotation, scrollBarPos, true);
      },
      function (reason) {
        // PDF loading error
        console.error(reason);
      }
    );
  } else {
    g_currentPdf.pages = [];
    for (let i = 0; i < pageIndexes.length; i++) {
      let page = await g_currentPdf.pdf.getPage(pageIndexes[i] + 1);
      g_currentPdf.pages.push(page);
    }
    renderOpenPDFPages(rotation, scrollBarPos, true);
  }
}

async function renderOpenPDFPages(rotation, scrollBarPos, sendPageLoaded) {
  // This new method hides the canvases and copies their images to a final
  // img element, as rendering downsized canvases looks worse to me, more
  // 'harsh'/broken, especially for texts.
  ////////////////////////////////////////////////////////////////////////////
  const jobId = performance.now();
  if (!g_renderJobPages) {
    g_renderJobPages = [];
    g_renderJobPages.push({
      canvas: document.createElement("canvas"),
    });
    g_renderJobPages.push({
      canvas: document.createElement("canvas"),
    });
  }
  let canvases = [];
  let createCanvases = false;
  for (let i = 0; i < g_currentPdf.pages.length; i++) {
    if (g_renderJobPages[i].renderTask) {
      createCanvases = true;
      break;
    }
  }
  for (let i = 0; i < g_currentPdf.pages.length; i++) {
    if (createCanvases) {
      g_renderJobPages[i].canvas = document.createElement("canvas");
      g_renderJobPages[i].renderTask = undefined;
      console.log(
        `Old PDF job still rendering, create new canvas (p${i}::dt${Math.trunc(
          g_renderJobPages[i].jobId - jobId
        )}ms)`
      );
    }
    g_renderJobPages[i].jobId = jobId;
    canvases.push(g_renderJobPages[i].canvas);
  }
  ////////////////////////////////////////////////////////////////////////////
  const containerDiv = document.getElementById("pages-container");
  const isDoublePages = g_currentPdf.pages.length === 2;
  // NOTE: to improve the flickering when loading new pages, I don't empty
  // the container yet and create the pages row as a hidden element to
  // only add it to the container and reveal it the last moment, which is when
  // I delete the previousrow
  // containerDiv.innerHTML = "";
  const tempPagesRowDiv = document.createElement("div");
  tempPagesRowDiv.classList.add("pages-row");
  tempPagesRowDiv.classList.add("pages-row-hidden-rendering");
  if (isDoublePages) tempPagesRowDiv.classList.add("pages-row-2p");
  containerDiv.appendChild(tempPagesRowDiv);
  tempPagesRowDiv.innerHTML = "";

  const finalPagesRowDiv = document.createElement("div");
  finalPagesRowDiv.classList.add("pages-row");
  finalPagesRowDiv.classList.add("pages-row-hidden-rendering");
  if (isDoublePages) finalPagesRowDiv.classList.add("pages-row-2p");
  containerDiv.appendChild(finalPagesRowDiv);
  finalPagesRowDiv.innerHTML = "";

  for (let i = 0; i < g_currentPdf.pages.length; i++) {
    if (g_renderJobPages[i].jobId !== jobId) {
      // can change during second page
      console.log(
        `Skiping page render (p${i}::dt${Math.trunc(
          g_renderJobPages[i].jobId - jobId
        )}ms`
      );
      break;
    }
    const tempCanvas = canvases[i];
    const context = tempCanvas.getContext("2d", { willReadFrequently: true });
    const finalImg = document.createElement("img");
    finalImg.classList.add("page-canvas");
    finalImg.classList.add("page");
    tempCanvas.classList.add("page-canvas");
    tempCanvas.classList.add("page");
    if (isDoublePages) {
      if (i === 0) {
        tempCanvas.classList.add("page-1");
        finalImg.classList.add("page-1");
      } else {
        tempCanvas.classList.add("page-2");
        finalImg.classList.add("page-2");
      }
    } else {
      if (g_currentPdf.pages.length == 1 && getPageMode() !== 0) {
        tempPagesRowDiv.classList.add("pages-row-2p");
        tempCanvas.classList.add("page-centered");
        finalPagesRowDiv.classList.add("pages-row-2p");
        finalImg.classList.add("page-centered");
      }
    }
    tempPagesRowDiv.appendChild(tempCanvas);
    setFilterClass(finalImg);
    finalPagesRowDiv.appendChild(finalImg);

    const desiredWidth = tempCanvas.offsetWidth;
    const viewport = g_currentPdf.pages[i].getViewport({
      scale: 1,
      rotation,
    });
    const scale = desiredWidth / viewport.width;
    let scaledViewport = g_currentPdf.pages[i].getViewport({
      scale: scale,
      rotation,
    });

    tempCanvas.height = scaledViewport.height;
    tempCanvas.width = desiredWidth;

    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    };

    const renderTask = g_currentPdf.pages[i].render(renderContext);
    g_renderJobPages[i].renderTask = renderTask;
    try {
      await renderTask.promise;
    } catch (error) {
      console.log(
        `(p${i}::dt${Math.trunc(g_renderJobPages[i].jobId - jobId)}ms`
      );
      console.log(error);
    }
    // renderTask.promise
    //   .then(function () {
    //   })
    //   .catch(function (error) {
    //   });

    finalImg.src = tempCanvas.toDataURL("image/jpeg");
    if (g_renderJobPages[i].jobId === jobId) {
      finalImg.src = tempCanvas.toDataURL("image/jpeg");
    } else {
      console.log(
        `PDF page rendered but didn't use it as it's out of date (p${i}::dt${Math.trunc(
          g_renderJobPages[i].jobId - jobId
        )}ms)`
      );
    }
  }

  if (g_renderJobPages[0].jobId === jobId) {
    finalPagesRowDiv.classList.remove("pages-row-hidden-rendering");
    while (containerDiv.childNodes.length > 1) {
      containerDiv.removeChild(containerDiv.firstChild);
    }

    setScrollBarsPosition(scrollBarPos);
    if (sendPageLoaded) {
      const [x1, y1, x2, y2] = g_currentPdf.pages[0].view;
      const width = x2 - x1;
      const height = y2 - y1;
      sendIpcToMain("page-loaded", {
        dimensions: [width, height],
      });
    }

    for (let i = 0; i < g_currentPdf.pages.length; i++) {
      g_renderJobPages[i].renderTask = undefined;
    }
  } else {
    console.log("PDF page render out of date");
    if (finalPagesRowDiv.parentElement)
      containerDiv.removeChild(finalPagesRowDiv);
  }
}

async function extractPDFImageBuffer(
  filePath,
  pageNum,
  outputFolderPath,
  password,
  sendToTool
) {
  // pdfjsLib.GlobalWorkerOptions.workerSrc =
  //   "../assets/libs/pdfjs-2.3.200/build/pdf.worker.js";
  let escapedInputFilePath = filePath.replaceAll("#", "%23");
  // hashtags must be escaped so PDF.js doesn't break trying to parse
  // the path, as it looks for patterns like #page=2&zoom=200
  try {
    const pdf = await pdfjsLib.getDocument({
      url: escapedInputFilePath,
      password: password,
      isEvalSupported: false,
    }).promise;
    let page = await pdf.getPage(pageNum);
    let pageWidth = page.view[2]; // [left, top, width, height]
    let pageHeight = page.view[3];
    let userUnit = page.userUnit; // 1 unit = 1/72 inch
    let dpi = 300; // use userUnit some day (if > 1) to set dpi?
    let iPerUnit = 1 / 72;
    let scaleFactor = dpi * iPerUnit; // default: output a 300dpi image instead of 72dpi, which is the pdf default?
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
    // check embedded imgs size
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
      let image;
      try {
        image = await page.objs.get(imageName);
      } catch (error) {
        image = undefined;
      }
      if (image !== undefined && image !== null) {
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
    page.cleanup();
    pdf.cleanup();
    pdf.destroy();
    sendIpcToMain(
      "pdf-page-dataurl-extracted",
      undefined,
      dataUrl,
      dpi,
      outputFolderPath,
      sendToTool
    );
  } catch (err) {
    console.log(err);
    sendIpcToMain(
      "pdf-page-dataurl-extracted",
      err,
      undefined,
      undefined,
      outputFolderPath,
      sendToTool
    );
  }
}
