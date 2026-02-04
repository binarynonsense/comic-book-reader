/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");
const fileUtils = require("./file-utils");
const { FileExtension } = require("./constants");

exports.processImages = async function ({
  imgFilePaths,
  resizeNeeded,
  imageOpsNeeded,
  updateModalLogText,
  modalInfoText,
  uiSelectedOptions,
  getCancel,
}) {
  try {
    const sharp = require("sharp");
    sharp.concurrency(0);
    sharp.cache(false);
    for (let index = 0; index < imgFilePaths.length; index++) {
      if (getCancel()) {
        return { state: "cancelled" };
      }
      updateModalLogText(
        modalInfoText + ": " + (index + 1) + " / " + imgFilePaths.length,
      );
      const result = await processImage(
        imgFilePaths[index],
        resizeNeeded,
        imageOpsNeeded,
        uiSelectedOptions,
      );
      imgFilePaths[index] = result.filePath;
    } // end for
    return { state: "success" };
  } catch (error) {
    return { state: "error", error };
  }
};

exports.processImagesWithWorkers = async function ({
  imgFilePaths,
  resizeNeeded,
  imageOpsNeeded,
  updateModalLogText,
  modalInfoText,
  uiSelectedOptions,
  getCancel,
}) {
  return new Promise((resolve) => {
    const { Worker } = require("worker_threads");

    // process.env.UV_THREADPOOL_SIZE = os.cpus().length;

    let maxWorkers = parseInt(uiSelectedOptions.imageProcessingNumWorkers);
    if (!maxWorkers || maxWorkers <= 0)
      maxWorkers = Math.max(1, Math.floor(os.cpus().length / 2));
    let sharpConcurrency = parseInt(
      uiSelectedOptions.imageProcessingSharpConcurrency,
    );

    if (!sharpConcurrency || sharpConcurrency < 0) sharpConcurrency = 1;
    const sharp = require("sharp");
    sharp.concurrency(sharpConcurrency);
    sharp.cache(false);

    const workers = [];
    const workQueue = imgFilePaths.map((filePath, index) => ({
      id: index,
      filePath,
    }));

    let activeWorkers = 0;
    let error = undefined;

    for (let i = 0; i < maxWorkers; i++) {
      const worker = new Worker(
        path.join(__dirname, "../../shared/main/tools-worker-thread.js"),
      );
      worker.on("message", (message) => {
        if (message.type === "test-log") {
          log.test(message.text);
        } else if (message.type === "done") {
          activeWorkers--;
          // refresh filePath in case it was changed due to format conversion
          imgFilePaths[message.id] = message.filePath;
        } else if (message.type === "error") {
          error = `[WORKER] error on image #${message.id + 1}: ${message.error}`;
          activeWorkers--;
        }
        if (!getCancel() && !error) processNextImage(worker);
        checkForCompletion();
      });
      worker.on("error", (error) => {
        error = "[WORKER] " + error;
        activeWorkers--;
        checkForCompletion();
      });
      worker.on("exit", (code) => {
        // log.editor(`[CC] worker #${i} exited with code: ${code}`);
      });
      workers.push(worker);
      processNextImage(worker);
    }

    ///////

    function processNextImage(worker) {
      if (getCancel() || workQueue.length === 0) return;
      const job = workQueue.shift();
      activeWorkers++;
      updateModalLogText(
        modalInfoText + ": " + (job.id + 1) + " / " + imgFilePaths.length,
      );
      worker.postMessage({
        type: "process",
        id: job.id,
        filePath: job.filePath,
        resizeNeeded,
        imageOpsNeeded,
        uiOptions: uiSelectedOptions,
      });
    }

    function checkForCompletion() {
      if (
        activeWorkers === 0 &&
        (workQueue.length === 0 || getCancel() || error)
      ) {
        shutdownAllWorkers();
        resolve({
          state: error ? "error" : getCancel() ? "cancelled" : "success",
          error,
        });
      }
    }

    function shutdownAllWorkers() {
      workers.forEach((worker) => worker.postMessage({ type: "shutdown" }));
    }
  });
};

async function processImage(
  filePath,
  resizeNeeded,
  imageOpsNeeded,
  uiSelectedOptions,
) {
  const sharp = require("sharp");
  ///////////////////////////////////////
  ///////////////////////////////////////
  let fileFolderPath = path.dirname(filePath);
  let fileName = path.basename(filePath, path.extname(filePath));
  let tmpFilePath = path.join(
    fileFolderPath,
    fileName + "." + FileExtension.TMP,
  );
  let pipeline;
  let saveToFile = false;
  let newFilePath = filePath;

  let metadata;

  // IMAGE OPS 1 /////////////////////////////////////////////
  if (imageOpsNeeded) {
    if (!pipeline) pipeline = sharp(filePath);
    if (
      uiSelectedOptions.outputCropApply &&
      uiSelectedOptions.outputCropValue > 0
    ) {
      let value = parseInt(uiSelectedOptions.outputCropValue);
      if (value) {
        if (!metadata) metadata = await sharp(filePath).metadata();
        let newWidth = metadata.width - value * 2;
        let newHeight = metadata.height - value * 2;
        if (newHeight > 0 && newHeight > 0) {
          pipeline.extract({
            left: value,
            top: value,
            width: newWidth,
            height: newHeight,
          });
          metadata.width = newWidth;
          metadata.height = newHeight;
          saveToFile = true;
        }
      }
    }
  }
  // RESIZE /////////////////////////////////////////////////
  if (resizeNeeded) {
    saveToFile = true;
    if (!pipeline) pipeline = sharp(filePath);
    if (uiSelectedOptions.outputImageScaleOption === "1") {
      pipeline.resize({
        height: parseInt(uiSelectedOptions.outputImageScaleHeight),
        withoutEnlargement: true,
      });
    } else if (uiSelectedOptions.outputImageScaleOption === "2") {
      pipeline.resize({
        width: parseInt(uiSelectedOptions.outputImageScaleWidth),
        withoutEnlargement: true,
      });
    } else {
      // scale
      if (!metadata) metadata = await sharp(filePath).metadata();
      pipeline.resize(
        Math.round(
          metadata.width * (uiSelectedOptions.outputImageScalePercentage / 100),
        ),
      );
    }
  }
  // IMAGE OPS 2 /////////////////////////////////////////////
  if (imageOpsNeeded) {
    if (!pipeline) pipeline = sharp(filePath);
    let ops;
    if (uiSelectedOptions.outputBrightnessApply) {
      if (!ops) ops = {};
      let value = parseFloat(uiSelectedOptions.outputBrightnessMultiplier);
      if (value <= 0) value = 0.1;
      ops["brightness"] = value;
      saveToFile = true;
    }
    if (uiSelectedOptions.outputSaturationApply) {
      if (!ops) ops = {};
      let value = parseFloat(uiSelectedOptions.outputSaturationMultiplier);
      if (value <= 0) value = 0.001;
      ops["saturation"] = value;
      saveToFile = true;
    }
    if (ops) pipeline.modulate(ops);
    //
    if (
      uiSelectedOptions.outputExtendApply &&
      uiSelectedOptions.outputExtendValue > 0
    ) {
      let value = parseInt(uiSelectedOptions.outputExtendValue);
      if (value) {
        pipeline.extend({
          top: value,
          bottom: value,
          left: value,
          right: value,
          background: uiSelectedOptions.outputExtendColor,
        });
        saveToFile = true;
      }
    }
  }
  // CHANGE FORMAT /////////////////////////////////////////////
  if (
    uiSelectedOptions.outputFormat === FileExtension.PDF ||
    uiSelectedOptions.outputFormat === FileExtension.EPUB ||
    uiSelectedOptions.outputImageFormat != FileExtension.NOT_SET
  ) {
    let imageFormat = uiSelectedOptions.outputImageFormat;
    if (uiSelectedOptions.outputFormat === FileExtension.PDF) {
      // change to a format compatible with pdfkit if needed
      if (
        imageFormat === FileExtension.WEBP ||
        imageFormat === FileExtension.AVIF ||
        (imageFormat === FileExtension.NOT_SET &&
          !fileUtils.hasPdfKitCompatibleImageExtension(filePath))
      ) {
        imageFormat = FileExtension.JPG;
      }
    }
    if (
      uiSelectedOptions.outputFormat === FileExtension.EPUB &&
      uiSelectedOptions.outputEpubCreationImageFormat ===
        "core-media-types-only"
    ) {
      // change to a format supported by the epub specification if needed
      if (
        imageFormat === FileExtension.WEBP ||
        imageFormat === FileExtension.AVIF ||
        (imageFormat === FileExtension.NOT_SET &&
          !fileUtils.hasEpubSupportedImageExtension(filePath))
      ) {
        imageFormat = FileExtension.JPG;
      }
    }
    if (imageFormat != FileExtension.NOT_SET) {
      saveToFile = true;
      if (!pipeline) pipeline = sharp(filePath);
      if (imageFormat === FileExtension.JPG) {
        pipeline.jpeg({
          quality: parseInt(
            uiSelectedOptions.outputImageFormatParams.jpgQuality,
          ),
          mozjpeg: uiSelectedOptions.outputImageFormatParams.jpgMozjpeg,
        });
      } else if (imageFormat === FileExtension.PNG) {
        if (
          parseInt(uiSelectedOptions.outputImageFormatParams.pngQuality) < 100
        ) {
          pipeline.png({
            quality: parseInt(
              uiSelectedOptions.outputImageFormatParams.pngQuality,
            ),
          });
        } else {
          pipeline.png();
        }
      } else if (imageFormat === FileExtension.WEBP) {
        pipeline.webp({
          quality: parseInt(
            uiSelectedOptions.outputImageFormatParams.webpQuality,
          ),
        });
      } else if (imageFormat === FileExtension.AVIF) {
        pipeline.avif({
          quality: parseInt(
            uiSelectedOptions.outputImageFormatParams.avifQuality,
          ),
        });
      }
      newFilePath = path.join(fileFolderPath, fileName + "." + imageFormat);
    }
  }
  // SAVE TO FILE ///////////////////////////////////////////
  if (saveToFile && pipeline) {
    await pipeline.withMetadata().toFile(tmpFilePath);
    fs.unlinkSync(filePath);
    fileUtils.moveFile(tmpFilePath, newFilePath);
  }
  return { filePath: newFilePath };
}
exports.processImage = processImage;
