const fileUtils = require("../file-utils");

process.on("message", (message) => {
  //console.log("message from parent: " + message[0]);
  conversionExtractImages(message[0], message[1], message[2]);
});

async function conversionExtractImages(
  inputFilePath,
  inputFileType,
  tempFolderPath
) {
  try {
    if (inputFileType === "zip") {
      fileUtils.extractZip(inputFilePath, tempFolderPath);
    } else if (inputFileType === "rar") {
      fileUtils.extractRar(inputFilePath, tempFolderPath);
    } else if (inputFileType === "epub") {
      await fileUtils.extractEpubImages(inputFilePath, tempFolderPath);
    } else {
      process.send("conversionExtractImages: invalid file type");
      return;
    }
    process.send("success");
  } catch (err) {
    process.send(err);
  }
}
