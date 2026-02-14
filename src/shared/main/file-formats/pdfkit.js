/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const log = require("../logger");

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function createPdf(imgPathsList, outputFilePath, method, password) {
  try {
    const PDFDocument = require("pdfkit");
    const sharp = require("sharp");
    let options = {
      autoFirstPage: false,
    };
    // ref: https://pdfkit.org/docs/getting_started.html#setting_document_metadata
    if (password && password.trim() !== "") options.userPassword = password;
    const pdf = new PDFDocument(options);
    let stream = fs.createWriteStream(outputFilePath);
    // stream.on("finish", function () {
    // });
    stream.on("error", (error) => {
      log.editorError("error writing pdf to file (stream event)");
      log.editorError(error);
      if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
    });
    pdf.pipe(stream);
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
    // ref: https://stackoverflow.com/questions/74686305/how-to-properly-await-createwritestream
    const { once } = require("node:events");
    try {
      await once(stream, "finish");
    } catch (error) {
      throw error;
    }
  } catch (error) {
    log.editorError("error writing pdf to file");
    if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
    throw error;
  }
}
exports.createPdf = createPdf;
