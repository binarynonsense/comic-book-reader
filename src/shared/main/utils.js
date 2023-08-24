/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");

///////////////////////////////////////////////////////////////////////////////
// SHELL //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function execShellCommand(command, args, workingDir) {
  //ref: https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options
  try {
    let options = { windowsHide: true, encoding: "utf8" };
    if (workingDir) options.cwd = workingDir;
    const execFileSync = require("child_process").execFileSync;
    const stdout = execFileSync(command, args, options);
    return { error: false, stdout: stdout };
  } catch (error) {
    return { error: true, stdout: undefined };
  }
}
exports.execShellCommand = execShellCommand;

function getRarCommand(rarFolderPath) {
  let command = "rar";
  if (process.platform === "win32") {
    command = "Rar.exe";
  }
  if (rarFolderPath && rarFolderPath.trim !== "") {
    command = path.join(rarFolderPath, command);
  }
  return command;
}
exports.getRarCommand = getRarCommand;

exports.isRarExeAvailable = function (rarFolderPath) {
  const cmdResult = execShellCommand(getRarCommand(rarFolderPath));
  if (!cmdResult.error || cmdResult.error === "") {
    return true;
  } else {
    return false;
  }
};

///////////////////////////////////////////////////////////////////////////////
// HELPERS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.delay = async function (seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

exports.splitArray = function (array, number) {
  // ref: https://stackoverflow.com/questions/8188548/splitting-a-js-array-into-n-arrays
  if (number > array.length) number = array.length;
  let copyArray = [...array];
  let result = [];
  for (let i = number; i > 0; i--) {
    result.push(copyArray.splice(0, Math.ceil(copyArray.length / i)));
  }
  return result;
};

exports.reduceStringFrontEllipsis = function (input, max = 60) {
  var length = max;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
};

exports.reduceStringMiddleEllipsis = function (text, length) {
  if (text.length <= length) return text;
  const separator = "...";
  const finalLength = length - separator.length;
  const frontLength = Math.ceil(finalLength / 2);
  const backLength = Math.floor(finalLength / 2);
  return (
    text.substr(0, frontLength) +
    separator +
    text.substr(text.length - backLength)
  );
};

exports.compare = function (a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

exports.parsePdfDate = function (date) {
  // examples
  // D:20230806093904Z
  // D:20180529112151-05'00'
  // TODO: HACK: investigate how to do this properly, now the time zone
  // is incorrect/being ignored
  if (date.startsWith("D:")) date = date.replace("D:", "");
  // if (!/^[0-9]{8}T[0-9]{6}Z$/.test(date))
  //   throw new Error("incorrect date format: " + date);
  var year = date.substr(0, 4);
  var month = date.substr(4, 2);
  var day = date.substr(6, 2);
  var hour = date.substr(8, 2);
  var minute = date.substr(10, 2);
  var second = date.substr(12, 2);
  // UTC months start in 0
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};
