/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu, app } = require("electron");
const core = require("../core/main");
const reader = require("./main");
const { FileDataType, FileExtension } = require("../shared/main/constants");
const { _ } = require("../shared/main/i18n");

const log = require("../shared/main/logger");
const appUtils = require("../shared/main/app-utils");
const FileType = require("file-type");
const fs = require("fs");
const path = require("path");
const temp = require("../shared/main/temp");
const tools = require("../shared/main/tools");

exports.show = function (type, params, fileData) {
  let isOpen = true;
  let showRotation = true;
  if (fileData.type === FileDataType.NOT_SET) {
    isOpen = false;
  } else if (fileData.type === FileDataType.EPUB_EBOOK) {
    showRotation = false;
  }
  //
  let saveImageEntries = [];
  let pageExtraEntries = [];
  switch (type) {
    case "page":
      saveImageEntries = [
        {
          type: "separator",
        },
        {
          label: _("ctxmenu-saveimageto") + "...",
          click: () => {
            exportPage(0, params, fileData);
          },
        },
      ];
      pageExtraEntries = [
        {
          type: "separator",
        },
        {
          label: _("menu-file-page-extract-palette"),
          click: () => {
            exportPage(1, params, fileData);
          },
        },
        {
          label: _("menu-file-page-extract-text"),
          click: () => {
            exportPage(2, params, fileData);
          },
        },
        {
          label: _("menu-file-page-extract-qr"),
          click: () => {
            exportPage(3, params, fileData);
          },
        },
      ];
      break;
  }
  if (isOpen) {
    Menu.buildFromTemplate([
      {
        label: _("ctxmenu-nextpage"),
        click() {
          reader.onMenuNextPage();
        },
      },
      {
        label: _("ctxmenu-prevpage"),
        click() {
          reader.onMenuPreviousPage();
        },
      },
      {
        type: "separator",
      },
      {
        label: _("menu-view-zoom"),
        submenu: [
          {
            id: "fit-to-width",
            label: _("menu-view-zoom-fitwidth"),
            click() {
              reader.onMenuFitToWidth();
            },
          },
          {
            id: "fit-to-height",
            label: _("menu-view-zoom-fitheight"),
            click() {
              reader.onMenuFitToHeight();
            },
          },
          {
            id: "scale-to-height",
            label: _("menu-view-zoom-scaleheight"),
            submenu: getScaleToHeightSubmenu(),
          },
        ],
      },
      {
        label: _("ctxmenu-rotate"),
        enabled: showRotation,
        submenu: [
          {
            id: "rotate-clockwise",
            label: _("ctxmenu-rotate-clockwise"),
            enabled: showRotation,
            click() {
              reader.onMenuRotateClockwise();
            },
          },
          {
            id: "rotation-counterclockwise",
            enabled: showRotation,
            label: _("ctxmenu-rotate-counterclockwise"),
            click() {
              reader.onMenuRotateCounterclockwise();
            },
          },
        ],
      },
      {
        label: _("menu-view-page"),
        submenu: [
          {
            label: _("menu-view-page-first"),
            click() {
              reader.onGoToPageFirst();
            },
          },
          {
            label: _("menu-view-page-last"),
            click() {
              reader.onGoToPageLast();
            },
          },
          {
            label: _("menu-view-page-choose"),
            click() {
              reader.onGoToPageDialog();
            },
          },
          ...pageExtraEntries,
        ],
      },
      ...saveImageEntries,
      {
        type: "separator",
      },
      {
        label: _("ctxmenu-openfile"),
        click() {
          reader.onMenuOpenFile();
        },
      },
      {
        label: _("ui-modal-prompt-button-close-file"),
        click() {
          reader.onMenuCloseFile();
        },
      },
      {
        label: _("ctxmenu-opencontainingfolder"),
        click() {
          reader.onMenuOpenContainingFolder();
        },
      },
      {
        type: "separator",
      },
      {
        label: _("menu-view-togglefullscreen"),
        click() {
          core.onMenuToggleFullScreen();
        },
      },
    ]).popup(core.getMainWindow(), params.x, params.y);
  } else {
    // Home Screen
    Menu.buildFromTemplate([
      {
        label: _("ctxmenu-openfile"),
        click() {
          reader.onMenuOpenFile();
        },
      },
      {
        type: "separator",
      },
      {
        label: _("menu-view-togglefullscreen"),
        click() {
          core.onMenuToggleFullScreen();
        },
      },
    ]).popup(core.getMainWindow(), params.x, params.y);
  }
};

function getScaleToHeightSubmenu() {
  let menu = [];
  let defaults = [25, 50, 100, 150, 200, 300, 400];
  defaults.forEach((scale) => {
    menu.push({
      label: `${scale}%`,
      click() {
        reader.onMenuScaleToHeight(scale);
      },
    });
  });
  menu.push({
    type: "separator",
  });
  menu.push({
    label: _("menu-view-zoom-scaleheight-enter"),
    click() {
      reader.onMenuScaleToHeightEnter();
    },
  });

  return menu;
}

//////////////////////////////////////////////////////////////////////////////
// EXPORT ////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

async function exportPage(sendToTool, params, fileData) {
  try {
    const dataUrl = params[2];

    let outputFolderPath;
    if (sendToTool !== 0) {
      outputFolderPath = temp.createSubFolder();
    } else {
      let defaultPath = app.getPath("desktop");
      let folderList = appUtils.chooseFolder(core.getMainWindow(), defaultPath);
      if (folderList === undefined) {
        return;
      }
      outputFolderPath = folderList[0];
    }

    if (
      dataUrl === undefined ||
      outputFolderPath === undefined ||
      outputFolderPath === ""
    ) {
      throw "error";
    }

    let data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    let buf = Buffer.from(data, "base64");
    let fileType = await FileType.fromBuffer(buf);
    let fileExtension = "." + FileExtension.JPG;
    if (fileType !== undefined) {
      fileExtension = "." + fileType.ext;
    }
    let fileName =
      path.basename(fileData.name, path.extname(fileData.name)) +
      "_page_" +
      (!params[3] ? fileData.pageIndex + 1 : fileData.pageIndex + 2);

    let outputFilePath = path.join(outputFolderPath, fileName + fileExtension);
    let i = 1;
    while (fs.existsSync(outputFilePath)) {
      i++;
      outputFilePath = path.join(
        outputFolderPath,
        fileName + "(" + i + ")" + fileExtension
      );
    }
    fs.writeFileSync(outputFilePath, buf, "binary");
    //
    if (sendToTool === 1) {
      tools.switchTool("tool-extract-palette", outputFilePath);
    } else if (sendToTool === 2) {
      tools.switchTool("tool-extract-text", outputFilePath);
    } else if (sendToTool === 3) {
      tools.switchTool("tool-extract-qr", outputFilePath);
    } else {
      //utils.reduceStringFrontEllipsis(message[1], 85)
      core.showToast(_("ui-modal-info-imagesaved"), 3000);
    }
  } catch (error) {
    log.error(error);
    // TODO: show error toast
  }
}
