/**
 * @license
 * Copyright 2020-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const core = require("../core/main");
const reader = require("./main");
const { FileDataType } = require("../shared/main/constants");
const { _ } = require("../shared/main/i18n");

function buildContextMenu(isOpen, showRotation) {
  let contextMenu = Menu.buildFromTemplate([
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
    {
      type: "separator",
    },
    {
      label: _("ctxmenu-openfile"),
      // accelerator: "CommandOrControl+O",
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
      // accelerator: "F11",
      click() {
        core.onMenuToggleFullScreen();
      },
    },
  ]);
  return contextMenu;
}

exports.getContextMenu = function (fileData) {
  let isOpen = true;
  let showRotation = true;
  if (fileData.type === FileDataType.NOT_SET) {
    isOpen = false;
  } else if (fileData.type === FileDataType.EPUB_EBOOK) {
    showRotation = false;
  }
  return buildContextMenu(isOpen, showRotation);
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
