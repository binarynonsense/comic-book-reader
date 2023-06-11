const fs = require("fs");
const path = require("path");

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
  imageStorageSelection
) {
  try {
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
          imgPathsList[index]
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
          imgPathsList[index]
        )}" alt="page_image"/>`;
      }

      pageXhtml += `\n</p>
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
    // add all to zip
    const AdmZip = require("adm-zip");
    let zip = new AdmZip();
    // NOTE: mimetype must be stored uncompressed, and be the first entry
    // TODO: adm-zip seems to reorder the entries when writing the file, making the current way of making the epub not
    // conformant to the specification
    zip.addFile("mimetype", Buffer.from(mimetype, "utf8"));
    // ref: https://github.com/cthackers/adm-zip/issues/187#issuecomment-490166400
    let mimeEntry = zip.getEntry("mimetype");
    mimeEntry.header.method = 0; // Compression method 0 (STORED) or 8 (DEFLATED)
    zip.addFile("META-INF/container.xml", Buffer.from(containerXml, "utf8"));
    zip.addFile("OEBPS/content.opf", Buffer.from(contentOpf, "utf8"));
    zip.addFile("OEBPS/toc.xhtml", Buffer.from(tocXhtml, "utf8"));
    for (let index = 0; index < imgPathsList.length; index++) {
      zip.addFile(
        `OEBPS/page_${index}.xhtml`,
        Buffer.from(pagesXhtml[index], "utf8")
      );
    }
    zip.addFile("OEBPS/toc.ncx", Buffer.from(tocNcx, "utf8"));
    zip.addFile("OEBPS/style.css", Buffer.from(styleCss, "utf8"));
    if (
      path.extname(imgPathsList[0]) === ".jpg" ||
      path.extname(imgPathsList[0]) === ".jpeg"
    ) {
      zip.addFile(`OEBPS/cover.jpeg`, fs.readFileSync(imgPathsList[0]));
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
      zip.addFile(`OEBPS/cover.jpeg`, buffer);
    }
    if (imageStorageSelection !== "base64") {
      for (let index = 0; index < imgPathsList.length; index++) {
        zip.addFile(
          `OEBPS/images/${index}.${getMimeType(imgPathsList[index])}`,
          fs.readFileSync(imgPathsList[index])
        );
      }
    }
    // write file //////////////////
    zip.writeZip(outputFilePath);
    // // test
    // {
    //   zip = new AdmZip(outputFilePath);
    //   let zipEntries = zip.getEntries();
    //   zipEntries.forEach(function (zipEntry) {
    //     console.log(zipEntry.entryName);
    //     console.log(zipEntry.header.method);
    //     console.log();
    //   });
    // }
  } catch (error) {
    console.log("Epub generator error: " + error);
    throw "Epub generator error: " + error;
  }
};
