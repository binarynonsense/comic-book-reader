/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

///////////////////////////////////////////////////////////////////////////////
// WORKER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

require("./env-utils").setSafeEnvironment("[TOOLS WORKER] ", send);

const fs = require("node:fs");
const path = require("node:path");
const fileFormats = require("./file-formats");
const { FileExtension, FileDataType } = require("./constants");
const utils = require("./utils");
const fileUtils = require("./file-utils");

// const controller = new AbortController();
// const { signal } = controller;

let g_cancel;

process.parentPort.on("message", async (event) => {
  let message = event.data;
  send({
    type: "editorLog",
    log: `[tools worker] message received: ${message[1]}`,
  });
  if (message[1] === "extract") {
    extractImages(...message.slice(2));
  } else if (message[1] === "create") {
    createFiles(...message.slice(2));
  } else if (message[1] === "process-images") {
    g_cancel = false;
    processImages(...message.slice(2));
  } else if (message[1] === "images-tool-work") {
    g_cancel = false;
    doImagesToolWork(...message.slice(2));
  } else if (message[1] === "update-comicinfo") {
    updateComicInfo(...message.slice(2));
  } else if (message[1] === "update-comicinfo-data") {
    updateComicInfoData(...message.slice(2));
  } else if (message[1] === "cancel") {
    g_cancel = true;
    // controller.abort();
    fileFormats.stopMuPdfExtraction();
    fileFormats.stopMuEpubExtraction();
    fileFormats.stop7zExtraction();
  }
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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
      // result = await fileFormats.extractRar(
      //   inputFilePath,
      //   tempFolderPath,
      //   password,
      // );
      result = await fileFormats.extract7Zip(
        inputFilePath,
        tempFolderPath,
        password,
        "rar",
      );
    } else if (inputFileType === FileDataType.SEVENZIP) {
      result = await fileFormats.extract7Zip(
        inputFilePath,
        tempFolderPath,
        password,
      );
    } else if (inputFileType === FileDataType.EPUB_COMIC) {
      result = await fileFormats.extractEpub(inputFilePath, tempFolderPath);
    } else if (
      inputFileType === FileDataType.EPUB_EBOOK ||
      inputFileType === FileDataType.AZW3 ||
      inputFileType === FileDataType.MOBI ||
      inputFileType === FileDataType.FB2
    ) {
      result = await fileFormats.extractMuEpub(
        inputFileType === FileDataType.AZW3 ||
          inputFileType === FileDataType.MOBI,
        inputFilePath,
        tempFolderPath,
        extraData,
        send,
      );
    } else if (inputFileType === FileDataType.PDF) {
      // result = await fileFormats.extractPdf(
      //   inputFilePath,
      //   tempFolderPath,
      //   password,
      //   extraData,
      //   send,
      //   signal,
      // );
      result = await fileFormats.extractMuPdf(
        inputFilePath,
        tempFolderPath,
        password,
        extraData,
        send,
      );
    } else {
      throw "invalid file type";
    }
    let time = `${timers.stop("extractImages").toFixed(2)}s`;
    if (result) {
      if (result.success) {
        send({ success: true, time: time });
      } else if (result.cancelled) {
        send({ success: false, cancelled: true });
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
        throw "Unknown error";
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

///////////////////////////////////////////////////////////////////////////////

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
          const cmdResult = await fileFormats.createRar(
            filesData[index].imgFilePaths,
            filesData[index].outputFilePath,
            extra.rarExePath,
            extra.workingDir,
            password,
          );
          if (cmdResult.error) {
            throw "error creating rar: " + cmdResult.stderr;
          }
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

///////////////////////////////////////////////////////////////////////////////

async function processImages(
  imgFilePaths,
  resizeNeeded,
  imageOpsNeeded,
  modalInfoText,
  uiSelectedOptions,
) {
  try {
    const {
      processImages,
      processImagesWithWorkers,
    } = require("./tools-process-images");

    let result;
    switch (parseInt(uiSelectedOptions.imageProcessingMultithreadingMethod)) {
      case 1:
        result = await processImages({
          imgFilePaths,
          resizeNeeded,
          imageOpsNeeded,
          updateModalLogText,
          modalInfoText,
          uiSelectedOptions,
          getCancel: () => {
            return g_cancel;
          },
        });
        break;
      default:
        result = await processImagesWithWorkers({
          imgFilePaths,
          resizeNeeded,
          imageOpsNeeded,
          updateModalLogText,
          modalInfoText,
          uiSelectedOptions,
          getCancel: () => {
            return g_cancel;
          },
        });
        break;
    }
    if (result.state === "error") {
      throw result.error;
    } else {
      send({ success: true, state: result.state, imgFilePaths });
    }
  } catch (error) {
    send({
      success: false,
      error: error,
    });
  }
}

///////////////////////////////////////////////////////////////////////////////

async function updateComicInfo(comicInfoFilePath, imgFilePaths, updatingText) {
  try {
    const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser");
    const xmlFileData = fs.readFileSync(comicInfoFilePath, "utf8");
    const isValidXml = XMLValidator.validate(xmlFileData);
    if (isValidXml === true) {
      // open
      const parserOptions = {
        ignoreAttributes: false,
      };
      const parser = new XMLParser(parserOptions);
      let json = parser.parse(xmlFileData);
      // modify
      updateModalLogText(updatingText);

      if (!json["ComicInfo"]["Pages"]) {
        json["ComicInfo"]["Pages"] = {};
      }
      if (!json["ComicInfo"]["Pages"]["Page"]) {
        json["ComicInfo"]["Pages"]["Page"] = [];
      }

      json["ComicInfo"]["PageCount"] = imgFilePaths.length;
      let oldPagesArray = json["ComicInfo"]["Pages"]["Page"].slice();
      json["ComicInfo"]["Pages"]["Page"] = [];
      for (let index = 0; index < imgFilePaths.length; index++) {
        let pageData = {
          "@_Image": "",
          "@_ImageSize": "",
          "@_ImageWidth": "",
          "@_ImageHeight": "",
        };
        if (oldPagesArray.length > index) {
          pageData = oldPagesArray[index];
        }
        let filePath = imgFilePaths[index];
        pageData["@_Image"] = index;
        let fileStats = fs.statSync(filePath);
        let fileSizeInBytes = fileStats.size;
        pageData["@_ImageSize"] = fileSizeInBytes;
        const sharp = require("sharp");
        const metadata = await sharp(filePath).metadata();
        pageData["@_ImageWidth"] = metadata.width;
        pageData["@_ImageHeight"] = metadata.height;
        json["ComicInfo"]["Pages"]["Page"].push(pageData);
      }
      // rebuild
      const builderOptions = {
        ignoreAttributes: false,
        format: true,
        suppressBooleanAttributes: false, // keek booleans like ="true"
      };
      const builder = new XMLBuilder(builderOptions);
      let outputXmlData = builder.build(json);
      fs.writeFileSync(comicInfoFilePath, outputXmlData);

      send({ success: true });
    } else {
      throw "ComicInfo.xml is not a valid xml file";
    }
  } catch (error) {
    send({
      success: false,
      error: error,
    });
  }
}

///////////////////////////////////////////////////////////////////////////////

async function updateComicInfoData(data, tempFolderPath) {
  try {
    const sharp = require("sharp");
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    imgFilePaths.sort(utils.compare);

    if (!data["ComicInfo"]["Pages"]) {
      data["ComicInfo"]["Pages"] = {};
    }
    if (!data["ComicInfo"]["Pages"]["Page"]) {
      data["ComicInfo"]["Pages"]["Page"] = [];
    }
    let oldPagesArray = data["ComicInfo"]["Pages"]["Page"].slice();
    data["ComicInfo"]["Pages"]["Page"] = [];
    for (let index = 0; index < imgFilePaths.length; index++) {
      let pageData = {
        "@_Image": "",
        "@_ImageSize": "",
        "@_ImageWidth": "",
        "@_ImageHeight": "",
      };
      if (oldPagesArray.length > index) {
        pageData = oldPagesArray[index];
      }
      let filePath = imgFilePaths[index];
      pageData["@_Image"] = index;
      let fileStats = fs.statSync(filePath);
      let fileSizeInBytes = fileStats.size;
      pageData["@_ImageSize"] = fileSizeInBytes;
      const metadata = await sharp(filePath).metadata();
      pageData["@_ImageWidth"] = metadata.width;
      pageData["@_ImageHeight"] = metadata.height;
      data["ComicInfo"]["Pages"]["Page"].push(pageData);
    }
    send({ success: true, data });
  } catch (error) {
    send({
      success: false,
      error: error,
    });
  }
}

///////////////////////////////////////////////////////////////////////////////

async function doImagesToolWork(
  imgFiles,
  tempSubFolderPath,
  uiSelectedOptions,
  convertingImageText,
  extractingToText,
) {
  let numAttempts = 0;
  let numErrors = 0;
  let failedFilePaths = [];

  try {
    const { processImage } = require("./tools-process-images");
    const sharp = require("sharp");
    sharp.concurrency(0);
    // avoid EBUSY error on windows
    sharp.cache(false);

    let outputFolderPath = uiSelectedOptions.outputFolderPath;
    let outputFormat = uiSelectedOptions.outputImageFormat;
    uiSelectedOptions.outputFormat === FileExtension.NOT_SET;

    for (let index = 0; index < imgFiles.length; index++) {
      updateModalLogText("");
      numAttempts++;
      let originalFilePath;
      try {
        originalFilePath = imgFiles[index].path;
        updateModalLogText(convertingImageText + ": " + originalFilePath);
        if (g_cancel === true) {
          send({
            success: true,
            state: "cancelled",
            numAttempts: numAttempts - 1,
            numErrors,
            failedFilePaths,
          });
          return;
        }
        //////////////////////////////////////////////
        let tempCopyFilePath = path.join(
          tempSubFolderPath,
          path.basename(imgFiles[index].path),
        );
        fs.copyFileSync(imgFiles[index].path, tempCopyFilePath);
        let fileName = path.basename(
          tempCopyFilePath,
          path.extname(tempCopyFilePath),
        );
        let outputFilePath = path.join(
          outputFolderPath,
          fileName + "." + outputFormat,
        );
        let i = 1;
        while (fs.existsSync(outputFilePath)) {
          i++;
          outputFilePath = path.join(
            outputFolderPath,
            fileName + "(" + i + ")." + outputFormat,
          );
        }
        //////////////////////////////////////////////
        const result = await processImage(
          tempCopyFilePath,
          true,
          true,
          uiSelectedOptions,
        );
        tempCopyFilePath = result.filePath;
        updateModalLogText(extractingToText + ": " + outputFilePath);
        fs.copyFileSync(tempCopyFilePath, outputFilePath);
        //////////////////////////////////////////////
        await fileUtils.safeUnlink(tempCopyFilePath, true);
      } catch (error) {
        updateModalLogText(error);
        numErrors++;
        failedFilePaths.push(originalFilePath);
      }
    }
    if (numErrors > 0) throw "failed conversions: " + numErrors;
    send({
      success: true,
      state: "success",
      numAttempts,
      numErrors,
      failedFilePaths,
    });
  } catch (error) {
    send({
      success: false,
      error: error,
      numAttempts,
      numErrors,
      failedFilePaths,
    });
  }
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function send(message) {
  process.parentPort.postMessage(message);
}

function updateModalLogText(text) {
  send({
    type: "modalLog",
    log: text,
  });
}
