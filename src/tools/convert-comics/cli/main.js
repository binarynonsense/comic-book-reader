/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  FileExtension,
  FileDataType,
} = require("../../../shared/main/constants");
const settings = require("../../../shared/main/settings");
const log = require("../../../shared/main/logger");
const appUtils = require("../../../shared/main/app-utils");

const tool = require("../main");
const toolOptions = require("./options");

//////////////////////////////////////////////////////////////////////////////
// SETUP /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_launchInfo;
const ToolMode = {
  CONVERT: 0,
  CREATE: 1,
  EXTRACT: 2,
};
let g_mode = ToolMode.CONVERT;

//////////////////////////////////////////////////////////////////////////////
// CLI ///////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.execute = function (launchInfo) {
  try {
    g_launchInfo = launchInfo;
    g_launchInfo.canEditRars = settings.canEditRars();
    if (g_launchInfo.parsedArgs["help"]) {
      log.info("available options:");
      toolOptions.printHelp(g_launchInfo);
      quit();
      return;
    }
    const [cliOptions, cliInputPaths] =
      toolOptions.getParsedCliOptions(g_launchInfo);
    ////
    switch (g_launchInfo.parsedArgs["tool"]) {
      case "extract-comics":
        g_mode = ToolMode.EXTRACT;
        break;
      case "create-comic":
        g_mode = ToolMode.CREATE;
        break;
      default:
        g_mode = ToolMode.CONVERT;
        break;
    }
    log.debug("execute cli tool: " + g_mode);
    ////
    // log.test(cliOptions);
    ////
    let inputList = [];
    cliInputPaths.forEach((inputPath, index) => {
      const type = tool.getInputPathType(inputPath);
      if (type >= 0) {
        inputList.push({
          id: index, // needed?
          path: inputPath,
          type,
        });
      }
    });
    // check options
    if (inputList.length <= 0) {
      log.info("Error: no input paths");
      return;
    }
    /////////////////////////////////////////////////////////////////
    const outputFolderOption = cliOptions.outputFolderOption;
    const outputFolderPath = cliOptions.outputFolderPath;
    if (outputFolderOption && outputFolderOption === "1") {
      // will use the same folder as the input file
    } else {
      // outputFolderPath must be valid
      if (
        !(
          outputFolderPath &&
          typeof outputFolderPath === "string" &&
          fs.existsSync(outputFolderPath) &&
          fs.lstatSync(outputFolderPath).isDirectory()
        )
      ) {
        log.info("Error: no output folder");
        quit();
        return;
        // uiOptions.outputFolderPath = appUtils.getDesktopFolderPath();
      }
    }
    ////
    if (g_mode === ToolMode.CREATE) {
      if (!cliOptions.outputFileBaseName)
        cliOptions.outputFileBaseName = "ComicBook";
    } else if (g_mode === ToolMode.EXTRACT) {
      cliOptions.outputFormat = FileDataType.IMGS_FOLDER;
    }
    ////
    cliOptions.inputSearchFoldersFormats =
      cliOptions.inputSearchFoldersFormats.map((s) => "." + s);
    /////////////////////////////////////////////////////////////////
    let initOptions = { mode: g_mode, inputList };
    tool.execute(initOptions, cliOptions, ipcReceiver);
  } catch (error) {
    if (error.message && error.message.startsWith("Unknown option")) {
      log.error(error.message.substring(0, error.message.indexOf(".")), true);
    } else if (typeof error === "string" && error.startsWith("Invalid value")) {
      log.error(error, true);
    } else {
      log.error(error);
    }
    log.info("Add --help to print a list of the available options.");
    quit();
  }
};

function quit() {
  tool.close();
  appUtils.quit();
}

function ipcReceiver(...args) {
  if (args[0] === "update-log-text") {
    if (args[1]) log.info(args[1]);
  } else if (args[0] === "update-info-text") {
    if (args[1]) log.info(args[1]);
  } else if (args[0] === "modal-update-title-text") {
    if (args[1]) log.info(args[1]);
  } else if (args[0] === "show-result") {
    if (args[2] && args[2].length > 0) {
      log.info(args[1] + ":");
      args[2].forEach((element) => {
        log.info(element.path);
      });
    }
    quit();
  } else {
    //log.test(args);
  }
  //"file-finished-canceled"
  //"file-finished-error"
  //"file-finished-ok"
}
