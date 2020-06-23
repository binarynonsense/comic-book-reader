const fileFormats = require("./file-formats");

process.on("message", (message) => {
  extractBase64Image(message[0], message[1], message[2], message[3]);
});

async function extractBase64Image(fileType, filePath, entryName, scrollBarPos) {
  try {
    let buf;
    if (fileType === "zip") {
      buf = fileFormats
        .extractZipEntryBuffer(filePath, entryName)
        .toString("base64");
    } else if (fileType === "rar") {
      buf = fileFormats
        .extractRarEntryBuffer(filePath, entryName)
        .toString("base64");
    } else if (fileType === "epub") {
      buf = await fileFormats.extractEpubImageBuffer(filePath, entryName);
      buf = buf.toString("base64");
    } else {
      //  TODO: handle error file type not valid
    }
    let img64 =
      "data:image/" + fileFormats.getMimeType(entryName) + ";base64," + buf;
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
