const path = require("path");
const fs = require("fs");

const AdmZip = require("adm-zip");
const unrar = require("node-unrar-js");
const EPub = require("epub");

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getMimeType(filePath) {
  let mimeType = path.basename(filePath);
  return mimeType;
}
exports.getMimeType = getMimeType;

function hasImageExtension(filePath) {
  const allowedFileExtensions = [".jpg", ".jpeg", ".png"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
}
exports.hasImageExtension = hasImageExtension;

exports.hasCompatibleExtension = function (filePath) {
  const allowedFileExtensions = [".cbz", ".cbr", ".pdf", ".epub"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
};

///////////////////////////////////////////////////////////////////////////////
// RAR ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function extractRar(filePath, tempFolderPath) {
  //ref: https://github.com/YuJianrong/node-unrar.js
  let extractor = unrar.createExtractorFromFile(filePath, tempFolderPath);
  extractor.extractAll();
}
exports.extractRar = extractRar;

function getRarEntriesList(filePath) {
  var buf = Uint8Array.from(fs.readFileSync(filePath)).buffer;
  var extractor = unrar.createExtractorFromData(buf);
  var rarEntries = extractor.getFileList();
  let imgEntries = [];
  if (rarEntries[0].state === "SUCCESS") {
    rarEntries[1].fileHeaders.forEach(function (rarEntry) {
      if (!rarEntry.flags.directory) {
        if (hasImageExtension(rarEntry.name)) {
          imgEntries.push(rarEntry.name);
        }
      }
    });
  }
  imgEntries.sort();
  return imgEntries;
}
exports.getRarEntriesList = getRarEntriesList;

function extractRarEntryData(rarPath, entryName) {
  try {
    var buf = Uint8Array.from(fs.readFileSync(rarPath)).buffer;
    var extractor = unrar.createExtractorFromData(buf);
    var extracted = extractor.extractFiles([entryName]);
    if (extracted[0].state === "SUCCESS") {
      if (extracted[1].files[0].extract[0].state === "SUCCESS") {
        // ref: https://stackoverflow.com/questions/54305759/how-to-encode-a-buffer-to-base64-in-nodejs
        return Buffer.from(extracted[1].files[0].extract[1]);
      }
    }
    return undefined;
  } catch (err) {
    return undefined;
  }
}
exports.extractRarEntryData = extractRarEntryData;

///////////////////////////////////////////////////////////////////////////////
// ZIP ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getZipEntriesList(filePath) {
  try {
    let zip = new AdmZip(filePath);
    let zipEntries = zip.getEntries();
    let imgEntries = [];
    zipEntries.forEach(function (zipEntry) {
      if (!zipEntry.isDirectory) {
        if (hasImageExtension(zipEntry.entryName)) {
          imgEntries.push(zipEntry.entryName);
        }
      }
    });
    imgEntries.sort();
    return imgEntries;
  } catch (err) {
    return undefined;
  }
}
exports.getZipEntriesList = getZipEntriesList;

function extractZipEntryData(zipPath, entryName) {
  let zip = new AdmZip(zipPath);
  return zip.readFile(entryName);
}
exports.extractZipEntryData = extractZipEntryData;

function extractZip(filePath, tempFolderPath) {
  // ref: https://github.com/cthackers/adm-zip/wiki/ADM-ZIP-Introduction
  try {
    let zip = new AdmZip(filePath);
    const imageData = zip.readFile("");
    zip.extractAllTo(tempFolderPath, true);
    return undefined;
  } catch (err) {
    console.log(err);
    return err;
  }
}
exports.extractZip = extractZip;

function createZip(filePathsList, outputFilePath) {
  let zip = new AdmZip();
  filePathsList.forEach((element) => {
    zip.addLocalFile(element);
  });
  zip.writeZip(outputFilePath);
}
exports.createZip = createZip;

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function extractEpubImages(filePath, tempFolderPath) {
  // TODO catch errors
  // based on renderer.js epub code
  const epub = new EPub(filePath);

  // parse epub
  await new Promise((resolve, reject) => {
    epub.parse();
    epub.on("error", reject);
    epub.on("end", (err) => {
      if (err) {
        return reject({
          error: true,
          message: err,
        });
      }
      return resolve({
        success: true,
      });
    });
  });

  // get list of image IDs
  let imageIDs = [];
  for (let index = 0; index < epub.spine.contents.length; index++) {
    const element = epub.spine.contents[index];
    await new Promise((resolve, reject) => {
      epub.getChapter(element.id, function (err, data) {
        if (err) {
          return reject({
            error: true,
            message: err,
          });
        } else {
          const rex = /<img[^>]+src="([^">]+)/g;
          while ((m = rex.exec(data))) {
            // i.e. /images/img-0139/OPS/images/0139.jpeg
            let id = m[1].split("/")[2];
            imageIDs.push(id);
          }
          return resolve({
            success: true,
          });
        }
      });
    });
  }

  // extract and save images
  for (let index = 0; index < imageIDs.length; index++) {
    const imageID = imageIDs[index];
    await new Promise((resolve, reject) => {
      epub.getImage(imageID, function (err, data, mimeType) {
        if (err) {
          return reject({
            error: true,
            message: err,
          });
        } else {
          let extension = mimeType.split("/")[1];
          let filePath = path.join(tempFolderPath, index + "." + extension);
          fs.writeFile(filePath, Buffer.from(data), "binary", function (err) {
            if (err) {
              return reject({
                error: true,
                message: err,
              });
            }
          });

          return resolve({
            success: true,
          });
        }
      });
    });
  }
}
exports.extractEpubImages = extractEpubImages;

async function extractEpubImageBuffer(filePath, imageID) {
  const epub = new EPub(filePath);

  // parse epub
  await new Promise((resolve, reject) => {
    epub.parse();
    epub.on("error", reject);
    epub.on("end", (err) => {
      if (err) {
        return reject({
          error: true,
          message: err,
        });
      }
      return resolve({
        success: true,
      });
    });
  });

  // extract image buffer
  let buf;
  await new Promise((resolve, reject) => {
    epub.getImage(imageID, function (err, data, mimeType) {
      if (err) {
        return reject({
          error: true,
          message: err,
        });
      } else {
        buf = Buffer.from(data);
        return resolve({
          success: true,
        });
      }
    });
  });
  return buf;
}
exports.extractEpubImageBuffer = extractEpubImageBuffer;

async function createEpubFromImages(
  imgPathsList,
  outputFilePath,
  tempFolderPath
) {
  // ref: https://www.npmjs.com/package/epub-gen
  // ref: https://github.com/cyrilis/epub-gen/issues/25
  const Epub = require("epub-gen");
  let html = "";
  //const url = require("url");
  for (let index = 0; index < imgPathsList.length; index++) {
    const imgPath = imgPathsList[index];
    html += "<img src='file://" + imgPath + "'/>";
    //html += '<img src="' + url.pathToFileURL(imgPath).href + '" />';
    //console.log(html);
  }
  const option = {
    //verbose: true,
    tempDir: tempFolderPath,
    title: path.basename(outputFilePath), // *Required, title of the book.
    author: "", // *Required, name of the author.
    //publisher: "", // optional
    //cover: "",
    //tocTitle: "",
    content: [
      {
        data: html,
        //beforeToc: true,
        //excludeFromToc: true,
      },
    ],
  };

  let err = await new Epub(option, outputFilePath).promise;
  if (err !== undefined) throw err;
}
exports.createEpubFromImages = createEpubFromImages;

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function createPdfFromImages(imgPathsList, outputFilePath) {
  const PDFDocument = require("pdfkit");
  const pdf = new PDFDocument({
    autoFirstPage: false,
  });
  pdf.pipe(fs.createWriteStream(outputFilePath));
  for (let index = 0; index < imgPathsList.length; index++) {
    const imgPath = imgPathsList[index];
    const img = pdf.openImage(imgPath);
    pdf.addPage({ size: [img.width, img.height] });
    pdf.image(img, 0, 0);
  }
  pdf.end();
}
exports.createPdfFromImages = createPdfFromImages;
