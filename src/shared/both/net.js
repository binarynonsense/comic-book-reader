/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  let data;
  if (contentType.includes("image/") || contentType.includes("octet-stream")) {
    data =
      typeof Buffer !== "undefined"
        ? Buffer.from(await response.arrayBuffer())
        : await response.arrayBuffer();
  } else {
    const text = await response.text();
    try {
      // try to parse it as JSON regardless of the header, if it looks
      // like JSON, helps with dcm tool
      if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
        data = JSON.parse(text);
      } else {
        data = text;
      }
    } catch (error) {
      data = text;
    }
  }
  if (!response.ok) {
    const error = new Error(
      `Request failed with status code ${response.status}`,
    );
    error.name = "NetError";
    error.response = {
      data,
      status: response.status,
      headers: Object.fromEntries(response.headers),
    };
    throw error;
  }
  return {
    data,
    status: response.status,
    headers: Object.fromEntries(response.headers),
  };
}

export const get = async (url, options = {}) => {
  const { timeout = 10000, headers = {}, ...fetchOptions } = options;
  const signal = AbortSignal.timeout(timeout);
  const response = await fetch(url, {
    ...fetchOptions,
    method: "GET",
    headers,
    signal,
  });
  return await handleResponse(response);
};

export const post = async (url, data = null, options = {}) => {
  const { timeout = 10000, headers = {}, ...fetchOptions } = options;
  const signal = AbortSignal.timeout(timeout);
  let body = data;
  const requestHeaders = { ...headers };
  if (data instanceof FormData) {
    delete requestHeaders["Content-Type"];
  } else if (data && typeof data === "object") {
    body = JSON.stringify(data);
    requestHeaders["Content-Type"] =
      requestHeaders["Content-Type"] || "application/json";
  }
  const response = await fetch(url, {
    ...fetchOptions,
    method: "POST",
    headers: requestHeaders,
    body,
    signal,
  });
  return await handleResponse(response);
};

// for ESM in renderer
const net = { get, post };
export default net;

// for CommonJS in main
if (typeof module !== "undefined" && module.exports) {
  module.exports = net;
}
