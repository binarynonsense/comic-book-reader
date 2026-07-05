/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");
const fileUtils = require("../file-utils");
const binUtils = require("../bin-utils");
const log = require("../logger");

///////////////////////////////////////////////////////////////////////////////
// 7ZIP ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function get7zBinPath() {
  return binUtils.get7zBinPath();
}

exports.get7ZipEntriesList = async function (filePath, password, archiveType) {
  try {
    const { spawn } = require("node:child_process");

    let args = ["l", filePath, "-slt", "-sccUTF-8", "-mmt=off"];
    if (password && password !== "" && password !== "_") {
      args.push("-p" + password);
    } else {
      args.push("-p");
    }
    // if (archiveType && archiveType !== "rar") {
    //   args.push(`-t${archiveType}`);
    // }
    return await new Promise((resolve) => {
      const child = spawn(get7zBinPath(), args);
      let imgEntries = [];
      let comicInfoIds = [];
      let isEncrypted = false;
      let fullStderr = "";
      let remainingData = "";

      child.stdout.on("data", (chunk) => {
        remainingData += chunk.toString();
        let lines = remainingData.split(/\r?\n/);
        remainingData = lines.pop();

        for (let line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("Path = ")) {
            const fileName = trimmed.substring(7).trim();
            if (fileName && !filePath.endsWith(fileName)) {
              if (fileUtils.hasImageExtension(fileName))
                imgEntries.push(fileName);
              else if (fileName.toLowerCase().endsWith("comicinfo.xml"))
                comicInfoIds.push(fileName);
            }
          } else if (trimmed.includes("Encrypted = +")) {
            isEncrypted = true;
          }
        }
      });

      child.stderr.on("data", (data) => {
        fullStderr += data.toString();
      });

      child.on("close", (code) => {
        const lowerStderr = fullStderr.toLowerCase();
        // detect header encryption AND entry encryption
        if (
          isEncrypted ||
          lowerStderr.includes("password") ||
          lowerStderr.includes("encrypted") ||
          lowerStderr.includes("wrong password")
        ) {
          if (!password || password === "" || password === "_") {
            return resolve({ result: "password required", paths: [] });
          }
        }
        if (code !== 0 && imgEntries.length === 0) {
          return resolve({ result: "other error", paths: [] });
        }
        resolve({
          result: "success",
          paths: imgEntries,
          metadata: {
            encrypted: isEncrypted || (password && password !== "_"),
            comicInfoId: comicInfoIds[0] || undefined,
          },
        });
      });
    });
  } catch (error) {
    log.error("get7ZipEntriesList error: ", error);
    return { result: "other error", paths: [] };
  }
};

exports.extract7ZipEntryBuffer = async function (
  filePath,
  entryName,
  password,
  tempSubFolderPath,
  archiveType,
) {
  try {
    const { spawn } = require("node:child_process");
    const fs = require("fs");
    const path = require("path");

    let args = [
      "e",
      filePath,
      `-o${tempSubFolderPath}`,
      entryName,
      "-y",
      "-aos",
    ];
    if (password && password !== "" && password !== "_") {
      args.push("-p" + password);
    } else {
      args.push("-p");
    }

    await new Promise((resolve, reject) => {
      const child = spawn(get7zBinPath(), args);

      const stdoutChunks = [];
      const stderrChunks = [];
      child.stdout.on("data", (chunk) => {
        stdoutChunks.push(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderrChunks.push(chunk);
      });

      child.on("error", (error) => {
        reject(error);
      });
      child.on("close", (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        if (code !== 0) {
          const error = new Error(`7z exited with code ${code}`);
          error.stdout = stdout;
          error.stderr = stderr;
          return reject(error);
        }
        resolve();
      });
    });

    const fullPath = path.join(tempSubFolderPath, path.basename(entryName));
    const buffer = fs.readFileSync(fullPath);
    return { success: true, data: buffer };
  } catch (error) {
    const stdoutStr = error.stdout || "";
    const stderrStr = error.stderr || "";
    const output = (stdoutStr + stderrStr).toLowerCase();
    if (
      output.includes("password") ||
      output.includes("encrypted") ||
      output.includes("wrong password")
    ) {
      return { success: false, data: "password required" };
    }

    return { success: false, data: error };
  }
};

//////////////////////

let g_active7zProcess = null;

exports.extract7Zip = async function (
  filePath,
  tempFolderPath,
  password,
  archiveType,
) {
  try {
    const { spawn } = require("node:child_process");
    const path = require("path");

    const absPath = path.resolve(filePath);
    const pass = password === undefined || password === "" ? "_" : password;

    // 'x' to ensure inner folders are kept
    let args = ["x", absPath, `-o${tempFolderPath}`, "-y"];
    if (pass !== "_") {
      args.push("-p" + pass);
    } else {
      // trigger password error if encrypted
      args.push("-p-");
    }
    // if (archiveType && archiveType !== "rar") {
    //   args.push(`-t${archiveType}`);
    // }

    return await new Promise((resolve) => {
      g_active7zProcess = spawn(get7zBinPath(), args);

      let fullStderr = "";

      g_active7zProcess.stdout.on("data", () => {
        // silence progress logs
      });
      g_active7zProcess.stderr.on("data", (data) => {
        fullStderr += data.toString();
      });

      g_active7zProcess.on("close", (code, signal) => {
        g_active7zProcess = null;

        if (signal === "SIGTERM" || signal === "SIGKILL") {
          // cancelled
          return resolve({ success: false, cancelled: true });
        }

        if (code === 0) {
          resolve({ success: true });
        } else {
          const errStr = fullStderr.toLowerCase();
          let errorResult = fullStderr;
          if (
            errStr.includes("password") ||
            errStr.includes("encrypted") ||
            errStr.includes("wrong password")
          ) {
            errorResult = "password required";
          } else if (errStr.includes("e_fail") || errStr.includes("no space")) {
            errorResult = "no_disk_space";
          }
          resolve({ success: false, error: errorResult });
        }
      });

      g_active7zProcess.on("error", (err) => {
        g_active7zProcess = null;
        resolve({ success: false, error: err.message });
      });
    });
  } catch (error) {
    g_active7zProcess = null;
    log.error("extract7Zip Global Error:", error);
    return { success: false, error: error };
  }
};

exports.stop7zExtraction = function () {
  if (g_active7zProcess) {
    // native spawn
    if (typeof g_active7zProcess.kill === "function") {
      g_active7zProcess.kill("SIGKILL");
    }
    // node-7z stream
    else if (typeof g_active7zProcess.cancel === "function") {
      g_active7zProcess.cancel();
    }
    g_active7zProcess = null;
  }
};

/////////////////////////////////////////////////////////////////

exports.create7Zip = async function (
  filePathsList,
  outputFilePath,
  password,
  tempFolderPath,
  archiveType,
) {
  const { spawn } = require("node:child_process");
  const listFileName = "acbr-file-list.txt";
  const listFilePath = path.join(tempFolderPath, listFileName);
  try {
    const listContent = [...new Set(filePathsList)]
      .map((entryFilePath) => {
        const relativePath = path.normalize(
          path.relative(tempFolderPath, entryFilePath),
        );
        return `"${relativePath}"`;
      })
      .join("\n");
    fs.writeFileSync(listFilePath, listContent, "utf-8");

    // a = add to archive
    // -aoa = overwrite all
    const args = ["a", "-aoa", outputFilePath, `@${listFileName}`];
    if (password && password.trim() !== "") {
      args.push(`-p${password}`);
    }
    if (archiveType === "zip") {
      args.push("-tzip");
      args.push("-mcu=on"); // force UTF-8 for filenames inside
    }
    args.push("-scsUTF-8"); // tell 7z the list file is UTF-8

    const sevenZipProcess = spawn(get7zBinPath(), args, {
      cwd: tempFolderPath,
      windowsHide: true,
    });

    let stderrData = "";
    // NOTE: drains stdout to prevent the process from hanging when the buffer
    // fills up, alternative: could use stdio: ['ignore', 'ignore', 'pipe'] in
    // the spawn options
    sevenZipProcess.stdout.on("data", () => {});
    sevenZipProcess.stderr.on(
      "data",
      (data) => (stderrData += data.toString()),
    );

    const exitCode = await new Promise((resolve) => {
      sevenZipProcess.on("close", (code) => resolve(code));
      sevenZipProcess.on("error", (error) => {
        stderrData += `\nSpawn Error: ${error.message}`;
        resolve(-1);
      });
    });

    try {
      if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
    } catch (e) {}

    // 0 = success, 1 = warning
    if (exitCode === 0 || exitCode === 1) {
      return;
    }
    throw new Error(`7z error: ${stderrData}`);
  } catch (error) {
    throw error;
  } finally {
    try {
      if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
    } catch (e) {}
  }
};

exports.update7ZipWithFolderContents = async function (
  filePath,
  contentFolderPath,
  password,
  archiveType,
) {
  try {
    const { spawn } = require("node:child_process");
    const path = require("path");

    const absFilePath = path.resolve(filePath);

    let args = ["u", absFilePath, contentFolderPath + "/*", "-y", "-sccUTF-8"];

    if (password && password.trim() !== "") {
      args.push("-p" + password);
    }

    if (archiveType && archiveType === "zip") {
      args.push(`-t${archiveType}`);
    }

    const success = await new Promise((resolve) => {
      const child = spawn(get7zBinPath(), args);

      child.stdout.on("data", () => {
        // silence progress logs
      });
      child.stderr.on("data", () => {
        // silence error logs
      });
      child.on("error", () => {
        resolve(false);
      });
      child.on("close", (code) => {
        resolve(code === 0);
      });
    });

    if (success) {
      return true;
    }
    throw "7-Zip update command failed";
  } catch (error) {
    log.error(error);
    return false;
  }
};

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.getEpubOpfEntriesList = async function (filePath, password) {
  try {
    if (password === undefined || password === "") {
      password = "_";
    }
    const { spawn } = require("node:child_process");
    let args = ["l", filePath, "-slt", "-sccUTF-8", "-mmt=off", "-tzip"];
    if (password !== "_") {
      args.push("-p" + password);
    } else {
      args.push("-p");
    }
    let promise = await new Promise((resolve) => {
      const child = spawn(get7zBinPath(), args);
      const opfEntries = [];
      let fullStderr = "";
      let remainingData = "";
      child.stdout.on("data", (chunk) => {
        remainingData += chunk.toString();
        let lines = remainingData.split(/\r?\n/);
        remainingData = lines.pop();
        for (let line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("Path = ")) {
            const fileName = trimmed.substring(7).trim();
            if (fileName && fileName.toLowerCase().endsWith(".opf")) {
              opfEntries.push(fileName);
            }
          }
        }
      });
      child.stderr.on("data", (data) => {
        fullStderr += data.toString();
      });

      child.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      child.on("close", (code) => {
        if (code !== 0 && opfEntries.length === 0) {
          const lowerStderr = fullStderr.toLowerCase();
          if (
            lowerStderr.includes("password") ||
            lowerStderr.includes("encrypted") ||
            lowerStderr.includes("wrong password")
          ) {
            return resolve({ success: false, data: "password required" });
          }
          return resolve({
            success: false,
            data: new Error(`7z exited with code ${code}`),
          });
        }
        resolve({
          success: true,
          data: opfEntries,
        });
      });
    });

    if (promise.success === true) {
      return promise.data;
    } else {
      throw promise.data;
    }
  } catch (error) {
    log.error(error);
    return undefined;
  }
};

// NOTE: 7z reference
//
// l -> list
// x -> extract
// u -> update / append
// a -> add or create?
//
// -slt -> show technical layout, key = value; don't truncate names?
// -sccUTF-8 -> stdout/stderr streams to unicode
// -mmt=off -> disable multithread, to maintain output order?
// -p... -> password
// -aos -> archive overwrite skip, skip file if output path already exists
