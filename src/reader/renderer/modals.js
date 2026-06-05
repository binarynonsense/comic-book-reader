/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

import * as modals from "../../shared/renderer/modals.js";
import { sendIpcToMain, on } from "../renderer.js";

let g_openModal;

///////////////////////////////////////////////////////////////////////////////
// EXPORTS ////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// NOTE: getOpenModal, showModal and modalClosed  are called from
// home-screen's renderer. initModalsOnIpcCallbacks fron reader's renderer

export function getOpenModal() {
  return g_openModal;
}

export function showModal(config) {
  g_openModal = modals.show(config);
}

export function modalClosed() {
  g_openModal = undefined;
}

export function initModalsOnIpcCallbacks() {
  on("close-modal", () => {
    if (g_openModal) {
      modals.close(g_openModal);
      modalClosed();
    }
  });

  on(
    "show-modal-prompt",
    (question, defaultValue, textButton1, textButton2, mode = 0) => {
      showModalPrompt(question, defaultValue, textButton1, textButton2, mode);
    },
  );

  on("show-modal-prompt-password", (...args) => {
    showModalPromptPassword(...args);
  });

  on("show-modal-info", (...args) => {
    showModalAlert(...args);
  });

  on("show-modal-question-openas", (...args) => {
    showModalQuestionOpenAs(...args);
  });

  on("show-modal-request-open-confirmation", (...args) => {
    showModalRequestOpenConfirmation(...args);
  });

  on("show-modal-properties", (...args) => {
    showModalProperties(...args);
  });

  on("show-modal-quick-menu", (...args) => {
    showModalQuickMenu(...args);
  });
}

///////////////////////////////////////////////////////////////////////////////
// MODAL CREATORS /////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function showModalPrompt(
  question,
  defaultValue,
  textButton1,
  textButton2,
  mode = 0,
) {
  if (g_openModal) {
    return;
  }
  if (mode === 0) {
    g_openModal = modals.show({
      title: question,
      message: defaultValue,
      zIndexDelta: -450,
      input: {},
      close: {
        callback: () => {
          modalClosed();
        },
        key: "Escape",
      },
      buttons: [
        {
          text: textButton1.toUpperCase(),
          callback: (showFocus, value) => {
            sendIpcToMain("go-to-page", value);
            modalClosed();
          },
          key: "Enter",
        },
        {
          text: textButton2.toUpperCase(),
          callback: () => {
            modalClosed();
          },
        },
      ],
    });
  } else if (mode === 1) {
    g_openModal = modals.show({
      title: question,
      message: defaultValue,
      zIndexDelta: -450,
      input: {},
      close: {
        callback: () => {
          modalClosed();
        },
        key: "Escape",
      },
      buttons: [
        {
          text: textButton1.toUpperCase(),
          callback: (showFocus, value) => {
            sendIpcToMain("enter-scale-value", parseInt(value));
            modalClosed();
          },
          key: "Enter",
        },
        {
          text: textButton2.toUpperCase(),
          callback: () => {
            modalClosed();
          },
        },
      ],
    });
  }
  if (mode === 2) {
    g_openModal = modals.show({
      title: question,
      message: defaultValue,
      zIndexDelta: -450,
      input: {},
      close: {
        callback: () => {
          modalClosed();
        },
        key: "Escape",
      },
      buttons: [
        {
          text: textButton1.toUpperCase(),
          callback: (showFocus, value) => {
            sendIpcToMain("go-to-percentage", value);
            modalClosed();
          },
          key: "Enter",
        },
        {
          text: textButton2.toUpperCase(),
          callback: () => {
            modalClosed();
          },
        },
      ],
    });
  }
}

function showModalPromptPassword(title, message, textButton1, textButton2) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
    input: { type: "password" },
    close: {
      callback: () => {
        sendIpcToMain("password-canceled");
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: (showFocus, value) => {
          sendIpcToMain("password-entered", value);
          modalClosed();
        },
        key: "Enter",
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          sendIpcToMain("password-canceled");
          modalClosed();
        },
      },
    ],
  });
}

function showModalAlert(title, message, textButton1) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          modalClosed();
        },
        key: "Enter",
      },
    ],
  });
}

function showModalQuestionOpenAs(
  title,
  message,
  textButton1,
  textButton2,
  filePath,
) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          sendIpcToMain("booktype-entered", filePath, BookType.COMIC);
          modalClosed();
        },
        key: "Enter",
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          sendIpcToMain("booktype-entered", filePath, BookType.EBOOK);
          modalClosed();
        },
      },
    ],
  });
}

function showModalRequestOpenConfirmation(
  title,
  message,
  textButton1,
  textButton2,
  filePath,
) {
  if (g_openModal) {
    return;
  }
  g_openModal = modals.show({
    title: title,
    message: message,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: [
      {
        text: textButton1.toUpperCase(),
        callback: () => {
          sendIpcToMain("open-file", filePath);
          modalClosed();
        },
      },
      {
        text: textButton2.toUpperCase(),
        callback: () => {
          modalClosed();
        },
      },
    ],
  });
}

function showModalProperties(title, message, textButton1, textButton2) {
  if (g_openModal) {
    return;
  }
  let buttons = [];
  if (textButton2) {
    buttons.push({
      text: textButton2.toUpperCase(),
      callback: () => {
        modalClosed();
        sendIpcToMain("open-metadata-tool");
      },
    });
  }
  buttons.push({
    text: textButton1.toUpperCase(),
    callback: () => {
      modalClosed();
    },
  });
  g_openModal = modals.show({
    title: title,
    log: { message: message, useDiv: true },
    frameWidth: 600,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape",
    },
    buttons: buttons,
  });
}

function showModalQuickMenu(
  title,
  textButtonBack,
  textCloseFile,
  textButtonFileBrowser,
  textButtonHistory,
  textButtonFullscreen,
  textButtonQuit,
  showFocus,
) {
  if (g_openModal) {
    return;
  }
  let buttons = [];
  buttons.push({
    text: textButtonBack.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
    },
  });
  if (!g_pagesContainerDiv) {
    g_pagesContainerDiv = document.getElementById("pages-container");
  }
  let fileOpen = g_pagesContainerDiv && g_pagesContainerDiv.innerHTML !== "";
  if (fileOpen) {
    buttons.push({
      text: textCloseFile.toUpperCase(),
      fullWidth: true,
      callback: () => {
        modalClosed();
        sendIpcToMain("close-file", true);
      },
    });
  }
  buttons.push({
    text: textButtonFileBrowser.toUpperCase(),
    fullWidth: true,
    callback: (showFocus) => {
      modalClosed();
      sendIpcToMain("open-file-browser-tool", showFocus);
    },
  });
  buttons.push({
    text: textButtonHistory.toUpperCase(),
    fullWidth: true,
    callback: (showFocus) => {
      modalClosed();
      sendIpcToMain("open-history-tool", showFocus);
    },
  });
  buttons.push({
    text: textButtonFullscreen.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("toggle-fullscreen");
    },
  });
  buttons.push({
    text: textButtonQuit.toUpperCase(),
    fullWidth: true,
    callback: () => {
      modalClosed();
      sendIpcToMain("quit");
    },
  });
  g_openModal = modals.show({
    showFocus: showFocus,
    title: title,
    frameWidth: 400,
    zIndexDelta: -450,
    close: {
      callback: () => {
        modalClosed();
      },
      key: "Escape," + g_navKeys.quickMenu[0],
      gpCommand: g_navButtons.quickMenu[0],
    },
    buttons: buttons,
  });
}
