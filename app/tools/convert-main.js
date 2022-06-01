const { app, BrowserWindow, ipcMain } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const FileType = require("file-type");
const naturalCompare = require("natural-compare-lite");
const fileUtils = require("../file-utils");
const fileFormats = require("../file-formats");
const mainProcess = require("../main");
const { FileExtension, FileDataType, ToolType } = require("../constants");
const sharp = require("sharp");

let g_convertWindow;
let g_cancelConversion = false;
let g_worker;
let g_resizeWindow;
let g_toolType = ToolType.CONVERT_FILE;

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (toolType, parentWindow, filePath, fileType) {
  if (g_convertWindow !== undefined) return; // TODO: focus the existing one?
  g_convertWindow = new BrowserWindow({
    width: 700,
    height: 650,
    //frame: false,
    icon: path.join(__dirname, "../assets/images/icon_256x256.png"),
    resizable: true,
    backgroundColor: "white",
    parent: parentWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  g_toolType = toolType;

  g_convertWindow.menuBarVisible = false;
  g_convertWindow.loadFile(`${__dirname}/convert.html`);

  // g_convertWindow.on("close", (event) => {
  //   event.preventDefault();
  // });

  g_convertWindow.on("closed", () => {
    g_convertWindow = undefined;
    if (g_worker !== undefined) {
      g_worker.kill();
      g_worker = undefined;
    }
    fileUtils.cleanUpTempFolder();
  });

  g_convertWindow.webContents.on("did-finish-load", function () {
    if (g_toolType === ToolType.CREATE_FILE) {
      g_convertWindow.webContents.send(
        "set-tool-type",
        g_toolType,
        app.getPath("desktop")
      );
    } else if (g_toolType === ToolType.CONVERT_FILE && filePath !== undefined) {
      g_convertWindow.webContents.send(
        "set-tool-type",
        g_toolType,
        path.dirname(filePath)
      );
      g_convertWindow.webContents.send("add-file", filePath, fileType);
    } else {
      g_convertWindow.webContents.send(
        "set-tool-type",
        ToolType.CONVERT_FILES,
        app.getPath("desktop")
      );
    }

    g_convertWindow.webContents.send(
      "update-localization",
      g_toolType === ToolType.CREATE_FILE
        ? _("Create File Tool")
        : _("Convert Files Tool"),
      getLocalization(),
      getTooltipsLocalization()
    );
  });

  // Event: 'unresponsive'
  // Emitted when the web page becomes unresponsive.
  // Event: 'responsive'
  // Emitted when the unresponsive web page becomes responsive again.

  //if (isDev()) g_convertWindow.toggleDevTools();
};

///////////////////////////////////////////////////////////////////////////////

ipcMain.on("convert-choose-file", (event) => {
  try {
    let allowMultipleSelection = false;
    let allowedFileTypesName = "Comic Book Files";
    let allowedFileTypesList = [
      FileExtension.CBZ,
      FileExtension.CBR,
      FileExtension.PDF,
      FileExtension.EPUB,
    ];
    if (g_toolType === ToolType.CONVERT_FILES) allowMultipleSelection = true;
    if (g_toolType === ToolType.CREATE_FILE) {
      allowMultipleSelection = true;
      allowedFileTypesName = "Image Files";
      allowedFileTypesList = [
        FileExtension.JPG,
        FileExtension.JPEG,
        FileExtension.PNG,
        FileExtension.WEBP,
        FileExtension.BMP,
      ];
    }
    let filePathsList = fileUtils.chooseOpenFiles(
      g_convertWindow,
      undefined,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection
    );
    if (filePathsList === undefined) {
      return;
    }
    for (let index = 0; index < filePathsList.length; index++) {
      const filePath = filePathsList[index];
      let stats = fs.statSync(filePath);
      if (!stats.isFile()) continue; // avoid folders accidentally getting here
      let fileType;
      // mostly a COPY FROM main, maybe make a common function in file.utils
      let fileExtension = path.extname(filePath).toLowerCase();
      (async () => {
        let _fileType = await FileType.fromFile(filePath);
        if (_fileType !== undefined) {
          fileExtension = "." + _fileType.ext;
        }
        if (g_toolType === ToolType.CREATE_FILE) {
          fileType = FileDataType.IMG;
        } else {
          if (fileExtension === "." + FileExtension.PDF) {
            fileType = FileDataType.PDF;
          } else if (fileExtension === "." + FileExtension.EPUB) {
            fileType = FileDataType.EPUB;
          } else {
            if (
              fileExtension === "." + FileExtension.RAR ||
              fileExtension === "." + FileExtension.CBR
            ) {
              fileType = FileDataType.RAR;
            } else if (
              fileExtension === "." + FileExtension.ZIP ||
              fileExtension === "." + FileExtension.CBZ
            ) {
              fileType = FileDataType.ZIP;
            } else {
              return;
            }
          }
        }
        g_convertWindow.webContents.send("add-file", filePath, fileType);
      })();
    }
  } catch (err) {
    // TODO: do something?
  }
});

ipcMain.on(
  "convert-choose-folder",
  (event, inputFilePath, outputFolderPath) => {
    let defaultPath;
    if (outputFolderPath !== undefined) {
      defaultPath = outputFolderPath;
    } else if (inputFilePath !== undefined) {
      defaultPath = path.dirname(inputFilePath);
    }
    let folderList = fileUtils.chooseFolder(g_convertWindow, defaultPath);
    if (folderList === undefined) {
      return;
    }
    let folderPath = folderList[0];
    if (folderPath === undefined || folderPath === "") return;

    g_convertWindow.webContents.send("change-output-folder", folderPath);
  }
);

/////////////////////////

ipcMain.on("convert-cancel-conversion", (event) => {
  console.log("cancel conversion request");
  g_cancelConversion = true;
  if (g_resizeWindow !== undefined) {
    g_resizeWindow.webContents.send("cancel-resize");
  }
});

ipcMain.on(
  "convert-start-conversion",
  (event, inputFilePath, inputFileType, fileNum, totalFilesNum) => {
    conversionStart(inputFilePath, inputFileType, fileNum, totalFilesNum);
  }
);

ipcMain.on("convert-start-creation", (event, inputFiles) => {
  creationStart(inputFiles);
});

ipcMain.on("convert-stop-error", (event, err) => {
  conversionStopError(err);
});

ipcMain.on("convert-pdf-images-extracted", (event, canceled) => {
  if (!canceled) g_convertWindow.webContents.send("convert-images-extracted");
  else conversionStopCancel();
});

ipcMain.on(
  "convert-resize-images",
  (
    event,
    inputFilePath,
    outputScale,
    outputQuality,
    outputFormat,
    outputFolderPath
  ) => {
    resizeImages(
      inputFilePath,
      outputScale,
      outputQuality,
      outputFormat,
      outputFolderPath
    );
  }
);

ipcMain.on("resizing-image", (event, pageNum, totalNumPages) => {
  g_convertWindow.webContents.send(
    "convert-update-text-log",
    _("Resizing Page: ") + pageNum + " / " + totalNumPages
  );
});

ipcMain.on("resizing-canceled", (event) => {
  if (g_cancelConversion === false) conversionStopCancel();
});

ipcMain.on("resizing-error", (event, err) => {
  conversionStopError(err);
});

ipcMain.on(
  "convert-create-file-from-images",
  (event, imgFilePaths, outputFormat, outputFilePath) => {
    if (g_resizeWindow !== undefined) {
      g_resizeWindow.destroy();
      g_resizeWindow = undefined;
    }
    createFileFromImages(imgFilePaths, outputFormat, outputFilePath);
  }
);

ipcMain.on(
  "convert-end-conversion",
  (event, wasCanceled, numFiles, numErrors, numAttempted) => {
    if (!wasCanceled) {
      g_convertWindow.webContents.send(
        "convert-update-text-title",
        _("Conversion Finished")
      );

      if (numErrors > 0) {
        if (numFiles > 1) {
          g_convertWindow.webContents.send(
            "convert-update-text-info",
            _(
              "Error: {0} of {1} file/s couldn't be converted",
              numErrors,
              numFiles
            )
          );
        } else {
          g_convertWindow.webContents.send(
            "convert-update-text-info",
            _("Error: the file couldn't be converted")
          );
        }
      } else {
        if (numFiles > 1) {
          g_convertWindow.webContents.send(
            "convert-update-text-info",
            _("{0} file/s correctly converted", numFiles)
          );
        } else {
          g_convertWindow.webContents.send(
            "convert-update-text-info",
            _("File correctly converted")
          );
        }
      }
    } else {
      g_convertWindow.webContents.send(
        "convert-update-text-title",
        _("Conversion Canceled")
      );
      g_convertWindow.webContents.send(
        "convert-update-text-info",
        _(
          "Converted: {0} | Errors: {1} | Canceled: {2}",
          numAttempted - numErrors,
          numErrors,
          numFiles - numAttempted
        )
      );
    }

    // ref: https://www.electronjs.org/docs/api/browser-window#winmovetop
    //g_convertWindow.moveTop(); // try to fix Windows 'bug' where window gets behind parent
    g_convertWindow.show();
    g_convertWindow.webContents.send("convert-show-result");
  }
);

///////////////////////////////////////////////////////////////////////////////

function conversionStopError(err) {
  g_convertWindow.webContents.send("convert-update-text-log", err);
  g_convertWindow.webContents.send(
    "convert-update-text-log",
    _("Couldn't convert the file, an error ocurred")
  );
  g_convertWindow.webContents.send("convert-finished-error");
}

function conversionStopCancel() {
  fileUtils.cleanUpTempFolder();
  g_convertWindow.webContents.send(
    "convert-update-text-log",
    _("Couldn't convert the file, the conversion was canceled")
  );
  g_convertWindow.webContents.send("convert-finished-canceled");
}

function conversionStart(inputFilePath, inputFileType, fileNum, totalFilesNum) {
  g_cancelConversion = false;

  g_convertWindow.webContents.send(
    "convert-update-text-title",
    _("Converting:") +
      (totalFilesNum > 1 ? " (" + fileNum + "/" + totalFilesNum + ")" : "")
  );
  g_convertWindow.webContents.send(
    "convert-update-text-info",
    fileUtils.reducePathString(inputFilePath)
  );
  g_convertWindow.webContents.send("convert-update-text-log", _("Converting:"));
  g_convertWindow.webContents.send("convert-update-text-log", inputFilePath);

  let tempFolderPath = fileUtils.createTempFolder();
  // extract to temp folder
  if (
    inputFileType === FileDataType.ZIP ||
    inputFileType === FileDataType.RAR ||
    inputFileType === FileDataType.EPUB
  ) {
    g_convertWindow.webContents.send(
      "convert-update-text-log",
      _("Extracting Pages...")
    );
    // conversionExtractImages(inputFilePath, inputFileType, tempFolderPath);
    // ref: https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html
    if (g_worker !== undefined) {
      // kill it after one use
      g_worker.kill();
      g_worker = undefined;
    }
    if (g_worker === undefined) {
      g_worker = fork(path.join(__dirname, "convert-worker.js"));
      g_worker.on("message", (message) => {
        g_worker.kill(); // kill it after one use
        if (message === "success") {
          if (g_cancelConversion === true) {
            conversionStopCancel();
            return;
          }
          g_convertWindow.webContents.send("convert-images-extracted");
          return;
        } else {
          conversionStopError(message);
          return;
        }
      });
    }
    g_worker.send(["extract", inputFilePath, inputFileType, tempFolderPath]);
  } else if (inputFileType === FileDataType.PDF) {
    g_convertWindow.webContents.send(
      "convert-update-text-log",
      _("Extracting Pages...")
    );
    g_convertWindow.webContents.send(
      "convert-extract-pdf-images",
      tempFolderPath,
      _("Extracting Page: ")
    );
  } else {
    conversionStopError("conversionStart: invalid file type");
  }
}

function creationStart(inputFiles) {
  g_cancelConversion = false;
  //g_convertWindow.webContents.send("convert-update-text-log", _("Creating:"));
  // g_convertWindow.webContents.send(
  //   "convert-update-text-info",
  //   fileUtils.reducePathString(inputFilePath)
  // );

  let tempFolderPath = fileUtils.createTempFolder();
  let imgFilePaths = [];
  // copy to temp folder
  try {
    for (let index = 0; index < inputFiles.length; index++) {
      const inPath = inputFiles[index].path;
      const outPath = path.join(tempFolderPath, path.basename(inPath));
      fs.copyFileSync(inPath, outPath, fs.constants.COPYFILE_EXCL);
      imgFilePaths.push(outPath);
    }
    g_convertWindow.webContents.send("convert-images-extracted");
  } catch (err) {
    conversionStopError(err);
  }
}
// async function conversionExtractImages(
//   inputFilePath,
//   inputFileType,
//   tempFolderPath
// ) {
//   try {
//     if (inputFileType === "zip") {
//       fileFormats.extractZip(inputFilePath, tempFolderPath);
//     } else if (inputFileType === "rar") {
//       fileFormats.extractRar(inputFilePath, tempFolderPath);
//     } else if (inputFileType === "epub") {
//       await fileFormats.extractEpubImages(inputFilePath, tempFolderPath);
//     }
//     if (g_cancelConversion === true) {
//       conversionStopCancel();
//       return;
//     }
//     g_convertWindow.webContents.send("convert-images-extracted");
//   } catch (err) {
//     conversionStopError(err);
//   }
// }

async function resizeImages(
  inputFilePath,
  outputScale,
  outputQuality,
  outputFormat,
  outputFolderPath
) {
  if (g_cancelConversion === true) {
    conversionStopCancel();
    return;
  }
  try {
    let filename = path.basename(inputFilePath, path.extname(inputFilePath));
    if (g_toolType === ToolType.CREATE_FILE) {
      filename = inputFilePath;
    }
    let outputFilePath = path.join(
      outputFolderPath,
      filename + "." + outputFormat
    );
    let i = 1;
    while (fs.existsSync(outputFilePath)) {
      i++;
      outputFilePath = path.join(
        outputFolderPath,
        filename + "(" + i + ")." + outputFormat
      );
    }

    let tempFolderPath = fileUtils.getTempFolderPath();
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    if (imgFilePaths === undefined || imgFilePaths.length === 0) {
      console.log(imgFilePaths);
      conversionStopError("imgFiles === undefined || imgFiles.length === 0");
      return;
    }
    //imgFiles.sort(); // numerical, not natural, order.. doesn't work for what I want
    // ref: https://www.npmjs.com/package/natural-compare-lite
    imgFilePaths.sort(naturalCompare);

    // change imgs' format if needed (for pdf creation or resizing)
    if (outputScale < 100 || outputFormat === FileExtension.PDF) {
      // pdfkit only works with png and jpg image formats
      // same for native image? (used for resizing)

      // avoid EBUSY error on windows
      // ref: https://stackoverflow.com/questions/41289173/node-js-module-sharp-image-processor-keeps-source-file-open-unable-to-unlink
      sharp.cache(false);

      for (let index = 0; index < imgFilePaths.length; index++) {
        let filePath = imgFilePaths[index];
        // let fileExtension = path.extname(filePath);
        if (!fileFormats.hasNativeImageCompatibleImageExtension(filePath)) {
          let fileFolderPath = path.dirname(filePath);
          let fileName = path.basename(filePath, path.extname(filePath));
          let tmpFilePath = path.join(
            fileFolderPath,
            fileName + "." + FileExtension.TMP
          );
          let newFilePath = path.join(
            fileFolderPath,
            fileName + "." + FileExtension.JPG
          );

          g_convertWindow.webContents.send(
            "convert-update-text-log",
            _("Converting Page {0} to a Compatible Format (JPG)", index + 1)
          );
          await sharp(filePath).jpeg().toFile(tmpFilePath);

          fs.unlinkSync(filePath);
          fs.renameSync(tmpFilePath, newFilePath);
          imgFilePaths[index] = newFilePath;
        }
      }
    }

    // resize imgs if needed
    outputScale = parseInt(outputScale);
    outputQuality = parseInt(outputQuality);
    if (outputScale < 100) {
      // can't do it using a forked process, because I need nativeImage,
      // so I use a hidden window
      if (g_resizeWindow !== undefined) {
        // shouldn't happen
        g_resizeWindow.destroy();
        g_resizeWindow = undefined;
      }
      g_resizeWindow = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
        parent: g_convertWindow,
      });
      g_resizeWindow.loadFile(`${__dirname}/bg-resize.html`);

      g_resizeWindow.webContents.on("did-finish-load", function () {
        //g_resizeWindow.webContents.openDevTools();
        g_resizeWindow.webContents.send(
          "resize-images",
          imgFilePaths,
          outputScale,
          outputQuality,
          outputFormat,
          outputFilePath
        );
      });
    } else {
      createFileFromImages(imgFilePaths, outputFormat, outputFilePath);
    }
  } catch (err) {
    conversionStopError(err);
  }
}

async function createFileFromImages(
  imgFilePaths,
  outputFormat,
  outputFilePath
) {
  if (g_cancelConversion === true) {
    conversionStopCancel();
    return;
  }
  try {
    // compress to output folder
    g_convertWindow.webContents.send(
      "convert-update-text-log",
      _("Generating New File...")
    );
    g_convertWindow.webContents.send("convert-update-text-log", outputFilePath);

    if (outputFormat === FileExtension.PDF) {
      // TODO: doesn't work in the worker, why?
      fileFormats.createPdfFromImages(imgFilePaths, outputFilePath);
      fileUtils.cleanUpTempFolder();
      g_convertWindow.webContents.send("convert-finished-ok");
    } else {
      if (g_worker !== undefined) {
        // kill it after one use
        g_worker.kill();
        g_worker = undefined;
      }
      if (g_worker === undefined) {
        g_worker = fork(path.join(__dirname, "convert-worker.js"));
        g_worker.on("message", (message) => {
          g_worker.kill(); // kill it after one use
          if (message === "success") {
            fileUtils.cleanUpTempFolder();
            g_convertWindow.webContents.send("convert-finished-ok");
            return;
          } else {
            conversionStopError(message);
            return;
          }
        });
      }
      g_worker.send([
        "create",
        imgFilePaths,
        outputFormat,
        outputFilePath,
        fileUtils.getTempFolderPath(),
      ]);
    }
  } catch (err) {
    conversionStopError(err);
  }
}

///////////////////////////////////////////////////////////////////////////////
function getTooltipsLocalization() {
  return [
    {
      id: "tooltip-output-size",
      text: _("tooltip-output-size"),
    },
    {
      id: "tooltip-output-folder",
      text: _("tooltip-output-folder"),
    },
    {
      id: "tooltip-remove-from-list",
      text: _("tooltip-remove-from-list"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "text-input-files",
      text: _("Input File/s:"),
    },
    {
      id: "text-input-file",
      text: _("Input File:"),
    },
    {
      id: "text-input-imgs",
      text: _("Input Image/s:"),
    },
    {
      id: "button-add-file",
      text: _("Add").toUpperCase(),
    },
    {
      id: "text-output-size",
      text: _("Output Size:"),
    },
    {
      id: "text-scale",
      text: _("Scale (%):"),
    },
    {
      id: "text-quality",
      text: _("Quality:"),
    },
    {
      id: "text-output-format",
      text: _("Output Format:"),
    },
    {
      id: "text-output-name",
      text: _("Output Name:"),
    },
    {
      id: "text-output-folder",
      text: _("Output Folder:"),
    },
    {
      id: "button-change-folder",
      text: _("Change").toUpperCase(),
    },
    {
      id: "button-convert",
      text: _("Convert").toUpperCase(),
    },
    {
      id: "button-create",
      text: _("Create").toUpperCase(),
    },
    {
      id: "button-modal-close",
      text: _("Close").toUpperCase(),
    },
    {
      id: "button-modal-cancel",
      text: _("Cancel").toUpperCase(),
    },
  ];
}
