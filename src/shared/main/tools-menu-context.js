/**
 * @license
 * Copyright 2023-2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { Menu } = require("electron");
const core = require("../../core/main");
const { _ } = require("./i18n");
const log = require("./logger");

exports.show = function (type, params, backToReaderCallback) {
  // ref: https://github.com/electron/electron/blob/main/docs/api/web-contents.md#event-context-menu
  const { selectionText, isEditable } = params;
  const commonEntries = [
    {
      label: _("tool-shared-ui-back-to-reader"),
      click() {
        if (backToReaderCallback) backToReaderCallback();
      },
    },
    {
      label: _("menu-view-togglefullscreen"),
      accelerator: "F11",
      click() {
        core.onMenuToggleFullScreen();
      },
    },
  ];
  switch (type) {
    case "edit":
      if (isEditable && selectionText && selectionText.trim() !== "") {
        Menu.buildFromTemplate([
          { label: _("ctxmenu-copy"), role: "copy" },
          { label: _("ctxmenu-paste"), role: "paste" },
          { type: "separator" },
          { label: _("ctxmenu-select-all"), role: "selectall" },
          { type: "separator" },
          ...commonEntries,
        ]).popup(core.getMainWindow(), params.x, params.y);
      } else if (isEditable) {
        Menu.buildFromTemplate([
          { label: _("ctxmenu-paste"), role: "paste" },
          { type: "separator" },
          { label: _("ctxmenu-select-all"), role: "selectall" },
          { type: "separator" },
          ...commonEntries,
        ]).popup(core.getMainWindow(), params.x, params.y);
      } else if (selectionText && selectionText.trim() !== "") {
        Menu.buildFromTemplate([
          { label: _("ctxmenu-copy"), role: "copy" },
          { type: "separator" },
          { label: _("ctxmenu-select-all"), role: "selectall" },
          { type: "separator" },
          ...commonEntries,
        ]).popup(core.getMainWindow(), params.x, params.y);
      } else {
        Menu.buildFromTemplate([...commonEntries]).popup(
          core.getMainWindow(),
          params.x,
          params.y
        );
      }
      break;

    case "copy-select":
      if (selectionText && selectionText.trim() !== "") {
        Menu.buildFromTemplate([
          { label: _("ctxmenu-copy"), role: "copy" },
          { type: "separator" },
          { label: _("ctxmenu-select-all"), role: "selectall" },
          { type: "separator" },
          ...commonEntries,
        ]).popup(core.getMainWindow(), params.x, params.y);
      } else {
        Menu.buildFromTemplate([...commonEntries]).popup(
          core.getMainWindow(),
          params.x,
          params.y
        );
      }
      break;

    case "copy-img":
      if (true) {
        Menu.buildFromTemplate([
          {
            label: _("ctxmenu-copyimage"),
            click: () => {
              try {
                core
                  .getMainWindow()
                  .webContents.copyImageAt(params[0], params[1]);
              } catch (error) {
                log.error(error);
              }
            },
          },
          { type: "separator" },
          ...commonEntries,
        ]).popup(core.getMainWindow(), params.x, params.y);
      }
      break;

    case "minimal":
    default:
      Menu.buildFromTemplate([...commonEntries]).popup(
        core.getMainWindow(),
        params.x,
        params.y
      );
      break;
  }
};
