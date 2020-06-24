const { ipcRenderer, nativeImage } = require("electron");
const fs = window.require("fs");

let g_cancelConversion;

ipcRenderer.on(
  "resize-images",
  (
    event,
    imgFilePaths,
    outputScale,
    outputQuality,
    outputFormat,
    outputFilePath
  ) => {
    g_cancelConversion = false;
    resizeImages(
      imgFilePaths,
      outputScale,
      outputQuality,
      outputFormat,
      outputFilePath
    );
  }
);

ipcRenderer.on("cancel-resize", (event) => {
  g_cancelConversion = true;
});

function resizeImages(
  imgFilePaths,
  outputScale,
  outputQuality,
  outputFormat,
  outputFilePath
) {
  try {
    for (let index = 0; index < imgFilePaths.length; index++) {
      ipcRenderer.send("resizing-image", index + 1, imgFilePaths.length);

      // ref: https://www.electronjs.org/docs/api/native-image#imageresizeoptions
      let image = nativeImage.createFromPath(imgFilePaths[index]);
      const width = (image.getSize().width * outputScale) / 100;
      image = image.resize({
        width: width,
        quality: "best", // good, better, or best
      });
      const buf = image.toJPEG(outputQuality);
      fs.writeFileSync(imgFilePaths[index], buf, "binary");

      if (g_cancelConversion === true) {
        // doesn't currently work as expected. ipcs aren't getting through while resizing
        // hogs the processing power
        ipcRenderer.send("resizing-canceled");
        return;
      }
    }

    ipcRenderer.send(
      "convert-create-file-from-images",
      imgFilePaths,
      outputFormat,
      outputFilePath
    );
  } catch (err) {
    ipcRenderer.send("resizing-error", err);
  }
}

// if (outputScale < 100) {
//   if (false) {
//     // ref: https://www.npmjs.com/package/jimp
//     const Jimp = require("jimp");
//     for (let index = 0; index < imgFilePaths.length; index++) {
//       g_convertWindow.webContents.send(
//         "convert-update-text-log",
//         _("Resizing Page: ") + (index + 1) + " / " + imgFilePaths.length
//       );
//       let image = await Jimp.read(imgFilePaths[index]);
//       image.scale(outputScale / 100);
//       image.quality(outputQuality);
//       await image.writeAsync(imgFilePaths[index]);

//       if (g_cancelConversion === true) {
//         conversionStopCancel();
//         return;
//       }
//     }
//   } else {
//     for (let index = 0; index < imgFilePaths.length; index++) {
//       g_convertWindow.webContents.send(
//         "convert-update-text-log",
//         _("Resizing Page: ") + (index + 1) + " / " + imgFilePaths.length
//       );
//       // ref: https://www.electronjs.org/docs/api/native-image#imageresizeoptions
//       let image = nativeImage.createFromPath(imgFilePaths[index]);
//       const width = (image.getSize().width * outputScale) / 100;
//       image = image.resize({
//         width: width,
//         quality: "best", // good, better, or best
//       });
//       const buf = image.toJPEG(outputQuality);
//       fs.writeFileSync(imgFilePaths[index], buf, "binary");

//       if (g_cancelConversion === true) {
//         conversionStopCancel();
//         return;
//       }
//     }
//   }
// }
