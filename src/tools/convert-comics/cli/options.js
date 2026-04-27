/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");

const { _ } = require("../../../shared/main/i18n");

exports.getParsedCliOptions = function (launchInfo) {
  // parse command line arguments
  // ref: https://nodejs.org/api/util.html#utilparseargsconfig
  const { parseArgs } = require("node:util");
  let optionsData = getOptionsData(launchInfo);
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
        let parsedValue = parsedValues[entry.cliName];
        // arrays (comma-separated string -> array)
        if (
          Array.isArray(entry.defaultValue) &&
          typeof parsedValue === "string"
        ) {
          parsedValue = parsedValue.split(",").map((s) => s.trim());
        }
        //// check validity ////////////////////////////////////////////////
        if (entry.validCheck) {
          const check = entry.validCheck;
          let invalid = false;
          let reason;
          switch (check.type) {
            case ValidType.EXISTING_DIR_PATH:
              if (
                !(
                  parsedValue &&
                  fs.existsSync(parsedValue) &&
                  fs.lstatSync(parsedValue).isDirectory()
                )
              ) {
                invalid = true;
                reason = "the folder doesn't exist";
              }
              break;
          }
          if (invalid) {
            throw `Invalid value for --${entry.cliName}${reason ? ` (${reason})` : ""}: ${parsedValue}`;
          }
        } else if (entry.validValues) {
          if (Array.isArray(parsedValue)) {
            parsedValue.forEach((element) => {
              if (!entry.validValues.includes(element)) {
                throw `Invalid value for --${entry.cliName}: ${element}`;
              }
            });
          } else {
            if (!entry.validValues.includes(parsedValue)) {
              throw `Invalid value for --${entry.cliName}: ${parsedValue}`;
            }
          }
        }
        ////////////////////////////////////////////////////////////////////
        if (
          entry.defaultValue === null ||
          typeof parsedValue === typeof entry.defaultValue
        ) {
          if (entry.setOption) {
            if (entry.setOption.parentKey) {
              if (!options[entry.setOption.parentKey])
                options[entry.setOption.parentKey] = {};
              options[entry.setOption.parentKey][entry.setOption.key] =
                entry.setOption.value;
            } else {
              options[entry.setOption.key] = entry.setOption.value;
            }
          }
          options[key] = parsedValue;
        }
      }
    } else if (entry !== null && typeof entry === "object") {
      options[key] = getParsedOptions(entry, parsedValues);
    }
  }
  return options;
}

exports.printHelp = function (launchInfo, data) {
  if (!data) data = getOptionsData(launchInfo);
  for (const key in data) {
    const entry = data[key];
    if (
      entry !== null &&
      typeof entry === "object" &&
      "defaultValue" in entry
    ) {
      if (!("cliName" in entry)) continue;
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
      if (typeof entry.defaultValue === "boolean") {
        console.log(`    argument:  none`);
      } else {
        if (typeLabel === "values list") {
          console.log(`    arguments:  values list`);
          console.log(`    default values list:`);
        } else {
          console.log(`    arguments:  value`);
          console.log(`    default value:`);
        }

        console.log(`      "${displayValue}"`);
      }
      if (entry.cliType !== "boolean" && entry.validValues) {
        console.log(`    valid values:`);
        entry.validValues.forEach((element) => {
          console.log(`      "${element}"`);
        });
      }
      if (entry.cliDescription)
        console.log(`    description:  ${entry.cliDescription}`);
    } else {
      // nested option
      exports.printHelp(launchInfo, entry);
    }
  }
  return;
};
/////////////////////////

// not really used for now
const ValidType = {
  EXISTING_DIR_PATH: "validpath",
  INTEGER: "integer",
};

function getOptionsData(launchInfo) {
  return {
    outputFolderOption: {
      defaultValue: "0",
      validValues: ["0", "1"],
      cliName: "output-folder-option",
      cliType: "string",
      cliDescription: `"0" = ${_("tool-shared-ui-output-folder-0")}; "1" = ${_("tool-shared-ui-output-folder-1")}`,
    },
    outputFolderPath: {
      defaultValue: "",
      validValues: undefined,
      validCheck: { type: ValidType.EXISTING_DIR_PATH },
      cliName: "output-folder-path",
      cliType: "string",
      cliDescription: `Path of the folder where the generated files will be saved to. Only used if --output-folder-option is set to "0".`,
    },
    outputFormat: {
      defaultValue: "cbz",
      validValues: [
        "cbz",
        "cb7",
        "epub",
        "pdf",
        ...(launchInfo.canEditRars ? ["cbr"] : []),
      ],
      cliName: "output-format",
      cliType: "string",
    },
    outputImageFormat: {
      defaultValue: "not_set",
      validValues: ["not_set", "jpg", "png", "webp", "avif"],
      cliName: "output-image-format",
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
    ///////////////////////////////////////
    outputImageScaleOption: {
      // HIDDEN
      defaultValue: "0",
      validValues: ["0", "1", "2"],
      //cliName: "output-image-scale-option",
      cliType: "string",
    },
    outputImageScalePercentage: {
      defaultValue: "100",
      validValues: undefined,
      cliName: "output-image-scale-percentage",
      cliType: "string",
      setOption: { key: "outputImageScaleOption", value: "0" },
    },
    outputImageScaleHeight: {
      defaultValue: "3056",
      validValues: undefined,
      cliName: "output-image-scale-height",
      cliType: "string",
      setOption: { key: "outputImageScaleOption", value: "1" },
    },
    outputImageScaleWidth: {
      defaultValue: "1988",
      validValues: undefined,
      cliName: "output-image-scale-width",
      cliType: "string",
      setOption: { key: "outputImageScaleOption", value: "2" },
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
      cliDescription: `Determines what to do if there's already a file with the same path as the output file.`,
    },
    ///////////////////////////////////////
    outputFileBaseName: {
      defaultValue: "ComicBook",
      validValues: undefined,
      cliName: "output-file-base-name",
      cliType: "string",
      cliDescription: `Only used if --tool is set to "create-comic".`,
    },
    outputPageOrder: {
      defaultValue: "byPosition",
      validValues: ["byPosition", "byName"],
      cliName: "output-page-order",
      cliType: "string",
      cliDescription: `Only used if --tool is set to "create-comic".`,
    },
    ///////////////////////////////////////
    inputSearchFoldersRecursively: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "input-search-folders-recursively",
      cliType: "boolean",
    },
    inputFoldersContain: {
      defaultValue: "comics",
      validValues: ["comics", "images"],
      cliName: "input-folders-contain",
      cliType: "string",
      cliDescription: `Only used if --input-search-folders-recursively is set.`,
    },
    inputSearchFoldersFormats: {
      defaultValue: [".cbz", ".cbr", ".pdf", ".epub", ".cb7"],
      validValues: [".cbz", ".cbr", ".pdf", ".epub", ".cb7", ".mobi"],
      cliName: "input-search-folders-formats",
      cliType: "string",
      cliDescription: `Only used if --input-search-folders-recursively is set.`,
    },
    outputKeepSubfoldersStructure: {
      defaultValue: false,
      validValues: [true, false],
      cliName: "output-keep-subfolders-structure",
      cliType: "boolean",
    },
    ///////////////////////////////////////
    imageProcessingMultithreadingMethod: {
      defaultValue: "0",
      validValues: ["0", "1"],
      cliName: "image-processing-multithreading-method",
      cliType: "string",
      cliDescription: `"0" = ${_("tool-shared-ui-imageprocessing-multithreading-method-0")}; "1" = ${_("tool-shared-ui-imageprocessing-multithreading-method-1")}`,
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
    ///////////////////////////////////////
    inputPdfExtractionMethod: {
      // HIDDEN
      defaultValue: "0",
      validValues: ["0", "1"], // dpi, height?
      //cliName: "input-pdf-extraction-method",
      cliType: "string",
    },
    inputPdfExtractionDpi: {
      defaultValue: "300",
      validValues: undefined,
      validCheck: { type: ValidType.INTEGER },
      cliName: "input-pdf-extraction-dpi",
      cliType: "string",
      setOption: { key: "inputPdfExtractionMethod", value: "0" },
    },
    inputPdfExtractionHeight: {
      defaultValue: "3056",
      validValues: undefined,
      cliName: "input-pdf-extraction-height",
      cliType: "string",
      setOption: { key: "inputPdfExtractionMethod", value: "1" },
    },
    inputPdfExtractionLib: {
      defaultValue: "default",
      validValues: ["default", "mupdf", "pdfjs_older", "pdfjs_newer"],
      cliName: "input-pdf-extraction-lib",
      cliType: "string",
    },
    ///////////////////////////////////////
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
    ///////////////////////////////////////
    inputEpubExtraction: {
      bookType: {
        defaultValue: "0",
        validValues: ["0", "1", "2"],
        cliName: "input-epub-extraction-book-type",
        cliType: "string",
        cliDescription: `"0" = autodetect; "1" = comic book; "2" = ebook`,
      },
      customSize: {
        // HIDDEN
        defaultValue: false,
        validValues: [true, false],
        // cliName: "input-epub-extraction-custom-size",
        cliType: "boolean",
      },
      width: {
        defaultValue: "800",
        validValues: undefined,
        cliName: "input-epub-extraction-width",
        cliType: "string",
        setOption: {
          key: "customSize",
          parentKey: "inputEpubExtraction",
          value: true,
        },
      },
      height: {
        defaultValue: "1100",
        validValues: undefined,
        cliName: "input-epub-extraction-height",
        cliType: "string",
        setOption: {
          key: "customSize",
          parentKey: "inputEpubExtraction",
          value: true,
        },
      },
      margin: {
        defaultValue: "80",
        validValues: undefined,
        cliName: "input-epub-extraction-margin",
        cliType: "string",
        setOption: {
          key: "customSize",
          parentKey: "inputEpubExtraction",
          value: true,
        },
      },
      fontSize: {
        defaultValue: "22",
        validValues: undefined,
        cliName: "input-epub-extraction-font-size",
        cliType: "string",
        setOption: {
          key: "customSize",
          parentKey: "inputEpubExtraction",
          value: true,
        },
      },
      dpi: {
        defaultValue: "144",
        validValues: undefined,
        cliName: "input-epub-extraction-dpi",
        cliType: "string",
        setOption: {
          key: "customSize",
          parentKey: "inputEpubExtraction",
          value: true,
        },
      },
      customColors: {
        // HIDDEN
        defaultValue: false,
        validValues: [true, false],
        // cliName: "input-epub-extraction-custom-colors",
        cliType: "boolean",
      },
      colorText: {
        defaultValue: "#000000",
        validValues: undefined,
        cliName: "input-epub-extraction-color-text",
        cliType: "string",
        setOption: {
          key: "customColors",
          parentKey: "inputEpubExtraction",
          value: true,
        },
      },
      colorBg: {
        defaultValue: "#ffffff",
        validValues: undefined,
        cliName: "input-epub-extraction-color-bg",
        cliType: "string",
        setOption: {
          key: "customColors",
          parentKey: "inputEpubExtraction",
          value: true,
        },
      },
    },
    ///////////////////////////////////////
    outputLevelsApply: {
      // HIDDEN
      defaultValue: false,
      validValues: [true, false],
      //cliName: "output-levels-apply",
      cliType: "boolean",
    },
    outputBlackLevelValue: {
      defaultValue: "0",
      validValues: undefined,
      cliName: "output-black-level-value",
      cliType: "string",
      setOption: {
        key: "outputLevelsApply",
        value: true,
      },
    },
    outputWhiteLevelValue: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "output-white-level-value",
      cliType: "string",
      setOption: {
        key: "outputLevelsApply",
        value: true,
      },
    },
    outputBrightnessApply: {
      // HIDDEN
      defaultValue: false,
      validValues: [true, false],
      //cliName: "output-brightness-apply",
      cliType: "boolean",
    },
    outputBrightnessMultiplier: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "output-brightness-multiplier",
      cliType: "string",
      setOption: {
        key: "outputBrightnessApply",
        value: true,
      },
    },
    outputSaturationApply: {
      // HIDDEN
      defaultValue: false,
      validValues: [true, false],
      //cliName: "output-saturation-apply",
      cliType: "boolean",
    },
    outputSaturationMultiplier: {
      defaultValue: "1",
      validValues: undefined,
      cliName: "output-saturation-multiplier",
      cliType: "string",
      setOption: {
        key: "outputSaturationApply",
        value: true,
      },
    },
    outputCropApply: {
      // HIDDEN
      defaultValue: false,
      validValues: [true, false],
      //cliName: "output-crop-apply",
      cliType: "boolean",
    },
    outputCropValue: {
      defaultValue: "0",
      validValues: undefined,
      cliName: "output-crop-value",
      cliType: "string",
      setOption: {
        key: "outputCropApply",
        value: true,
      },
    },
    outputExtendApply: {
      // HIDDEN
      defaultValue: false,
      validValues: [true, false],
      //cliName: "output-extend-apply",
      cliType: "boolean",
    },
    outputExtendValue: {
      defaultValue: "0",
      validValues: undefined,
      cliName: "output-extend-value",
      cliType: "string",
      setOption: {
        key: "outputExtendApply",
        value: true,
      },
    },
    outputExtendColor: {
      defaultValue: "#000000",
      validValues: undefined,
      cliName: "output-extend-color",
      cliType: "string",
      setOption: {
        key: "outputExtendApply",
        value: true,
      },
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
