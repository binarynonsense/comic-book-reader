const fileFormats = require("../../file-formats");

process.on("message", (message) => {
  if (message[0] === "extract") {
    extractImages(message[1], message[2], message[3]);
  } else if (message[0] === "create") {
    createFile(message[1], message[2], message[3], message[4]);
  }
});

async function extractImages(inputFilePath, inputFileType, tempFolderPath) {
  try {
    if (inputFileType === "zip") {
      fileFormats.extractZip(inputFilePath, tempFolderPath);
    } else if (inputFileType === "rar") {
      fileFormats.extractRar(inputFilePath, tempFolderPath);
    } else if (inputFileType === "epub") {
      await fileFormats.extractEpubImages(inputFilePath, tempFolderPath);
    } else {
      process.send("conversionExtractImages: invalid file type");
      return;
    }
    process.send("success");
  } catch (err) {
    process.send(err);
  }
}

async function createFile(
  imgFilePaths,
  outputFormat,
  outputFilePath,
  tempFolderPath
) {
  try {
    if (outputFormat === "pdf") {
      // TODO: doesn't work in the worker, why?
      //fileFormats.createPdfFromImages(imgFilePaths, outputFilePath);
      process.send("ERROR: can't create a pdf in the worker");
    } else if (outputFormat === "epub") {
      await fileFormats.createEpubFromImages(
        imgFilePaths,
        outputFilePath,
        tempFolderPath
      );
    } else {
      //cbz
      fileFormats.createZip(imgFilePaths, outputFilePath);
    }
    process.send("success");
  } catch (err) {
    process.send(err);
  }
}
