/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");

///////////////////////////////////////////////////////////////////////////////
// MUPDF: EPUB / MOBI / AZW3 //////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: this is a conversion of what I do for PDFs, I have more comments there
// TODO: maybe I could combine them?

const { spawn } = require("node:child_process");
const sharp = require("sharp");

let g_activeTasks = new Set();
let g_isCancelled = false;

let g_defaultEpubConfig = {
  width: 800,
  height: 1100,
  margin: 40,
  fontSize: 22,
  dpi: 144,
};

function getMuToolBinPath() {
  const isWin = process.platform === "win32";
  const binName = isWin ? "mutool-win.exe" : "mutool";

  const isPackaged =
    process.resourcesPath && !process.resourcesPath.includes("node_modules");

  const binPath = isPackaged
    ? path.join(
        process.resourcesPath,
        "bin",
        "mupdf",
        isWin ? "win" : "linux",
        binName,
      )
    : path.join(
        __dirname,
        "../../../",
        "assets",
        "bin",
        "mupdf",
        isWin ? "win" : "linux",
        binName,
      );

  if (!isWin && fs.existsSync(binPath)) {
    try {
      fs.chmodSync(binPath, 0o755);
    } catch (error) {}
  }

  return binPath;
}

exports.stopMuEpubExtraction = function () {
  g_isCancelled = true;
  if (g_activeTasks.size > 0) {
    g_activeTasks.forEach((task) => {
      try {
        task.kill("SIGKILL");
      } catch (e) {}
    });
    g_activeTasks.clear();
    return true;
  }
  return false;
};

exports.openMuEpub = async function (filePath, tempSubFolderPath, config) {
  const binPath = getMuToolBinPath();
  const cssFilePath = path.join(
    tempSubFolderPath,
    `tmp_style_${Date.now()}.css`,
  );

  const width = config.customSize ? config.width : g_defaultEpubConfig.width;
  const height = config.customSize ? config.height : g_defaultEpubConfig.height;
  const fontSize = config.customSize
    ? config.fontSize
    : g_defaultEpubConfig.fontSize;

  try {
    fs.writeFileSync(cssFilePath, getCss(config));
  } catch (error) {
    return { success: false, error };
  }

  return new Promise((resolve) => {
    const args = [
      "draw",
      "-U",
      cssFilePath,
      "-F",
      "stext",
      "-W",
      width.toString(),
      "-H",
      height.toString(),
      "-S",
      fontSize.toString(),
      "-o",
      "-", // stream structured text (stext) to stdout
      filePath,
    ];

    const child = spawn(binPath, args, { shell: process.platform === "win32" });

    let numPages = 0;
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const content = chunk.toString();
      const matches = content.match(/<page/g);
      if (matches) {
        numPages += matches.length;
      }
    });

    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (code) => {
      if (fs.existsSync(cssFilePath)) {
        try {
          fs.unlinkSync(cssFilePath);
        } catch (error) {}
      }
      if (code === 0) {
        // hack: add +1 to numPages as some times one page is missing otherwise
        const finalCount = numPages > 0 ? numPages + 1 : 0;
        resolve({ success: true, numPages: finalCount });
      } else {
        resolve({ success: false, error: stderr });
      }
    });

    child.on("error", (error) => resolve({ success: false, error }));
  });
};

exports.extractMuEpubPageBuffer = async function (
  filePath,
  pageIndex,
  tempSubFolder,
  config,
  format = "jpg",
) {
  const binPath = getMuToolBinPath();

  return new Promise((resolve) => {
    let cssFilePath = null;
    const hasColors = config.customColors;
    const channels = hasColors ? 4 : 3;

    const args = [
      "draw",
      "-F",
      "pam",
      "-c",
      hasColors ? "rgba" : "rgb",
      "-W",
      config.customSize
        ? config.width.toString()
        : g_defaultEpubConfig.width.toString(),
      "-H",
      config.customSize
        ? config.height.toString()
        : g_defaultEpubConfig.height.toString(),
      "-S",
      config.customSize
        ? config.fontSize.toString()
        : g_defaultEpubConfig.fontSize.toString(),
      "-r",
      config.customSize
        ? config.dpi.toString()
        : g_defaultEpubConfig.dpi.toString(),
      "-o",
      "-",
      filePath,
      pageIndex.toString(),
    ];
    cssFilePath = path.join(tempSubFolder, `tmp_style_${Date.now()}.css`);
    try {
      fs.writeFileSync(cssFilePath, getCss(config));
      args.splice(1, 0, "-U", cssFilePath);
    } catch (error) {
      cssFilePath = null;
    }

    const child = spawn(binPath, args);
    let stdoutChunks = [];
    let stderr = "";

    child.stdout.on("data", (data) => stdoutChunks.push(data));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", async (code) => {
      if (cssFilePath && fs.existsSync(cssFilePath))
        try {
          fs.unlinkSync(cssFilePath);
        } catch (error) {}
      if (code === 0) {
        const fullBuffer = Buffer.concat(stdoutChunks);
        const endHeaderIndex = fullBuffer.indexOf("ENDHDR\n");
        if (endHeaderIndex === -1)
          return resolve({ success: false, data: "invalid PAM header" });

        const headerString = fullBuffer
          .slice(0, endHeaderIndex)
          .toString("ascii");
        const wMatch = headerString.match(/WIDTH\s+(\d+)/);
        const hMatch = headerString.match(/HEIGHT\s+(\d+)/);

        try {
          const processedBuffer = await sharp(
            fullBuffer.slice(endHeaderIndex + 7),
            {
              raw: {
                width: parseInt(wMatch[1], 10),
                height: parseInt(hMatch[1], 10),
                channels,
              },
            },
          )
            .toFormat(format === "png" ? "png" : "jpeg", { quality: 85 })
            .toBuffer();

          resolve({ success: true, data: processedBuffer });
        } catch (err) {
          resolve({
            success: false,
            data: "sharp failed",
            stderr: err.message,
          });
        }
      } else {
        resolve({ success: false, data: "extraction failed", stderr });
      }
    });
  });
};

exports.extractMuEpub = async function (
  filePath,
  tempFolderPath,
  config,
  send,
) {
  const binPath = getMuToolBinPath();
  g_isCancelled = false;

  try {
    const openInfo = await exports.openMuEpub(filePath);
    if (!openInfo.success) return { success: false, error: openInfo.error };

    const totalPages = openInfo.numPages;
    const padWidth = totalPages.toString().length;
    let completedCount = 0;
    const CONCURRENCY = 4;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    const hasColors = config.customColors;
    const channels = hasColors ? 4 : 3;

    let cssFilePath = null;
    cssFilePath = path.join(tempFolderPath, `tmp_style_${Date.now()}.css`);
    try {
      fs.writeFileSync(cssFilePath, getCss(config));
    } catch (error) {
      cssFilePath = null;
    }

    const processPage = async (pageNum) => {
      if (g_isCancelled) return;
      const paddedName = pageNum.toString().padStart(padWidth, "0");
      const outputPath = path.join(tempFolderPath, `${paddedName}.jpg`);

      await new Promise((resolve, reject) => {
        const args = [
          "draw",
          "-q",
          "-F",
          "pam",
          "-c",
          hasColors ? "rgba" : "rgb",
          "-W",
          config.customSize
            ? config.width.toString()
            : g_defaultEpubConfig.width.toString(),
          "-H",
          config.customSize
            ? config.height.toString()
            : g_defaultEpubConfig.height.toString(),
          "-S",
          config.customSize
            ? config.fontSize.toString()
            : g_defaultEpubConfig.fontSize.toString(),
          "-r",
          config.customSize
            ? config.dpi.toString()
            : g_defaultEpubConfig.dpi.toString(),
          "-o",
          "-",
        ];
        if (cssFilePath) args.splice(1, 0, "-U", cssFilePath);
        args.push(filePath, pageNum.toString());

        const child = spawn(binPath, args);
        g_activeTasks.add(child);

        let headerBuffer = Buffer.alloc(0);
        let transformer = null;

        child.stdout.on("data", (chunk) => {
          if (!transformer) {
            headerBuffer = Buffer.concat([headerBuffer, chunk]);
            const endHeaderIndex = headerBuffer.indexOf("ENDHDR\n");
            if (endHeaderIndex !== -1) {
              const headerString = headerBuffer
                .slice(0, endHeaderIndex)
                .toString("ascii");
              const wMatch = headerString.match(/WIDTH\s+(\d+)/);
              const hMatch = headerString.match(/HEIGHT\s+(\d+)/);

              if (wMatch && hMatch) {
                transformer = sharp({
                  raw: {
                    width: parseInt(wMatch[1], 10),
                    height: parseInt(hMatch[1], 10),
                    channels,
                  },
                }).jpeg({ quality: 80 });

                transformer
                  .toFile(outputPath)
                  .then(() => {
                    completedCount++;
                    send?.({
                      type: "extraction-progress",
                      current: completedCount,
                      total: totalPages,
                    });
                    resolve();
                  })
                  .catch(reject);

                const pixelStart = headerBuffer.slice(endHeaderIndex + 7);
                if (pixelStart.length > 0) transformer.write(pixelStart);
              }
            }
          } else {
            if (!transformer.write(chunk)) {
              child.stdout.pause();
              transformer.once("drain", () => child.stdout.resume());
            }
          }
        });

        child.stdout.on("end", () => {
          if (transformer) transformer.end();
          else resolve();
        });
        child.on("close", (code) => {
          g_activeTasks.delete(child);
          if (code !== 0 && !g_isCancelled) reject(new Error(`Exit ${code}`));
        });
      });
    };

    for (let i = 0; i < pages.length; i += CONCURRENCY) {
      if (g_isCancelled) break;
      const batch = pages.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((p) => processPage(p)));
    }

    if (cssFilePath && fs.existsSync(cssFilePath))
      try {
        fs.unlinkSync(cssFilePath);
      } catch (e) {}

    return { success: !g_isCancelled, cancelled: g_isCancelled };
  } catch (error) {
    return { success: false, error };
  } finally {
    exports.stopMuEpubExtraction();
  }
};

///////////////////

function getCss(config) {
  function getColors() {
    if (config.customColors) {
      return `background-color: ${config.colorBg} !important;
      color: ${config.colorText} !important;`;
    } else {
      return "";
    }
  }
  function getMargin() {
    if (config.customColors) {
      return `${config.margin}`;
    } else {
      return `${g_defaultEpubConfig.margin}`;
    }
  }
  // fix margins being too big in test gutenberg ebook epub v3
  let css = `
    :root, html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      width: 100% !important; 
      max-width: none !important;
    }g_fileData.p

    div, section, article, main {
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      max-width: none !important;
    }

    body { 
      padding: ${getMargin()}px !important; 
      box-sizing: border-box !important;
      ${getColors()}
    }

    img { 
      max-width: 100% !important; 
      height: auto !important; 
    }
  `;
  return css;
}
