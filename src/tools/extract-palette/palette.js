/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const utils = require("./color-utils");

exports.getPaletteFromCanvasData = function (
  canvasColorData,
  distanceMethod,
  distanceThreshold,
  maxQuantizationDepth
) {
  try {
    const rgbColors = getRgbColorsFromCanvasData(canvasColorData);
    const quantizedColors = getQuantizedColors(
      rgbColors,
      0,
      maxQuantizationDepth
    );
    const orderedByColor = utils.getColorsSortedByLuminance(quantizedColors);
    let palette = { rgbColors: [], hexColors: [] };

    for (let i = 0; i < orderedByColor.length; i++) {
      const rgbColor = orderedByColor[i];
      const hexColor = utils.getHexStringFromColor(rgbColor);
      if (i > 0) {
        if (distanceMethod === "euclidean") {
          const difference = utils.getColorDifferenceEuclidean(
            orderedByColor[i],
            orderedByColor[i - 1]
          );
          if (difference < distanceThreshold) {
            // default: 120
            continue;
          }
        } else {
          const difference = utils.getColorDifferenceDeltaE(
            orderedByColor[i],
            orderedByColor[i - 1]
          );
          // ref: http://zschuessler.github.io/DeltaE/learn/
          // 1 - 2 = perceptible through close observation
          // 2 - 10 = perceptible at a glance
          // 11 - 49 = colors are more similar than opposite
          if (difference <= distanceThreshold) {
            // default: 2
            continue;
          }
        }
      }
      palette.rgbColors.push(rgbColor);
      palette.hexColors.push(hexColor);
    }
    return palette;
  } catch (error) {
    return undefined;
  }
};

// ref: https://dev.to/producthackers/creating-a-color-palette-with-javascript-44ip

const getRgbColorsFromCanvasData = (canvasColorData) => {
  const rgbColors = [];
  // r, g, b, a
  for (let i = 0; i < canvasColorData.length; i += 4) {
    const rgb = {
      r: canvasColorData[i],
      g: canvasColorData[i + 1],
      b: canvasColorData[i + 2],
    };

    rgbColors.push(rgb);
  }
  return rgbColors;
};

const getQuantizedColors = (rgbColors, depth, maxDepth = 4) => {
  // ref: https://en.wikipedia.org/wiki/Median_cut
  if (depth === maxDepth || rgbColors.length === 0) {
    const color = rgbColors.reduce(
      (previous, current) => {
        previous.r += current.r;
        previous.g += current.g;
        previous.b += current.b;
        return previous;
      },
      {
        r: 0,
        g: 0,
        b: 0,
      }
    );
    color.r = Math.round(color.r / rgbColors.length);
    color.g = Math.round(color.g / rgbColors.length);
    color.b = Math.round(color.b / rgbColors.length);
    return [color];
  }

  const componentToSortBy = utils.getBiggestColorRangeChannel(rgbColors);
  rgbColors.sort((color1, color2) => {
    return color1[componentToSortBy] - color2[componentToSortBy];
  });

  const mid = rgbColors.length / 2;
  return [
    ...getQuantizedColors(rgbColors.slice(0, mid), depth + 1, maxDepth),
    ...getQuantizedColors(rgbColors.slice(mid + 1), depth + 1, maxDepth),
  ];
};
