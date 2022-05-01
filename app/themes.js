const path = require("path");
const fs = require("fs");

let g_loadedTheme;
let g_themeData;

let g_defaultTheme = "acbr-gray";

exports.getLoadedTheme = function () {
  return g_loadedTheme;
};

exports.getLoadedThemeData = function () {
  return g_themeData;
};

exports.loadTheme = function (desiredTheme) {
  let theme = desiredTheme;
  let data = getThemeData(theme);
  if (data !== undefined) {
    g_loadedTheme = theme;
    g_themeData = data;
    return g_loadedTheme;
  }
  // nothing found, load the default theme
  g_loadedTheme = g_defaultTheme;
  g_themeData = getThemeData(g_loadedTheme);
  return g_loadedTheme;
};

function getThemeData(theme) {
  if (theme === undefined) {
    return undefined;
  }
  let dataPath = path.join(__dirname, "assets/themes/" + theme + ".json");
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

exports.getAvailableThemes = function () {
  return getThemesFromFolder(path.join(__dirname, "assets/themes/"));
};

function getThemesFromFolder(folderPath) {
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
