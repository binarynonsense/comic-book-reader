/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// generic
export * from "./modal-loading-bar.js";
export * from "./modal-info.js";
// custom
export * from "./modal-komga-login.js";

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

export const Level = {
  APP: "app",
  TOOLS: "tools",
  READER: "reader",
};

export function getLevelZIndex(level) {
  switch (level) {
    case Level.APP:
      return 510;

    case Level.TOOLS:
      return 505;

    case Level.READER:
    default:
      return 50;
  }
}

export function close(modal) {
  if (modal) modal.remove();
}

// export function addActionButtons(modal, buttonsData) {
//   const buttonsDiv = modal.querySelector(".modal-buttons");
//   buttonsData.forEach((buttonData) => {
//     const buttonDiv = document.createElement("button");
//     buttonDiv.addEventListener("click", (event) => {
//       if (!buttonData.dontClose) close(modal);
//       if (buttonData.callback)
//         buttonData.callback(
//           event == undefined || event.pointerType !== "mouse",
//           inputElement.value,
//         );
//     });
//     if (buttonData.key && typeof buttonData.key === "string") {
//       buttonDiv.setAttribute("data-key", buttonData.key);
//     }
//     if (buttonData.fullWidth) {
//       buttonDiv.style.width = "100%";
//       buttonsDiv.classList.add("set-flex-direction-column");
//     }
//     if (buttonData.id && typeof buttonData.id === "string") {
//       buttonDiv.id = buttonData.id;
//     }
//   });
// }
