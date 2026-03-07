/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");
const path = require("node:path");

const log = require("../../../shared/main/logger");

function srtTimeToSeconds(timeString) {
  if (!timeString) return 0;
  const [hours, minutes, rest] = timeString.split(":");
  const [seconds, milliseconds] = rest.split(/[,\.]/);
  return (
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10) +
    parseInt(milliseconds, 10) / 1000
  );
}

exports.parseSRT = function (data) {
  if (!data) return [];

  const blocks = data
    .trim()
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/);

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const timeLine = lines.find((l) => /-->/.test(l));
      if (!timeLine) return null;

      // allow decimal and comma separators, and varied spacing in the arrow
      const timeMatch = timeLine.match(
        /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/,
      );

      if (!timeMatch) return null;

      const timeIndex = lines.indexOf(timeLine);
      const text = lines
        .slice(timeIndex + 1)
        .join("\n")
        .trim();

      return {
        start: srtTimeToSeconds(timeMatch[1]),
        end: srtTimeToSeconds(timeMatch[2]),
        text: text,
      };
    })
    .filter(Boolean);
};

exports.loadExternalSRT = function (filePath) {
  try {
    if (path.extname(filePath).toLowerCase() !== ".srt") {
      return [];
    }

    const fd = fs.openSync(filePath, "r");
    const initialBuffer = Buffer.alloc(1024);
    fs.readSync(fd, initialBuffer, 0, 1024, 0);
    fs.closeSync(fd);

    // binary file test, check for null bytes
    // NOTE: may fail with utf-16... for now utf-8 and ascii only are loaded then
    if (initialBuffer.includes(0)) {
      log.test("binary!!!!");
      return [];
    }

    const rawData = fs.readFileSync(filePath, "utf8");

    // quick structure test
    const timeMatchRegex =
      /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/;
    if (!timeMatchRegex.test(rawData.slice(0, 2000))) {
      log.test("SRT structure not found !!!!");
      return [];
    }

    return exports.parseSRT(rawData);
  } catch (error) {
    log.debug("[subtitles] failed to read external SRT file:", error);
    return [];
  }
};
