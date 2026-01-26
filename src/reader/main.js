/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { utilityProcess, MessageChannelMain } = require("electron");

const fs = require("node:fs");
const path = require("node:path");

const core = require("../core/main");
const settings = require("../shared/main/settings");
const history = require("../shared/main/history");
const { _ } = require("../shared/main/i18n");
const log = require("../shared/main/logger");
const menuBar = require("../shared/main/menu-bar");
const fileUtils = require("../shared/main/file-utils");
const appUtils = require("../shared/main/app-utils");
const temp = require("../shared/main/temp");
const utils = require("../shared/main/utils");
const fileFormats = require("../shared/main/file-formats");
const contextMenu = require("./menu-context");
const audioPlayer = require("../audio-player/main");
const timers = require("../shared/main/timers");
const tools = require("../shared/main/tools");
const {
  FileExtension,
  FileDataState,
  FileDataType,
  BookType,
} = require("../shared/main/constants");
const homeScreen = require("./home-screen/main");

//////////////////////////////////////////////////////////////////////////////
// SETUP  ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_resizeEventCounter;
let g_delayedRefreshPageEvent;

let g_languageDir = "ltr";
let g_pagesDirection = "ltr";

const PDF_ENGINE = "pdfium";

exports.init = function (filePath, checkHistory) {
  initOnIpcCallbacks();

  const data = fs.readFileSync(path.join(__dirname, "index.html"));
  sendIpcToCoreRenderer("replace-inner-html", "#reader", data.toString());

  updateLocalizedText();
  renderTitle();

  setFilter(settings.getValue("filterMode"));
  if (settings.getValue("fit_mode") === 0) {
    setFitToWidth();
  } else if (settings.getValue("fit_mode") === 1) {
    setFitToHeight();
  } else {
    setScaleToHeight(settings.getValue("zoom_scale"));
  }
  setPagesDirection(settings.getValue("pagesDirection"));

  updateLoadingIndicator();
  updateLayoutClock();
  updateLayoutPageNum();
  updateLayoutAudioPlayer();
  updateLayoutBattery();
  updateToolbarDirection();

  sendIpcToRenderer("add-event-listeners");
  sendIpcToRenderer(
    "set-hide-inactive-mouse-cursor",
    settings.getValue("cursorVisibility") === 1,
  );
  sendIpcToRenderer("set-nav-keys", settings.getValue("navKeys"));
  sendIpcToRenderer("set-nav-buttons", settings.getValue("navButtons"));
  sendIpcToRenderer(
    "set-mousebutton-quickmenu",
    settings.getValue("mouseButtonQuickMenu"),
  );
  sendIpcToRenderer(
    "set-page-turn-on-scroll-boundary",
    settings.getValue("turnPageOnScrollBoundary"),
  );

  showScrollBar(settings.getValue("showScrollBar"));
  setToolbar(settings.getValue("showToolBar"));
  showPageNumber(settings.getValue("showPageNumber"));
  initClock();
  showClock(settings.getValue("showClock"));
  sendIpcToRenderer("init-battery");
  showBattery(settings.getValue("showBattery"));
  showLoadingIndicator(settings.getValue("showLoadingIndicator"));
  audioPlayer.init(core.getMainWindow(), "audio-player-container");
  showAudioPlayer(settings.getValue("showAudioPlayer"));
  homeScreen.open(undefined);

  // if the program is called from the os' 'open with' of file association
  if (filePath && filePath !== "" && fs.existsSync(filePath)) {
    if (tryOpen(filePath)) {
      return;
    }
  }

  if (
    checkHistory &&
    history.getRecent().length > 0 &&
    settings.getValue("on_quit_state") === 1
  ) {
    const entry = history.getEntryInRecentByIndex(
      history.getRecent().length - 1,
    );
    if (tryOpen(entry.filePath, undefined, entry)) {
      return;
    }
  }

  sendIpcToRenderer("set-toolbar-visibility", false);
  sendIpcToRenderer("update-bg", true);
  sendIpcToRenderer("update-loading", false);
  sendIpcToRenderer("render-page-info", 0, 0, false);
};

exports.open = function () {
  // called by switchTool when opening tool
  rebuildMenuAndToolBars(true);
  renderPageRefresh();
};

exports.close = function () {
  // called by switchTool when closing tool
  // disable the menu entries related to the book while in other tool
  rebuildMenuAndToolBars(false);
};

exports.onResize = function () {
  if (g_fileData.state === FileDataState.LOADED) {
    // avoid too much pdf resizing
    clearTimeout(g_resizeEventCounter);
    g_resizeEventCounter = setTimeout(onResizeEventFinished, 500);
  }
};

function onResizeEventFinished() {
  renderPageRefresh();
}

exports.onQuit = function () {
  clearTimeout(g_clockTimeout);
  settings.setValue("on_quit_state", g_fileData.path === "" ? 0 : 1);
  addCurrentToHistory(false);
  audioPlayer.saveSettings();
  homeScreen.close();
  killPageWorker();
};

exports.onMaximize = function () {
  renderPageRefresh();
};

exports.setLanguageDirection = function (direction) {
  g_languageDir = direction;
  homeScreen.setLanguageDirection(g_languageDir);
};

//////////////////////////////////////////////////////////////////////////////
// HISTORY ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function addCurrentToHistory(updateMenu = true) {
  if (
    g_fileData.type === FileDataType.NOT_SET ||
    g_fileData.state !== FileDataState.LOADED
  )
    return;
  if (g_fileData.path !== "") {
    history.addEntryToRecent(
      g_fileData.path,
      g_fileData.pageIndex,
      g_fileData.numPages,
      g_fileData.data,
    );
  }
  if (updateMenu) {
    rebuildMenuAndToolBars();
    homeScreen.refresh();
  }
}

//////////////////////////////////////////////////////////////////////////////
// IPC SEND //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("reader", ...args);
}
exports.sendIpcToRenderer = sendIpcToRenderer;

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}
exports.sendIpcToCoreRenderer = sendIpcToCoreRenderer;

function sendIpcToAudioPlayerRenderer(...args) {
  core.sendIpcToRenderer("audio-player", ...args);
}

function sendIpcToPreload(...args) {
  core.sendIpcToPreload(...args);
}

//////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ///////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_onIpcCallbacks = {};

exports.onIpcFromRenderer = function (...args) {
  const callback = g_onIpcCallbacks[args[0]];
  if (callback) callback(...args.slice(1));
  return;
};

function on(id, callback) {
  g_onIpcCallbacks[id] = callback;
}
exports.on = on;

function initOnIpcCallbacks() {
  on("page-loaded", (data) => {
    g_fileData.state = FileDataState.LOADED;
    sendIpcToRenderer("update-loading", false);
    if (data) {
      if (data.error) {
        // TODO: handle errors loading pages
      } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
        if (data.percentage) {
          g_fileData.pageIndex = Number(data.percentage).toFixed(2);
        } else {
          // shouldn't happen?
        }
      } else if (data.dimensions) {
        g_fileData.pageDimensions = data.dimensions;
      }
    }
    renderPageInfo();
    renderTitle();
    if (g_fileData?.data?.source === "xkcd") {
      sendIpcToRenderer(
        "update-title",
        `${g_fileData.data.name} #${g_fileData.pageIndex + 1}`,
      );
      if (g_fileData.data?.tempData?.title) {
        sendIpcToRenderer(
          "update-img-page-title",
          g_fileData.data.tempData.title,
        );
      }
    }
  });

  on("password-entered", (password) => {
    if (
      g_fileData.type === FileDataType.PDF ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.SEVENZIP
    ) {
      let filePath = g_fileData.path;
      let pageIndex = g_fileData.pageIndex;
      openComicBookFromPath(filePath, pageIndex, password);
    }
  });

  on("password-canceled", () => {
    if (
      g_fileData.type === FileDataType.PDF ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.SEVENZIP
    ) {
      closeCurrentFile();
    }
  });

  on("booktype-entered", (filePath, bookType) => {
    tryOpen(filePath, bookType);
  });

  ////////////////////////////////////////////////////////////////////////////

  on("epub-ebook-loaded", (filePath, percentage) => {
    g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
    g_fileData.type = FileDataType.EPUB_EBOOK;
    if (percentage < 0 || percentage >= 100) percentage = 0;
    g_fileData.pageIndex = percentage;
    updateMenuAndToolbarItems();
    setPageRotation(0, false);
    setInitialZoom(filePath);
    setInitialFixedPageModeSingle();
    addCurrentToHistory();
    goToPercentage(g_fileData.pageIndex);
    renderPageInfo();
    renderTitle();
  });

  on("epub-ebook-load-failed", (error) => {
    // unrecoverable error
    sendIpcToRenderer("update-loading", false);
    log.error(error.message);
    closeCurrentFile(false);
    sendIpcToRenderer(
      "show-modal-info",
      _("ui-modal-title-fileerror"),
      _("ui-modal-info-couldntopen-epub"),
      _("ui-modal-prompt-button-ok"),
    );
  });

  ////////////////////////////////////////////////////////////////////////////

  // on("pdf-loaded", (filePath, pageIndex, numPages, metadata) => {
  //   g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
  //   // TODO double check loaded is the one loading?
  //   // TODO change only if correct
  //   g_fileData.type = FileDataType.PDF;
  //   g_fileData.path = filePath;
  //   g_fileData.name = path.basename(filePath);
  //   g_fileData.pagesPaths = [];
  //   g_fileData.numPages = numPages;
  //   if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
  //   g_fileData.pageIndex = pageIndex;
  //   g_fileData.metadata = metadata;
  //   updateMenuAndToolbarItems();
  //   setPageRotation(0, false);
  //   setInitialZoom(filePath);
  //   setInitialPageMode(filePath);
  //   g_fileData.numPages = numPages;
  //   addCurrentToHistory();
  //   goToPage(pageIndex);
  //   renderPageInfo();
  //   renderTitle();
  // });

  // on("pdf-load-failed", (error) => {
  //   if (
  //     error !== undefined &&
  //     error.name !== undefined &&
  //     error.name === "PasswordException"
  //   ) {
  //     if (error.code === 1) {
  //       // { message: 'No password given', name: 'PasswordException', code: 1 }
  //       sendIpcToRenderer(
  //         "show-modal-prompt-password",
  //         _("ui-modal-prompt-enterpassword"),
  //         path.basename(g_fileData.path),
  //         _("ui-modal-prompt-button-ok"),
  //         _("ui-modal-prompt-button-cancel"),
  //       );
  //     } else if (error.code === 2) {
  //       // { message: 'Incorrect Password', name: 'PasswordException', code: 2 }
  //       sendIpcToRenderer(
  //         "show-modal-prompt-password",
  //         _("ui-modal-prompt-enterpassword"),
  //         path.basename(g_fileData.path),
  //         _("ui-modal-prompt-button-ok"),
  //         _("ui-modal-prompt-button-cancel"),
  //       );
  //     }
  //   } else {
  //     // unrecoverable error
  //     log.error(error);
  //     closeCurrentFile();
  //     sendIpcToRenderer(
  //       "show-modal-info",
  //       _("ui-modal-title-fileerror"),
  //       _("ui-modal-info-couldntopen-pdf"),
  //       _("ui-modal-prompt-button-ok"),
  //     );
  //   }
  // });

  // on(
  //   "pdf-page-dataurl-extracted",
  //   (error, dataUrl, dpi, outputFolderPath, sendToTool) => {
  //     // NOTE: no longer used but don't delete in case I need this some day
  //     // if (error !== undefined) {
  //     //   exportPageError(error);
  //     // } else {
  //     //   exportPageSaveDataUrl(dataUrl, dpi, outputFolderPath, sendToTool);
  //     // }
  //   },
  // );

  ////////////////////////////////////////////////////////////////////////////

  on("escape-pressed", () => {
    if (core.getMainWindow().isFullScreen()) {
      core.toggleFullScreen();
    }
  });

  on("dev-tools-pressed", () => {
    if (core.isDev()) core.toggleDevTools();
  });

  on("home-pressed", () => {
    if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      goToPercentage(0);
    } else {
      if (g_fileData.pageIndex != 0) {
        goToPage(0);
      }
    }
  });

  on("end-pressed", () => {
    if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      goToPercentage(100);
    } else {
      if (g_fileData.pageIndex != g_fileData.numPages - 1) {
        goToPage(g_fileData.numPages - 1);
      }
    }
  });

  on("next-page-pressed", () => {
    goToNextPage();
  });
  on("prev-page-pressed", () => {
    goToPreviousPage();
  });

  on("mouse-click", (mouseX, bodyX) => {
    if (settings.getValue("hotspots_mode") === 1) {
      if (mouseX > bodyX / 2) {
        goToRightPage();
      } else {
        goToLeftPage();
      }
    } else if (settings.getValue("hotspots_mode") === 2) {
      const columnWidth = bodyX / 3;
      if (mouseX < columnWidth) {
        goToLeftPage();
      } else if (mouseX > 2 * columnWidth) {
        goToRightPage();
      }
    }
  });

  on("zoom-in-pressed", (factor = 1) => {
    processZoomInput(1, factor);
  });

  on("zoom-out-pressed", (factor = 1) => {
    processZoomInput(-1, factor);
  });

  on("zoom-reset-pressed", (event) => {
    processZoomInput(0);
  });

  on("switch-scale-mode", (event) => {
    switchScaleMode();
  });

  on("set-scale-mode", (scale) => {
    // called from renderer try-zoom-scale-from-width which is called from main process zoom
    // it's a bit convoluted :)
    setScaleToHeight(scale);
  });

  on("switch-page-mode", (event) => {
    switchPageMode();
  });

  ////////////////////////////////////////////////////////////////////////////

  on("toolbar-button-clicked", (name) => {
    switch (name) {
      case "toolbar-button-right":
        goToRightPage();
        break;
      case "toolbar-button-left":
        goToLeftPage();
        break;
      case "toolbar-button-pagemode-menu-0":
        setPageMode(0, true);
        break;
      case "toolbar-button-pagemode-menu-1":
        setPageMode(1, true);
        break;
      case "toolbar-button-pagemode-menu-2":
        setPageMode(2, true);
        break;
      case "toolbar-button-pagesdirection-menu-0":
        setPagesDirection(0);
        break;
      case "toolbar-button-pagesdirection-menu-1":
        setPagesDirection(1);
        break;
      case "toolbar-button-zoom-menu-0":
        setFitToHeight();
        break;
      case "toolbar-button-zoom-menu-1":
        setFitToWidth();
        break;
      case "toolbar-button-fullscreen-enter":
        core.toggleFullScreen();
        break;
      case "toolbar-button-fullscreen-exit":
        core.toggleFullScreen();
        break;
      case "toolbar-button-open":
        onMenuOpenFile();
        break;
      case "toolbar-button-rotate-clockwise":
        onMenuRotateClockwise();
        break;
      case "toolbar-button-rotate-counterclockwise":
        onMenuRotateCounterclockwise();
        break;
    }
  });

  on("toolbar-slider-changed", (value) => {
    if (g_fileData.state === FileDataState.LOADED) {
      if (g_fileData.type === FileDataType.EPUB_EBOOK) {
        goToPercentage(value);
        return;
      } else {
        value -= 1; // from 1 based to 0 based
        if (value !== g_fileData.pageIndex) {
          goToPage(value);
          return;
        }
      }
    }
    renderPageInfo();
  });

  ////////////////////////////////////////////////////////////////////////////

  on("open-file", (filePath) => {
    tryOpen(filePath);
  });

  on("close-file", () => {
    closeCurrentFile();
  });

  on("go-to-page", (value) => {
    if (!isNaN(value)) {
      let pageIndex = value - 1;
      if (pageIndex >= 0 && pageIndex < g_fileData.numPages) {
        goToPage(pageIndex);
      }
    }
  });

  on("enter-scale-value", (value) => {
    if (!isNaN(value)) {
      let scale = value;
      if (scale < g_scaleToHeightMin || scale > g_scaleToHeightMax) return;
      setScaleToHeight(scale);
    }
  });

  on("go-to-percentage", (value) => {
    if (!isNaN(value)) {
      if (value >= 0 && value <= 100) {
        goToPercentage(value);
      }
    }
  });

  on("show-context-menu", (params) => {
    sendIpcToRenderer("update-toolbar-menus-collapse-all");
    if (params[2]) {
      contextMenu.show("page", params, g_fileData);
    } else {
      contextMenu.show("normal", params, g_fileData);
    }
  });

  on("rebuild-menu-and-toolbar", (isOpen) => {
    rebuildMenuAndToolBars(isOpen);
  });

  ////////////////////////////////////////////////////////////////////////////

  on("open-metadata-tool", () => {
    if (g_fileData.path !== undefined) {
      tools.switchTool("tool-metadata", g_fileData);
    }
  });

  on("open-file-browser-tool", (showFocus) => {
    tools.switchTool("tool-file-browser", g_fileData, showFocus);
  });

  on("open-history-tool", (showFocus) => {
    tools.switchTool("tool-history", showFocus);
  });

  on("open-quick-menu", (showFocus) => {
    sendIpcToRenderer(
      "show-modal-quick-menu",
      _("ui-modal-title-quickmenu"),
      _("tool-shared-ui-back-to-reader"),
      _("ui-modal-prompt-button-close-file"),
      _("tool-fb-title"), //_("ctxmenu-openfile").replace("...", ""),
      _("menu-file-openrecent-history"),
      _("menu-view-togglefullscreen"),
      _("menu-file-quit"),
      showFocus,
    );
  });

  on("open-properties-modal", () => {
    onMenuFileProperties();
  });

  on("open-help-modal", () => {
    core.onMenuAbout();
  });

  on("toggle-fullscreen", () => {
    core.onMenuToggleFullScreen();
  });

  on("open-path-in-browser", (filePath) => {
    appUtils.openPathInFileBrowser(filePath);
  });

  on("open-url-in-browser", (url) => {
    appUtils.openURLInBrowser(url);
  });

  on("quit", () => {
    core.onMenuQuit();
  });
}

//////////////////////////////////////////////////////////////////////////////
// FILES /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_fileData = {
  state: FileDataState.NOT_SET,
  type: FileDataType.NOT_SET,
  path: "",
  name: "",
  pagesPaths: [],
  numPages: 0,
  pageIndex: 0,
  pageRotation: 0,
  pageDimensions: undefined,
  password: "",
  getPageCallback: undefined,
  data: undefined,
  metadata: undefined,
};

exports.getFileData = function () {
  return g_fileData;
};

function cleanUpFileData() {
  g_fileData.state = FileDataState.NOT_SET;
  g_fileData.type = FileDataType.NOT_SET;
  g_fileData.path = "";
  g_fileData.name = "";
  g_fileData.pagesPaths = [];
  g_fileData.numPages = 0;
  g_fileData.pageIndex = 0;
  g_fileData.pageRotation = 0;
  ((g_fileData.pageDimensions = undefined), (g_fileData.password = ""));
  g_fileData.getPageCallback = undefined;
  g_fileData.data = undefined;
  g_fileData.metadata = undefined;
}

exports.updateFileDataMetadataEntry = function (name, value) {
  g_fileData.metadata[name] = value;
};

// called when trying to open second instance with file
exports.requestOpenConfirmation = function (filePath) {
  sendIpcToRenderer(
    "show-modal-request-open-confirmation",
    _("ui-modal-question-openrequestedfile"),
    filePath,
    _("ui-modal-prompt-button-ok"),
    _("ui-modal-prompt-button-cancel"),
    filePath,
  );
};

function tryOpen(filePath, bookType, historyEntry, homeScreenListEntry) {
  sendIpcToPreload("update-menubar"); // in case coming from menu
  closeCurrentFile();
  try {
    if (!bookType) bookType = BookType.NOT_SET;
    let pageIndex;

    // home screen data fav path
    if (homeScreenListEntry) {
      if (homeScreenListEntry.data && homeScreenListEntry.data.source) {
        // check both recent and home lists
        let listIndex = history.getIndexInRecentByData(
          homeScreenListEntry.data,
        );
        if (listIndex !== undefined) {
          historyEntry = history.getEntryInRecentByIndex(listIndex);
        } else {
          listIndex = history.getIndexInHomeByData(homeScreenListEntry.data);
          if (listIndex !== undefined) {
            historyEntry = history.getEntryInHomeByIndex(listIndex);
          }
        }
        if (!historyEntry) {
          // not in history
          if (
            homeScreenListEntry.data.source === "dcm" ||
            homeScreenListEntry.data.source === "iab" ||
            homeScreenListEntry.data.source === "xkcd" ||
            homeScreenListEntry.data.source === "cbp"
          ) {
            return tryOpenWWW(pageIndex, homeScreenListEntry);
          } else if (homeScreenListEntry.data.source === "gut") {
            return tryOpenPath(
              filePath,
              pageIndex,
              BookType.EBOOK,
              homeScreenListEntry, // has same data as history would
            );
          }
        }
      } else {
        // check both recent and home lists
        let listIndex = history.getIndexInRecentByFilePath(filePath);
        if (listIndex !== undefined) {
          historyEntry = history.getEntryInRecentByIndex(listIndex);
        } else {
          listIndex = history.getIndexInHomeByFilePath(filePath);
          if (listIndex !== undefined) {
            historyEntry = history.getEntryInHomeByIndex(listIndex);
          }
        }
      }
    }

    // normal path
    if (!historyEntry) {
      let listIndex = history.getIndexInRecentByFilePath(filePath);
      if (listIndex !== undefined) {
        historyEntry = history.getEntryInRecentByIndex(listIndex);
      }
    }

    if (historyEntry) {
      pageIndex = historyEntry.pageIndex;
      if (historyEntry.data && historyEntry.data.source) {
        if (
          historyEntry.data.source === "dcm" ||
          historyEntry.data.source === "iab" ||
          historyEntry.data.source === "xkcd" ||
          historyEntry.data.source === "cbp"
        ) {
          return tryOpenWWW(pageIndex, historyEntry);
        } else if (historyEntry.data.source === "gut") {
          return tryOpenPath(filePath, pageIndex, BookType.EBOOK, historyEntry);
        }
      }
      if (bookType === BookType.NOT_SET && historyEntry?.data?.bookType) {
        if (settings.getValue("epubOpenAs") === 0)
          bookType = historyEntry.data.bookType;
      }
    }

    if (fileUtils.hasEpubExtension(filePath) && bookType === BookType.NOT_SET) {
      // Special case, as epub can be opened as comic or ebook
      sendIpcToRenderer(
        "show-modal-question-openas",
        _("ui-modal-question-ebookorcomic", "Epub"),
        filePath,
        _("ui-modal-question-button-comicbook"),
        _("ui-modal-question-button-ebook"),
        filePath,
      );
      return true;
    }

    if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
      sendIpcToRenderer(
        "show-modal-info",
        _("ui-modal-title-filenotfound"),
        filePath,
        _("ui-modal-prompt-button-ok"),
      );
      return false;
    }
    return tryOpenPath(filePath, pageIndex, bookType, historyEntry);
  } catch (error) {
    log.editorError(error);
    sendIpcToRenderer(
      "show-modal-info",
      _("ui-modal-title-filenotfound"),
      filePath,
      _("ui-modal-prompt-button-ok"),
    );
    return false;
  }
}
exports.tryOpen = tryOpen;

function tryOpenPath(filePath, pageIndex, bookType, historyEntry) {
  if (bookType === BookType.EBOOK) {
    if (fileUtils.hasEpubExtension(filePath)) {
      return openEbookFromPath(filePath, pageIndex, historyEntry);
    } else {
      // ERROR ??????
    }
  } else {
    if (!fs.existsSync(filePath)) {
      sendIpcToRenderer(
        "show-modal-info",
        _("ui-modal-title-filenotfound"),
        filePath,
        _("ui-modal-prompt-button-ok"),
      );
      return false;
    }
    if (
      !(
        fs.lstatSync(filePath).isDirectory() ||
        fileUtils.hasComicBookExtension(filePath) ||
        fileUtils.hasImageExtension(filePath)
      )
    ) {
      sendIpcToRenderer(
        "show-modal-info",
        _("ui-modal-info-invalidformat"),
        filePath,
        _("ui-modal-prompt-button-ok"),
      );
      return false;
    }
    if (fs.lstatSync(filePath).isDirectory()) {
      openImageFolder(filePath, undefined, pageIndex);
      return true;
    } else if (fileUtils.hasComicBookExtension(filePath)) {
      openComicBookFromPath(filePath, pageIndex, "", historyEntry);
      return true;
    } else if (fileUtils.hasImageExtension(filePath)) {
      openImageFile(filePath);
      return true;
    }
  }
  return false;
}

function tryOpenWWW(pageIndex, historyEntry) {
  const data = historyEntry.data;
  if (data.source === "dcm") {
    const tool = require("../tools/dcm/main");
    openBookFromCallback(data, tool.getPageCallback, pageIndex);
    return true;
  } else if (data.source === "iab") {
    const tool = require("../tools/internet-archive/main");
    openBookFromCallback(data, tool.getPageCallback, pageIndex);
    return true;
  } else if (data.source === "xkcd") {
    const tool = require("../tools/xkcd/main");
    openBookFromCallback(data, tool.getPageCallback, pageIndex);
    return true;
  } else if (data.source === "cbp") {
    const tool = require("../tools/cbp/main");
    openBookFromCallback(data, tool.getPageCallback, pageIndex);
    return true;
  }
  return false;
}

function openImageFile(filePath) {
  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    sendIpcToRenderer("update-bg", true);
    sendIpcToRenderer("update-loading", false);
    return;
  }
  openImageFolder(path.dirname(filePath), filePath);
}

function openImageFolder(folderPath, filePath, pageIndex) {
  sendIpcToRenderer("update-bg", false);
  if (
    folderPath === undefined ||
    folderPath === "" ||
    !fs.existsSync(folderPath)
  ) {
    sendIpcToRenderer("update-bg", true);
    sendIpcToRenderer("update-loading", false);
    sendIpcToRenderer(
      "show-modal-info",
      _("ui-modal-title-foldernotfound"),
      folderPath,
      _("ui-modal-prompt-button-ok"),
    );
    return;
  }

  let pagesPaths = fileUtils.getImageFilesInFolder(folderPath);
  if (pagesPaths.length <= 0) {
    sendIpcToRenderer("update-bg", true);
    sendIpcToRenderer("update-loading", false);
    sendIpcToRenderer(
      "show-modal-info",
      _("ui-modal-title-foldererror"),
      _("ui-modal-info-couldntopen-imagesfolder-empty"),
      _("ui-modal-prompt-button-ok"),
    );
    return;
  }
  pagesPaths.sort(utils.compare);

  if (pageIndex === undefined) {
    if (filePath !== undefined && filePath !== "") {
      for (let index = 0; index < pagesPaths.length; index++) {
        if (pagesPaths[index] === path.basename(filePath)) {
          pageIndex = index;
          break;
        }
      }
    } else {
      let historyIndex = history.getIndexInRecentByFilePath(folderPath);
      if (historyIndex !== undefined) {
        pageIndex = history.getEntryInRecentByIndex(historyIndex).pageIndex;
      }
    }
  }
  if (pageIndex === undefined) pageIndex = 0;

  g_fileData.state = FileDataState.LOADED;
  g_fileData.type = FileDataType.IMGS_FOLDER;
  g_fileData.path = folderPath;
  g_fileData.name = path.basename(folderPath);
  g_fileData.pagesPaths = pagesPaths;
  g_fileData.numPages = pagesPaths.length;
  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
  g_fileData.pageIndex = pageIndex;
  updateMenuAndToolbarItems();
  setPageRotation(0, false);
  setInitialZoom(g_fileData.path);
  setInitialFixedPageModeSingle();
  goToPage(pageIndex);
}

function openComicBookFromPath(filePath, pageIndex, password, historyEntry) {
  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    return;
  }

  sendIpcToRenderer("update-loading", true);
  sendIpcToRenderer("update-bg", false);

  let fileExtension = path.extname(filePath).toLowerCase();
  if (!pageIndex) pageIndex = 0;
  if (!password) password = "";

  (async () => {
    let fileType = fileUtils.getFileTypeFromPath(filePath);
    if (fileType !== undefined) {
      fileExtension = "." + fileType;
    }
    if (fileExtension === "." + FileExtension.PDF && PDF_ENGINE === "pdfium") {
      if (g_fileData.state !== FileDataState.LOADING) {
        cleanUpFileData();
        g_fileData.type = FileDataType.PDF;
        g_fileData.state = FileDataState.LOADING;
        g_fileData.pageIndex = pageIndex;
        g_fileData.path = filePath;
      }
      startPageWorker();
      g_fileData.password = password;
      sendToPageWorker({
        command: "open",
        fileType: g_fileData.type,
        filePath: g_fileData.path,
        pageIndex,
        password,
      });
    }
    // else if (fileExtension === "." + FileExtension.PDF) {
    //   if (g_fileData.state !== FileDataState.LOADING) {
    //     cleanUpFileData();
    //     g_fileData.type = FileDataType.PDF;
    //     g_fileData.state = FileDataState.LOADING;
    //     g_fileData.pageIndex = pageIndex; // ref: file-type -> https://www.npmjs.com/package/file-type
    //     // e.g. {ext: 'png', mime: 'image/png'}
    //     g_fileData.path = filePath;
    //   }
    //   g_fileData.password = password;
    //   sendIpcToRenderer("load-pdf", filePath, pageIndex, password);
    // }
    else if (fileExtension === "." + FileExtension.EPUB) {
      let pagesPaths = await fileFormats.getEpubImageIdsList(filePath);
      if (pagesPaths !== undefined && pagesPaths.length > 0) {
        g_fileData.state = FileDataState.LOADED;
        g_fileData.type = FileDataType.EPUB_COMIC;
        g_fileData.path = filePath;
        g_fileData.name = path.basename(filePath);
        g_fileData.pagesPaths = pagesPaths; // not really paths, ids
        g_fileData.numPages = pagesPaths.length;
        if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
        g_fileData.pageIndex = pageIndex;
        g_fileData.password = password;
        g_fileData.data = { bookType: BookType.COMIC };
        updateMenuAndToolbarItems();
        setPageRotation(0, false);
        setInitialZoom(filePath);
        setInitialPageMode(filePath);
        addCurrentToHistory();
        goToPage(pageIndex);
      } else {
        sendIpcToRenderer(
          "show-modal-info",
          _("ui-modal-title-fileerror"),
          _("ui-modal-info-couldntopen-epub"),
          _("ui-modal-prompt-button-ok"),
        );
        sendIpcToRenderer("update-bg", true);
        sendIpcToRenderer("update-loading", false);
      }
    } else {
      if (
        fileExtension === "." + FileExtension.RAR ||
        fileExtension === "." + FileExtension.CBR
      ) {
        const tempSubFolderPath = temp.createSubFolder();
        let rarData = await fileFormats.getRarEntriesList(
          filePath,
          password,
          tempSubFolderPath,
        );
        temp.deleteSubFolder(tempSubFolderPath);
        if (rarData.result === "password required") {
          if (g_fileData.state !== FileDataState.LOADING) {
            cleanUpFileData();
            g_fileData.state = FileDataState.LOADING;
            g_fileData.type = FileDataType.RAR;
            g_fileData.path = filePath;
            g_fileData.pageIndex = pageIndex;
          }
          g_fileData.password = password;
          sendIpcToRenderer(
            "show-modal-prompt-password",
            _("ui-modal-prompt-enterpassword"),
            path.basename(g_fileData.path),
            _("ui-modal-prompt-button-ok"),
            _("ui-modal-prompt-button-cancel"),
          );
          return;
        } else if (rarData.result === "other error") {
          if (rarData.extra === "over2gb") {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-rar") +
                "\n" +
                _("ui-modal-info-invalidsize-cap-b", "2GB"),
              _("ui-modal-prompt-button-ok"),
            );
          } else {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-rar"),
              _("ui-modal-prompt-button-ok"),
            );
          }
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
          return;
        }
        let pagesPaths = rarData.paths;
        // ignore files in "__MACOSX" folder
        pagesPaths = pagesPaths.filter(function (item) {
          return !item.includes("__MACOSX");
        });
        pagesPaths.sort(utils.compare);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.RAR;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.numPages = pagesPaths.length;
          if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
          g_fileData.pageIndex = pageIndex;
          g_fileData.password = password;
          g_fileData.metadata = rarData.metadata;
          updateMenuAndToolbarItems();
          setPageRotation(0, false);
          setInitialZoom(filePath);
          setInitialPageMode(filePath);
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-rar"),
            _("ui-modal-prompt-button-ok"),
          );
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
        }
      } else if (
        fileExtension === "." + FileExtension.ZIP ||
        fileExtension === "." + FileExtension.CBZ
      ) {
        //let zipData = fileFormats.getZipEntriesList(filePath, password);
        let zipData = await fileFormats.get7ZipEntriesList(
          filePath,
          password,
          "zip",
        );
        if (zipData.result === "password required") {
          if (g_fileData.state !== FileDataState.LOADING) {
            cleanUpFileData();
            g_fileData.state = FileDataState.LOADING;
            g_fileData.type = FileDataType.ZIP;
            g_fileData.path = filePath;
            g_fileData.pageIndex = pageIndex;
          }
          g_fileData.password = password;
          sendIpcToRenderer(
            "show-modal-prompt-password",
            _("ui-modal-prompt-enterpassword"),
            path.basename(g_fileData.path),
            _("ui-modal-prompt-button-ok"),
            _("ui-modal-prompt-button-cancel"),
          );
          return;
        } else if (zipData.result === "other error") {
          if (zipData.extra == "aes") {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-zip-aes"),
              _("ui-modal-prompt-button-ok"),
            );
          } else if (zipData.extra === "over2gb") {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-zip") +
                "\n" +
                _("ui-modal-info-invalidsize-cap-b", "2GB"),
              _("ui-modal-prompt-button-ok"),
            );
          } else {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-zip"),
              _("ui-modal-prompt-button-ok"),
            );
          }
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
          return;
        }
        let pagesPaths = zipData.paths;
        // ignore files in "__MACOSX" folder
        pagesPaths = pagesPaths.filter(function (item) {
          return !item.includes("__MACOSX");
        });
        pagesPaths.sort(utils.compare);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.ZIP;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.numPages = pagesPaths.length;
          if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
          g_fileData.pageIndex = pageIndex;
          g_fileData.password = password;
          g_fileData.metadata = zipData.metadata;
          updateMenuAndToolbarItems();
          setPageRotation(0, false);
          setInitialZoom(filePath);
          setInitialPageMode(filePath);
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-zip"),
            _("ui-modal-prompt-button-ok"),
          );
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
        }
      } else if (
        fileExtension === "." + FileExtension.SEVENZIP ||
        fileExtension === "." + FileExtension.CB7
      ) {
        let sevenData = await fileFormats.get7ZipEntriesList(
          filePath,
          password,
        );
        if (sevenData.result === "password required") {
          if (g_fileData.state !== FileDataState.LOADING) {
            cleanUpFileData();
            g_fileData.state = FileDataState.LOADING;
            g_fileData.type = FileDataType.SEVENZIP;
            g_fileData.path = filePath;
            g_fileData.pageIndex = pageIndex;
          }
          g_fileData.password = password;
          sendIpcToRenderer(
            "show-modal-prompt-password",
            _("ui-modal-prompt-enterpassword"),
            path.basename(g_fileData.path),
            _("ui-modal-prompt-button-ok"),
            _("ui-modal-prompt-button-cancel"),
          );
          return;
        } else if (sevenData.result === "other error") {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-7z"),
            _("ui-modal-prompt-button-ok"),
          );
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
          return;
        }
        let pagesPaths = sevenData.paths;
        // ignore files in "__MACOSX" folders
        pagesPaths = pagesPaths.filter(function (item) {
          return !item.includes("__MACOSX");
        });
        pagesPaths.sort(utils.compare);
        if (pagesPaths !== undefined && pagesPaths.length > 0) {
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.SEVENZIP;
          g_fileData.path = filePath;
          g_fileData.name = path.basename(filePath);
          g_fileData.pagesPaths = pagesPaths;
          g_fileData.numPages = pagesPaths.length;
          if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
          g_fileData.pageIndex = pageIndex;
          g_fileData.password = password;
          g_fileData.metadata = sevenData.metadata;
          updateMenuAndToolbarItems();
          setPageRotation(0, false);
          setInitialZoom(filePath);
          setInitialPageMode(filePath);
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-7z"),
            _("ui-modal-prompt-button-ok"),
          );
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
        }
      } else {
        sendIpcToRenderer(
          "show-modal-info",
          _("ui-modal-title-fileerror"),
          _("ui-modal-info-invalidformat"),
          _("ui-modal-prompt-button-ok"),
        );
        sendIpcToRenderer("update-bg", true);
        sendIpcToRenderer("update-loading", false);
        return;
      }
    }
  })(); // async
}

async function openEbookFromPath(filePath, pageIndex, historyEntry) {
  if (filePath === undefined || filePath === "") {
    return false;
  }
  closeCurrentFile(); // in case coming from tool and bypassing tryopen
  let fileExtension = path.extname(filePath).toLowerCase();
  if (fileExtension === "." + FileExtension.EPUB) {
    let data;
    let cachedPath;
    let name = path.basename(filePath);
    if (historyEntry?.data?.source === "gut") {
      data = historyEntry.data;
      if (data.name && data.name != "") name = data.name;
      // cached file
      if (filePath.startsWith("http")) {
        if (settings.getValue("toolGutUseCache")) {
          sendIpcToRenderer("update-loading", true);
          sendIpcToRenderer("update-bg", false);
          const url = filePath;
          const tool = require("../tools/gutenberg/main");
          const cacheFolder = tool.getPortableCacheFolder();
          const fileName = path.basename(filePath);
          cachedPath = path.join(cacheFolder, fileName);

          if (!fs.existsSync(cachedPath)) {
            try {
              // download it
              const axios = require("axios").default;
              const response = await axios.get(url, {
                responseType: "arraybuffer",
                timeout: 10000,
              });

              if (!response?.data) {
                throw {
                  name: "GenericError",
                  message: "Invalid response data",
                };
              }
              if (!fs.existsSync(cacheFolder)) {
                log.editor("creating gutenberg cache folder");
                fs.mkdirSync(cacheFolder, { recursive: true });
              }
              fs.writeFileSync(cachedPath, response.data, { flag: "w" });
            } catch (error) {
              log.error(error?.message);
              // couldn't download file -> abort
              sendIpcToRenderer("update-loading", false);
              sendIpcToRenderer("update-bg", true);
              return false;
            }
          }
        } else {
          log.editor("gutenberg cache is disabled");
        }
      }
    }

    sendIpcToRenderer("update-loading", true);
    sendIpcToRenderer("update-bg", false);
    cleanUpFileData();

    g_fileData.type = FileDataType.EPUB_EBOOK;
    g_fileData.state = FileDataState.LOADING;
    g_fileData.path = filePath;
    g_fileData.name = name;
    if (!pageIndex || pageIndex < 0 || pageIndex >= 100) pageIndex = 0;
    g_fileData.pageIndex = pageIndex;
    g_fileData.numPages = 100;
    if (data) {
      g_fileData.data = data;
    } else {
      g_fileData.data = { bookType: BookType.EBOOK };
    }

    sendIpcToRenderer(
      "update-epub-ebook-color-mode",
      settings.getValue("epubEbookColorMode"),
      settings.getValue("epubEbookColorText"),
      settings.getValue("epubEbookColorBg"),
    );
    sendIpcToRenderer("load-epub-ebook", filePath, pageIndex, cachedPath);
    return true;
  } else {
    sendIpcToRenderer("update-loading", false);
    sendIpcToRenderer("update-bg", true);
    sendIpcToRenderer(
      "show-modal-info",
      _("ui-modal-info-invalidformat"),
      filePath,
      _("ui-modal-prompt-button-ok"),
    );
    return false;
  }
}
exports.openEbookFromPath = openEbookFromPath;

function openBookFromCallback(comicData, getPageCallback, pageIndex = 0) {
  sendIpcToRenderer("update-bg", false);
  sendIpcToRenderer("update-loading", true);
  closeCurrentFile();
  g_fileData.state = FileDataState.LOADED;
  g_fileData.type = FileDataType.WWW;
  g_fileData.path = comicData.url ?? comicData.name;
  g_fileData.name = comicData.name;
  g_fileData.pagesPaths = [];
  g_fileData.numPages = comicData.numPages;
  if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
  g_fileData.pageIndex = pageIndex;
  g_fileData.getPageCallback = getPageCallback;
  g_fileData.data = comicData;
  updateMenuAndToolbarItems();
  setPageRotation(0, false);
  setInitialZoom(g_fileData.path);
  setInitialFixedPageModeSingle();
  goToPage(g_fileData.pageIndex);
}
exports.openBookFromCallback = openBookFromCallback;

//////////////////////////////////////////////////////////////////////////////

function tryOpeningAdjacentFile(next) {
  // next true -> try next, next false -> try prev
  if (g_fileData.type === FileDataType.IMGS_FOLDER) return;
  const fileName = path.basename(g_fileData.path);
  const folderPath = path.dirname(g_fileData.path);
  let allFiles = fs.readdirSync(folderPath);
  let comicFiles = [];
  allFiles.forEach((file) => {
    if (fileUtils.hasComicBookExtension(file)) {
      comicFiles.push(file);
    }
  });
  comicFiles.sort(utils.compare);
  for (let index = 0; index < comicFiles.length; index++) {
    if (comicFiles[index] === fileName) {
      if (next) {
        if (index < comicFiles.length - 1) {
          let nextFileName = path.join(folderPath, comicFiles[index + 1]);
          tryOpen(nextFileName);
          return;
        }
      } else {
        if (index > 0) {
          let prevFileName = path.join(folderPath, comicFiles[index - 1]);
          tryOpen(prevFileName);
          return;
        }
      }
      break;
    }
  }
}

function closeCurrentFile(addToHistory = true) {
  sendIpcToRenderer("close-modal");
  if (g_fileData.type === FileDataType.NOT_SET) return;
  if (addToHistory) addCurrentToHistory(); // add the one I'm closing to history
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    sendIpcToRenderer("close-epub-ebook");
  }
  cleanUpFileData();
  // TODO: in pdfs, should I call closePdf() in worker and wait??? or
  // killing the wirker is good enough as it destroys everything
  killPageWorker();

  menuBar.rebuild();
  updateMenuAndToolbarItems();
  renderTitle();
  sendIpcToRenderer("file-closed");
  sendIpcToRenderer("update-toolbar-menus-collapse-all");
  sendIpcToRenderer("set-scrollbar-position", 0);
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("update-loading", false);
}

//////////////////////////////////////////////////////////////////////////////
// PAGE NAVIGATION ///////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function goToPage(pageIndex, scrollBarPos = 0) {
  // scrollbar: 0 top - 1 bottom
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    return;
  }

  sendIpcToRenderer("update-loading", true);
  if (g_fileData.type !== FileDataType.EPUB_EBOOK) {
    if (pageIndex < 0 || pageIndex >= g_fileData.numPages) return;
    g_fileData.pageIndex = pageIndex;
  }

  function getGoToIndexes() {
    let indexes = [];
    if (settings.getValue("page_mode") === 0) {
      // single page mode
      indexes.push(g_fileData.pageIndex);
    } else if (settings.getValue("page_mode") === 1) {
      // double page mode
      if (g_fileData.pageIndex % 2 > 0) {
        g_fileData.pageIndex--;
      }
      indexes.push(g_fileData.pageIndex);
      if (g_fileData.pageIndex + 1 < g_fileData.numPages)
        indexes.push(g_fileData.pageIndex + 1);
    } else {
      // double page mode center first
      if (g_fileData.pageIndex === 0) {
        indexes.push(g_fileData.pageIndex);
      } else {
        if (g_fileData.pageIndex % 2 === 0) {
          g_fileData.pageIndex--;
        }
        indexes.push(g_fileData.pageIndex);
        if (g_fileData.pageIndex + 1 < g_fileData.numPages)
          indexes.push(g_fileData.pageIndex + 1);
      }
    }
    return indexes;
  }

  if (
    g_fileData.type === FileDataType.ZIP ||
    g_fileData.type === FileDataType.RAR ||
    g_fileData.type === FileDataType.SEVENZIP ||
    g_fileData.type === FileDataType.EPUB_COMIC ||
    g_fileData.type === FileDataType.IMGS_FOLDER
  ) {
    g_fileData.state = FileDataState.LOADING;
    timers.start("pagesExtraction");

    let tempSubFolderPath =
      g_fileData.type === FileDataType.SEVENZIP ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR
        ? temp.createSubFolder()
        : undefined;

    if (startPageWorker()) {
      // TODO: if pdf load file?
    }

    let entryNames = [];
    let pageIndexes = getGoToIndexes();
    pageIndexes.forEach((index) => {
      entryNames.push(g_fileData.pagesPaths[index]);
    });
    if (startPageWorker()) {
      // TODO: if pdf load file?
    }

    sendToPageWorker({
      command: "extract",
      fileType: g_fileData.type,
      filePath: g_fileData.path,
      entryNames,
      scrollBarPos,
      password: g_fileData.password,
      tempSubFolderPath,
    });
  } else if (g_fileData.type === FileDataType.PDF && PDF_ENGINE === "pdfium") {
    g_fileData.state = FileDataState.LOADING;
    timers.start("pagesExtraction");

    let pageIndexes = getGoToIndexes();
    if (startPageWorker()) {
      // TODO: if pdf load file?
    }
    sendToPageWorker({
      command: "extract",
      fileType: g_fileData.type,
      filePath: g_fileData.path,
      entryNames: pageIndexes,
      scrollBarPos,
      password: g_fileData.password,
      extraData: { dpi: settings.getValue("pdfReadingDpi") },
    });
  } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    if (pageIndex > 0) {
      g_fileData.state = FileDataState.LOADING;
      sendIpcToRenderer("render-epub-ebook-page-next");
    } else if (pageIndex < 0) {
      g_fileData.state = FileDataState.LOADING;
      sendIpcToRenderer("render-epub-ebook-page-prev");
    }
  }
  // // PDF old pdfjs method
  // else if (g_fileData.type === FileDataType.PDF) {
  //   g_fileData.state = FileDataState.LOADING;
  //   let pageIndexes = getGoToIndexes();
  //   sendIpcToRenderer(
  //     "render-pdf-page",
  //     pageIndexes,
  //     g_fileData.pageRotation,
  //     scrollBarPos,
  //   );
  // }
  else if (g_fileData.type === FileDataType.WWW) {
    (async () => {
      g_fileData.state = FileDataState.LOADING;
      const calledFunc = g_fileData.getPageCallback;
      let response = await g_fileData.getPageCallback(
        g_fileData.pageIndex + 1,
        g_fileData,
      );
      if (calledFunc !== g_fileData.getPageCallback) {
        // getPageCallback changed while downloading
        return;
      }
      if (!response || !response.pageImgSrc) {
        // TODO: handle error
        log.error("download error");
        g_fileData.state = FileDataState.LOADED;
        sendIpcToRenderer("update-loading", false);
        return;
      }
      g_fileData.pagesPaths = [response.pageImgUrl];
      if (response.tempData) {
        if (g_fileData.data) {
          g_fileData.data.tempData = response.tempData;
        }
      }
      sendIpcToRenderer(
        "render-img-page",
        [{ url: response.pageImgSrc }],
        g_fileData.pageRotation,
        scrollBarPos,
      );
    })(); // async
  }
}

function goToNextPage() {
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPage(1);
  } else {
    if (g_fileData.pageIndex + 1 < g_fileData.numPages) {
      if (settings.getValue("page_mode") === 0) {
        // single page mode
        goToPage(g_fileData.pageIndex + 1);
      } else if (settings.getValue("page_mode") === 1) {
        // double
        if ((g_fileData.pageIndex + 1) % 2 > 0) {
          if (g_fileData.pageIndex + 2 < g_fileData.numPages) {
            g_fileData.pageIndex++;
            goToPage(g_fileData.pageIndex + 1);
          }
        } else {
          goToPage(g_fileData.pageIndex + 1);
        }
      } else {
        // double center first
        if ((g_fileData.pageIndex + 1) % 2 === 0) {
          if (g_fileData.pageIndex + 2 < g_fileData.numPages) {
            g_fileData.pageIndex++;
            goToPage(g_fileData.pageIndex + 1);
          }
        } else {
          goToPage(g_fileData.pageIndex + 1);
        }
      }
    } else if (
      settings.getValue("autoOpen") === 1 ||
      settings.getValue("autoOpen") === 2
    ) {
      tryOpeningAdjacentFile(true);
    }
  }
}

function goToPreviousPage() {
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPage(-1);
  } else {
    if (g_fileData.pageIndex - 1 >= 0) {
      if (settings.getValue("page_mode") === 0) {
        // single page mode
        goToPage(g_fileData.pageIndex - 1, 1);
      } else if (settings.getValue("page_mode") === 1) {
        // double
        if ((g_fileData.pageIndex - 1) % 2 > 0) {
          g_fileData.pageIndex--;
        }
        goToPage(g_fileData.pageIndex - 1, 1);
      } else {
        // double center first
        if (g_fileData.pageIndex - 1 === 0) {
          goToPage(g_fileData.pageIndex - 1, 1);
        } else {
          if ((g_fileData.pageIndex - 1) % 2 === 0) {
            g_fileData.pageIndex--;
          }
          goToPage(g_fileData.pageIndex - 1, 1);
        }
      }
    } else if (settings.getValue("autoOpen") === 2) {
      tryOpeningAdjacentFile(false);
    }
  }
}

function goToRightPage() {
  if (g_pagesDirection === "rtl") {
    goToPreviousPage();
  } else {
    goToNextPage();
  }
}

function goToLeftPage() {
  if (g_pagesDirection === "rtl") {
    goToNextPage();
  } else {
    goToPreviousPage();
  }
}

function goToPercentage(percentage) {
  if (
    g_fileData.state !== FileDataState.LOADED ||
    g_fileData.type === FileDataType.NOT_SET
  ) {
    sendIpcToRenderer("update-bg", true);
    sendIpcToRenderer("update-loading", false);
    return;
  }
  sendIpcToRenderer("update-loading", true);

  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    if (percentage < 0 || percentage > 100) return;
    g_fileData.pageIndex = percentage;
    g_fileData.state = FileDataState.LOADING;
    sendIpcToRenderer("render-epub-ebook-page-percentage", percentage);
  }
}

//////////////////////////////////////////////////////////////////////////////
// RENDER ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function renderTitle() {
  core.renderTitle();
}

exports.generateTitle = function () {
  let title = "---";
  if (core.getMainWindow().getSize()[0] < 600) {
    title = "ACBR";
  } else if (g_fileData.state === FileDataState.NOT_SET) {
    title = "Comic Book Reader - ACBR";
  } else {
    title = `${g_fileData.name}`;
    let length = 50;
    if (core.getMainWindow().getSize()[0] < 700) length = 10;
    else if (core.getMainWindow().getSize()[0] < 750) length = 20;
    else if (core.getMainWindow().getSize()[0] < 850) length = 35;
    else if (core.getMainWindow().getSize()[0] > 1500) length = 120;
    else if (core.getMainWindow().getSize()[0] >= 1280) length = 100;
    title =
      title.length > length
        ? title.substring(0, length - 3) + "..."
        : title.substring(0, length);
    title += " - ACBR";
  }
  return title;
};

function renderPageInfo() {
  let isPercentage = g_fileData.type === FileDataType.EPUB_EBOOK;
  sendIpcToRenderer(
    "render-page-info",
    g_fileData.pageIndex,
    g_fileData.numPages,
    isPercentage,
  );
}

function onDelayedRefreshPageCall() {
  if (g_fileData.type === FileDataType.PDF) {
    sendIpcToRenderer("refresh-pdf-page", g_fileData.pageRotation);
  }
}

function renderPageRefresh() {
  if (g_fileData.state === FileDataState.LOADED) {
    // if (g_fileData.type === FileDataType.PDF) {
    //   clearTimeout(g_delayedRefreshPageEvent);
    //   g_delayedRefreshPageEvent = setTimeout(onDelayedRefreshPageCall, 300);
    // } else
    if (
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.SEVENZIP ||
      g_fileData.type === FileDataType.IMGS_FOLDER ||
      g_fileData.type === FileDataType.PDF || // pdfium
      g_fileData.type === FileDataType.WWW
    ) {
      sendIpcToRenderer("refresh-img-page", g_fileData.pageRotation);
    } else if (g_fileData.type === FileDataType.EPUB_COMIC) {
      sendIpcToRenderer("refresh-epub-comic-page", g_fileData.pageRotation);
    } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      sendIpcToRenderer("refresh-epub-ebook-page", g_fileData.pageRotation);
    }
  }
}

function rebuildMenuAndToolBars(isOpen = true) {
  menuBar.rebuild();
  updateMenuAndToolbarItems(isOpen);
  sendIpcToPreload("update-menubar");
}
exports.rebuildMenuAndToolBars = rebuildMenuAndToolBars;

function updateMenuAndToolbarItems(isOpen = true) {
  if (isOpen) {
    if (g_fileData.path && g_fileData.path !== "") {
      if (
        g_fileData.type === FileDataType.ZIP ||
        g_fileData.type === FileDataType.RAR ||
        g_fileData.type === FileDataType.SEVENZIP ||
        g_fileData.type === FileDataType.EPUB_COMIC ||
        g_fileData.type === FileDataType.PDF
      ) {
        menuBar.setComicBookOpened(true);
        sendIpcToRenderer(
          "update-toolbar-rotation-buttons",
          settings.getValue("page_mode") === 0,
        );
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
        sendIpcToRenderer("update-toolbar-pagesdirection-buttons", true);
        sendIpcToRenderer("update-toolbar-pagemode-buttons", true);
      } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
        menuBar.setEpubEbookOpened();
        sendIpcToRenderer("update-toolbar-rotation-buttons", false);
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
        sendIpcToRenderer("update-toolbar-pagesdirection-buttons", true);
        sendIpcToRenderer("update-toolbar-pagemode-buttons", false);
      } else if (g_fileData.type === FileDataType.IMGS_FOLDER) {
        menuBar.setImageOpened();
        sendIpcToRenderer("update-toolbar-rotation-buttons", true);
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
        sendIpcToRenderer("update-toolbar-pagesdirection-buttons", true);
        sendIpcToRenderer("update-toolbar-pagemode-buttons", false);
      } else if (g_fileData.type === FileDataType.WWW) {
        menuBar.setWWWOpened();
        sendIpcToRenderer("update-toolbar-rotation-buttons", true);
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
        sendIpcToRenderer("update-toolbar-pagesdirection-buttons", true);
        sendIpcToRenderer("update-toolbar-pagemode-buttons", false);
      } else {
        menuBar.setComicBookOpened(false);
        menuBar.setCanOpenBooks(true);
        menuBar.setCanOpenTools(true);
        sendIpcToRenderer("update-toolbar-rotation-buttons", false);
        sendIpcToRenderer("update-toolbar-page-buttons", false);
        sendIpcToRenderer("update-toolbar-zoom-buttons", false);
        sendIpcToRenderer("update-toolbar-pagesdirection-buttons", false);
        sendIpcToRenderer("update-toolbar-pagemode-buttons", false);
      }

      sendIpcToRenderer(
        "set-toolbar-visibility",
        settings.getValue("showToolBar"),
      );
    } else {
      menuBar.setComicBookOpened(false);
      menuBar.setCanOpenBooks(true);
      menuBar.setCanOpenTools(true);
      menuBar.setCanTweakUI(true);
      sendIpcToRenderer("set-toolbar-visibility", false);
    }
  } else {
    menuBar.setComicBookOpened(false);
    sendIpcToRenderer("set-toolbar-visibility", false);
  }
}

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-toolbar-tooltips",
    _("ctxmenu-openfile"),
    _("toolbar-go-left"),
    _("toolbar-go-right"),
    _("toolbar-rotate-counterclockwise"),
    _("toolbar-rotate-clockwise"),
    _("menu-view-togglefullscreen"),
    _("tool-shared-ui-collapse-list"),
    _("menu-view-zoom"),
    [
      _("menu-view-zoom-fitheight"),
      _("menu-view-zoom-fitwidth"),
      _("menu-view-zoom-scaleheight"),
    ],
    _("menu-view-layout-pagemode"),
    [
      _("menu-view-layout-pagemode-singlepage"),
      _("menu-view-layout-pagemode-doublepage"),
      _("menu-view-layout-pagemode-doublepage") +
        " (" +
        _("menu-view-layout-pagemode-centerfirst") +
        ")",
      ,
    ],
    _("menu-view-layout-pagesdirection"),
    [
      _("menu-view-layout-pagesdirection-ltr"),
      _("menu-view-layout-pagesdirection-rtl"),
    ],
  );
  homeScreen.updateLocalizedText();
}
exports.updateLocalizedText = updateLocalizedText;

function updateLoadingIndicator() {
  sendIpcToRenderer(
    "update-loading-indicator",
    settings.getValue("loadingIndicatorBG"),
    settings.getValue("loadingIndicatorIconSize"),
    settings.getValue("loadingIndicatorIconPos"),
  );
}
exports.updateLoadingIndicator = updateLoadingIndicator;

function updateLayoutClock() {
  sendIpcToRenderer(
    "update-layout-pos",
    settings.getValue("layoutClock"),
    "#clock-bubble",
  );
}
exports.updateLayoutClock = updateLayoutClock;

function updateLayoutPageNum() {
  sendIpcToRenderer(
    "update-layout-pos",
    settings.getValue("layoutPageNum"),
    "#page-number-bubble",
  );
}
exports.updateLayoutPageNum = updateLayoutPageNum;

function updateLayoutAudioPlayer() {
  sendIpcToAudioPlayerRenderer(
    "update-layout-pos",
    settings.getValue("layoutAudioPlayer"),
  );
}
exports.updateLayoutAudioPlayer = updateLayoutAudioPlayer;

function updateLayoutBattery() {
  sendIpcToRenderer(
    "update-layout-pos",
    settings.getValue("layoutBattery"),
    "#battery-bubble",
  );
}
exports.updateLayoutBattery = updateLayoutBattery;

function updateToolbarDirection() {
  let direction = "ltr";
  // g_languageDir
  switch (settings.getValue("toolbarDirection")) {
    case 0:
      direction = g_languageDir;
      break;
    case 2:
      direction = "rtl";
      break;
  }
  sendIpcToRenderer("update-toolbar-direction", direction);
}
exports.updateToolbarDirection = updateToolbarDirection;

//////////////////////////////////////////////////////////////////////////////
// SHOW/HIDE /////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function showScrollBar(isVisible) {
  settings.setValue("showScrollBar", isVisible);
  sendIpcToRenderer("set-scrollbar-visibility", isVisible);
  menuBar.setScrollBar(isVisible);
}

function toggleScrollBar() {
  showScrollBar(!settings.getValue("showScrollBar"));
  sendIpcToPreload("update-menubar");
}

function setToolbar(isVisible) {
  settings.setValue("showToolBar", isVisible);
  sendIpcToRenderer("set-toolbar-visibility", isVisible);
  menuBar.setToolBar(isVisible);
  renderPageRefresh();
}

function toggleToolBar() {
  setToolbar(!settings.getValue("showToolBar"));
  sendIpcToPreload("update-menubar");
}

function showPageNumber(isVisible) {
  settings.setValue("showPageNumber", isVisible);
  sendIpcToRenderer("set-page-number-visibility", isVisible);
  menuBar.setPageNumber(isVisible);
}

function togglePageNumber() {
  showPageNumber(!settings.getValue("showPageNumber"));
  sendIpcToPreload("update-menubar");
}

function showClock(isVisible) {
  settings.setValue("showClock", isVisible);
  sendIpcToRenderer("set-clock-visibility", isVisible);
  menuBar.setClock(isVisible);
}

function toggleClock() {
  showClock(!settings.getValue("showClock"));
  sendIpcToPreload("update-menubar");
}

function showBattery(isVisible) {
  settings.setValue("showBattery", isVisible);
  sendIpcToRenderer("set-battery-visibility", isVisible);
  menuBar.setBattery(isVisible);
}

function toggleBattery() {
  showBattery(!settings.getValue("showBattery"));
  sendIpcToPreload("update-menubar");
}

function showLoadingIndicator(isVisible) {
  settings.setValue("showLoadingIndicator", isVisible);
  sendIpcToRenderer("set-loading-indicator", isVisible);
  menuBar.setLoadingIndicator(isVisible);
}

function toggleLoadingIndicator() {
  showLoadingIndicator(!settings.getValue("showLoadingIndicator"));
  sendIpcToPreload("update-menubar");
}

function showAudioPlayer(isVisible, updateMenuBar) {
  settings.setValue("showAudioPlayer", isVisible);
  audioPlayer.open(isVisible);
  menuBar.setAudioPlayer(isVisible);
  if (updateMenuBar) sendIpcToPreload("update-menubar");
}
exports.showAudioPlayer = showAudioPlayer;

function setFullScreen(value) {
  core.getMainWindow().setFullScreen(value);
  if (value) {
    sendIpcToRenderer("set-scrollbar-visibility", false);
    sendIpcToRenderer("set-menubar-visibility", false);
    sendIpcToRenderer("set-toolbar-visibility", false);
    sendIpcToRenderer("set-fullscreen-ui", true);
  } else {
    sendIpcToRenderer(
      "set-scrollbar-visibility",
      settings.getValue("showScrollBar"),
    );
    sendIpcToRenderer("set-menubar-visibility", true);
    sendIpcToRenderer(
      "set-toolbar-visibility",
      settings.getValue("showToolBar"),
    );
    sendIpcToRenderer("set-fullscreen-ui", false);
  }
}
exports.setFullScreen = setFullScreen;

function setPageRotation(value, refreshPage) {
  if (value >= 360) value -= 360;
  else if (value < 0) value += 360;
  g_fileData.pageRotation = value;
  menuBar.setPageRotation(value);
  sendIpcToPreload("update-menubar");
  if (refreshPage) {
    renderPageRefresh();
  }
}

function setFilter(value, rebuildMenu = true) {
  settings.setValue("filterMode", value);
  menuBar.setFilterMode(value);
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("set-filter", value);
  if (rebuildMenu) rebuildMenuAndToolBars();
}

function setPagesDirection(value, rebuildMenu = true) {
  g_pagesDirection = value === 1 ? "rtl" : "ltr";
  settings.setValue("pagesDirection", value);
  menuBar.setPagesDirection(value);
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("set-pages-direction", g_pagesDirection);
  if (rebuildMenu) rebuildMenuAndToolBars();
}

let g_pageModeCanBeChanged = true;
function setInitialFixedPageModeSingle() {
  g_pageModeCanBeChanged = false;
  setPageMode(0, false);
}

function setInitialPageMode(filePath) {
  g_pageModeCanBeChanged = true;
  // ref: setInitialZoom
  if (settings.getValue("pageModeFileLoading") === 1) {
    // use history
    let historyIndex = history.getIndexInRecentByFilePath(filePath);
    if (historyIndex !== undefined) {
      let pageMode = history.getEntryInRecentByIndex(historyIndex).pageMode;
      if (pageMode !== undefined) {
        setPageMode(pageMode, false);
        return;
      }
    }
    // not in history, use default
  }
  // use default
  if (settings.getValue("pageModeDefault") === 0) {
    setPageMode(0, false);
    return;
  } else if (settings.getValue("pageModeDefault") === 1) {
    setPageMode(1, false);
    return;
  } else if (settings.getValue("pageModeDefault") === 2) {
    setPageMode(2, false);
    return;
  }
  // use last used
  setPageMode(settings.getValue("page_mode"));
}

function setPageMode(value, reloadPages) {
  settings.setValue("page_mode", value);
  menuBar.setPageMode(value);
  sendIpcToPreload("update-menubar");
  if (value !== 0) setPageRotation(0);
  sendIpcToRenderer("set-page-mode", value, g_pageModeCanBeChanged);
  if (g_pageModeCanBeChanged && reloadPages)
    goToPage(g_fileData.pageIndex, (scrollBarPos = 0));
  rebuildMenuAndToolBars();
}

//////////////////////////////////////////////////////////////////////////////
// ZOOM //////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function setFitToWidth() {
  settings.setValue("fit_mode", 0);
  menuBar.setFitToWidth();
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("set-fit-to-width");
  renderPageRefresh();
  rebuildMenuAndToolBars();
}

function setFitToHeight() {
  settings.setValue("fit_mode", 1);
  menuBar.setFitToHeight();
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("set-fit-to-height");
  renderPageRefresh();
  rebuildMenuAndToolBars();
}

// TODO: repeated in settings, unify?
let g_scaleToHeightMin = 25;
let g_scaleToHeightMax = 500;

function setScaleToHeight(scale, fromMove = false) {
  settings.setValue("fit_mode", 2);
  if (scale < g_scaleToHeightMin) scale = g_scaleToHeightMin;
  else if (scale > g_scaleToHeightMax) scale = g_scaleToHeightMax;
  if (fromMove && settings.getValue("zoom_scale") === scale) return;
  settings.setValue("zoom_scale", scale);
  menuBar.setScaleToHeight(settings.getValue("zoom_scale"));
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("set-scale-to-height", settings.getValue("zoom_scale"));
  renderPageRefresh();
  rebuildMenuAndToolBars();
}

function switchScaleMode() {
  // 0: width, 1: height, 2: scale height
  if (settings.getValue("fit_mode") === 0) {
    setFitToHeight();
  } else if (settings.getValue("fit_mode") === 1) {
    setFitToWidth();
  } else {
    setFitToWidth();
  }
}

function switchPageMode() {
  if (settings.getValue("page_mode") === 0) {
    setPageMode(1, true);
  } else if (settings.getValue("page_mode") === 1) {
    setPageMode(2, true);
  } else {
    setPageMode(0, true);
  }
}

function setInitialZoom(filePath) {
  if (settings.getValue("zoomFileLoading") === 1) {
    // use history
    let historyIndex = history.getIndexInRecentByFilePath(filePath);
    if (historyIndex !== undefined) {
      let fitMode = history.getEntryInRecentByIndex(historyIndex).fitMode;
      let zoomScale = history.getEntryInRecentByIndex(historyIndex).zoomScale;
      if (fitMode !== undefined) {
        if (fitMode === 0) {
          setFitToWidth();
          return;
        } else if (fitMode === 1) {
          setFitToHeight();
          return;
        } else if (fitMode === 2 && zoomScale != undefined) {
          setScaleToHeight(zoomScale);
          return;
        }
      }
    }
    // not in history, use default
  }
  // use default
  if (settings.getValue("zoomDefault") === 0) {
    setFitToWidth();
    return;
  } else if (settings.getValue("zoomDefault") === 1) {
    setFitToHeight();
    return;
  }
  // use last used
  if (settings.getValue("fit_mode") === 0) {
    setFitToWidth();
  } else if (settings.getValue("fit_mode") === 1) {
    setFitToHeight();
  } else {
    setScaleToHeight(settings.getValue("zoom_scale"));
  }
}

function processZoomInput(input, factor) {
  if (input !== 0 && g_fileData.state !== FileDataState.LOADED) return;
  const amount = 5 * factor;
  if (input > 0) {
    // zoom in
    if (settings.getValue("fit_mode") === 2) {
      // scale mode
      setScaleToHeight(settings.getValue("zoom_scale") + amount, true);
    } else if (settings.getValue("fit_mode") === 1) {
      // height
      setScaleToHeight(100 + amount, true);
    } else if (settings.getValue("fit_mode") === 0) {
      // width
      sendIpcToRenderer("try-zoom-scale-from-width", amount);
    }
  } else if (input < 0) {
    // zoom out
    if (settings.getValue("fit_mode") === 2) {
      setScaleToHeight(settings.getValue("zoom_scale") - amount, true);
    } else if (settings.getValue("fit_mode") === 1) {
      // height
      setScaleToHeight(100 - amount, true);
    } else if (settings.getValue("fit_mode") === 0) {
      // width
      sendIpcToRenderer("try-zoom-scale-from-width", -amount);
    }
  } else {
    // 0 = reset
    if (
      settings.getValue("fit_mode") === 2 ||
      settings.getValue("fit_mode") === 0
    ) {
      setFitToHeight();
    }
  }
}

//////////////////////////////////////////////////////////////////////////////
// WORKERS  //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_pageWorker;

function startPageWorker() {
  if (g_pageWorker === undefined) {
    g_pageWorker = utilityProcess.fork(path.join(__dirname, "worker-page.js"));
    g_pageWorker.on("message", (message) => {
      if (message.type === "testLog") {
        log.test(message.log);
        return;
      } else if (message.type === "extractResult") {
        log.debug(
          `page load time: ${timers.stop("pagesExtraction").toFixed(2)}s`,
        );
        if (message.success === true) {
          sendIpcToRenderer(
            "render-img-page",
            message.images, // buffers and mimes
            g_fileData.pageRotation,
            message.scrollBarPos,
          );
          temp.deleteSubFolder(message.tempSubFolderPath);
          return;
        } else if (message.success === false) {
          if (message?.error?.toString() === "password required") {
            log.warning("password required");
            sendIpcToRenderer(
              "show-modal-prompt-password",
              _("ui-modal-prompt-enterpassword"),
              path.basename(g_fileData.path),
              _("ui-modal-prompt-button-ok"),
              _("ui-modal-prompt-button-cancel"),
            );
            return;
          } else {
            // TODO: handle other errors
            log.error("unhandled worker error");
            log.error(message.error);
            sendIpcToRenderer("update-loading", false);
            temp.deleteSubFolder(message.tempSubFolderPath);
            return;
          }
        }
      } else if (message.type === "openResult") {
        if (message.result.success) {
          const pageIndex = message.pageIndex;
          //
          g_fileData.state = FileDataState.LOADED;
          g_fileData.type = FileDataType.PDF;
          g_fileData.path = message.filePath;
          g_fileData.name = path.basename(g_fileData.path);
          g_fileData.pagesPaths = [];
          g_fileData.numPages = message.result.numPages;
          if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
          g_fileData.pageIndex = pageIndex;
          // g_fileData.metadata = metadata;
          updateMenuAndToolbarItems();
          setPageRotation(0, false);
          setInitialZoom(g_fileData.path);
          setInitialPageMode(g_fileData.path);
          addCurrentToHistory();
          goToPage(pageIndex);
          renderPageInfo();
          renderTitle();
        } else {
          if (message.result.error === "password required") {
            if (g_fileData.state !== FileDataState.LOADING) {
              cleanUpFileData();
              g_fileData.state = FileDataState.LOADING;
              g_fileData.type = FileDataType.PDF;
              g_fileData.path = message.filePath;
              g_fileData.pageIndex = message.pageIndex;
            }
            sendIpcToRenderer(
              "show-modal-prompt-password",
              _("ui-modal-prompt-enterpassword"),
              path.basename(g_fileData.path),
              _("ui-modal-prompt-button-ok"),
              _("ui-modal-prompt-button-cancel"),
            );
          } else {
            log.error(message.result.error);
            closeCurrentFile();
            if (message.result.error === "over2gb") {
              sendIpcToRenderer(
                "show-modal-info",
                _("ui-modal-title-fileerror"),
                _("ui-modal-info-couldntopen-pdf") +
                  "\n" +
                  _("ui-modal-info-invalidsize-cap-b", "2GB"),
                _("ui-modal-prompt-button-ok"),
              );
            } else {
              sendIpcToRenderer(
                "show-modal-info",
                _("ui-modal-title-fileerror"),
                _("ui-modal-info-couldntopen-pdf"),
                _("ui-modal-prompt-button-ok"),
              );
            }
          }
        }
      }
    });
    return true;
  }
  return false;
}

function killPageWorker() {
  if (g_pageWorker !== undefined) {
    g_pageWorker.kill();
    g_pageWorker = undefined;
  }
}

function sendToPageWorker(data) {
  g_pageWorker.postMessage(data);
}

///////////////////////////////////////////////////////////////////////////////
// CLOCK //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_clockTimeout;

function initClock() {
  updateClock();
}

function updateClock() {
  const time = new Date().toLocaleString([], {
    hour: "numeric",
    minute: "numeric",
    hour12: settings.getValue("clockFormat") === 1,
  });

  sendIpcToRenderer("update-clock", time);
  g_clockTimeout = setTimeout(updateClock, 500);
}

//////////////////////////////////////////////////////////////////////////////
// MENU MSGS /////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.onMenuTurnToRightPage = function () {
  goToRightPage();
};

exports.onMenuTurnToLeftPage = function () {
  goToLeftPage();
};

exports.onMenuNextPage = function () {
  goToNextPage();
};

exports.onMenuPreviousPage = function () {
  goToPreviousPage();
};

exports.onMenuFitToWidth = function () {
  setFitToWidth();
};

exports.onMenuFitToHeight = function () {
  setFitToHeight();
};

exports.onMenuScaleToHeight = function (scale) {
  setScaleToHeight(scale);
};

exports.onMenuScaleToHeightZoomInput = function (input) {
  processZoomInput(input, 1);
};

exports.onMenuScaleToHeightEnter = function () {
  sendIpcToPreload("update-menubar");
  let question = `${_(
    "ui-modal-prompt-scalevalue",
  )} (${g_scaleToHeightMin}-${g_scaleToHeightMax}%):`;
  sendIpcToRenderer(
    "show-modal-prompt",
    question,
    "" + settings.getValue("zoom_scale"),
    _("ui-modal-prompt-button-ok"),
    _("ui-modal-prompt-button-cancel"),
    1,
  );
};

exports.onMenuRotationValue = function (value) {
  setPageRotation(value, true);
};

exports.onMenuRotateClockwise = onMenuRotateClockwise;
function onMenuRotateClockwise() {
  setPageRotation(g_fileData.pageRotation + 90, true);
}

exports.onMenuRotateCounterclockwise = onMenuRotateCounterclockwise;
function onMenuRotateCounterclockwise() {
  setPageRotation(g_fileData.pageRotation - 90, true);
}

exports.onMenuToggleScrollBar = function () {
  toggleScrollBar();
};

exports.onMenuToggleToolBar = function () {
  toggleToolBar();
};

exports.onMenuTogglePageNumber = function () {
  togglePageNumber();
};

exports.onMenuToggleClock = function () {
  toggleClock();
};

exports.onMenuToggleBattery = function () {
  toggleBattery();
};

exports.onMenuToggleLoadingIndicator = function () {
  toggleLoadingIndicator();
};

function onMenuOpenFile(startPath) {
  sendIpcToPreload("update-menubar");
  let defaultPath;
  if (startPath && fs.existsSync(startPath)) {
    defaultPath = startPath;
  } else {
    if (g_fileData.path !== "") {
      defaultPath = path.dirname(g_fileData.path);
    } else if (
      history.getRecent().length > 0 &&
      !(
        history.getEntryInRecentByIndex(history.getRecent().length - 1).data &&
        history.getEntryInRecentByIndex(history.getRecent().length - 1).data
          .source
      )
    ) {
      defaultPath = path.dirname(
        history.getEntryInRecentByIndex(history.getRecent().length - 1)
          .filePath,
      );
    }
    if (defaultPath && !fs.existsSync(defaultPath)) defaultPath = undefined;
  }

  let allowMultipleSelection = false;
  let allowedFileTypesName = _("dialog-file-types-comics-books-images");
  let allowedFileTypesList = [
    FileExtension.CBZ,
    FileExtension.CBR,
    FileExtension.CB7,
    FileExtension.PDF,
    FileExtension.EPUB,

    FileExtension.JPG,
    FileExtension.JPEG,
    FileExtension.PNG,
    FileExtension.WEBP,
    FileExtension.BMP,
    FileExtension.AVIF,
  ];
  let fileList = appUtils.chooseFiles(
    core.getMainWindow(),
    defaultPath,
    allowedFileTypesName,
    allowedFileTypesList,
    allowMultipleSelection,
  );
  if (fileList === undefined) {
    return;
  }
  let filePath = fileList[0];

  tryOpen(filePath);
}
exports.onMenuOpenFile = onMenuOpenFile;

exports.onMenuCloseFile = function () {
  closeCurrentFile();
};

exports.onMenuOpenContainingFolder = function () {
  if (g_fileData.path) {
    appUtils.openPathInFileBrowser(path.dirname(g_fileData.path));
  }
};

// exports.onMenuPageExport = function () {
//   exportPageStart(0);
// };

// exports.onMenuPageExtractText = function () {
//   exportPageStart(1);
// };

// exports.onMenuPageExtractPalette = function () {
//   exportPageStart(2);
// };

// exports.onMenuPageExtractQR = function () {
//   exportPageStart(3);
// };

exports.onMenuConvertFile = function () {
  if (g_fileData.path !== undefined) {
    tools.switchTool("tool-convert-comics", {
      mode: 0,
      inputFilePaths: [g_fileData.path],
      inputPassword: g_fileData.password,
    });
  }
  sendIpcToPreload("update-menubar");
};

exports.onMenuExtractFile = function () {
  if (g_fileData.path !== undefined) {
    tools.switchTool("tool-extract-comics", g_fileData);
  }
  sendIpcToPreload("update-menubar");
};

exports.onGoToPageDialog = function () {
  sendIpcToPreload("update-menubar");
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    let question = `${_("ui-modal-prompt-pagepercentage")} (0-100):`;
    sendIpcToRenderer(
      "show-modal-prompt",
      question,
      "" + g_fileData.pageIndex,
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel"),
      2,
    );
  } else {
    let question = `${_("ui-modal-prompt-pagenumber")} (1-${
      g_fileData.numPages
    }):`;
    sendIpcToRenderer(
      "show-modal-prompt",
      question,
      "" + (g_fileData.pageIndex + 1),
      _("ui-modal-prompt-button-ok"),
      _("ui-modal-prompt-button-cancel"),
    );
  }
};

exports.onGoToPageFirst = function () {
  sendIpcToPreload("update-menubar");
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPercentage(0);
  } else {
    goToPage(0);
  }
};

exports.onGoToPageLast = function () {
  sendIpcToPreload("update-menubar");
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPercentage(100);
  } else {
    goToPage(g_fileData.numPages - 1);
  }
};

exports.onMenuFilterValue = function (value) {
  setFilter(value);
};

exports.onMenuPagesDirection = function (value) {
  setPagesDirection(value);
};

exports.onMenuPageMode = function (value) {
  setPageMode(value, true);
};

async function onMenuFileProperties() {
  // get metadata //////////////
  if (g_fileData.path && g_fileData.path !== "") {
    if (
      g_fileData.type === FileDataType.EPUB_COMIC ||
      g_fileData.type === FileDataType.EPUB_EBOOK
    ) {
      const epubMetadata = require("../shared/main/epub-metadata");
      g_fileData.metadata = await epubMetadata.getMetadataProperties(
        g_fileData.path,
        g_fileData.metadata,
        g_fileData.password,
      );
    } else if (g_fileData.type === FileDataType.PDF) {
      const { PDFDocument } = require("pdf-lib");
      const pdf = await PDFDocument.load(fs.readFileSync(g_fileData.path), {
        updateMetadata: false,
      });
      if (!g_fileData.metadata) g_fileData.metadata = {};
      g_fileData.metadata.title = pdf.getTitle();
      g_fileData.metadata.author = pdf.getAuthor();
      g_fileData.metadata.subject = pdf.getSubject();
      g_fileData.metadata.keywords = pdf.getKeywords();
      g_fileData.metadata.creator = pdf.getCreator();
      g_fileData.metadata.producer = pdf.getProducer();
      g_fileData.metadata.created = pdf.getCreationDate();
      g_fileData.metadata.modified = pdf.getModificationDate();
    }
    // create table
    let html = "";
    html += `<table>`;
    function addRow(left, right) {
      html += `<tr><td>${left}</td><td>${right}</td></tr>`;
    }
    // title
    if (g_fileData.metadata && g_fileData.metadata.title) {
      addRow(_("ui-modal-info-metadata-title"), g_fileData.metadata.title);
    }
    // author
    if (g_fileData.metadata && g_fileData.metadata.author) {
      addRow(_("ui-modal-info-metadata-author"), g_fileData.metadata.author);
    }
    // publisher
    if (g_fileData.metadata && g_fileData.metadata.publisher) {
      addRow(
        _("ui-modal-info-metadata-publisher"),
        g_fileData.metadata.publisher,
      );
    }
    // pages
    if (g_fileData.type != FileDataType.EPUB_EBOOK) {
      addRow(_("ui-modal-info-metadata-numpages"), g_fileData.numPages);
    }
    // dimensions
    if (g_fileData.pageDimensions) {
      addRow(
        _("ui-modal-info-metadata-pagedimensions"),
        `${g_fileData.pageDimensions[0]} x ${g_fileData.pageDimensions[1]} ${
          g_fileData.type === FileDataType.PDF ? "pt" : "px"
        }`,
      );
    }
    // description
    if (g_fileData.metadata && g_fileData.metadata.description) {
      addRow(_("tool-metadata-data-summary"), g_fileData.metadata.description);
    }
    // subject
    if (g_fileData.metadata && g_fileData.metadata.subject) {
      if (g_fileData.type === FileDataType.PDF) {
        addRow(_("tool-metadata-data-summary"), g_fileData.metadata.subject);
      } else {
        addRow(
          _("ui-modal-info-metadata-subject"),
          g_fileData.metadata.subject,
        );
      }
    }
    // language
    if (g_fileData.metadata && g_fileData.metadata.language) {
      addRow(
        _("ui-modal-info-metadata-language"),
        g_fileData.metadata.language,
      );
    }
    // keywords
    if (g_fileData.metadata && g_fileData.metadata.keywords) {
      addRow(
        _("ui-modal-info-metadata-keywords"),
        g_fileData.metadata.keywords,
      );
    }
    // publication date
    if (g_fileData.metadata && g_fileData.metadata.publicationDate) {
      addRow(
        _("ui-modal-info-metadata-publicationdate"),
        g_fileData.metadata.publicationDate,
      );
    }
    /////////////
    // path
    addRow(_("ui-modal-info-metadata-filepath"), g_fileData.path);
    // size
    let stats = fs.statSync(g_fileData.path);
    addRow(
      _("ui-modal-info-metadata-filesize"),
      `${(stats.size / (1024 * 1024)).toFixed(2)} MiB`,
    );
    // MIME
    let fileMimeType = fileUtils.getFileTypeFromPath(g_fileData.path, true);
    if (fileMimeType !== undefined) {
      // e.g. {ext: 'png', mime: 'image/png'}
      addRow(_("ui-modal-info-metadata-mimetype"), fileMimeType);
    }
    // format
    if (g_fileData.metadata && g_fileData.metadata.format) {
      addRow(_("ui-modal-info-metadata-format"), g_fileData.metadata.format);
    }
    // created
    if (
      g_fileData.type === FileDataType.PDF &&
      g_fileData.metadata &&
      g_fileData.metadata.created
    ) {
      let date = g_fileData.metadata.created;
      if (typeof date === "string") {
        date = utils.parsePdfDate(date);
      }
      date = date.toLocaleString();
      // date = Intl.DateTimeFormat([], {
      //   dayTime: "short",
      // }).format(date);
      addRow(_("ui-modal-info-metadata-created"), date);
    } else if (process.platform === "win32") {
      let date = stats.birthtime;
      date = date.toLocaleString();
      addRow(_("ui-modal-info-metadata-created"), date);
    }
    // modified
    if (g_fileData.metadata && g_fileData.metadata.modified) {
      let date = g_fileData.metadata.modified;
      if (typeof date === "string") {
        date = utils.parsePdfDate(date);
      }
      if (stats.mtime.getTime() > date.getTime()) {
        date = stats.mtime;
      }
      date = date.toLocaleString();
      addRow(_("ui-modal-info-metadata-modified"), date);
    } else {
      let date = stats.mtime.toLocaleString();
      addRow(_("ui-modal-info-metadata-modified"), date);
    }
    // creator
    if (g_fileData.metadata && g_fileData.metadata.creator) {
      addRow(_("ui-modal-info-metadata-creator"), g_fileData.metadata.creator);
    }
    // producer
    if (g_fileData.metadata && g_fileData.metadata.producer) {
      addRow(
        _("ui-modal-info-metadata-producer"),
        g_fileData.metadata.producer,
      );
    }
    // comicinfo.xml
    if (
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.SEVENZIP
    ) {
      if (g_fileData.metadata && g_fileData.metadata.comicInfoId) {
        addRow(
          "ComicInfo.xml",
          _("ui-modal-info-metadata-comicinfoxml-included"),
        );
      } else {
        addRow(
          "ComicInfo.xml",
          _("ui-modal-info-metadata-comicinfoxml-notincluded"),
        );
      }
    }
    // security
    if (g_fileData.metadata && g_fileData.metadata.encrypted) {
      addRow(
        _("ui-modal-info-metadata-security"),
        _("ui-modal-info-metadata-security-encrypted"),
      );
    } else {
      addRow(
        _("ui-modal-info-metadata-security"),
        _("ui-modal-info-metadata-security-unencrypted"),
      );
    }
    ///////////////////
    html += `</table>`;
    // send //////////////////////
    const canHaveComicInfo =
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.SEVENZIP;
    const isRar = g_fileData.type === FileDataType.RAR;
    const canEditRar = settings.canEditRars();
    const isEncrypted = g_fileData.metadata && g_fileData.metadata.encrypted;
    const hasComicInfo = g_fileData.metadata && g_fileData.metadata.comicInfoId;
    let buttonText;
    if (canHaveComicInfo) {
      if (hasComicInfo) {
        buttonText = _("ui-modal-prompt-button-open-xml");
      } else if ((canEditRar || !isRar) && !isEncrypted) {
        buttonText = _("ui-modal-prompt-button-create-xml");
      }
    } else if (
      g_fileData.type === FileDataType.PDF ||
      g_fileData.type === FileDataType.EPUB_COMIC ||
      g_fileData.type === FileDataType.EPUB_EBOOK
    ) {
      buttonText = _("ui-modal-prompt-button-edit-metadata");
    }

    sendIpcToRenderer(
      "show-modal-properties",
      _("ui-modal-info-metadata-fileproperties"),
      html,
      _("tool-shared-ui-close"),
      buttonText,
    );
  }
}
exports.onMenuFileProperties = onMenuFileProperties;
