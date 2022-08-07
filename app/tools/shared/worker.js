const fileFormats = require("../../file-formats");
const palette = require("../extract-palette/palette");

process.on("message", (message) => {
  if (message[0] === "extract") {
    extractImages(message[1], message[2], message[3], message[4]);
  } else if (message[0] === "create") {
    createFile(message[1], message[2], message[3], message[4]);
  } //else if (message[0] === "palette") {
  //   extractPalette(message[1]);
  // }
});

async function extractImages(
  inputFilePath,
  inputFileType,
  tempFolderPath,
  password
) {
  try {
    if (inputFileType === "zip") {
      fileFormats.extractZip(inputFilePath, tempFolderPath, password);
    } else if (inputFileType === "rar") {
      await fileFormats.extractRar(inputFilePath, tempFolderPath, password);
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
      //await fileFormats.createPdfFromImages(imgFilePaths, outputFilePath, method);
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

// function extractPalette(data) {
//   try {
//     // TODO: data seemes to be changed from an array to an object during sending
//     // there must be a way to avoid that, in the mean time I use Object.values()
//     // but would like to learn how to do this more properly
//     console.log("extracting...");
//     let hexColors = palette.getHexColorsPalette(Object.values(data));
//     console.log("done");
//     //console.log(hexColors);
//     process.send(["success", hexColors]);
//   } catch (err) {
//     process.send(err);
//   }
// }
