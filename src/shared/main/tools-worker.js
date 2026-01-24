/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const fileFormats = require("./file-formats");
const { FileExtension, FileDataType } = require("./constants");
const utils = require("./utils");
const fileUtils = require("./file-utils");

let g_useUtilityProcess = false;

process.on("message", (message) => {
  g_useUtilityProcess = false;
  if (message[1] === "extract") {
    extractImages(...message.slice(2));
  } else if (message[1] === "create") {
    createFiles(...message.slice(2));
  }
});

process.parentPort?.once("message", async (event) => {
  g_useUtilityProcess = true;
  let message = event.data;
  if (message[1] === "extract") {
    extractImages(...message.slice(2));
  } else if (message[1] === "create") {
    createFiles(...message.slice(2));
  }
});

async function extractImages(
  inputFilePath,
  inputFileType,
  tempFolderPath,
  password,
  extraData,
) {
  const timers = require("./timers");
  timers.start("extractImages");
  try {
    let success = false;
    let result = undefined;
    if (inputFileType === FileDataType.ZIP) {
      // success = fileFormats.extractZip(inputFilePath, tempFolderPath, password);
      result = await fileFormats.extract7Zip(
        inputFilePath,
        tempFolderPath,
        password,
        "zip",
      );
    } else if (inputFileType === FileDataType.RAR) {
      result = await fileFormats.extractRar(
        inputFilePath,
        tempFolderPath,
        password,
      );
    } else if (inputFileType === FileDataType.SEVENZIP) {
      result = await fileFormats.extract7Zip(
        inputFilePath,
        tempFolderPath,
        password,
      );
    } else if (inputFileType === FileDataType.EPUB_COMIC) {
      // TODO: get success and error
      success = await fileFormats.extractEpub(inputFilePath, tempFolderPath);
    } else if (inputFileType === FileDataType.PDF) {
      result = await fileFormats.extractPdf(
        inputFilePath,
        tempFolderPath,
        password,
        extraData?.pdfExtractionMethod ?? "embedded",
        send,
      );
    } else {
      send("conversionExtractImages: invalid file type");
      return;
    }
    let time = `${timers.stop("extractImages").toFixed(2)}s`;
    if (result) {
      if (result.success) {
        send({ success: true, time: time });
      } else {
        if (result.error) {
          throw result.error;
        } else throw "Unknown error";
      }
    } else {
      // TODO: get errors from all extraction functions
      // TODO: eventually delete this path
      if (success) {
        send({ success: true, time: time });
      } else {
        if (error) {
          throw error;
        } else throw "Unknown error";
      }
    }
  } catch (error) {
    timers.stop("extractImages").toFixed(2);
    send({
      success: false,
      error: error,
    });
  }
}

async function createFiles(
  baseFileName,
  outputFolderPath,
  outputSplitNumFiles,
  imgFilePaths,
  comicInfoFilePath,
  outputFormat,
  outputFileSameName,
  tempFolderPath,
  password,
  extra,
) {
  let outputSubFolderPath;
  if (outputFormat === undefined) outputFormat = FileExtension.CBZ;
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
        baseFileName + "." + outputFormat,
      );

      if (fs.existsSync(outputFilePath)) {
        if (outputFileSameName === "rename") {
          let i = 1;
          while (fs.existsSync(outputFilePath)) {
            i++;
            outputFilePath = path.join(
              outputFolderPath,
              baseFileName + " (" + i + ")." + outputFormat,
            );
          }
        } else if (outputFileSameName === "skip") {
          // skip
          // shouldn't be here
          throw "file already exists";
        }
      }
      filesData.push({
        imgFilePaths: imgFilePaths,
        outputFilePath: outputFilePath,
      });
    } else {
      // multiple files in a subfolder in the output folder
      const subArrays = utils.splitArray(imgFilePaths, outputSplitNumFiles);
      outputSubFolderPath = path.join(outputFolderPath, baseFileName);

      if (fs.existsSync(outputSubFolderPath)) {
        if (outputFileSameName == "rename") {
          let i = 1;
          while (fs.existsSync(outputSubFolderPath)) {
            i++;
            outputSubFolderPath = path.join(
              outputFolderPath,
              baseFileName + " (" + i + ")",
            );
          }
        } else if (outputFileSameName == "skip") {
          // skip
          // shouldn't be here
          throw "file already exists";
        }
      }

      for (let index = 0; index < subArrays.length; index++) {
        let outputFilePath = path.join(
          tempFolderPath,
          `${baseFileName} (${index + 1}_${subArrays.length}).${outputFormat}`,
        );
        filesData.push({
          imgFilePaths: subArrays[index],
          outputFilePath: outputFilePath,
        });
      }
    }
    /////////////////////////////
    const timers = require("./timers");
    let times = [];
    for (let index = 0; index < filesData.length; index++) {
      timers.start("createFile");
      try {
        if (outputFormat === FileExtension.PDF) {
          await fileFormats.createPdf(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath,
            extra,
            password,
          );
        } else if (outputFormat === FileExtension.EPUB) {
          await fileFormats.createEpub(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath,
            tempFolderPath,
            extra,
          );
        } else if (outputFormat === FileExtension.CB7) {
          if (comicInfoFilePath)
            filesData[index].imgFilePaths.push(comicInfoFilePath);
          await fileFormats.create7Zip(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath,
            password,
            tempFolderPath,
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
              password,
            )
          )
            throw "error creating rar";
        } else {
          //cbz
          if (comicInfoFilePath)
            filesData[index].imgFilePaths.push(comicInfoFilePath);
          // if (password && password.trim() !== "") {
          //   await fileFormats.create7Zip(
          //     filesData[index].imgFilePaths,
          //     filesData[index].outputFilePath,
          //     password,
          //     "zip"
          //   );
          // } else {
          //   fileFormats.createZip(
          //     filesData[index].imgFilePaths,
          //     filesData[index].outputFilePath
          //   );
          // }
          await fileFormats.create7Zip(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath,
            password,
            tempFolderPath,
            "zip",
          );
        }
        times.push(`${timers.stop("createFile").toFixed(2)}s`);
      } catch (error) {
        timers.stop("createFile").toFixed(2);
        throw error;
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
          fileName,
        );
        if (fs.existsSync(filesData[index].outputFilePath)) {
          if (outputFileSameName != "overwrite") {
            // skip or unused
            // shouldn't be here
            throw "file already exists";
          }
        }
        fileUtils.moveFile(tempFilePath, filesData[index].outputFilePath);
      }
      createdFiles.push(filesData[index].outputFilePath);
    }
    /////////////////////////////
    send({ success: true, files: createdFiles, times: times });
  } catch (error) {
    // TODO: remove outputSubFolderPath if exists?
    // I'd prefer not to delete things outside the temp folder, just in case
    send({ success: false, error: error });
  }
}

function send(message) {
  if (g_useUtilityProcess) {
    process.parentPort.postMessage(message);
  } else {
    process.send(message);
  }
}
