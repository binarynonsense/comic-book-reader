/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fileUtils = require("../../shared/main/file-utils");
const log = require("../../shared/main/logger");
const { net } = require("electron");

//////////////////////////////////////////////////////////////////////////////
// SETUP /////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_customUserAgent;

let g_session = {
  url: null,
  email: null,
  password: null,
  token: null,
};

let sendIpcToRenderer;

exports.getSession = function () {
  return g_session;
};

exports.getUrl = function () {
  return g_session.url;
};

exports.setIpcs = async function (_sendIpcToRenderer) {
  sendIpcToRenderer = _sendIpcToRenderer;
};

//////////////////////////////////////////////////////////////////////////////
// LOG IN ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.login = async function (serverUrl, username, password) {
  const { app } = require("electron");
  const os = require("os");
  const platform = os.platform();
  let osName = "Unknown OS";
  if (platform === "win32") {
    osName = "Windows";
  } else if (platform === "linux") {
    osName = "Linux";
  } else if (platform === "darwin") {
    osName = "macOS";
  }
  const version = app.getVersion();
  g_customUserAgent = `ACBR/${version} (${osName})`;
  ////////////
  const result = {
    success: false,
    isKomga: false,
    error: null,
  };

  try {
    const encodedCredentials = Buffer.from(`${username}:${password}`).toString(
      "base64",
    );
    const authHeader = `Basic ${encodedCredentials}`;

    const sanitizedUrl = serverUrl.replace(/\/+\$/, "");
    const loginUrl = `${sanitizedUrl}/api/v2/users/me`;

    const response = await net.fetch(loginUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "User-Agent": g_customUserAgent,
        "X-Auth-Token": "",
      },
    });

    if (response.ok) {
      const token = response.headers.get("x-auth-token");

      if (token) {
        log.debug("received Komga X-Auth-Token");
        g_session.url = serverUrl;
        g_session.email = username;
        g_session.password = password;
        g_session.token = token;
        g_session.userAgent = g_customUserAgent;
        result.success = true;
        result.isKomga = true;
        return result;
      } else {
        // login succeeded but no X-Auth-Token in response headers
        result.isKomga = true;
        result.error = "Missing session token header.";
        return result;
      }
    }

    if (response.status === 401) {
      const wwwAuth = response.headers.get("www-authenticate");
      const isKomga = !!(wwwAuth && wwwAuth.toLowerCase().includes("basic"));
      if (isKomga) {
        result.error = "Invalid email or password.";
      } else {
        // received 401 from an unknown non-komga server
        result.error = "Unauthorized access to a non-Komga server.";
      }
      result.isKomga = isKomga;
      return result;
    }

    result.error = `Server responded with status code: ${response.status}.`;
    return result;
  } catch (error) {
    result.error = `Network connection failed: ${error.message || error}`;
    return result;
  }
};

//////////////////////////////////////////////////////////////////////////////
// SECTIONS //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getLibraries = async function () {
  exports.cancelThumbsRetrieval();
  const url = `${g_session.url}/api/v1/libraries`;
  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const libraries = await response.json();
    return libraries;
  } catch (error) {
    log.error(error);
    return undefined;
  }
};

exports.getLibrary = async function (id) {
  exports.cancelThumbsRetrieval();
  if (!id) {
    return undefined;
  }
  const url = `${g_session.url}/api/v1/libraries/${id}`;
  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const library = await response.json();
    return library;
  } catch (error) {
    log.error(`error fetching library ${id}: ` + error);
    return undefined;
  }
};

exports.getSeriesInLibrary = async function (
  libraryId,
  pageIndex = 0,
  size = 20,
) {
  exports.cancelThumbsRetrieval();
  if (!libraryId) {
    return undefined;
  }
  const url = `${g_session.url}/api/v1/series?library_id=${libraryId}&deleted=false&page=${pageIndex}&size=${size}&sort=metadata.titleSort,asc`;
  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const pagedResult = await response.json();
    return pagedResult;
  } catch (error) {
    log.error(`error fetching series for library ${libraryId}: ` + error);
    return undefined;
  }
};

exports.getBooksInSeries = async function (seriesId, pageIndex = 0, size = 20) {
  if (!seriesId) {
    return undefined;
  }
  const url = `${g_session.url}/api/v1/series/${seriesId}/books?page=${pageIndex}&size=${size}&sort=metadata.numberSort,asc&sort=name,asc`;
  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const pagedResult = await response.json();
    return pagedResult;
  } catch (error) {
    log.error(`error fetching books for series ${seriesId}: ` + error);
    return undefined;
  }
};

exports.getBook = async function (id) {
  if (!id) {
    return undefined;
  }
  const url = `${g_session.url}/api/v1/books/${id}`;
  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const book = await response.json();
    return book;
  } catch (error) {
    log.error(`error fetching book ${id}: ` + error);
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// HOME //////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getHome = async function () {
  try {
    const size = 5;
    const results = await Promise.allSettled([
      exports.getInProgressBooks(0, size),
      exports.getRecentlyAddedBooks(0, size),
      exports.getRecentlyAddedSeries(0, size),
      exports.getRecentlyUpdatedSeries(0, size),
    ]);

    return {
      inProgress:
        results[0].status === "fulfilled" ? results[0].value : undefined,
      latestBooks:
        results[1].status === "fulfilled" ? results[1].value : undefined,
      newSeries:
        results[2].status === "fulfilled" ? results[2].value : undefined,
      updatedSeries:
        results[3].status === "fulfilled" ? results[3].value : undefined,
    };
  } catch (error) {
    log.error("error getting home data: " + error);
    return {};
  }
};

exports.getInProgressBooks = async function (page = 0, size = 20) {
  const url = `${g_session.url}/api/v1/books?read_status=IN_PROGRESS&page=${page}&size=${size}`;

  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log.error("failed to fetch in-progress books: " + error);
    return undefined;
  }
};

exports.getRecentlyAddedBooks = async function (page = 0, size = 20) {
  const url = `${g_session.url}/api/v1/books/latest?page=${page}&size=${size}`;

  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log.error("failed to fetch latest books: " + error);
    return undefined;
  }
};

exports.getRecentlyAddedSeries = async function (page = 0, size = 20) {
  const url = `${g_session.url}/api/v1/series/new?page=${page}&size=${size}`;

  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log.error("failed to fetch new series: " + error);
    return undefined;
  }
};

exports.getRecentlyUpdatedSeries = async function (page = 0, size = 20) {
  const url = `${g_session.url}/api/v1/series/updated?page=${page}&size=${size}`;

  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log.error("failed to fetch updated series: " + error);
    return undefined;
  }
};

exports.getRecentlyFinishedBooks = async function (page = 0, size = 20) {
  // const url = `${g_session.url}/api/v1/books?read_status=IN_PROGRESS&read_status=READ&sort=readProgress.lastModified,desc&page=${page}&size=${size}`;
  const url = `${g_session.url}/api/v1/books?read_status=READ&sort=readProgress.lastModified,desc&page=${page}&size=${size}`;

  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log.error("failed to fetch completed recently read books: " + error);
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// DOWNLOAD //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.downloadBook = async function (bookId, fileName) {
  const { dialog } = require("electron");
  const { open, rm } = require("fs/promises");
  const { Readable, Transform } = require("stream");
  const { pipeline } = require("stream/promises");

  let outputFilePath = null;
  try {
    const url = `${g_session.url}/api/v1/books/${bookId}/file`;
    log.debug("downloading: " + url);
    const response = await net.fetch(url, {
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`failed to download book: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const contentType = response.headers.get("content-type") || "";
    let extension = "cbz";
    if (
      contentType.includes("application/x-cbz") ||
      contentType.includes("application/zip")
    ) {
      extension = "cbz";
    } else if (
      contentType.includes("application/x-cbr") ||
      contentType.includes("application/x-rar")
    ) {
      extension = "cbr";
    } else if (contentType.includes("application/pdf")) {
      extension = "pdf";
    } else if (contentType.includes("application/epub+zip")) {
      extension = "epub";
    }

    fileName = fileName.replace(/\.[^/.]+\$/, "");
    fileName = `${fileName}.${extension}`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save Comic Book",
      defaultPath: fileName,
      filters: [
        {
          name: "Comic Book Archive",
          extensions: [extension, "cbz", "cbr", "pdf", "epub"],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || !filePath) {
      log.debug("downloading was canceled");
      return false;
    }
    log.debug("to: " + filePath);
    outputFilePath = filePath;

    // download
    const fileHandle = await open(outputFilePath, "w");
    const writeStream = fileHandle.createWriteStream();
    let downloadedBytes = 0;
    let lastLoggedPercent = -1;
    const progressTrackingStream = new Transform({
      transform(chunk, encoding, callback) {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const actualPercent = (downloadedBytes / totalBytes) * 100;
          const current5PercentStep = Math.floor(actualPercent / 5) * 5;

          if (current5PercentStep > lastLoggedPercent) {
            lastLoggedPercent = current5PercentStep;
            log.debug(
              `download Progress: ${current5PercentStep}% (${downloadedBytes}/${totalBytes} bytes)`,
            );
          }
        } else {
          log.debug(
            `downloaded: ${downloadedBytes} bytes (Total size unknown)`,
          );
        }
        callback(null, chunk);
      },
    });
    // web stream to node stream so I can get the progress
    const nodeStream = Readable.fromWeb(response.body);
    // connect the progress tracking to the pipe
    await pipeline(nodeStream, progressTrackingStream, writeStream);
    log.debug(`${bookId} successfully saved to ${outputFilePath}`);
    return true;
  } catch (error) {
    log.error(error);
    // clean up if needed
    if (outputFilePath) {
      try {
        await rm(outputFilePath, { force: true });
      } catch (cleanupError) {
        log.error(cleanupError);
      }
    }
    return false;
  }
};

//////////////////////////////////////////////////////////////////////////////
// PAGE //////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.loadPageImageBuffer = async function (bookId, pageNumber, session) {
  try {
    const url = `${session.url}/api/v1/books/${bookId}/pages/${pageNumber}`;
    const response = await net.fetch(url, {
      headers: {
        "X-Auth-Token": session.token,
        "User-Agent": session.userAgent,
        Accept: "image/jpeg", // so pdf pages are rasterized
      },
    });
    if (!response.ok) {
      throw new Error(`failed to fetch page: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    // convert to a node buffer
    const buffer = Buffer.from(arrayBuffer);
    return { success: true, buffer };
  } catch (error) {
    log.error(error);
    return { error };
  }
};

exports.updateReadingProgress = async function (
  bookId,
  page,
  completed = false,
) {
  if (!bookId) {
    return false;
  }
  const url = `${g_session.url}/api/v1/books/${bookId}/read-progress`;
  const payload = {
    page: page,
    completed: completed,
  };
  try {
    const response = await net.fetch(url, {
      method: "PATCH",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    // HTTP 204 No Content = successful update
    if (response.status === 204) {
      log.debug(
        `synced progress for book ${bookId}: page ${page} (completed: ${completed})`,
      );
      return true;
    }
    throw new Error(`Unexpected status code: ${response.status}`);
  } catch (error) {
    log.error(`failed to update reading progress for book ${bookId}: ` + error);
    return false;
  }
};

exports.getReadingProgress = async function (bookId) {
  if (!bookId) {
    throw new Error(`no book id`);
  }
  const url = `${g_session.url}/api/v1/books/${bookId}`;
  try {
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": g_session.token,
        "User-Agent": g_customUserAgent,
        Accept: "application/json",
      },
    });
    if (response.status === 200) {
      const bookData = await response.json();
      if (bookData.readProgress) {
        log.debug(
          `got progress for book ${bookId}: page ${bookData.readProgress.page}`,
        );
        return {
          page: bookData.readProgress.page,
          completed: bookData.readProgress.completed,
        };
      }
      return { page: 1, completed: false };
    }
    throw new Error(`HTML error code: ${response.status}`);
  } catch (error) {
    log.error(`failed to get reading progress for book ${bookId}: ` + error);
    return { page: 1, completed: false };
  }
};

//////////////////////////////////////////////////////////////////////////////
// THUMBNAILS ////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_thumbsRetrievalAbortController = null;

exports.loadBookThumb = function (bookId) {
  if (!bookId) return;
  exports.loadBooksThumbs([bookId]);
};

exports.loadBooksThumbs = async function (bookIds) {
  // cancel previous batch if any
  if (g_thumbsRetrievalAbortController) {
    g_thumbsRetrievalAbortController.abort();
  }
  g_thumbsRetrievalAbortController = new AbortController();
  const { signal } = g_thumbsRetrievalAbortController;
  // run them concurrently
  const fetchPromises = bookIds.map(async (bookId) => {
    try {
      const url = `${g_session.url}/api/v1/books/${bookId}/thumbnail`;
      // this one includes the signal so I can abort it
      const response = await net.fetch(url, {
        signal,
        headers: {
          "X-Auth-Token": g_session.token,
          "User-Agent": g_customUserAgent,
        },
      });
      if (!response.ok) {
        throw new Error(`Status: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mime = fileUtils.getFileTypeFromBuffer(buffer, true);
      if (signal.aborted) return;
      sendIpcToRenderer("render-book-thumb", bookId, buffer, mime);
    } catch (error) {
      if (error.name === "AbortError") {
        log.debug(`thumbnail fetch for book ${bookId} successfully aborted`);
      } else {
        log.error(`failed to fetch thumbnail for book ${bookId}: ` + error);
      }
    }
  });
  await Promise.allSettled(fetchPromises);
  // clean up
  g_thumbsRetrievalAbortController = null;
};

exports.loadSeriesThumb = function (seriesId) {
  if (!seriesId) return;
  exports.loadSeriesThumbs([seriesId]);
};

exports.loadSeriesThumbs = async function (seriesIds) {
  // TODO: mostly the same as book thumbs, maybe merge?
  if (g_thumbsRetrievalAbortController) {
    g_thumbsRetrievalAbortController.abort();
  }
  g_thumbsRetrievalAbortController = new AbortController();
  const { signal } = g_thumbsRetrievalAbortController;
  const fetchPromises = seriesIds.map(async (seriesId) => {
    try {
      const url = `${g_session.url}/api/v1/series/${seriesId}/thumbnail`;
      const response = await net.fetch(url, {
        signal,
        headers: {
          "X-Auth-Token": g_session.token,
          "User-Agent": g_customUserAgent,
        },
      });
      if (!response.ok) {
        throw new Error(`Status: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mime = fileUtils.getFileTypeFromBuffer(buffer, true);
      if (signal.aborted) return;
      sendIpcToRenderer("render-series-thumb", seriesId, buffer, mime);
    } catch (error) {
      if (error.name === "AbortError") {
        log.debug(
          `thumbnail fetch for series ${seriesId} was successfully aborted`,
        );
      } else {
        log.error(`failed to fetch thumbnail for series ${seriesId}: ` + error);
      }
    }
  });
  await Promise.allSettled(fetchPromises);
  // clean up
  g_thumbsRetrievalAbortController = null;
};

exports.cancelThumbsRetrieval = function () {
  if (g_thumbsRetrievalAbortController) {
    g_thumbsRetrievalAbortController.abort();
    g_thumbsRetrievalAbortController = null;
    log.debug("all pending thumbnail fetches were canceled");
  }
};
