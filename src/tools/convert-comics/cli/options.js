/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

exports.getParsedCliOptions = function (launchInfo) {
  // parse command line arguments
  // ref: https://nodejs.org/api/util.html#utilparseargsconfig
  const { parseArgs } = require("node:util");
  let optionsData = getOptionsData();
  const options = {
    ...getParsingOptions(optionsData),
    ...launchInfo.defaultParsingOptions,
  };
  const { values, positionals } = parseArgs({
    args: process.argv.slice(launchInfo.isRelease ? 1 : 2),
    options,
    strict: true,
    allowPositionals: true,
  });
  const parsedOptions = getParsedOptions(optionsData, values);
  return [parsedOptions, positionals];
};

function getParsingOptions(data) {
  let options = {};
  for (const key in data) {
    const entry = data[key];
    if (
      entry !== null &&
      typeof entry === "object" &&
      "defaultValue" in entry
    ) {
      options[entry.cliName] = {
        type: entry.cliType,
      };
    } else {
      // nested option
      Object.assign(options, getParsingOptions(entry));
    }
  }
  return options;
}

function getParsedOptions(data, parsedValues, parentPath = "") {
  let options = {};
  for (const key in data) {
    const entry = data[key];
    if (
      entry !== null &&
      typeof entry === "object" &&
      "defaultValue" in entry
    ) {
      options[key] = entry.defaultValue;
      if (Object.hasOwn(parsedValues, entry.cliName)) {
        let val = parsedValues[entry.cliName];
        // arrays (comma-separated string -> array)
        if (Array.isArray(entry.defaultValue) && typeof val === "string") {
          val = val.split(",").map((s) => s.trim());
        }
        if (
          entry.defaultValue === null ||
          typeof val === typeof entry.defaultValue
        ) {
          options[key] = val;
        }
      }
    } else if (entry !== null && typeof entry === "object") {
      options[key] = getParsedOptions(entry, parsedValues);
    }
  }
  return options;
}

exports.printHelp = function (data) {
  if (!data) data = getOptionsData();
  for (const key in data) {
    const entry = data[key];
    if (
      entry !== null &&
      typeof entry === "object" &&
      "defaultValue" in entry
    ) {
      console.log();
      let displayValue;
      let typeLabel;
      if (Array.isArray(entry.defaultValue)) {
        typeLabel = "values list";
        // e.g.: .cbz,.cbr,.pdf
        displayValue = entry.defaultValue.join(",");
      } else {
        typeLabel = typeof entry.defaultValue;
        if (typeof entry.defaultValue === "boolean") typeLabel = "on switch";
        displayValue = entry.defaultValue;
      }
      console.log(`--${entry.cliName}`);
      if (entry.cliDescription)
        console.log(`    description:  ${entry.cliDescription}`);
      if (typeof entry.defaultValue === "boolean") {
        console.log(`    argument:  none`);
      } else {
        console.log(
          `    arguments:  ${typeLabel === "values list" ? typeLabel : "value"}`,
        );
        console.log(`    default:  ${displayValue}`);
      }
      if (entry.cliType !== "boolean" && entry.validValues)
        console.log(`    valid values:  ${entry.validValues.join(", ")}`);
    } else {
      // nested option
      exports.printHelp(entry);
    }
  }
  return;
};
/////////////////////////

// not really used for now
const ValidType = {
  EXISTING_PATH: "validpath",
  INTEGER: "integer",
};

function getOptionsData() {
  return {
    outputFolderPath: {
      defaultValue: "",
      validValues: undefined,
      validCheck: { type: ValidType.EXISTING_PATH },
      cliName: "output-folder-path",
      cliType: "string",
      // cliDescription: "Path of the folder where the generated files will be saved",
    },
    inputFoldersContain: {
      defaultValue: "comics",
      validValues: ["comics", "images"],
      cliName: "input-folders-contain",
      cliType: "string",
    },
    inputSearchFoldersFormats: {
      defaultValue: [".cbz", ".cbr", ".pdf", ".epub", ".cb7", ".mobi"],
      validValues: [".cbz", ".cbr", ".pdf", ".epub", ".cb7", ".mobi"],
      cliName: "input-search-folders-formats",
      cliType: "string",
    },
    inputSearchFoldersRecursively: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "input-search-folders-recursively",
      cliType: "boolean",
    },
    inputPdfExtractionMethod: {
      defaultValue: "0",
      validValues: ["0", "1"], // dpi, height?
      cliName: "input-pdf-extraction-method",
      cliType: "string",
    },
    inputPdfExtractionDpi: {
      defaultValue: "300",
      validValues: undefined,
      validCheck: { type: ValidType.INTEGER },
      cliName: "input-pdf-extraction-dpi",
      cliType: "string",
    },
    inputPdfExtractionHeight: {
      defaultValue: "3056",
      validValues: undefined,
      cliName: "input-pdf-extraction-height",
      cliType: "string",
    },
    inputPdfExtractionLib: {
      defaultValue: "default",
      validValues: ["default", "mupdf", "pdfjs_older", "pdfjs_newer"],
      cliName: "input-pdf-extraction-lib",
      cliType: "string",
    },
    inputEpubExtraction: {
      bookType: {
        defaultValue: "0",
        validValues: ["0", "1", "2"],
        cliName: "input-epub-extraction-book-type",
        cliType: "string",
      },
      customSize: {
        defaultValue: false,
        validValues: [true, false],
        cliName: "input-epub-extraction-custom-size",
        cliType: "boolean",
      },
      width: {
        defaultValue: "800",
        validValues: undefined,
        cliName: "input-epub-extraction-width",
        cliType: "string",
      },
      height: {
        defaultValue: "1100",
        validValues: undefined,
        cliName: "input-epub-extraction-height",
        cliType: "string",
      },
      margin: {
        defaultValue: "80",
        validValues: undefined,
        cliName: "input-epub-extraction-margin",
        cliType: "string",
      },
      fontSize: {
        defaultValue: "22",
        validValues: undefined,
        cliName: "input-epub-extraction-font-size",
        cliType: "string",
      },
      dpi: {
        defaultValue: "144",
        validValues: undefined,
        cliName: "input-epub-extraction-dpi",
        cliType: "string",
      },
      customColors: {
        defaultValue: false,
        validValues: [true, false],
        cliName: "input-epub-extraction-custom-colors",
        cliType: "boolean",
      },
      colorText: {
        defaultValue: "#000000",
        validValues: undefined,
        cliName: "input-epub-extraction-color-text",
        cliType: "string",
      },
      colorBg: {
        defaultValue: "#ffffff",
        validValues: undefined,
        cliName: "input-epub-extraction-color-bg",
        cliType: "string",
      },
    },
    outputKeepSubfoldersStructure: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "output-keep-subfolders-structure",
      cliType: "boolean",
    },
    outputFolderOption: {
      defaultValue: "0",
      validValues: ["0", "1"],
      cliName: "output-folder-option",
      cliType: "string",
    },
    outputFormat: {
      defaultValue: "cbz",
      validValues: undefined,
      cliName: "output-format",
      cliType: "string",
    },
    outputImageFormat: {
      defaultValue: "not set",
      validValues: undefined,
      cliName: "output-image-format",
      cliType: "string",
    },
    outputFileBaseName: {
      defaultValue: "ComicBook",
      validValues: undefined,
      cliName: "output-file-base-name",
      cliType: "string",
    },
    outputImageScaleOption: {
      defaultValue: "0",
      validValues: ["0", "1", "2"],
      cliName: "output-image-scale-option",
      cliType: "string",
    },
    outputImageScalePercentage: {
      defaultValue: "100",
      validValues: undefined,
      cliName: "output-image-scale-percentage",
      cliType: "string",
    },
    outputImageScaleHeight: {
      defaultValue: "3056",
      validValues: undefined,
      cliName: "output-image-scale-height",
      cliType: "string",
    },
    outputImageScaleWidth: {
      defaultValue: "1988",
      validValues: undefined,
      cliName: "output-image-scale-width",
      cliType: "string",
    },
    outputSplitNumFiles: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "output-split-num-files",
      cliType: "string",
    },
    outputPassword: {
      defaultValue: "",
      validValues: undefined,
      cliName: "output-password",
      cliType: "string",
    },
    outputFileSameName: {
      defaultValue: "rename",
      validValues: ["rename", "skip", "overwrite"],
      cliName: "output-file-same-name",
      cliType: "string",
    },
    outputPageOrder: {
      defaultValue: "byPosition",
      validValues: ["byPosition", "byName"],
      cliName: "output-page-order",
      cliType: "string",
    },
    outputPdfCreationMethod: {
      defaultValue: "metadata",
      validValues: ["metadata", "300dpi", "72dpi"],
      cliName: "output-pdf-creation-method",
      cliType: "string",
    },
    outputEpubCreationImageFormat: {
      defaultValue: "keep-selected",
      validValues: ["keep-selected", "core-media-types-only"],
      cliName: "output-epub-creation-image-format",
      cliType: "string",
    },
    outputEpubCreationImageStorage: {
      defaultValue: "files",
      validValues: ["files", "base64"],
      cliName: "output-epub-creation-image-storage",
      cliType: "string",
    },
    outputImageFormatParams: {
      jpgQuality: {
        defaultValue: "90",
        validValues: undefined,
        cliName: "output-image-format-params-jpg-quality",
        cliType: "string",
      },
      jpgMozjpeg: {
        defaultValue: false,
        validValues: [true, false],
        cliName: "output-image-format-params-jpg-mozjpeg",
        cliType: "boolean",
      },
      pngQuality: {
        defaultValue: "100",
        validValues: undefined,
        cliName: "output-image-format-params-png-quality",
        cliType: "string",
      },
      avifQuality: {
        defaultValue: "50",
        validValues: undefined,
        cliName: "output-image-format-params-avif-quality",
        cliType: "string",
      },
      webpQuality: {
        defaultValue: "80",
        validValues: undefined,
        cliName: "output-image-format-params-webp-quality",
        cliType: "string",
      },
    },
    outputLevelsApply: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "output-levels-apply",
      cliType: "boolean",
    },
    outputBlackLevelValue: {
      defaultValue: "0",
      validValues: undefined,
      cliName: "output-black-level-value",
      cliType: "string",
    },
    outputWhiteLevelValue: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "output-white-level-value",
      cliType: "string",
    },
    outputBrightnessApply: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "output-brightness-apply",
      cliType: "boolean",
    },
    outputBrightnessMultiplier: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "output-brightness-multiplier",
      cliType: "string",
    },
    outputSaturationApply: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "output-saturation-apply",
      cliType: "boolean",
    },
    outputSaturationMultiplier: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "output-saturation-multiplier",
      cliType: "string",
    },
    outputCropApply: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "output-crop-apply",
      cliType: "boolean",
    },
    outputCropValue: {
      defaultValue: "0",
      validValues: undefined,
      cliName: "output-crop-value",
      cliType: "string",
    },
    outputExtendApply: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "output-extend-apply",
      cliType: "boolean",
    },
    outputExtendValue: {
      defaultValue: "0",
      validValues: undefined,
      cliName: "output-extend-value",
      cliType: "string",
    },
    outputExtendColor: {
      defaultValue: "#000000",
      validValues: undefined,
      cliName: "output-extend-color",
      cliType: "string",
    },
    imageProcessingMultithreadingMethod: {
      defaultValue: "0",
      validValues: undefined,
      cliName: "image-processing-multithreading-method",
      cliType: "string",
    },
    imageProcessingNumWorkers: {
      defaultValue: "4",
      validValues: undefined,
      cliName: "image-processing-num-workers",
      cliType: "string",
    },
    imageProcessingSharpConcurrency: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "image-processing-sharp-concurrency",
      cliType: "string",
    },
  };
}

// function generateToolOptionsFromData(data) {
//   const options = {};
//   for (const key in data) {
//     const entry = data[key];
//     if (
//       entry !== null &&
//       typeof entry === "object" &&
//       "defaultValue" in entry
//     ) {
//       options[key] = entry.defaultValue;
//     } else if (entry !== null && typeof entry === "object") {
//       options[key] = generateToolOptionsFromData(entry);
//     }
//   }
//   return options;
// }

// let g_defaultOptions = {
//   outputFolderPath: "",
//   inputFoldersContain: "comics",
//   inputSearchFoldersFormats: [".cbz", ".cbr", ".pdf", ".epub", ".cb7"],
//   inputSearchFoldersRecursively: false,
//   inputPdfExtractionMethod: "0",
//   inputPdfExtractionDpi: "300",
//   inputPdfExtractionHeight: "3056",
//   inputPdfExtractionLib: "default",
//   inputEpubExtraction: {
//     bookType: "0",
//     customSize: false,
//     width: "800",
//     height: "1100",
//     margin: "80",
//     fontSize: "22",
//     dpi: "144",
//     customColors: false,
//     colorText: "#000000",
//     colorBg: "#ffffff",
//   },
//   outputKeepSubfoldersStructure: false,
//   outputFolderOption: "0",
//   outputFormat: "cbz",
//   outputImageFormat: "not set",
//   outputFileBaseName: "ComicBook",
//   outputImageScaleOption: "0",
//   outputImageScalePercentage: "100",
//   outputImageScaleHeight: "3056",
//   outputImageScaleWidth: "1988",
//   outputSplitNumFiles: "1",
//   outputPassword: "",
//   outputFileSameName: "rename",
//   outputPageOrder: "byPosition",
//   outputPdfCreationMethod: "metadata",
//   outputEpubCreationImageFormat: "keep-selected",
//   outputEpubCreationImageStorage: "files",
//   outputImageFormatParams: {
//     jpgQuality: "90",
//     jpgMozjpeg: false,
//     pngQuality: "100",
//     avifQuality: "50",
//     webpQuality: "80",
//   },
//   outputLevelsApply: false,
//   outputBlackLevelValue: "0",
//   outputWhiteLevelValue: "1",
//   outputBrightnessApply: false,
//   outputBrightnessMultiplier: "1",
//   outputSaturationApply: false,
//   outputSaturationMultiplier: "1",
//   outputCropApply: false,
//   outputCropValue: "0",
//   outputExtendApply: false,
//   outputExtendValue: "0",
//   outputExtendColor: "#000000",
//   imageProcessingMultithreadingMethod: "0",
//   imageProcessingNumWorkers: "4",
//   imageProcessingSharpConcurrency: "1",
// };
