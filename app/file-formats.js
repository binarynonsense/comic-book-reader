const path = require("path");
const fs = require("fs");

const AdmZip = require("adm-zip");
const unrar = require("node-unrar-js");
const EPub = require("epub");
const sharp = require("sharp");

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getMimeType(filePath) {
  let mimeType = path.extname(filePath).substring(1);
  return mimeType;
}
exports.getMimeType = getMimeType;

function hasImageExtension(filePath) {
  const allowedFileExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".avif",
  ];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
}
exports.hasImageExtension = hasImageExtension;

exports.hasComicBookExtension = function (filePath) {
  const allowedFileExtensions = [".cbz", ".cbr", ".pdf", ".epub"];
  let fileExtension = path.extname(filePath).toLowerCase();
  for (i = 0; i < allowedFileExtensions.length; i++) {
    if (fileExtension === allowedFileExtensions[i]) {
      return true;
    }
  }
  return false;
};

exports.hasPdfKitCompatibleImageExtension = function (filePath) {
  const allowedFileExtensions = [".jpg", ".jpeg", ".png"];
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

async function extractRar(filePath, tempFolderPath) {
  try {
    //ref: https://github.com/YuJianrong/node-unrar.js
    let extractor = await unrar.createExtractorFromFile({
      filepath: filePath,
      targetPath: tempFolderPath,
    });
    const { files } = extractor.extract();
    [...files]; // lazy initialization? the files are not extracted if I don't do this
  } catch (error) {
    console.log(error);
  }
}
exports.extractRar = extractRar;

async function getRarEntriesList(filePath, password) {
  try {
    var buf = Uint8Array.from(fs.readFileSync(filePath)).buffer;
    var extractor = await unrar.createExtractorFromData({
      data: buf,
      password: password,
    });
    const list = extractor.getFileList();

    // const arcHeader = list.arcHeader;
    // console.log(arcHeader);

    const fileHeaders = [...list.fileHeaders];
    let imgEntries = [];
    let isEncrypted = false;
    let encryptedEntryName;
    fileHeaders.forEach(function (header) {
      if (header.flags.encrypted) {
        isEncrypted = true;
        encryptedEntryName = header.name;
      }
      if (!header.flags.directory) {
        if (hasImageExtension(header.name)) {
          imgEntries.push(header.name);
        }
      }
    });
    if (isEncrypted) {
      // try password to see if there's an error = wrong password
      try {
        const extracted = extractor.extract({ files: [encryptedEntryName] });
        const files = [...extracted.files];
        files[0].extraction;
      } catch (error) {
        return { result: "password required", paths: [] };
      }
    }
    return { result: "success", paths: imgEntries };
  } catch (error) {
    console.log(error);
    return { result: "other error", paths: [] };
  }
}
exports.getRarEntriesList = getRarEntriesList;

async function extractRarEntryBuffer(rarPath, entryName, password) {
  try {
    var buf = Uint8Array.from(fs.readFileSync(rarPath)).buffer;
    var extractor = await unrar.createExtractorFromData({
      data: buf,
      password: password,
    });
    const extracted = extractor.extract({ files: [entryName] });
    const files = [...extracted.files];
    files[0].extraction; // Uint8Array
    return Buffer.from(files[0].extraction);
  } catch (error) {
    console.log(error);
    return undefined;
  }
}
exports.extractRarEntryBuffer = extractRarEntryBuffer;

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
    return imgEntries;
  } catch (err) {
    return undefined;
  }
}
exports.getZipEntriesList = getZipEntriesList;

function extractZipEntryBuffer(zipPath, entryName) {
  let zip = new AdmZip(zipPath);
  return zip.readFile(entryName);
}
exports.extractZipEntryBuffer = extractZipEntryBuffer;

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
            // e.g. /images/img-0139/OPS/images/0139.jpeg
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
          fs.writeFileSync(filePath, Buffer.from(data), "binary");
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
  let mime;
  await new Promise((resolve, reject) => {
    epub.getImage(imageID, function (err, data, mimeType) {
      if (err) {
        return reject({
          error: true,
          message: err,
        });
      } else {
        buf = Buffer.from(data);
        mime = mimeType;
        return resolve({
          success: true,
        });
      }
    });
  });
  return [buf, mime];
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
  let content = [];
  for (let index = 0; index < imgPathsList.length; index++) {
    const imgPath = imgPathsList[index];
    const html =
      "<p class='img-container'><img src='file://" + imgPath + "'/></p>";
    let pageID = "000000000" + index;
    pageID = pageID.substr(
      pageID.length - imgPathsList.length.toString().length
    );
    content.push({
      //title: "page_ " + pageID, //(index + 1).padStart(5, "0"),
      data: html,
      filename: "page_ " + pageID,
    });
  }
  const option = {
    //verbose: true,
    tempDir: tempFolderPath,
    title: path.basename(outputFilePath, path.extname(outputFilePath)),
    author: "", // required
    //publisher: "",
    cover: imgPathsList[0],
    //tocTitle: "",
    customOpfTemplatePath: path.join(
      __dirname,
      "assets/libs/epub/templates/content.opf.ejs"
    ),
    css: "body { margin: 0; padding:0; }\n .img-container{text-align:center; text-indent:0; margin-top: 0; margin-bottom: 0;} img { text-align: center; text-indent:0; }",
    content: content,
  };

  let err = await new Epub(option, outputFilePath).promise;
  if (err !== undefined) throw err;
}
exports.createEpubFromImages = createEpubFromImages;

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function createPdfFromImages(imgPathsList, outputFilePath, method) {
  try {
    const PDFDocument = require("pdfkit");
    const pdf = new PDFDocument({
      autoFirstPage: false,
    });
    pdf.pipe(fs.createWriteStream(outputFilePath));
    for (let index = 0; index < imgPathsList.length; index++) {
      const imgPath = imgPathsList[index];
      const img = pdf.openImage(imgPath);

      if (method === "metadata") {
        let imgData = await sharp(imgPath).metadata();
        let imgDpi = imgData.density;
        if (imgDpi === undefined || imgDpi < 72) imgDpi = 300;
        pdf.addPage({
          margin: 0,
          size: [(72 * img.width) / imgDpi, (72 * img.height) / imgDpi],
        });
        pdf.image(img, 0, 0, { scale: 72.0 / imgDpi });
      } else if (method === "300dpi") {
        let imgDpi = 300;
        pdf.addPage({
          margin: 0,
          size: [(72 * img.width) / imgDpi, (72 * img.height) / imgDpi],
        });
        pdf.image(img, 0, 0, { scale: 72.0 / imgDpi });
      } else if (method === "72dpi") {
        pdf.addPage({
          margin: 0,
          size: [img.width, img.height],
        });
        pdf.image(img, 0, 0);
      }
    }
    pdf.end();
  } catch (error) {
    console.log(error);
  }
}
exports.createPdfFromImages = createPdfFromImages;
