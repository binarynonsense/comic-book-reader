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

exports.createRar = async function (
  filePathsList,
  outputFilePath,
  rarExePath,
  workingDir,
  password,
) {
  const { spawn } = require("node:child_process");
  const listFileName = "acbr-file-list.txt";
  const listFilePath = path.join(workingDir, listFileName);
  try {
    const listContent = [...new Set(filePathsList)]
      .map((entryFilePath) => {
        const relativePath = path.normalize(
          path.relative(workingDir, entryFilePath),
        );
        return `"${relativePath}"`;
      })
      .join("\n");
    fs.writeFileSync(listFilePath, listContent, "utf-8");

    if (fs.existsSync(outputFilePath)) {
      // there's no overwrite flag in rar, so delete before creating
      // if not it would add files to the current one if it exists
      await fileUtils.safeUnlink(outputFilePath, true);
    }

    let args = ["a", "-y", outputFilePath, `@${listFileName}`];
    if (password && password.trim() !== "") {
      args.push(`-p${password}`);
    }

    const rarProcess = spawn(rarExePath, args, {
      cwd: workingDir,
      windowsHide: true,
    });

    let stderrData = "";
    // NOTE: drains stdout to prevent the process from hanging when the buffer
    // fills up, alternative: could use stdio: ['ignore', 'ignore', 'pipe'] in
    // the spawn options
    rarProcess.stdout.on("data", () => {});
    rarProcess.stderr.on("data", (data) => (stderrData += data.toString()));

    const exitCode = await new Promise((resolve) => {
      rarProcess.on("close", (code) => resolve(code));
      rarProcess.on("error", (error) => {
        stderrData += `\nSpawn Error: ${error.message}`;
        resolve(-1);
      });
    });

    // 0 = success, 1 = warning
    if (exitCode === 0 || exitCode === 1) {
      return { success: true };
    }
    throw new Error(`rar error: ${stderrData}`);
  } catch (error) {
    return { error: true, stderr: error.message || error };
  } finally {
    try {
      if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
    } catch (e) {}
  }
};

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
