/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// ref: https://developer.mozilla.org/en-US/docs/Web/API/Crypto
// ref: https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid/
export function getUUID() {
  if (crypto.subtle) {
    return crypto.randomUUID();
  } else {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  }
}

export class Node {
  constructor(parent, id, type) {
    this.id = id;
    this.parent = parent;
    this.type = type;
    this.children = [];
  }

  addChild(child) {
    this.children.push(child);
  }

  addChildAtIndex(index, child) {
    this.children.splice(index, 0, child);
  }

  removeChildWithId(id) {
    this.children = this.children.filter((e) => e.id !== id);
  }

  getChildIndexFromId(id) {
    for (let index = 0; index < this.children.length; index++) {
      const child = this.children[index];
      if (child.id === id) {
        return index;
      }
    }
    return undefined;
  }

  drawRect(ctx, x, y, width, height, lineWidth, lineColor, ppi) {
    if (lineWidth > 0) {
      ctx.lineWidth = lineWidth * ppi;
      ctx.strokeStyle = lineColor;
      ctx.setLineDash([0, 0]);
      ctx.strokeRect(x * ppi, y * ppi, width * ppi, height * ppi);
    }
  }

  drawLine(ctx, x, y, up, left, width, color, ppi) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.setLineDash([0, 0]);
    ctx.lineWidth = width * ppi;
    ctx.beginPath();
    ctx.moveTo(x * ppi, y * ppi);
    ctx.lineTo((x - left) * ppi, (y - up) * ppi);
    ctx.stroke();
  }

  drawText(ctx, x, y, text, textHeight, textWeight, fontName, color, ppi) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.font = `${textWeight === "bold" ? "bold " : ""}${
      textHeight * ppi
    }px ${fontName}`;
    ctx.fillText(text, x * ppi, y * ppi);
  }
}

export function getNodeFromId(node, id) {
  if (node.id === id) return node;
  for (let index = 0; index < node.children.length; index++) {
    let result = getNodeFromId(node.children[index], id);
    if (result) return result;
  }
  return undefined;
}
