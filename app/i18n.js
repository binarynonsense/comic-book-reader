const path = require("path");
const fs = require("fs");

let g_loadedLocale;
let g_localeData;

// ref: https://www.electronjs.org/docs/api/locales
// ref: https://www.christianengvall.se/electron-localization/

exports.getLoadedLocal = function () {
  return g_loadedLocale;
};

exports.loadLocale = function (desiredLocale, loadDefaultIfNotFound = true) {
  let defaultLocale = "en";
  let locale = desiredLocale;
  //console.log("trying locale: " + locale);
  if (locale !== undefined) {
    let data = getLocaleData(locale);
    if (data !== undefined) {
      g_loadedLocale = locale;
      g_localeData = data;
      return true;
    }
    if (locale.includes("-")) {
      let splitted = locale.split("-");
      if (splitted.length > 1) {
        // from "en_US" to "en" for example
        locale = splitted[0];
        //console.log("trying locale: " + locale);
        data = getLocaleData(locale);
        if (data !== undefined) {
          g_loadedLocale = locale;
          g_localeData = data;
          return true;
        }
      }
    }
    if (loadDefaultIfNotFound) {
      //console.log("trying default locale: " + defaultLocale);
      g_loadedLocale = defaultLocale;
      data = getLocaleData(defaultLocale);
      g_localeData = data;
      return true;
    }
    return false;
  }
};

function getLocaleData(locale) {
  const dataPath = path.join(__dirname, "assets/i18n/" + locale + ".json");
  if (!fs.existsSync) return undefined;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    //console.log(data);
    return data;
  } catch (e) {
    return undefined;
  }
}

exports.getAvailableLocales = function () {
  let localesList = [];
  const folderPath = path.join(__dirname, "assets/i18n/");
  if (fs.existsSync(folderPath)) {
    let filesInFolder = fs.readdirSync(folderPath);
    if (filesInFolder.length === 0) {
      //console.log("no files found in dir");
      return localesList;
    } else {
      for (let file of filesInFolder) {
        try {
          //console.log(file);
          let data = JSON.parse(
            fs.readFileSync(path.join(folderPath, file), "utf8")
          );
          if (
            data !== undefined &&
            data["@metadata"] !== undefined &&
            data["@metadata"]["native-name"] !== undefined &&
            data["@metadata"]["locale"] !== undefined
          ) {
            let localeInfo = {
              nativeName: data["@metadata"]["native-name"],
              locale: data["@metadata"]["locale"],
            };
            localesList.push(localeInfo);
          }
        } catch (e) {
          // just ignore file
          //console.log("file error");
        }
      }
    }
  }
  //console.log("localesList: " + localesList);
  return localesList;
};

exports._ = function (...args) {
  //   console.log(args);
  let text = args[0]; // TODO {{variables}} substitution with extra args
  let translatedText = g_localeData[text];
  if (translatedText === undefined) {
    translatedText = text;
  }
  return translatedText;
};
