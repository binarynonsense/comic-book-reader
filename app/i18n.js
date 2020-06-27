const path = require("path");
const fs = require("fs");

let g_loadedLocale;
let g_localeData;

let g_englishData;

let g_userDataLocalesPath;

// ref: https://www.electronjs.org/docs/api/locales
// ref: https://www.christianengvall.se/electron-localization/

exports.setUserDataLocalesPath = function (userDataLocalesPath) {
  g_userDataLocalesPath = userDataLocalesPath;
};

exports.getLoadedLocale = function () {
  return g_loadedLocale;
};

exports.loadLocale = function (desiredLocale) {
  if (g_englishData === undefined) {
    g_englishData = getLocaleData("en");
  }

  let locale = desiredLocale;
  if (locale !== undefined) {
    let data = getLocaleData(locale);
    if (data !== undefined) {
      g_loadedLocale = locale;
      g_localeData = data;
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
          g_localeData = data;
          return g_loadedLocale;
        }
      }
    }

    // nothing found, load "en"
    g_loadedLocale = "en";
    g_localeData = getLocaleData(g_loadedLocale); // could use g_englishData.slice()
    return g_loadedLocale;
  }
};

function getLocaleData(locale) {
  let dataPath = path.join(__dirname, "assets/i18n/" + locale + ".json");
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
  localesList = getLocalesFromFolder(path.join(__dirname, "assets/i18n/"));
  if (
    g_userDataLocalesPath !== undefined &&
    fs.existsSync(g_userDataLocalesPath)
  ) {
    // user locales
    let userLocalesList = getLocalesFromFolder(g_userDataLocalesPath);
    for (let index = 0; index < userLocalesList.length; index++) {
      const userLocale = userLocalesList[index];
      let found = false;
      for (let index = localesList.length - 1; index >= 0; index--) {
        const locale = localesList[index];
        if (locale.locale === userLocale.locale) {
          found = true;
          break;
        }
      }
      if (!found) {
        localesList.push(userLocale);
      }
    }
  }
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
        }
      }
    }
  }
  return localesList;
}

exports._ = function (...args) {
  // i.e. [ "Error: {0} file/s couldn't be converted", 0 ]
  let translatedText = g_localeData[args[0]];
  if (translatedText === undefined) {
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
  return translatedText;
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
