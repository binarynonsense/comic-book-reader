/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { ipcRenderer } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const fileUtils = require("../main/file-utils");
const { FileExtension } = require("../main/constants");
const { padNumber } = require("../main/utils");

let g_cancel;

ipcRenderer.on(
  "extract-pdf",
  (
    event,
    ipcChannel,
    filePath,
    folderPath,
    extractionMethod,
    logText,
    password,
    isDev,
    pdfLibVersion,
  ) => {
    g_cancel = false;
    extractPDF(
      ipcChannel,
      filePath,
      folderPath,
      extractionMethod,
      logText,
      password,
      isDev,
      pdfLibVersion,
    );
  },
);

ipcRenderer.on("cancel", (event) => {
  if (!g_cancel) g_cancel = true;
});

///////////////////////////////////////////////////////////////////////////////
// PDF ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const pdfjsFolderName_1 = "pdfjs-2.3.200";
const pdfjsFolderName_2 = "pdfjs-3.8.162";

async function extractPDF(
  ipcChannel,
  filePath,
  folderPath,
  extractionMethod,
  logText,
  password,
  isDev,
  pdfLibVersion,
) {
  let pdf = null;
  let loadingTask = null;
  let canvas = null;
  try {
    let totalPages = 1;
    const pdfjsFolderName =
      pdfLibVersion === "pdfjs_2" ? pdfjsFolderName_2 : pdfjsFolderName_1;
    const pdfjsLib = require(
      `../../assets/libs/${pdfjsFolderName}/build/pdf.js`,
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = `../../assets/libs/${pdfjsFolderName}/build/pdf.worker.js`;

    if (isDev) {
      ipcRenderer.send(
        "tools-worker",
        ipcChannel,
        "update-log-text",
        "[DEV] lib folder: " + pdfjsFolderName,
      );
    }

    loadingTask = pdfjsLib.getDocument({
      url: filePath.replaceAll("#", "%23"),
      password: password,
      isEvalSupported: false,
    });
    pdf = await loadingTask.promise;

    canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (g_cancel) {
        ipcRenderer.send(
          "tools-worker",
          ipcChannel,
          "pdf-images-extracted",
          true,
        );
        return;
      }

      ipcRenderer.send(
        "tools-worker",
        ipcChannel,
        "update-log-text",
        logText + pageNum + " / " + pdf.numPages,
      );

      const page = await pdf.getPage(pageNum);
      // try {
      //   await page.getOperatorList();
      // } catch (error) {
      //   failedPages.push(pageNum);
      //   page.cleanup();
      //   continue;
      // }
      let pageWidth = page.view[2];
      let pageHeight = page.view[3];
      const userUnit = page.userUnit;
      let dpi = parseInt(extractionMethod);
      const iPerUnit = 1 / 72;
      let scaleFactor = dpi * iPerUnit;

      let bigSide = Math.max(pageWidth, pageHeight);
      let scaledSide = bigSide * scaleFactor;
      if (scaledSide > 4500) {
        scaleFactor =
          (!userUnit || userUnit <= 1) && bigSide > 2500 ? 1 : 4500 / bigSide;
        dpi = parseInt(scaleFactor / iPerUnit);
      }

      const viewport = page.getViewport({ scale: scaleFactor });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      let blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.8),
      );
      let arrayBuffer = await blob.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);
      buffer = fileUtils.changeJpegBufferDpi(buffer, dpi);

      const outPath = path.join(
        folderPath,
        padNumber(pageNum, totalPages) + "." + FileExtension.JPG,
      );

      fs.writeFileSync(outPath, buffer, "binary");

      buffer = null;
      arrayBuffer = null;
      blob = null;

      page.cleanup();
      // v2 hack for memory management
      if (pdfjsFolderName === pdfjsFolderName_1) {
        if (page.objs) page.objs.clear();
        if (pdf._transport && pdf._transport.pageCache) {
          pdf._transport.pageCache[pageNum - 1] = null;
        }
      }
    } // end for pages

    ipcRenderer.send(
      "tools-worker",
      ipcChannel,
      "pdf-images-extracted",
      g_cancel,
    );
  } catch (error) {
    ipcRenderer.send("tools-worker", ipcChannel, "stop-error", error.message);
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
      context = null;
    }
    if (pdf) {
      await pdf.destroy();
    }
    if (loadingTask) {
      await loadingTask.destroy();
    }
  }
}

// old messy version
// async function extractPDF(
//   ipcChannel,
//   filePath,
//   folderPath,
//   extractionMethod,
//   logText,
//   password,
// ) {
//   try {
//     // FIRST PASS
//     // Uses an older pdf library, it's faster but has a bug in page.obj.get that fails for some files
//     let pdfjsFolderName = pdfjsFolderName_1;
//     let failedPages = [];
//     {
//       const pdfjsLib = require(
//         `../../assets/libs/${pdfjsFolderName}/build/pdf.js`,
//       );
//       // ref: https://kevinnadro.com/blog/parsing-pdfs-in-javascript/
//       pdfjsLib.GlobalWorkerOptions.workerSrc = `../../assets/libs/${pdfjsFolderName}/build/pdf.worker.js`;
//       //pdfjsLib.disableWorker = true;
//       let escapedInputFilePath = filePath.replaceAll("#", "%23");
//       // hashtags must be escaped so PDF.js doesn't break trying to parse
//       // the path, as it looks for patterns like #page=2&zoom=200
//       const pdf = await pdfjsLib.getDocument({
//         url: escapedInputFilePath,
//         password: password,
//         isEvalSupported: false,
//       }).promise;
//       for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
//         if (g_cancel) {
//           pdf.cleanup();
//           pdf.destroy();
//           ipcRenderer.send(
//             "tools-worker",
//             ipcChannel,
//             "pdf-images-extracted",
//             true,
//           );
//           return;
//         }
//         let page = await pdf.getPage(pageNum);
//         let pageWidth = page.view[2]; // [left, top, width, height]
//         let pageHeight = page.view[3];
//         let userUnit = page.userUnit; // 1 unit = 1/72 inch
//         let dpi = 300; // use userUnit some day (if > 1) to set dpi?
//         let iPerUnit = 1 / 72;
//         let scaleFactor = dpi * iPerUnit; // default: output a 300dpi image instead of 72dpi, which is the pdf default?
//         if (extractionMethod === "72") {
//           scaleFactor = 1;
//           dpi = 72;
//         }
//         // resize if too big?
//         let bigSide = pageHeight;
//         if (pageHeight < pageWidth) bigSide = pageWidth;
//         let scaledSide = bigSide * scaleFactor;
//         if (scaledSide > 4500) {
//           console.log("reducing PDF scale factor, img too big");
//           if ((!userUnit || userUnit <= 1) && bigSide > 2500) {
//             // bad userUnit info?
//             scaleFactor = 1;
//           } else {
//             scaleFactor = 4500 / bigSide;
//           }
//           dpi = parseInt(scaleFactor / iPerUnit);
//         }
//         // RENDER
//         const canvas = document.createElement("canvas");
//         let viewport = page.getViewport({
//           scale: scaleFactor,
//         });
//         let context = canvas.getContext("2d");
//         canvas.height = viewport.height;
//         canvas.width = viewport.width;
//         await page.render({ canvasContext: context, viewport: viewport })
//           .promise;
//         ////////////////////////////
//         if (extractionMethod === "embedded") {
//           // check imgs size
//           // ref: https://codepen.io/allandiego/pen/RwVGbyj
//           const operatorList = await page.getOperatorList();
//           const validTypes = [
//             pdfjsLib.OPS.paintImageXObject,
//             pdfjsLib.OPS.paintJpegXObject,
//             //pdfjsLib.OPS.paintImageXObjectRepeat,
//           ];
//           let images = [];
//           operatorList.fnArray.forEach((element, index) => {
//             if (validTypes.includes(element)) {
//               images.push(operatorList.argsArray[index][0]);
//             }
//           });
//           if (images.length === 1) {
//             // could be a comic book, let's extract the image
//             const imageName = images[0];
//             try {
//               // page needs to have been rendered before for this to be filled
//               let image = await page.objs.get(imageName);
//               const imageWidth = image.width;
//               const imageHeight = image.height;
//               if (imageWidth >= pageWidth && imageHeight >= pageHeight) {
//                 scaleFactor = imageWidth / pageWidth;
//                 dpi = parseInt(scaleFactor / iPerUnit);
//                 // render again with new dimensions
//                 viewport = page.getViewport({
//                   scale: scaleFactor,
//                 });
//                 canvas.height = viewport.height;
//                 canvas.width = viewport.width;
//                 await page.render({
//                   canvasContext: context,
//                   viewport: viewport,
//                 }).promise;
//               }
//             } catch (error) {
//               failedPages.push(pageNum);
//               continue;
//             }
//           }
//         }
//         //////////////////////////////
//         let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
//         // let img = changeDpiDataUrl(dataUrl, dpi);
//         // let data = img.replace(/^data:image\/\w+;base64,/, "");
//         let data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
//         let buffer = Buffer.from(data, "base64");
//         // new way
//         buffer = fileUtils.changeJpegBufferDpi(buffer, dpi);

//         let filePath = path.join(
//           folderPath,
//           padNumber(pageNum, pdf.numPages) + "." + FileExtension.JPG,
//         );
//         fs.writeFileSync(filePath, buffer, "binary");
//         ipcRenderer.send(
//           "tools-worker",
//           ipcChannel,
//           "update-log-text",
//           logText + pageNum + " / " + pdf.numPages,
//         );

//         page.cleanup();
//       }
//       pdf.cleanup();
//       pdf.destroy();
//     }
//     // SECOND PASS
//     // Try to extract failed pages using newer but slower version of the library
//     pdfjsFolderName = pdfjsFolderName_2;
//     if (failedPages.length > 0) {
//       console.log("retrying pages: " + failedPages);
//       const pdfjsLib = require(
//         `../../assets/libs/${pdfjsFolderName}/build/pdf.js`,
//       );
//       // ref: https://kevinnadro.com/blog/parsing-pdfs-in-javascript/
//       pdfjsLib.GlobalWorkerOptions.workerSrc = `../../assets/libs/${pdfjsFolderName}/build/pdf.worker.js`;
//       //pdfjsLib.disableWorker = true;
//       let escapedInputFilePath = filePath.replaceAll("#", "%23");
//       // hashtags must be escaped so PDF.js doesn't break trying to parse
//       // the path, as it looks for patterns like #page=2&zoom=200
//       const pdf = await pdfjsLib.getDocument({
//         url: escapedInputFilePath,
//         password: password,
//         isEvalSupported: false,
//       }).promise;
//       for (pageNum of failedPages) {
//         if (g_cancel) {
//           pdf.cleanup();
//           pdf.destroy();
//           ipcRenderer.send(
//             "tools-worker",
//             ipcChannel,
//             "pdf-images-extracted",
//             true,
//           );
//           return;
//         }
//         let page = await pdf.getPage(pageNum);
//         let pageWidth = page.view[2]; // [left, top, width, height]
//         let pageHeight = page.view[3];
//         let userUnit = page.userUnit; // 1 unit = 1/72 inch
//         let dpi = 300; // use userUnit some day (if > 1) to set dpi?
//         let iPerUnit = 1 / 72;
//         let scaleFactor = dpi * iPerUnit; // default: output a 300dpi image instead of 72dpi, which is the pdf default?
//         if (extractionMethod === "72") {
//           scaleFactor = 1;
//           dpi = 72;
//         }
//         // resize if too big?
//         let bigSide = pageHeight;
//         if (pageHeight < pageWidth) bigSide = pageWidth;
//         let scaledSide = bigSide * scaleFactor;
//         if (scaledSide > 4500) {
//           console.log("reducing PDF scale factor, img too big");
//           if ((!userUnit || userUnit <= 1) && bigSide > 2500) {
//             // bad userUnit info?
//             scaleFactor = 1;
//           } else {
//             scaleFactor = 4500 / bigSide;
//           }
//           dpi = parseInt(scaleFactor / iPerUnit);
//         }
//         // RENDER
//         const canvas = document.createElement("canvas");
//         let viewport = page.getViewport({
//           scale: scaleFactor,
//         });
//         let context = canvas.getContext("2d");
//         canvas.height = viewport.height;
//         canvas.width = viewport.width;
//         await page.render({ canvasContext: context, viewport: viewport })
//           .promise;
//         ////////////////////////////
//         if (extractionMethod === "embedded") {
//           const operatorList = await page.getOperatorList();
//           const validTypes = [
//             pdfjsLib.OPS.paintImageXObject,
//             pdfjsLib.OPS.paintJpegXObject,
//           ];
//           let images = [];
//           operatorList.fnArray.forEach((element, index) => {
//             if (validTypes.includes(element)) {
//               images.push(operatorList.argsArray[index][0]);
//             }
//           });
//           if (images.length === 1) {
//             const imageName = images[0];
//             let image;
//             try {
//               image = await page.objs.get(imageName);
//             } catch (error) {
//               // console.log(
//               //   `couldn't extract embedded size info for page ${pageNum}, using 300dpi`
//               // );
//               image = undefined;
//             }
//             if (image !== undefined && image !== null) {
//               const imageWidth = image.width;
//               const imageHeight = image.height;
//               if (imageWidth >= pageWidth && imageHeight >= pageHeight) {
//                 scaleFactor = imageWidth / pageWidth;
//                 dpi = parseInt(scaleFactor / iPerUnit);
//                 viewport = page.getViewport({
//                   scale: scaleFactor,
//                 });
//                 canvas.height = viewport.height;
//                 canvas.width = viewport.width;
//                 await page.render({
//                   canvasContext: context,
//                   viewport: viewport,
//                 }).promise;
//               }
//             }
//           }
//         }
//         //////////////////////////////
//         let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
//         // let img = changeDpiDataUrl(dataUrl, dpi); // old way
//         // let data = img.replace(/^data:image\/\w+;base64,/, "");
//         let data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
//         let buffer = Buffer.from(data, "base64");
//         // new way
//         buffer = fileUtils.changeJpegBufferDpi(buffer, dpi);

//         let filePath = path.join(
//           folderPath,
//           padNumber(pageNum, pdf.numPages) + "." + FileExtension.JPG,
//         );
//         fs.writeFileSync(filePath, buffer, "binary");
//         ipcRenderer.send(
//           "tools-worker",
//           ipcChannel,
//           "update-log-text",
//           logText + pageNum + " / " + pdf.numPages,
//         );

//         page.cleanup();
//       }
//       pdf.cleanup();
//       pdf.destroy();
//     }
//     ipcRenderer.send("tools-worker", ipcChannel, "pdf-images-extracted", false);
//   } catch (error) {
//     ipcRenderer.send("tools-worker", ipcChannel, "stop-error", error.message);
//   }
// }
