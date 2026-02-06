/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

///////////////////////////////////////////////////////////////////////////////
// ENV CLEAN UP ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// sanitize the environment by removing binary null bytes (\0)
// from all keys and values. this prevents a bug a user had

function getSafeEnv(env = process.env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(
        ([key, value]) => typeof key === "string" && typeof value === "string",
      )
      .map(([key, value]) => [
        key.replace(/\0/g, ""),
        value.replace(/\0/g, ""),
      ]),
  );
}

const safeEnv = getSafeEnv(process.env);
for (const key in process.env) {
  delete process.env[key];
}
Object.assign(process.env, safeEnv);

// wrap spawn as a failsafe for node-7z
const cp = require("child_process");
const originalSpawn = cp.spawn;
cp.spawn = function (command, args, options) {
  send({
    type: "editorLog",
    log: `[page worker] [spawn wrapper] spawn called`,
  });
  // create a copy of options so we don't modify the library's original object
  const opts = options ? Object.assign({}, options) : {};
  const rawEnv = opts.env || process.env;
  // log bad entry
  for (const key in rawEnv) {
    if (typeof key === "string" && typeof rawEnv[key] === "string") {
      if (key.includes("\0") || rawEnv[key].includes("\0")) {
        send({
          type: "debugLog",
          log: `[page worker] [spawn wrapper] null byte found in: ${key.replace(/\0/g, "[NULL]")}`,
        });
      }
    }
  }
  // sanitize
  opts.env = getSafeEnv(rawEnv);
  return originalSpawn.call(this, command, args, opts);
};

// wrap execFileSync for the rar exe calls
const originalExecFileSync = cp.execFileSync;
cp.execFileSync = function (command, args, options) {
  send({
    type: "editorLog",
    log: `[page worker] [execFileSync wrapper] called for ${command}`,
  });
  let finalArgs = args;
  let finalOptions = options;
  // handle optional args: if only 2 params are passed, args is actually the
  // options object in execFileSync
  if (!finalOptions && !Array.isArray(finalArgs)) {
    finalOptions = finalArgs;
    finalArgs = undefined;
  }
  const opts = finalOptions ? Object.assign({}, finalOptions) : {};
  opts.env = getSafeEnv(opts.env || process.env);
  return originalExecFileSync.call(this, command, finalArgs, opts);
};

///////////////////////////////////////////////////////////////////////////////
// WORKER /////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const fs = require("node:fs");
const path = require("node:path");
const fileFormats = require("../shared/main/file-formats");
const { FileDataType } = require("../shared/main/constants");
const fileUtils = require("../shared/main/file-utils");

process.parentPort.on("message", async (event) => {
  let message = event.data;
  // process.parentPort.postMessage({
  //   type: "testLog",
  //   log: `[page worker] message received: ${message.command}`,
  // });
  if (message.command === "extract") {
    const entryNames = message.entryNames;
    let images = [];
    let tempSubFolderPath = message.tempSubFolderPath;
    for (let i = 0; i < entryNames.length; i++) {
      message.entryNameIndex = i;
      const result = await extractImageBuffer(message);
      if (result.success === false) {
        process.parentPort.postMessage({
          type: "extractResult",
          success: false,
          error: result.error,
          tempSubFolderPath,
        });
        return;
      }
      images.push({ buffer: result.buffer, mime: result.mime });
    }
    process.parentPort.postMessage({
      type: "extractResult",
      success: true,
      images,
      tempSubFolderPath,
      scrollBarPos: message.scrollBarPos,
    });
  } else if (message.command === "open") {
    if (message.fileType === FileDataType.PDF) {
      const result = await fileFormats.openPdf(
        message.filePath,
        message.password,
      );
      message.type = "openResult";
      message.result = result;
      process.parentPort.postMessage(message);
    }
  }
});

async function extractImageBuffer({
  entryNameIndex,
  fileType,
  filePath,
  entryNames,
  scrollBarPos,
  password,
  tempSubFolderPath,
  extraData,
}) {
  try {
    let buffer;
    let mime;
    let error;
    if (fileType === FileDataType.ZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
        password,
        tempSubFolderPath,
        "zip",
      );
      if (result.success) {
        buffer = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.RAR) {
      buffer = await fileFormats.extractRarEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
        password,
        tempSubFolderPath,
      );
    } else if (fileType === FileDataType.SEVENZIP) {
      const result = await fileFormats.extract7ZipEntryBuffer(
        filePath,
        entryNames[entryNameIndex],
        password,
        tempSubFolderPath,
      );
      if (result.success) {
        buffer = result.data;
      } else {
        error = result.data;
      }
    } else if (fileType === FileDataType.EPUB_COMIC) {
      const data = await fileFormats.extractEpubImageBuffer(
        filePath,
        entryNames[entryNameIndex],
      );
      buffer = data[0];
    } else if (fileType === FileDataType.IMGS_FOLDER) {
      // if (!path.isAbsolute(entryName)) {
      //   // FIXME: make it absolute somehow?
      // }
      const fullPath = path.join(filePath, entryNames[entryNameIndex]);
      buffer = fs.readFileSync(fullPath);
    } else if (fileType === FileDataType.PDF) {
      buffer = await fileFormats.extractPdfPageBuffer(
        filePath,
        entryNames[entryNameIndex], // = page number
        extraData?.dpi,
      );
    } else {
      //  TODO: handle error file type not valid
    }
    if (buffer) {
      mime = fileUtils.getFileTypeFromBuffer(buffer, true);
      return { success: true, buffer, mime, scrollBarPos };
    } else {
      if (error) {
        throw error;
      } else throw "empty buffer";
    }
  } catch (error) {
    return { success: false, error };
  }
}

function send(message) {
  process.parentPort.postMessage(message);
}
