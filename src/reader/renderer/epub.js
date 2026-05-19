/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { on, getCurrentImgBuffers } from "../renderer.js";
import { renderImageBuffers } from "./ui.js";

export function initIpc() {
  initHandlers();
}

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
