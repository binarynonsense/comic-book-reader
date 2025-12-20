/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");
const fs = require("fs");

const settings = require("./settings");
const appUtils = require("./app-utils");
const log = require("./logger");
const reader = require("../../reader/main");

let g_themeId;
let g_themeData;

let g_defaultThemeId = "acbr-dark";

exports.init = function () {
  load(settings.getValue("theme"));
  appUtils.setNativeThemeUpdateEventHandler(() => {
    load(settings.getValue("theme"), true);
  });
};

exports.getId = function () {
  return g_themeId;
};

exports.getData = function () {
  return g_themeData;
};

function load(themeId, refresh = false) {
  log.debug("loading theme: " + themeId);
  if (themeId === "acbr-auto-system") {
    const useDarkColors = appUtils.getShouldUseDarkColors();
    let realThemeId;
    if (useDarkColors) {
      realThemeId = "acbr-dark";
    } else {
      realThemeId = "acbr-light";
    }
    let data = loadDataFromId(realThemeId);
    if (data !== undefined) {
      g_themeId = themeId;
      g_themeData = data;
      if (refresh) {
        reader.sendIpcToCoreRenderer("update-css-properties", g_themeData);
        reader.rebuildMenuAndToolBars(false);
      }
      return;
    }
  }
  //
  let data = loadDataFromId(themeId);
  if (data !== undefined) {
    g_themeId = themeId;
    g_themeData = data;
    if (refresh) {
      reader.sendIpcToCoreRenderer("update-css-properties", g_themeData);
      reader.rebuildMenuAndToolBars(false);
    }
    return;
  }
  // nothing found, load the default theme
  g_themeId = g_defaultThemeId;
  g_themeData = loadDataFromId(g_themeId);
  settings.setValue("theme", g_themeId);
  if (refresh) {
    reader.sendIpcToCoreRenderer("update-css-properties", g_themeData);
    reader.rebuildMenuAndToolBars(false);
  }
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
