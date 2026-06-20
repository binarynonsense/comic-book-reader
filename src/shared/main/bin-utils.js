/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");
const timers = require("./timers");
const log = require("./logger");

//////////////////////////////////////////////////////////////////////////////
// PATHS /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_7zBinPath;
exports.get7zBinPath = function () {
  if (g_7zBinPath !== undefined) return g_7zBinPath;
  const isWin = process.platform === "win32";
  const binName = isWin ? "7z.exe" : "7zz";
  g_7zBinPath = getDefaultBinPath("7zip", binName, isWin);
  if (!fs.existsSync(g_7zBinPath)) {
    log.error(`${binName} not found at: ${g_7zBinPath}`);
  }
  return g_7zBinPath;
};

let g_mutoolBinPath;
exports.getMutoolBinPath = function () {
  if (g_mutoolBinPath !== undefined) return g_mutoolBinPath;
  const isWin = process.platform === "win32";
  const binName = isWin ? "mutool-win.exe" : "mutool";
  g_mutoolBinPath = getDefaultBinPath("mupdf", binName, isWin);
  if (!fs.existsSync(g_mutoolBinPath)) {
    log.error(`${binName} not found at: ${g_mutoolBinPath}`);
  }
  return g_mutoolBinPath;
};

function getDefaultBinPath(folderName, binName, isWin) {
  const isPackaged =
    process.resourcesPath && !process.resourcesPath.includes("node_modules");
  const binPath = isPackaged
    ? path.join(
        process.resourcesPath,
        "bin",
        folderName,
        isWin ? "win" : "linux",
        binName,
      )
    : path.join(
        __dirname,
        "../../",
        "assets",
        "bin",
        folderName,
        isWin ? "win" : "linux",
        binName,
      );
  return binPath;
}

//////////////////////////////////////////////////////////////////////////////
// HASHES ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

const g_binFilesInfo = [
  {
    os: "linux",
    folderName: "7zip",
    binName: "7zz",
    hash: "eea104e8c832b1ed6c63875ed2f50bab80a36dacf8dd0490811058cf20bb2fc5",
  },
  {
    os: "linux",
    folderName: "mupdf",
    binName: "mutool",
    hash: "972b2520d4611e5806abff36e3ba8c41795bd4984bfbf0dac42cc1574538b5a9",
  },
  {
    os: "win",
    folderName: "7zip",
    binName: "7z.exe",
    hash: "2bff20bd679d45166b8c2d039044a4ca16189e6d69ff9c82345b4c1306986ec4",
  },
  {
    os: "win",
    folderName: "7zip",
    binName: "7z.dll",
    hash: "9657871fdd714c96a3a21f59abf04abb14944516c2a10c8cb606c12a71a75957",
  },
  {
    os: "win",
    folderName: "mupdf",
    binName: "mutool-win.exe",
    hash: "8b4b1f5ad90ab7b0189f9f1e77d72691eece7d498e12e35a67880b3bfd44ef5b",
  },
];

exports.checkBinHashes = function (launchInfo) {
  timers.start("hashes");
  const isWin = process.platform === "win32";
  const osName = isWin ? "win" : "linux";
  for (let index = 0; index < g_binFilesInfo.length; index++) {
    const file = g_binFilesInfo[index];
    if (file.os === osName) {
      const currentHash = getFileSHA256(
        getDefaultBinPath(file.folderName, file.binName, isWin),
      );
      const storedHash = file.hash;
      if (currentHash !== storedHash) {
        log.debug(`time to check hashes: ${timers.stop("hashes").toFixed(2)}s`);
        return {
          passed: false,
          errorInfo: `The included "${file.binName}" binary file has been modified or corrupted.`,
        };
      }
    }
  }
  log.debug(`time to check hashes: ${timers.stop("hashes").toFixed(2)}s`);
  return {
    passed: true,
  };
};

exports.printAllBinHashes = function () {
  const hashes = [];
  hashes.push({
    os: "linux",
    folderName: "7zip",
    binName: "7zz",
    hash: getFileSHA256(getDefaultBinPath("7zip", "7zz", false)),
  });
  hashes.push({
    os: "linux",
    folderName: "mupdf",
    binName: "mutool",
    hash: getFileSHA256(getDefaultBinPath("mupdf", "mutool", false)),
  });
  hashes.push({
    os: "win",
    folderName: "7zip",
    binName: "7z.exe",
    hash: getFileSHA256(getDefaultBinPath("7zip", "7z.exe", true)),
  });
  hashes.push({
    os: "win",
    folderName: "7zip",
    binName: "7z.dll",
    hash: getFileSHA256(getDefaultBinPath("7zip", "7z.dll", true)),
  });
  hashes.push({
    os: "win",
    folderName: "mupdf",
    binName: "mutool-win.exe",
    hash: getFileSHA256(getDefaultBinPath("mupdf", "mutool-win.exe", true)),
  });
  log.editor("hash list:");
  console.log(hashes);
};

function getFileSHA256(filePath) {
  const crypto = require("node:crypto");
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(fileBuffer).digest("hex");
  } catch (error) {
    return undefined;
  }
}
