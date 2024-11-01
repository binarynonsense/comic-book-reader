/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { drawCompositeImage } from "./draw.js";
import { getUUID, Node, getNodeFromId } from "./node.js";

let NodeType = {
  HEADER: "header",
  LINE: "line",
  TEXT: "text",
  UNDERLINE: "underline",
  SPACE: "space",
};

let g_rootNode;
let g_selectedNodeId;

export function initHeaderText() {
  // text input
  document
    .getElementById("header-nodes-tree-selected-string-input")
    .addEventListener("change", function (event) {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          let text = document.getElementById(
            "header-nodes-tree-selected-string-input"
          ).value;
          // TODO: sanitize?
          node.value = text;
          drawHtmlTree(node.id);
          document.getElementById(node.id).scrollIntoView();
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // length input
  document
    .getElementById("header-nodes-tree-selected-length-input")
    .addEventListener("change", function (event) {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          let length = document.getElementById(
            "header-nodes-tree-selected-length-input"
          ).value;
          // TODO: sanitize?
          node.length = length;
          drawHtmlTree(node.id);
          document.getElementById(node.id).scrollIntoView();
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // add line button
  document
    .getElementById("header-nodes-tree-selected-addline-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          node.addChild(
            new HeaderNode(node, getUUID(), NodeType.LINE, 0, undefined)
          );
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // add text button
  document
    .getElementById("header-nodes-tree-selected-addtext-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          node.addChild(
            new HeaderNode(node, getUUID(), NodeType.TEXT, 0, "TEXT")
          );
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // add space button
  document
    .getElementById("header-nodes-tree-selected-addspace-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          node.addChild(
            new HeaderNode(node, getUUID(), NodeType.SPACE, 0.5, undefined)
          );
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // add underline button
  document
    .getElementById("header-nodes-tree-selected-addunderline-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          node.addChild(
            new HeaderNode(node, getUUID(), NodeType.UNDERLINE, 4, undefined)
          );
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // move up button
  document
    .getElementById("header-nodes-tree-selected-moveup-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          const index = node.parent.getChildIndexFromId(node.id);
          const temp = node.parent.children[index - 1];
          node.parent.children[index - 1] = node.parent.children[index];
          node.parent.children[index] = temp;
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // move up button
  document
    .getElementById("header-nodes-tree-selected-movedown-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          const index = node.parent.getChildIndexFromId(node.id);
          const temp = node.parent.children[index + 1];
          node.parent.children[index + 1] = node.parent.children[index];
          node.parent.children[index] = temp;
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // remove button
  document
    .getElementById("header-nodes-tree-selected-remove-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          const nodeParent = node.parent;
          nodeParent.removeChildWithId(node.id);
          drawHtmlTree(nodeParent.id);
          document.getElementById(nodeParent.id).scrollIntoView();
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
}

//////////////////////////////////////////
//////////////////////////////////////////

class HeaderNode extends Node {
  constructor(parent, id, type, length, value) {
    super(parent, id, type);
    this.length = length;
    this.value = value;
  }

  draw(
    ctx,
    x,
    y,
    lineColor,
    lineWidth,
    textHeight,
    textWeight,
    lineSpacing,
    ppi
  ) {
    switch (this.type) {
      case NodeType.TEXT:
        this.drawText(
          ctx,
          x,
          y,
          this.value,
          textHeight,
          textWeight,
          "Arial",
          lineColor,
          ppi
        );
        this.length = ctx.measureText(this.value).width / (textHeight * ppi);
        break;

      case NodeType.UNDERLINE:
        this.drawLine(
          ctx,
          x,
          y,
          0,
          -this.length * textHeight,
          lineWidth,
          lineColor,
          ppi
        );
        break;

      default:
        break;
    }

    let nodeX = x;
    let nodeY = y;
    for (let index = 0; index < this.children.length; index++) {
      const node = this.children[index];
      if (this.type === NodeType.HEADER) {
        node.draw(
          ctx,
          nodeX,
          nodeY,
          lineColor,
          lineWidth,
          textHeight,
          textWeight,
          lineSpacing,
          ppi
        );
        nodeY -= textHeight * lineSpacing;
      } else if (this.type === NodeType.LINE) {
        node.draw(
          ctx,
          nodeX,
          nodeY,
          lineColor,
          lineWidth,
          textHeight,
          textWeight,
          lineSpacing,
          ppi
        );
        nodeX += node.length * textHeight;
      }
    }
  }
}

//////////////////////////////////////////
//////////////////////////////////////////

export function drawHeaderText(ctx, x, y, lineColor, lineWidth) {
  const ppi = document.getElementById("ppi-input").value;
  const toInches =
    document.getElementById("units-select").value === "inches" ? 1 : 1 / 2.54;
  const headerTextHeight =
    document.getElementById("header-text-height-input").value * toInches;
  const headerPaddingBottom =
    document.getElementById("header-padding-bottom-input").value * toInches;
  const headerPaddingLeft =
    document.getElementById("header-padding-left-input").value * toInches;
  const headerTextWeight = document.getElementById(
    "header-text-weight-select"
  ).value;
  const headerLineSpacing = document.getElementById(
    "header-text-spacing-select"
  ).value;
  g_rootNode.draw(
    ctx,
    x + headerPaddingLeft,
    y - headerPaddingBottom,
    lineColor,
    lineWidth,
    headerTextHeight,
    headerTextWeight,
    headerLineSpacing,
    ppi
  );
}

//////////////////////////////////////////
//////////////////////////////////////////

function drawHtmlTree(selectedId) {
  g_selectedNodeId = g_rootNode.id;
  let rootElement = document.getElementById("header-tree-view-root");
  rootElement.innerHTML = "";
  buildHtmlTree(g_rootNode, rootElement);
  if (selectedId) {
    setSelectedTreeElementFromId(selectedId);
  } else {
    setSelectedTreeElementFromId(g_rootNode.id);
  }
  return;
}

function buildHtmlTree(node, htmlParent) {
  if (node.type !== NodeType.HEADER && node.type !== NodeType.LINE) {
    let li = document.createElement("li");
    htmlParent.appendChild(li);
    let button = document.createElement("div");
    li.appendChild(button);
    button.classList = "tree-view-panel-button";
    if (node.type === NodeType.TEXT) {
      button.textContent = document.querySelector(
        "#header-node-type-text-span"
      ).textContent; //"text";
    } else if (node.type === NodeType.SPACE) {
      button.textContent = button.textContent = document.querySelector(
        "#header-node-type-space-span"
      ).textContent; //"space";
    } else {
      button.textContent = button.textContent = document.querySelector(
        "#header-node-type-underline-span"
      ).textContent; //"underline";
    }
    button.id = node.id;
    if (node.id === g_selectedNodeId)
      button.classList.add("tree-view-button-selected");
    button.addEventListener("click", function (event) {
      handleTreeButtonClicked(button);
      event.preventDefault();
      event.stopImmediatePropagation();
    });
  } else {
    let li = document.createElement("li");
    htmlParent.appendChild(li);

    let details = document.createElement("details");
    li.appendChild(details);
    details.open = true;

    let summary = document.createElement("summary");
    details.appendChild(summary);
    summary.classList = "tree-view-item";

    let button = document.createElement("div");
    summary.appendChild(button);
    button.classList = "tree-view-summary-button";
    if (node.type === NodeType.HEADER) {
      button.textContent = button.textContent = document.querySelector(
        "#header-node-type-header-span"
      ).textContent; //"header";
    } else {
      button.textContent = button.textContent = document.querySelector(
        "#header-node-type-line-span"
      ).textContent; //"line";
    }
    button.id = node.id;
    if (node.id === g_selectedNodeId)
      button.classList.add("tree-view-button-selected");
    button.addEventListener("click", function (event) {
      handleTreeButtonClicked(button);
      event.preventDefault();
      event.stopImmediatePropagation();
    });

    if (node.children.length > 0) {
      let ul = document.createElement("ul");
      details.appendChild(ul);
      node.children.forEach((childNode) => {
        buildHtmlTree(childNode, ul);
      });
    }
  }
}

function handleTreeButtonClicked(buttonElement) {
  if (buttonElement.id !== g_selectedNodeId) {
    setSelectedTreeElementFromId(buttonElement.id);
  }
}

function setSelectedTreeElementFromId(id) {
  document
    .getElementById(g_selectedNodeId)
    .classList.remove("tree-view-button-selected");
  let selectedElement = document.getElementById(id);
  selectedElement.classList.add("tree-view-button-selected");
  g_selectedNodeId = id;
  const node = getNodeFromId(g_rootNode, g_selectedNodeId);
  if (node) {
    let canMoveUp,
      canMoveDown = false;
    if (node.parent && node.parent.children.length > 1) {
      for (let index = 0; index < node.parent.children.length; index++) {
        const sibling = node.parent.children[index];
        if (sibling === node) {
          if (index > 0) {
            canMoveUp = true;
          }
          if (index < node.parent.children.length - 1) {
            canMoveDown = true;
          }
          break;
        }
      }
    }
    // length & text
    if (node.type === NodeType.HEADER || node.type === NodeType.LINE) {
      document
        .getElementById("header-nodes-tree-selected-length-label")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-string-label")
        .classList.add("tree-view-button-hidden");
    } else if (node.type === NodeType.TEXT) {
      document
        .getElementById("header-nodes-tree-selected-length-label")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-string-label")
        .classList.remove("tree-view-button-hidden");
      document.getElementById("header-nodes-tree-selected-string-input").value =
        node.value;
    } else {
      document
        .getElementById("header-nodes-tree-selected-length-label")
        .classList.remove("tree-view-button-hidden");
      document.getElementById("header-nodes-tree-selected-length-input").value =
        node.length;
      document
        .getElementById("header-nodes-tree-selected-string-label")
        .classList.add("tree-view-button-hidden");
    }
    // add buttons
    if (node.type === NodeType.HEADER) {
      document
        .getElementById("header-nodes-tree-selected-addline-button")
        .classList.remove("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addtext-button")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addunderline-button")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addspace-button")
        .classList.add("tree-view-button-hidden");
    } else if (node.type === NodeType.LINE) {
      document
        .getElementById("header-nodes-tree-selected-addline-button")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addtext-button")
        .classList.remove("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addunderline-button")
        .classList.remove("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addspace-button")
        .classList.remove("tree-view-button-hidden");
    } else {
      document
        .getElementById("header-nodes-tree-selected-addline-button")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addtext-button")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addunderline-button")
        .classList.add("tree-view-button-hidden");
      document
        .getElementById("header-nodes-tree-selected-addspace-button")
        .classList.add("tree-view-button-hidden");
    }
    // move up/down buttons
    if (canMoveUp) {
      document
        .getElementById("header-nodes-tree-selected-moveup-button")
        .classList.remove("tree-view-button-disabled");
    } else {
      document
        .getElementById("header-nodes-tree-selected-moveup-button")
        .classList.add("tree-view-button-disabled");
    }
    if (canMoveDown) {
      document
        .getElementById("header-nodes-tree-selected-movedown-button")
        .classList.remove("tree-view-button-disabled");
    } else {
      document
        .getElementById("header-nodes-tree-selected-movedown-button")
        .classList.add("tree-view-button-disabled");
    }
    // remove button
    if (node.parent === undefined) {
      document
        .getElementById("header-nodes-tree-selected-remove-button")
        .classList.add("tree-view-button-disabled");
    } else {
      document
        .getElementById("header-nodes-tree-selected-remove-button")
        .classList.remove("tree-view-button-disabled");
    }
  } else {
    // TODO: disable all
  }
}

//////////////////////////////////////////
//////////////////////////////////////////

function getNodePresetData(node) {
  let children = [];
  node.children.forEach((child) => {
    children.push(getNodePresetData(child));
  });
  return {
    type: node.type,
    length:
      node.type === NodeType.HEADER ||
      node.type === NodeType.LINE ||
      node.type === NodeType.TEXT
        ? undefined
        : node.length,
    value: node.type === NodeType.TEXT ? node.value : undefined,
    children: children,
  };
}

function createNodeFromPresetData(data, parentNode) {
  let node = new HeaderNode(
    parentNode,
    getUUID(),
    data.type,
    data.length,
    data.value
  );
  data.children.forEach((child) => {
    node.addChild(createNodeFromPresetData(child, node));
  });
  return node;
}

export function exportHeaderPresetData() {
  return getNodePresetData(g_rootNode, undefined);
}

export function loadHeaderPresetData(data) {
  g_rootNode = createNodeFromPresetData(data);
  drawHtmlTree();
}
