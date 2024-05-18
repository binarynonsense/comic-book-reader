/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app } = require("electron");

const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const FileType = require("file-type");

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
const tools = require("../shared/main/tools");
const {
  FileExtension,
  FileDataState,
  FileDataType,
  BookType,
} = require("../shared/main/constants");

let g_resizeEventCounter;

//////////////////////////////////////////////////////////////////////////////// SETUP  ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_workerExport;
let g_workerPage;

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

  updateLoadingIndicator();
  updateLayoutClock();
  updateLayoutPageNum();
  updateLayoutAudioPlayer();
  updateLayoutBattery();

  sendIpcToRenderer("add-event-listeners");
  sendIpcToRenderer(
    "set-hide-inactive-mouse-cursor",
    settings.getValue("cursorVisibility") === 1
  );
  sendIpcToRenderer("set-nav-keys", settings.getValue("navKeys"));
  sendIpcToRenderer(
    "set-page-turn-on-scroll-boundary",
    settings.getValue("turnPageOnScrollBoundary")
  );

  showScrollBar(settings.getValue("showScrollBar"));
  showToolBar(settings.getValue("showToolBar"));
  showPageNumber(settings.getValue("showPageNumber"));
  initClock();
  showClock(settings.getValue("showClock"));
  sendIpcToRenderer("init-battery");
  showBattery(settings.getValue("showBattery"));
  audioPlayer.init(core.getMainWindow(), "audio-player-container");
  showAudioPlayer(settings.getValue("showAudioPlayer"));

  // if the program is called from the os' 'open with' of file association
  if (filePath && filePath !== "" && fs.existsSync(filePath)) {
    if (tryOpen(filePath)) {
      return;
    }
  }

  if (
    checkHistory &&
    history.get().length > 0 &&
    settings.getValue("on_quit_state") === 1
  ) {
    const entry = history.getIndex(history.get().length - 1);
    if (tryOpen(entry.filePath, undefined, entry)) {
      return;
    }
  }

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
  renderTitle();
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
  if (g_workerExport !== undefined) {
    g_workerExport.kill();
    g_workerExport = undefined;
  }
  if (g_workerPage !== undefined) {
    g_workerPage.kill();
    g_workerPage = undefined;
  }
};

exports.onMaximize = function () {
  renderPageRefresh();
};

//////////////////////////////////////////////////////////////////////////////// HISTORY ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function addCurrentToHistory(updateMenu = true) {
  if (
    g_fileData.type === FileDataType.NOT_SET ||
    g_fileData.state !== FileDataState.LOADED
  )
    return;
  if (g_fileData.path !== "") {
    history.add(g_fileData.path, g_fileData.pageIndex, g_fileData.data);
  }
  if (updateMenu) rebuildMenuAndToolBars();
}

//////////////////////////////////////////////////////////////////////////////// IPC SEND //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function sendIpcToRenderer(...args) {
  core.sendIpcToRenderer("reader", ...args);
}
exports.sendIpcToRenderer = sendIpcToRenderer;

function sendIpcToCoreRenderer(...args) {
  core.sendIpcToRenderer("core", ...args);
}

function sendIpcToAudioPlayerRenderer(...args) {
  core.sendIpcToRenderer("audio-player", ...args);
}

function sendIpcToPreload(...args) {
  core.sendIpcToPreload(...args);
}

//////////////////////////////////////////////////////////////////////////////// IPC RECEIVE ///////////////////////////////////////////////////////////////
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
        `${g_fileData.data.name} #${g_fileData.pageIndex + 1}`
      );
      if (g_fileData.data?.tempData?.title)
        sendIpcToRenderer(
          "update-img-page-title",
          g_fileData.data.tempData.title
        );
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
      _("ui-modal-prompt-button-ok")
    );
  });

  ////////////////////////////////////////////////////////////////////////////

  on("pdf-loaded", (filePath, pageIndex, numPages, metadata) => {
    g_fileData.state = FileDataState.LOADED; // will change inmediately to loading
    // TODO double check loaded is the one loading?
    // TODO change only if correct
    g_fileData.type = FileDataType.PDF;
    g_fileData.path = filePath;
    g_fileData.name = path.basename(filePath);
    g_fileData.pagesPaths = [];
    g_fileData.numPages = numPages;
    if (pageIndex < 0 || pageIndex >= g_fileData.numPages) pageIndex = 0;
    g_fileData.pageIndex = pageIndex;
    g_fileData.metadata = metadata;
    updateMenuAndToolbarItems();
    setPageRotation(0, false);
    setInitialZoom(filePath);
    g_fileData.numPages = numPages;
    addCurrentToHistory();
    goToPage(pageIndex);
    renderPageInfo();
    renderTitle();
  });

  on("pdf-load-failed", (error) => {
    if (
      error !== undefined &&
      error.name !== undefined &&
      error.name === "PasswordException"
    ) {
      if (error.code === 1) {
        // { message: 'No password given', name: 'PasswordException', code: 1 }
        sendIpcToRenderer(
          "show-modal-prompt-password",
          _("ui-modal-prompt-enterpassword"),
          path.basename(g_fileData.path),
          _("ui-modal-prompt-button-ok"),
          _("ui-modal-prompt-button-cancel")
        );
      } else if (error.code === 2) {
        // { message: 'Incorrect Password', name: 'PasswordException', code: 2 }
        sendIpcToRenderer(
          "show-modal-prompt-password",
          _("ui-modal-prompt-enterpassword"),
          path.basename(g_fileData.path),
          _("ui-modal-prompt-button-ok"),
          _("ui-modal-prompt-button-cancel")
        );
      }
    } else {
      // unrecoverable error
      log.error(error);
      closeCurrentFile();
      sendIpcToRenderer(
        "show-modal-info",
        _("ui-modal-title-fileerror"),
        _("ui-modal-info-couldntopen-pdf"),
        _("ui-modal-prompt-button-ok")
      );
    }
  });

  on(
    "pdf-page-dataurl-extracted",
    (error, dataUrl, dpi, outputFolderPath, sendToTool) => {
      if (error !== undefined) {
        exportPageError(error);
      } else {
        exportPageSaveDataUrl(dataUrl, dpi, outputFolderPath, sendToTool);
      }
    }
  );

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
      goToPage(0);
    }
  });

  on("end-pressed", () => {
    if (g_fileData.type === FileDataType.EPUB_EBOOK) {
      goToPercentage(100);
    } else {
      goToPage(g_fileData.numPages - 1);
    }
  });

  on("mouse-click", (mouseX, bodyX) => {
    if (settings.getValue("hotspots_mode") === 1) {
      if (mouseX > bodyX / 2) {
        goToNextPage();
      } else {
        goToPreviousPage();
      }
    } else if (settings.getValue("hotspots_mode") === 2) {
      const columnWidth = bodyX / 3;
      if (mouseX < columnWidth) {
        goToPreviousPage();
      } else if (mouseX > 2 * columnWidth) {
        goToNextPage();
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

  ////////////////////////////////////////////////////////////////////////////

  on("toolbar-button-clicked", (name) => {
    switch (name) {
      case "toolbar-button-next":
        goToNextPage();
        break;
      case "toolbar-button-prev":
        goToPreviousPage();
        break;
      case "toolbar-button-fit-to-width":
        setFitToWidth();
        break;
      case "toolbar-button-fit-to-height":
        setFitToHeight();
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
    contextMenu
      .getContextMenu(g_fileData)
      .popup(core.getMainWindow(), params.x, params.y);
  });

  on("rebuild-menu-and-toolbar", (isOpen) => {
    rebuildMenuAndToolBars(isOpen);
  });

  ////////////////////////////////////////////////////////////////////////////

  on("open-comicinfo-xml-tool", () => {
    if (g_fileData.path !== undefined) {
      tools.switchTool("tool-comicinfoxml", g_fileData);
    }
  });

  on("open-file-browser-tool", (showFocus) => {
    tools.switchTool("tool-file-browser", g_fileData, showFocus);
  });

  on("open-history-tool", (showFocus) => {
    tools.switchTool("tool-history", showFocus);
  });

  on("open-quick-menu", () => {
    sendIpcToRenderer(
      "show-modal-quick-menu",
      _("ui-modal-title-quickmenu"),
      _("tool-shared-ui-back-to-reader"),
      _("tool-fb-title"), //_("ctxmenu-openfile").replace("...", ""),
      _("menu-file-openrecent-history"),
      _("menu-view-togglefullscreen"),
      _("menu-file-quit")
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

  on("quit", () => {
    core.onMenuQuit();
  });
}

//////////////////////////////////////////////////////////////////////////////// FILES /////////////////////////////////////////////////////////////////////
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

function cleanUpFileData() {
  g_fileData.state = FileDataState.NOT_SET;
  g_fileData.type = FileDataType.NOT_SET;
  g_fileData.path = "";
  g_fileData.name = "";
  g_fileData.pagesPaths = [];
  g_fileData.numPages = 0;
  g_fileData.pageIndex = 0;
  g_fileData.pageRotation = 0;
  (g_fileData.pageDimensions = undefined), (g_fileData.password = "");
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
    filePath
  );
};

function tryOpen(filePath, bookType, historyEntry) {
  sendIpcToPreload("update-menubar"); // in case coming from menu

  closeCurrentFile();

  if (!bookType) bookType = BookType.NOT_SET;
  let pageIndex;

  if (!historyEntry) {
    let historyIndex = history.getFilePathIndex(filePath);
    if (historyIndex !== undefined) {
      historyEntry = history.getIndex(historyIndex);
    }
  }

  if (historyEntry) {
    pageIndex = historyEntry.pageIndex;
    if (historyEntry.data && historyEntry.data.source) {
      if (
        historyEntry.data.source === "dcm" ||
        historyEntry.data.source === "iab" ||
        historyEntry.data.source === "xkcd"
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
      filePath
    );
    return true;
  }

  if (filePath === undefined || filePath === "" || !fs.existsSync(filePath)) {
    sendIpcToRenderer(
      "show-modal-info",
      _("ui-modal-title-filenotfound"),
      filePath,
      _("ui-modal-prompt-button-ok")
    );
    return false;
  }
  return tryOpenPath(filePath, pageIndex, bookType, historyEntry);
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
        _("ui-modal-prompt-button-ok")
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
        _("ui-modal-prompt-button-ok")
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
      _("ui-modal-prompt-button-ok")
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
      _("ui-modal-prompt-button-ok")
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
      let historyIndex = history.getFilePathIndex(folderPath);
      if (historyIndex !== undefined) {
        pageIndex = history.getIndex(historyIndex).pageIndex;
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
    let fileType = await FileType.fromFile(filePath);
    if (fileType !== undefined) {
      // ref: file-type -> https://www.npmjs.com/package/file-type
      // e.g. {ext: 'png', mime: 'image/png'}
      fileExtension = "." + fileType.ext;
    }

    if (fileExtension === "." + FileExtension.PDF) {
      if (g_fileData.state !== FileDataState.LOADING) {
        cleanUpFileData();
        g_fileData.type = FileDataType.PDF;
        g_fileData.state = FileDataState.LOADING;
        g_fileData.pageIndex = pageIndex;
        g_fileData.path = filePath;
      }
      g_fileData.password = password;
      sendIpcToRenderer("load-pdf", filePath, pageIndex, password);
    } else if (fileExtension === "." + FileExtension.EPUB) {
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
        addCurrentToHistory();
        goToPage(pageIndex);
      } else {
        sendIpcToRenderer(
          "show-modal-info",
          _("ui-modal-title-fileerror"),
          _("ui-modal-info-couldntopen-epub"),
          _("ui-modal-prompt-button-ok")
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
          tempSubFolderPath
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
            _("ui-modal-prompt-button-cancel")
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
              _("ui-modal-prompt-button-ok")
            );
          } else {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-rar"),
              _("ui-modal-prompt-button-ok")
            );
          }
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
          return;
        }
        let pagesPaths = rarData.paths;
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
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-rar"),
            _("ui-modal-prompt-button-ok")
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
          "zip"
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
            _("ui-modal-prompt-button-cancel")
          );
          return;
        } else if (zipData.result === "other error") {
          if (zipData.extra == "aes") {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-zip-aes"),
              _("ui-modal-prompt-button-ok")
            );
          } else if (zipData.extra === "over2gb") {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-zip") +
                "\n" +
                _("ui-modal-info-invalidsize-cap-b", "2GB"),
              _("ui-modal-prompt-button-ok")
            );
          } else {
            sendIpcToRenderer(
              "show-modal-info",
              _("ui-modal-title-fileerror"),
              _("ui-modal-info-couldntopen-zip"),
              _("ui-modal-prompt-button-ok")
            );
          }
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
          return;
        }
        let pagesPaths = zipData.paths;
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
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-zip"),
            _("ui-modal-prompt-button-ok")
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
          password
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
            _("ui-modal-prompt-button-cancel")
          );
          return;
        } else if (sevenData.result === "other error") {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-7z"),
            _("ui-modal-prompt-button-ok")
          );
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
          return;
        }
        let pagesPaths = sevenData.paths;
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
          addCurrentToHistory();
          goToPage(pageIndex);
        } else {
          sendIpcToRenderer(
            "show-modal-info",
            _("ui-modal-title-fileerror"),
            _("ui-modal-info-couldntopen-7z"),
            _("ui-modal-prompt-button-ok")
          );
          sendIpcToRenderer("update-bg", true);
          sendIpcToRenderer("update-loading", false);
        }
      } else {
        sendIpcToRenderer(
          "show-modal-info",
          _("ui-modal-title-fileerror"),
          _("ui-modal-info-invalidformat"),
          _("ui-modal-prompt-button-ok")
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

    sendIpcToRenderer("load-epub-ebook", filePath, pageIndex, cachedPath);
    return true;
  } else {
    sendIpcToRenderer("update-loading", false);
    sendIpcToRenderer("update-bg", true);
    sendIpcToRenderer(
      "show-modal-info",
      _("ui-modal-info-invalidformat"),
      filePath,
      _("ui-modal-prompt-button-ok")
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
  g_fileData.path = comicData.name;
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
  if (g_fileData.type === FileDataType.NOT_SET) return;
  if (addToHistory) addCurrentToHistory(); // add the one I'm closing to history
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    sendIpcToRenderer("close-epub-ebook");
  }
  cleanUpFileData();
  updateMenuAndToolbarItems();
  renderTitle();
  sendIpcToRenderer("file-closed");
  sendIpcToPreload("update-menubar");
  sendIpcToRenderer("update-loading", false);
  sendIpcToRenderer("close-modal");
}

///////////////////////////////////////////////////////////////////////////////// PAGE NAVIGATION //////////////////////////////////////////////////////////
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

  if (
    g_fileData.type === FileDataType.ZIP ||
    g_fileData.type === FileDataType.RAR ||
    g_fileData.type === FileDataType.SEVENZIP ||
    g_fileData.type === FileDataType.EPUB_COMIC ||
    g_fileData.type === FileDataType.IMGS_FOLDER
  ) {
    g_fileData.state = FileDataState.LOADING;
    if (g_workerPage !== undefined) {
      // kill it after one use
      g_workerPage.kill();
      g_workerPage = undefined;
    }
    const timers = require("../shared/main/timers");
    timers.start("workerPage");

    let tempSubFolderPath =
      g_fileData.type === FileDataType.SEVENZIP ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR
        ? temp.createSubFolder()
        : undefined;

    if (g_workerPage === undefined) {
      g_workerPage = fork(path.join(__dirname, "worker-page.js"));
      g_workerPage.on("message", (message) => {
        log.debug(`page load time: ${timers.stop("workerPage")}s`);
        g_workerPage.kill(); // kill it after one use
        if (message[0] === true) {
          sendIpcToRenderer(
            "render-img-page",
            message[1], //img64,
            g_fileData.pageRotation,
            message[2]
          );
          temp.deleteSubFolder(tempSubFolderPath);
          return;
        } else {
          // TODO: handle error
          log.error("worker error");
          log.error(message[1]);
          sendIpcToRenderer("update-loading", false);
          temp.deleteSubFolder(tempSubFolderPath);
          return;
        }
      });
    }
    g_workerPage.send([
      core.getLaunchInfo(),
      g_fileData.type,
      g_fileData.path,
      g_fileData.pagesPaths[g_fileData.pageIndex],
      scrollBarPos,
      g_fileData.password,
      tempSubFolderPath,
    ]);
  } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    if (pageIndex > 0) {
      g_fileData.state = FileDataState.LOADING;
      sendIpcToRenderer("render-epub-ebook-page-next");
    } else if (pageIndex < 0) {
      g_fileData.state = FileDataState.LOADING;
      sendIpcToRenderer("render-epub-ebook-page-prev");
    }
  } else if (g_fileData.type === FileDataType.PDF) {
    g_fileData.state = FileDataState.LOADING;
    sendIpcToRenderer(
      "render-pdf-page",
      g_fileData.pageIndex,
      g_fileData.pageRotation,
      scrollBarPos
    );
  } else if (g_fileData.type === FileDataType.WWW) {
    (async () => {
      const calledFunc = g_fileData.getPageCallback;
      let response = await g_fileData.getPageCallback(
        g_fileData.pageIndex + 1,
        g_fileData
      );
      if (calledFunc !== g_fileData.getPageCallback) {
        // getPageCallback changed while downloading
        return;
      }
      if (!response || !response.pageImgSrc) {
        // TODO: handle error
        log.error("download error");
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
        response.pageImgSrc,
        g_fileData.pageRotation,
        scrollBarPos
      );
    })(); // async
  }
}

function goToNextPage() {
  if (g_fileData.type === FileDataType.EPUB_EBOOK) {
    goToPage(1);
  } else {
    if (g_fileData.pageIndex + 1 < g_fileData.numPages) {
      goToPage(g_fileData.pageIndex + 1);
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
      goToPage(g_fileData.pageIndex - 1, 1);
    } else if (settings.getValue("autoOpen") === 2) {
      tryOpeningAdjacentFile(false);
    }
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

//////////////////////////////////////////////////////////////////////////////// RENDER ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function renderTitle() {
  let title = generateTitle();
  core.getMainWindow().setTitle(title);
  core.sendIpcToPreload("update-title", title);
}

function generateTitle() {
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
}

function renderPageInfo() {
  let isPercentage = g_fileData.type === FileDataType.EPUB_EBOOK;
  sendIpcToRenderer(
    "render-page-info",
    g_fileData.pageIndex,
    g_fileData.numPages,
    isPercentage
  );
}

function renderPageRefresh() {
  if (g_fileData.state === FileDataState.LOADED) {
    if (g_fileData.type === FileDataType.PDF) {
      sendIpcToRenderer("refresh-pdf-page", g_fileData.pageRotation);
    } else if (
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.SEVENZIP ||
      g_fileData.type === FileDataType.IMGS_FOLDER ||
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
        sendIpcToRenderer("update-toolbar-rotation-buttons", true);
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
      } else if (g_fileData.type === FileDataType.EPUB_EBOOK) {
        menuBar.setEpubEbookOpened();
        sendIpcToRenderer("update-toolbar-rotation-buttons", false);
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
      } else if (g_fileData.type === FileDataType.IMGS_FOLDER) {
        menuBar.setImageOpened();
        sendIpcToRenderer("update-toolbar-rotation-buttons", true);
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
      } else if (g_fileData.type === FileDataType.WWW) {
        menuBar.setWWWOpened();
        sendIpcToRenderer("update-toolbar-rotation-buttons", true);
        sendIpcToRenderer("update-toolbar-page-buttons", true);
        sendIpcToRenderer("update-toolbar-zoom-buttons", true);
      } else {
        menuBar.setComicBookOpened(false);
        menuBar.setCanOpenBooks(true);
        menuBar.setCanOpenTools(true);
        sendIpcToRenderer("update-toolbar-rotation-buttons", false);
        sendIpcToRenderer("update-toolbar-page-buttons", false);
        sendIpcToRenderer("update-toolbar-zoom-buttons", false);
      }
    } else {
      menuBar.setComicBookOpened(false);
      menuBar.setCanOpenBooks(true);
      menuBar.setCanOpenTools(true);
      menuBar.setCanTweakUI(true);
    }
  } else {
    menuBar.setComicBookOpened(false);
  }
}

function updateLocalizedText() {
  sendIpcToRenderer(
    "update-toolbar-tooltips",
    _("ctxmenu-openfile"),
    _("ctxmenu-prevpage"),
    _("ctxmenu-nextpage"),
    _("menu-view-zoom-fitwidth"),
    _("menu-view-zoom-fitheight"),
    _("toolbar-rotate-counterclockwise"),
    _("toolbar-rotate-clockwise"),
    _("menu-view-togglefullscreen")
  );
  sendIpcToRenderer("update-bg-text", _("ui-bg-msg"));
}
exports.updateLocalizedText = updateLocalizedText;

function updateLoadingIndicator() {
  sendIpcToRenderer(
    "update-loading-indicator",
    settings.getValue("loadingIndicatorBG"),
    settings.getValue("loadingIndicatorIconSize"),
    settings.getValue("loadingIndicatorIconPos")
  );
}
exports.updateLoadingIndicator = updateLoadingIndicator;

function updateLayoutClock() {
  sendIpcToRenderer(
    "update-layout-pos",
    settings.getValue("layoutClock"),
    "#clock-bubble"
  );
}
exports.updateLayoutClock = updateLayoutClock;

function updateLayoutPageNum() {
  sendIpcToRenderer(
    "update-layout-pos",
    settings.getValue("layoutPageNum"),
    "#page-number-bubble"
  );
}
exports.updateLayoutPageNum = updateLayoutPageNum;

function updateLayoutAudioPlayer() {
  sendIpcToAudioPlayerRenderer(
    "update-layout-pos",
    settings.getValue("layoutAudioPlayer")
  );
}
exports.updateLayoutAudioPlayer = updateLayoutAudioPlayer;

function updateLayoutBattery() {
  sendIpcToRenderer(
    "update-layout-pos",
    settings.getValue("layoutBattery"),
    "#battery-bubble"
  );
}
exports.updateLayoutBattery = updateLayoutBattery;

//////////////////////////////////////////////////////////////////////////////// SHOW/HIDE /////////////////////////////////////////////////////////////////
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

function showToolBar(isVisible) {
  settings.setValue("showToolBar", isVisible);
  sendIpcToRenderer("set-toolbar-visibility", isVisible);
  menuBar.setToolBar(isVisible);
  renderPageRefresh();
}

function toggleToolBar() {
  showToolBar(!settings.getValue("showToolBar"));
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
      settings.getValue("showScrollBar")
    );
    sendIpcToRenderer("set-menubar-visibility", true);
    sendIpcToRenderer(
      "set-toolbar-visibility",
      settings.getValue("showToolBar")
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

//////////////////////////////////////////////////////////////////////////////// ZOOM //////////////////////////////////////////////////////////////////////
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

function setInitialZoom(filePath) {
  if (settings.getValue("zoomFileLoading") === 1) {
    // use history
    let historyIndex = history.getFilePathIndex(filePath);
    if (historyIndex !== undefined) {
      let fitMode = history.getIndex(historyIndex).fitMode;
      let zoomScale = history.getIndex(historyIndex).zoomScale;
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
  const amount = 5 * factor;
  if (input !== 0 && g_fileData.state !== FileDataState.LOADED) return;
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
      //setScaleToHeight(100);
      setFitToHeight();
    }
  }
}

///////////////////////////////////////////////////////////////////////////////// CLOCK //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_clockTimeout;

function initClock() {
  let today = new Date();
  let h = today.getHours();
  let m = today.getMinutes();
  if (m < 10) {
    m = "0" + m;
  }
  let s = today.getSeconds();
  if (s < 10) {
    s = "0" + s;
  }
  let time = h + ":" + m; // + ":" + s;
  sendIpcToRenderer("update-clock", time);
  g_clockTimeout = setTimeout(initClock, 500);
}

//////////////////////////////////////////////////////////////////////////////
// EXPORT ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

async function exportPageStart(sendToTool = 0) {
  let outputFolderPath;
  if (sendToTool !== 0) {
    outputFolderPath = temp.createSubFolder();
  } else {
    let defaultPath = app.getPath("desktop");
    let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
    if (folderList === undefined) {
      return;
    }
    outputFolderPath = folderList[0];
  }

  if (
    g_fileData.path === "" ||
    outputFolderPath === undefined ||
    outputFolderPath === ""
  ) {
    return;
  }

  sendIpcToRenderer("update-loading", true);
  try {
    if (g_fileData.type === FileDataType.PDF) {
      sendIpcToRenderer(
        "extract-pdf-image-buffer",
        g_fileData.path,
        g_fileData.pageIndex + 1,
        outputFolderPath,
        g_fileData.password,
        sendToTool
      );
      return;
    } else {
      if (g_workerExport !== undefined) {
        // kill it after one use
        g_workerExport.kill();
        g_workerExport = undefined;
      }

      let tempSubFolderPath =
        g_fileData.type === FileDataType.SEVENZIP ||
        g_fileData.type === FileDataType.ZIP ||
        g_fileData.type === FileDataType.RAR
          ? temp.createSubFolder()
          : undefined;

      if (g_workerExport === undefined) {
        g_workerExport = fork(path.join(__dirname, "worker-export.js"));
        g_workerExport.on("message", (message) => {
          g_workerExport.kill(); // kill it after one use
          if (message[0]) {
            sendIpcToRenderer("update-loading", false);
            if (message[2] === 1) {
              tools.switchTool("tool-extract-text", message[1]);
              sendIpcToPreload("update-menubar");
            } else if (message[2] === 2) {
              tools.switchTool("tool-extract-palette", message[1]);
              sendIpcToPreload("update-menubar");
            } else if (message[2] === 3) {
              tools.switchTool("tool-extract-qr", message[1]);
              sendIpcToPreload("update-menubar");
            } else {
              sendIpcToRenderer(
                "show-modal-info",
                "",
                _("ui-modal-info-imagesavedto") +
                  "\n" +
                  utils.reduceStringFrontEllipsis(message[1], 85),
                _("ui-modal-prompt-button-ok")
              );
            }
            temp.deleteSubFolder(tempSubFolderPath);
            return;
          } else {
            exportPageError(message[1]);
            temp.deleteSubFolder(tempSubFolderPath);
            return;
          }
        });
      }
      g_workerExport.send({
        launchInfo: core.getLaunchInfo(),
        data: g_fileData,
        outputFolderPath: outputFolderPath,
        sendToTool: sendToTool,
        tempSubFolderPath: tempSubFolderPath,
      });
    }
  } catch (err) {
    exportPageError(err);
  }
}

function exportPageSaveDataUrl(dataUrl, dpi, outputFolderPath, sendToTool) {
  if (dataUrl !== undefined) {
    (async () => {
      try {
        const { changeDpiDataUrl } = require("changedpi");
        let img = changeDpiDataUrl(dataUrl, dpi);
        let data = img.replace(/^data:image\/\w+;base64,/, "");
        let buf = Buffer.from(data, "base64");
        let fileType = await FileType.fromBuffer(buf);
        let fileExtension = "." + FileExtension.JPG;
        if (fileType !== undefined) {
          fileExtension = "." + fileType.ext;
        }
        let fileName =
          path.basename(g_fileData.name, path.extname(g_fileData.name)) +
          "_page_" +
          (g_fileData.pageIndex + 1);

        let outputFilePath = path.join(
          outputFolderPath,
          fileName + fileExtension
        );
        let i = 1;
        while (fs.existsSync(outputFilePath)) {
          i++;
          outputFilePath = path.join(
            outputFolderPath,
            fileName + "(" + i + ")" + fileExtension
          );
        }
        fs.writeFileSync(outputFilePath, buf, "binary");

        if (sendToTool === 1) {
          tools.switchTool("tool-extract-text", outputFilePath);
          sendIpcToPreload("update-menubar");
        } else if (sendToTool === 2) {
          tools.switchTool("tool-extract-palette", outputFilePath);
          sendIpcToPreload("update-menubar");
        } else if (sendToTool === 3) {
          tools.switchTool("tool-extract-qr", outputFilePath);
          sendIpcToPreload("update-menubar");
        } else {
          sendIpcToRenderer(
            "show-modal-info",
            "",
            _("ui-modal-info-imagesavedto") +
              "\n" +
              utils.reduceStringFrontEllipsis(outputFilePath, 85),
            _("ui-modal-prompt-button-ok")
          );
        }
        sendIpcToRenderer("update-loading", false);
      } catch (err) {
        exportPageError("");
      }
    })();
  } else {
    exportPageError("");
  }
}

function exportPageError(err) {
  log.error(err);
  sendIpcToRenderer("update-loading", false);
  sendIpcToRenderer(
    "show-modal-info",
    "",
    _("ui-modal-info-errorexportingpage"),
    _("ui-modal-prompt-button-ok")
  );
}

//////////////////////////////////////////////////////////////////////////////// MENU MSGS /////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.onMenuNextPage = function () {
  goToNextPage();
};

exports.onMenuPreviousPage = function () {
  goToPreviousPage();
};

exports.onMenuNextPage = function () {
  goToNextPage();
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
    "ui-modal-prompt-scalevalue"
  )} (${g_scaleToHeightMin}-${g_scaleToHeightMax}%):`;
  sendIpcToRenderer(
    "show-modal-prompt",
    question,
    "" + settings.getValue("zoom_scale"),
    _("ui-modal-prompt-button-ok"),
    _("ui-modal-prompt-button-cancel"),
    1
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

exports.onMenuOpenFile = onMenuOpenFile;
function onMenuOpenFile() {
  sendIpcToPreload("update-menubar");

  let defaultPath;
  if (g_fileData.path !== "") {
    defaultPath = path.dirname(g_fileData.path);
  } else if (
    history.get().length > 0 &&
    !history.getIndex(history.get().length - 1).data
  ) {
    defaultPath = path.dirname(
      history.getIndex(history.get().length - 1).filePath
    );
  }
  if (defaultPath && !fs.existsSync(defaultPath)) defaultPath = undefined;

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
  let fileList = appUtils.chooseOpenFiles(
    core.getMainWindow(),
    defaultPath,
    allowedFileTypesName,
    allowedFileTypesList,
    allowMultipleSelection
  );
  if (fileList === undefined) {
    return;
  }
  let filePath = fileList[0];

  tryOpen(filePath);
}

exports.onMenuCloseFile = function () {
  closeCurrentFile();
};

exports.onMenuPageExport = function () {
  exportPageStart(0);
};

exports.onMenuPageExtractText = function () {
  exportPageStart(1);
};

exports.onMenuPageExtractPalette = function () {
  exportPageStart(2);
};

exports.onMenuPageExtractQR = function () {
  exportPageStart(3);
};

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
      2
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
      _("ui-modal-prompt-button-cancel")
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

async function onMenuFileProperties() {
  if (g_fileData.path && g_fileData.path !== "") {
    // get metadata //////////////
    let message = "";
    // path
    message += `${_("ui-modal-info-metadata-filepath")}: ${g_fileData.path}`;
    message += "\n";
    // size
    let stats = fs.statSync(g_fileData.path);
    message += `${_("ui-modal-info-metadata-filesize")}: ${(
      stats.size /
      (1024 * 1024)
    ).toFixed(2)} MiB`;
    message += "\n";
    // pages
    message += `${_("ui-modal-info-metadata-numpages")}: ${
      g_fileData.numPages
    }`;
    message += "\n";
    // title
    if (g_fileData.metadata && g_fileData.metadata.title) {
      message += `${_("ui-modal-info-metadata-title")}: ${
        g_fileData.metadata.title
      }`;
      message += "\n";
    }
    // author
    if (g_fileData.metadata && g_fileData.metadata.author) {
      message += `${_("ui-modal-info-metadata-author")}: ${
        g_fileData.metadata.author
      }`;
      message += "\n";
    }
    // subject
    if (g_fileData.metadata && g_fileData.metadata.subject) {
      message += `${_("ui-modal-info-metadata-subject")}: ${
        g_fileData.metadata.subject
      }`;
      message += "\n";
    }
    // keywords
    if (g_fileData.metadata && g_fileData.metadata.keywords) {
      message += `${_("ui-modal-info-metadata-keywords")}: ${
        g_fileData.metadata.keywords
      }`;
      message += "\n";
    }
    // dimensions
    if (g_fileData.pageDimensions) {
      message += `${_("ui-modal-info-metadata-pagedimensions")}: ${
        g_fileData.pageDimensions[0]
      } x ${g_fileData.pageDimensions[1]}`;
      if (g_fileData.type === FileDataType.PDF) {
        message += " pt";
      } else {
        message += " px";
      }
      message += "\n";
    }

    // created
    if (
      g_fileData.type === FileDataType.PDF &&
      g_fileData.metadata &&
      g_fileData.metadata.created
    ) {
      let date = g_fileData.metadata.created;
      date = utils.parsePdfDate(date);
      date = date.toLocaleString();
      // date = Intl.DateTimeFormat([], {
      //   dayTime: "short",
      // }).format(date);
      message += `${_("ui-modal-info-metadata-created")}: ${date}`;
      message += "\n";
    } else if (process.platform === "win32") {
      let date = stats.birthtime;
      date = date.toLocaleString();
      message += `${_("ui-modal-info-metadata-created")}: ${date}`;
      message += "\n";
    }
    // modified
    if (g_fileData.metadata && g_fileData.metadata.modified) {
      let date = g_fileData.metadata.modified;
      date = utils.parsePdfDate(date);
      if (stats.mtime.getTime() > date.getTime()) {
        date = stats.mtime;
      }
      date = date.toLocaleString();
      message += `${_("ui-modal-info-metadata-modified")}: ${date}`;
      message += "\n";
    } else {
      let date = stats.mtime.toLocaleString();
      message += `${_("ui-modal-info-metadata-modified")}: ${date}`;
      message += "\n";
    }
    // MIME
    let fileType = await FileType.fromFile(g_fileData.path);
    if (fileType !== undefined) {
      // e.g. {ext: 'png', mime: 'image/png'}
      message += `${_("ui-modal-info-metadata-mimetype")}: ${fileType.mime}`;
      message += "\n";
    }
    // format
    if (g_fileData.metadata && g_fileData.metadata.format) {
      message += `${_("ui-modal-info-metadata-format")}: ${
        g_fileData.metadata.format
      }`;
      message += "\n";
    }
    // security
    if (g_fileData.metadata && g_fileData.metadata.encrypted) {
      message += `${_("ui-modal-info-metadata-security")}: ${_(
        "ui-modal-info-metadata-security-encrypted"
      )}`;
      message += "\n";
    } else {
      message += `${_("ui-modal-info-metadata-security")}: ${_(
        "ui-modal-info-metadata-security-unencrypted"
      )}`;
      message += "\n";
    }
    // comicinfo.xml
    if (
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.RAR ||
      g_fileData.type === FileDataType.SEVENZIP
    ) {
      if (g_fileData.metadata && g_fileData.metadata.comicInfoId) {
        message += `ComicInfo.xml: ${_(
          "ui-modal-info-metadata-comicinfoxml-included"
        )}`;
        message += "\n";
      } else {
        message += `ComicInfo.xml: ${_(
          "ui-modal-info-metadata-comicinfoxml-notincluded"
        )}`;
        message += "\n";
      }
    }
    // creator
    if (g_fileData.metadata && g_fileData.metadata.creator) {
      message += `${_("ui-modal-info-metadata-creator")}: ${
        g_fileData.metadata.creator
      }`;
      message += "\n";
    }
    // producer
    if (g_fileData.metadata && g_fileData.metadata.producer) {
      message += `${_("ui-modal-info-metadata-producer")}: ${
        g_fileData.metadata.producer
      }`;
      message += "\n";
    }
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
    }

    sendIpcToRenderer(
      "show-modal-properties",
      _("menu-file-properties").replace("...", ""),
      message,
      _("tool-shared-ui-close"),
      buttonText
    );
  }
}
exports.onMenuFileProperties = onMenuFileProperties;
