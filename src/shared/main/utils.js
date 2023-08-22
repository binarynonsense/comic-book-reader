/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

function execShellCommand(command, workingDir) {
  // ref: : https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback
  let options = { windowsHide: true };
  if (workingDir) options.cwd = workingDir;
  const exec = require("child_process").exec;
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error });
    });
  });
}
exports.execShellCommand = execShellCommand;

exports.isRarExeAvailable = async function () {
  //if (process.platform === "win32")
  const cmdResult = await execShellCommand("rar");
  //console.log(cmdResult);
  if (!cmdResult.error || cmdResult.error === "") {
    return true;
  } else {
    return false;
  }
};

exports.delay = async function (seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};
