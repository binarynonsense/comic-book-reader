const { BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const fileUtils = require("../file-utils");

let g_convertWindow;

exports.showWindow = function (parentWindow, filePath, fileType) {
  if (g_convertWindow !== undefined) return; // TODO: focus the existing one?
  g_convertWindow = new BrowserWindow({
    title: "Convert Files Tool",
    width: 700,
    height: 600,
    //frame: false,
    icon: path.join(__dirname, "../assets/images/icon_256x256.png"),
    resizable: true,
    backgroundColor: "white",
    parent: parentWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  g_convertWindow.menuBarVisible = false;
  g_convertWindow.loadFile(`${__dirname}/convert.html`);

  g_convertWindow.on("closed", () => {
    g_convertWindow = undefined;
  });

  g_convertWindow.webContents.on("did-finish-load", function () {
    g_convertWindow.webContents.send("add-file", filePath, fileType);
  });

  //g_convertWindow.toggleDevTools();
};

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("convert-choose-file", (event) => {
  let fileList = fileUtils.chooseFile(g_convertWindow);
  if (fileList === undefined) {
    return;
  }
  let filePath = fileList[0];
  //g_convertWindow.webContents.send("add-file", filePath, fileType);
  console.log("select file request:" + filePath);
});

ipcMain.on("convert-choose-folder", (event) => {
  let folderList = fileUtils.chooseFolder(g_convertWindow);
  if (folderList === undefined) {
    return;
  }
  let folderPath = folderList[0];
  console.log("select folder request:" + folderPath);
  if (folderPath === undefined || folderPath === "") return;

  g_convertWindow.webContents.send("change-output-folder", folderPath);
});

/////////////////////////

ipcMain.on(
  "convert-start-conversion",
  (event, inputFilePath, inputFileType) => {
    conversionStart(inputFilePath, inputFileType);
  }
);

ipcMain.on("convert-stop-error", (event, ee) => {
  conversionStopError(err);
});

ipcMain.on("convert-pdf-images-extracted", (event) => {
  g_convertWindow.webContents.send("convert-images-extracted");
});

ipcMain.on(
  "convert-create-file-from-images",
  (event, inputFilePath, outputSize, outputFormat, outputFolderPath) => {
    createFileFromImages(
      inputFilePath,
      outputSize,
      outputFormat,
      outputFolderPath
    );
  }
);

///////////////////////////////////////////////////////////////////////////////

function conversionStopError(err) {
  //console.log(err);
  g_convertWindow.webContents.send(
    "convert-update-text-title",
    "Conversion Failed:"
  );
  g_convertWindow.webContents.send("convert-update-text-log", "");
  g_convertWindow.webContents.send(
    "convert-update-text-info",
    "Couldn't convert the file, an error ocurred"
  );
  g_convertWindow.webContents.send("convert-finished-error");
}

function conversionStart(inputFilePath, inputFileType) {
  g_convertWindow.webContents.send("convert-update-text-title", "Converting:");
  g_convertWindow.webContents.send("convert-update-text-info", inputFilePath);
  g_convertWindow.webContents.send("convert-update-text-log", "");

  // extract to temp folder
  if (
    inputFileType === "zip" ||
    inputFileType === "rar" ||
    inputFileType === "epub"
  ) {
    g_convertWindow.webContents.send(
      "convert-update-text-log",
      "Extracting pages..."
    );
    tempFolder = conversionExtractImages(inputFilePath, inputFileType);
  } else if (inputFileType === "pdf") {
    g_convertWindow.webContents.send(
      "convert-update-text-log",
      "Extracting pages..."
    );
    tempFolder = fileUtils.createTempFolder();
    g_convertWindow.webContents.send("convert-extract-pdf-images", tempFolder);
  } else {
    conversionStopError("");
  }
}

async function conversionExtractImages(inputFilePath, inputFileType) {
  try {
    if (inputFileType === "zip") {
      fileUtils.extractZip(inputFilePath);
    } else if (inputFileType === "rar") {
      fileUtils.extractRar(inputFilePath);
    } else if (inputFileType === "epub") {
      await fileUtils.extractEpubImages(inputFilePath);
    }
    g_convertWindow.webContents.send("convert-images-extracted");
  } catch (err) {
    conversionStopError(err);
  }
}

async function createFileFromImages(
  inputFilePath,
  outputSize,
  outputFormat,
  outputFolderPath
) {
  try {
    let tempFolder = fileUtils.getTempFolder();
    let imgFiles = fileUtils.getImageFilesInFolderRecursive(tempFolder);
    if (imgFiles === undefined || imgFiles.length === 0) {
      conversionStopError("");
      return;
    }

    // resize imgs if needed
    outputSize = parseInt(outputSize);
    if (outputSize < 100) {
      // ref: https://www.npmjs.com/package/jimp
      const Jimp = require("jimp");
      for (let index = 0; index < imgFiles.length; index++) {
        await Jimp.read(imgFiles[index]).then((image) => {
          g_convertWindow.webContents.send(
            "convert-update-text-log",
            "Resizing Page: " + (index + 1) + " / " + imgFiles.length
          );
          return (
            image
              .scale(outputSize / 100)
              .quality(60)
              // Don't know how to get the original's quality and 60 seems to give the best size 'reduction to visual quality' results,
              // much better looking than expected for such a low number
              .write(imgFiles[index])
          );
        });
        // TODO will an error be catched by the above try-catch?
        // .catch((err) => {
        //   conversionError(err);
        // });
      }
    }

    // compress to output folder
    g_convertWindow.webContents.send(
      "convert-update-text-log",
      "Generating New File..."
    );
    let filename = path.basename(inputFilePath, path.extname(inputFilePath));
    let outputFilePath = path.join(
      outputFolderPath,
      filename + "." + outputFormat
    );
    let i = 1;
    while (fs.existsSync(outputFilePath)) {
      //console.log("file already exists");
      i++;
      outputFilePath = path.join(
        outputFolderPath,
        filename + "(" + i + ")." + outputFormat
      );
    }

    if (outputFormat === "pdf") {
      fileUtils.createPdfFromImages(imgFiles, outputFilePath);
    } else {
      //cbz
      fileUtils.createZip(imgFiles, outputFilePath);
    }

    // delete temp folder
    g_convertWindow.webContents.send(
      "convert-update-text-log",
      "Cleaning Up..."
    );

    fileUtils.cleanUpTempFolder();
    g_convertWindow.webContents.send(
      "convert-update-text-title",
      "New File Correctly Created:"
    );
    g_convertWindow.webContents.send("convert-update-text-log", "");
    g_convertWindow.webContents.send(
      "convert-update-text-info",
      outputFilePath
    );
    g_convertWindow.webContents.send("convert-finished-ok");
  } catch (err) {
    conversionStopError(err);
  }
}

///////////////////////////////////////////////////////////////////////////////
