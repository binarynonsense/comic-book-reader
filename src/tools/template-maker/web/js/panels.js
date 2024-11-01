/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { drawCompositeImage } from "./draw.js";
import { getUUID, Node, getNodeFromId } from "./node.js";

let NodeType = {
  VGROUP: "vgroup",
  HGROUP: "hgroup",
  PANEL: "panel",
};

let g_rootNode;
let g_selectedNodeId;

export function initPanels() {
  // type select
  document
    .getElementById("grid-nodes-tree-selected-type-select")
    .addEventListener("change", function (event) {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          const type = document.getElementById(
            "grid-nodes-tree-selected-type-select"
          ).value;
          if (node.type === type) return;
          const id = node.id;
          const children = node.children;
          const parent = node.parent;
          const size = node.sizePercentage;
          let index;
          if (parent) {
            index = parent.getChildIndexFromId(id);
            parent.removeChildWithId(id);
          }
          if (type === NodeType.PANEL) {
            const newNode = new GridNode(parent, id, NodeType.PANEL, size);
            newNode.children = children;
            newNode.children.forEach((child) => {
              child.parent = newNode;
            });
            if (parent) {
              parent.addChildAtIndex(index, newNode);
            } else {
              g_rootNode = newNode;
            }
          } else {
            const newNode = new GridNode(
              parent,
              id,
              event.target.value === "vgroup"
                ? NodeType.VGROUP
                : NodeType.HGROUP,
              size
            );
            newNode.children = children;
            newNode.children.forEach((child) => {
              child.parent = newNode;
            });
            if (parent) {
              parent.addChildAtIndex(index, newNode);
            } else {
              g_rootNode = newNode;
            }
          }
          drawHtmlTree(id);
          document.getElementById(id).scrollIntoView();
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });

  // size input
  document
    .getElementById("grid-nodes-tree-selected-size-input")
    .addEventListener("change", function (event) {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          let percentage = document.getElementById(
            "grid-nodes-tree-selected-size-input"
          ).value;
          if (percentage < 0) percentage = 0;
          else if (percentage > 100) percentage = 100;
          if (!node.parent || node.parent.children.length <= 1)
            percentage = 100;
          node.sizePercentage = percentage;
          node.parent.recalculateChildrenSizes(node);
          drawHtmlTree(node.id);
          document.getElementById(node.id).scrollIntoView();
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // add group button
  document
    .getElementById("grid-nodes-tree-selected-addgroup-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          node.addChild(new GridNode(node, getUUID(), NodeType.VGROUP, 100));
          node.recalculateChildrenSizes();
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // add panel button
  document
    .getElementById("grid-nodes-tree-selected-addpanel-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          node.addChild(new GridNode(node, getUUID(), NodeType.PANEL, 100));
          node.recalculateChildrenSizes();
          drawHtmlTree(g_selectedNodeId);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      }
    });
  // move up button
  document
    .getElementById("grid-nodes-tree-selected-moveup-button")
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
    .getElementById("grid-nodes-tree-selected-movedown-button")
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
    .getElementById("grid-nodes-tree-selected-remove-button")
    .addEventListener("click", function () {
      if (g_selectedNodeId) {
        const node = getNodeFromId(g_rootNode, g_selectedNodeId);
        if (node) {
          const nodeParent = node.parent;
          nodeParent.removeChildWithId(node.id);
          nodeParent.recalculateChildrenSizes();
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

class GridNode extends Node {
  constructor(parent, id, type, sizePercentage) {
    super(parent, id, type);
    this.sizePercentage = sizePercentage;
  }

  recalculateChildrenSizes(exceptNode) {
    let totalNum = this.children.length;
    let totalPercentage = 100;
    if (exceptNode) {
      totalNum -= 1;
      totalPercentage -= exceptNode.sizePercentage;
    }
    let childPercentage = totalPercentage / totalNum;
    for (let index = 0; index < this.children.length; index++) {
      const child = this.children[index];
      if (child === exceptNode) {
        continue;
      }
      child.sizePercentage = childPercentage;
    }
  }

  draw(ctx, x, y, width, height, gutterSize, lineWidth, lineColor, ppi) {
    if (this.type === NodeType.PANEL) {
      this.drawRect(ctx, x, y, width, height, lineWidth, lineColor, ppi);
    }
    // children
    let nodeX = x;
    let nodeY = y;
    for (let index = 0; index < this.children.length; index++) {
      const node = this.children[index];
      if (this.type === NodeType.VGROUP) {
        let nodeWidth = width;
        let nodeHeight =
          (node.sizePercentage / 100) *
          (height - (this.children.length - 1) * gutterSize);
        node.draw(
          ctx,
          nodeX,
          nodeY,
          nodeWidth,
          nodeHeight,
          gutterSize,
          lineWidth,
          lineColor,
          ppi
        );
        nodeY += nodeHeight + gutterSize;
      } else if (this.type === NodeType.HGROUP) {
        let nodeWidth =
          (node.sizePercentage / 100) *
          (width - (this.children.length - 1) * gutterSize);
        let nodeHeight = height;
        node.draw(
          ctx,
          nodeX,
          nodeY,
          nodeWidth,
          nodeHeight,
          gutterSize,
          lineWidth,
          lineColor,
          ppi
        );
        nodeX += nodeWidth + gutterSize;
      }
    }
  }
}

//////////////////////////////////////////
//////////////////////////////////////////

export function drawGrid(ctx, x, y, width, height) {
  const ppi = document.getElementById("ppi-input").value;
  const toInches =
    document.getElementById("units-select").value === "inches" ? 1 : 1 / 2.54;
  const gutterSize =
    document.getElementById("panel-gutter-size-input").value * toInches;
  const lineWidth =
    document.getElementById("panel-line-width-input").value * toInches;
  const lineColor = document.getElementById("panel-line-color-input").value;
  g_rootNode.draw(
    ctx,
    x,
    y,
    width,
    height,
    gutterSize,
    lineWidth,
    lineColor,
    ppi
  );
}

// function buildSymetricGrid(cols, rows) {
//   g_rootNode = new GridNode(undefined, getUUID(), NodeType.VGROUP, 100);
//   for (let y = 0; y < rows; y++) {
//     let hgroup = new GridNode(
//       g_rootNode,
//       getUUID(),
//       NodeType.HGROUP,
//       100 / rows
//     );
//     g_rootNode.addChild(hgroup);
//     for (let x = 0; x < cols; x++) {
//       hgroup.addChild(
//         new GridNode(hgroup, getUUID(), NodeType.PANEL, 100 / cols)
//       );
//     }
//   }
// }

//////////////////////////////////////////
//////////////////////////////////////////

function drawHtmlTree(selectedId) {
  g_selectedNodeId = g_rootNode.id;
  let rootElement = document.getElementById("panel-tree-view-root");
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
  if (node.type === NodeType.PANEL) {
    let li = document.createElement("li");
    htmlParent.appendChild(li);
    let button = document.createElement("div");
    li.appendChild(button);
    button.classList = "tree-view-panel-button";
    button.textContent = document.querySelector(
      "#grid-node-type-option-panel"
    ).textContent; //"panel";
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
    if (node.type === NodeType.VGROUP) {
      button.textContent = document.querySelector(
        "#grid-node-type-option-vgroup"
      ).textContent; //"vertical group";
    } else {
      button.textContent = document.querySelector(
        "#grid-node-type-option-hgroup"
      ).textContent; //"horizontal group";
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
    // debug
    if (false) {
      document.getElementById("grid-nodes-tree-selected-debug").textContent =
        node.id;
      document
        .getElementById("grid-nodes-tree-selected-debug")
        .classList.remove("hidden");
    } else {
      document
        .getElementById("grid-nodes-tree-selected-debug")
        .classList.add("hidden");
    }
    // type
    document
      .querySelectorAll("#tree-view-selected-element-type-select option")
      .forEach((opt) => {
        if (node.children.length > 0 && opt.value == "panel") {
          // nodes with children can't be converted to panels
          opt.disabled = true;
        } else {
          opt.disabled = false;
        }
      });
    document.getElementById("grid-nodes-tree-selected-type-select").value =
      node.type;
    // size
    if (node.parent === undefined) {
      document.getElementById(
        "grid-nodes-tree-selected-size-input"
      ).disabled = true;
    } else {
      document.getElementById(
        "grid-nodes-tree-selected-size-input"
      ).disabled = false;
    }
    document.getElementById("grid-nodes-tree-selected-size-input").value =
      node.sizePercentage;
    // add buttons
    if (node.type === NodeType.PANEL) {
      document
        .getElementById("grid-nodes-tree-selected-addgroup-button")
        .classList.add("tree-view-button-disabled");
      document
        .getElementById("grid-nodes-tree-selected-addpanel-button")
        .classList.add("tree-view-button-disabled");
    } else {
      document
        .getElementById("grid-nodes-tree-selected-addgroup-button")
        .classList.remove("tree-view-button-disabled");
      document
        .getElementById("grid-nodes-tree-selected-addpanel-button")
        .classList.remove("tree-view-button-disabled");
    }
    // move up/down buttons
    if (canMoveUp) {
      document
        .getElementById("grid-nodes-tree-selected-moveup-button")
        .classList.remove("tree-view-button-disabled");
    } else {
      document
        .getElementById("grid-nodes-tree-selected-moveup-button")
        .classList.add("tree-view-button-disabled");
    }
    if (canMoveDown) {
      document
        .getElementById("grid-nodes-tree-selected-movedown-button")
        .classList.remove("tree-view-button-disabled");
    } else {
      document
        .getElementById("grid-nodes-tree-selected-movedown-button")
        .classList.add("tree-view-button-disabled");
    }
    // remove button
    if (node.parent === undefined) {
      document
        .getElementById("grid-nodes-tree-selected-remove-button")
        .classList.add("tree-view-button-disabled");
    } else {
      document
        .getElementById("grid-nodes-tree-selected-remove-button")
        .classList.remove("tree-view-button-disabled");
    }
  } else {
    // TODO: disable type and size inputs
    document
      .getElementById("grid-nodes-tree-selected-addgroup-button")
      .classList.add("tree-view-button-disabled");
    document
      .getElementById("grid-nodes-tree-selected-addpanel-button")
      .classList.add("tree-view-button-disabled");
    document
      .getElementById("grid-nodes-tree-selected-moveup-button")
      .classList.add("tree-view-button-disabled");
    document
      .getElementById("grid-nodes-tree-selected-movedown-button")
      .classList.add("tree-view-button-disabled");
    document
      .getElementById("grid-nodes-tree-selected-remove-button")
      .classList.add("tree-view-button-disabled");
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
    sizePercentage: node.sizePercentage,
    children: children,
  };
}

function createNodeFromPresetData(data, parentNode) {
  let node = new GridNode(
    parentNode,
    getUUID(),
    data.type,
    data.sizePercentage
  );
  data.children.forEach((child) => {
    node.addChild(createNodeFromPresetData(child, node));
  });
  return node;
}

export function exportGridPresetData() {
  return getNodePresetData(g_rootNode, undefined);
}

export function loadGridPresetData(data) {
  g_rootNode = createNodeFromPresetData(data);
  drawHtmlTree();
}
