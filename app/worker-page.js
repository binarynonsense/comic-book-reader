const fs = require("fs");
const path = require("path");
const fileFormats = require("./file-formats");
const { FileDataType } = require("./constants");

process.on("message", (message) => {
  extractBase64Image(
    message[0],
    message[1],
    message[2],
    message[3],
    message[4]
  );
});

async function extractBase64Image(
  fileType,
  filePath,
  entryName,
  scrollBarPos,
  password
) {
  try {
    let buf;
    let mime;
    if (fileType === FileDataType.ZIP) {
      buf = fileFormats
        .extractZipEntryBuffer(filePath, entryName, password)
        .toString("base64");
      mime = "image/" + fileFormats.getMimeType(entryName);
    } else if (fileType === FileDataType.RAR) {
      buf = await fileFormats.extractRarEntryBuffer(
        filePath,
        entryName,
        password
      );
      buf = buf.toString("base64");
      mime = "image/" + fileFormats.getMimeType(entryName);
    } else if (fileType === FileDataType.EPUB) {
      const data = await fileFormats.extractEpubImageBuffer(
        filePath,
        entryName
      );
      buf = data[0].toString("base64");
      mime = data[1];
    } else if (fileType === FileDataType.IMGS_FOLDER) {
      // if (!path.isAbsolute(entryName)) {
      //   // FIXME: make it absolute somehow?
      // }
      const fullPath = path.join(filePath, entryName);
      buf = fs.readFileSync(fullPath).toString("base64");
      mime = "image/" + fileFormats.getMimeType(fullPath);
    } else {
      //  TODO: handle error file type not valid
    }
    let img64 = "data:" + mime + ";base64," + buf;
    process.send([true, img64, scrollBarPos]);
  } catch (err) {
    process.send([false, err]);
  }
}
