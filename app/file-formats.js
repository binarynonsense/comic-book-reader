const path = require("path");
const fs = require("fs");
const os = require("os");

function isDev() {
  return process.argv[2] == "--dev";
}

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
  const allowedFileExtensions = [".cbz", ".cbr", ".pdf", ".epub", ".cb7"];
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

// mostly a copy from file-utils

function createTempFolder() {
  let tempFolderPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "comic-book-reader-")
  );
  return tempFolderPath;
}

function cleanUpTempFolder(tempFolderPath) {
  if (tempFolderPath === undefined) return;
  deleteTempFolderRecursive(tempFolderPath);
  tempFolderPath = undefined;
}

const deleteTempFolderRecursive = function (folderPath) {
  if (fs.existsSync(folderPath)) {
    if (!folderPath.startsWith(os.tmpdir())) {
      // safety check
      return;
    }
    let files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const entryPath = path.join(folderPath, file);
      if (fs.lstatSync(entryPath).isDirectory()) {
        deleteTempFolderRecursive(entryPath);
      } else {
        fs.unlinkSync(entryPath); // delete the file
      }
    });
    fs.rmdirSync(folderPath);
  }
};

///////////////////////////////////////////////////////////////////////////////
// RAR ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function getRarEntriesList(filePath, password) {
  try {
    const unrar = require("node-unrar-js");
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
    const unrar = require("node-unrar-js");
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

async function extractRar(filePath, tempFolderPath, password) {
  try {
    const unrar = require("node-unrar-js");
    //ref: https://github.com/YuJianrong/node-unrar.js
    let extractor = await unrar.createExtractorFromFile({
      filepath: filePath,
      targetPath: tempFolderPath,
      password: password,
    });
    const { files } = extractor.extract();
    [...files]; // lazy initialization? the files are not extracted if I don't do this
  } catch (error) {
    throw error;
  }
}
exports.extractRar = extractRar;

///////////////////////////////////////////////////////////////////////////////
// ZIP ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getZipEntriesList(filePath, password) {
  try {
    const AdmZip = require("adm-zip");
    let zip = new AdmZip(filePath);
    let zipEntries = zip.getEntries();
    let imgEntries = [];
    let isEncrypted = false;
    let encryptedEntryName;
    let compressionMethod;
    zipEntries.forEach(function (zipEntry) {
      if (zipEntry.header.encripted) {
        isEncrypted = true;
        encryptedEntryName = zipEntry.entryName;
        compressionMethod = zipEntry.header.method;
      }
      if (!zipEntry.isDirectory) {
        if (hasImageExtension(zipEntry.entryName)) {
          imgEntries.push(zipEntry.entryName);
        }
      }
    });
    if (isEncrypted) {
      if (parseInt(compressionMethod) !== 99) {
        // AES encryption is not supported by adm-zip, only ZipCrypto
        // compression method 99 indicates the AES encryption
        if (!zip.test(password)) {
          return { result: "password required", paths: [] };
        }
      } else {
        // can't handle this protection
        return { result: "other error", paths: [], extra: "aes" };
      }
    }
    return { result: "success", paths: imgEntries };
  } catch (error) {
    console.log(error);
    return { result: "success", paths: imgEntries };
  }
}
exports.getZipEntriesList = getZipEntriesList;

function extractZipEntryBuffer(zipPath, entryName, password) {
  const AdmZip = require("adm-zip");
  let zip = new AdmZip(zipPath);
  return zip.readFile(entryName, password);
}
exports.extractZipEntryBuffer = extractZipEntryBuffer;

function extractZip(filePath, tempFolderPath, password) {
  // ref: https://github.com/cthackers/adm-zip/wiki/ADM-ZIP-Introduction
  try {
    const AdmZip = require("adm-zip");
    let zip = new AdmZip(filePath);
    const imageData = zip.readFile("");
    zip.extractAllTo(tempFolderPath, true, false, password);
  } catch (error) {
    throw error;
  }
}
exports.extractZip = extractZip;

function createZip(filePathsList, outputFilePath) {
  const AdmZip = require("adm-zip");
  let zip = new AdmZip();
  filePathsList.forEach((element) => {
    zip.addLocalFile(element);
  });
  zip.writeZip(outputFilePath);
}
exports.createZip = createZip;

///////////////////////////////////////////////////////////////////////////////
// 7ZIP ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pathTo7zipBin;
function checkPathTo7ZipBin() {
  const sevenBin = require("7zip-bin");
  if (g_pathTo7zipBin === undefined) {
    g_pathTo7zipBin = sevenBin.path7za;
    if (!isDev()) {
      // find the one that works in the release version
      g_pathTo7zipBin = g_pathTo7zipBin.replace(
        "app.asar",
        "app.asar.unpacked"
      );
    }
  }
  return g_pathTo7zipBin;
}

async function get7ZipEntriesList(filePath, password) {
  try {
    if (password === undefined || password === "") {
      // to help trigger the right error
      password = "_";
    }
    checkPathTo7ZipBin();
    // NOTE:  I use test instead of list because it gives an error for encrypted files
    // that have the file names ot encrypted, and also returns the file list.
    // List only gives an error if the names are also encrypted
    // TODO: check if test comes with a performance hit for big files? Don't really know what it tests...
    const Seven = require("node-7z");
    const seven = Seven.test(filePath, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
      password: password,
    });

    let imgEntries;
    let promise = await new Promise((resolve) => {
      imgEntries = [];
      seven.on("data", function (data) {
        imgEntries.push(data.file);
      });
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: imgEntries,
        });
      });
    });

    if (promise.success === true) {
      return { result: "success", paths: imgEntries };
    } else if (promise.success === false) {
      if (promise.data.toString().search("password") !== -1) {
        // Can not open encrypted archive. Wrong password?"
        return { result: "password required", paths: [] };
      }
    }
    // shouldn't reach this point
    return { result: "other error", paths: [] };
  } catch (error) {
    return { result: "other error", paths: [] };
  }
}
exports.get7ZipEntriesList = get7ZipEntriesList;

async function extract7ZipEntryBuffer(filePath, entryName, password) {
  let tempFolderPath;
  try {
    tempFolderPath = createTempFolder();
    //////////////////////////////////////////
    if (password === undefined || password === "") {
      // to help trigger the right error
      password = "_";
    }
    checkPathTo7ZipBin();

    const Seven = require("node-7z");
    const seven = Seven.extract(filePath, tempFolderPath, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
      password: password,
      $cherryPick: entryName,
    });

    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        console.log(error);
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: "",
        });
      });
    });

    let buffer;
    if (promise.success === true) {
      buffer = fs.readFileSync(path.join(tempFolderPath, entryName));
      cleanUpTempFolder(tempFolderPath);
      return buffer;
    }
    //////////////////////////////////////////
    cleanUpTempFolder(tempFolderPath);
    return undefined;
  } catch (error) {
    console.log(error);
    cleanUpTempFolder(tempFolderPath);
    return undefined;
  }
}
exports.extract7ZipEntryBuffer = extract7ZipEntryBuffer;

async function extract7Zip(filePath, tempFolderPath, password) {
  try {
    if (password === undefined || password === "") {
      // to help trigger the right error
      password = "_";
    }
    checkPathTo7ZipBin();

    const Seven = require("node-7z");
    const seven = Seven.extractFull(filePath, tempFolderPath, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
      password: password,
    });

    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: "",
        });
      });
    });

    if (promise.success === true) {
      return;
    } else if (promise.success === false) {
      throw promise.data;
    }
    throw "Error: unknown error extracting 7z file";
  } catch (error) {
    throw error;
  }
}
exports.extract7Zip = extract7Zip;

async function create7Zip(filePathsList, outputFilePath) {
  try {
    checkPathTo7ZipBin();

    const Seven = require("node-7z");
    const seven = Seven.add(outputFilePath, filePathsList, {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8", // always used just in case?
    });
    // TODO: test archiveType, maybe to support cbt files?
    // not sure, but possible values may be: 7z, xz, split, zip, gzip, bzip2, tar,

    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
        });
      });
    });

    if (promise.success === true) {
      return;
    } else if (promise.success === false) {
      throw promise.data;
    }
  } catch (error) {
    throw error;
  }
}
exports.create7Zip = create7Zip;

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function extractEpubImages(filePath, tempFolderPath) {
  // TODO catch errors
  const EPub = require("epub");
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
  const EPub = require("epub");
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
    const sharp = require("sharp");
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
    throw error;
  }
}
exports.createPdfFromImages = createPdfFromImages;
