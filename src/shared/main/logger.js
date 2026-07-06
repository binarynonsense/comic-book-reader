/**
 * @license
 * Copyright 2023-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");

let g_isDebug = false;
let g_isRelease = true;
let g_levelCap = 4;
// 0 = info, notice and error, 1 = warning, 2 = debug, 3 = editor,
// 4 = debug and editor extra

const g_noticeTag = "[\x1b[33mNOTICE\x1b[0m]";
const g_warningTag = "[\x1b[93mWARNING\x1b[0m]";
const g_errorTag = "[\x1b[31mERROR\x1b[0m]";
const g_stackTag = "[\x1b[31mSTACK\x1b[0m]";
const g_debugTag = "[\x1b[36mDEBUG\x1b[0m]";

const g_testTag = "[\x1b[95mTEST\x1b[0m]";
const g_editorTag = "[\x1b[34mEDITOR\x1b[0m]";
const g_editorErrorTag = "[\x1b[31mEDITOR ERROR\x1b[0m]";

let g_log;

exports.init = function (info) {
  g_isDebug = info.isDev;
  g_isRelease = info.isRelease;
  // console.log(info.parsedArgs["log-level-cap"]);
  if (typeof info.parsedArgs["log-level-cap"] === "string") {
    const intValue = parseInt(info.parsedArgs["log-level-cap"]);
    if (intValue >= 0 && intValue <= 4) {
      g_levelCap = intValue;
    }
  }
  g_log = "";
};

exports.saveLogFile = function (filePath, prevFilePath, version) {
  try {
    g_log =
      `\n${"=".repeat(80)}\n\nACBR version: ${version}\nDate: ${new Date().toISOString()}\n\n${"-".repeat(80)}\n\n` +
      g_log;
    g_log += `\n${"=".repeat(80)}\n`;

    if (fs.existsSync(filePath)) {
      try {
        fs.renameSync(filePath, prevFilePath);
      } catch (error) {}
    }
    fs.writeFileSync(filePath, g_log);
  } catch (error) {}
};

exports.debug = function (message, isExtra) {
  if (g_levelCap >= 4 || (g_levelCap >= 2 && !isExtra)) {
    if (g_isDebug) {
      console.log(`${getTime()} ${g_debugTag}`, message);
    }
  }
  g_log += `${getTime()} [DEBUG] ${message}\n`;
};

exports.notice = function (message) {
  console.log(`${getTime()} ${g_noticeTag}`, message);
  g_log += `${getTime()} [NOTICE] ${message}\n`;
};

exports.warning = function (message, alwaysShow = false) {
  if (g_levelCap >= 1) {
    if (alwaysShow || g_isDebug) {
      console.log(`${getTime()} ${g_warningTag}`, message);
    }
  }
  g_log += `${getTime()} [WARNING] ${message}\n`;
};

exports.info = function (message) {
  console.log(getTime() + " " + message);
  g_log += `${getTime()} [INFO] ${message}\n`;
};

exports.error = function (message, simple = false) {
  if (simple) {
    console.log(`${getTime()} ${g_errorTag} ${message}`);
    return;
  }
  if (message?.message) {
    console.log(
      `${getTime()} ${g_errorTag} ${message.message}\n${getCallerData()}`,
    );
    g_log += `${getTime()} [ERROR] ${message.message}\n${getCallerData()}\n`;
  } else {
    console.log(`${getTime()} ${g_errorTag} ${message}\n${getCallerData()}`);
    g_log += `${getTime()} [ERROR] ${message}\n${getCallerData()}\n`;
  }
  if (g_isDebug && message?.stack) {
    console.log(`${getTime()} ${g_stackTag} ${message.stack}`);
  }
  if (message?.stack) g_log += `${getTime()} [STACK] ${message.stack}\n`;
};

exports.test = function (message) {
  if (g_isDebug && !g_isRelease) {
    console.log(`${getTime()} ${g_testTag}`, message);
  }
};
// TODO: test this version and replace if better
// exports.test = function (...args) { // accept any number of arguments
//   if (g_isDebug && !g_isRelease) {
//     console.log(`${getTime()} ${g_testTag}`, ...args);
//   }
// };

exports.editor = function (message, isExtra) {
  if (g_levelCap >= 4 || (g_levelCap >= 3 && !isExtra)) {
    if (g_isDebug && !g_isRelease) {
      console.log(`${getTime()} ${g_editorTag}`, message);
    }
  }
};

exports.editorError = function (message) {
  if (g_isDebug && !g_isRelease) {
    if (message?.message) {
      console.log(
        `${getTime()} ${g_editorErrorTag} ${
          message.message
        }\n${getCallerData()}`,
      );
    } else {
      console.log(
        `${getTime()} ${g_editorErrorTag} ${message}\n${getCallerData()}`,
      );
    }
    if (message?.stack) {
      console.log(`${getTime()} ${g_stackTag} ${message.stack}`);
    }
  }
};

function getTime() {
  const date = new Date();
  let hour = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds();

  return (
    "[" +
    (hour < 10 ? "0" + hour : hour) +
    ":" +
    (minutes < 10 ? "0" + minutes : minutes) +
    ":" +
    (seconds < 10 ? "0" + seconds : seconds) +
    "]"
  );
}

function getCallerData() {
  return new Error().stack.split("\n")[3];
}

// refs:
// https://en.m.wikipedia.org/wiki/ANSI_escape_code#Colors
// https://blog.logrocket.com/using-console-colors-node-js/
// https://stackoverflow.com/questions/14172455/get-name-and-line-of-calling-function-in-node-js
// https://stackoverflow.com/questions/18814221/adding-timestamps-to-all-console-messages
