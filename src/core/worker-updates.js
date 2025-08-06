/**
 * @license
 * Copyright 2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const utils = require("../shared/main/utils");

let g_useUtilityProcess = false;

process.on("message", (message) => {
  g_useUtilityProcess = false;
  checkUpdate(message);
});

process.parentPort?.once("message", async (event) => {
  g_useUtilityProcess = true;
  checkUpdate(event.data);
});

async function checkUpdate(data) {
  try {
    let currentVersion = data[1];

    const axios = require("axios").default;
    const response = await axios.get(
      `https://api.github.com/repos/binarynonsense/comic-book-reader/releases/latest`,
      { timeout: 15000 }
    );

    let latestVersion = response.data.tag_name;
    if (!latestVersion) {
      throw "error version";
    }
    latestVersion = latestVersion.replace("v", "");

    const isOlder = utils.isVersionOlder(currentVersion, latestVersion);
    if (isOlder) {
      send([true, latestVersion]);
    } else {
      send([false, latestVersion]);
    }
  } catch (error) {
    // log.editorError(error);
    send([false]);
  }
}

function send(message) {
  if (g_useUtilityProcess) {
    process.parentPort.postMessage(message);
  } else {
    process.send(message);
  }
}
