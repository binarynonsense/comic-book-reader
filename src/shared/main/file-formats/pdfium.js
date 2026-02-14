// /**
//  * @license
//  * Copyright 2020-2026 Álvaro García
//  * www.binarynonsense.com
//  * SPDX-License-Identifier: BSD-2-Clause
//  */

// const path = require("node:path");
// const fs = require("node:fs");

// ///////////////////////////////////////////////////////////////////////////////
// // PDF PDFIUM /////////////////////////////////////////////////////////////////
// ///////////////////////////////////////////////////////////////////////////////

// async function extractPdf(
//   filePath,
//   tempFolderPath,
//   password,
//   extraData,
//   send,
//   signal,
// ) {
//   let pdfLib = null;
//   let pdfDoc = null;
//   try {
//     const { PDFiumLibrary } = require("@hyzyla/pdfium");
//     const sharp = require("sharp");
//     const os = require("node:os");

//     const stats = fs.statSync(filePath);
//     const fileSize_MB = stats.size / (1024 * 1024);
//     const freeRAM_MB = os.freemem() / (1024 * 1024);

//     function getNumberWorkers() {
//       // mem limit: 2x the file size in free RAM + 500MB buffer
//       if (freeRAM_MB < fileSize_MB * 2 + 500) {
//         return -2; // cancel extraction
//       }
//       if (fileSize_MB > 800) {
//         return -1; // cancel extraction
//       }
//       // use 4 or 1 worker?
//       if (fileSize_MB > 500) {
//         return 1;
//       }
//       if (fileSize_MB > 300) {
//         return 2;
//       }
//       return 4;
//     }

//     const numWorkers = getNumberWorkers();
//     if (numWorkers < 1) {
//       throw `file too big to use with pdfium (code: ${numWorkers}, free mem: ${Math.round(freeRAM_MB)}MB)`;
//     }

//     let fileBuffer = fs.readFileSync(filePath);
//     pdfLib = await PDFiumLibrary.init();
//     pdfDoc = await pdfLib.loadDocument(fileBuffer, password);
//     fileBuffer = null;
//     if (typeof global.gc === "function") {
//       // just to make sure fileBuffer is cleaned as soon as possible
//       global.gc();
//     }

//     // iterator to array
//     const pages = Array.from(pdfDoc.pages());
//     const totalPages = pages.length;
//     const padLength = totalPages.toString().length;

//     let nextPageIndex = 0;
//     let completedPages = 0;

//     const processPage = async (index, signal) => {
//       const outputFileName = `${(index + 1).toString().padStart(padLength, "0")}.jpg`;
//       const outputPath = path.join(tempFolderPath, outputFileName);
//       try {
//         const page = pages[index];

//         let scaleFactor;
//         let dpi = 300;

//         if (extraData.method === "1") {
//           scaleFactor = extraData.height / page.getSize().height;
//         } else {
//           dpi = parseInt(extraData.dpi);
//           dpi = !Number.isNaN(dpi) ? dpi : 300;
//           scaleFactor = dpi / 72;
//         }

//         const bitmap = await page.render({
//           scale: scaleFactor,
//           render: "bitmap",
//         });

//         if (signal?.aborted) return;

//         // TODO: add chromaSubsampling as an option?
//         // chromaSubsampling: "4:4:4" should be better, but files are bigger
//         await sharp(bitmap.data, {
//           raw: { width: bitmap.width, height: bitmap.height, channels: 4 },
//         })
//           .withMetadata({ density: dpi })
//           .jpeg({ quality: 80, progressive: false }) // chromaSubsampling: "4:4:4"
//           .toFile(outputPath);

//         completedPages++;
//         send?.({
//           type: "extraction-progress",
//           current: completedPages,
//           total: totalPages,
//         });
//       } catch (error) {
//         if (error.name !== "AbortError") throw error;
//       }
//     };

//     // parallelize using async workers to increase speed
//     const startWorker = async (signal) => {
//       while (nextPageIndex < totalPages) {
//         if (signal?.aborted) return;
//         const index = nextPageIndex++;
//         await processPage(index, signal);
//       }
//     };
//     const workerPromises = [];
//     for (let i = 0; i < numWorkers; i++) {
//       workerPromises.push(startWorker(signal));
//     }
//     // wait for them to finish
//     await Promise.all(workerPromises);
//     // TODO: right now I'm passing success even if cancelled, works fine
//     // because the users of the function know it was canceled. Sending an error
//     // will show and error and I don't want that.
//     return { success: true };
//   } catch (error) {
//     const message = error.message ? error.message.toLowerCase() : "";
//     if (message.includes("enospc")) error = "no_disk_space";
//     if (message.includes("password")) error = "incorrect_password";
//     return { success: false, error };
//   } finally {
//     if (pdfDoc) pdfDoc.destroy();
//     if (pdfLib) pdfLib.destroy();
//   }
// }
// exports.extractPdf = extractPdf;

// /////////////////////////

// let g_openPdfLib = null;
// let g_openPdfDoc = null;
// let g_openPdfPath = null;

// async function openPdf(filePath, password) {
//   try {
//     if (!(g_openPdfLib && g_openPdfDoc && g_openPdfPath === filePath)) {
//       const { PDFiumLibrary } = require("@hyzyla/pdfium");
//       if (!g_openPdfLib) {
//         g_openPdfLib = await PDFiumLibrary.init();
//       }
//       if (g_openPdfDoc) {
//         g_openPdfDoc.destroy();
//       }
//       let data = fs.readFileSync(filePath);
//       g_openPdfDoc = await g_openPdfLib.loadDocument(data, password);
//       g_openPdfPath = filePath;
//       data = null;
//       if (global.gc) global.gc();
//     }

//     const numPages = Array.from(g_openPdfDoc.pages()).length;
//     return { success: true, numPages };
//   } catch (error) {
//     const message = error.message?.toLowerCase() || "";
//     if (message.includes("password"))
//       return { success: false, error: "password required" };
//     if (message.includes("is greater than 2 gib"))
//       return { success: false, error: "over2gb" };
//     return { success: false, error };
//   }
// }
// exports.openPdf = openPdf;

// exports.extractPdfPageBuffer = async function (filePath, pageIndex, dpi = 300) {
//   try {
//     if (!g_openPdfDoc || g_openPdfPath != filePath) {
//       return undefined;
//     }

//     const page = g_openPdfDoc.getPage(pageIndex);
//     let scaleFactor = dpi / 72;

//     const pageSize = page.getSize(); // Get the size of the page in points (1/72 inch)
//     const pageWidth = pageSize.width;
//     const pageHeight = pageSize.height;
//     const bigSide = pageHeight;
//     if (pageHeight < pageWidth) bigSide = pageWidth;
//     let scaledSide = bigSide * scaleFactor;
//     if (scaledSide > 4000) {
//       // reducing PDF scale factor, img too big
//       scaleFactor = 4000 / bigSide;
//     }

//     const bitmap = await page.render({
//       scale: scaleFactor,
//       render: "bitmap",
//     });

//     const sharp = require("sharp");
//     const buffer = await sharp(bitmap.data, {
//       raw: { width: bitmap.width, height: bitmap.height, channels: 4 },
//     })
//       .jpeg({ quality: 80 })
//       .toBuffer();

//     return buffer;
//   } catch (error) {
//     return undefined;
//   }
// };

// async function closePdf() {
//   if (g_openPdfDoc) {
//     g_openPdfDoc.destroy();
//     g_openPdfDoc = null;
//   }
//   g_openPdfPath = null;
// }
// exports.closePdf = closePdf;
