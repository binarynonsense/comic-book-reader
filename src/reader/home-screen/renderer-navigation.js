/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// NOTE: based on tools-navigation

export function rebuild(data, focusedPanelID) {
  const root = document.getElementById("home-screen");
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
      rowId--;
      if (rowId < 0) rowId = data.tree[panelId].length - 1;
      if (data.tree[panelId][rowId].length > colId) {
        // keep at the same column
      } else {
        colId = 0;
      }
    } else if (downPressed) {
      rowId++;
      if (rowId >= data.tree[panelId].length) rowId = 0;
      if (data.tree[panelId][rowId].length > colId) {
        // keep at the same column
      } else {
        colId = 0;
      }
    } else if (leftPressed) {
      if (colId > 0) {
        colId--;
      }
    } else if (rightPressed) {
      if (colId < data.tree[panelId][rowId].length - 1) {
        colId++;
      }
    }
    data.focusedElement = data.tree[panelId][rowId][colId];
    data.focusedElement.focus();
  }
}
