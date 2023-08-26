/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

let g_isDebug = false;

const g_errorTag = "[\x1b[31mERROR\x1b[0m]";
const g_stackTag = "[\x1b[31mSTACK\x1b[0m]";
const g_debugTag = "[\x1b[94mDEBUG\x1b[0m]";

exports.init = function (isDebug) {
  g_isDebug = isDebug;
};

exports.debug = function (message) {
  if (g_isDebug) {
    console.log(`${getTime()} ${g_debugTag} ${message}`);
  }
};

exports.info = function (message) {
  console.log(getTime() + " " + message);
};

exports.error = function (message) {
  if (message?.message) {
    console.log(
      `${getTime()} ${g_errorTag} ${message.message}\n    at ${callerData()}`
    );
  } else {
    console.log(
      `${getTime()} ${g_errorTag} ${message}\n    at ${callerData()}`
    );
  }
  if (g_isDebug && message?.stack) {
    console.log(`${getTime()} ${g_stackTag} ${message.stack}`);
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

function callerData() {
  let error = new Error();
  let frame = error.stack.split("\n")[3];
  let callerLineNumber = frame.split(":").reverse()[1];
  let functionName = frame.split(" ")[5];
  return `${functionName}::${callerLineNumber}`;
}

// refs:
// https://en.m.wikipedia.org/wiki/ANSI_escape_code#Colors
// https://blog.logrocket.com/using-console-colors-node-js/
// https://stackoverflow.com/questions/14172455/get-name-and-line-of-calling-function-in-node-js
// https://stackoverflow.com/questions/18814221/adding-timestamps-to-all-console-messages
