/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import {
  on,
  sendIpcToMain,
  getCurrentImgBuffers,
  showNoBookContent,
} from "../renderer.js";
import { renderImageBuffers, setScrollBarsPosition } from "./ui.js";

export function initIpc() {
  initHandlers();
}

let g_textColor = "black";
let g_bgColor = "white";

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function initHandlers() {
  // COMIC
  on("refresh-epub-comic-page", (rotation) => {
    if (getCurrentImgBuffers())
      renderImageBuffers(
        getCurrentImgBuffers(),
        rotation,
        undefined,
        false,
        true,
      );
  });
}
