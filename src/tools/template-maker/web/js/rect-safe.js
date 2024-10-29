/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { Rect } from "./rect.js";
import { drawGrid as drawPanelGrid } from "./panels.js";

export class SafeRect extends Rect {
  constructor(
    parent,
    x,
    y,
    width,
    height,
    ppi,
    drawBorderMarks,
    borderMarkWidth,
    borderMarkMaxLength,
    middleMarkPos,
    gutterSize,
    drawPanels,
    drawPanelGuides,
    renderPanelGuidesColor,
    panelGuidesWidth
  ) {
    super(parent, x, y, width, height, ppi);
    this.drawBorderMarks = drawBorderMarks;
    this.borderMarkWidth = borderMarkWidth;
    this.borderMarkMaxLength = borderMarkMaxLength;
    this.middleMarkPos = middleMarkPos;
    this.gutterSize = gutterSize;
    this.drawPanels = drawPanels;
    this.drawPanelGuides = drawPanelGuides;
    this.renderPanelGuidesColor = renderPanelGuidesColor;
    this.panelGuidesWidth = panelGuidesWidth;
  }

  draw(ctx, layers, recursive) {
    /////////////////
    // MARKS ////////
    /////////////////
    if (this.drawBorderMarks || this.drawPanelGuides) {
      /////////////////
      // MIDDLE ///////
      /////////////////
      const trimSize = this.parent.getSize();
      const bleedSize = this.parent.getParent().getSize();
      let markLineLength = this.borderMarkMaxLength;
      let markLineWidth = this.borderMarkWidth;
      let lineDash = [0, 0];
      const middleUp = { x: this.x + this.width / 2, y: bleedSize.y };
      const middleDown = {
        x: this.x + this.width / 2,
        y: bleedSize.y + bleedSize.height,
      };
      const middleLeft = { x: bleedSize.x, y: this.y + this.height / 2 };
      const middleRight = {
        x: bleedSize.x + bleedSize.width,
        y: this.y + this.height / 2,
      };
      if (
        (layers.includes(0) || layers.includes(this.layer)) &&
        this.drawBorderMarks
      ) {
        // up
        this.drawLine(
          ctx,
          middleUp.x,
          middleUp.y,
          markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // down
        this.drawLine(
          ctx,
          middleDown.x,
          middleDown.y,
          -markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // left
        this.drawLine(
          ctx,
          middleLeft.x,
          middleLeft.y,
          0,
          markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // right
        this.drawLine(
          ctx,
          middleRight.x,
          middleRight.y,
          0,
          -markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
      }
      if (
        (layers.includes(0) || layers.includes(this.layer + 1)) &&
        this.drawPanelGuides
      ) {
        // up down
        this.drawLine(
          ctx,
          middleUp.x - this.gutterSize / 2,
          middleUp.y,
          -bleedSize.height,
          0,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        this.drawLine(
          ctx,
          middleUp.x + this.gutterSize / 2,
          middleUp.y,
          -bleedSize.height,
          0,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        // left right
        this.drawLine(
          ctx,
          middleLeft.x,
          middleLeft.y - this.gutterSize / 2,
          0,
          -bleedSize.width,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        this.drawLine(
          ctx,
          middleLeft.x,
          middleLeft.y + this.gutterSize / 2,
          0,
          -bleedSize.width,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
      }
      /////////////////
      // THIRDS ///////
      /////////////////
      const third1Up = { x: this.x + this.width / 3, y: bleedSize.y };
      const third2Up = { x: this.x + (2 * this.width) / 3, y: bleedSize.y };
      const third1Down = {
        x: this.x + this.width / 3,
        y: bleedSize.y + bleedSize.height,
      };
      const third2Down = {
        x: this.x + (2 * this.width) / 3,
        y: bleedSize.y + bleedSize.height,
      };
      const third1Left = { x: bleedSize.x, y: this.y + this.height / 3 };
      const third2Left = { x: bleedSize.x, y: this.y + (2 * this.height) / 3 };

      const third1Right = {
        x: bleedSize.x + bleedSize.width,
        y: this.y + this.height / 3,
      };
      const third2Right = {
        x: bleedSize.x + bleedSize.width,
        y: this.y + (2 * this.height) / 3,
      };

      if (
        (layers.includes(0) || layers.includes(this.layer)) &&
        this.drawBorderMarks
      ) {
        markLineLength = this.borderMarkMaxLength / 2;
        // up
        this.drawLine(
          ctx,
          third1Up.x,
          third1Up.y,
          markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          third2Up.x,
          third2Up.y,
          markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // down
        this.drawLine(
          ctx,
          third1Down.x,
          third1Down.y,
          -markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          third2Down.x,
          third2Down.y,
          -markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // left
        this.drawLine(
          ctx,
          third1Left.x,
          third1Left.y,
          0,
          markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          third2Left.x,
          third2Left.y,
          0,
          markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // right
        this.drawLine(
          ctx,
          third1Right.x,
          third1Right.y,
          0,
          -markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          third2Right.x,
          third2Right.y,
          0,
          -markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
      }
      if (
        (layers.includes(0) || layers.includes(this.layer + 1)) &&
        this.drawPanelGuides
      ) {
        const third1UpAlt = {
          x:
            this.x +
            (this.width - 2 * this.gutterSize) / 3 +
            this.gutterSize / 2,
          y: third1Up.y,
        };
        const third2UpAlt = {
          x:
            this.x +
            (2 * (this.width - 2 * this.gutterSize)) / 3 +
            1.5 * this.gutterSize,
          y: third1Up.y,
        };

        const third1LeftAlt = {
          x: third1Left.x,
          y:
            this.y +
            (this.height - 2 * this.gutterSize) / 3 +
            this.gutterSize / 2,
        };
        const third2LeftAlt = {
          x: third1Left.x,
          y:
            this.y +
            (2 * (this.height - 2 * this.gutterSize)) / 3 +
            1.5 * this.gutterSize,
        };
        // up down
        // 1
        this.drawLine(
          ctx,
          third1UpAlt.x - this.gutterSize / 2,
          third1UpAlt.y,
          -bleedSize.height,
          0,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        this.drawLine(
          ctx,
          third1UpAlt.x + this.gutterSize / 2,
          third1UpAlt.y,
          -bleedSize.height,
          0,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        // 2
        this.drawLine(
          ctx,
          third2UpAlt.x - this.gutterSize / 2,
          third2UpAlt.y,
          -bleedSize.height,
          0,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        this.drawLine(
          ctx,
          third2UpAlt.x + this.gutterSize / 2,
          third2UpAlt.y,
          -bleedSize.height,
          0,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        // left right
        // 1
        this.drawLine(
          ctx,
          third1LeftAlt.x,
          third1LeftAlt.y - this.gutterSize / 2,
          0,
          -bleedSize.width,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        this.drawLine(
          ctx,
          third1LeftAlt.x,
          third1LeftAlt.y + this.gutterSize / 2,
          0,
          -bleedSize.width,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        // 2
        this.drawLine(
          ctx,
          third2LeftAlt.x,
          third2LeftAlt.y - this.gutterSize / 2,
          0,
          -bleedSize.width,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
        this.drawLine(
          ctx,
          third2LeftAlt.x,
          third2LeftAlt.y + this.gutterSize / 2,
          0,
          -bleedSize.width,
          this.panelGuidesWidth,
          lineDash,
          this.renderPanelGuidesColor
        );
      }
      /////////////////
      // FOURTHS///////
      /////////////////
      if (
        (layers.includes(0) || layers.includes(this.layer)) &&
        this.drawBorderMarks
      ) {
        // up
        this.drawLine(
          ctx,
          this.x + this.width / 4,
          bleedSize.y,
          markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          this.x + (3 * this.width) / 4,
          bleedSize.y,
          markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // down
        this.drawLine(
          ctx,
          this.x + this.width / 4,
          bleedSize.y + bleedSize.height,
          -markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          this.x + (3 * this.width) / 4,
          bleedSize.y + bleedSize.height,
          -markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // left
        this.drawLine(
          ctx,
          bleedSize.x,
          this.y + this.height / 4,
          0,
          markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          bleedSize.x,
          this.y + (3 * this.height) / 4,
          0,
          markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // right
        this.drawLine(
          ctx,
          bleedSize.x + bleedSize.width,
          this.y + this.height / 4,
          0,
          -markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        this.drawLine(
          ctx,
          bleedSize.x + bleedSize.width,
          this.y + (3 * this.height) / 4,
          0,
          -markLineLength,
          markLineWidth,
          lineDash,
          this.lineColor
        );
      }
      //////////////////////////
      // DOUBLE SPREAD MIDDLE //
      //////////////////////////
      if (
        (layers.includes(0) || layers.includes(this.layer)) &&
        this.middleMarkPos &&
        this.middleMarkPos > 0
      ) {
        markLineLength = this.borderMarkMaxLength;
        markLineWidth = this.borderMarkWidth;
        lineDash = [0, 0];
        // up
        this.drawLine(
          ctx,
          this.middleMarkPos,
          bleedSize.y,
          markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
        // down
        this.drawLine(
          ctx,
          this.middleMarkPos,
          bleedSize.y + bleedSize.height,
          -markLineLength,
          0,
          markLineWidth,
          lineDash,
          this.lineColor
        );
      }
    }
    /////////////////
    // BORDER ///////
    /////////////////
    super.draw(ctx, layers, recursive);
    /////////////////
    // PANELS ///////
    /////////////////
    if (
      (layers.includes(0) || layers.includes(this.layer + 2)) &&
      this.drawPanels
    ) {
      drawPanelGrid(ctx, this.x, this.y, this.width, this.height);
    }
  }
}
