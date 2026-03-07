/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("node:fs");

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
    const rawData = fs.readFileSync(filePath, "utf8");
    return exports.parseSRT(rawData);
  } catch (error) {
    console.error("[subtitles] failed to read external SRT file:", error);
    return [];
  }
};
