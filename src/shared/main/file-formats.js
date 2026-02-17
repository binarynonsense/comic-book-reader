/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

module.exports = {
  ...require("./file-formats/epub"),
  ...require("./file-formats/epub-custom"),
  ...require("./file-formats/mutool-epub"),
  ...require("./file-formats/mutool-pdf"),
  ...require("./file-formats/pdfkit"),
  ...require("./file-formats/pdfium"),
  ...require("./file-formats/unrar-js"),
  ...require("./file-formats/rar"),
  ...require("./file-formats/seven-zip"),
  ...require("./file-formats/adm-zip"),
};
