/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const core = require("../../core/main");

let g_currentTool = "reader";
let g_tools = {};

exports.init = function () {
  g_tools["reader"] = require("../../reader/main");
  g_tools["audio-player"] = require("../../audio-player/main");
  g_tools["tool-preferences"] = require("../../tools/preferences/main");
  g_tools["tool-history"] = require("../../tools/history/main");
  g_tools["tool-convert-comics"] = require("../../tools/convert-comics/main");
  g_tools["tool-extract-comics"] = require("../../tools/extract-comics/main");
  g_tools["tool-convert-imgs"] = require("../../tools/convert-imgs/main");
  g_tools["tool-extract-palette"] = require("../../tools/extract-palette/main");
  g_tools["tool-extract-text"] = require("../../tools/extract-text/main");
  g_tools["tool-create-qr"] = require("../../tools/create-qr/main");
  g_tools["tool-extract-qr"] = require("../../tools/extract-qr/main");
  g_tools["tool-dcm"] = require("../../tools/dcm/main");
  g_tools[
    "tool-internet-archive"
  ] = require("../../tools/internet-archive/main");
  g_tools["tool-gutenberg"] = require("../../tools/gutenberg/main");
  g_tools["tool-xkcd"] = require("../../tools/xkcd/main");
  g_tools["tool-librivox"] = require("../../tools/librivox/main");
  g_tools["tool-wiktionary"] = require("../../tools/wiktionary/main");
  g_tools["tool-file-browser"] = require("../../tools/file-browser/main");
  g_tools["tool-radio"] = require("../../tools/radio/main");
  g_tools["tool-metadata"] = require("../../tools/metadata/main");
};

exports.getTools = function () {
  return g_tools;
};

exports.getCurrentTool = function () {
  return g_tools[g_currentTool];
};

exports.getCurrentToolName = function () {
  return g_currentTool;
};

exports.switchTool = function (tool, ...args) {
  if (g_currentTool !== tool) {
    if (g_tools[g_currentTool].close) g_tools[g_currentTool].close();
    g_currentTool = tool;
    core.sendIpcToCoreRenderer("show-tool", tool);
    g_tools[tool].open(...args);
  }
};
