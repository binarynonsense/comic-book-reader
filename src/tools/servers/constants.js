/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export const Section = {
  LIBRARIES: "libraries",
  ACTIVITY: "activity",
  KEEP_READING: "keep_reading",
  RECENT_BOOKS: "recent_books",
  RECENT_SERIES: "recent_Series",
  UPDATED_SERIES: "updated_series",
  ON_DECK_SERIES: "on_deck_series",
  SEARCH_BOOKS: "search_books",
  SEARCH_SERIES: "search_series",
  //
  LIBRARY_SERIES: "library_series",
  SERIES_BOOKS: "series_books",
  BOOK: "book",
  SERIES_VOLUMES: "series_volumes",
  VOLUME_BOOKS: "volume_books",
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Section,
  };
}
