/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function rebuild(data, focusedPanelID) {
  const root = document.getElementById("tools-columns");
  data.focusedElement = undefined;
  data.tree = [];
  for (let panelIndex = 0; panelIndex < 2; panelIndex++) {
    data.tree.push([]);
    const panelElements = root.querySelectorAll(
      `[data-nav-panel='${panelIndex}']`
    );
    for (let index = 0; index < panelElements.length; index++) {
      const element = panelElements[index];
      const rowId = element.getAttribute("data-nav-row");
      const colId = element.getAttribute("data-nav-col");
      if (!data.tree[panelIndex][rowId]) {
        data.tree[panelIndex][rowId] = [];
      }
      data.tree[panelIndex][rowId][colId] = element;
    }
  }
  if (focusedPanelID != undefined) {
    data.focusedElement = data.tree[focusedPanelID][0][0];
    if (data.showFocus) data.focusedElement.focus();
  }
}

export function navigate(
  data,
  backButtonElement,
  backPressed,
  actionPressed,
  upPressed,
  downPressed,
  leftPressed,
  rightPressed
) {
  if (!data.tree || data.tree.length <= 0) return;
  if (!data.focusedElement) data.focusedElement = data.tree[0][0][0];

  if (upPressed || downPressed || leftPressed || rightPressed) {
    data.showFocus = true;
  }

  if (backPressed && backButtonElement) {
    backButtonElement.click();
  } else if (actionPressed) {
    if (data.focusedElement) {
      data.focusedElement.click();
      document.activeElement.blur();
    }
  } else if (upPressed || downPressed || leftPressed || rightPressed) {
    let panelId = data.focusedElement.getAttribute("data-nav-panel");
    let rowId = data.focusedElement.getAttribute("data-nav-row");
    let colId = data.focusedElement.getAttribute("data-nav-col");
    if (upPressed) {
      colId = 0;
      rowId--;
      if (rowId < 0) rowId = data.tree[panelId].length - 1;
    } else if (downPressed) {
      colId = 0;
      rowId++;
      if (rowId >= data.tree[panelId].length) rowId = 0;
    } else if (leftPressed) {
      if (colId > 0) {
        colId--;
      } else {
        if (panelId > 0) {
          panelId--;
          colId = 0;
          rowId = 0;
          document.getElementById("tools-columns-right").scrollIntoView({
            behavior: "instant",
            block: "start",
            inline: "nearest",
          });
        }
      }
    } else if (rightPressed) {
      if (colId < data.tree[panelId][rowId].length - 1) {
        colId++;
      } else {
        // TODO: hardcoded 1, store somewhere the number of panels
        if (panelId < 1) {
          panelId++;
          colId = 0;
          rowId = 0;
        }
      }
    }
    data.focusedElement = data.tree[panelId][rowId][colId];
    data.focusedElement.focus();
  }
}
