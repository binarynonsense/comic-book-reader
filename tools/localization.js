/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");
const fs = require("fs");

switch (process.argv[2]) {
  case "update":
  case "state":
    updateLocalizationFiles(process.argv[2], process.argv[3]);
    break;
  case "licenses":
    updateLicenseFile();
    break;
  default:
    console.log("operation parameter missing");
    return;
}

function updateLocalizationFiles(operation, languageId) {
  if (operation === "update") console.log("* update localization files *");
  else if (operation === "state")
    console.log("* check localization files' state *");

  if (languageId == undefined) {
    console.log("languageId parameter missing");
    return;
  }

  try {
    const englishData = JSON.parse(
      fs.readFileSync("./src/assets/i18n/en.json", "utf8")
    );
    const folderPath = "./src/assets/i18n/";
    const folderContents = fs.readdirSync("./src/assets/i18n/");
    folderContents.forEach((entryName) => {
      const entryPath = path.join(folderPath, entryName);
      if (
        !fs.lstatSync(entryPath).isDirectory() &&
        (entryName != "en.json" || languageId === "en") &&
        (languageId == "all" || entryName === languageId + ".json")
      ) {
        console.log("-----------------------------");
        console.log(entryPath);
        let entryData = JSON.parse(fs.readFileSync(entryPath, "utf8"));
        const newEntryData = {};
        let missing = 0;
        for (const key in englishData) {
          /////////////////////////////////////////////////////////
          const entryValue = entryData[key];
          // TODO: make it check inside tool-pre-navkeys-actions and potential similar entries
          if (key.startsWith("[NOTE TO")) {
            newEntryData[key] = englishData[key];
          } else if (entryValue === undefined) {
            missing++;
            console.log("missing: " + key);
            newEntryData["[NEEDS TRANSLATION]" + key] = englishData[key];
          } else {
            newEntryData[key] = entryValue;
          }
          /////////////////////////////////////////////////////////
        }
        //console.log(newEntryData);
        if (operation === "state")
          console.log(`there are ${missing} untranslated entries`);
        // save to file
        if (operation === "update") {
          const newJSON = JSON.stringify(newEntryData, null, 2);
          fs.writeFileSync(entryPath, newJSON, "utf-8");
          console.log(entryPath + " has been updated");
        }
        console.log("-----------------------------");
      }
    });
  } catch (error) {
    console.log("something went wrong");
    console.log(error);
  }
}

function updateLicenseFile() {
  try {
    const folderPath = "./src/assets/i18n/";
    const folderContents = fs.readdirSync("./src/assets/i18n/");
    let text = "Localization files:\n\n";
    folderContents.forEach((entryName) => {
      const entryPath = path.join(folderPath, entryName);
      if (
        !fs.lstatSync(entryPath).isDirectory() &&
        entryName.endsWith(".json")
      ) {
        let entryData = JSON.parse(fs.readFileSync(entryPath, "utf8"));
        const name = entryData["@metadata"]["name"];
        const authorsArray = entryData["@metadata"]["authors"];
        let authors = "";
        for (let index = 0; index < authorsArray.length; index++) {
          const author = authorsArray[index];
          authors += author;
          if (index < authorsArray.length - 1) {
            authors += ",";
          }
        }
        const license = entryData["@metadata"]["license-id"];
        text += `language: ${name}\nauthors: ${authors}\nlicense: ${license}\n\n`;
      }
    });
    console.log(text);
    fs.writeFileSync("./licenses/localization.txt", text, "utf-8");
  } catch (error) {
    console.log("something went wrong");
    console.log(error);
  }
}
