/**
 * @license
 * Copyright 2023-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

let g_isDebug = false;
let g_isRelease = true;

const g_errorTag = "[\x1b[31mERROR\x1b[0m]";
const g_stackTag = "[\x1b[31mSTACK\x1b[0m]";
const g_debugTag = "[\x1b[36mDEBUG\x1b[0m]";
const g_testTag = "[\x1b[95mTEST\x1b[0m]";
const g_warningTag = "[\x1b[93mWARNING\x1b[0m]";

exports.init = function (info) {
  g_isDebug = info.isDev;
  g_isRelease = info.isRelease;
};

exports.debug = function (message) {
  if (g_isDebug) {
    console.log(`${getTime()} ${g_debugTag}`, message);
  }
};

exports.warning = function (message) {
  if (g_isDebug) {
    console.log(`${getTime()} ${g_warningTag}`, message);
  }
};

exports.info = function (message) {
  console.log(getTime() + " " + message);
};

exports.error = function (message) {
  if (message?.message) {
    console.log(
      `${getTime()} ${g_errorTag} ${message.message}\n${getCallerData()}`
    );
  } else {
    console.log(`${getTime()} ${g_errorTag} ${message}\n${getCallerData()}`);
  }
  if (g_isDebug && message?.stack) {
    console.log(`${getTime()} ${g_stackTag} ${message.stack}`);
  }
};

exports.test = function (message) {
  if (g_isDebug && !g_isRelease) {
    console.log(`${getTime()} ${g_testTag}`, message);
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
