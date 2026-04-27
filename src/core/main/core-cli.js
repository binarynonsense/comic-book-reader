/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

//////////////////////////////////////////////////////////////////////////////
// SETUP /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const settings = require("../../shared/main/settings");
const log = require("../../shared/main/logger");
const i18n = require("../../shared/main/i18n");
const appUtils = require("../../shared/main/app-utils");
const temp = require("../../shared/main/temp");

const convertComics = require("../../tools/convert-comics/cli/main");

let g_launchInfo;
let core, sendIpcToCoreRenderer, sendIpcToPreload;

//////////////////////////////////////////////////////////////////////////////
// WINDOW ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.createWindow = function (_core, launchInfo) {
  core = _core;
  sendIpcToCoreRenderer = core.sendIpcToCoreRenderer;
  sendIpcToPreload = core.sendIpcToPreload;

  g_launchInfo = launchInfo;
  g_launchInfo.quittingPhase = 0;
  // log.test(g_launchInfo.parsedArgs);

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
    if (reason instanceof Error) {
      console.error("Stack trace:", reason.stack);
    } else {
      console.error("Rejected with a non-error value:", reason);
    }
    appUtils.quit();
  });

  process.on("uncaughtException", (error, origin) => {
    console.error("Uncaught exception", error);
    console.error("Origin:", origin);
    appUtils.quit();
  });

  ///////////

  let tempFolderPath = settings.getValue("tempFolderPath");
  if (!tempFolderPath) {
    log.error("Temp folder path is undefined");
  }
  if (!path.isAbsolute(tempFolderPath)) {
    tempFolderPath = path.resolve(appUtils.getExeFolderPath(), tempFolderPath);
  }
  temp.init(tempFolderPath);
  appUtils.generateExternalFilesFolder();
  // i18n.init(g_launchInfo.isDev);
  // Forcing English for now at least.
  i18n.init(g_launchInfo.isDev, "en");

  ////////////////////////////////////////////////////////////////////////////
  const isValidTool = (name) => {
    return (
      typeof name === "string" &&
      ["convert-comics", "extract-comics", "create-comic"].includes(name)
    );
  };
  if (
    g_launchInfo.parsedArgs["tool"] &&
    isValidTool(g_launchInfo.parsedArgs["tool"])
  ) {
    switch (g_launchInfo.parsedArgs["tool"]) {
      case "convert-comics":
      case "extract-comics":
      case "create-comic":
        {
          convertComics.execute(g_launchInfo);
        }
        break;
    }
  } else {
    // TODO: print better error / localize
    if (launchInfo.parsedArgs["help"]) {
      log.info("valid tool names:");
      log.info("  convert-comics");
      log.info("  extract-comics");
      log.info("  create-comic");
      log.info(`e.g. --tool="convert-comics"`);
      quit();
    } else {
      log.error("Invalid tool.", true);
      log.info("Add --help to print a list of the available tools.");
    }
    quit();
  }
  ////////////////////////////////////////////////////////////////////////////
};

function quit() {
  app.quit();
}

//////////////////////////////////////////////////////////////////////////////
// IPC RECEIVE ///////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.onIpcMenuAcceleratorPressed = function (id) {
  log.test("onIpcMenuAcceleratorPressed");
};

//////////////////////////////////////////////////////////////////////////////
// HELPERS ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function cleanUpOnQuit() {
  // clean up
  temp.cleanUp();
  appUtils.cleanUpUserDataFolder();
}
exports.cleanUpOnQuit = cleanUpOnQuit;

function onLanguageChanged() {
  log.test("onLanguageChanged");
}
exports.onLanguageChanged = onLanguageChanged;
