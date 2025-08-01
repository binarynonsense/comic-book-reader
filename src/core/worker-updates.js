/**
 * @license
 * Copyright 2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const log = require("../shared/main/logger");
const utils = require("../shared/main/utils");

process.on("message", async (message) => {
  try {
    log.init(message[0]);
    let currentVersion = message[1];

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
      process.send([true, latestVersion]);
    } else {
      process.send([false, latestVersion]);
    }
  } catch (error) {
    log.editorError(error);
    process.send([false]);
  }
});
