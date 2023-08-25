/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const fileFormats = require("./file-formats");
const { FileExtension, FileDataType } = require("./constants");
const utils = require("./utils");
const fileUtils = require("./file-utils");

process.on("message", (message) => {
  if (message[0] === "extract") {
    extractImages(...message.slice(1));
  } else if (message[0] === "create") {
    createFiles(...message.slice(1));
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

async function createFiles(
  baseFileName,
  outputFolderPath,
  outputSplitNumFiles,
  imgFilePaths,
  comicInfoFilePath,
  outputFormat,
  tempFolderPath,
  password,
  extra
) {
  let outputSubFolderPath;
  try {
    let createdFiles = [];
    let filesData = [];
    outputSplitNumFiles = parseInt(outputSplitNumFiles);
    if (
      !outputSplitNumFiles ||
      !Number.isInteger(outputSplitNumFiles) ||
      outputSplitNumFiles < 1
    ) {
      outputSplitNumFiles = 1;
    }
    if (outputSplitNumFiles <= 1) {
      // just one file in the output folder
      let outputFilePath = path.join(
        outputFolderPath,
        baseFileName + "." + outputFormat
      );
      let i = 1;
      while (fs.existsSync(outputFilePath)) {
        i++;
        outputFilePath = path.join(
          outputFolderPath,
          baseFileName + " (" + i + ")." + outputFormat
        );
      }
      filesData.push({
        imgFilePaths: imgFilePaths,
        outputFilePath: outputFilePath,
      });
    } else {
      // multiple files in a subfolder in the output folder
      const subArrays = utils.splitArray(imgFilePaths, outputSplitNumFiles);
      outputSubFolderPath = path.join(outputFolderPath, baseFileName);
      let i = 1;
      while (fs.existsSync(outputSubFolderPath)) {
        i++;
        outputSubFolderPath = path.join(
          outputFolderPath,
          baseFileName + " (" + i + ")"
        );
      }
      for (let index = 0; index < subArrays.length; index++) {
        let outputFilePath = path.join(
          tempFolderPath,
          `${baseFileName} (${index + 1}_${subArrays.length}).${outputFormat}`
        );
        filesData.push({
          imgFilePaths: subArrays[index],
          outputFilePath: outputFilePath,
        });
      }
    }
    /////////////////////////////
    for (let index = 0; index < filesData.length; index++) {
      if (outputFormat === FileExtension.PDF) {
        await fileFormats.createPdf(
          filesData[index].imgFilePaths,
          filesData[index].outputFilePath,
          extra,
          password
        );
      } else if (outputFormat === FileExtension.EPUB) {
        await fileFormats.createEpub(
          filesData[index].imgFilePaths,
          filesData[index].outputFilePath,
          tempFolderPath,
          extra
        );
      } else if (outputFormat === FileExtension.CB7) {
        if (comicInfoFilePath)
          filesData[index].imgFilePaths.push(comicInfoFilePath);
        await fileFormats.create7Zip(
          filesData[index].imgFilePaths,
          filesData[index].outputFilePath,
          password
        );
      } else if (outputFormat === FileExtension.CBR) {
        if (comicInfoFilePath)
          filesData[index].imgFilePaths.push(comicInfoFilePath);
        if (
          !fileFormats.createRar(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath,
            extra.rarExePath,
            extra.workingDir,
            password
          )
        )
          throw "error creating rar";
      } else {
        //cbz
        if (comicInfoFilePath)
          filesData[index].imgFilePaths.push(comicInfoFilePath);
        if (password && password.trim() !== "") {
          console.log("7zip");
          await fileFormats.create7Zip(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath,
            password,
            "zip"
          );
        } else {
          console.log("AdmZip");
          fileFormats.createZip(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath
          );
        }
      }
    }
    /////////////////////////////
    // created, move from temp to folder if multiple
    if (outputSubFolderPath)
      fs.mkdirSync(outputSubFolderPath, { recursive: true });
    for (let index = 0; index < filesData.length; index++) {
      if (outputSubFolderPath) {
        const tempFilePath = filesData[index].outputFilePath;
        let fileName = path.basename(tempFilePath);
        filesData[index].outputFilePath = path.join(
          outputSubFolderPath,
          fileName
        );
        fileUtils.moveFile(tempFilePath, filesData[index].outputFilePath);
      }
      createdFiles.push(filesData[index].outputFilePath);
    }
    /////////////////////////////
    process.send(["success", createdFiles]);
  } catch (error) {
    // TODO: remove outputSubFolderPath if exists?
    // I'd prefer not to delete things outside the temp folder, just in case
    process.send([error.message]);
  }
}
