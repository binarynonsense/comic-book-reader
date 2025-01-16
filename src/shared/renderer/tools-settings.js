/**
 * @license
 * Copyright 2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function getOptions(rootId) {
  let options = {};
  let root = document.getElementById(rootId);

  const inputs = root.getElementsByTagName("input");
  for (let index = 0; index < inputs.length; index++) {
    const element = inputs[index];
    if (
      !element.classList.contains("set-display-none") &&
      !element.parentNode.classList.contains("set-display-none")
    ) {
      if (element.type === "checkbox") {
        options[element.id] = element.checked;
      } else {
        options[element.id] = element.value;
      }
    }
  }

  const selects = root.getElementsByTagName("select");
  for (let index = 0; index < selects.length; index++) {
    const element = selects[index];
    if (
      !element.classList.contains("set-display-none") &&
      !element.parentNode.classList.contains("set-display-none")
    ) {
      options[element.id] = element.value;
    }
  }

  return options;
}

export function restoreOptions(rootElement, options) {
  const inputs = rootElement.getElementsByTagName("input");
  for (let index = 0; index < inputs.length; index++) {
    const element = inputs[index];
    const id = element.id;
    if (options.hasOwnProperty(id)) {
      if (options[id] !== null) {
        if (element.type === "checkbox") {
          element.checked = options[id];
        } else {
          if (element.value != options[id]) {
            console.log(id + " changed");
          }
          element.value = options[id];
        }
      }
    }
  }

  const selects = rootElement.getElementsByTagName("select");
  for (let index = 0; index < selects.length; index++) {
    const element = selects[index];
    const id = element.id;
    if (options.hasOwnProperty(id)) {
      if (options[id] !== null) {
        element.value = options[id];
      }
    }
  }
}
