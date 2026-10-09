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

let g_session = {};

let sendIpcToRenderer;

exports.getType = function () {
  return "komga";
};

exports.getSession = function () {
  return g_session;
};

clearSession = function () {
  g_session = {
    url: undefined,
    username: undefined,
    email: undefined,
    password: undefined,
    token: undefined,
    apiKey: undefined,
    roles: [],
  };
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
      clearSession();
      g_session.url = serverUrl;
      g_session.userAgent = g_customUserAgent;
      const userData = await response.json();
      g_session.roles = Array.isArray(userData.roles) ? userData.roles : [];
      g_session.canDownload = g_session.roles.includes("FILE_DOWNLOAD");
      g_session.canStream = g_session.roles.includes("PAGE_STREAMING");
      log.debug(g_session.roles);

      if (isApiKeyMode) {
        log.debug("[SERVERS] [KOMGA] logged via Komga API Key");
        g_session.apiKey = credentials.apiKey;
        result.success = true;
        result.isKomga = true;
        return result;
      } else {
        const token = response.headers.get("x-auth-token");
        if (token) {
          log.debug("[SERVERS] [KOMGA] received Komga X-Auth-Token");
          g_session.email = credentials.email;
          g_session.password = credentials.password;
          g_session.token = token;
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
    log.error("[SERVERS] [KOMGA] error getting libraries: " + error);
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
    log.error(`[SERVERS] [KOMGA] error getting library ${id}: ` + error);
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
    log.error(`[SERVERS] [KOMGA] error getting series: ` + error);
    return undefined;
  }
};

exports.getBooksInSeries = async function (seriesId, pageIndex = 0, size = 20) {
  try {
    exports.cancelThumbsRetrieval();
    if (!seriesId) {
      return undefined;
    }
    const url = `${g_session.url}/api/v1/series/${seriesId}/books?page=${pageIndex}&size=${size}&sort=metadata.numberSort,asc&sort=name,asc`;
    const response = await fetchUrlGet(url);
    const pagedResult = await response.json();
    return pagedResult;
  } catch (error) {
    log.error(
      `[SERVERS] [KOMGA] error getting books for series ${seriesId}: ` + error,
    );
    return undefined;
  }
};

exports.getBook = async function (id) {
  try {
    const { _ } = require("../../shared/main/i18n");
    exports.cancelThumbsRetrieval();
    if (!id) {
      return undefined;
    }
    const url = `${g_session.url}/api/v1/books/${id}`;
    const response = await fetchUrlGet(url);
    const data = await response.json();
    if (!g_session.canStream || data?.media?.mediaType?.includes("epub")) {
      data.disableReading = true;
    }
    data.allowDownload = g_session.canDownload;
    // localize authors
    const rolesMap = {
      writer: _("tool-metadata-data-writer"),
      penciller: _("tool-metadata-data-penciller"),
      inker: _("tool-metadata-data-inker"),
      colorist: _("tool-metadata-data-colorist"),
      cover: _("tool-metadata-data-coverartist"),
      letterer: _("tool-metadata-data-letterer"),
      editor: _("tool-metadata-data-editor"),
    };
    if (data?.metadata?.authors && Array.isArray(data.metadata.authors)) {
      data.metadata.authors = data.metadata.authors.map((author) => ({
        ...author,
        role: rolesMap[author.role.toLowerCase()] || author.role,
      }));
    }
    //
    return data;
  } catch (error) {
    log.error(`[SERVERS] [KOMGA] error getting book ${id}: ` + error);
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
      `[SERVERS] [KOMGA] couldn't get alphabetical groups for library ${libraryId}: ` +
        error,
    );
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// ACTIVITY //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getActivity = async function () {
  try {
    exports.cancelThumbsRetrieval();
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
    log.error("[SERVERS] [KOMGA] error getting activity data: " + error);
    return {};
  }
};

exports.getInProgressBooks = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/books?read_status=IN_PROGRESS&page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("[SERVERS] [KOMGA] failed to get in-progress books: " + error);
    return undefined;
  }
};

exports.getRecentlyAddedBooks = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/books/latest?page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("[SERVERS] [KOMGA] failed to get latest books: " + error);
    return undefined;
  }
};

exports.getRecentlyAddedSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/series/new?page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("[SERVERS] [KOMGA] failed to get new series: " + error);
    return undefined;
  }
};

exports.getRecentlyUpdatedSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/v1/series/updated?page=${page}&size=${size}`;
    const response = await fetchUrlGet(url);
    return await response.json();
  } catch (error) {
    log.error("[SERVERS] [KOMGA] failed to get updated series: " + error);
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
    log.error(
      "[SERVERS] [KOMGA] failed to get completed recently read books: " + error,
    );
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
    log.error("[SERVERS] [KOMGA] failed to search series: " + error);
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
    log.error("[SERVERS] [KOMGA] failed to search books: " + error);
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// DOWNLOAD //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_activeDownloadController = null;

exports.downloadBook = async function (bookId, fileName) {
  if (g_activeDownloadController) {
    return false;
  }
  g_activeDownloadController = new AbortController();
  const { signal } = g_activeDownloadController;

  const { dialog } = require("electron");
  const { open, rm } = require("fs/promises");
  const { Readable, Transform } = require("stream");
  const { pipeline } = require("stream/promises");

  let outputFilePath = null;
  try {
    const url = `${g_session.url}/api/v1/books/${bookId}/file`;
    log.debug("[SERVERS] [KOMGA] downloading: " + url);

    const response = await fetchUrlGet(url, { signal });
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
      log.debug("[SERVERS] [KOMGA] downloading was canceled");
      return false;
    }
    log.debug("[SERVERS] [KOMGA] to: " + filePath);
    outputFilePath = filePath;

    sendIpcToRenderer("show-modal-downloading", filePath);

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
              `[SERVERS] [KOMGA] download progress: ${current5PercentStep}% (${downloadedBytes}/${totalBytes} bytes)`,
            );
            sendIpcToRenderer(
              "update-modal-downloading.percentage",
              current5PercentStep,
            );
          }
        } else {
          log.debug(
            `[SERVERS] [KOMGA] downloaded: ${downloadedBytes} bytes (total size unknown)`,
          );
        }
        callback(null, chunk);
      },
    });

    const nodeStream = Readable.fromWeb(response.body);
    await pipeline(nodeStream, progressTrackingStream, writeStream, { signal });

    log.debug(
      `[SERVERS] [KOMGA] ${bookId} successfully saved to ${outputFilePath}`,
    );
    sendIpcToRenderer("close-active-modal");
    return true;
  } catch (error) {
    sendIpcToRenderer("close-active-modal");
    if (error.name === "AbortError") {
      log.debug(
        `[SERVERS] [KOMGA] download for ${bookId} was canceled by the user`,
      );
    } else {
      sendIpcToRenderer(
        "show-modal-download-error",
        error
          ? error.message
            ? error.message
            : error.toString()
          : "Unknown error",
      );
      log.error("[SERVERS] [KOMGA] " + error);
    }

    if (outputFilePath) {
      try {
        await rm(outputFilePath, { force: true });
      } catch (cleanupError) {
        log.error("[SERVERS] [KOMGA] " + cleanupError);
      }
    }
    return false;
  } finally {
    g_activeDownloadController = null;
  }
};

exports.cancelDownloadBook = function () {
  if (g_activeDownloadController) {
    g_activeDownloadController.abort();
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
    log.error("[SERVERS] [KOMGA] " + error);
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
        `[SERVERS] [KOMGA] synced progress for book ${bookId}: page ${page} (completed: ${completed})`,
      );
      return true;
    }
    throw new Error(`Unexpected status code: ${response.status}`);
  } catch (error) {
    log.error(
      `[SERVERS] [KOMGA] failed to update reading progress for book ${bookId}: ` +
        error,
    );
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
          `[SERVERS] [KOMGA] got progress for book ${bookId}: page ${bookData.readProgress.page}`,
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
    log.error(
      `[SERVERS] [KOMGA] failed to get reading progress for book ${bookId}: ` +
        error,
    );
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
        log.editor(
          `[SERVERS] [KOMGA] thumbnail download for ${task.id} successfully aborted`,
        );
      } else {
        log.error(
          `[SERVERS] [KOMGA] failed to download thumbnail for ${task.id}: ` +
            error,
        );
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
    log.editor(
      "[SERVERS] [KOMGA] all pending thumbnail downloads were canceled",
    );
  }
};
