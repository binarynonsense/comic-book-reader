/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const sanitizeHtml = require("sanitize-html");

const settings = require("./settings");

let g_loadedLocale;
let g_loadedLocaleData;
let g_englishData;
let g_userDataLocalesPath;
let g_isDev = false;

// ref: https://www.electronjs.org/docs/api/locales
// ref: https://www.christianengvall.se/electron-localization/

exports.init = function (isDev) {
  g_isDev = isDev;
  g_userDataLocalesPath = path.join(app.getPath("userData"), "i18n/");
  if (settings.getValue("locale") === undefined) {
    settings.setValue("locale", loadLocale(app.getLocale()));
  } else {
    settings.setValue("locale", loadLocale(settings.getValue("locale")));
  }
};

exports.getLoadedLocale = function () {
  return g_loadedLocale;
};

exports.getLoadedLocaleData = function () {
  return g_loadedLocaleData;
};

function loadLocale(desiredLocale) {
  if (g_englishData === undefined) {
    g_englishData = getLocaleData("en");
  }

  let locale = desiredLocale;
  if (locale !== undefined) {
    let data = getLocaleData(locale);
    if (data !== undefined) {
      g_loadedLocale = locale;
      g_loadedLocaleData = data;
      return g_loadedLocale;
    }
    if (locale.includes("-")) {
      let splitted = locale.split("-");
      if (splitted.length > 1) {
        // from "en-US" to "en" for example
        locale = splitted[0];
        data = getLocaleData(locale);
        if (data !== undefined) {
          g_loadedLocale = locale;
          g_loadedLocaleData = data;
          return g_loadedLocale;
        }
      }
    }
    // nothing found, load "en"
    g_loadedLocale = "en";
    g_loadedLocaleData = getLocaleData(g_loadedLocale); // could use g_englishData.slice()
    return g_loadedLocale;
  }
}
exports.loadLocale = loadLocale;

function getLocaleData(locale) {
  let dataPath = path.join(__dirname, "../../assets/i18n/" + locale + ".json");
  if (!fs.existsSync(dataPath)) {
    dataPath = path.join(g_userDataLocalesPath + locale + ".json");
    if (!fs.existsSync) {
      return undefined;
    }
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return data;
  } catch (e) {
    return undefined;
  }
}

exports.getAvailableLocales = function () {
  let localesList = [];
  // official locales
  localesList = getLocalesFromFolder(
    path.join(__dirname, "../../assets/i18n/")
  );
  // if (
  //   g_userDataLocalesPath !== undefined &&
  //   fs.existsSync(g_userDataLocalesPath)
  // ) {
  //   // user locales
  //   let userLocalesList = getLocalesFromFolder(g_userDataLocalesPath);
  //   for (let index = 0; index < userLocalesList.length; index++) {
  //     const userLocale = userLocalesList[index];
  //     let found = false;
  //     for (let index = localesList.length - 1; index >= 0; index--) {
  //       const locale = localesList[index];
  //       if (locale.locale === userLocale.locale) {
  //         found = true;
  //         break;
  //       }
  //     }
  //     if (!found) {
  //       localesList.push(userLocale);
  //     }
  //   }
  // }
  return localesList;
};

function getLocalesFromFolder(folderPath) {
  let localesList = [];
  if (fs.existsSync(folderPath)) {
    let filesInFolder = fs.readdirSync(folderPath);
    if (filesInFolder.length === 0) {
      return localesList;
    } else {
      for (let file of filesInFolder) {
        try {
          let data = JSON.parse(
            fs.readFileSync(path.join(folderPath, file), "utf8")
          );
          if (
            data !== undefined &&
            data["@metadata"] !== undefined &&
            data["@metadata"]["native-name"] !== undefined &&
            data["@metadata"]["locale"] !== undefined &&
            (g_isDev || data["@metadata"]["pre-release"] === "false")
          ) {
            let localeInfo = {
              nativeName: data["@metadata"]["native-name"],
              locale: data["@metadata"]["locale"],
              acbrVersion: data["@metadata"]["acbr-version"],
              outdatedText: data["tool-pre-language-incomplete"],
            };
            localesList.push(localeInfo);
          }
        } catch (e) {
          // just ignore file
        }
      }
    }
  }
  return localesList;
}

exports._ = function (...args) {
  // e.g. [ "Error: {0} file/s couldn't be converted", 0 ]
  let translatedText = g_loadedLocaleData[args[0]];
  if (translatedText === undefined || typeof translatedText !== "string") {
    translatedText = g_englishData[args[0]];
    if (translatedText === undefined) {
      // use the sent text as nothing else was found
      translatedText = args[0];
    }
  }
  if (args.length > 1) {
    //{0},{1}... substitution with extra args
    args[0] = translatedText;
    translatedText = translatedText.myFormatString(args);
  } else {
  }
  return sanitizeHtml(translatedText, {
    allowedTags: [],
    allowedClasses: {},
  });
};

exports._raw = function (key, enIfUndefined = true) {
  let data = g_loadedLocaleData[key];
  if (data === undefined && enIfUndefined) {
    data = g_englishData[key];
  }
  return data;
};

exports._object = function (key) {
  let data = g_loadedLocaleData[key];
  if (
    data === undefined ||
    !(typeof data == "object" && data.constructor == Object)
  ) {
    data = g_englishData[key];
  }
  if (!(typeof data == "object" && data.constructor == Object)) {
    return undefined;
  }
  // make a copy and sanitize values
  data = structuredClone(data);
  for (const key in data) {
    data[key] = sanitizeHtml(data[key], {
      allowedTags: [],
      allowedClasses: {},
    });
  }
  return data;
};

exports.getKeys = function () {
  return Object.keys(g_englishData);
};

// ref: https://stackoverflow.com/questions/37639444/javascript-stringformat-with-array
String.prototype.myFormatString = function (_array) {
  var s = _array[0];
  for (var i = 0; i < _array.length - 1; i++) {
    var reg = new RegExp("\\{" + i + "\\}", "gm");
    s = s.replace(reg, _array[i + 1]);
  }
  return s;
};
