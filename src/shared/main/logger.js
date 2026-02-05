/**
 * @license
 * Copyright 2023-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");

let g_isDebug = false;
let g_isRelease = true;

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
  g_log = "";
};

exports.saveLogFile = function (filePath, version) {
  g_log += "\n" + "=".repeat(40) + "\n\n";
  g_log += `ACBR version: ${version}\n`;
  g_log += `Date: ${new Date().toISOString()}\n`;
  fs.writeFileSync(filePath, g_log);
};

exports.debug = function (message) {
  if (g_isDebug) {
    console.log(`${getTime()} ${g_debugTag}`, message);
  }
  g_log += `${getTime()} [DEBUG] ${message}\n`;
};

exports.notice = function (message) {
  console.log(`${getTime()} ${g_noticeTag}`, message);
  g_log += `${getTime()} [NOTICE] ${message}\n`;
};

exports.warning = function (message, alwaysShow = false) {
  if (alwaysShow || g_isDebug) {
    console.log(`${getTime()} ${g_warningTag}`, message);
  }
  g_log += `${getTime()} [WARNING] ${message}\n`;
};

exports.info = function (message) {
  console.log(getTime() + " " + message);
  g_log += `${getTime()} [INFO] ${message}\n`;
};

exports.error = function (message) {
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

exports.editor = function (message) {
  if (g_isDebug && !g_isRelease) {
    console.log(`${getTime()} ${g_editorTag}`, message);
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
