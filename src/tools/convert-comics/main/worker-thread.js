/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { parentPort } = require("worker_threads");
const { processImage } = require("./process-image");

parentPort.on("message", async (msg) => {
  if (msg.type === "shutdown") {
    process.exit(0);
  } else if (msg.type === "process") {
    try {
      const result = await processImage(
        msg.filePath,
        msg.resizeNeeded,
        msg.imageOpsNeeded,
        msg.uiOptions
      );
      parentPort.postMessage({
        type: "done",
        id: msg.id,
        filePath: result.filePath,
      });
    } catch (error) {
      parentPort.postMessage({
        type: "error",
        id: msg.id,
        error: error.message,
      });
    }
  }
});
