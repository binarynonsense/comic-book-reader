/**
 * @license
 * Copyright 2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import { exportGridPresetData, loadGridPresetData } from "./panels.js";
import { exportHeaderPresetData, loadHeaderPresetData } from "./header.js";
import { Sanitize } from "./sanitize.js";
import { getVersion } from "./main.js";

import preset_0 from "../presets/default.js";
import preset_1 from "../presets/american-comic-1.js";
import preset_2 from "../presets/american-comic-1-double.js";
import preset_3 from "../presets/thumbs-american-single-1.js";
import preset_4 from "../presets/thumbs-american-double-1.js";
import preset_5 from "../presets/american-comic-2.js";
import preset_6 from "../presets/american-comic-2-double.js";
import preset_7 from "../presets/american-manga-1.js";
import preset_8 from "../presets/japanese-manga-1.js";
import preset_9 from "../presets/six-by-nine-1.js";
// not supported by firefox:
// import preset_1 from "../presets/american-1.json" assert { type: "json" };
import gridPreset_0 from "../presets/grid/0x0.js";
import gridPreset_1 from "../presets/grid/1x1.js";
import gridPreset_2 from "../presets/grid/2x2.js";
import gridPreset_3 from "../presets/grid/3x3.js";
import gridPreset_4 from "../presets/grid/4x4.js";
import gridPreset_5 from "../presets/grid/example1.js";

import headerPreset_0 from "../presets/header/empty.js";
import headerPreset_1 from "../presets/header/page.js";
import headerPreset_2 from "../presets/header/issue-page.js";
import headerPreset_3 from "../presets/header/title-issue-page.js";
import headerPreset_4 from "../presets/header/title-issue-page_penciller-inker.js";

let g_presets;
let g_defaultPreset;

let g_gridPresets;
let g_headerPresets;

export function initPresets() {
  // template presets
  g_presets = [];
  g_defaultPreset = preset_0;
  loadPresetFromJson(g_defaultPreset, false);
  const select = document.getElementById("preset-select");
  let opt = document.createElement("option");
  opt.disabled = true;
  opt.selected = true;
  opt.value = 0;
  opt.innerHTML = "select a preset";
  select.appendChild(opt);
  loadPresetFromJson(preset_1);
  loadPresetFromJson(preset_2);
  loadPresetFromJson(preset_3);
  loadPresetFromJson(preset_4);
  loadPresetFromJson(preset_5);
  loadPresetFromJson(preset_6);
  loadPresetFromJson(preset_7);
  loadPresetFromJson(preset_8);
  loadPresetFromJson(preset_9);
  setPreset(-1);
  // grid presets
  {
    g_gridPresets = [];
    const select = document.getElementById("grid-preset-select");
    let opt = document.createElement("option");
    opt.disabled = true;
    opt.selected = true;
    opt.value = 0;
    opt.innerHTML = "select a preset";
    select.appendChild(opt);
    loadGridPresetFromJson(gridPreset_0);
    loadGridPresetFromJson(gridPreset_1);
    loadGridPresetFromJson(gridPreset_2);
    loadGridPresetFromJson(gridPreset_3);
    loadGridPresetFromJson(gridPreset_4);
    loadGridPresetFromJson(gridPreset_5);
    setGridPreset(0);
  }
  // header presets
  {
    g_headerPresets = [];
    const select = document.getElementById("header-preset-select");
    let opt = document.createElement("option");
    opt.disabled = true;
    opt.selected = true;
    opt.value = 0;
    opt.innerHTML = "select a preset";
    select.appendChild(opt);
    loadHeaderPresetFromJson(headerPreset_0);
    loadHeaderPresetFromJson(headerPreset_1);
    loadHeaderPresetFromJson(headerPreset_2);
    loadHeaderPresetFromJson(headerPreset_3);
    loadHeaderPresetFromJson(headerPreset_4);
    setHeaderPreset(3);
  }
}
//////////////////////
// template presets //
//////////////////////
export function loadPresetFromJson(preset, addToList = true) {
  const select = document.getElementById("preset-select");
  // sanitize /////
  preset.name = Sanitize.string(preset.name, "comic book preset");
  // TODO: check version is valid
  preset.presetFormatVersion = Sanitize.version(preset.presetFormatVersion);
  //////////////// dimensions ///////////////////////////
  if (preset.units !== undefined)
    preset.units = Sanitize.string(preset.units, "inches", ["inches", "cm"]);

  if (preset.trimWidth !== undefined)
    preset.trimWidth = Sanitize.number(preset.trimWidth);
  if (preset.trimHeight !== undefined)
    preset.trimHeight = Sanitize.number(preset.trimHeight);
  if (preset.safeMarginTop !== undefined)
    preset.safeMarginTop = Sanitize.number(preset.safeMarginTop);
  if (preset.safeMarginBottom !== undefined)
    preset.safeMarginBottom = Sanitize.number(preset.safeMarginBottom);
  if (preset.safeMarginLeft !== undefined)
    preset.safeMarginLeft = Sanitize.number(preset.safeMarginLeft);
  if (preset.safeMarginRight !== undefined)
    preset.safeMarginRight = Sanitize.number(preset.safeMarginRight);
  if (preset.bleedMargin !== undefined)
    preset.bleedMargin = Sanitize.number(preset.bleedMargin);
  if (preset.headerMarginTopBottom !== undefined)
    preset.headerMarginTopBottom = Sanitize.number(
      preset.headerMarginTopBottom
    );
  if (preset.headerMarginLeftRight !== undefined)
    preset.headerMarginLeftRight = Sanitize.number(
      preset.headerMarginLeftRight
    );

  if (preset.panelsGutterSize !== undefined)
    preset.panelsGutterSize = Sanitize.number(preset.panelsGutterSize);
  if (preset.panelsLineWidth !== undefined)
    preset.panelsLineWidth = Sanitize.number(preset.panelsLineWidth);

  if (preset.lineWidthThin !== undefined)
    preset.lineWidthThin = Sanitize.number(preset.lineWidthThin);
  if (preset.lineWidthThick !== undefined)
    preset.lineWidthThick = Sanitize.number(preset.lineWidthThick);
  if (preset.borderMarkMaxLength !== undefined)
    preset.borderMarkMaxLength = Sanitize.number(preset.borderMarkMaxLength);
  if (preset.headerTextHeight !== undefined)
    preset.headerTextHeight = Sanitize.number(preset.headerTextHeight);
  if (preset.headerLineSpacing !== undefined)
    preset.headerLineSpacing = Sanitize.number(preset.headerLineSpacing);
  if (preset.headerPaddingBottom !== undefined)
    preset.headerPaddingBottom = Sanitize.number(preset.headerPaddingBottom);
  if (preset.headerPaddingLeft !== undefined)
    preset.headerPaddingLeft = Sanitize.number(preset.headerPaddingLeft);
  //////////////// rendering ///////////////////////////
  if (preset.renderBackgroundColor !== undefined)
    preset.renderBackgroundColor = Sanitize.color(preset.renderBackgroundColor);
  if (preset.renderLineColor !== undefined)
    preset.renderLineColor = Sanitize.color(preset.renderLineColor);
  if (preset.renderLineWeight !== undefined)
    preset.renderLineWeight = Sanitize.string(preset.renderLineWeight);
  if (preset.renderPanelLineColor !== undefined)
    preset.renderPanelLineColor = Sanitize.string(preset.renderPanelLineColor);
  if (preset.renderPanelGuidesColor !== undefined)
    preset.renderPanelGuidesColor = Sanitize.string(
      preset.renderPanelGuidesColor
    );
  if (preset.renderHeaderTextWeight !== undefined)
    preset.renderHeaderTextWeight = Sanitize.string(
      preset.renderHeaderTextWeight
    );

  if (preset.renderDrawBackground !== undefined)
    preset.renderDrawBackground = Sanitize.bool(preset.renderDrawBackground);
  if (preset.renderDrawHeader !== undefined)
    preset.renderDrawHeader = Sanitize.bool(preset.renderDrawHeader);
  if (preset.renderDrawBleed !== undefined)
    preset.renderDrawBleed = Sanitize.bool(preset.renderDrawBleed);
  if (preset.renderDrawTrim !== undefined)
    preset.renderDrawTrim = Sanitize.bool(preset.renderDrawTrim);
  if (preset.renderDrawSafe !== undefined)
    preset.renderDrawSafe = Sanitize.bool(preset.renderDrawSafe);
  if (preset.renderDrawMarks !== undefined)
    preset.renderDrawMarks = Sanitize.bool(preset.renderDrawMarks);
  if (preset.renderDrawCropMarks !== undefined)
    preset.renderDrawCropMarks = Sanitize.bool(preset.renderDrawCropMarks);
  if (preset.renderDrawPanelGuides !== undefined)
    preset.renderDrawPanelGuides = Sanitize.bool(preset.renderDrawPanelGuides);
  if (preset.renderDrawPanels !== undefined)
    preset.renderDrawPanels = Sanitize.bool(preset.renderDrawPanels);
  //////////////// panels ///////////////////////////
  // TODO: sanitize grid object somehow?
  //////////////// header ///////////////////////////
  // TODO: sanitize header object somehow?
  //////////////// layout ///////////////////////////
  if (preset.layoutPageSpread !== undefined)
    preset.layoutPageSpread = Sanitize.string(preset.layoutPageSpread);
  if (preset.layoutPpi !== undefined)
    preset.layoutPpi = Sanitize.number(preset.layoutPpi);
  if (preset.layoutTemplateType !== undefined)
    preset.layoutTemplateType = Sanitize.string(preset.layoutTemplateType);

  if (preset.layoutPagePaperSize !== undefined)
    preset.layoutPagePaperSize = Sanitize.string(preset.layoutPagePaperSize);
  if (preset.layoutPageScaling !== undefined)
    preset.layoutPageScaling = Sanitize.string(preset.layoutPageScaling);

  if (preset.layoutThumbnailsRows !== undefined)
    preset.layoutThumbnailsRows = Sanitize.number(preset.layoutThumbnailsRows);
  if (preset.layoutThumbnailsColumns !== undefined)
    preset.layoutThumbnailsColumns = Sanitize.number(
      preset.layoutThumbnailsColumns
    );
  if (preset.layoutThumbnailsPaperSize !== undefined)
    preset.layoutThumbnailsPaperSize = Sanitize.string(
      preset.layoutThumbnailsPaperSize
    );
  /////////////////
  if (addToList) {
    let opt = document.createElement("option");
    opt.value = select.childElementCount;
    opt.textContent = preset.name;
    select.appendChild(opt);
    g_presets.push(preset);
    return opt.value;
  }
}

export function setPreset(index, checkUI = false) {
  let preset;
  if (index < 0 || index >= g_presets.length) {
    preset = g_defaultPreset;
  } else {
    preset = g_presets[index];
  }
  //////////////// dimensions ///////////////////////////
  if (
    !checkUI ||
    true //document.getElementById("select-preset-dimensions-checkbox").checked
  ) {
    if (preset.units !== undefined) {
      document.getElementById("units-select").value = preset.units;
    }
    if (preset.trimWidth !== undefined) {
      document.getElementById("trim-width-input").value = preset.trimWidth;
    }
    if (preset.trimHeight !== undefined) {
      document.getElementById("trim-height-input").value = preset.trimHeight;
    }
    if (preset.safeMarginTop !== undefined) {
      document.getElementById("safe-margin-top-input").value =
        preset.safeMarginTop;
    }
    if (preset.safeMarginBottom !== undefined) {
      document.getElementById("safe-margin-bottom-input").value =
        preset.safeMarginBottom;
    }
    if (preset.safeMarginLeft !== undefined) {
      document.getElementById("safe-margin-left-input").value =
        preset.safeMarginLeft;
    }
    if (preset.safeMarginRight !== undefined) {
      document.getElementById("safe-margin-right-input").value =
        preset.safeMarginRight;
    }
    if (preset.bleedMargin !== undefined) {
      document.getElementById("bleed-margin-input").value = preset.bleedMargin;
    }
    if (preset.headerMarginTopBottom !== undefined) {
      document.getElementById("header-margin-top-bottom-input").value =
        preset.headerMarginTopBottom;
    }
    if (preset.headerMarginLeftRight !== undefined) {
      document.getElementById("header-margin-left-right-input").value =
        preset.headerMarginLeftRight;
    }

    if (preset.panelsGutterSize !== undefined) {
      document.getElementById("panel-gutter-size-input").value =
        preset.panelsGutterSize;
    }
    if (preset.panelsLineWidth !== undefined) {
      document.getElementById("panel-line-width-input").value =
        preset.panelsLineWidth;
    }

    if (preset.lineWidthThin !== undefined) {
      document.getElementById("line-width-thin-input").value =
        preset.lineWidthThin;
    }
    if (preset.lineWidthThick !== undefined) {
      document.getElementById("line-width-thick-input").value =
        preset.lineWidthThick;
    }
    if (preset.borderMarkMaxLength !== undefined) {
      document.getElementById("border-marks-length-input").value =
        preset.borderMarkMaxLength;
    }
    if (preset.headerTextHeight !== undefined) {
      document.getElementById("header-text-height-input").value =
        preset.headerTextHeight;
    }
    if (preset.headerLineSpacing !== undefined) {
      document.getElementById("header-text-spacing-select").value =
        preset.headerLineSpacing;
    }
    if (preset.headerPaddingBottom !== undefined) {
      document.getElementById("header-padding-bottom-input").value =
        preset.headerPaddingBottom;
    }
    if (preset.headerPaddingLeft !== undefined) {
      document.getElementById("header-padding-left-input").value =
        preset.headerPaddingLeft;
    }
  }
  //////////////// rendering ///////////////////////////
  if (
    !checkUI ||
    true //document.getElementById("select-preset-rendering-checkbox").checked
  ) {
    if (preset.renderBackgroundColor !== undefined) {
      document.getElementById("background-color-input").value =
        preset.renderBackgroundColor;
    }
    if (preset.renderLineColor !== undefined) {
      document.getElementById("line-color-input").value =
        preset.renderLineColor;
    }
    if (preset.renderLineWeight !== undefined) {
      document.getElementById("line-thickness-select").value =
        preset.renderLineWeight;
    }
    if (preset.renderPanelLineColor !== undefined) {
      document.getElementById("panel-line-color-input").value =
        preset.renderPanelLineColor;
    }
    if (preset.renderPanelGuidesColor !== undefined) {
      document.getElementById("panel-guides-color-input").value =
        preset.renderPanelGuidesColor;
    }
    if (preset.renderHeaderTextWeight !== undefined) {
      document.getElementById("header-text-weight-select").value =
        preset.renderHeaderTextWeight;
    }

    if (preset.renderDrawBackground !== undefined) {
      document.getElementById("paper-draw-bg-checkbox").checked =
        preset.renderDrawBackground;
    }
    if (preset.renderDrawHeader !== undefined) {
      document.getElementById("paper-draw-header-checkbox").checked =
        preset.renderDrawHeader;
    }
    if (preset.renderDrawBleed !== undefined) {
      document.getElementById("bleed-draw-checkbox").checked =
        preset.renderDrawBleed;
    }
    if (preset.renderDrawTrim !== undefined) {
      document.getElementById("trim-draw-checkbox").checked =
        preset.renderDrawTrim;
    }
    if (preset.renderDrawSafe !== undefined) {
      document.getElementById("safe-draw-checkbox").checked =
        preset.renderDrawSafe;
    }
    if (preset.renderDrawMarks !== undefined) {
      document.getElementById("border-marks-draw-checkbox").checked =
        preset.renderDrawMarks;
    }
    if (preset.renderDrawCropMarks !== undefined) {
      document.getElementById("crop-marks-draw-checkbox").checked =
        preset.renderDrawCropMarks;
    }
    if (preset.renderDrawPanelGuides !== undefined) {
      document.getElementById("panel-guides-draw-checkbox").checked =
        preset.renderDrawPanelGuides;
    }
    if (preset.renderDrawPanels !== undefined) {
      document.getElementById("panels-draw-checkbox").checked =
        preset.renderDrawPanels;
    }
  }
  //////////////// panels ///////////////////////////
  if (!checkUI || true) {
    if (preset.panelGrid !== undefined) {
      loadGridPresetData(preset.panelGrid);
    }
  }
  //////////////// header ///////////////////////////
  if (!checkUI || true) {
    if (preset.headerText !== undefined) {
      loadHeaderPresetData(preset.headerText);
    }
  }
  //////////////// layout ///////////////////////////
  if (
    !checkUI ||
    true //document.getElementById("select-preset-layout-checkbox").checked
  ) {
    if (preset.layoutPageSpread !== undefined) {
      document.getElementById("layout-spread-select").value =
        preset.layoutPageSpread;
    }
    if (preset.layoutPpi !== undefined) {
      document.getElementById("ppi-input").value = preset.layoutPpi;
    }
    if (preset.layoutTemplateType !== undefined) {
      document.getElementById("layout-template-select").value =
        preset.layoutTemplateType;
      if (document.getElementById("layout-template-select").value === "page") {
        document.getElementById("layout-page-div").classList.remove("hidden");
        document
          .getElementById("layout-thumbnails-div")
          .classList.add("hidden");
      } else {
        document.getElementById("layout-page-div").classList.add("hidden");
        document
          .getElementById("layout-thumbnails-div")
          .classList.remove("hidden");
      }
    }
    if (preset.layoutPagePaperSize !== undefined) {
      document.getElementById("layout-page-paper-select").value =
        preset.layoutPagePaperSize;
    }
    if (preset.layoutPageScaling !== undefined) {
      document.getElementById("layout-page-scaling-select").value =
        preset.layoutPageScaling;
    }
    if (preset.layoutThumbnailsRows !== undefined) {
      document.getElementById("layout-thumbnails-rows-input").value =
        preset.layoutThumbnailsRows;
    }
    if (preset.layoutThumbnailsColumns !== undefined) {
      document.getElementById("layout-thumbnails-columns-input").value =
        preset.layoutThumbnailsColumns;
    }
    if (preset.layoutThumbnailsPaperSize !== undefined) {
      document.getElementById("layout-thumbnails-paper-select").value =
        preset.layoutThumbnailsPaperSize;
    }
  }
  //////////////////////////////////////////////////
}

export function getPresetFromCurrentValues(name) {
  const preset = {};
  preset.name = name;
  preset.presetFormatVersion = getVersion();
  //////////////// dimensions ///////////////////////////
  if (document.getElementById("export-preset-dimensions-checkbox").checked) {
    preset.units = document.getElementById("units-select").value;

    preset.trimWidth = document.getElementById("trim-width-input").value;
    preset.trimHeight = document.getElementById("trim-height-input").value;
    preset.safeMarginTop = document.getElementById(
      "safe-margin-top-input"
    ).value;
    preset.safeMarginBottom = document.getElementById(
      "safe-margin-bottom-input"
    ).value;
    preset.safeMarginLeft = document.getElementById(
      "safe-margin-left-input"
    ).value;
    preset.safeMarginRight = document.getElementById(
      "safe-margin-right-input"
    ).value;
    preset.bleedMargin = document.getElementById("bleed-margin-input").value;
    preset.headerMarginTopBottom = document.getElementById(
      "header-margin-top-bottom-input"
    ).value;
    preset.headerMarginLeftRight = document.getElementById(
      "header-margin-left-right-input"
    ).value;

    preset.panelsGutterSize = document.getElementById(
      "panel-gutter-size-input"
    ).value;
    preset.panelsLineWidth = document.getElementById(
      "panel-line-width-input"
    ).value;

    preset.lineWidthThin = document.getElementById(
      "line-width-thin-input"
    ).value;
    preset.lineWidthThick = document.getElementById(
      "line-width-thick-input"
    ).value;
    preset.borderMarkMaxLength = document.getElementById(
      "border-marks-length-input"
    ).value;
    preset.headerTextHeight = document.getElementById(
      "header-text-height-input"
    ).value;
    preset.headerLineSpacing = document.getElementById(
      "header-text-spacing-select"
    ).value;
    preset.headerPaddingBottom = document.getElementById(
      "header-padding-bottom-input"
    ).value;
    preset.headerPaddingLeft = document.getElementById(
      "header-padding-left-input"
    ).value;
  }
  //////////////// rendering ///////////////////////////
  if (document.getElementById("export-preset-rendering-checkbox").checked) {
    preset.renderBackgroundColor = document.getElementById(
      "background-color-input"
    ).value;
    preset.renderLineColor = document.getElementById("line-color-input").value;
    preset.renderLineWeight = document.getElementById(
      "line-thickness-select"
    ).value;
    preset.renderPanelLineColor = document.getElementById(
      "panel-line-color-input"
    ).value;
    preset.renderPanelGuidesColor = document.getElementById(
      "panel-guides-color-input"
    ).value;
    preset.renderHeaderTextWeight = document.getElementById(
      "header-text-weight-select"
    ).value;

    preset.renderDrawBackground = document.getElementById(
      "paper-draw-bg-checkbox"
    ).checked;
    preset.renderDrawHeader = document.getElementById(
      "paper-draw-header-checkbox"
    ).checked;
    preset.renderDrawBleed = document.getElementById(
      "bleed-draw-checkbox"
    ).checked;
    preset.renderDrawTrim =
      document.getElementById("trim-draw-checkbox").checked;
    preset.renderDrawSafe =
      document.getElementById("safe-draw-checkbox").checked;
    preset.renderDrawMarks = document.getElementById(
      "border-marks-draw-checkbox"
    ).checked;
    preset.renderDrawCropMarks = document.getElementById(
      "crop-marks-draw-checkbox"
    ).checked;
    preset.renderDrawPanelGuides = document.getElementById(
      "panel-guides-draw-checkbox"
    ).checked;
    preset.renderDrawPanels = document.getElementById(
      "panels-draw-checkbox"
    ).checked;
  }
  //////////////// panels ///////////////////////////
  if (document.getElementById("export-preset-current-grid-checkbox").checked) {
    preset.panelGrid = exportGridPresetData();
  }
  //////////////// header ///////////////////////////
  if (
    document.getElementById("export-preset-current-header-checkbox").checked
  ) {
    preset.headerText = exportHeaderPresetData();
  }
  //////////////// layout ///////////////////////////
  if (document.getElementById("export-preset-layout-checkbox").checked) {
    preset.layoutPageSpread = document.getElementById(
      "layout-spread-select"
    ).value;
    preset.layoutPpi = document.getElementById("ppi-input").value;
    preset.layoutTemplateType = document.getElementById(
      "layout-template-select"
    ).value;

    preset.layoutPagePaperSize = document.getElementById(
      "layout-page-paper-select"
    ).value;
    preset.layoutPageScaling = document.getElementById(
      "layout-page-scaling-select"
    ).value;

    preset.layoutThumbnailsRows = document.getElementById(
      "layout-thumbnails-rows-input"
    ).value;
    preset.layoutThumbnailsColumns = document.getElementById(
      "layout-thumbnails-columns-input"
    ).value;
    preset.layoutThumbnailsPaperSize = document.getElementById(
      "layout-thumbnails-paper-select"
    ).value;
  }
  //////////////////////////////////////////////////////
  return preset;
}

//////////////////
// grid presets //
//////////////////

export function loadGridPresetFromJson(preset, addToList = true) {
  const select = document.getElementById("grid-preset-select");
  // sanitize /////////////////////////////
  preset.name = Sanitize.string(preset.name, "panel grid preset");
  // TODO: check version is valid
  preset.presetFormatVersion = Sanitize.version(preset.presetFormatVersion);
  // panels //
  // TODO: check if preset.panelGrid content is valid?
  preset.panelGrid = preset.panelGrid;
  /////////////////////////////////////////
  if (addToList) {
    let opt = document.createElement("option");
    opt.value = select.childElementCount;
    opt.textContent = preset.name;
    select.appendChild(opt);
    g_gridPresets.push(preset);
    return opt.value;
  }
}

export function setGridPreset(index) {
  //loadPanelsPreset(event.target.value);
  let preset = g_gridPresets[index];
  if (index < 0 || index >= g_presets.length) {
    preset = g_gridPresets[0];
  }
  //////////////// panels ///////////////////////////
  loadGridPresetData(preset.panelGrid);
  //////////////////////////////////////////////////
}

export function getGridPresetFromCurrentValues(name) {
  const preset = { name: undefined, panelGrid: undefined };
  preset.name = name;
  preset.panelGrid = exportGridPresetData();
  return preset;
}

////////////////////
// header presets //
////////////////////

export function loadHeaderPresetFromJson(preset, addToList = true) {
  const select = document.getElementById("header-preset-select");
  // sanitize /////////////////////////////
  preset.name = Sanitize.string(preset.name, "header preset");
  // TODO: check version is valid
  preset.presetFormatVersion = Sanitize.version(preset.presetFormatVersion);
  // header //
  // TODO: check if preset.headerText content is valid?
  preset.headerText = preset.headerText;
  /////////////////////////////////////////
  if (addToList) {
    let opt = document.createElement("option");
    opt.value = select.childElementCount;
    opt.textContent = preset.name;
    select.appendChild(opt);
    g_headerPresets.push(preset);
    return opt.value;
  }
}

export function setHeaderPreset(index) {
  let preset = g_headerPresets[index];
  if (index < 0 || index >= g_presets.length) {
    preset = g_headerPresets[0];
  }
  //////////////// header ///////////////////////////
  loadHeaderPresetData(preset.headerText);
  //////////////////////////////////////////////////
}

export function getHeaderPresetFromCurrentValues(name) {
  const preset = { name: undefined, headerText: undefined };
  preset.name = name;
  preset.headerText = exportHeaderPresetData();
  return preset;
}
