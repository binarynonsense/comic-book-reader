/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const fileUtils = require("../../../shared/main/file-utils");
const { FileExtension } = require("../../../shared/main/constants");

exports.processImage = async function (
  filePath,
  resizeNeeded,
  imageOpsNeeded,
  uiSelectedOptions
) {
  const sharp = require("sharp");
  ///////////////////////////////////////
  ///////////////////////////////////////
  let fileFolderPath = path.dirname(filePath);
  let fileName = path.basename(filePath, path.extname(filePath));
  let tmpFilePath = path.join(
    fileFolderPath,
    fileName + "." + FileExtension.TMP
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
          metadata.width * (uiSelectedOptions.outputImageScalePercentage / 100)
        )
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
            uiSelectedOptions.outputImageFormatParams.jpgQuality
          ),
          mozjpeg: uiSelectedOptions.outputImageFormatParams.jpgMozjpeg,
        });
      } else if (imageFormat === FileExtension.PNG) {
        if (
          parseInt(uiSelectedOptions.outputImageFormatParams.pngQuality) < 100
        ) {
          pipeline.png({
            quality: parseInt(
              uiSelectedOptions.outputImageFormatParams.pngQuality
            ),
          });
        } else {
          pipeline.png();
        }
      } else if (imageFormat === FileExtension.WEBP) {
        pipeline.webp({
          quality: parseInt(
            uiSelectedOptions.outputImageFormatParams.webpQuality
          ),
        });
      } else if (imageFormat === FileExtension.AVIF) {
        pipeline.avif({
          quality: parseInt(
            uiSelectedOptions.outputImageFormatParams.avifQuality
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
};
