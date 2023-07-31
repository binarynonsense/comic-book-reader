const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const { changeDpiDataUrl } = require("changedpi");
const { FileExtension } = require("../main/constants");

let g_cancel;
let g_ipcChannel;

ipcRenderer.on(
  "extract-pdf",
  (event, filePath, folderPath, extractionMethod, logText, password) => {
    g_cancel = false;
    extractPDF(filePath, folderPath, extractionMethod, logText, password);
  }
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
  password
) {
  try {
    g_ipcChannel = ipcChannel;
    // FIRST PASS
    // Uses an older pdf library, it's faster but has a bug in page.obj.get that fails for some files
    let pdfjsFolderName = pdfjsFolderName_1;
    let failedPages = [];
    {
      const pdfjsLib = require(`../../assets/libs/${pdfjsFolderName}/build/pdf.js`);
      // ref: https://kevinnadro.com/blog/parsing-pdfs-in-javascript/
      pdfjsLib.GlobalWorkerOptions.workerSrc = `../../assets/libs/${pdfjsFolderName}/build/pdf.worker.js`;
      //pdfjsLib.disableWorker = true;
      const pdf = await pdfjsLib.getDocument({
        url: filePath,
        password: password,
      }).promise;
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (g_cancel) {
          pdf.cleanup();
          pdf.destroy();
          ipcRenderer.send(
            "tools-worker",
            g_ipcChannel,
            "pdf-images-extracted",
            true
          );
          return;
        }
        let page = await pdf.getPage(pageNum);
        let pageWidth = page.view[2]; // [left, top, width, height]
        let pageHeight = page.view[3];
        let userUnit = page.userUnit; // 1 unit = 1/72 inch
        let dpi = 300; // use userUnit some day (if > 1) to set dpi?
        let iPerUnit = 1 / 72;
        let scaleFactor = dpi * iPerUnit; // default: output a 300dpi image instead of 72dpi, which is the pdf default?
        if (extractionMethod === "render72") {
          scaleFactor = 1;
          dpi = 72;
        }
        // resize if too big?
        let bigSide = pageHeight;
        if (pageHeight < pageWidth) bigSide = pageWidth;
        let scaledSide = bigSide * scaleFactor;
        if (scaledSide > 5000) {
          console.log("reducing PDF scale factor, img too big");
          scaleFactor = 5000 / bigSide;
          dpi = parseInt(scaleFactor / iPerUnit);
        }
        // RENDER
        const canvas = document.createElement("canvas");
        let viewport = page.getViewport({
          scale: scaleFactor,
        });
        let context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport })
          .promise;
        ////////////////////////////
        if (extractionMethod === "embedded") {
          // check imgs size
          // ref: https://codepen.io/allandiego/pen/RwVGbyj
          const operatorList = await page.getOperatorList();
          const validTypes = [
            pdfjsLib.OPS.paintImageXObject,
            pdfjsLib.OPS.paintJpegXObject,
            //pdfjsLib.OPS.paintImageXObjectRepeat,
          ];
          let images = [];
          operatorList.fnArray.forEach((element, index) => {
            if (validTypes.includes(element)) {
              images.push(operatorList.argsArray[index][0]);
            }
          });
          if (images.length === 1) {
            // could be a comic book, let's extract the image
            const imageName = images[0];
            try {
              // page needs to have been rendered before for this to be filled
              let image = await page.objs.get(imageName);
              const imageWidth = image.width;
              const imageHeight = image.height;
              if (imageWidth >= pageWidth && imageHeight >= pageHeight) {
                scaleFactor = imageWidth / pageWidth;
                dpi = parseInt(scaleFactor / iPerUnit);
                // render again with new dimensions
                viewport = page.getViewport({
                  scale: scaleFactor,
                });
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({
                  canvasContext: context,
                  viewport: viewport,
                }).promise;
              }
            } catch (error) {
              failedPages.push(pageNum);
              continue;
            }
          }
        }
        //////////////////////////////
        let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        let img = changeDpiDataUrl(dataUrl, dpi);
        let data = img.replace(/^data:image\/\w+;base64,/, "");
        let buf = Buffer.from(data, "base64");

        let filePath = path.join(folderPath, pageNum + "." + FileExtension.JPG);
        fs.writeFileSync(filePath, buf, "binary");
        ipcRenderer.send(
          "tools-worker",
          g_ipcChannel,
          "update-log-text",
          logText + pageNum + " / " + pdf.numPages
        );

        page.cleanup();
      }
      pdf.cleanup();
      pdf.destroy();
    }
    // SECOND PASS
    // Try to extract failed pages using newer but slower version of the library
    pdfjsFolderName = pdfjsFolderName_2;
    if (failedPages.length > 0) {
      console.log("retrying pages: " + failedPages);
      const pdfjsLib = require(`../../assets/libs/${pdfjsFolderName}/build/pdf.js`);
      // ref: https://kevinnadro.com/blog/parsing-pdfs-in-javascript/
      pdfjsLib.GlobalWorkerOptions.workerSrc = `../../assets/libs/${pdfjsFolderName}/build/pdf.worker.js`;
      //pdfjsLib.disableWorker = true;
      const pdf = await pdfjsLib.getDocument({
        url: filePath,
        password: password,
      }).promise;
      for (pageNum of failedPages) {
        if (g_cancel) {
          pdf.cleanup();
          pdf.destroy();
          ipcRenderer.send(
            "tools-worker",
            g_ipcChannel,
            "pdf-images-extracted",
            true
          );
          return;
        }
        let page = await pdf.getPage(pageNum);
        let pageWidth = page.view[2]; // [left, top, width, height]
        let pageHeight = page.view[3];
        let userUnit = page.userUnit; // 1 unit = 1/72 inch
        let dpi = 300; // use userUnit some day (if > 1) to set dpi?
        let iPerUnit = 1 / 72;
        let scaleFactor = dpi * iPerUnit; // default: output a 300dpi image instead of 72dpi, which is the pdf default?
        if (extractionMethod === "render72") {
          scaleFactor = 1;
          dpi = 72;
        }
        // resize if too big?
        let bigSide = pageHeight;
        if (pageHeight < pageWidth) bigSide = pageWidth;
        let scaledSide = bigSide * scaleFactor;
        if (scaledSide > 5000) {
          console.log("reducing PDF scale factor, img too big");
          scaleFactor = 5000 / bigSide;
          dpi = parseInt(scaleFactor / iPerUnit);
        }
        // RENDER
        const canvas = document.createElement("canvas");
        let viewport = page.getViewport({
          scale: scaleFactor,
        });
        let context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport })
          .promise;
        ////////////////////////////
        if (extractionMethod === "embedded") {
          const operatorList = await page.getOperatorList();
          const validTypes = [
            pdfjsLib.OPS.paintImageXObject,
            pdfjsLib.OPS.paintJpegXObject,
          ];
          let images = [];
          operatorList.fnArray.forEach((element, index) => {
            if (validTypes.includes(element)) {
              images.push(operatorList.argsArray[index][0]);
            }
          });
          if (images.length === 1) {
            const imageName = images[0];
            let image;
            try {
              image = await page.objs.get(imageName);
            } catch (error) {
              // console.log(
              //   `couldn't extract embedded size info for page ${pageNum}, using 300dpi`
              // );
              image = undefined;
            }
            if (image !== undefined && image !== null) {
              const imageWidth = image.width;
              const imageHeight = image.height;
              if (imageWidth >= pageWidth && imageHeight >= pageHeight) {
                scaleFactor = imageWidth / pageWidth;
                dpi = parseInt(scaleFactor / iPerUnit);
                viewport = page.getViewport({
                  scale: scaleFactor,
                });
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({
                  canvasContext: context,
                  viewport: viewport,
                }).promise;
              }
            }
          }
        }
        //////////////////////////////
        let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        let img = changeDpiDataUrl(dataUrl, dpi);
        let data = img.replace(/^data:image\/\w+;base64,/, "");
        let buf = Buffer.from(data, "base64");

        let filePath = path.join(folderPath, pageNum + "." + FileExtension.JPG);
        fs.writeFileSync(filePath, buf, "binary");
        ipcRenderer.send(
          "tools-worker",
          g_ipcChannel,
          "update-log-text",
          logText + pageNum + " / " + pdf.numPages
        );

        page.cleanup();
      }
      pdf.cleanup();
      pdf.destroy();
    }
    ipcRenderer.send(
      "tools-worker",
      g_ipcChannel,
      "pdf-images-extracted",
      false
    );
  } catch (error) {
    ipcRenderer.send("tools-worker", g_ipcChannel, "stop-error", error);
  }
}
