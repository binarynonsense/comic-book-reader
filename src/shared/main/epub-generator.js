/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");
const log = require("./logger");
const binUtils = require("./bin-utils");
const utils = require("./utils");

function getMimeType(filePath) {
  // ref: https://idpf.org/epub/30/spec/epub30-publications.html#sec-core-media-types
  let mimeType = path.extname(filePath).substring(1);
  if (mimeType === "jpg") mimeType = "jpeg";
  return mimeType;
}

exports.createComic = async function (
  imgPathsList,
  outputFilePath,
  tempFolderPath,
  extraData,
) {
  try {
    const imageStorageSelection = extraData.imageStorage;
    let bookTitle = path.basename(outputFilePath, path.extname(outputFilePath));
    // ref: https://ebooks.stackexchange.com/questions/1183/what-is-the-minimum-required-content-for-a-valid-epub
    // ref: https://stackoverflow.com/questions/74870022/how-to-create-an-epub-from-javascript
    // ref: http://www.lab99.com/web-advice/how-to-create-an-ebook-part-4
    // add mimetype
    let mimetype = "application/epub+zip";
    // container.xml
    let containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    // content.opf
    const { randomUUID } = require("crypto"); // ref: https://stackoverflow.com/questions/23327010/how-to-generate-unique-id-with-node-js
    let uniqueID = randomUUID();
    let contentOpf = `<?xml version="1.0" encoding="UTF-8" ?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" unique-identifier="book-id" version="3.0">

<metadata>
    <dc:title id="t1">${bookTitle}</dc:title>
    <dc:identifier id="book-id">${uniqueID}</dc:identifier>
    <meta refines="#book-id" property="identifier-type" scheme="xsd:string">uuid</meta>
    <meta property="dcterms:modified">${
      new Date().toISOString().split(".")[0] + "Z" // delete milliseconds
    }</meta>
    <dc:language>en</dc:language>
    <meta name="cover" content="image_cover"/>
    <meta name="generator" content="acbr" />
</metadata>

<manifest>
    <item id="toc" properties="nav" href="toc.xhtml" media-type="application/xhtml+xml" />
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
    <item id="style_css" href="style.css" media-type="text/css" />
    <item id="image_cover" href="cover.jpeg" media-type="image/jpeg" />`;
    for (let index = 0; index < imgPathsList.length; index++) {
      if (imageStorageSelection !== "base64")
        contentOpf += `\n    <item id="image_${index}" href="images/${index}.${getMimeType(
          imgPathsList[index],
        )}" media-type="image/${getMimeType(imgPathsList[index])}" />`;
      contentOpf += `\n    <item id="content_${index}" href="page_${index}.xhtml" media-type="application/xhtml+xml" />`;
    }
    contentOpf += `\n</manifest>

<spine toc="ncx">`;
    for (let index = 0; index < imgPathsList.length; index++) {
      contentOpf += `\n    <itemref idref="content_${index}"/>`;
    }
    contentOpf += `\n</spine>

<guide>
    <reference type="text" title="Table of Content" href="toc.xhtml"/>
</guide>

</package>`;
    // toc.xhtml
    let tocXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<title>toc.xhtml</title>
<link href="style.css" rel="stylesheet" type="text/css" />
</head>

<body>
    <nav id="toc" epub:type="toc">
        <h1 class="frontmatter">Table of Contents</h1>
        <ol class="contents">`;
    for (let index = 0; index < imgPathsList.length; index++) {
      tocXhtml += `\n                <li><a href="page_${index}.xhtml">page_${index}</a></li>`;
    }
    tocXhtml += `\n        </ol>
    </nav>
</body>
</html>`;
    // pages
    let pagesXhtml = [];
    for (let index = 0; index < imgPathsList.length; index++) {
      let imgPath = imgPathsList[index];
      let pageXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<title>${bookTitle} - ${index + 1}/${imgPathsList.length}</title>
<link href="style.css" rel="stylesheet" type="text/css" />
</head>

<body>
  <p class="img-container">`;
      if (imageStorageSelection === "base64") {
        let buf = fs.readFileSync(imgPath);
        let mime = "image/" + getMimeType(imgPath);
        let img64 = "data:" + mime + ";base64," + buf.toString("base64");
        pageXhtml += `\n      <img src="${img64}" alt="page_image"/>`;
      } else {
        pageXhtml += `\n      <img src="images/${index}.${getMimeType(
          imgPathsList[index],
        )}" alt="page_image"/>`;
      }

      pageXhtml += `\n  </p>
</body>
</html>`;
      pagesXhtml.push(pageXhtml);
    }
    // toc.ncx
    let tocNcx = `<?xml version="1.0" encoding="UTF-8" ?>
<ncx version="2005-1" xml:lang="en" xmlns="http://www.daisy.org/z3986/2005/ncx/">

<head>
    <meta name="dtb:uid" content="${uniqueID}"/>
    <meta name="dtb:generator" content="acbr"/>
    <meta name="dtb:depth" content="1"/>
</head>

<docTitle>
    <text>${bookTitle}</text>
</docTitle>

<navMap>`;
    for (let index = 0; index < imgPathsList.length; index++) {
      tocNcx += `\n    <navPoint id="content_${index}" playOrder="${
        index + 1
      }" class="chapter">
  <navLabel>
      <text>Page ${index}</text>
  </navLabel>
  <content src="page_${index}.xhtml"/>
</navPoint>`;
    }

    tocNcx += `\n</navMap>

</ncx>`;
    // style.css
    let styleCss = `body {
  margin: 0;
  padding:0;
}
.img-container{
  text-align:center; 
  text-indent:0;
  margin-top: 0;
  margin-bottom: 0;
} 
img {
  text-align: center;
  text-indent:0;
}`;
    // NOTE: mimetype must be stored uncompressed, and be the first entry
    // - 7z already stores it uncompressed by default because it's a very small
    //   file, I think
    // - TODO: 7z, as previously adm-zip, seems to reorder the entries when
    //   writing the file no matter the order, making the current way of
    //   creating the epub not conformant to the specification

    // TODO: this method duplicates the images, easier to get the exact zip
    // I want, but wasteful. Could I do it differently?
    const writeToTemp = (relPath, content) => {
      const fullPath = path.join(extraData.tempSubFolderPath, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    };
    writeToTemp("mimetype", Buffer.from(mimetype, "utf8"));
    writeToTemp("META-INF/container.xml", Buffer.from(containerXml, "utf8"));
    writeToTemp("OEBPS/content.opf", Buffer.from(contentOpf, "utf8"));
    writeToTemp("OEBPS/toc.xhtml", Buffer.from(tocXhtml, "utf8"));
    for (let index = 0; index < imgPathsList.length; index++) {
      writeToTemp(
        `OEBPS/page_${index}.xhtml`,
        Buffer.from(pagesXhtml[index], "utf8"),
      );
    }
    writeToTemp("OEBPS/toc.ncx", Buffer.from(tocNcx, "utf8"));
    writeToTemp("OEBPS/style.css", Buffer.from(styleCss, "utf8"));
    if (
      path.extname(imgPathsList[0]) === ".jpg" ||
      path.extname(imgPathsList[0]) === ".jpeg"
    ) {
      writeToTemp(`OEBPS/cover.jpeg`, fs.readFileSync(imgPathsList[0]));
    } else {
      // convert first
      const sharp = require("sharp");
      sharp.cache(false); // avoid EBUSY error on windows
      let buffer = await sharp(imgPathsList[0])
        .withMetadata()
        .jpeg({
          quality: 85,
        })
        .toBuffer();
      writeToTemp(`OEBPS/cover.jpeg`, buffer);
    }
    if (imageStorageSelection !== "base64") {
      for (let index = 0; index < imgPathsList.length; index++) {
        const fileName = utils.padNumber(index + 1, imgPathsList.length);
        writeToTemp(
          `OEBPS/images/${fileName}.${getMimeType(imgPathsList[index])}`,
          fs.readFileSync(imgPathsList[index]),
        );
      }
    }
    // write file using 7z //////////////////
    if (fs.existsSync(outputFilePath)) {
      fs.unlinkSync(outputFilePath);
    }
    const { spawn } = require("node:child_process");
    let args = ["a", outputFilePath, ".", "-tzip"];
    // a -> add files to zip or create it and add them
    // . -> take all files in the working dir
    await new Promise((resolve, reject) => {
      const child = spawn(binUtils.get7zBinPath(), args, {
        cwd: extraData.tempSubFolderPath,
      });
      let fullStderr = "";
      child.stderr.on("data", (data) => {
        fullStderr += data.toString();
      });
      child.on("error", (error) => {
        reject(error);
      });
      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`7z exited with code ${code}. Error: ${fullStderr}`),
          );
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    log.error("Epub generator error: " + error);
    throw "Epub generator error: " + error;
  }
};
