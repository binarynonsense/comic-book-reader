/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

exports.execShellCommand = function (command) {
  const exec = require("child_process").exec;
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(error);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
};

exports.delay = async function (seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};
