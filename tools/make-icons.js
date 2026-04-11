/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// @ts-nocheck

// Kubuntu 24.04:
// if needed:
// - sudo apt install imagemagick libmagickcore-6.q16-7-extra inkscape
// - put Komika Hand fonts in ~/.local/share/fonts/
// - refresh fonts: fc-cache -f -v

switch (process.argv[2]) {
  case "create":
    createIcons();
    break;
  case "copy":
    copyIcons();
    break;
  default:
    console.log("usage: npm run make-icons [create|copy]");
    process.exit(1);
}

function createIcons() {
  const { JSDOM } = require("jsdom");
  const fs = require("node:fs");
  const { execSync } = require("node:child_process");
  const path = require("node:path");

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.eve = require("eve");
  const Snap = require("snapsvg-cjs");

  function drawComicBubble(snap, config, size = 256, paddingMul = 0.1) {
    const center = size / 2;
    const padding = size * paddingMul;
    const radius = size / 2 - padding;

    let fillValue = config.bodyColor;
    if (config.gradientColors && config.gradientColors.length >= 2) {
      const c1 = config.gradientColors[0];
      const c2 = config.gradientColors[1];
      const stop =
        config.gradientStop !== undefined ? config.gradientStop : 100;
      fillValue = snap.gradient(
        `L(${center}, 0, ${center}, ${size})${c1}:0-${c2}:${stop}-${c2}:100`,
      );
    }

    const backgroundCircle = snap.circle(center, center, radius);
    if (config.isStroked) {
      backgroundCircle.attr({
        fill: "none",
        stroke: fillValue,
        strokeWidth: config.strokeWidth || size * 0.05,
      });
    } else {
      backgroundCircle.attr({ fill: fillValue });
    }

    // bubble (base design 256px)
    const scale = size / 256;
    const rx = config.rx || 65 * scale;
    const ry = config.ry || 48 * scale;
    // tail
    const tx = config.tx || 48 * scale;
    const ty = config.ty || 12 * scale;
    const baseLeftX = center + rx * 0.1;
    const baseRightX = center + rx * 0.7;
    const baseYLeft = center + ry * 0.8;
    const baseYRight = center + ry * 0.6;
    const tailPoints = [
      baseLeftX,
      baseYLeft,
      center + tx,
      center + ry + ty,
      baseRightX,
      baseYRight,
    ];

    // group bubble parts
    const bubbleEllipse = snap.ellipse(center, center, rx, ry);
    const bubbleTail = snap.polygon(tailPoints);
    const bubble = snap.group(bubbleEllipse, bubbleTail);

    // details
    if (config.isCutout) {
      const maskRect = snap.rect(0, 0, size, size).attr({ fill: "white" });
      bubble.attr({ fill: "black" });
      backgroundCircle.attr({ mask: snap.group(maskRect, bubble) });
    } else {
      bubble.attr({ fill: config.bubbleColor || "#FFFFFF" });
    }

    if (config.text) {
      const bubbleText = snap.text(center, center, config.text);
      bubbleText.attr({
        fill: config.textColor || "#000000",
        fontSize: config.fontSize || ry * 0.85,
        fontFamily: config.font || "sans-serif",
        textAnchor: "middle",
        dominantBaseline: "central",
      });
    }
  }

  function saveTrayIcons(drawingFunction, config, filename) {
    const size = 256;
    const snap = Snap(size, size);
    drawingFunction(snap, config, size);

    const assetsDir = path.join(__dirname, "./output/icons");
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const svgPath = path.join(assetsDir, `${filename}.svg`);
    fs.writeFileSync(svgPath, snap.toString());

    const pngSizes = [
      { px: 32, s: "" },
      { px: 64, s: "@2x" },
    ];
    pngSizes.forEach((t) => {
      const out = path.join(assetsDir, `${filename}${t.s}.png`);
      execSync(
        `convert -background none -density 300 "${svgPath}" -resize ${t.px}x${t.px} "${out}"`,
      );
    });

    const ico = path.join(assetsDir, `${filename}.ico`);
    execSync(
      `convert -background none -density 300 "${svgPath}" -define icon:auto-resize=256,64,48,32,24,16 "${ico}"`,
    );
    console.log(`tray icon made: ${filename}`);
  }

  function saveAppLogo(
    drawingFunc,
    config,
    filename,
    size = 512,
    paddingMul = 0.06,
    embedText = true,
  ) {
    const snap = Snap(size, size);
    drawingFunc(snap, config, size, paddingMul);

    const assetsDir = path.join(__dirname, "./output/icons");
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const svgPath = path.join(assetsDir, `${filename}.svg`);
    const pngPath = path.join(assetsDir, `${filename}.png`);

    fs.writeFileSync(svgPath, snap.toString());

    if (embedText) {
      try {
        execSync(
          `inkscape "${svgPath}" --export-type=svg --export-plain-svg --export-text-to-path -o "${svgPath}"`,
        );
        console.log(`logo made (svg)(embedded text): ${filename}`);
      } catch (error) {
        console.error(error);
      }
    } else {
      console.log(`logo made (svg): ${filename}`);
    }

    execSync(
      `convert -background none -density 300 "${svgPath}" -resize ${size}x${size} "${pngPath}"`,
    );
    console.log(`logo made (png): ${filename} (${size}x${size})`);
  }

  ///////////////////////////////////////////////////////////////////////////////

  console.log("generating icons:");

  saveTrayIcons(
    drawComicBubble,
    { bodyColor: "#FFFFFF", isCutout: true },
    "tray_dark_mode",
  );
  saveTrayIcons(
    drawComicBubble,
    { bodyColor: "#2F2F2F", isCutout: true },
    "tray_light_mode",
  );
  saveTrayIcons(
    drawComicBubble,
    { bodyColor: "#d9af50", bubbleColor: "#FFFFFF", isCutout: false },
    "tray_color",
  );

  saveAppLogo(
    drawComicBubble,
    {
      bodyColor: "#d9af50",
      bubbleColor: "#FFFFFF",
    },
    "icon_512x512",
    512,
  );
  saveAppLogo(
    drawComicBubble,
    {
      bodyColor: "#d9af50",
      bubbleColor: "#FFFFFF",
    },
    "icon_256x256",
    256,
  );

  saveAppLogo(
    drawComicBubble,
    {
      bodyColor: "#d9af50",
      bubbleColor: "#FFFFFF",
      text: "ACBR",
      font: "Komika Hand",
      fontSize: 120,
      textColor: "#d9af50",
    },
    "icon_text_1024x1024",
    1024,
  );
  saveAppLogo(
    drawComicBubble,
    {
      gradientColors: ["#ffffff", "#d9af50"],
      gradientStop: 25,
      bubbleColor: "#FFFFFF",
      text: "ACBR",
      font: "Komika Hand",
      fontSize: 120,
      textColor: "#d9af50",
    },
    "icon_gradient_text_1024x1024",
    1024,
  );

  console.log("done!");
  process.exit(0);
}

///////////////////////////////////////////////////////////////////////////////

function copyIcons() {
  const fs = require("node:fs");
  const path = require("node:path");
  const inputDir = path.join(__dirname, "./output/icons");
  const outputDir = path.join(__dirname, "../src/assets/images");
  function copy(fileName) {
    try {
      fs.copyFileSync(
        path.join(inputDir, fileName),
        path.join(outputDir, fileName),
      );
      console.log("copied: " + fileName);
    } catch (error) {}
  }

  copy("icon_512x512.png");
  copy("icon_256x256.png");
  copy("tray_dark_mode.ico");
  copy("tray_dark_mode.png");
  copy("tray_dark_mode@2x.png");
  copy("tray_light_mode.png");
  copy("tray_light_mode.ico");
  copy("tray_light_mode@2x.png");
  copy("tray_color.png");
  copy("tray_color@2x.png");
  copy("tray_color.ico");
  console.log("done!");
}
