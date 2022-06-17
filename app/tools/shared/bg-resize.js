const { ipcRenderer, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

let g_cancel;
let g_ipcChannel = "";

ipcRenderer.on("bgr--init", (event, ipcChannel) => {
  g_ipcChannel = ipcChannel;
});

ipcRenderer.on(
  "bgr--resize-images",
  (
    event,
    imgFilePaths,
    outputScale,
    outputQuality,
    outputFormat,
    outputFilePath
  ) => {
    g_cancel = false;
    resizeImages(
      imgFilePaths,
      outputScale,
      outputQuality,
      outputFormat,
      outputFilePath
    );
  }
);

ipcRenderer.on("bgr--cancel-resize", (event) => {
  g_cancel = true;
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
      let filePath = imgFilePaths[index];
      let fileExtension = path.extname(filePath);

      if (
        outputScale < 100 ||
        (fileExtension !== ".jpg" &&
          fileExtension !== ".jpeg" &&
          fileExtension !== ".png")
      ) {
        ipcRenderer.send(
          g_ipcChannel + "resizing-image",
          index + 1,
          imgFilePaths.length
        );

        // ref: https://www.electronjs.org/docs/api/native-image#imageresizeoptions
        let image = nativeImage.createFromPath(imgFilePaths[index]);
        if (outputScale < 100) {
          const width = (image.getSize().width * outputScale) / 100;
          image = image.resize({
            width: width,
            quality: "best", // good, better, or best
          });
        }
        const buf = image.toJPEG(outputQuality);

        fs.writeFileSync(filePath, buf, "binary");

        if (fileExtension !== ".jpg" && fileExtension !== ".jpeg") {
          let fileFolderPath = path.dirname(filePath);
          let fileName = path.basename(filePath, path.extname(filePath));
          let newFilePath = path.join(fileFolderPath, fileName + ".jpg");
          fs.renameSync(filePath, newFilePath);
          imgFilePaths[index] = newFilePath;
        }
      }

      if (g_cancel === true) {
        // doesn't currently work as expected. ipcs aren't getting through while resizing
        // hogs the processing power
        ipcRenderer.send(g_ipcChannel + "resizing-canceled");
        return;
      }
    }

    ipcRenderer.send(
      g_ipcChannel + "create-file-from-images",
      imgFilePaths,
      outputFormat,
      outputFilePath
    );
  } catch (err) {
    ipcRenderer.send(g_ipcChannel + "resizing-error", err);
  }
}
