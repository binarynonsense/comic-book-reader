/**
 * @license
 * Copyright 2024-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");
const path = require("path");
const core = require("../../core/main");
const { _, _raw } = require("../../shared/main/i18n");
const history = require("../../shared/main/history");
const settings = require("../../shared/main/settings");
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
let g_favoritesData;
let g_latestData;
let g_userLists;

let g_collapseFavorites = false;
let g_collapseLatest = false;

let g_hasDoneHistoryCleanup = false;

function init() {
  if (!g_isInitialized) {
    g_isInitialized = true;
    initOnIpcCallbacks();
    const data = fs.readFileSync(path.join(__dirname, "index.html"));
    reader.sendIpcToCoreRenderer(
      "replace-inner-html",
      "#home-screen",
      data.toString(),
    );
    sendIpcToRenderer("hs-init");
    updateLocalizedText(false);
    favorites.init();
    g_collapseFavorites = favorites.getValue("collapseFavorites");
    g_collapseLatest = favorites.getValue("collapseLatest");
  }
}

exports.open = function (showFocus) {
  init();
  sendIpcToRenderer("hs-set-list-collapse-value", -1, g_collapseFavorites);
  sendIpcToRenderer("hs-set-list-collapse-value", -2, g_collapseLatest);
  // TODO: use showFocus?
  buildSections();
};

exports.close = function () {
  saveToFile();
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

exports.onSettingsUpdated = function () {
  buildSections();
};

//////////////////////////////////////////////////////////////////////////////
// TOOL //////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function saveToFile() {
  favorites.setData(g_favoritesData);
  favorites.setLists(g_userLists);
  favorites.setValue("collapseFavorites", g_collapseFavorites);
  favorites.setValue("collapseLatest", g_collapseLatest);
  favorites.save();
}

function buildSections(refocus = true) {
  sendIpcToRenderer(
    "hs-build-sections",
    settings.getValue("homeScreen"),
    g_languageDirection,
    getFavoritesCards(),
    getLatestCards(),
    getUserCardsLists(),
    {
      addButtonTitle: _("tool-shared-ui-add"),
      collapseButtonTitle: _("tool-shared-ui-collapse-list"),
      expandButtonTitle: _("tool-shared-ui-expand-list"),
      editNameButtonTitle: _("ui-modal-prompt-button-edit-name"),
      removeListButtonTitle: _("tool-shared-ui-remove-list"),
    },
    refocus,
  );
  if (!g_hasDoneHistoryCleanup) {
    g_hasDoneHistoryCleanup = true;
    log.debug("cleaning up history's home list");
    cleanHistoryHome(true);
  }
}

//////////////////////////////////////////////////////////////////////////////
// LISTS - COMMON ////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function generateCardsFromSavedData(inputData, isFavoritesList) {
  const data = [];
  for (let index = 0; index < inputData.length; index++) {
    try {
      const inputBook = inputData[index];
      const outputBook = {};
      outputBook.index = index;
      outputBook.path = inputBook.path;
      outputBook.name = inputBook.name;
      if (isFavoritesList) {
        if (inputBook.localizedNameId) {
          // used in the defaults
          outputBook.name = getFavoriteLocalizedName(index);
        }
      } else {
        outputBook.isInFavorites = isEntryInList(-1, inputData[index]);
      }
      if (inputBook.data && inputBook.data.source) {
        outputBook.pathType = 2;
      } else if (fs.existsSync(outputBook.path)) {
        outputBook.pathType = !fs.lstatSync(outputBook.path).isDirectory()
          ? 0
          : 1;
      } else {
        outputBook.pathType = -1;
      }
      if (outputBook.pathType !== 1) {
        if (outputBook.pathType === 0) {
          outputBook.percentageRead =
            getPercentageReadFromHistoryListByEntry(inputBook);
        } else if (outputBook.pathType === 2) {
          outputBook.percentageRead =
            getPercentageReadFromHistoryListByEntry(inputBook);
        }
      }
      data.push(outputBook);
    } catch (error) {
      log.editorError(error);
    }
  }
  return data;
}

/////////////////////

function getListName(listIndex) {
  if (listIndex === -2) {
    return _("home-section-recent");
  } else if (listIndex === -1) {
    return _("home-section-favorites");
  } else {
    return g_userLists[listIndex].name;
  }
}

function getListData(listIndex) {
  if (listIndex === -2) {
    return g_latestData;
  } else if (listIndex === -1) {
    return g_favoritesData;
  } else {
    return g_userLists[listIndex].data;
  }
}

function getEntryIndexInList(listIndex, entry) {
  const listData = getListData(listIndex);
  if (entry.data && entry.data.source) {
    for (let index = 0; index < listData.length; index++) {
      if (!listData[index].data || !listData[index].data.source) continue;
      if (
        listData[index].data.source === "xkcd" &&
        entry.data.source === "xkcd"
      ) {
        // custom for xkcd, as numpages can change
        return index;
      }
      // TODO: make custom comparisions for each source type instead of
      // using JSON.stringify
      if (JSON.stringify(listData[index].data) === JSON.stringify(entry.data)) {
        return index;
      }
    }
    return undefined;
  } else {
    // use filePath as a backup as it's also called by
    // isHistoryEntryInFavoritesOrUserLists with a history entry
    return getLocalPathIndexInList(
      listIndex,
      entry.path ? entry.path : entry.filePath,
    );
  }
}

function isEntryInList(listIndex, entry) {
  return getEntryIndexInList(listIndex, entry) !== undefined;
}

function isLocalPathInList(listIndex, localPath) {
  return getLocalPathIndexInList(listIndex, localPath) !== undefined;
}

function getLocalPathIndexInList(listIndex, localPath) {
  const listData = getListData(listIndex);
  for (let index = 0; index < listData.length; index++) {
    if (listData[index].path === localPath) {
      return index;
    }
  }
  return undefined;
}

function addEntryToList(listIndex, entry, doBuild = true) {
  let isAlreadyInList = isEntryInList(listIndex, entry);
  if (!isAlreadyInList) {
    const listData = getListData(listIndex);
    listData.push(entry);
    if (doBuild) buildSections();
  } else {
    log.editor("tried to add an entry already in the list");
    sendIpcToCoreRenderer(
      "show-toast",
      `${_("home-action-canceled")}<br>${_(
        "home-action-drag-file-shortcut-error-alreadyinlist",
      )}<br><span class="toast-acbr-path">...${entry?.name}</span>`,
      3000,
      undefined,
      false,
    );
  }
}

function addEntryToListByLocalPath(listIndex, localPath, doBuild = true) {
  let isAlreadyInList = isLocalPathInList(listIndex, localPath);
  if (!isAlreadyInList) {
    const listData = getListData(listIndex);
    listData.push({
      path: localPath,
      name: path.basename(localPath),
    });
    if (doBuild) buildSections();
  } else {
    log.editor("tried to add an entry already in the list");
    sendIpcToCoreRenderer(
      "show-toast",
      `${_("home-action-canceled")}<br>${_(
        "home-action-drag-file-shortcut-error-alreadyinlist",
      )}<br><span class="toast-acbr-path">...${path.basename(
        localPath,
      )}</span>`,
      3000,
      undefined,
      false,
    );
  }
}

function isHistoryEntryInFavoritesOrUserLists(entry) {
  // NOTE: getEntryIndexInList supports calling with a history entry instead
  // of a home screen one (will check for path AND filePath)
  if (getEntryIndexInList(-1, entry) !== undefined) {
    return true;
  }
  for (let index = 0; index < g_userLists.length; index++) {
    if (getEntryIndexInList(index, entry) !== undefined) {
      return true;
    }
  }
  return false;
}
exports.isHistoryEntryInFavoritesOrUserLists =
  isHistoryEntryInFavoritesOrUserLists;

function cleanHistoryHome(doLog = false) {
  // NOTE: this could be very ineficient as I use it when removing just one
  // entry in a list in the remove functions.
  // TODO: Improve it later by using more specific functions in those.
  const homeHistory = history.getHome();
  let indicesToDelete = [];
  for (let index = 0; index < homeHistory.length; index++) {
    const entry = homeHistory[index];
    if (
      history.isEntryInRecent(entry) ||
      !isHistoryEntryInFavoritesOrUserLists(entry)
    ) {
      indicesToDelete.push(index);
    }
  }
  if (indicesToDelete.length === 0) return;
  if (doLog) log.debug(`deleting ${indicesToDelete.length} outdated entries`);
  indicesToDelete.reverse();
  indicesToDelete.forEach((index) => {
    history.removeEntryInHomeByIndex(index);
  });
}

function getPercentageReadFromHistoryListByIndex(historyEntryIndex, listIndex) {
  if (historyEntryIndex === undefined || !Number.isInteger(historyEntryIndex))
    return undefined;
  const historyData = listIndex === 0 ? history.getRecent() : history.getHome();
  let pageIndex = historyData[historyEntryIndex].pageIndex;
  let numPages = historyData[historyEntryIndex].numPages;
  if (pageIndex !== undefined && numPages !== undefined) {
    pageIndex = parseFloat(pageIndex);
    numPages = parseFloat(numPages);
    if (!isNaN(pageIndex) && !isNaN(numPages)) {
      if (
        historyData[historyEntryIndex].data &&
        historyData[historyEntryIndex].data.bookType &&
        historyData[historyEntryIndex].data.bookType === "ebook"
      ) {
        if (pageIndex >= 0 && pageIndex <= 100) {
          return pageIndex;
        }
      } else {
        if (pageIndex <= numPages) {
          return ((pageIndex + 1) / numPages) * 100;
        }
      }
    }
  }
  return undefined;
}

function getPercentageReadFromHistoryListByEntry(entry) {
  if (entry.data && entry.data.source) {
    let index = history.getIndexInRecentByData(entry.data);
    if (index !== undefined) {
      return getPercentageReadFromHistoryListByIndex(index, 0);
    } else {
      index = history.getIndexInHomeByData(entry.data);
      if (index !== undefined) {
        return getPercentageReadFromHistoryListByIndex(index, 1);
      }
    }
  } else {
    let index = history.getIndexInRecentByFilePath(entry.path);
    if (index !== undefined) {
      return getPercentageReadFromHistoryListByIndex(index, 0);
    } else {
      index = history.getIndexInHomeByFilePath(entry.path);
      if (index !== undefined) {
        return getPercentageReadFromHistoryListByIndex(index, 1);
      }
    }
  }
}

//////////////////////////////////////////////////////////////////////////////
// LISTS - LATEST ////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function getLatestCards() {
  const historyData = history.getRecent();
  g_latestData = historyData;
  const data = [];
  for (let index = 0; index < historyData.length; index++) {
    try {
      if (data.length < settings.getValue("homeScreen").latestMaxRows * 2) {
        const latestInfo = {};
        latestInfo.index = historyData.length - index - 1;
        latestInfo.percentageRead = getPercentageReadFromHistoryListByIndex(
          latestInfo.index,
          0,
        );
        const historyDataFile = historyData[latestInfo.index];
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
        latestInfo.isInFavorites = isLatestInList(-1, latestInfo.index);
        data.push(latestInfo);
      } else {
        break;
      }
    } catch (error) {
      log.editorError(error);
    }
  }
  return data;
}

//////////////////////////////////////////////////////////////////////////////
// LISTS - LATEST -> OTHER ///////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function isLatestInList(listIndex, latestIndex) {
  return getIndexInListByLatestIndex(listIndex, latestIndex) !== undefined;
}

function getIndexInListByLatestIndex(listIndex, latestIndex) {
  const historyData = history.getRecent()[latestIndex];
  const listData = getListData(listIndex);
  if (historyData.data && historyData.data.source) {
    for (let index = 0; index < listData.length; index++) {
      if (!listData[index].data || !listData[index].data.source) continue;
      if (
        listData[index].data.source === "xkcd" &&
        historyData.data.source === "xkcd"
      ) {
        // custom for xkcd, as numpages can change
        return index;
      }
      // TODO: make custom comparisions for each source type instead of
      // using JSON.stringify
      if (
        JSON.stringify(listData[index].data) ===
        JSON.stringify(historyData.data)
      ) {
        return index;
      }
    }
    return undefined;
  } else {
    return getLocalPathIndexInList(listIndex, historyData.filePath);
  }
}

function addEntryToListByLatestIndex(
  latestEntryIndex,
  toListIndex,
  toEntryIndex,
) {
  let isAlreadyInList = isLatestInList(toListIndex, latestEntryIndex);
  if (!isAlreadyInList) {
    const historyData = history.getRecent()[latestEntryIndex];
    /////////
    let newEntry;
    if (historyData.data && historyData.data.source) {
      newEntry = {
        path: historyData.filePath,
        name: historyData.data.name,
        data: historyData.data,
      };
    } else {
      newEntry = {
        path: historyData.filePath,
        name: path.basename(historyData.filePath),
      };
    }
    const listData = getListData(toListIndex);
    if (toEntryIndex !== undefined && toEntryIndex !== -1) {
      // -1 = empty card
      // add before index
      listData.splice(toEntryIndex, 0, newEntry);
    } else {
      // add at the end
      listData.push(newEntry);
    }
    buildSections();
  } else {
    // TODO: show some kind of error modal?
    log.debug("tried to add an entry already in the list");
  }
}

function addFolderToFavoritesByLatestIndex(latestEntryIndex) {
  const historyData = history.getRecent()[latestEntryIndex];
  if (!historyData.filePath || (historyData.data && historyData.data.source))
    return;
  const latestPath = path.dirname(historyData.filePath);
  // TODO: check if valid folder;
  addEntryToListByLocalPath(-1, latestPath);
  // TODO: show modal message if error?
}

function removeEntryInFavoritesByLatestIndex(latestEntryIndex) {
  let favIndex = getIndexInListByLatestIndex(-1, latestEntryIndex);
  if (favIndex !== undefined) {
    g_favoritesData.splice(favIndex, 1);
    buildSections();
    ////////
    cleanHistoryHome();
  } else {
    // TODO: show some kind of error modal?
    log.debug("tried to remove a favorite not in the list");
  }
}

//////////////////////////////////////////////////////////////////////////////
// LISTS - FAVORITES /////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function getFavoritesCards() {
  if (!g_favoritesData) g_favoritesData = favorites.getData();
  return generateCardsFromSavedData(g_favoritesData, true);
}

function getFavoriteLocalizedName(index) {
  switch (g_favoritesData[index].localizedNameId) {
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

function removeEntryInFavoritesByOtherListEntryIndeces(
  listIndex,
  entryIndex,
  entryPath,
) {
  const listData = getListData(listIndex);
  const entry = listData[entryIndex];
  let favIndex = getEntryIndexInList(-1, entry);
  if (favIndex !== undefined) {
    g_favoritesData.splice(favIndex, 1);
    buildSections();
    ////////
    cleanHistoryHome();
  } else {
    log.error("tried to remove a favorite not in the list");
  }
}

//////////////////////////////////////////////////////////////////////////////
// LISTS - USER LISTS ////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function getUserCardsLists() {
  if (!g_userLists) g_userLists = favorites.getLists();
  let lists = [];
  for (let listIndex = 0; listIndex < g_userLists.length; listIndex++) {
    let list = {};
    list.name = g_userLists[listIndex].name;
    list.index = listIndex;
    list.data = generateCardsFromSavedData(g_userLists[listIndex].data, false);
    list.collapsed = g_userLists[listIndex].collapsed;
    lists.push(list);
  }
  return lists;
}

function removeEntryInUserListByIndexAndPath(listIndex, entryIndex, entryPath) {
  const listData = getListData(listIndex);
  if (listData[entryIndex].path === entryPath) {
    listData.splice(entryIndex, 1);
    buildSections();
    ////////
    cleanHistoryHome();
  } else {
    log.error("Tried to remove a list entry with not matching index and path");
  }
}

///////////////////////////////////////////////////////////////////////////////
// IPC SEND ///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  reader.sendIpcToRenderer(...args);
}

function sendIpcToCoreRenderer(...args) {
  reader.sendIpcToCoreRenderer(...args);
}

///////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function on(id, callback) {
  reader.on(id, callback);
}

function initOnIpcCallbacks() {
  let g_logoMsgIndex = -1;
  on("hs-on-logo-clicked", () => {
    function showLogoUrlToast(text, url) {
      setTimeout(() => {
        sendIpcToCoreRenderer("show-toast-open-url", text, 3000, url, false);
      }, 500);
    }
    // g_logoMsgIndex = Math.floor(Math.random() * messages.length);
    g_logoMsgIndex++;
    if (g_logoMsgIndex > 3) g_logoMsgIndex = 0;
    switch (g_logoMsgIndex) {
      case 0:
      default:
        const hi = `<i class="fa-solid fa-face-smile-wink" style="font-size: 28px;"></i><i class="fa-solid fa-hand-spock"></i> `;
        setTimeout(() => {
          sendIpcToCoreRenderer(
            "show-toast-ipc-core",
            hi,
            3000,
            ["reader", "hs-on-logo-toast-hi-clicked"],
            false,
          );
        }, 500);
        break;
      case 1:
        const time = `<i class="fa-solid fa-clock"></i>&nbsp;&nbsp;${new Date().toLocaleString(
          [],
          {
            hour: "numeric",
            minute: "numeric",
            hour12: settings.getValue("clockFormat") === 1,
          },
        )} `;
        setTimeout(() => {
          sendIpcToCoreRenderer("show-toast", time, 3000, undefined, false);
        }, 500);
        break;
      case 2:
        const version = `<i class="fa-solid fa-code-branch"></i>&nbsp;&nbsp;v${appUtils.getAppVersion()} `; //🗨🕑👋😀
        showLogoUrlToast(
          version,
          "https://github.com/binarynonsense/comic-book-reader",
        );
        break;
      case 3:
        const binary = `<i class="fa-solid fa-link"></i>&nbsp;&nbsp;binarynonsense.com`;
        showLogoUrlToast(binary, "http://www.binarynonsense.com");
        break;
    }
  });

  on("hs-on-logo-toast-hi-clicked", () => {
    sendIpcToRenderer("hs-animate-fireworks");
  });

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
      showFocus,
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
        : _("tool-ep-title"),
      showFocus,
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

  on("hs-open-file-browser", () => {
    tools.switchTool("tool-file-browser");
  });

  on("hs-open-radio", () => {
    core.onMenuToolRadio(0);
  });

  on("hs-quit", () => {
    core.onMenuQuit();
  });

  //////////

  on("hs-open-file", (cardData, listIndex) => {
    let entry;
    if (listIndex === -1) {
      entry = g_favoritesData[cardData.index];
    } else if (
      listIndex >= 0 &&
      g_userLists.length > listIndex &&
      g_userLists[listIndex].data.length > cardData.index
    ) {
      entry = g_userLists[listIndex].data[cardData.index];
    }
    if (entry) {
      if (entry.data) {
        reader.tryOpen(cardData.path, undefined, undefined, entry);
      } else {
        reader.tryOpen(cardData.path, undefined, undefined, entry);
      }
    } else {
      log.editorError("hs-open-file found no entry");
    }
  });

  on("hs-open-history-file", (index) => {
    reader.tryOpen(
      history.getEntryInRecentByIndex(index).filePath,
      undefined,
      history.getEntryInRecentByIndex(index),
    );
  });

  //////////

  on("hs-on-collapse-list-clicked", (listIndex, value) => {
    if (listIndex === -2) {
      g_collapseLatest = value;
      favorites.setValue("collapseLatest", value);
      sendIpcToRenderer("hs-set-list-collapse-value", -2, value);
      buildSections(false);
    } else if (listIndex === -1) {
      g_collapseFavorites = value;
      favorites.setValue("collapseFavorites", value);
      sendIpcToRenderer("hs-set-list-collapse-value", -1, value);
      buildSections(false);
    } else {
      g_userLists[listIndex].collapsed = value;
      buildSections(false);
    }
  });

  on("hs-on-edit-list-name-clicked", (listIndex) => {
    sendIpcToRenderer(
      "hs-show-modal-edit-list-name",
      listIndex,
      g_userLists[listIndex].name,
      _("ui-modal-prompt-button-edit-name"),
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel"),
    );
  });

  on("hs-on-modal-edit-list-name-ok-clicked", (listIndex, newName) => {
    if (!newName) {
      log.editor("Tried to change a list entry to an invalid name");
      sendIpcToCoreRenderer(
        "show-toast",
        _("home-action-canceled") + "\n" + _("home-action-edit-name-error"),
        3000,
      );
      return;
    }
    const list = g_userLists[listIndex];
    if (list.name !== newName) {
      list.name = newName;
      buildSections();
    }
  });

  on("hs-on-remove-list-clicked", (listIndex) => {
    sendIpcToRenderer(
      "hs-show-modal-remove-list-warning",
      listIndex,
      _("tool-shared-modal-title-warning"),
      _("tool-shared-ui-remove-list-warning"),
      _("ui-modal-prompt-button-yes"),
      _("ui-modal-prompt-button-cancel"),
    );
  });

  on("hs-on-remove-list-warning-ok-clicked", (listIndex) => {
    g_userLists.splice(listIndex, 1);
    buildSections();
  });

  //////////

  on("hs-on-add-list-entry-clicked", (listIndex, showFocus) => {
    sendIpcToRenderer(
      "hs-show-modal-add-list-entry",
      listIndex === -1
        ? _("home-section-favorites")
        : g_userLists[listIndex].name,
      _("tool-shared-ui-back"),
      _("tool-shared-ui-add-files"),
      _("tool-shared-ui-add-folders"),
      listIndex,
      showFocus,
    );
  });

  let g_defaultPath;

  on("hs-on-modal-add-list-file-clicked", (listIndex) => {
    let allowMultipleSelection = true;
    let allowedFileTypesName = _("dialog-file-types-comics");
    let allowedFileTypesList = [
      FileExtension.CBZ,
      FileExtension.CBR,
      FileExtension.CB7,
      FileExtension.PDF,
      FileExtension.EPUB,
    ];
    if (!g_defaultPath) g_defaultPath = appUtils.getDesktopFolderPath();
    let filePathsList = appUtils.chooseFiles(
      core.getMainWindow(),
      g_defaultPath,
      allowedFileTypesName,
      allowedFileTypesList,
      allowMultipleSelection,
    );
    if (filePathsList === undefined || filePathsList.length <= 0) {
      return;
    }
    g_defaultPath = path.dirname(filePathsList[0]);
    filePathsList.forEach((filePath) => {
      addEntryToListByLocalPath(listIndex, filePath, false);
    });
    buildSections();
  });

  on("hs-on-modal-add-list-folder-clicked", (listIndex) => {
    if (!g_defaultPath) g_defaultPath = appUtils.getDesktopFolderPath();
    let folderList = appUtils.chooseFolder(
      core.getMainWindow(),
      g_defaultPath,
      true,
    );
    if (folderList === undefined || folderList.length <= 0) {
      return;
    }

    g_defaultPath = folderList[0];
    folderList.forEach((folderPath) => {
      addEntryToListByLocalPath(listIndex, folderPath, false);
    });
    buildSections();
  });

  //////////

  on(
    "hs-on-list-entry-options-clicked",
    (listIndex, cardIndex, cardPath, showFocus) => {
      // TODO: maybe check index and path match?
      const listData = getListData(listIndex);
      const listEntry = listData[cardIndex];

      let isLocalFile = true;
      if (listEntry.data && listEntry.data.source) {
        // www
        isLocalFile = false;
      } else {
        // local
        if (fs.existsSync(cardPath)) {
          if (fs.lstatSync(cardPath).isDirectory()) {
            isLocalFile = false;
          }
        }
      }

      let addToFavorites = undefined;
      let removeFromFavorites = undefined;

      if (listIndex >= 0) {
        // if (isLocalPathInList(-1, cardPath)) {
        if (isEntryInList(-1, listEntry)) {
          removeFromFavorites = _("home-modal-button-removefromfavorites");
        } else {
          addToFavorites = _("home-modal-button-addtofavorites");
        }
      }

      sendIpcToRenderer(
        "hs-show-modal-list-entry-options",
        listIndex,
        cardIndex,
        cardPath,
        _("tool-shared-tab-options"),
        _("tool-shared-ui-back"),
        listIndex === -1
          ? _("home-modal-button-removefromfavorites")
          : _("tool-shared-tooltip-remove-from-list"),
        _("ui-modal-prompt-button-edit-name"),
        _("ui-modal-prompt-button-edit-path"),
        _("tool-shared-tooltip-move-forward-in-list"),
        _("tool-shared-tooltip-move-backward-in-list"),
        !isLocalFile ? undefined : _("ctxmenu-opencontainingfolder"),
        addToFavorites,
        removeFromFavorites,
        !isLocalFile || isLocalPathInList(-1, path.dirname(cardPath))
          ? undefined
          : _("home-modal-button-addcontainingfoldertofavorites"),
        listEntry?.data?.source,
        showFocus,
      );
    },
  );

  on("hs-on-modal-list-entry-options-remove-clicked", (...args) => {
    removeEntryInUserListByIndexAndPath(...args);
  });

  on(
    "hs-on-modal-list-entry-options-edit-name-clicked",
    (listIndex, entryIndex, entryPath) => {
      const listData = getListData(listIndex);
      if (listData[entryIndex].path === entryPath) {
        let entryName = listData[entryIndex].name;
        if (listIndex === -1 && listData[entryIndex].localizedNameId) {
          entryName = getFavoriteLocalizedName(entryIndex);
        }
        sendIpcToRenderer(
          "hs-show-modal-list-entry-edit-name",
          listIndex,
          entryIndex,
          entryPath,
          entryName,
          _("ui-modal-prompt-button-edit-name"),
          _("ui-modal-prompt-button-ok"),
          _("ui-modal-prompt-button-cancel"),
        );
      } else {
        log.error(
          "Tried to edit a list entry with not matching index and path",
        );
      }
    },
  );

  on(
    "hs-on-modal-list-entry-options-edit-name-ok-clicked",
    (listIndex, entryIndex, entryPath, newName) => {
      if (!newName) {
        log.editor("Tried to change a list entry to an invalid name");
        sendIpcToCoreRenderer(
          "show-toast",
          _("home-action-canceled") + "\n" + _("home-action-edit-name-error"),
          3000,
        );
        return;
      }
      const listData = getListData(listIndex);
      if (listData[entryIndex].path === entryPath) {
        if (listIndex === -1 && listData[entryIndex].localizedNameId) {
          let entryName = getFavoriteLocalizedName(entryIndex);
          if (newName !== entryName) {
            listData[entryIndex].localizedNameId = undefined;
            listData[entryIndex].name = newName;
            buildSections();
          }
        } else {
          let entryName = listData[entryIndex].name;
          if (newName !== entryName) {
            listData[entryIndex].name = newName;
            buildSections();
          }
        }
      } else {
        log.error(
          "Tried to edit a list entry with not matching index and path",
        );
      }
    },
  );

  on(
    "hs-on-modal-list-entry-options-edit-path-clicked",
    (listIndex, entryIndex, entryPath) => {
      const listData = getListData(listIndex);
      if (listData[entryIndex].path === entryPath) {
        sendIpcToRenderer(
          "hs-show-modal-list-entry-edit-path",
          listIndex,
          entryIndex,
          entryPath,
          _("ui-modal-prompt-button-edit-path"),
          _("ui-modal-prompt-button-ok"),
          _("ui-modal-prompt-button-cancel"),
        );
      } else {
        log.error(
          "Tried to edit a list entry with not matching index and path",
        );
      }
    },
  );

  on(
    "hs-on-modal-list-entry-options-edit-path-ok-clicked",
    (listIndex, entryIndex, entryPath, newPath) => {
      const listData = getListData(listIndex);
      if (listData[entryIndex].path === entryPath) {
        if (newPath) {
          if (newPath === entryPath || !fs.existsSync(newPath)) {
            log.editor("Tried to change a list entry to an invalid path");
            sendIpcToCoreRenderer(
              "show-toast",
              _("home-action-canceled") +
                "\n" +
                _("home-action-edit-path-error"),
              3000,
            );
            return;
          }
          if (isLocalPathInList(listIndex, newPath)) {
            log.editor(
              "Tried to change a list entry to an path already in the list",
            );
            sendIpcToCoreRenderer(
              "show-toast",
              _("home-action-canceled") +
                "\n" +
                _("home-action-drag-file-shortcut-error-alreadyinlist"),
              3000,
            );
            return;
          }
          listData[entryIndex].path = newPath;
          buildSections();
        }
      } else {
        log.error(
          "Tried to edit a list entry with not matching index and path",
        );
      }
    },
  );

  on(
    "hs-on-modal-list-entry-options-move-clicked",
    (listIndex, entryIndex, entryPath, dir) => {
      const listData = getListData(listIndex);
      if (listData[entryIndex].path === entryPath) {
        if (dir == 0) {
          // backward
          if (entryIndex > 0) {
            let temp = listData[entryIndex - 1];
            listData[entryIndex - 1] = listData[entryIndex];
            listData[entryIndex] = temp;
            buildSections();
          }
        } else if (dir == 1) {
          // forward
          if (entryIndex < listData.length - 1) {
            let temp = listData[entryIndex + 1];
            listData[entryIndex + 1] = listData[entryIndex];
            listData[entryIndex] = temp;
            buildSections();
          }
        }
      } else {
        log.error(
          "Tried to move a list entry with not matching index and path",
        );
      }
    },
  );

  on(
    "hs-on-modal-list-entry-options-addfoldertofavorites-clicked",
    (listIndex, entryIndex, entryPath) => {
      const listData = getListData(listIndex);
      const entry = listData[entryIndex];
      if (!entry.path || (entry.data && entry.data.source)) {
        log.error("Tried to add invalid folder to favorites");
        return;
      }
      addEntryToListByLocalPath(-1, path.dirname(entry.path));
    },
  );

  on(
    "hs-on-modal-list-entry-options-openfolder-clicked",
    (listIndex, entryIndex, entryPath) => {
      appUtils.openPathInFileBrowser(path.dirname(entryPath));
    },
  );

  on(
    "hs-on-modal-list-entry-options-addtofavorites-clicked",
    (listIndex, entryIndex, entryPath) => {
      const listData = getListData(listIndex);
      const entry = listData[entryIndex];
      addEntryToList(-1, entry);
    },
  );

  on("hs-on-modal-list-entry-options-removefavorites-clicked", (...args) => {
    removeEntryInFavoritesByOtherListEntryIndeces(...args);
  });
  //////////////////////

  on("hs-on-list-dropped", (fromListIndex, toListIndex) => {
    if (fromListIndex !== toListIndex) {
      const fromEntry = g_userLists[fromListIndex];
      g_userLists.splice(fromListIndex, 1);
      if (toListIndex >= g_userLists.length) {
        g_userLists.push(fromEntry);
      } else {
        if (toListIndex >= g_userLists.length - 1)
          toListIndex = g_userLists.length - 1;
        g_userLists.splice(toListIndex, 0, fromEntry);
      }
      buildSections(false);
    }
  });

  //////////////////////

  on(
    "hs-on-list-card-dropped",
    (fromListIndex, toListIndex, fromEntryIndex, toEntryIndex, showFocus) => {
      if (fromListIndex === toListIndex) {
        const fromListData = getListData(fromListIndex);
        const fromEntry = fromListData[fromEntryIndex];
        const toListData = getListData(toListIndex);
        fromListData.splice(fromEntryIndex, 1);
        if (toEntryIndex === -1 || toEntryIndex >= toListData.length) {
          // empty card or special last case
          toListData.push(fromEntry);
        } else {
          if (toEntryIndex >= toListData.length - 1)
            toEntryIndex = toListData.length - 1;
          toListData.splice(toEntryIndex, 0, fromEntry);
        }
        buildSections(false);
      } else {
        let showMove = true;
        let showCopy = true;
        let wasEntryInList;
        let fromName;
        if (fromListIndex === -2) {
          // from latest
          showMove = false;
          wasEntryInList = isLatestInList(toListIndex, fromEntryIndex);
        } else {
          const fromListData = getListData(fromListIndex);
          const fromEntry = fromListData[fromEntryIndex];
          wasEntryInList = isEntryInList(toListIndex, fromEntry);
          fromName = fromEntry.name;
        }
        if (!wasEntryInList) {
          /////////////
          sendIpcToRenderer(
            "hs-show-modal-drop-card-options",
            fromListIndex,
            toListIndex,
            fromEntryIndex,
            toEntryIndex,
            fromName,
            _(
              "home-action-drop-file-shortcut-from-to",
              getListName(fromListIndex),
              getListName(toListIndex),
            ),
            _("tool-shared-ui-back"),
            showMove ? _("home-action-move-file-shortcut") : undefined,
            showCopy ? _("home-action-copy-file-shortcut") : undefined,
            showFocus,
          );
        } else {
          log.editor("dropped entry already in list");
          sendIpcToCoreRenderer(
            "show-toast",
            _("home-action-canceled") +
              "\n" +
              _("home-action-drag-file-shortcut-error-alreadyinlist"),
            3000,
          );
        }
      }
    },
  );

  on(
    "hs-on-modal-drop-card-options-move-clicked",
    (fromListIndex, toListIndex, fromEntryIndex, toEntryIndex) => {
      const fromListData = getListData(fromListIndex);
      const fromEntry = fromListData[fromEntryIndex];
      const toListData = getListData(toListIndex);
      if (fromListIndex === -1) {
        // from favs to user list
        if (fromEntry.localizedNameId) {
          fromEntry.name = getFavoriteLocalizedName(fromEntryIndex);
          fromEntry.localizedNameId = undefined;
        }
      }
      if (toEntryIndex === -1) {
        // empty card
        toListData.push(fromEntry);
      } else {
        toListData.splice(toEntryIndex, 0, fromEntry);
      }
      fromListData.splice(fromEntryIndex, 1);
      buildSections(false);
    },
  );

  on(
    "hs-on-modal-drop-card-options-copy-clicked",
    (fromListIndex, toListIndex, fromEntryIndex, toEntryIndex) => {
      if (fromListIndex === -2) {
        addEntryToListByLatestIndex(fromEntryIndex, toListIndex, toEntryIndex);
        buildSections(false);
      } else {
        const fromListData = getListData(fromListIndex);
        const copiedFromEntry = structuredClone(fromListData[fromEntryIndex]);
        const toListData = getListData(toListIndex);
        if (fromListIndex === -1) {
          // from favs to user list
          if (copiedFromEntry.localizedNameId) {
            copiedFromEntry.name = getFavoriteLocalizedName(fromEntryIndex);
            copiedFromEntry.localizedNameId = undefined;
          }
        }
        if (toEntryIndex === -1) {
          // empty card
          toListData.push(copiedFromEntry);
        } else {
          toListData.splice(toEntryIndex, 0, copiedFromEntry);
        }
        buildSections(false);
      }
    },
  );

  //////////////////////

  on("hs-on-create-list-clicked", (showFocus) => {
    sendIpcToRenderer(
      "hs-show-modal-create-list",
      "Comics",
      _("tool-shared-ui-create-list"),
      _("ui-modal-prompt-button-yes"),
      _("ui-modal-prompt-button-no"),
      showFocus,
    );
  });

  on("hs-on-modal-create-list-ok-clicked", (newName) => {
    if (!newName) newName = "Comics";
    let list = {};
    list.name = newName;
    list.collapsed = false;
    list.data = [];
    g_userLists.push(list);
    buildSections();
  });

  /////////////////

  on("hs-on-latest-options-clicked", (latestIndex, filePath, showFocus) => {
    sendIpcToRenderer(
      "hs-show-modal-latest-options",
      latestIndex,
      filePath,
      isLatestInList(-1, latestIndex),
      _("tool-shared-tab-options"),
      _("tool-shared-ui-back"),
      isLatestInList(-1, latestIndex)
        ? _("home-modal-button-removefromfavorites")
        : _("home-modal-button-addtofavorites"),
      _("ctxmenu-opencontainingfolder"),
      !filePath || isLocalPathInList(-1, path.dirname(filePath))
        ? undefined
        : _("home-modal-button-addcontainingfoldertofavorites"),
      g_latestData[latestIndex]?.data?.source,
      showFocus,
    );
  });

  on(
    "hs-on-modal-latest-options-addtofavorites-clicked",
    (fileIndex, filePath) => {
      addEntryToListByLatestIndex(fileIndex, -1);
    },
  );

  on(
    "hs-on-modal-latest-options-addfoldertofavorites-clicked",
    (fileIndex, filePath) => {
      addFolderToFavoritesByLatestIndex(fileIndex, filePath);
    },
  );

  on(
    "hs-on-modal-latest-options-removefromfavorites-clicked",
    (fileIndex, filePath) => {
      removeEntryInFavoritesByLatestIndex(fileIndex, filePath);
    },
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
    _("tool-fb-title"),
    _("menu-tools-rss-reader"),
    _("menu-tools-radio"),
    _("menu-file-quit"),
    _("tool-shared-ui-add"),
    _("tool-shared-ui-collapse-list"),
    _("tool-shared-ui-expand-list"),
    _("home-section-favorites").toUpperCase(),
    _("home-section-recent").toUpperCase(),
    _("tool-shared-ui-create-list"),
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
      "ui-modal-prompt-button-open-in-system-file-browser",
    ),
    openInReader: _("ui-modal-prompt-button-open-in-reader"),
  };
}
