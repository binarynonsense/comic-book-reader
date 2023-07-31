/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");
const fs = require("fs");

const settings = require("./settings");

let g_themeId;
let g_themeData;

let g_defaultThemeId = "acbr-dark";

exports.init = function () {
  load(settings.getValue("theme"));
  settings.setValue("theme", g_themeId);
};

exports.getId = function () {
  return g_themeId;
};

exports.getData = function () {
  return g_themeData;
};

function load(desiredTheme) {
  let theme = desiredTheme;
  let data = loadDataFromId(theme);
  if (data !== undefined) {
    g_themeId = theme;
    g_themeData = data;
    return;
  }
  // nothing found, load the default theme
  g_themeId = g_defaultThemeId;
  g_themeData = loadDataFromId(g_themeId);
}
exports.load = load;

function loadDataFromId(themeId) {
  if (themeId === undefined) {
    return undefined;
  }
  let dataPath = path.join(
    __dirname,
    "../../assets/themes/" + themeId + ".json"
  );
  if (!fs.existsSync(dataPath)) {
    return undefined;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return data;
  } catch (e) {
    return undefined;
  }
}

exports.getAvailableList = function () {
  return getListFromFolder(path.join(__dirname, "../../assets/themes/"));
};

function getListFromFolder(folderPath) {
  let themesList = [];
  if (fs.existsSync(folderPath)) {
    let filesInFolder = fs.readdirSync(folderPath);
    if (filesInFolder.length === 0) {
      return themesList;
    } else {
      for (let file of filesInFolder) {
        try {
          let data = JSON.parse(
            fs.readFileSync(path.join(folderPath, file), "utf8")
          );
          if (
            data !== undefined &&
            data["@metadata"] !== undefined &&
            data["@metadata"]["name"] !== undefined
          ) {
            let themeInfo = {
              name: data["@metadata"]["name"],
              filename: path.basename(file, ".json"),
            };
            themesList.push(themeInfo);
          }
        } catch (e) {
          // just ignore file
        }
      }
    }
  }
  return themesList;
}
