/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// This tool is used to generate test localization files using a external machine
// translation tool, like Google Translate.
// Don't use to generate official translations for ACBR!!! Only human made ones
// are accepted.
// Usage:
// 1) run "npm run translate extract" to generate values.txt and values_keys.json
// 2) translate values.txt with the tool of your choice and save the results in
// values_translated.txt
// 3) run "npm run translate reconstruct" to generate out.json, which contains
// the resulting localization file
// 4) change its name and modify the metadata

const fs = require("node:fs");
const path = require("node:path");

const enLocalizationPath = path.resolve("./src/assets/i18n/en.json");
const valuesTxtPath = path.resolve("./tools/values.txt");
const valuesKeysJsonPath = path.resolve("./tools/values_keys.json");
const valuesTranslatedTxtPath = path.resolve("./tools/values_translated.txt");
const outJsonPath = path.resolve("./tools/out.json");

const LINE_BREAK_PLACEHOLDER = "[[1234]]";

switch (process.argv[2]) {
  case "extract":
    extractValuesForTranslation();
    break;
  case "reconstruct":
    reconstructJsonFromTranslation();
    break;
  default:
    console.log("usage: npm run translate [extract|reconstruct]");
    process.exit(1);
}

function extractValuesForTranslation() {
  const enData = JSON.parse(fs.readFileSync(enLocalizationPath, "utf-8"));
  const valueKeysToTranslate = [];

  function extractKeysAndValues(section, parentKey = "") {
    for (const key in section) {
      if (key === "@metadata") continue;
      if (key.startsWith("[NOTE TO TRANSLATORS]")) continue;

      const value = section[key];
      // use a dot as the separator to generate a key "path" for nested objects
      // so things cane later be reconstructed in the right place
      const fullKey = parentKey ? `${parentKey}.${key}` : key;

      if (typeof value === "string") {
        // NOTE: don't think \r? will be needed, but just in case
        // NOTE: some values can include \n, replace it with a placeholder
        // to be able to add it back withput it being lost during the
        // translation
        const sanitizededValue = value.replace(
          /\r?\n/g,
          LINE_BREAK_PLACEHOLDER,
        );
        valueKeysToTranslate.push({
          keyPath: fullKey,
          value: sanitizededValue,
        });
      } else if (typeof value === "object" && value !== null) {
        extractKeysAndValues(value, fullKey);
      }
    }
  }

  extractKeysAndValues(enData);

  fs.writeFileSync(
    valuesTxtPath,
    valueKeysToTranslate.map((entry) => entry.value).join("\n"),
    "utf-8",
  );

  fs.writeFileSync(
    valuesKeysJsonPath,
    JSON.stringify(
      valueKeysToTranslate.map((entry) => entry.keyPath),
      null,
      2, // indent with 2 spaces
    ),
    "utf-8",
  );

  console.log(
    `extracted ${valueKeysToTranslate.length} values to: ${valuesTxtPath}`,
  );
}

function reconstructJsonFromTranslation() {
  const enData = JSON.parse(fs.readFileSync(enLocalizationPath, "utf-8"));
  // ref: https://en.wikipedia.org/wiki/Byte_order_mark
  const raw = fs
    .readFileSync(valuesTranslatedTxtPath, "utf-8")
    .replace(/^\uFEFF/, "") // remove BOM mark (from libreoffice for example)
    .replace(/\r/g, ""); // remove \r so the next split always works

  const keyPaths = JSON.parse(fs.readFileSync(valuesKeysJsonPath, "utf-8"));

  let translatedLines = raw.split("\n");
  // remove trailing empty line ONLY if it's an extra one, as I'm allowing
  // empty values just in case (although ideally there shouldn't be?)
  if (
    translatedLines.length === keyPaths.length + 1 &&
    translatedLines[translatedLines.length - 1] === ""
  ) {
    translatedLines.pop();
  }
  // remove potential BOM marks at the start of individual lines
  translatedLines = translatedLines.map((line) => line.replace(/^\uFEFF/, ""));

  if (translatedLines.length !== keyPaths.length) {
    console.error(
      "error: number of translated lines does not match number of keys!",
    );
    console.log("translated lines:", translatedLines.length);
    console.log("key paths:", keyPaths.length);
    process.exit(1);
  }

  const translatedMap = {};
  keyPaths.forEach((key, i) => {
    translatedMap[key] = translatedLines[i].replace(
      new RegExp(LINE_BREAK_PLACEHOLDER, "g"),
      "\n",
    );
  });

  function applyTranslations(section, parentKey = "") {
    for (const key in section) {
      if (key === "@metadata") continue;
      if (key.startsWith("[NOTE TO TRANSLATORS]")) continue;

      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      const value = section[key];

      if (typeof value === "string") {
        // NOTE: empty string "" is a valid value
        // same as translatedMap.hasOwnProperty(fullKey), but safer
        if (Object.prototype.hasOwnProperty.call(translatedMap, fullKey)) {
          section[key] = translatedMap[fullKey];
        }
      } else if (typeof value === "object" && value !== null) {
        applyTranslations(value, fullKey);
      }
    }
  }

  applyTranslations(enData);
  fs.writeFileSync(outJsonPath, JSON.stringify(enData, null, 2), "utf-8");
  console.log(`new localization .json saved to: ${outJsonPath}`);
}
