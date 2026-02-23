/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

exports.FileExtension = {
  NOT_SET: "not set",

  CBZ: "cbz",
  ZIP: "zip",
  CBR: "cbr",
  RAR: "rar",
  EPUB: "epub",
  PDF: "pdf",
  CB7: "cb7",
  SEVENZIP: "7z",
  MOBI: "mobi",
  AZW3: "azw3",
  FB2: "fb2",

  JPG: "jpg",
  JPEG: "jpeg",
  PNG: "png",
  WEBP: "webp",
  BMP: "bmp",
  AVIF: "avif",

  WAV: "wav",
  MP3: "mp3",
  OGG: "ogg",
  M3U: "m3u",
  M3U8: "m3u8",
  PLS: "pls",
  XSPF: "xspf",

  WEBM: "webm",
  MP4: "mp4",
  AVI: "avi",
  MKV: "mkv",
  OGV: "ogv",

  TMP: "tmp",
};

exports.FileDataState = {
  NOT_SET: "not set",
  LOADING: "loading",
  LOADED: "loaded",
};

exports.FileDataType = {
  NOT_SET: "not set",

  ZIP: "zip",
  RAR: "rar",
  SEVENZIP: "7z",

  PDF: "pdf",
  MOBI: "mobi",
  AZW3: "azw3",
  FB2: "fb2",
  FB2_ZIPPED: "fb2 zipped",
  EPUB: "epub",
  EPUB_COMIC: "epub comic",
  EPUB_EBOOK: "epub ebook",

  IMG: "img",
  IMGS_FOLDER: "imgs folder",
  JPG: "jpg",
  PNG: "png",
  WEBP: "webp",
  BMP: "bmp",
  AVIF: "avif",

  WWW: "www",
};

exports.BookType = {
  NOT_SET: "not set",
  COMIC: "comic",
  EBOOK: "ebook",
};
