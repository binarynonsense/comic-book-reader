/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");

// this tool checks for minor/patch updates within the same major version

function checkPackagePatches() {
  const json = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const dependencies = {
    ...json.dependencies,
    ...json.devDependencies,
  };

  console.log("available updates for the current major version:\n");

  for (const [packageName, currentVersion] of Object.entries(dependencies)) {
    try {
      // get the current version without symbols (e.g., "^1.2.3" -> "1.2.3")
      // and the major version number
      const cleanCurrentVersion = currentVersion.replace(/[\^~]/g, "");
      const majorVersion = cleanCurrentVersion.split(".")[0];
      if (!majorVersion) continue;

      // get the latest version available for the major version
      const npmViewOutput = execSync(
        `npm view "${packageName}@^${majorVersion}" version --json`,
        {
          stdio: ["pipe", "pipe", "ignore"],
        },
      )
        .toString()
        .trim();

      if (!npmViewOutput) continue;

      const parsedOutput = JSON.parse(npmViewOutput);

      // if array, the last one is the newest
      const latestVersion = Array.isArray(parsedOutput)
        ? parsedOutput[parsedOutput.length - 1]
        : parsedOutput;

      // compare them to see if there's a newer one
      if (latestVersion && cleanCurrentVersion !== latestVersion) {
        console.log(
          `[UPDATE] ${packageName}: ${currentVersion} -> ${latestVersion}`,
        );
      }
      console.log("\ndone");
    } catch (error) {
      console.log("failed:");
      console.log(error);
    }
  }
}

checkPackagePatches();
