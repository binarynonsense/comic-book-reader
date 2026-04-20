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
  const toolParsingOptions = getDefaultsAsParsingOptions(g_defaultToolOptions);
  const options = {
    ...toolParsingOptions,
    ...launchInfo.defaultParsingOptions,
  };
  const { values, positionals } = parseArgs({
    args: process.argv.slice(launchInfo.isRelease ? 1 : 2),
    options,
    strict: true,
    allowPositionals: true,
  });
  const parsedOptions = getParsedOptions(g_defaultToolOptions, values);
  return [parsedOptions, positionals];
};

function getDefaultsAsParsingOptions(obj, parentKey = "") {
  let options = {};
  for (const [key, value] of Object.entries(obj)) {
    // camelCase to kebab-case (e.g.: outputFormat -> output-format)
    const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const fullKey = parentKey ? `${parentKey}-${kebabKey}` : kebabKey;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // nested objects, like outputImageFormatParams
      Object.assign(options, getDefaultsAsParsingOptions(value, fullKey));
    } else {
      options[fullKey] = {
        type: typeof value === "boolean" ? "boolean" : "string",
      };
    }
  }
  return options;
}

function getParsedOptions(defaults, parsedArgs, parentPath = "") {
  const result = structuredClone(defaults);
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const fullKey = parentPath ? `${parentPath}-${kebabKey}` : kebabKey;
    if (
      defaultValue !== null &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      // nested objects
      result[key] = getParsedOptions(defaultValue, parsedArgs, fullKey);
    } else if (Object.hasOwn(parsedArgs, fullKey)) {
      let val = parsedArgs[fullKey];
      // arrays (comma-separated string -> array)
      if (Array.isArray(defaultValue) && typeof val === "string") {
        val = val.split(",").map((s) => s.trim());
      }
      if (defaultValue === null || typeof val === typeof defaultValue) {
        result[key] = val;
      }
    }
  }
  return result;
}

function printCliDocumentation(options, parentPath = "") {
  if (!options) options = structuredClone(g_defaultToolOptions);
  for (const [key, value] of Object.entries(options)) {
    const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const fullKey = parentPath ? `${parentPath}-${kebabKey}` : kebabKey;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      printCliDocumentation(value, fullKey);
    } else {
      let displayValue;
      let typeLabel;
      if (Array.isArray(value)) {
        typeLabel = "list";
        // e.g.: .cbz,.cbr,.pdf
        displayValue = value.join(",");
      } else {
        typeLabel = typeof value;
        displayValue = value;
      }
      console.log(
        `--${fullKey.padEnd(45)} [${typeLabel}] (Default: ${displayValue})`,
      );
    }
  }
}
exports.printCliDocumentation = printCliDocumentation;

let g_defaultToolOptions = {
  outputFolderPath: "",
  inputFoldersContain: "comics",
  inputSearchFoldersFormats: [".cbz", ".cbr", ".pdf", ".epub", ".cb7"],
  inputSearchFoldersRecursively: false,
  inputPdfExtractionMethod: "0",
  inputPdfExtractionDpi: "300",
  inputPdfExtractionHeight: "3056",
  inputPdfExtractionLib: "default",
  inputEpubExtraction: {
    bookType: "0",
    customSize: false,
    width: "800",
    height: "1100",
    margin: "80",
    fontSize: "22",
    dpi: "144",
    customColors: false,
    colorText: "#000000",
    colorBg: "#ffffff",
  },
  outputKeepSubfoldersStructure: false,
  outputFolderOption: "0",
  outputFormat: "cbz",
  outputImageFormat: "not set",
  outputFileBaseName: "",
  outputImageScaleOption: "0",
  outputImageScalePercentage: "100",
  outputImageScaleHeight: "3056",
  outputImageScaleWidth: "1988",
  outputSplitNumFiles: "1",
  outputPassword: "",
  outputFileSameName: "rename",
  outputPageOrder: "byPosition",
  outputPdfCreationMethod: "metadata",
  outputEpubCreationImageFormat: "keep-selected",
  outputEpubCreationImageStorage: "files",
  outputImageFormatParams: {
    jpgQuality: "90",
    jpgMozjpeg: false,
    pngQuality: "100",
    avifQuality: "50",
    webpQuality: "80",
  },
  outputLevelsApply: false,
  outputBlackLevelValue: "0",
  outputWhiteLevelValue: "1",
  outputBrightnessApply: false,
  outputBrightnessMultiplier: "1",
  outputSaturationApply: false,
  outputSaturationMultiplier: "1",
  outputCropApply: false,
  outputCropValue: "0",
  outputExtendApply: false,
  outputExtendValue: "0",
  outputExtendColor: "#000000",
  imageProcessingMultithreadingMethod: "0",
  imageProcessingNumWorkers: "4",
  imageProcessingSharpConcurrency: "1",
};
