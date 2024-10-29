/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { Rect } from "./rect.js";
import { SafeRect } from "./rect-safe.js";
import { HeaderRect as HeaderRect } from "./rect-header.js";

import { showLoading } from "./loading.js";

let g_compositeCanvas;

export function initRenderer() {
  g_compositeCanvas = document.createElement("canvas");
  g_compositeCanvas.id = "hidden-canvas";
}

export function getCompositeCanvas() {
  return g_compositeCanvas;
}

function updatePreviewImage() {
  document.getElementById("result-img").src = g_compositeCanvas.toDataURL();
}

export function drawCompositeImage() {
  showLoading(true);
  // set timeout so loading spinner can show
  setTimeout(() => {
    let canvas = g_compositeCanvas;
    let rootRect = buildRects();
    let renderedPageData = drawToCanvas(canvas, rootRect);
    fitCanvasContentToLayout(canvas, renderedPageData, () => {
      updatePreviewImage();
      showLoading(false);
    });
  }, "100");
}

export function renderLayers(onFinish) {
  let canvas = g_compositeCanvas;
  let rootRect = buildRects();
  let renderedPageData0 = drawToCanvas(canvas, rootRect);
  renderedPageData0.layerCanvases = [];
  fitCanvasContentToLayout(canvas, renderedPageData0, () => {
    updatePreviewImage();
    // layer 1 - background
    let layerCanvas1 = document.createElement("canvas");
    let renderedPageData1 = drawToCanvas(layerCanvas1, rootRect, [1]);
    renderedPageData1.layerCanvases = renderedPageData0.layerCanvases;
    fitCanvasContentToLayout(layerCanvas1, renderedPageData1, () => {
      renderedPageData1.layerCanvases.push({
        canvas: layerCanvas1,
        name: "paper",
      });
      // layer 2 - safe, trim, bleed, crop, header..
      let layerCanvas2 = document.createElement("canvas");
      let renderedPageData2 = drawToCanvas(layerCanvas2, rootRect, [2]);
      renderedPageData2.layerCanvases = renderedPageData1.layerCanvases;
      fitCanvasContentToLayout(layerCanvas2, renderedPageData2, () => {
        renderedPageData2.layerCanvases.push({
          canvas: layerCanvas2,
          name: "printing areas",
        });
        // layer 3 - panel guides
        let layerCanvas3 = document.createElement("canvas");
        let renderedPageData3 = drawToCanvas(layerCanvas3, rootRect, [3]);
        renderedPageData3.layerCanvases = renderedPageData2.layerCanvases;
        fitCanvasContentToLayout(layerCanvas3, renderedPageData3, () => {
          renderedPageData3.layerCanvases.push({
            canvas: layerCanvas3,
            name: "panel guides",
          });
          // layer 4 - panel grid
          let layerCanvas4 = document.createElement("canvas");
          let renderedPageData4 = drawToCanvas(layerCanvas4, rootRect, [4]);
          renderedPageData4.layerCanvases = renderedPageData3.layerCanvases;
          fitCanvasContentToLayout(layerCanvas4, renderedPageData4, () => {
            renderedPageData4.layerCanvases.push({
              canvas: layerCanvas4,
              name: "panel grid",
            });
            // send all canvases
            onFinish(renderedPageData4);
          });
        });
      });
    });
  });
}

function buildRects() {
  const ppi = document.getElementById("ppi-input").value;
  const toInches =
    document.getElementById("units-select").value === "inches" ? 1 : 1 / 2.54;

  const makeDoublePage =
    document.getElementById("layout-spread-select").value === "double"
      ? true
      : false;

  const lineWidthThin =
    document.getElementById("line-width-thin-input").value * toInches;
  const lineWidthThick =
    document.getElementById("line-width-thick-input").value * toInches;

  let trimWidth = document.getElementById("trim-width-input").value * toInches;
  const trimHeight =
    document.getElementById("trim-height-input").value * toInches;
  const safeMarginTop =
    document.getElementById("safe-margin-top-input").value * toInches;
  const safeMarginBottom =
    document.getElementById("safe-margin-bottom-input").value * toInches;
  const safeMarginLeft =
    document.getElementById("safe-margin-left-input").value * toInches;
  const safeMarginRight =
    document.getElementById("safe-margin-right-input").value * toInches;
  const bleedMargin =
    document.getElementById("bleed-margin-input").value * toInches;
  const headerMarginTopBottom =
    document.getElementById("header-margin-top-bottom-input").value * toInches;
  const headerMarginLeftRight =
    document.getElementById("header-margin-left-right-input").value * toInches;

  const gutterSize =
    document.getElementById("panel-gutter-size-input").value * toInches;

  const borderMarkMaxLength =
    document.getElementById("border-marks-length-input").value * toInches;
  const lineColor = document.getElementById("line-color-input").value;
  const lineWidthMultiplier = document.getElementById(
    "line-thickness-select"
  ).value;
  const renderPanelGuidesColor = document.getElementById(
    "panel-guides-color-input"
  ).value;

  const drawHeader = document.getElementById(
    "paper-draw-header-checkbox"
  ).checked;
  const drawBleed = document.getElementById("bleed-draw-checkbox").checked;
  const drawTrim = document.getElementById("trim-draw-checkbox").checked;
  const drawSafe = document.getElementById("safe-draw-checkbox").checked;
  const drawBorderMarks = document.getElementById(
    "border-marks-draw-checkbox"
  ).checked;
  const drawCropMarks = document.getElementById(
    "crop-marks-draw-checkbox"
  ).checked;
  const drawPanelGuides = document.getElementById(
    "panel-guides-draw-checkbox"
  ).checked;
  const drawPanels = document.getElementById("panels-draw-checkbox").checked;

  if (makeDoublePage) trimWidth *= 2;
  //////////////////////
  // BUILD /////////////
  //////////////////////
  const headerWidth = trimWidth + bleedMargin * 2 + headerMarginLeftRight * 2;
  const headerHeight = trimHeight + bleedMargin * 2 + headerMarginTopBottom * 2;
  const headerRect = new HeaderRect(
    undefined,
    0,
    0,
    headerWidth,
    headerHeight,
    ppi,
    drawCropMarks,
    lineWidthThick * lineWidthMultiplier, // width is used in crop lines
    drawHeader,
    lineWidthThin * lineWidthMultiplier // used in header
  );
  headerRect.setBorderStyle(0, lineColor, [0, 0]);

  const bleedWidth = trimWidth + bleedMargin * 2;
  const bleedHeight = trimHeight + bleedMargin * 2;
  const bleedX = (headerWidth - bleedWidth) / 2;
  const bleedY = (headerHeight - bleedHeight) / 2;
  const bleedRect = new Rect(
    headerRect,
    bleedX,
    bleedY,
    bleedWidth,
    bleedHeight,
    ppi
  );
  bleedRect.setBorderStyle(
    drawBleed ? lineWidthThick * lineWidthMultiplier : 0,
    lineColor,
    [0, 0]
  );
  headerRect.addChild(bleedRect);

  const trimX = bleedX + bleedMargin;
  const trimY = bleedY + bleedMargin;
  const trimRect = new Rect(
    bleedRect,
    trimX,
    trimY,
    trimWidth,
    trimHeight,
    ppi
  );
  trimRect.setBorderStyle(
    drawTrim ? lineWidthThin * lineWidthMultiplier : 0,
    lineColor,
    [0, 0]
  );
  bleedRect.addChild(trimRect);

  if (makeDoublePage) {
    let safeX = trimX + safeMarginLeft;
    let safeY = trimY + safeMarginTop;
    let safeWidth =
      (trimWidth - safeMarginLeft - safeMarginRight - safeMarginRight * 2) / 2;
    let safeHeight = trimHeight - safeMarginTop - safeMarginBottom;
    let middleMarkPos = trimX + trimWidth / 2;
    const safeRect_1 = new SafeRect(
      trimRect,
      safeX,
      safeY,
      safeWidth,
      safeHeight,
      ppi,
      drawBorderMarks,
      lineWidthThick * lineWidthMultiplier,
      borderMarkMaxLength,
      undefined,
      gutterSize,
      drawPanels,
      drawPanelGuides,
      renderPanelGuidesColor,
      lineWidthThin * lineWidthMultiplier
    );
    safeRect_1.setBorderStyle(
      drawSafe ? lineWidthThin * lineWidthMultiplier : 0,
      lineColor,
      [safeHeight / 120, safeHeight / 120]
    );
    trimRect.addChild(safeRect_1);

    safeX = safeX + safeWidth + 2 * safeMarginRight;
    const safeRect_2 = new SafeRect(
      trimRect,
      safeX,
      safeY,
      safeWidth,
      safeHeight,
      ppi,
      drawBorderMarks,
      lineWidthThick * lineWidthMultiplier,
      borderMarkMaxLength,
      middleMarkPos,
      gutterSize,
      drawPanels,
      drawPanelGuides,
      renderPanelGuidesColor,
      lineWidthThin * lineWidthMultiplier
    );
    safeRect_2.setBorderStyle(
      drawSafe ? lineWidthThin * lineWidthMultiplier : 0,
      lineColor,
      [safeHeight / 120, safeHeight / 120]
    );
    trimRect.addChild(safeRect_2);
  } else {
    const safeX = trimX + safeMarginLeft;
    const safeY = trimY + safeMarginTop;
    const safeWidth = trimWidth - safeMarginLeft - safeMarginRight;
    const safeHeight = trimHeight - safeMarginTop - safeMarginBottom;
    const safeRect_1 = new SafeRect(
      trimRect,
      safeX,
      safeY,
      safeWidth,
      safeHeight,
      ppi,
      drawBorderMarks,
      lineWidthThick * lineWidthMultiplier,
      borderMarkMaxLength,
      undefined,
      gutterSize,
      drawPanels,
      drawPanelGuides,
      renderPanelGuidesColor,
      lineWidthThin * lineWidthMultiplier
    );
    safeRect_1.setBorderStyle(
      drawSafe ? lineWidthThin * lineWidthMultiplier : 0,
      lineColor,
      [safeHeight / 120, safeHeight / 120]
    );
    trimRect.addChild(safeRect_1);
  }

  return headerRect;
}

function drawToCanvas(canvas, rootRect, layers = [0]) {
  const ppi = document.getElementById("ppi-input").value;
  const drawBackground = document.getElementById(
    "paper-draw-bg-checkbox"
  ).checked;
  let backGroundColor = document.getElementById("background-color-input").value;

  canvas.width = rootRect.getSize().width * ppi;
  canvas.height = rootRect.getSize().height * ppi;
  const ctx = canvas.getContext("2d");
  if ((layers.includes(0) || layers.includes(1)) && drawBackground) {
    backGroundColor = backGroundColor;
  } else {
    backGroundColor = "rgba(0, 0, 0, 0)";
  }
  ctx.fillStyle = backGroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  rootRect.draw(ctx, layers, true);

  return {
    ppi: ppi,
    width: canvas.width,
    height: canvas.height,
    backGroundColor: backGroundColor,
  };
}

function fitCanvasContentToLayout(canvas, renderedPageData, onFinished) {
  if (document.getElementById("layout-template-select").value === "page") {
    if (
      document.getElementById("layout-page-paper-select").value === "header"
    ) {
      // paper size = header area size
      if (onFinished) onFinished();
    } else {
      // a4 210 mm x 297 mm
      let paperWidth = 8.27;
      let paperHeight = 11.69;
      if (document.getElementById("layout-page-paper-select").value === "us") {
        paperWidth = 8.5;
        paperHeight = 11;
      } else if (
        document.getElementById("layout-page-paper-select").value === "b4"
      ) {
        paperWidth = 10.12;
        paperHeight = 14.33;
      } //257 x 364 mm
      else if (
        document.getElementById("layout-page-paper-select").value === "11x17"
      ) {
        paperWidth = 11;
        paperHeight = 17;
      }
      let image = new Image();
      image.onload = function () {
        canvas.width = paperWidth * renderedPageData.ppi;
        canvas.height = paperHeight * renderedPageData.ppi;
        const doScale =
          document.getElementById("layout-page-scaling-select").value ===
          "scale"
            ? true
            : false;
        let pageWidth = renderedPageData.width;
        let pageHeight = renderedPageData.height;
        if (doScale) {
          const widthRatio = canvas.width / pageWidth;
          const heightRatio = canvas.height / pageHeight;
          const ratio = widthRatio < heightRatio ? widthRatio : heightRatio;
          pageWidth = ratio * pageWidth;
          pageHeight = ratio * pageHeight;
        }
        const gapX = canvas.width - pageWidth;
        const gapY = canvas.height - pageHeight;
        // draw the image
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = renderedPageData.backGroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this, gapX / 2, gapY / 2, pageWidth, pageHeight);

        if (onFinished) onFinished();
      };
      image.src = canvas.toDataURL();
    }
  } else {
    let paperWidth = 8.3;
    let paperHeight = 11.7;
    if (
      document.getElementById("layout-thumbnails-paper-select").value === "us"
    ) {
      paperWidth = 8.5;
      paperHeight = 11;
    }
    const numThumbsX = document.getElementById(
      "layout-thumbnails-columns-input"
    ).value;
    const numThumbsY = document.getElementById(
      "layout-thumbnails-rows-input"
    ).value;
    let image = new Image();
    image.onload = function () {
      canvas.width = paperWidth * renderedPageData.ppi;
      canvas.height = paperHeight * renderedPageData.ppi;
      const pageWidth = renderedPageData.width;
      const pageHeight = renderedPageData.height;
      const thumbWidthRatio = canvas.width / numThumbsX / pageWidth;
      const thumbHeightRatio = canvas.height / numThumbsY / pageHeight;
      const thumbRatio =
        thumbWidthRatio < thumbHeightRatio ? thumbWidthRatio : thumbHeightRatio;
      const thumbWidth = thumbRatio * pageWidth;
      const thumbHeight = thumbRatio * pageHeight;
      const gapX = canvas.width - thumbWidth * numThumbsX;
      const gapY = canvas.height - thumbHeight * numThumbsY;
      // draw the pattern
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = renderedPageData.backGroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let subCanvas = document.createElement("canvas");
      subCanvas.width = thumbWidth;
      subCanvas.height = thumbHeight;
      subCanvas
        .getContext("2d")
        .drawImage(this, 0, 0, subCanvas.width, subCanvas.height);
      ctx.fillStyle = ctx.createPattern(subCanvas, "repeat");
      ctx.translate(gapX / 2, gapY / 2);
      ctx.fillRect(0, 0, thumbWidth * numThumbsX, thumbHeight * numThumbsY);

      if (onFinished) onFinished();
    };
    image.src = canvas.toDataURL();
  }
}
