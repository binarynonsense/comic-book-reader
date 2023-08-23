/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fileFormats = require("./file-formats");
//const palette = require("../extract-palette/palette");
const { FileExtension, FileDataType } = require("./constants");

process.on("message", (message) => {
  if (message[0] === "extract") {
    extractImages(...message.slice(1));
  } else if (message[0] === "create") {
    createFile(...message.slice(1));
  }
});

async function extractImages(
  inputFilePath,
  inputFileType,
  tempFolderPath,
  password
) {
  try {
    let success = false;
    if (inputFileType === FileDataType.ZIP) {
      success = fileFormats.extractZip(inputFilePath, tempFolderPath, password);
    } else if (inputFileType === FileDataType.RAR) {
      success = await fileFormats.extractRar(
        inputFilePath,
        tempFolderPath,
        password
      );
    } else if (inputFileType === FileDataType.SEVENZIP) {
      success = await fileFormats.extract7Zip(
        inputFilePath,
        tempFolderPath,
        password
      );
    } else if (inputFileType === FileDataType.EPUB_COMIC) {
      success = await fileFormats.extractEpub(inputFilePath, tempFolderPath);
    } else {
      process.send("conversionExtractImages: invalid file type");
      return;
    }
    if (success) process.send("success");
    else throw "error";
  } catch (error) {
    process.send("conversionExtractImages: couldnt extract the file");
  }
}

async function createFile(
  imgFilePaths,
  comicInfoFilePath,
  outputFormat,
  outputFilePath,
  tempFolderPath,
  extra
) {
  try {
    if (outputFormat === FileExtension.PDF) {
      // TODO: doesn't work in the worker, why?
      //await fileFormats.createPdf(imgFilePaths, outputFilePath, method);
      process.send("ERROR: can't create a pdf in the worker");
    } else if (outputFormat === FileExtension.EPUB) {
      await fileFormats.createEpub(
        imgFilePaths,
        outputFilePath,
        tempFolderPath,
        extra
      );
    } else if (outputFormat === FileExtension.CB7) {
      if (comicInfoFilePath) imgFilePaths.push(comicInfoFilePath);
      await fileFormats.create7Zip(imgFilePaths, outputFilePath);
    } else if (outputFormat === FileExtension.CBR) {
      if (comicInfoFilePath) imgFilePaths.push(comicInfoFilePath);
      if (
        !fileFormats.createRar(
          imgFilePaths,
          outputFilePath,
          extra.rarExePath,
          extra.workingDir,
          extra.password
        )
      )
        throw "error creating rar";
    } else {
      //cbz
      if (comicInfoFilePath) imgFilePaths.push(comicInfoFilePath);
      fileFormats.createZip(imgFilePaths, outputFilePath);
    }
    process.send("success");
  } catch (err) {
    process.send(err);
  }
}
