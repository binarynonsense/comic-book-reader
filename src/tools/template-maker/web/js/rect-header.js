/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { Rect } from "./rect.js";
import { drawHeaderText as drawHeaderText } from "./header.js";

export class HeaderRect extends Rect {
  constructor(
    parent,
    x,
    y,
    width,
    height,
    ppi,
    drawCropMarks,
    cropMarksLineWidth,
    drawHeader,
    headerLineWidth
  ) {
    super(parent, x, y, width, height, ppi);
    this.drawCropMarks = drawCropMarks;
    this.cropMarksLineWidth = cropMarksLineWidth;
    this.drawHeader = drawHeader;
    this.headerLineWidth = headerLineWidth;
  }

  draw(ctx, layers, recursive) {
    const bleedSize = this.children[0];
    const trimSize = bleedSize.children[0];
    /////////////////
    // HEADER ///////
    /////////////////
    if (
      (layers.includes(0) || layers.includes(this.layer)) &&
      this.drawHeader
    ) {
      drawHeaderText(
        ctx,
        this.drawCropMarks ? trimSize.x : bleedSize.x,
        bleedSize.y,
        this.lineColor,
        this.headerLineWidth
      );
    }
    /////////////////
    // CROP MARKS ///
    /////////////////
    if (
      (layers.includes(0) || layers.includes(this.layer)) &&
      this.drawCropMarks
    ) {
      // up left
      this.drawLine(
        ctx,
        trimSize.x,
        bleedSize.y,
        bleedSize.y,
        0,
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
      // up right
      this.drawLine(
        ctx,
        trimSize.x + trimSize.width,
        bleedSize.y,
        bleedSize.y,
        0,
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
      // down left
      this.drawLine(
        ctx,
        trimSize.x,
        bleedSize.y + bleedSize.height,
        -(this.height - bleedSize.y + bleedSize.height),
        0,
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
      // down right
      this.drawLine(
        ctx,
        trimSize.x + trimSize.width,
        bleedSize.y + bleedSize.height,
        -(this.height - bleedSize.y + bleedSize.height),
        0,
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
      //left up
      this.drawLine(
        ctx,
        bleedSize.x,
        trimSize.y,
        0,
        bleedSize.x,
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
      //left down
      this.drawLine(
        ctx,
        bleedSize.x,
        trimSize.y + trimSize.height,
        0,
        bleedSize.x,
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
      //right up
      this.drawLine(
        ctx,
        bleedSize.x + bleedSize.width,
        trimSize.y,
        0,
        -(this.width - bleedSize.x + bleedSize.width),
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
      //right down
      this.drawLine(
        ctx,
        bleedSize.x + bleedSize.width,
        trimSize.y + trimSize.height,
        0,
        -(this.width - bleedSize.x + bleedSize.width),
        this.cropMarksLineWidth,
        [0, 0],
        this.lineColor
      );
    }
    /////////////////
    // BORDER ///////
    /////////////////
    super.draw(ctx, layers, recursive);
  }
}
