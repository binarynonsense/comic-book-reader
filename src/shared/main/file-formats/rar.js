/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");
const utils = require("../utils");
const fileUtils = require("../file-utils");
const log = require("../logger");

///////////////////////////////////////////////////////////////////////////////
// RAR ////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function createRar(
  filePathsList,
  outputFilePath,
  rarExePath,
  workingDir,
  password,
) {
  try {
    let args = ["a"];
    if (password && password.trim() !== "") {
      // -hp would also encrypt the headers but acbr wouldn't
      // be able to open it currently
      args.push(`-p${password}`);
    }
    args.push(outputFilePath);
    if (true) {
      args.push("-r");
      args.push("./*");
    }
    // else if (true) {
    //   // use txt with all paths in it
    //   const pathsTxt = path.join(workingDir, "acbr-txt-paths.txt");
    //   let relativePaths = "";
    //   for (let index = 0; index < filePathsList.length; index++) {
    //     if (index > 0) relativePaths += "\n";
    //     const filePath = filePathsList[index];
    //     relativePaths += path.relative(workingDir, filePath);
    //   }
    //   fs.writeFileSync(pathsTxt, relativePaths);
    //   args.push(`@${pathsTxt}`);
    // } else {
    //   // pass paths directly
    //   // stopped using it due to potential 'ENAMETOOLONG' errors
    //   // when too many files (at least on Windows)
    //   filePathsList.forEach((filePath) => {
    //     filePath = path.relative(workingDir, filePath);
    //     args.push(filePath);
    //   });
    // }
    // same as with 7z
    // don't know how to make rar use a relative path for the input files
    // when storing them in the output file, only works when I tell it
    // to compress all the contents of a folder, so I create temp subfolders
    // for the files and move them there, which is a loss of time :(
    const tempFolderPath = workingDir;
    const tempSubfolderPath = fileUtils.createRandomSubfolder(tempFolderPath);
    if (!tempSubfolderPath) throw "Couldn't create rar subfolder for images";
    for (let index = 0; index < filePathsList.length; index++) {
      const oldPath = filePathsList[index];
      const relativeFilePath = path.relative(tempFolderPath, oldPath);
      const newPath = path.join(tempSubfolderPath, relativeFilePath);
      // create subfolders if they don't exist
      fs.mkdirSync(path.dirname(newPath), { recursive: true });
      fileUtils.moveFile(oldPath, newPath);
    }
    const cmdResult = utils.execShellCommand(
      rarExePath,
      args,
      tempSubfolderPath,
    );
    //const cmdResult = utils.execShellCommand(rarExePath, args, workingDir);
    if (!cmdResult.error || cmdResult.error === false) {
      return true;
    } else {
      throw cmdResult.stderr;
    }
  } catch (error) {
    //console.log(error);
    return false;
  }
}
exports.createRar = createRar;

function updateRarEntry(rarExePath, filePath, entryPath, workingDir, password) {
  try {
    const cmdResult = utils.execShellCommand(
      rarExePath,
      ["u", filePath, entryPath],
      workingDir,
    );
    if (!cmdResult.error || cmdResult.error === "") {
      return true;
    } else {
      log.error(cmdResult.error);
      return false;
    }
  } catch (error) {
    log.error(error);
    return false;
  }
}
exports.updateRarEntry = updateRarEntry;
