/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");

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

exports.delay = async function (seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};
