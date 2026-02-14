/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

///////////////////////////////////////////////////////////////////////////////
// EPUB ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

async function createEpub(
  imgPathsList,
  outputFilePath,
  tempFolderPath,
  imageStorageSelection,
) {
  try {
    const epub = require("../epub-generator");
    await epub.createComic(
      imgPathsList,
      outputFilePath,
      tempFolderPath,
      imageStorageSelection,
    );
    return;
  } catch (error) {
    throw error;
  }
}
exports.createEpub = createEpub;
