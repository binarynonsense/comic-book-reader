/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fs = require("fs");

exports.createFile = function (filePath, palette, name) {
  try {
    // header
    let fileContents = `GIMP Palette\nName: ${name}\nColumns: 4\n`;
    // colors
    for (let index = 0; index < palette.rgbColors.length; index++) {
      const rgbColor = palette.rgbColors[index];
      const hexColor = palette.hexColors[index];
      // r, g, b, name
      fileContents += `${rgbColor.r} ${rgbColor.g}\ ${rgbColor.b}\t\t${hexColor}\n`;
    }
    fs.writeFileSync(filePath, fileContents, "utf-8");
    return true;
  } catch (error) {
    return false;
  }
};
