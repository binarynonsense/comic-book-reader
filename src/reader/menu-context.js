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

exports.show = function (type, params, fileData) {
  let isOpen = true;
  let showRotation = true;
  if (fileData.type === FileDataType.NOT_SET) {
    isOpen = false;
  } else if (fileData.type === FileDataType.EPUB_EBOOK) {
    showRotation = false;
  }
  //
  let saveImageAsEntries = [];
  switch (type) {
    case "save-image-as":
      saveImageAsEntries = [
        {
          type: "separator",
        },
        {
          label: _("ctxmenu-saveimageto") + "...",
          click: async () => {
            try {
              const dataUrl = params[2];
              let defaultPath = app.getPath("desktop");
              let folderList = appUtils.chooseFolder(
                core.getMainWindow(),
                defaultPath
              );
              if (folderList === undefined) {
                return;
              }
              let outputFolderPath = folderList[0];
              //
              if (dataUrl !== undefined) {
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
                  (fileData.pageIndex + 1);

                let outputFilePath = path.join(
                  outputFolderPath,
                  fileName + fileExtension
                );
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
                core.showToast(_("ui-modal-info-imagesaved"));
              }
            } catch (error) {
              log.error(error);
              // TODO: show error toast
            }
          },
        },
      ];
      break;
  }
  //
  Menu.buildFromTemplate([
    {
      label: _("ctxmenu-nextpage"),
      enabled: isOpen,
      click() {
        reader.onMenuNextPage();
      },
    },
    {
      label: _("ctxmenu-prevpage"),
      enabled: isOpen,
      click() {
        reader.onMenuPreviousPage();
      },
    },
    {
      type: "separator",
    },
    {
      label: _("menu-view-zoom"),
      enabled: isOpen,
      submenu: [
        {
          id: "fit-to-width",
          label: _("menu-view-zoom-fitwidth"),
          enabled: isOpen,
          click() {
            reader.onMenuFitToWidth();
          },
        },
        {
          id: "fit-to-height",
          label: _("menu-view-zoom-fitheight"),
          enabled: isOpen,
          click() {
            reader.onMenuFitToHeight();
          },
        },
        {
          id: "scale-to-height",
          label: _("menu-view-zoom-scaleheight"),
          enabled: isOpen,
          submenu: getScaleToHeightSubmenu(),
        },
      ],
    },
    {
      label: _("ctxmenu-rotate"),
      enabled: isOpen && showRotation,
      submenu: [
        {
          id: "rotate-clockwise",
          label: _("ctxmenu-rotate-clockwise"),
          enabled: isOpen && showRotation,
          click() {
            reader.onMenuRotateClockwise();
          },
        },
        {
          id: "rotation-counterclockwise",
          enabled: isOpen && showRotation,
          label: _("ctxmenu-rotate-counterclockwise"),
          click() {
            reader.onMenuRotateCounterclockwise();
          },
        },
      ],
    },
    {
      label: _("menu-view-page"),
      enabled: isOpen,
      submenu: [
        {
          label: _("menu-view-page-first"),
          enabled: isOpen,
          click() {
            reader.onGoToPageFirst();
          },
        },
        {
          label: _("menu-view-page-last"),
          enabled: isOpen,
          click() {
            reader.onGoToPageLast();
          },
        },
        {
          label: _("menu-view-page-choose"),
          enabled: isOpen,
          click() {
            reader.onGoToPageDialog();
          },
        },
      ],
    },
    ...saveImageAsEntries,
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
      enabled: isOpen,
      click() {
        reader.onMenuCloseFile();
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
