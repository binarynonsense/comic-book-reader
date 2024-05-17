/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as reader from "../../reader/renderer.js";
import * as audioPlayer from "../../audio-player/renderer.js";
import * as toolPreferences from "../../tools/preferences/renderer.js";
import * as toolHistory from "../../tools/history/renderer.js";
import * as toolConvertComics from "../../tools/convert-comics/renderer.js";
import * as toolExtractComics from "../../tools/extract-comics/renderer.js";
import * as toolConvertImgs from "../../tools/convert-imgs/renderer.js";
import * as toolExtractPalette from "../../tools/extract-palette/renderer.js";
import * as toolExtractText from "../../tools/extract-text/renderer.js";
import * as toolCreateQr from "../../tools/create-qr/renderer.js";
import * as toolExtractQr from "../../tools/extract-qr/renderer.js";
import * as toolDcm from "../../tools/dcm/renderer.js";
import * as toolInternetArchive from "../../tools/internet-archive/renderer.js";
import * as toolGutenberg from "../../tools/gutenberg/renderer.js";
import * as toolXkcd from "../../tools/xkcd/renderer.js";
import * as toolLibrivox from "../../tools/librivox/renderer.js";
import * as toolWiktionary from "../../tools/wiktionary/renderer.js";
import * as toolComicInfoXml from "../../tools/comicinfoxml/renderer.js";
import * as toolFileBrowser from "../../tools/file-browser/renderer.js";

let g_currentTool = "reader";
let g_tools;

export function init() {
  g_tools = {};
  g_tools["reader"] = reader;
  g_tools["audio-player"] = audioPlayer;
  g_tools["tool-preferences"] = toolPreferences;
  g_tools["tool-history"] = toolHistory;
  g_tools["tool-convert-comics"] = toolConvertComics;
  g_tools["tool-extract-comics"] = toolExtractComics;
  g_tools["tool-convert-imgs"] = toolConvertImgs;
  g_tools["tool-extract-palette"] = toolExtractPalette;
  g_tools["tool-extract-text"] = toolExtractText;
  g_tools["tool-create-qr"] = toolCreateQr;
  g_tools["tool-extract-qr"] = toolExtractQr;
  g_tools["tool-dcm"] = toolDcm;
  g_tools["tool-internet-archive"] = toolInternetArchive;
  g_tools["tool-gutenberg"] = toolGutenberg;
  g_tools["tool-xkcd"] = toolXkcd;
  g_tools["tool-librivox"] = toolLibrivox;
  g_tools["tool-wiktionary"] = toolWiktionary;
  g_tools["tool-comicinfoxml"] = toolComicInfoXml;
  g_tools["tool-file-browser"] = toolFileBrowser;
}

export function getTools() {
  return g_tools;
}

export function getCurrentTool() {
  return g_tools[g_currentTool];
}

export function getCurrentToolName() {
  return g_currentTool;
}

export function setCurrentToolName(toolName) {
  g_currentTool = toolName;
}
