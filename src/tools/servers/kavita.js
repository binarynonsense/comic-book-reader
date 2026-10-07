/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { net } = require("electron");

const fileUtils = require("../../shared/main/file-utils");
const log = require("../../shared/main/logger");

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

exports.getType = function () {
  return "kavita";
};

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
    isKavita: false,
    error: null,
  };

  try {
    const sanitizedUrl = serverUrl.replace(/\/+\$/, "");
    const isApiKeyMode = !!credentials.apiKey;

    g_session.url = serverUrl;
    g_session.userAgent = g_customUserAgent;

    if (isApiKeyMode) {
      log.debug("logging to Kavita server using API Key");
      g_session.apiKey = credentials.apiKey;
      g_session.token = null;

      try {
        const verifyUrl = `${sanitizedUrl}/api/Account/refresh-account`;
        const response = await fetchUrlGet(verifyUrl, { session: g_session });

        if (response.ok) {
          try {
            const userUrl = `${sanitizedUrl}/api/Account`;
            const userResponse = await fetchUrlGet(userUrl);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              g_session.roles = Array.isArray(userData.roles)
                ? userData.roles
                : [];
              g_session.canDownload = g_session.roles.includes("Download");
            }
          } catch (userErr) {
            log.error("failed to fetch user roles: " + userErr);
            g_session.roles = [];
            g_session.canDownload = false;
          }

          result.success = true;
          result.isKavita = true;
          return result;
        }
      } catch (err) {
        result.isKavita = true;
        result.error = "Invalid API Key or server unreachable.";
        return result;
      }
    } else if (credentials.username && credentials.password) {
      const loginUrl = `${sanitizedUrl}/api/Account/login`;
      const body = {
        username: credentials.username,
        password: credentials.password,
        apiKey: "",
      };

      const response = await fetchUrlPost(loginUrl, body, {
        session: { userAgent: g_customUserAgent },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.token) {
          log.debug("received Kavita JWT Token");
          g_session.username = credentials.username;
          g_session.password = credentials.password;
          g_session.token = data.token;
          g_session.apiKey = data.apiKey || null;
          g_session.roles = Array.isArray(data.roles) ? data.roles : [];
          g_session.canDownload = g_session.roles.includes("Download");

          result.success = true;
          result.isKavita = true;

          return result;
        } else {
          result.isKavita = true;
          result.error = "Missing session token in response payload.";
          return result;
        }
      }
    } else {
      result.error =
        "Missing required credentials (API Key or username/password).";
      return result;
    }

    result.error = "Failed to establish a valid session.";
    return result;
  } catch (error) {
    if (error.message && error.message.includes("401")) {
      result.isKavita = true;
      result.error = isApiKeyMode
        ? "Invalid API Key."
        : "Invalid username or password.";
      return result;
    }
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
    headers["x-api-key"] = currentSession.apiKey;
  } else if (currentSession.token) {
    headers["Authorization"] = `Bearer ${currentSession.token}`;
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
  if (options.accept) {
    headers["Accept"] = options.accept;
  }
  if (currentSession.apiKey) {
    headers["x-api-key"] = currentSession.apiKey;
  } else if (currentSession.token) {
    headers["Authorization"] = `Bearer ${currentSession.token}`;
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

//////////////////////////////////////////////////////////////////////////////
// SECTIONS //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getLibraries = async function () {
  try {
    exports.cancelThumbsRetrieval();
    const url = `${g_session.url}/api/Library/libraries`;
    const response = await fetchUrlGet(url);
    const libraries = await response.json();
    return libraries;
  } catch (error) {
    log.error(`error getting libraries: ` + error);
    return undefined;
  }
};

exports.getLibrary = async function (id) {
  try {
    exports.cancelThumbsRetrieval();
    if (!id) {
      return undefined;
    }
    const libraries = await exports.getLibraries();
    if (Array.isArray(libraries)) {
      const library = libraries.find((lib) => String(lib.id) === String(id));
      return library;
    }
    return undefined;
  } catch (error) {
    log.error(`error getting library ${id}: ` + error);
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
    if (!libraryId) return undefined;
    const url = `${g_session.url}/api/Series/v2?pageNumber=${pageIndex + 1}&pageSize=${size}`;
    const body = {
      id: 0,
      name: "AllSeries",
      combination: 0,
      entityType: 0,
      limitTo: 0,
      sortOptions: {
        sortField: 1, // sort by name
        isAscending: true,
      },
      statements: [
        {
          field: 19, // filter by library
          comparison: 0, // equal
          value: String(libraryId),
        },
      ],
    };
    const response = await fetchUrlPost(url, body);
    let totalRecords = 0;
    let totalPages = 1;
    const paginationHeader =
      response.headers.get("Pagination") ||
      response.headers.get("X-Pagination");
    if (paginationHeader) {
      const meta = JSON.parse(paginationHeader);
      totalRecords = meta.totalItems || 0;
      totalPages = meta.totalPages || 1;
    }
    const seriesItems = await response.json();
    const formattedContent = seriesItems.map((series) => {
      return {
        id: series.id,
        booksCount: 0,
        metadata: { title: series.name || "" },
      };
    });
    return {
      content: formattedContent,
      number: pageIndex,
      totalPages: totalPages,
      totalElements: totalRecords,
    };
  } catch (error) {
    log.error(`error getting series: ` + error);
    return undefined;
  }
};

exports.getVolumesInSeries = async function (seriesId, pageIndex = 0) {
  try {
    const { _ } = require("../../shared/main/i18n");
    exports.cancelThumbsRetrieval();
    if (!seriesId) return undefined;
    const url = `${g_session.url}/api/Series/volumes?seriesId=${seriesId}`;
    const response = await fetchUrlGet(url);
    const data = await response.json();
    const formattedVolumes = data.map((volume) => {
      let displayTitle = "";
      if (volume.title && volume.title !== "" && volume.title !== "-100000") {
        displayTitle = `${_("tool-servers-type-volume")}: ${volume.name}`;
      } else {
        displayTitle = _("tool-servers-generic-name-volume");
      }
      return {
        id: volume.id,
        metadata: {
          title: displayTitle,
        },
      };
    });
    return {
      content: formattedVolumes,
      number: pageIndex,
      totalPages: 1,
      totalElements: formattedVolumes.length,
    };
  } catch (error) {
    log.error(`error getting volumes: ` + error);
    return undefined;
  }
};

exports.getBooksInVolume = async function (volumeId, pageIndex = 0) {
  try {
    const { _ } = require("../../shared/main/i18n");
    exports.cancelThumbsRetrieval();
    if (!volumeId) return undefined;
    const url = `${g_session.url}/api/Series/volume?volumeId=${volumeId}`;
    const response = await fetchUrlGet(url);
    const data = await response.json();
    const chapters = data.chapters || [];
    const formattedBooks = chapters.map((chapter) => {
      let displayTitle = "";
      if (
        chapter.title &&
        chapter.title !== "" &&
        chapter.title !== "-100000" &&
        chapter.title !== chapter.number
      ) {
        displayTitle = chapter.title;
      } else if (chapter.number !== undefined && chapter.number !== "-100000") {
        displayTitle = `${_("tool-servers-type-issue")}: ${chapter.number}`;
      } else {
        displayTitle = _("tool-servers-generic-name-issue");
      }
      return {
        id: chapter.id,
        metadata: {
          title: displayTitle,
          numberSort: chapter.number === -100000 ? 0 : chapter.number || 0,
        },
      };
    });
    return {
      content: formattedBooks,
      number: pageIndex,
      totalPages: 1,
      totalElements: formattedBooks.length,
    };
  } catch (error) {
    log.error(`error getting books: ` + error);
    return undefined;
  }
};

exports.getBook = async function (id) {
  try {
    const { _ } = require("../../shared/main/i18n");
    exports.cancelThumbsRetrieval();
    if (!id) return undefined;
    const url = `${g_session.url}/api/Chapter?chapterId=${id}`;
    const response = await fetchUrlGet(url);
    const data = await response.json();
    if (!data) return undefined;

    const fileNode =
      Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : {};
    const pagesCount =
      typeof data.pages === "number" ? data.pages : fileNode.pages || 0;
    const sizeInBytes = fileNode.bytes || 0;

    let formattedSize;
    if (sizeInBytes > 0) {
      const mb = sizeInBytes / (1024 * 1024);
      formattedSize = `${mb.toFixed(1)} MB`;
    }

    let displayTitle = "";
    if (
      data.title &&
      data.title !== "" &&
      data.title !== "-100000" &&
      data.title !== data.number
    ) {
      displayTitle = data.title;
    } else if (data.number !== undefined && data.number !== "-100000") {
      displayTitle = `${_("tool-servers-type-issue")}: ${data.number}`;
    } else {
      displayTitle = _("tool-servers-generic-name-issue");
    }

    // TODO: more
    const authorsArray = [];
    if (Array.isArray(data.writers)) {
      data.writers.forEach((writer) => {
        if (writer.name)
          authorsArray.push({ name: writer.name, role: "Writer" });
      });
    }
    if (Array.isArray(data.coverArtists)) {
      data.coverArtists.forEach((artist) => {
        if (artist.name)
          authorsArray.push({ name: artist.name, role: "Cover Artist" });
      });
    }

    const tagsArray = [];
    if (Array.isArray(data.genres)) {
      data.genres.forEach((genre) => {
        if (genre.title) tagsArray.push(genre.title);
      });
    }
    if (Array.isArray(data.tags)) {
      data.tags.forEach((tag) => {
        if (tag.title && !tagsArray.includes(tag.title))
          tagsArray.push(tag.title);
      });
    }

    // format:
    // 0	loose images (.jpg, .png, .webp, etc.)
    // 1	comic archives (.cbz, .cbr, .cb7, .cbt, .zip, .rar)
    // 2 	Mobi / Audio
    // 3	Epub (.epub)
    // 4	Pdf (.pdf)
    let disableReading = data.format === 2 || data.format === 3;

    return {
      id: parseInt(id, 10),
      name: displayTitle,
      seriesTitle: data.volumeTitle || "",
      url: fileNode.filePath || "",
      size: formattedSize,
      media: {
        pagesCount: pagesCount,
        mediaType: fileNode.extension,
      },
      metadata: {
        title: displayTitle,
        summary: data.summary || "",
        authors: authorsArray,
        tags: tagsArray,
        allowDownload: !!g_session.canDownload,
      },
      // TODO: readProgress.completed
      readProgress: { page: data.pagesRead, pageCount: data.pages },
      disableReading,
    };
  } catch (error) {
    log.error(`error getting book details for ${id}: ` + error);
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// LIBRARY ///////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getAlphabeticalGroups = async function (libraryId) {
  return undefined;
};

//////////////////////////////////////////////////////////////////////////////
// ACTIVITY //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getActivity = async function () {
  try {
    exports.cancelThumbsRetrieval();
    const size = 5;
    const results = await Promise.allSettled([
      exports.getOnDeckSeries(0, size),
      exports.getRecentlyAddedSeries(0, size),
      exports.getRecentlyUpdatedSeries(0, size),
      exports.getWantToReadSeries(0, size),
    ]);

    return {
      onDeckSeries:
        results[0].status === "fulfilled" ? results[0].value : undefined,
      recentlyAddedSeries:
        results[1].status === "fulfilled" ? results[1].value : undefined,
      recentlyUpdatedSeries:
        results[2].status === "fulfilled" ? results[2].value : undefined,
      wantToReadSeries:
        results[3].status === "fulfilled" ? results[3].value : undefined,
    };
  } catch (error) {
    log.error("error getting activity data: " + error);
    return {};
  }
};

exports.getOnDeckSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/Series/on-deck?libraryId=0`;
    const response = await fetchUrlPost(url, {});
    const data = await response.json();

    const start = page * size;
    const paginatedItems = data.slice(start, start + size);
    const totalPages = Math.ceil(data.length / size) || 1;

    return {
      content: paginatedItems.map((series) => ({
        id: series.id,
        booksCount: 0,
        metadata: { title: series.name || "" },
      })),
      number: page,
      totalPages: totalPages,
      totalElements: data.length,
    };
  } catch (error) {
    log.error("error getting on-deck series: " + error);
    return { content: [], number: page, totalPages: 1, totalElements: 0 };
  }
};

exports.getRecentlyAddedSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/Series/recently-added-v2?pageNumber=${page + 1}&pageSize=${size}`;
    const response = await fetchUrlPost(url, {});
    const data = await response.json();

    let totalRecords = data.length || 0;
    let totalPages = 1;
    const paginationHeader =
      response.headers.get("Pagination") ||
      response.headers.get("X-Pagination");
    if (paginationHeader) {
      const meta = JSON.parse(paginationHeader);
      totalRecords = meta.totalItems || 0;
      totalPages = meta.totalPages || 1;
    }

    return {
      content: data.map((series) => ({
        id: series.id,
        booksCount: 0,
        metadata: { title: series.name || "" },
      })),
      number: page,
      totalPages,
      totalElements: totalRecords,
    };
  } catch (error) {
    log.error("error getting recently added series: " + error);
    return { content: [], number: page, totalPages: 1, totalElements: 0 };
  }
};

exports.getRecentlyUpdatedSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/Series/recently-updated-series?pageNumber=${page + 1}&pageSize=${size}`;
    const response = await fetchUrlPost(url, {});
    const data = await response.json();

    let totalRecords = data.length || 0;
    let totalPages = 1;
    const paginationHeader =
      response.headers.get("Pagination") ||
      response.headers.get("X-Pagination");
    if (paginationHeader) {
      const meta = JSON.parse(paginationHeader);
      totalRecords = meta.totalItems || 0;
      totalPages = meta.totalPages || 1;
    }

    return {
      content: data.map((series) => ({
        id: series.id,
        booksCount: 0,
        metadata: { title: series.name || "" },
      })),
      number: page,
      totalPages: totalPages,
      totalElements: totalRecords,
    };
  } catch (error) {
    log.error("error getting recently updated series: " + error);
    return { content: [], number: page, totalPages: 1, totalElements: 0 };
  }
};

// NOTE: returns [] in the demo server, could be right but I don't know
exports.getRecentlyFinishedSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/Series/v2?pageNumber=${page + 1}&pageSize=${size}`;
    const body = {
      id: 0,
      name: "RecentlyFinished",
      combination: 0,
      entityType: 0,
      limitTo: 0,
      sortOptions: {
        sortField: 7, // ReadProgress timestamp
        isAscending: false,
      },
      statements: [
        {
          field: 20, // ReadProgress status (0 = unread, 1 = in progress, 2 = completed)
          comparison: 0,
          value: "2",
        },
      ],
    };

    const response = await fetchUrlPost(url, body);

    let totalRecords = 0;
    let totalPages = 1;

    const paginationHeader =
      response.headers.get("Pagination") ||
      response.headers.get("X-Pagination");
    if (paginationHeader) {
      const meta = JSON.parse(paginationHeader);
      totalRecords = meta.totalItems || 0;
      totalPages = meta.totalPages || 1;
    }

    const data = await response.json();

    return {
      content: data.map((series) => ({
        id: series.id,
        booksCount: series.booksCount || 0,
        metadata: { title: series.name || "" },
      })),
      number: page,
      totalPages: totalPages,
      totalElements: totalRecords,
    };
  } catch (error) {
    log.error("error getting finished series: " + error);
    return { content: [], number: page, totalPages: 1, totalElements: 0 };
  }
};

exports.getWantToReadSeries = async function (page = 0, size = 20) {
  try {
    const url = `${g_session.url}/api/Series/v2?pageNumber=${page + 1}&pageSize=${size}`;
    const body = {
      id: 0,
      name: "WantToRead",
      combination: 0,
      entityType: 0,
      limitTo: 0,
      sortOptions: {
        sortField: 1,
        isAscending: true,
      },
      statements: [
        {
          field: 26,
          comparison: 0,
          value: "true",
        },
      ],
    };

    const response = await fetchUrlPost(url, body);
    const data = await response.json();

    let totalRecords = 0;
    let totalPages = 1;
    const paginationHeader =
      response.headers.get("Pagination") ||
      response.headers.get("X-Pagination");
    if (paginationHeader) {
      const meta = JSON.parse(paginationHeader);
      totalRecords = meta.totalItems || 0;
      totalPages = meta.totalPages || 1;
    }

    return {
      content: data.map((series) => ({
        id: series.id,
        booksCount: 0,
        metadata: { title: series.name || "" },
      })),
      number: page,
      totalPages: totalPages,
      totalElements: totalRecords,
    };
  } catch (error) {
    log.error("error getting finished series: " + error);
    return { content: [], number: page, totalPages: 1, totalElements: 0 };
  }
};

//////////////////////////////////////////////////////////////////////////////
// SEARCH ////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

exports.getSearchSeries = async function (
  searchQuery = "",
  pageIndex = 0,
  size = 20,
) {
  try {
    const url = `${g_session.url}/api/Search/search?queryString=${searchQuery}`;
    const response = await fetchUrlGet(url);
    // ref: getSeriesInLibrary
    const seriesItems = (await response.json())?.series || [];
    let totalRecords = seriesItems.length;
    let totalPages = 1;
    // TODO: paginate?
    const formattedContent = seriesItems.map((series) => {
      return {
        id: series.seriesId,
        booksCount: 0,
        metadata: { title: series.name || "" },
      };
    });
    return {
      content: formattedContent,
      number: pageIndex,
      totalPages: totalPages,
      totalElements: totalRecords,
    };
  } catch (error) {
    log.error("failed to search series: " + error);
    return undefined;
  }
};

exports.getSearchBooks = async function (
  searchQuery = "",
  pageIndex = 0,
  size = 20,
) {
  try {
    const url = `${g_session.url}/api/Search/search?queryString=${searchQuery}`;
    const response = await fetchUrlGet(url);
    // ref: getBooksInVolume
    const data = await response.json();
    const chapters = data.chapters || [];
    const formattedBooks = chapters.map((chapter) => {
      let displayTitle = "";
      if (
        chapter.title &&
        chapter.title !== "" &&
        chapter.title !== "-100000" &&
        chapter.title !== chapter.number
      ) {
        displayTitle = chapter.title;
      } else if (chapter.number !== undefined && chapter.number !== "-100000") {
        displayTitle = `${_("tool-servers-type-issue")}: ${chapter.number}`;
      } else {
        displayTitle = _("tool-servers-generic-name-issue");
      }
      return {
        id: chapter.id,
        metadata: {
          title: displayTitle,
          numberSort: chapter.number === -100000 ? 0 : chapter.number || 0,
        },
      };
    });
    return {
      content: formattedBooks,
      number: pageIndex,
      totalPages: 1,
      totalElements: formattedBooks.length,
    };
  } catch (error) {
    log.error("failed to search books: " + error);
    return undefined;
  }
};

//////////////////////////////////////////////////////////////////////////////
// DOWNLOAD //////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

let g_activeDownloadController = null;

// TODO: untested, the demo server doesn't allow downloading
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
    const url = `${g_session.url}/api/Download/chapter?chapterId=${bookId}`;
    log.debug("downloading: " + url);

    const response = await fetchUrlGet(url, { signal });
    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const contentType = response.headers.get("content-type") || "";
    // form the aPI: Returns the zip for a single chapter. If the chapter
    // contains multiple files, they will be zipped.
    let extension = "zip";
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
      // TODO: change this when I can test it always returns a zip
      filters: [
        {
          name: "Comic Book Archive",
          extensions: [extension, "zip", "cbz", "cbr", "pdf", "epub"],
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
              `download Progress: ${current5PercentStep}% (${downloadedBytes}/${totalBytes} bytes)`,
            );
            sendIpcToRenderer(
              "update-modal-downloading.percentage",
              current5PercentStep,
            );
          }
        } else {
          log.debug(
            `downloaded: ${downloadedBytes} bytes (total size unknown)`,
          );
        }
        callback(null, chunk);
      },
    });

    const nodeStream = Readable.fromWeb(response.body);
    await pipeline(nodeStream, progressTrackingStream, writeStream, { signal });

    log.debug(`${bookId} successfully saved to ${outputFilePath}`);
    sendIpcToRenderer("close-active-modal");
    return true;
  } catch (error) {
    sendIpcToRenderer("close-active-modal");
    if (error.name === "AbortError") {
      log.debug(`download for ${bookId} was canceled by the user`);
    } else {
      sendIpcToRenderer(
        "show-modal-download-error",
        error
          ? error.message
            ? error.message
            : error.toString()
          : "Unknown error",
      );
      log.error(error);
    }

    if (outputFilePath) {
      try {
        await rm(outputFilePath, { force: true });
      } catch (cleanupError) {
        log.error(cleanupError);
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

exports.loadPageImageBuffer = async function (chapterId, pageNumber, session) {
  try {
    let url = `${session.url}/api/Reader/image?chapterId=${chapterId}&page=${pageNumber}&extractPdf=true`;
    if (session.apiKey) {
      url += `&apiKey=${session.apiKey}`;
    }
    const options = { session: session };
    const response = await fetchUrlGet(url, options);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return { success: true, buffer };
  } catch (error) {
    log.error("error loading page buffer:", error);
    return { error };
  }
};

const g_updateReadingProgressCache = {
  chapterId: null,
  volumeId: 0,
  seriesId: 0,
};

exports.updateReadingProgress = async function (
  bookId,
  page,
  completed = false,
) {
  try {
    if (!bookId) return false;
    const targetChapterId = parseInt(bookId, 10);
    if (g_updateReadingProgressCache.chapterId !== targetChapterId) {
      const url = `${g_session.url}/api/Chapter?chapterId=${targetChapterId}`;
      const response = await fetchUrlGet(url);
      const chapterData = await response.json();
      const vId = chapterData.volumeId || 0;
      let sId = 0;
      if (vId > 0) {
        const volumeUrl = `${g_session.url}/api/Series/volume?volumeId=${vId}`;
        const volumeResponse = await fetchUrlGet(volumeUrl);
        if (volumeResponse.ok) {
          const volumeData = await volumeResponse.json();
          sId = volumeData.seriesId || 0;
        }
      }
      //
      g_updateReadingProgressCache.chapterId = targetChapterId;
      g_updateReadingProgressCache.volumeId = vId;
      g_updateReadingProgressCache.seriesId = sId;
    }
    const progressUrl = `${g_session.url}/api/Reader/progress`;
    const payload = {
      volumeId: g_updateReadingProgressCache.volumeId,
      chapterId: g_updateReadingProgressCache.chapterId,
      pageNum: parseInt(page, 10),
      seriesId: g_updateReadingProgressCache.seriesId,
      libraryId: 0,
      bookScrollId: "",
      lastModifiedUtc: new Date().toISOString(),
    };
    const progressResponse = await fetchUrlPost(progressUrl, payload);
    if (progressResponse.status === 200 || progressResponse.status === 204) {
      log.debug(`synced progress for book ${bookId}: page ${page}`);
      return true;
    }
    throw new Error(`Unexpected status code: ${progressResponse.status}`);
  } catch (error) {
    log.error(`failed to update reading progress for book ${bookId}: ` + error);
    return false;
  }
};

exports.getReadingProgress = async function (bookId) {
  try {
    if (!bookId) throw new Error(`no book id`);
    const url = `${g_session.url}/api/Chapter?chapterId=${bookId}`;
    const response = await fetchUrlGet(url);
    if (response.status === 200) {
      const data = await response.json();
      if (data) {
        const currentPage =
          typeof data.pagesRead === "number" ? data.pagesRead : 1;
        const totalPages = typeof data.pages === "number" ? data.pages : 1;
        const isCompleted = currentPage >= totalPages && totalPages > 0;

        log.debug(`got progress for book ${bookId}: page ${currentPage}`);
        return {
          page: currentPage,
          completed: isCompleted,
        };
      }
    }
    return { page: 1, completed: false };
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

exports.loadThumbs = async function (bookIds, seriesIds, volumeIds) {
  if (g_thumbsRetrievalAbortController) {
    g_thumbsRetrievalAbortController.abort();
  }
  g_thumbsRetrievalAbortController = new AbortController();
  const currentController = g_thumbsRetrievalAbortController;
  const { signal } = currentController;
  const cleanBookIds = Array.isArray(bookIds) ? bookIds : [];
  const cleanSeriesIds = Array.isArray(seriesIds) ? seriesIds : [];
  const cleanVolumeIds = Array.isArray(volumeIds) ? volumeIds : [];
  const tasks = [];

  const apiKeyParam = g_session.apiKey ? `&apiKey=${g_session.apiKey}` : "";

  cleanBookIds.forEach((id) => {
    tasks.push({
      id,
      url: `${g_session.url}/api/image/chapter-cover?chapterId=${id}${apiKeyParam}`,
    });
  });

  cleanSeriesIds.forEach((id) => {
    tasks.push({
      id,
      url: `${g_session.url}/api/image/series-cover?seriesId=${id}${apiKeyParam}`,
    });
  });

  cleanVolumeIds.forEach((id) => {
    tasks.push({
      id,
      url: `${g_session.url}/api/image/volume-cover?volumeId=${id}${apiKeyParam}`,
    });
  });

  const fetchPromises = tasks.map(async (task) => {
    try {
      const options = { signal };
      const response = await fetchUrlGet(task.url, options);
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

//////////////////////////////////////////////////////////////////////////////
// Series/v2 FILTER EXAMPLES /////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// search text tests: wroks
// const body = {
//   id: 0,
//   name: "JavaTestSearch",
//   combination: 0,
//   entityType: 0,
//   limitTo: 0,
//   sortOptions: {
//     sortField: 1,
//     isAscending: false,
//   },
//   statements: [
//     {
//       field: 1,
//       comparison: 7,
//       value: "java",
//     },
//   ],
// };
// test works
// const body = {
//   id: 0,
//   name: "NotCompleted",
//   combination: 0,
//   entityType: 0,
//   limitTo: 0,
//   sortOptions: {
//     sortField: 7,
//     isAscending: false,
//   },
//   statements: [
//     {
//       field: 20,
//       comparison: 9,
//       value: "2",
//     },
//   ],
// };
// const body = {
//   id: 0,
//   name: "AllUnreadBooks",
//   combination: 1,
//   entityType: 0,
//   limitTo: 0,
//   sortOptions: {
//     sortField: 1,
//     isAscending: true,
//   },
//   statements: [
//     {
//       field: 20,
//       comparison: 9,
//       value: "1",
//     },
//     {
//       field: 20,
//       comparison: 9,
//       value: "2",
//     },
//   ],
// };

//////////////////////////////////////////////////////////////////////////////
// OPDS EXPERIMENTS //////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// const { XMLParser } = require("fast-xml-parser");

// exports.getLibraries = async function () {
//   try {
//     exports.cancelThumbsRetrieval();

//     let url = "";
//     let options = {};

//     if (g_session.apiKey) {
//       url = `${g_session.url}/api/opds/${g_session.apiKey}/libraries`;
//     } else if (g_session.username && g_session.password) {
//       url = `${g_session.url}/api/opds/libraries`;
//       const encodedCredentials = Buffer.from(
//         `${g_session.username}:${g_session.password}`,
//       ).toString("base64");
//       options.session = {
//         ...g_session,
//         token: null,
//         apiKey: null,
//       };
//       options.headers = {
//         Authorization: `Basic ${encodedCredentials}`,
//         Accept: "application/atom+xml",
//       };
//     } else {
//       return undefined;
//     }

//     const response = await fetchUrlGet(url, options);
//     const xmlData = await response.text();

//     const parser = new XMLParser({
//       ignoreAttributes: false,
//       attributeNamePrefix: "@_",
//     });
//     const jsonObj = parser.parse(xmlData);

//     const feed = jsonObj.feed || {};
//     const entries = Array.isArray(feed.entry)
//       ? feed.entry
//       : feed.entry
//         ? [feed.entry]
//         : [];

//     const libraries = entries.map((entry) => {
//       let libraryId = 0;
//       if (entry.link) {
//         const links = Array.isArray(entry.link) ? entry.link : [entry.link];
//         const subLink = links.find((l) => l["@_rel"] === "subsection");
//         if (subLink && subLink["@_href"]) {
//           const hrefStr = String(subLink["@_href"]);
//           const match = hrefStr.match(/libraries\/(\d+)/i);
//           if (match) {
//             libraryId = parseInt(match[1], 10);
//           }
//         }
//       }
//       return {
//         id: libraryId,
//         name: entry.title || "",
//       };
//     });
//     return libraries;
//   } catch (error) {
//     log.error("error getting libraries via OPDS: " + error);
//     return undefined;
//   }
// };

// exports.getSeriesInLibrary = async function (
//   libraryId,
//   letter,
//   pageIndex = 0,
//   size = 20,
// ) {
//   try {
//     if (!libraryId) {
//       return undefined;
//     }
//     const pageNumber = pageIndex + 1;
//     let url = "";
//     let options = {};
//     if (g_session.apiKey) {
//       url = `${g_session.url}/api/opds/${g_session.apiKey}/libraries/${libraryId}?pageNumber=${pageNumber}`;
//     } else if (g_session.username && g_session.password) {
//       url = `${g_session.url}/api/opds/libraries/${libraryId}?pageNumber=${pageNumber}`;
//       const encodedCredentials = Buffer.from(
//         `${g_session.username}:${g_session.password}`,
//       ).toString("base64");
//       options.session = {
//         ...g_session,
//         token: null,
//         apiKey: null,
//       };
//       options.signal = options.signal || null;
//       const currentUserAgent = g_session.userAgent || g_customUserAgent;
//       options.headers = {
//         "User-Agent": currentUserAgent,
//         Authorization: `Basic ${encodedCredentials}`,
//         Accept: "application/atom+xml",
//       };
//     } else {
//       return undefined;
//     }
//     const response = await fetchUrlGet(url, options);
//     const xmlData = await response.text();

//     const parser = new XMLParser({
//       ignoreAttributes: false,
//       attributeNamePrefix: "@_",
//       xmlns: true,
//     });
//     const jsonObj = parser.parse(xmlData);

//     const feed = jsonObj.feed || {};
//     const entries = Array.isArray(feed.entry)
//       ? feed.entry
//       : feed.entry
//         ? [feed.entry]
//         : [];

//     let totalRecords = entries.length;
//     const totalResultsNode =
//       feed["opensearch:totalResults"] || feed["totalResults"];
//     if (totalResultsNode) {
//       const parsedCount = parseInt(
//         totalResultsNode["#text"] || totalResultsNode,
//         10,
//       );
//       if (!isNaN(parsedCount)) {
//         totalRecords = parsedCount;
//       }
//     }

//     const totalPages = Math.max(1, Math.ceil(totalRecords / size));

//     const seriesItems = entries.map((entry) => {
//       const seriesId = entry.id ? parseInt(entry.id, 10) : "";

//       return {
//         id: seriesId,
//         booksCount: 0,
//         metadata: {
//           title: entry.title || "",
//         },
//       };
//     });

//     return {
//       content: seriesItems,
//       number: pageIndex,
//       totalPages: totalPages,
//       totalElements: totalRecords,
//     };
//   } catch (error) {
//     log.error(`error getting series via OPDS: ` + error);
//     return undefined;
//   }
// };

// exports.getBooksInSeries = async function (seriesId, pageIndex = 0, size = 20) {
//   try {
//     if (!seriesId) {
//       return undefined;
//     }

//     const pageNumber = pageIndex + 1;
//     let url = g_session.apiKey
//       ? `${g_session.url}/api/opds/${g_session.apiKey}/series/${seriesId}?pageNumber=${pageNumber}`
//       : `${g_session.url}/api/opds/series/${seriesId}?pageNumber=${pageNumber}`;

//     let options = {};
//     if (!g_session.apiKey && g_session.username && g_session.password) {
//       const encodedCredentials = Buffer.from(
//         `${g_session.username}:${g_session.password}`,
//       ).toString("base64");
//       options.session = { ...g_session, token: null, apiKey: null };
//       options.headers = {
//         Authorization: `Basic ${encodedCredentials}`,
//         Accept: "application/atom+xml",
//       };
//     }

//     const response = await fetchUrlGet(url, options);
//     const xmlData = await response.text();

//     const parser = new XMLParser({
//       ignoreAttributes: false,
//       attributeNamePrefix: "@_",
//       xmlns: true,
//     });
//     const jsonObj = parser.parse(xmlData);

//     const feed = jsonObj.feed || {};
//     const entries = Array.isArray(feed.entry)
//       ? feed.entry
//       : feed.entry
//         ? [feed.entry]
//         : [];

//     return {
//       content: [],
//       number: pageIndex,
//       totalPages: 1,
//       totalElements: 0,
//     };
//   } catch (error) {
//     log.error(`error for series ${seriesId}: ` + error);
//     return undefined;
//   }
// };
