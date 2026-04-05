/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

///////////////////////////////////////////////////////////////////////////////
// ENV CLEAN UP ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.setSafeEnvironment = function (logHeader, send) {
  const safeEnv = getSafeEnv(process.env);
  for (const key in process.env) {
    delete process.env[key];
  }
  Object.assign(process.env, safeEnv);

  // wrap spawn
  const cp = require("node:child_process");
  const originalSpawn = cp.spawn;
  cp.spawn = function (command, args, options) {
    const message = `${logHeader}[spawn WRAPPER] spawn called for ${command} ${args ? args.join(" ") : ""}`;
    if (send) {
      send({
        type: "editorLog",
        log: message,
      });
    } else {
      const log = require("./logger");
      log.editor(message);
    }
    let finalArgs = args;
    let finalOptions = options;
    // handle optional args if only 2 params are passed
    if (!finalOptions && !Array.isArray(finalArgs)) {
      finalOptions = finalArgs;
      finalArgs = [];
    }
    // create a copy of options so we don't modify the library's original object
    const opts = finalOptions ? Object.assign({}, finalOptions) : {};
    const rawEnv = opts.env || process.env;
    // log bad entry
    for (const key in rawEnv) {
      if (typeof key === "string" && typeof rawEnv[key] === "string") {
        if (key.includes("\0") || rawEnv[key].includes("\0")) {
          const message = `${logHeader}[spawn WRAPPER] null byte found in: ${key.replace(/\0/g, "[NULL]")}`;
          if (send) {
            send({
              type: "debugLog",
              log: message,
            });
          } else {
            const log = require("./logger");
            log.debug(message);
          }
        }
      }
    }
    // sanitize
    opts.env = getSafeEnv(rawEnv);
    return originalSpawn.call(this, command, finalArgs, opts);
  };

  // wrap execFileSync
  const originalExecFileSync = cp.execFileSync;
  cp.execFileSync = function (command, args, options) {
    const message = `${logHeader}[execFileSync WRAPPER] called for ${command}`;
    if (send) {
      send({
        type: "editorLog",
        log: message,
      });
    } else {
      const log = require("./logger");
      log.editor(message);
    }
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
};

function getSafeEnv(env = process.env) {
  // sanitize the environment by removing binary null bytes (\0)
  // from all keys and values. this prevents a bug a user had
  let safeEnv = Object.fromEntries(
    Object.entries(env)
      .filter(
        ([key, value]) => typeof key === "string" && typeof value === "string",
      )
      .map(([key, value]) => [
        key.replace(/\0/g, ""),
        value.replace(/\0/g, ""),
      ]),
  );
  safeEnv["acbrenv"] = "cleaned";
  return safeEnv;
}
exports.getSafeEnv = getSafeEnv;

//////////////////////////////////////////////////////////////////////////////
// UNHANDLED /////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.setGlobalErrorHandlers = function () {
  process.on("unhandledRejection", (reason, promise) => {
    console.error(
      "critical: unhandled rejection at:",
      promise,
      "reason:",
      reason,
    );
  });

  process.on("uncaughtException", (error) => {
    const { app, dialog, clipboard } = require("electron");
    // TODO: localize buttons and title
    const stackTrace = error.stack || error.toString();
    if (app.isReady()) {
      const clickedIndex = dialog.showMessageBoxSync({
        type: "error",
        title: "Critical Main Process Error",
        message: "A fatal error occurred in the Main process.",
        detail: stackTrace,
        buttons: ["Copy Error & Close", "Close App"],
        defaultId: 0, // enter
        cancelId: 1, // esc
      });
      if (clickedIndex === 0) {
        clipboard.writeText(stackTrace);
      }
    } else {
      dialog.showErrorBox("Startup Error", error.stack || error.toString());
    }
    app.quit();
  });
};
