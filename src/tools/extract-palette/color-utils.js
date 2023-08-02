/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const deltaE = require("./delta-e");

// ref: https://dev.to/producthackers/creating-a-color-palette-with-javascript-44ip

exports.getColorsSortedByLuminance = (rgbColors) => {
  //ref: https://en.wikipedia.org/wiki/Luma_(video)
  const getColorLuminance = (color) => {
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  };

  return rgbColors.sort((color1, color2) => {
    return getColorLuminance(color2) - getColorLuminance(color1);
  });
};

exports.getHexStringFromColor = (rgbColor) => {
  const componentToHex = (c) => {
    const hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  };

  return (
    "#" +
    componentToHex(rgbColor.r) +
    componentToHex(rgbColor.g) +
    componentToHex(rgbColor.b)
  ).toUpperCase();
};

exports.getColorDifferenceDeltaE = (color1, color2) => {
  // ref: https://stackoverflow.com/questions/13586999/color-difference-similarity-between-two-values-with-js
  let lab1 = deltaE.rgb2lab([color1.r, color1.g, color1.b]);
  let lab2 = deltaE.rgb2lab([color2.r, color2.g, color2.b]);
  return deltaE.deltaE(lab1, lab2);
};

exports.getColorDifferenceEuclidean = (color1, color2) => {
  // ref: https://en.wikipedia.org/wiki/Euclidean_distance
  // orig ref (top) uses 120 as minimum dist
  const rDifference = Math.pow(color2.r - color1.r, 2);
  const gDifference = Math.pow(color2.g - color1.g, 2);
  const bDifference = Math.pow(color2.b - color1.b, 2);
  return rDifference + gDifference + bDifference;
};

exports.getBiggestColorRangeChannel = (rgbValues) => {
  let rMin = Number.MAX_VALUE;
  let gMin = Number.MAX_VALUE;
  let bMin = Number.MAX_VALUE;

  let rMax = Number.MIN_VALUE;
  let gMax = Number.MIN_VALUE;
  let bMax = Number.MIN_VALUE;

  rgbValues.forEach((pixel) => {
    rMin = Math.min(rMin, pixel.r);
    gMin = Math.min(gMin, pixel.g);
    bMin = Math.min(bMin, pixel.b);

    rMax = Math.max(rMax, pixel.r);
    gMax = Math.max(gMax, pixel.g);
    bMax = Math.max(bMax, pixel.b);
  });

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;

  const biggestRange = Math.max(rRange, gRange, bRange);
  if (biggestRange === rRange) {
    return "r";
  } else if (biggestRange === gRange) {
    return "g";
  } else {
    return "b";
  }
};
