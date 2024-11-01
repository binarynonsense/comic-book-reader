/**
 * @license
 * Copyright 2023-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { showLoading } from "./loading.js";
import {
  drawCompositeImage,
  getCompositeCanvas,
  renderLayers,
} from "./draw.js";
import {
  loadPresetFromJson,
  setPreset,
  getPresetFromCurrentValues,
  loadGridPresetFromJson,
  setGridPreset,
  getGridPresetFromCurrentValues,
  loadHeaderPresetFromJson,
  setHeaderPreset,
  getHeaderPresetFromCurrentValues,
} from "./presets.js";
import { openModal, closeOpenModal } from "./modals.js";

export function initSaveLoad() {
  let canvas = getCompositeCanvas();
  document
    .getElementById("save-template-button")
    .addEventListener("click", function () {
      showLoading(true);
      // set timeout so loading spinner can show
      setTimeout(() => {
        if (
          document.getElementById("save-template-format-select").value === "png"
        ) {
          saveCanvasToFile(canvas, "template.png", "image/png", () => {
            showLoading(false);
          });
          // saveBase64AsFile(canvas.toDataURL(), "template.png");
          // showLoading(false);
        } else if (
          document.getElementById("save-template-format-select").value === "jpg"
        ) {
          saveCanvasToFile(canvas, "template.jpg", "image/jpeg", () => {
            showLoading(false);
          });
          // saveBase64AsFile(
          //   canvas.toDataURL("image/jpeg"),
          //   "template.jpg"
          // );
          // showLoading(false);
        } else if (
          document.getElementById("save-template-format-select").value === "pdf"
        ) {
          const pdf = new PDFDocument({
            autoFirstPage: false,
          });
          const stream = pdf.pipe(blobStream());
          const imgBase64 = canvas.toDataURL("image/jpeg");
          const img = pdf.openImage(imgBase64);
          pdf.addPage({
            margin: 0,
            size: [canvas.width, canvas.height],
          });
          pdf.image(img, 0, 0, { scale: 1 });
          pdf.end();

          const link = document.createElement("a");
          document.body.appendChild(link);
          link.setAttribute("type", "hidden");

          stream.on("finish", function () {
            let blob = stream.toBlob("application/pdf");
            if (blob) {
              let url = window.URL.createObjectURL(blob);
              link.href = url;
              link.download = "template.pdf";
              link.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(link);
              showLoading(false);
            }
          });
        } else if (
          document.getElementById("save-template-format-select").value === "psd"
        ) {
          renderLayers((pageData) => {
            let layerCanvases = pageData.layerCanvases;
            let children = [];
            for (let index = 0; index < layerCanvases.length; index++) {
              children.push({
                name: layerCanvases[index].name,
                blendMode: "normal",
                opacity: 1,
                transparencyProtected: false,
                hidden: false,
                clipping: false,
                canvas: layerCanvases[index].canvas,
              });
            }

            let writePsd = agPsd.writePsd;
            const psd = {
              width: canvas.width,
              height: canvas.height,
              channels: 3,
              bitsPerChannel: 8,
              colorMode: 3,
              children: [
                {
                  name: "template",
                  children: children,
                },
              ],
              // composite image, needed only for backwards compatibility?
              // NOTE: if I don't set it programs like Okular only show a black image
              canvas: canvas,
              imageResources: {
                resolutionInfo: {
                  horizontalResolution: pageData.ppi,
                  horizontalResolutionUnit: "PPI",
                  widthUnit: "Points",
                  verticalResolution: pageData.ppi,
                  verticalResolutionUnit: "PPI",
                  heightUnit: "Points", //'Inches' | 'Centimeters' | 'Points' | 'Picas' | 'Columns';
                },
              },
            };

            const buffer = writePsd(psd, {
              generateThumbnail: true,
              noBackground: true,
            });
            const blob = new Blob([buffer], {
              type: "application/octet-stream",
            });

            let link = document.createElement("a");
            document.body.appendChild(link);
            link.setAttribute("type", "hidden");
            link.href = URL.createObjectURL(blob);
            link.download = "template.psd";
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(link.href);
          });
        }

        showLoading(false);
      }, "100");
    });
  // template presets import/export
  document
    .getElementById("open-modal-export-preset-button")
    .addEventListener("click", function () {
      openModal("export-preset-modal");
    });
  document
    .getElementById("export-preset-button")
    .addEventListener("click", function () {
      let name = document.getElementById("export-preset-name-input").value;
      savePresetFileFromCurrentValues(name);
      closeOpenModal();
    });

  document
    .getElementById("open-modal-import-preset-button")
    .addEventListener("click", function () {
      openModal("import-preset-modal");
    });
  document
    .getElementById("import-preset-button")
    .addEventListener("click", function () {
      document.getElementById("import-preset-file-input").click();
      closeOpenModal();
    });
  document
    .getElementById("import-preset-file-input")
    .addEventListener("change", function () {
      const file = document.getElementById("import-preset-file-input").files[0];
      let reader = new FileReader();
      reader.onload = function (e) {
        let index = loadPresetFromJson(JSON.parse(e.target.result));
        if (document.getElementById("import-preset-apply-checkbox").checked) {
          setPreset(-1); // load all defaults
          setPreset(index - 1);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      };
      reader.readAsText(file);
    });

  // grid presets import/export
  document
    .getElementById("open-modal-export-grid-preset-button")
    .addEventListener("click", function () {
      openModal("export-grid-preset-modal");
    });
  document
    .getElementById("export-grid-preset-button")
    .addEventListener("click", function () {
      let name = document.getElementById("export-grid-preset-name-input").value;
      saveGridPresetFileFromCurrentValues(name);
      closeOpenModal();
    });
  document
    .getElementById("open-modal-import-grid-preset-button")
    .addEventListener("click", function () {
      openModal("import-grid-preset-modal");
    });
  document
    .getElementById("import-grid-preset-button")
    .addEventListener("click", function () {
      document.getElementById("import-grid-preset-file-input").click();
      closeOpenModal();
    });
  document
    .getElementById("import-grid-preset-file-input")
    .addEventListener("change", function () {
      const file = document.getElementById("import-grid-preset-file-input")
        .files[0];
      let reader = new FileReader();
      reader.onload = function (e) {
        let index = loadGridPresetFromJson(JSON.parse(e.target.result));
        if (
          document.getElementById("import-grid-preset-apply-checkbox").checked
        ) {
          setGridPreset(index - 1);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      };
      reader.readAsText(file);
    });
  // header presets import/export
  document
    .getElementById("open-modal-export-header-preset-button")
    .addEventListener("click", function () {
      openModal("export-header-preset-modal");
    });
  document
    .getElementById("export-header-preset-button")
    .addEventListener("click", function () {
      let name = document.getElementById(
        "export-header-preset-name-input"
      ).value;
      saveHeaderPresetFileFromCurrentValues(name);
      closeOpenModal();
    });
  document
    .getElementById("open-modal-import-header-preset-button")
    .addEventListener("click", function () {
      openModal("import-header-preset-modal");
    });
  document
    .getElementById("import-header-preset-button")
    .addEventListener("click", function () {
      document.getElementById("import-header-preset-file-input").click();
      closeOpenModal();
    });
  document
    .getElementById("import-header-preset-file-input")
    .addEventListener("change", function () {
      const file = document.getElementById("import-header-preset-file-input")
        .files[0];
      let reader = new FileReader();
      reader.onload = function (e) {
        let index = loadHeaderPresetFromJson(JSON.parse(e.target.result));
        if (
          document.getElementById("import-header-preset-apply-checkbox").checked
        ) {
          setHeaderPreset(index - 1);
          if (document.getElementById("autorefresh-checkbox").checked)
            drawCompositeImage();
        }
      };
      reader.readAsText(file);
    });
}

function saveBase64AsFile(base64, fileName, contentType = "image/png") {
  let link = document.createElement("a");
  document.body.appendChild(link);
  link.setAttribute("type", "hidden");
  link.href = base64;
  link.download = fileName;
  link.click();
  document.body.removeChild(link);
  // function base64ToBlob(base64, contentType = "", sliceSize = 512) {
  //   // ref: https://www.geeksforgeeks.org/how-to-convert-base64-to-blob-in-javascript/
  //   const byteCharacters = atob(base64.split(",")[1]);
  //   const byteArrays = [];
  //   for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
  //     const slice = byteCharacters.slice(offset, offset + sliceSize);
  //     const byteNumbers = new Array(slice.length);
  //     for (let i = 0; i < slice.length; i++) {
  //       byteNumbers[i] = slice.charCodeAt(i);
  //     }
  //     const byteArray = new Uint8Array(byteNumbers);
  //     byteArrays.push(byteArray);
  //   }
  //   const blob = new Blob(byteArrays, { type: contentType });
  //   return blob;
  // }
  // const blob = base64ToBlob(base64, contentType);
  // const url = URL.createObjectURL(blob);
  // const link = document.createElement("a");
  // link.style.display = "none";
  // link.href = url;
  // link.download = fileName;
  // document.body.appendChild(link);
  // link.click();
  // URL.revokeObjectURL(url);
}

function savePresetFileFromCurrentValues(name) {
  let preset = getPresetFromCurrentValues(name);
  saveToFile(
    JSON.stringify(preset, null, 2),
    "template-preset.json",
    "text/plain"
  );
}

function saveGridPresetFileFromCurrentValues(name) {
  let preset = getGridPresetFromCurrentValues(name);
  saveToFile(JSON.stringify(preset, null, 2), "grid-preset.json", "text/plain");
}

function saveHeaderPresetFileFromCurrentValues(name) {
  let preset = getHeaderPresetFromCurrentValues(name);
  saveToFile(
    JSON.stringify(preset, null, 2),
    "header-preset.json",
    "text/plain"
  );
}

// TODO: merge with base64 version?
function saveToFile(content, fileName, contentType) {
  let link = document.createElement("a");
  document.body.appendChild(link);
  link.setAttribute("type", "hidden");
  var file = new Blob([content], { type: contentType });
  link.href = URL.createObjectURL(file);
  link.download = fileName;
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(link.href);
}

function saveCanvasToFile(canvas, fileName, contentType, doOnEnd) {
  canvas.toBlob((blob) => {
    let link = document.createElement("a");
    document.body.appendChild(link);
    link.setAttribute("type", "hidden");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
    if (doOnEnd) doOnEnd();
  }, contentType);
}
