/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { app, utilityProcess } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const log = require("./logger");

exports.getSafeEnv = function (env = process.env) {
  // sanitizes an environment object by removing binary null bytes (\0)
  // from all keys and values. this prevents a bug a user had that
  // made Electron's utilityProcess.fork break
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
};

exports.fork = function (scriptPath, config = {}) {
  const rawEnv = { ...(config?.options?.env || process.env) };
  try {
    const safeEnv = exports.getSafeEnv(rawEnv);
    const execArgv = config.options?.execArgv
      ? [...config.options.execArgv]
      : [];

    if (config?.exposeGC) execArgv.push("--js-flags=--expose-gc");

    if (config?.memoryLimit && config.memoryLimit > 0) {
      execArgv.push(`--max-old-space-size=${config.memoryLimit}`);
    }

    return utilityProcess.fork(scriptPath, {
      ...(config?.options || {}), // Safety for the spread
      env: safeEnv,
      execArgv: execArgv,
    });
  } catch (error) {
    const logPath = path.join(app.getPath("userData"), "acbr-fork-debug.log");
    const saveToFile = true;
    ////
    const errorMessage = error.message || "";
    const isNullError = errorMessage.toLowerCase().includes("null bytes");

    if (isNullError) {
      let logMessage = `--- NULL BYTE ERROR: ${new Date().toISOString()} ---\n`;
      logMessage += `ACBR Version: ${app.getVersion()}\n`;
      logMessage += `Error message: ${errorMessage}\n\n`;
      // '00' is the C-style null terminator byte.
      // Example from a bug report:
      // 'Console' in hex is '43 6f 6e 73 6f 6c 65'.
      // 'Console\0' appears as '43 6f 6e 73 6f 6c 65 00'.
      logMessage += `Hex Dump Analysis (Finding the '00' byte):\n`;

      for (const [key, value] of Object.entries(rawEnv)) {
        if (typeof value === "string") {
          const hexData = Buffer.from(value).toString("hex");
          if (hexData.includes("00")) {
            const hexFormatted = hexData.match(/.{1,2}/g)?.join(" ") || "";
            logMessage += `${key}: ${hexFormatted} <--- [!! FOUND !!]\n`;
          }
        }
      }

      if (saveToFile) {
        try {
          let shouldAppend = true;

          if (fs.existsSync(logPath)) {
            const stats = fs.statSync(logPath);
            if (stats.size > 1024 * 1024) shouldAppend = false;
          }

          if (shouldAppend) {
            fs.appendFileSync(
              logPath,
              logMessage + "\n" + "=".repeat(40) + "\n",
            );
          } else {
            fs.writeFileSync(
              logPath,
              "[LOG RESET - FILE TOO LARGE]\n" + logMessage + "\n",
            );
          }

          log.debug(`diagnostic log updated at: ${logPath}`);
        } catch (error) {
          log.error("log failed", error);
        }
      }
    }

    log.error(`utility process fork failed: ${errorMessage}`);
    throw error;
  }
};
