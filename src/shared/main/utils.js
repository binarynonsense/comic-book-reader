/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("path");
const log = require("./logger");
// NOTE: don't add any electron related requires

///////////////////////////////////////////////////////////////////////////////
// SHELL //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function execShellCommand(command, args, workingDir) {
  //ref: https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options
  // ref: https://nodejs.org/api/child_process.html#child_process_options_stdio
  try {
    let options = {
      windowsHide: true,
      encoding: "utf8",
      stdio: ["pipe", "pipe", null],
    };
    if (workingDir) options.cwd = workingDir;
    const execFileSync = require("child_process").execFileSync;
    const stdout = execFileSync(command, args, options);
    return { error: false, stdout: stdout, stderr: undefined };
  } catch (error) {
    return { error: true, stdout: undefined, stderr: error };
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

exports.getDriveList = function () {
  let driveList = [];
  if (process.platform === "linux") {
    //lsblk -J -f -o size,label,mountpoint,uuid,rm
    const cmdResult = execShellCommand("lsblk", [
      "-J",
      "-f",
      "-o",
      "size,label,mountpoint,uuid,rm,fstype,type",
    ]);
    if (!cmdResult.error) {
      try {
        const list = JSON.parse(cmdResult.stdout);
        if (list?.blockdevices && list.blockdevices.length > 0) {
          list.blockdevices.forEach((drive) => {
            if (drive.type !== "loop" && drive.mountpoint != null) {
              driveList.push({
                label: drive.label,
                // TODO: do in a more elegant way
                size:
                  drive.size.substring(0, drive.size.length - 1) +
                  " " +
                  drive.size.substring(
                    drive.size.length,
                    drive.size.length - 1
                  ) +
                  "iB",
                path: drive.mountpoint,
                // NOTE: rm is false even for usb pendrives?
                isRemovable: drive.rm,
                isUSB: false,
              });
            }
          });
        }
      } catch (error) {
        log.debug(error);
      }
    } else {
      log.debug(cmdResult.stderr);
    }
  } else if (process.platform === "win32") {
    // const cmdResult = execShellCommand("powershell", [
    //   "get-volume | ConvertTo-Json",
    // ]);
    const cmdResult = execShellCommand("powershell", [
      "get-psdrive -psprovider filesystem | ConvertTo-Json",
    ]);
    if (!cmdResult.error) {
      try {
        let list = JSON.parse(cmdResult.stdout);
        if (!Array.isArray(list)) {
          list = [list];
        }
        list.forEach((drive) => {
          if (drive.Root) {
            let size = "??? GiB";
            if (drive.Used && drive.Free) {
              size =
                (
                  (parseInt(drive.Used) + parseInt(drive.Free)) /
                  1024 /
                  1024 /
                  1024
                ).toFixed(2) + " GiB";
            }
            driveList.push({
              label: drive.Description,
              size: size,
              path: drive.Root,
              // NOTE: can't get these
              isRemovable: false,
              isUSB: false,
            });
          }
        });
      } catch (error) {
        log.debug(error);
      }
    } else {
      log.debug(cmdResult.stderr);
    }
  }
  return driveList;
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

exports.padNumber = function (number, maximum) {
  if (!number || !maximum) return number;
  number = number.toString();
  maximum = maximum.toString();
  while (number.length < maximum.length) number = "0" + number;
  return number;
};

exports.isObject = function isObject(input) {
  return typeof input == "object" && input.constructor == Object;
};

///////////////////////////////////////////////////////////////////////////////
// VERSION ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: these are also in renderer/utils.js. Apply any changes there too.

exports.isVersionOlder = function (testVersion, referenceVersion) {
  const test = separateVersionText(testVersion);
  const reference = separateVersionText(referenceVersion);
  if (test === undefined || reference === undefined) return true;

  if (test.major < reference.major) return true;
  if (test.major > reference.major) return false;
  if (test.minor < reference.minor) return true;
  if (test.minor > reference.minor) return false;
  if (test.patch < reference.patch) return true;
  if (test.patch > reference.patch) return false;
  // TODO: too complex, may have errors, make better/simpler
  if (test.beta === undefined && test.alpha === undefined) {
    return false;
  }
  if (reference.beta === undefined && reference.alpha === undefined) {
    if (test.beta !== undefined || test.alpha !== undefined) {
      return true;
    }
  }
  // both have alpha or beta
  if (reference.beta !== undefined) {
    if (test.beta !== undefined) {
      if (reference.beta > test.beta) return true;
      else return false;
    } else {
      return true;
    }
  } else {
    // reference has alpha
    if (test.beta !== undefined) {
      return false;
    }
    // beta has alpha
    if (reference.alpha > test.alpha) return true;
    else return false;
  }
};

function separateVersionText(version) {
  try {
    const regex =
      /^(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)((-alpha(?<alpha>[0-9]+))|(-beta(?<beta>[0-9]+))*.*)$/;
    let match = version.match(regex);
    if (match === null) return undefined;
    if (match.groups.major) match.groups.major = parseInt(match.groups.major);
    if (match.groups.minor) match.groups.minor = parseInt(match.groups.minor);
    if (match.groups.patch) match.groups.patch = parseInt(match.groups.patch);
    if (match.groups.alpha) match.groups.alpha = parseInt(match.groups.alpha);
    return match.groups;
  } catch (error) {
    console.log("match error");
  }
}
exports.separateVersionText = separateVersionText;
