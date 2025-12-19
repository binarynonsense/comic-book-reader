/**
 * @license
 * Copyright 2024-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _, _raw } = require("../../shared/main/i18n");
const history = require("../../shared/main/history");
const favorites = require("../../shared/main/favorites");
const reader = require("../../reader/main");
const log = require("../../shared/main/logger");
const appUtils = require("../../shared/main/app-utils");
const { FileExtension } = require("../../shared/main/constants");
const tools = require("../../shared/main/tools");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_isInitialized = false;
let g_languageDirection = "ltr";
let g_favorites;
let g_maxLatest = 6;

function init() {
  if (!g_isInitialized) {
    g_isInitialized = true;
    initOnIpcCallbacks();
    const data = fs.readFileSync(path.join(__dirname, "index.html"));
    reader.sendIpcToCoreRenderer(
      "replace-inner-html",
      "#home-screen",
      data.toString()
    );
    sendIpcToRenderer("hs-init");
    updateLocalizedText(false);
    favorites.init();
  }
}

exports.open = function (showFocus, maxLatest) {
  g_maxLatest = maxLatest;
  init();
  // TODO: use showFocus?
  buildSections();
};

exports.close = function () {
  saveFavorites();
};

exports.refresh = function () {
  buildSections();
};

exports.setLanguageDirection = function (direction) {
  g_languageDirection = direction;
  if (g_isInitialized) {
    buildSections();
  }
};

exports.updateMaxLatest = function (maxLatest) {
  g_maxLatest = maxLatest;
  buildSections();
};

//////////////////////////////////////////////////////////////////////////////
// TOOL //////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function buildSections() {
  sendIpcToRenderer(
    "hs-build-sections",
    g_languageDirection,
    getFavoritesData(),
    getLatestData(),
    g_maxLatest
  );
}

function getLatestData() {
  const historyData = history.get();
  const data = [];
  for (let index = 0; index < historyData.length; index++) {
    if (data.length < g_maxLatest) {
      const latestInfo = {};
      const historyDataFile = historyData[historyData.length - index - 1];
      latestInfo.index = historyData.length - index - 1;
      if (historyDataFile.data && historyDataFile.data.source) {
        latestInfo.pathType = 2;
        if (historyDataFile.data.name) {
          latestInfo.name = historyDataFile.data.name;
        } else {
          latestInfo.name = historyDataFile.filePath;
        }
        if (historyDataFile.data.source) {
          switch (historyDataFile.data.source) {
            case "dcm":
              if (historyDataFile.data.url)
                latestInfo.path = historyDataFile.data.url;
              else
                latestInfo.path =
                  _("menu-tools-dcm") + " - " + historyDataFile.data.name;
              break;

            case "cbp":
              if (historyDataFile.data.url)
                latestInfo.path = historyDataFile.data.url;
              else
                latestInfo.path =
                  _("menu-tools-cbp") + " - " + historyDataFile.data.name;
              break;

            case "gut":
              latestInfo.path = historyDataFile.filePath;
              // latestInfo.path =
              //   _("menu-tools-gut") + " - " + historyDataFile.data.name;
              break;

            case "iab":
              if (historyDataFile.data.url)
                latestInfo.path = historyDataFile.data.url;
              else
                latestInfo.path =
                  _("menu-tools-iab") + " - " + historyDataFile.data.name;
              break;
          }
        }
      } else {
        latestInfo.path = historyDataFile.filePath;
        latestInfo.name = path.basename(historyDataFile.filePath);
        if (!fs.existsSync(latestInfo.path)) {
          continue;
        }
        if (fs.existsSync(latestInfo.path)) {
          latestInfo.pathType = !fs.lstatSync(latestInfo.path).isDirectory()
            ? 0
            : 1;
        } else {
          latestInfo.pathType = -1;
        }
      }
      data.push(latestInfo);
    } else {
      break;
    }
  }
  return data;
}

function getFavoritesData() {
  if (!g_favorites) g_favorites = favorites.get();
  const data = [];
  for (let index = 0; index < g_favorites.length; index++) {
    const favoriteInfo = {};
    favoriteInfo.index = index;
    favoriteInfo.path = g_favorites[index].path;
    if (g_favorites[index].localizedNameId) {
      // used in the defaults
      favoriteInfo.name = getFavoriteLocalizedName(index);
    } else {
      favoriteInfo.name = g_favorites[index].name;
    }
    if (g_favorites[index].data && g_favorites[index].data.source) {
      favoriteInfo.pathType = 2;
    } else if (fs.existsSync(favoriteInfo.path)) {
      favoriteInfo.pathType = !fs.lstatSync(favoriteInfo.path).isDirectory()
        ? 0
        : 1;
    } else {
      favoriteInfo.pathType = -1;
    }
    data.push(favoriteInfo);
  }
  return data;
}

function getFavoriteLocalizedName(index) {
  switch (g_favorites[index].localizedNameId) {
    case "home":
      return _("tool-fb-shortcuts-places-home");
    case "desktop":
      return _("tool-fb-shortcuts-places-desktop");
    case "downloads":
      return _("tool-fb-shortcuts-places-downloads");
    default:
      return undefined;
  }
}

function saveFavorites() {
  favorites.set(g_favorites);
  favorites.save();
}

function isFavorite(favPath) {
  for (let index = 0; index < g_favorites.length; index++) {
    if (g_favorites[index].path === favPath) {
      return true;
    }
  }
  return false;
}

function addFavoriteFromPath(favPath) {
  let isAlreadyInList = isFavorite(favPath);
  if (!isAlreadyInList) {
    g_favorites.push({
      path: favPath,
      name: path.basename(favPath),
    });
    buildSections();
  } else {
    // TODO: show some kind of error modal?
    log.debug("tried to add a favorite already in the list");
  }
}

function addFavoriteFromLatest(fileIndex, filePath) {
  let isAlreadyInList = isFavorite(filePath);
  if (!isAlreadyInList) {
    const historyData = history.get()[fileIndex];
    /////////
    let fav;
    if (historyData.data) {
      fav = {
        path: filePath,
        name: historyData.data.name,
        data: historyData.data,
      };
    } else {
      fav = {
        path: filePath,
        name: path.basename(filePath),
      };
    }
    g_favorites.push(fav);
    buildSections();
  } else {
    // TODO: show some kind of error modal?
    log.debug("tried to add a favorite already in the list");
  }
}

// function removeFavorite(){
//    // TODO: finish, this is just reference code
//    if (g_favorites[favIndex].path === favPath) {
//       g_favorites.splice(favIndex, 1);
//       buildSections();
//     } else {
//       log.error("Tried to remove a favorite with not matching index and path");
//     }
// }

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  reader.sendIpcToRenderer(...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function on(id, callback) {
  reader.on(id, callback);
}

function initOnIpcCallbacks() {
  on("hs-open-dialog-file", (filePath, sourceId) => {
    if (sourceId === 1) {
      tools.switchTool("tool-file-browser", { path: filePath }, true);
    } else {
      reader.onMenuOpenFile(filePath);
    }
  });

  on("hs-open-preferences", () => {
    core.onMenuPreferences();
  });

  on("hs-open-history", () => {
    core.onMenuOpenHistoryManager();
  });

  on("hs-files-tools", (showFocus) => {
    sendIpcToRenderer(
      "hs-show-modal-files-tools",
      _raw("home-button-files-tools", false)
        ? _raw("home-button-files-tools", false)
        : _("menu-tools") + " > " + _("menu-tools-files"),
      _("tool-shared-ui-back"),
      _raw("tool-cc-title-alt", false)
        ? _raw("tool-cc-title-alt", false)
        : _("tool-cc-title"), // "Convert Files Tool"
      _raw("tool-cr-title-alt", false)
        ? _raw("tool-cr-title-alt", false)
        : _("tool-cr-title"), // "Create File Tool"
      _raw("tool-ci-title-alt", false)
        ? _raw("tool-ci-title-alt", false)
        : _("tool-ci-title"), // "Convert Images Tool"
      _raw("tool-ec-title-alt", false)
        ? _raw("tool-ec-title-alt", false)
        : _("tool-ec-title"), // "Extract Pages Tool"
      showFocus
    );
  });

  on("hs-on-modal-files-tools-convert-files-clicked", () => {
    core.onMenuToolConvertComics();
  });

  on("hs-on-modal-files-tools-create-file-clicked", () => {
    core.onMenuToolCreateComic();
  });

  on("hs-on-modal-files-tools-convert-images-clicked", () => {
    core.onMenuToolConvertImages();
  });

  on("hs-on-modal-files-tools-extract-comics-clicked", () => {
    core.onMenuToolExtractComics();
  });

  on("hs-art-tools", (showFocus) => {
    sendIpcToRenderer(
      "hs-show-modal-art-tools",
      _raw("home-button-art-tools", false)
        ? _raw("home-button-art-tools", false)
        : _("menu-tools") + " > " + _("menu-tools-art"),
      _("tool-shared-ui-back"),
      _("tool-tm-info-title-header"),
      _raw("tool-ep-title-alt", false)
        ? _raw("tool-ep-title-alt", false)
        : _("tool-ep-title"), // "Extract Palette Tool"
      showFocus
    );
  });

  on("hs-on-modal-art-tools-template-maker-clicked", () => {
    core.onMenuToolTemplateMaker();
  });

  on("hs-on-modal-art-tools-extract-palette-clicked", () => {
    core.onMenuToolExtractPalette();
  });

  on("hs-open-rss-reader", () => {
    core.onMenuToolRssReader();
  });

  on("hs-open-radio", () => {
    core.onMenuToolRadio(0);
  });

  on("hs-quit", () => {
    core.onMenuQuit();
  });

  on("hs-open-favorite-file", (cardData) => {
    let favorite = g_favorites[cardData.index];
    if (favorite.data) {
      reader.tryOpen(
        cardData.path,
        undefined,
        undefined,
        g_favorites[cardData.index]
      );
    } else {
      reader.tryOpen(cardData.path);
    }
  });

  on("hs-open-history-file", (index) => {
    reader.tryOpen(
      history.getIndex(index).filePath,
      undefined,
      history.getIndex(index)
    );
  });

  on("hs-on-add-favorite-clicked", (showFocus) => {
    sendIpcToRenderer(
      "hs-show-modal-add-favorite",
      _("home-section-favorites"),
      _("tool-shared-ui-back"),
      _("tool-shared-ui-add-file"),
      _("tool-shared-ui-add-folder"),
      showFocus
    );
  });

  on("hs-on-modal-add-favorite-folder-clicked", () => {
    let folderList = appUtils.chooseFolder(core.getMainWindow());
    if (folderList === undefined || folderList.length <= 0) {
      return;
    }
    const folderPath = folderList[0];
    addFavoriteFromPath(folderPath);
  });

  on("hs-on-modal-add-favorite-file-clicked", () => {
    let allowMultipleSelection = false;
    let allowedFileTypesName = _("dialog-file-types-comics");
    let allowedFileTypesList = [
      FileExtension.CBZ,
      FileExtension.CBR,
      FileExtension.CB7,
      FileExtension.PDF,
      FileExtension.EPUB,
    ];
    let filePathsList = appUtils.chooseFiles(
      core.getMainWindow(),
      undefined,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection
    );
    if (filePathsList === undefined || filePathsList.length <= 0) {
      return;
    }
    const filePath = filePathsList[0];
    addFavoriteFromPath(filePath);
  });

  on("hs-on-favorite-options-clicked", (index, path, showFocus) => {
    // TODO: maybe check index and path match?
    sendIpcToRenderer(
      "hs-show-modal-favorite-options",
      index,
      path,
      _("tool-shared-tab-options"),
      _("tool-shared-ui-back"),
      _("tool-shared-tooltip-remove-from-list"),
      _("ui-modal-prompt-button-edit-name"),
      _("ui-modal-prompt-button-edit-path"),
      _("tool-shared-tooltip-move-forward-in-list"),
      _("tool-shared-tooltip-move-backward-in-list"),
      showFocus
    );
  });

  on("hs-on-modal-favorite-options-remove-clicked", (favIndex, favPath) => {
    if (g_favorites[favIndex].path === favPath) {
      g_favorites.splice(favIndex, 1);
      buildSections();
    } else {
      log.error("Tried to remove a favorite with not matching index and path");
    }
  });

  on("hs-on-modal-favorite-options-edit-name-clicked", (favIndex, favPath) => {
    if (g_favorites[favIndex].path === favPath) {
      let favName = g_favorites[favIndex].name;
      if (g_favorites[favIndex].localizedNameId) {
        favName = getFavoriteLocalizedName(favIndex);
      }
      sendIpcToRenderer(
        "hs-show-modal-favorite-edit-name",
        favIndex,
        favPath,
        favName,
        _("ui-modal-prompt-button-edit-name"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to edit a favorite with not matching index and path");
    }
  });

  on(
    "hs-on-modal-favorite-options-edit-name-ok-clicked",
    (favIndex, favPath, newName) => {
      if (g_favorites[favIndex].path === favPath) {
        if (g_favorites[favIndex].localizedNameId) {
          let favName = getFavoriteLocalizedName(favIndex);
          if (newName && newName !== favName) {
            g_favorites[favIndex].localizedNameId = undefined;
            g_favorites[favIndex].name = newName;
            buildSections();
          }
        } else {
          let favName = g_favorites[favIndex].name;
          if (newName && newName !== favName) {
            g_favorites[favIndex].name = newName;
            buildSections();
          }
        }
      } else {
        log.error("Tried to edit a favorite with not matching index and path");
      }
    }
  );

  on("hs-on-modal-favorite-options-edit-path-clicked", (favIndex, favPath) => {
    if (g_favorites[favIndex].path === favPath) {
      sendIpcToRenderer(
        "hs-show-modal-favorite-edit-path",
        favIndex,
        favPath,
        _("ui-modal-prompt-button-edit-path"),
        _("ui-modal-prompt-button-ok"),
        _("ui-modal-prompt-button-cancel")
      );
    } else {
      log.error("Tried to edit a favorite with not matching index and path");
    }
  });

  on(
    "hs-on-modal-favorite-options-edit-path-ok-clicked",
    (favIndex, favPath, newPath) => {
      if (g_favorites[favIndex].path === favPath) {
        if (newPath && newPath !== favPath) {
          g_favorites[favIndex].path = newPath;
          buildSections();
        }
      } else {
        log.error("Tried to edit a favorite with not matching index and path");
      }
    }
  );

  on("hs-on-modal-favorite-options-move-clicked", (favIndex, favPath, dir) => {
    if (g_favorites[favIndex].path === favPath) {
      if (dir == 0) {
        // backward
        if (favIndex > 0) {
          let temp = g_favorites[favIndex - 1];
          g_favorites[favIndex - 1] = g_favorites[favIndex];
          g_favorites[favIndex] = temp;
          buildSections();
        }
      } else if (dir == 1) {
        // forward
        if (favIndex < g_favorites.length - 1) {
          let temp = g_favorites[favIndex + 1];
          g_favorites[favIndex + 1] = g_favorites[favIndex];
          g_favorites[favIndex] = temp;
          buildSections();
        }
      }
    } else {
      log.error("Tried to move a favorite with not matching index and path");
    }
  });

  on("hs-on-latest-options-clicked", (index, path, showFocus) => {
    sendIpcToRenderer(
      "hs-show-modal-latest-options",
      index,
      path,
      isFavorite(path),
      _("tool-shared-tab-options"),
      _("tool-shared-ui-back"),
      isFavorite(path)
        ? _("home-modal-button-removefromfavorites")
        : _("home-modal-button-addtofavorites"),
      _("ctxmenu-opencontainingfolder"),
      showFocus
    );
  });

  on(
    "hs-on-modal-latest-options-addtofavorites-clicked",
    (fileIndex, filePath) => {
      addFavoriteFromLatest(fileIndex, filePath);
    }
  );

  on("hs-on-modal-latest-options-openfolder-clicked", (fileIndex, filePath) => {
    appUtils.openPathInFileBrowser(path.dirname(filePath));
  });
}

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText(rebuildSections = true) {
  if (!g_isInitialized) return;
  sendIpcToRenderer(
    "hs-update-localization",
    getIdsLocalization(),
    getCardLocalization(),
    _("menu-file-preferences"),
    _("menu-file-openrecent-history"),
    _raw("home-button-files-tools", false)
      ? _raw("home-button-files-tools", false)
      : _("menu-tools") + " > " + _("menu-tools-files"),
    _raw("home-button-art-tools", false)
      ? _raw("home-button-art-tools", false)
      : _("menu-tools") + " > " + _("menu-tools-art"),
    _("menu-tools-rss-reader"),
    _("menu-tools-radio"),
    _("menu-file-quit"),
    _("tool-shared-ui-add")
  );
  if (rebuildSections) buildSections();
}
exports.updateLocalizedText = updateLocalizedText;

function getIdsLocalization() {
  return [
    {
      id: "hs-openfile-button-text",
      text: _("ctxmenu-openfile").replace("...", "").toUpperCase(),
    },
    {
      id: "hs-favorites-title",
      text: _("home-section-favorites").toUpperCase(),
    },
    {
      id: "hs-latest-title",
      text: _("home-section-recent").toUpperCase(),
    },
  ];
}

function getCardLocalization() {
  return {
    options: _("tool-shared-tab-options"),
    add: _("tool-shared-ui-add"),
    openInSystemBrowser: _(
      "ui-modal-prompt-button-open-in-system-file-browser"
    ),
    openInReader: _("ui-modal-prompt-button-open-in-reader"),
  };
}
