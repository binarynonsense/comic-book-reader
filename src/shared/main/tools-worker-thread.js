/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { parentPort } = require("worker_threads");
const { processImage } = require("./tools-process-image");

parentPort.on("message", async (message) => {
  // parentPort.postMessage({
  //   type: "test-log",
  //   text: message.type,
  // });
  if (message.type === "shutdown") {
    process.exit(0);
  } else if (message.type === "process") {
    try {
      const result = await processImage(
        message.filePath,
        message.resizeNeeded,
        message.imageOpsNeeded,
        message.uiOptions,
      );
      parentPort.postMessage({
        type: "done",
        id: message.id,
        filePath: result.filePath,
      });
    } catch (error) {
      parentPort.postMessage({
        type: "error",
        id: message.id,
        error: error.message,
      });
    }
  }
});
