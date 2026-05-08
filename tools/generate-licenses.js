/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// tool to replace license-checker

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

try {
  // get package list info
  const rawJson = execSync("npm list --all --long --json", {
    maxBuffer: 1024 * 1024 * 50,
  }).toString();
  const data = JSON.parse(rawJson);
  // recursively walk the tree to find all unique packages
  const packages = new Map();
  const getPackages = (obj) => {
    const dependencies = obj.dependencies;
    if (!dependencies) return;
    for (const name in dependencies) {
      const info = dependencies[name];
      const id = `${name}@${info.version || "0.0.0"}`;
      if (!packages.has(id)) {
        // it's not already in packages
        packages.set(id, info);
        getPackages(info);
      }
    }
  };
  getPackages(data);
  // extract package metadata from its local package.json
  const outputText = [...packages.keys()]
    .sort()
    .map((id) => {
      const info = packages.get(id);
      let meta = {};
      try {
        if (info.path) {
          const jsonPath = path.join(info.path, "package.json");
          meta = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        }
      } catch (error) {
        // no package.json found?
      }
      let license =
        info.license ||
        meta.license ||
        (Array.isArray(meta.licenses)
          ? meta.licenses[0]?.type
          : meta.licenses?.type);
      if (!license || license === "Unknown") {
        // look inside for a license file if no license info was found
        try {
          const files = fs.readdirSync(info.path);
          const licenseFile = files.find((file) =>
            /^LICENSE|LICENCE|COPYING/i.test(file),
          );
          if (licenseFile) {
            const content = fs.readFileSync(
              path.join(info.path, licenseFile),
              "utf8",
            );
            if (content.includes("MIT License")) license = "MIT*";
            else if (content.includes("Apache License")) license = "Apache*";
            else if (content.includes("GNU")) license = "GPL*";
            else license = "See LICENSE file*"; // other type
          }
        } catch (error) {
          license = "Unknown";
        }
      }
      // get publisher and email from repo
      const repo = meta.repository?.url || meta.repository || "N/A";
      let publisher = "N/A";
      let email = "N/A";
      const author = meta.author;
      if (typeof author === "string") {
        const match = author.match(/^([^<]+)(?:\s+<([^>]+)>)?/);
        if (match) {
          publisher = match[1].trim();
          email = match[2] || "N/A";
        }
      } else if (author) {
        publisher = author.name || "N/A";
        email = author.email || "N/A";
      }

      ///////////////////////////////////////

      if (license === "Unknown" && publisher === "N/A" && repo === "N/A") {
        return null;
      }
      return [
        id,
        `  license: ${license}`,
        `  repository: ${repo}`,
        `  publisher: ${publisher}`,
        `  email: ${email}`,
      ].join("\n");
    })
    .filter(Boolean) // filter "null" entries
    .join("\n");

  const outputPath = path.join(__dirname, "../licenses/node_modules.txt");
  fs.writeFileSync(outputPath, outputText);
  console.log(`generated license list: ${outputPath}`);
} catch (error) {
  console.error("error generating license list:", error.message);
  process.exit(1);
}
