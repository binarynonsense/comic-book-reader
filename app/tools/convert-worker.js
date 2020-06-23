const fileFormats = require("../file-formats");

process.on("message", (message) => {
  conversionExtractImages(message[0], message[1], message[2]);
});

async function conversionExtractImages(
  inputFilePath,
  inputFileType,
  tempFolderPath
) {
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
