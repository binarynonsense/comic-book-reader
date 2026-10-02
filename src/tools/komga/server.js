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
  apiKey: null,
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

exports.login = async function (serverUrl, credentials) {
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

  const result = {
    success: false,
    isKomga: false,
    error: null,
  };

  try {
    const sanitizedUrl = serverUrl.replace(/\/+\$/, "");
    const loginUrl = `${sanitizedUrl}/api/v2/users/me`;
    const headers = {
      "User-Agent": g_customUserAgent,
    };

    const isApiKeyMode = !!credentials.apiKey;

    if (isApiKeyMode) {
      headers["X-API-Key"] = credentials.apiKey;
    } else if (credentials.email && credentials.password) {
      const encodedCredentials = Buffer.from(
        `${credentials.email}:${credentials.password}`,
      ).toString("base64");
      headers["Authorization"] = `Basic ${encodedCredentials}`;
      headers["X-Auth-Token"] = "";
    } else {
      result.error = "Missing required credentials (apiKey or email/password).";
      return result;
    }

    const response = await net.fetch(loginUrl, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      g_session.url = serverUrl;
      g_session.userAgent = g_customUserAgent;

      if (isApiKeyMode) {
        log.debug("logged via Komga API Key");
        g_session.apiKey = credentials.apiKey;
        g_session.token = null;
        result.success = true;
        result.isKomga = true;
        return result;
      } else {
        const token = response.headers.get("x-auth-token");
        if (token) {
          log.debug("received Komga X-Auth-Token");
          g_session.email = credentials.email;
          g_session.password = credentials.password;
          g_session.token = token;
          g_session.apiKey = null;
          result.success = true;
          result.isKomga = true;
          return result;
        } else {
          result.isKomga = true;
          result.error = "Missing session token header.";
          return result;
        }
      }
    }

    if (response.status === 401) {
      const wwwAuth = response.headers.get("www-authenticate");
      const isKomga = !!(wwwAuth && wwwAuth.toLowerCase().includes("basic"));
      if (isKomga) {
        result.error = isApiKeyMode
          ? "Invalid API Key."
          : "Invalid email or password.";
      } else {
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
// HELPERS ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

async function fetchUrlGet(url, options = {}) {
  const currentSession = options.session || g_session;
  const currentUserAgent = currentSession.userAgent || g_customUserAgent;
  const headers = {
    "User-Agent": currentUserAgent,
  };
  if (options.accept) {
    headers["Accept"] = options.accept;
  }
  if (currentSession.apiKey) {
    headers["X-API-Key"] = currentSession.apiKey;
  } else if (currentSession.token) {
    headers["X-Auth-Token"] = currentSession.token;
  }
  const fetchOptions = {
    method: "GET",
    headers: headers,
  };
  if (options.signal) {
    fetchOptions.signal = options.signal;
  }
  const response = await net.fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
}

async function fetchUrlPost(url, body, options = {}) {
  const currentSession = options.session || g_session;
  const currentUserAgent = currentSession.userAgent || g_customUserAgent;
  const headers = {
    "User-Agent": currentUserAgent,
    "Content-Type": "application/json",
  };
  if (currentSession.apiKey) {
    headers["X-API-Key"] = currentSession.apiKey;
  } else if (currentSession.token) {
    headers["X-Auth-Token"] = currentSession.token;
  }
  const fetchOptions = {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  };
  if (options.signal) {
    fetchOptions.signal = options.signal;
  }
  const response = await net.fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
}

async function fetchUrlPatch(url, body, options = {}) {
  const currentSession = options.session || g_session;
  const currentUserAgent = currentSession.userAgent || g_customUserAgent;
  const headers = {
    "User-Agent": currentUserAgent,
    "Content-Type": "application/json",
  };
  if (currentSession.apiKey) {
    headers["X-API-Key"] = currentSession.apiKey;
  } else if (currentSession.token) {
    headers["X-Auth-Token"] = currentSession.token;
  }
  const fetchOptions = {
    method: "PATCH",
    headers: headers,
    body: JSON.stringify(body),
  };
  if (options.signal) {
    fetchOptions.signal = options.signal;
  }
  const response = await net.fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
}

//////////////////////////////////////////////////////////////////////////////
// SECTIONS //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getLibraries = async function () {
  try {
    exports.cancelThumbsRetrieval();
    const url = `${g_session.url}/api/v1/libraries`;
    const response = await fetchUrlGet(url);
    const libraries = await response.json();
    return libraries;
  } catch (error) {
    log.error(error);
    return undefined;
  }
};

exports.getLibrary = async function (id) {
  try {
    exports.cancelThumbsRetrieval();
    if (!id) {
      return undefined;
    }
    const url = `${g_session.url}/api/v1/libraries/${id}`;
    const response = await fetchUrlGet(url);
    const library = await response.json();
    return library;
  } catch (error) {
    log.error(`error fetching library ${id}: ` + error);
    return undefined;
  }
};

exports.getSeriesInLibrary = async function (
  libraryId,
  letter,
  pageIndex = 0,
  size = 20,
) {
  try {
    exports.cancelThumbsRetrieval();
    if (!libraryId || !letter) {
      return undefined;
    }

    let url = `${g_session.url}/api/v1/series?library_id=${libraryId}&deleted=false&page=${pageIndex}&size=${size}&sort=metadata.titleSort,asc`;
    if (letter === "ALL") {
      // the old basic fetch
    } else if (letter === "#") {
      // group all non a-z
      url += `&search_regex=${encodeURIComponent("^[^a-zA-Z],TITLE_SORT")}`;
    } else {
      url += `&search_regex=${encodeURIComponent("^(?i)" + letter + ",TITLE_SORT")}`;
    }
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error(`error getting letter series: ` + error);
    return undefined;
  }
};

exports.getBooksInSeries = async function (seriesId, pageIndex = 0, size = 20) {
  try {
    if (!seriesId) {
      return undefined;
    }
    const url = `${g_session.url}/api/v1/series/${seriesId}/books?page=${pageIndex}&size=${size}&sort=metadata.numberSort,asc&sort=name,asc`;
    const response = await fetchUrlGet(url);
    const pagedResult = await response.json();
    return pagedResult;
  } catch (error) {
    log.error(`error fetching books for series ${seriesId}: ` + error);
    return undefined;
  }
};

exports.getBook = async function (id) {
  try {
    if (!id) {
      return undefined;
    }
    const url = `${g_session.url}/api/v1/books/${id}`;
    const response = await fetchUrlGet(url);
    const book = await response.json();
    return book;
  } catch (error) {
    log.error(`error fetching book ${id}: ` + error);
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// LIBRARY ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getAlphabeticalGroups = async function (libraryId) {
  try {
    if (!libraryId) {
      return undefined;
    }
    const url = `${g_session.url}/api/v1/series/alphabetical-groups?library_id=${libraryId}`;
    const response = await fetchUrlGet(url);
    // example: ["#", "A", "B", "M", "Z"]
    return await response.json();
  } catch (error) {
    log.error(
      `couldn't get alphabetical groups for library ${libraryId}: ` + error,
    );
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// ACTIVITY //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getActivity = async function () {
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
      recentlyAddedBooks:
        results[1].status === "fulfilled" ? results[1].value : undefined,
      recentlyAddedSeries:
        results[2].status === "fulfilled" ? results[2].value : undefined,
      recentlyUpdatedSeries:
        results[3].status === "fulfilled" ? results[3].value : undefined,
    };
  } catch (error) {
    log.error("error getting activity data: " + error);
    return {};
  }
};

exports.getInProgressBooks = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/books?read_status=IN_PROGRESS&page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("failed to fetch in-progress books: " + error);
    return undefined;
  }
};

exports.getRecentlyAddedBooks = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/books/latest?page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("failed to fetch latest books: " + error);
    return undefined;
  }
};

exports.getRecentlyAddedSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/series/new?page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("failed to fetch new series: " + error);
    return undefined;
  }
};

exports.getRecentlyUpdatedSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/series/updated?page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("failed to fetch updated series: " + error);
    return undefined;
  }
};

exports.getRecentlyFinishedBooks = async function (page = 0, size = 20) {
  try {
    // const url = `${g_session.url}/api/v1/books?read_status=IN_PROGRESS&read_status=READ&sort=readProgress.lastModified,desc&page=${page}&size=${size}`;
    const url = `${g_session.url}/api/v1/books?read_status=READ&sort=readProgress.lastModified,desc&page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("failed to fetch completed recently read books: " + error);
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// SEARCH ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getSearchSeries = async function (
  searchQuery = "",
  page = 0,
  size = 20,
) {
  try {
    const url = `${g_session.url}/api/v1/series/list?page=${page}&size=${size}`;
    const response = await fetchUrlPost(url, { fullTextSearch: searchQuery });
    return await response.json();
  } catch (error) {
    log.error("failed to search series: " + error);
    return undefined;
  }
};

exports.getSearchBooks = async function (
  searchQuery = "",
  page = 0,
  size = 20,
) {
  try {
    const url = `${g_session.url}/api/v1/books/list?page=${page}&size=${size}`;
    const response = await fetchUrlPost(url, {
      fullTextSearch: searchQuery,
    });
    return await response.json();
  } catch (error) {
    log.error("failed to search books: " + error);
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
    const response = await fetchUrlGet(url);

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
    const response = await fetchUrlGet(url, {
      session: session,
      accept: "image/jpeg",
    });
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
  try {
    if (!bookId) {
      return false;
    }
    const url = `${g_session.url}/api/v1/books/${bookId}/read-progress`;
    const payload = {
      page: page,
      completed: completed,
    };
    const response = await fetchUrlPatch(url, payload);
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
  try {
    if (!bookId) {
      throw new Error(`no book id`);
    }
    const url = `${g_session.url}/api/v1/books/${bookId}`;
    const response = await fetchUrlGet(url);
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
  exports.loadThumbs([bookId], []);
};

exports.loadSeriesThumb = function (seriesId) {
  if (!seriesId) return;
  exports.loadThumbs([], [seriesId]);
};

exports.loadThumbs = async function (bookIds, seriesIds) {
  if (g_thumbsRetrievalAbortController) {
    g_thumbsRetrievalAbortController.abort();
  }
  g_thumbsRetrievalAbortController = new AbortController();
  const currentController = g_thumbsRetrievalAbortController;
  const { signal } = currentController;
  const cleanBookIds = Array.isArray(bookIds) ? bookIds : [];
  const cleanSeriesIds = Array.isArray(seriesIds) ? seriesIds : [];
  const tasks = [];
  cleanBookIds.forEach((id) => {
    tasks.push({
      id,
      url: `${g_session.url}/api/v1/books/${id}/thumbnail`,
    });
  });
  cleanSeriesIds.forEach((id) => {
    tasks.push({
      id,
      url: `${g_session.url}/api/v1/series/${id}/thumbnail`,
    });
  });
  const fetchPromises = tasks.map(async (task) => {
    try {
      const response = await fetchUrlGet(task.url, { signal });
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mime = fileUtils.getFileTypeFromBuffer(buffer, true);
      if (
        signal.aborted ||
        g_thumbsRetrievalAbortController !== currentController
      )
        return;
      sendIpcToRenderer("render-thumb", task.id, buffer, mime);
    } catch (error) {
      if (error.name === "AbortError" || signal.aborted) {
        log.debug(`thumbnail fetch for ${task.id} successfully aborted`);
      } else {
        log.error(`failed to fetch thumbnail for ${task.id}: ` + error);
      }
    }
  });
  await Promise.allSettled(fetchPromises);
  if (g_thumbsRetrievalAbortController === currentController) {
    g_thumbsRetrievalAbortController = null;
  }
};

exports.cancelThumbsRetrieval = function () {
  if (g_thumbsRetrievalAbortController) {
    g_thumbsRetrievalAbortController.abort();
    g_thumbsRetrievalAbortController = null;
    log.debug("all pending thumbnail fetches were canceled");
  }
};
