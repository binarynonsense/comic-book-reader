/**
 * @license
 * Copyright 2025 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function show(...args) {
  generic(...args);
}

function generic(text, duration, onClick, escapeMarkup = true) {
  // ref: https://github.com/apvarun/toastify-js/blob/master/README.md
  let toast = Toastify({
    text,
    // style: {
    //   background: "linear-gradient(to right, #00b09b, #96c93d)",
    // },
    offset: {
      x: 30,
      y: 30,
    },
    close: true,
    onClick: () => {
      if (onClick) onClick();
      toast.hideToast();
    },
    duration,
    stopOnFocus: true,
    escapeMarkup,
  }).showToast();
}
