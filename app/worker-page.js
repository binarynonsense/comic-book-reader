const fileFormats = require("./file-formats");
const { FileDataType } = require("./constants");

process.on("message", (message) => {
  extractBase64Image(message[0], message[1], message[2], message[3]);
});

async function extractBase64Image(fileType, filePath, entryName, scrollBarPos) {
  try {
    let buf;
    let mime;
    if (fileType === FileDataType.ZIP) {
      buf = fileFormats
        .extractZipEntryBuffer(filePath, entryName)
        .toString("base64");
      mime = "image/" + fileFormats.getMimeType(entryName);
    } else if (fileType === FileDataType.RAR) {
      buf = fileFormats
        .extractRarEntryBuffer(filePath, entryName)
        .toString("base64");
      mime = "image/" + fileFormats.getMimeType(entryName);
    } else if (fileType === FileDataType.EPUB) {
      const data = await fileFormats.extractEpubImageBuffer(
        filePath,
        entryName
      );
      buf = data[0].toString("base64");
      mime = data[1];
    } else {
      //  TODO: handle error file type not valid
    }
    let img64 = "data:" + mime + ";base64," + buf;
    process.send([true, img64, scrollBarPos]);
  } catch (err) {
    process.send([false, err]);
  }
}

// function renderImageFile(filePath) {
//   if (!path.isAbsolute(filePath)) {
//     // FIXME: make it absolute somehow?
//     return;
//   }
//   renderTitle();
//   let data64 = fs.readFileSync(filePath).toString("base64");
//   let img64 =
//     "data:image/" + fileFormats.getMimeType(filePath) + ";base64," + data64;
//   g_mainWindow.webContents.send(
//     "render-img-page",
//     img64,
//     g_fileData.pageRotation
//   );
// }
