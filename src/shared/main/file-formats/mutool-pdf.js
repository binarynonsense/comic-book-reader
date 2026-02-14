/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const path = require("node:path");
const fs = require("node:fs");

///////////////////////////////////////////////////////////////////////////////
// MUPDF: PDF /////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function getPdfBinPath() {
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

/////////////////////////

// NOTE: saving to jpg with mupdf was sloooooooowwwww, and I had to modify
// the source to even do it. Discarded it and now combine getting a pam raw file
// from mupdf with saving it with sharp, plus concurrency and buffer
// communication between them, to achieve a really good speed in some of
// these functions

exports.openMuPdf = async function (filePath, password = "") {
  const { spawn } = require("node:child_process");

  const result = await new Promise((resolve) => {
    const binPath = getPdfBinPath();
    const args = ["info"];
    if (password) args.push("-p", password);
    args.push(filePath);

    // shell: true to handle spaces in paths on windows
    const child = spawn(binPath, args, { shell: process.platform === "win32" });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("error", (err) => {
      resolve({ error: "spawn failed", stderr: err.message });
    });

    child.on("close", (code) => {
      if (code === 0) {
        const match = stdout.match(/Pages:\s+(\d+)/i);
        resolve({ numPages: match ? parseInt(match[1], 10) : 0 });
      } else {
        const error = (stderr || stdout).toLowerCase();
        if (error.includes("password") || error.includes("authenticate")) {
          resolve({ error: "password required" });
        } else {
          resolve({ error: "open failed", stderr: error });
        }
      }
    });
  });

  return result.error
    ? { success: false, error: result.error, stderr: result.stderr }
    : { success: true, numPages: result.numPages };
};

/////////////////////////

exports.extractMuPdfPageBuffer = async function (
  filePath,
  pageIndex,
  password = "",
  dpi = 300,
  maxDim = 4500,
  format = "jpg",
) {
  const { spawn } = require("node:child_process");
  const sharp = require("sharp");

  return new Promise((resolve) => {
    const args = [
      "draw",
      "-q",
      "-F",
      "pam",
      "-c",
      "rgb",
      "-o",
      "-",
      "-p",
      password || "",
      "-r",
      dpi.toString(),
      "-w",
      maxDim.toString(),
      "-h",
      maxDim.toString(),
      filePath,
      pageIndex.toString(),
    ];

    const child = spawn(getPdfBinPath(), args);

    let stdoutChunks = [];
    let stderr = "";

    child.stdout.on("data", (data) => stdoutChunks.push(data));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("error", (err) => {
      resolve({ success: false, data: "spawn failed", stderr: err.message });
    });

    child.on("close", async (code) => {
      // do something similar to what i do in the extractmupdf one
      if (code === 0) {
        // join all binary chunks into a single raw PAM buffer
        const fullBuffer = Buffer.concat(stdoutChunks);
        const endHeaderIndex = fullBuffer.indexOf("ENDHDR\n");
        if (endHeaderIndex === -1) {
          return resolve({
            success: false,
            data: "invalid PAM header",
            stderr,
          });
        }
        const headerString = fullBuffer
          .slice(0, endHeaderIndex)
          .toString("ascii");
        const wMatch = headerString.match(/WIDTH\s+(\d+)/);
        const hMatch = headerString.match(/HEIGHT\s+(\d+)/);
        if (!wMatch || !hMatch) {
          return resolve({
            success: false,
            data: "simensions not found",
            stderr,
          });
        }
        try {
          const processedBuffer = await sharp(
            fullBuffer.slice(endHeaderIndex + 7),
            {
              raw: {
                width: parseInt(wMatch[1], 10),
                height: parseInt(hMatch[1], 10),
                channels: 3,
              },
            },
          )
            // .withMetadata({ density: dpi })
            .toFormat(format === "png" ? "png" : "jpeg", { quality: 80 })
            .toBuffer();

          resolve({ success: true, data: processedBuffer });
        } catch (error) {
          resolve({
            success: false,
            data: "sharp processing failed",
            stderr: error.message,
          });
        }
      } else {
        const error = stderr.toLowerCase();
        const errorMsg =
          error.includes("password") || error.includes("authenticate")
            ? "password required"
            : "extraction failed";

        resolve({ success: false, data: errorMsg, stderr: stderr });
      }
    });
  });
};

////////////////////////

let g_activeTasks = new Set();
let g_isCancelled = false;

function stopMuPdfExtraction() {
  g_isCancelled = true;
  if (g_activeTasks.size > 0) {
    g_activeTasks.forEach((task) => {
      // ignore processes that might have already closed
      try {
        task.kill("SIGKILL");
      } catch (e) {}
    });
    g_activeTasks.clear();
    return true;
  }
  return false;
}
exports.stopMuPdfExtraction = stopMuPdfExtraction;

exports.extractMuPdf = async function (
  filePath,
  tempFolderPath,
  password = "",
  extraData,
  send,
) {
  const { spawn } = require("node:child_process");
  const sharp = require("sharp");

  g_isCancelled = false;

  try {
    const openInfo = await exports.openMuPdf(filePath, password);
    if (!openInfo.success) return { success: false, error: openInfo.error };
    const totalPages = openInfo.numPages;
    const padWidth = totalPages.toString().length;
    let completedCount = 0;

    const CONCURRENCY = 4;
    const targetDpi = parseInt(extraData.dpi) || 300;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    const processPage = async (pageNum) => {
      if (g_isCancelled) return;

      const paddedName = pageNum.toString().padStart(padWidth, "0");
      const outputPath = path.join(tempFolderPath, `${paddedName}.jpg`);

      try {
        await new Promise((resolve, reject) => {
          // -q = quiet mode. Blocks text logs from corrupting the binary stdout.
          // -F 'pam' = portable arbitrary map -> raw pixels + header
          // -c 'rgb' = forces 3-channel (24-bit) output to save RAM
          // -o - = redirects the pixel data to stdout for streaming to node
          // -r = dpi
          // -w/-h = cap
          // NOTE: the order is important!
          const args = ["draw", "-q", "-F", "pam", "-c", "rgb", "-o", "-"];
          if (password && password.trim() !== "") {
            args.push("-p", password);
          }
          args.push("-r", targetDpi.toString(), "-w", "4500", "-h", "4500");
          args.push(filePath, pageNum.toString());

          const child = spawn(getPdfBinPath(), args);
          g_activeTasks.add(child); // Track this specific worker

          let headerBuffer = Buffer.alloc(0);
          let transformer = null;
          let stderrBuffer = Buffer.alloc(0);

          // drain stderr: prevent memory bloat on massive runs
          child.stderr.on("data", (data) => {
            stderrBuffer = Buffer.concat([stderrBuffer, data]);
            if (stderrBuffer.length > 16384)
              stderrBuffer = stderrBuffer.slice(-16384);
          });

          // process stdout / "pixel pipe"
          child.stdout.on("data", (chunk) => {
            // header sniffing
            // find the PAM text header (WIDTH/HEIGHT)
            if (!transformer) {
              headerBuffer = Buffer.concat([headerBuffer, chunk]);
              // "ENDHDR\n" is the standard marker in PAM format that separates
              // text from pixels
              const endHeaderIndex = headerBuffer.indexOf("ENDHDR\n");

              if (endHeaderIndex !== -1) {
                const headerString = headerBuffer
                  .slice(0, endHeaderIndex)
                  .toString("ascii");
                const wMatch = headerString.match(/WIDTH\s+(\d+)/);
                const hMatch = headerString.match(/HEIGHT\s+(\d+)/);

                if (wMatch && hMatch) {
                  const width = parseInt(wMatch[1], 10);
                  const height = parseInt(hMatch[1], 10);
                  // raw: read the naked RGB bytes from the buffer.
                  transformer = sharp({
                    raw: { width, height, channels: 3 },
                  })
                    .withMetadata({ density: targetDpi })
                    .jpeg({ quality: 80 });
                  // resolve only when sharp has finished writing
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

                  // slice the pixel data that arrived in the same chunk as the
                  // header text and add 7 to skip the length of "ENDHDR\n"
                  const pixelStart = headerBuffer.slice(endHeaderIndex + 7);
                  if (pixelStart.length > 0) transformer.write(pixelStart);
                }
              }
            } else {
              // feed binary chunks to sharp directly
              if (!transformer.write(chunk)) {
                // apply backpressure: pause mupdf if sharp's encoder is busy
                child.stdout.pause();
                transformer.once("drain", () => child.stdout.resume());
              }
            }
          });

          child.stdout.on("end", () => {
            if (transformer) transformer.end();
            else resolve();
          });

          child.on("error", (error) =>
            reject(new Error(`spawn error: ${error.message}`)),
          );
          child.on("close", (code) => {
            g_activeTasks.delete(child);
            if (code !== 0 && !g_isCancelled) {
              const errorMsg = stderrBuffer.toString().trim();
              reject(new Error(errorMsg || `MuPDF Exit ${code}`));
            }
          });
        });
      } catch (pageError) {
        if (!g_isCancelled) {
          // TODO: throw error further?
          send?.({
            type: "testLog",
            log: `error on page ${pageNum}: ${pageError.message}`,
          });
        }
      }
    };

    for (let i = 0; i < pages.length; i += CONCURRENCY) {
      if (g_isCancelled) break;
      const batch = pages.slice(i, i + CONCURRENCY);
      // wait for all files in the current batch to be done
      await Promise.all(batch.map((p) => processPage(p)));
    }

    return { success: !g_isCancelled, cancelled: g_isCancelled };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    stopMuPdfExtraction();
  }
};
