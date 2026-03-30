/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");
const fileUtils = require("../file-utils");
const log = require("../logger");

///////////////////////////////////////////////////////////////////////////////
// 7ZIP ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_pathTo7zipBin;

function checkPathTo7ZipBin() {
  if (g_pathTo7zipBin !== undefined) return g_pathTo7zipBin;

  const isWin = process.platform === "win32";
  const binName = isWin ? "7z.exe" : "7zz";
  let finalPath;

  const isPackaged =
    process.resourcesPath.includes("app.asar") ||
    !process.resourcesPath.includes("node_modules");

  if (isPackaged) {
    finalPath = path.join(
      process.resourcesPath,
      "bin",
      "7zip",
      isWin ? "win" : "linux",
      binName,
    );
  } else {
    finalPath = path.join(
      __dirname,
      "../../../",
      "assets",
      "bin",
      "7zip",
      isWin ? "win" : "linux",
      binName,
    );
  }

  if (!isWin && fs.existsSync(finalPath)) {
    try {
      fs.chmodSync(finalPath, 0o755);
    } catch (e) {}
  }

  if (!fs.existsSync(finalPath)) {
    log.error(`7z not found at: ${finalPath}`);
  }

  g_pathTo7zipBin = finalPath;
  return g_pathTo7zipBin;
}

// NOTE: I use node-7z for ZIP/7Z as before but native 'spawn' + '-slt' for
// RARs to fix crashing on my 2GB+ test rar

exports.get7ZipEntriesList = async function (filePath, password, archiveType) {
  try {
    const { spawn } = require("node:child_process");
    const Seven = require("node-7z");
    checkPathTo7ZipBin();
    // ZIP, 7Z
    if (archiveType !== "rar") {
      const pass = password === undefined || password === "" ? "_" : password;
      const seven = Seven.list(filePath, {
        $bin: g_pathTo7zipBin,
        charset: "UTF-8",
        password: pass,
        archiveType,
      });

      let imgEntries = [];
      let comicInfoIds = [];
      let promise = await new Promise((resolve) => {
        seven.on("data", (data) => {
          if (data && data.file) {
            if (fileUtils.hasImageExtension(data.file))
              imgEntries.push(data.file);
            else if (data.file.toLowerCase().endsWith("comicinfo.xml"))
              comicInfoIds.push(data.file);
          }
        });
        seven.on("error", (error) => resolve({ success: false, data: error }));
        seven.on("end", () => resolve({ success: true }));
      });

      if (promise.success) {
        return {
          result: "success",
          paths: imgEntries,
          metadata: {
            encrypted: pass !== "_",
            comicInfoId: comicInfoIds[0] || undefined,
          },
        };
      } else {
        if (promise.data.toString().toLowerCase().includes("password"))
          return { result: "password required", paths: [] };
        throw promise.data;
      }
    }

    // RAR
    let args = ["l", filePath, "-slt", "-sccUTF-8", "-mmt=off"];
    if (password && password !== "" && password !== "_") {
      args.push("-p" + password);
    } else {
      args.push("-p");
    }

    return await new Promise((resolve) => {
      const child = spawn(g_pathTo7zipBin, args);
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
    const { execFile } = require("node:child_process");
    const fs = require("fs");
    const path = require("path");
    checkPathTo7ZipBin();

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
      execFile(
        g_pathTo7zipBin,
        args,
        { maxBuffer: 1024 * 1024 * 10 },
        (error, stdout, stderr) => {
          const output = (stdout || "") + (stderr || "").toLowerCase();
          if (
            error &&
            (output.includes("password") ||
              output.includes("encrypted") ||
              output.includes("wrong password"))
          ) {
            return reject("password required");
          }
          resolve();
        },
      );
    });

    const fullPath = path.join(tempSubFolderPath, path.basename(entryName));
    const buffer = fs.readFileSync(fullPath);
    return { success: true, data: buffer };
  } catch (error) {
    if (error === "password required")
      return { success: false, data: "password required" };
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
    const Seven = require("node-7z");
    const path = require("path");
    checkPathTo7ZipBin();

    const absPath = path.resolve(filePath);
    const pass = password === undefined || password === "" ? "_" : password;

    if (archiveType === "rar") {
      // 'x' to ensure inner folders are kept
      let args = ["x", absPath, `-o${tempFolderPath}`, "-y"];

      if (pass !== "_") {
        args.push("-p" + pass);
      } else {
        // trigger password error if encrypted
        args.push("-p-");
      }

      return await new Promise((resolve) => {
        g_active7zProcess = spawn(g_pathTo7zipBin, args);

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
            if (errStr.includes("password") || errStr.includes("encrypted")) {
              errorResult = "password required";
            } else if (
              errStr.includes("e_fail") ||
              errStr.includes("no space")
            ) {
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
    } else {
      // ZIP, 7Z
      const seven = Seven.extractFull(absPath, tempFolderPath, {
        $bin: g_pathTo7zipBin,
        charset: "UTF-8",
        password: pass,
        archiveType: archiveType,
      });

      g_active7zProcess = seven;

      let promise = await new Promise((resolve) => {
        seven.on("error", (error) => {
          g_active7zProcess = null;
          resolve({ success: false, data: error });
        });
        seven.on("end", () => {
          g_active7zProcess = null;
          resolve({ success: true });
        });
      });

      if (promise.success === true) return { success: true };
      else {
        let error = promise.data;
        if (error.message && error.message.includes("E_FAIL"))
          error = "no_disk_space";
        if (error.toString().toLowerCase().includes("password"))
          error = "password required";
        return { success: false, error: error };
      }
    }
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
    checkPathTo7ZipBin();
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
    const args = [
      "a",
      "-aoa",
      path.resolve(outputFilePath),
      `@${listFileName}`,
    ];
    if (password && password.trim() !== "") {
      args.push(`-p${password}`);
    }
    if (archiveType === "zip") {
      args.push("-tzip");
      args.push("-mcu=on"); // force UTF-8 for filenames inside
    }
    args.push("-scsUTF-8"); // tell 7z the list file is UTF-8

    const sevenZipProcess = spawn(path.resolve(g_pathTo7zipBin), args, {
      cwd: tempFolderPath,
      windowsHide: true,
    });

    let stderrData = "";
    // let stdoutData = "";
    sevenZipProcess.stderr.on(
      "data",
      (data) => (stderrData += data.toString()),
    );
    // sevenZipProcess.stdout.on(
    //   "data",
    //   (data) => (stdoutData += data.toString()),
    // );

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
    checkPathTo7ZipBin();
    const Seven = require("node-7z");

    // Doesn't work, saves everything at the root, internal folders are ignored
    // {
    //   let options = {
    //     $bin: g_pathTo7zipBin,
    //     charset: "UTF-8",
    //     password: password,
    //     workingDir: contentFolderPath,
    //   };
    //   if (archiveType && archiveType === "zip") {
    //     options.archiveType = archiveType;
    //   }

    //   seven = Seven.add(filePath, entryName, options);
    // }

    let options = {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8",
    };
    if (password && password.trim() !== "") {
      options.password = password;
    }
    if (archiveType && archiveType === "zip") {
      options.archiveType = archiveType;
    }
    const seven = Seven.add(filePath, contentFolderPath + "/*", options);

    let promise = await new Promise((resolve) => {
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: "",
        });
      });
    });

    if (promise.success === true) {
      return true;
    }
    throw promise.data;
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
    checkPathTo7ZipBin();
    const Seven = require("node-7z");
    let options = {
      $bin: g_pathTo7zipBin,
      charset: "UTF-8",
      password: password,
    };
    options.archiveType = "zip";
    const seven = Seven.test(filePath, options);
    let opfEntries;
    let promise = await new Promise((resolve) => {
      opfEntries = [];
      seven.on("data", function (data) {
        if (data.file.toLowerCase().endsWith(".opf")) {
          opfEntries.push(data.file);
        }
      });
      seven.on("error", (error) => {
        resolve({ success: false, data: error });
      });
      seven.on("end", () => {
        return resolve({
          success: true,
          data: opfEntries,
        });
      });
    });

    if (promise.success === true) {
      return opfEntries;
    } else {
      throw promise.data;
    }
  } catch (error) {
    log.error(error);
    return undefined;
  }
};
