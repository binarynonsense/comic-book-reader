/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// NOTE: experiments, not used, maybe delete someday but I'm keeping them
// here until I'm sure I won't need them or to refactor them

async function onSearchDisroot(pageNum = 1, query = undefined) {
  if (!query) query = g_searchInput.value + " site:comicbookplus.com";
  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_localizedModalSearchingTitleText);
  // <input type="hidden" name="q" value="mars site:comicbookplus.com">
  // <input type="hidden" name="category_general" value="1">
  // <input type="hidden" name="pageno" value="2">
  // <input type="hidden" name="language" value="en-US">
  // <input type="hidden" name="time_range" value="">
  // <input type="hidden" name="safesearch" value="1">
  // <input type="hidden" name="theme" value="beetroot"> // or simple
  try {
    const formData = new FormData();
    formData.append("q", query);
    formData.append("category_general", "1");
    formData.append("pageno", pageNum);
    formData.append("language", "en-US");
    formData.append("time_range", "");
    formData.append("safesearch", "1");
    formData.append("theme", "simple");
    const response = await axios.post(
      "https://search.disroot.org/search",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 15000,
        withCredentials: true,
      }
    );
    sendIpcToMain("search", response.data, query, pageNum);
    // sendIpcToMain("search", undefined, query, pageNum);
  } catch (error) {
    sendIpcToMain("search", undefined, query, pageNum, error.message);
  }
}

function updateResultsDisroot(results, openInAcbrText, openInBrowserText) {
  document
    .querySelector("#tool-search-results-h3")
    .classList.remove("set-display-none");
  const searchResultsDiv = document.querySelector(
    "#tool-cbp-search-results-div"
  );
  searchResultsDiv.innerHTML = "";
  // pagination top
  if (results.hasNext || results.hasPrev) {
    searchResultsDiv.appendChild(generatePaginationHtmlDisroot(results));
  }
  // list
  let ul = document.createElement("ul");
  ul.className = "tools-collection-ul";
  if (results && results.links && results.links.length > 0) {
    for (let index = 0; index < results.links.length; index++) {
      const result = results.links[index];
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      let buttonSpan = document.createElement("span");
      buttonSpan.className = "tools-buttons-list-button";
      buttonSpan.innerHTML = `<i class="fas fa-file fa-2x"></i>`;
      buttonSpan.title = openInAcbrText;
      let multilineText = document.createElement("span");
      multilineText.className = "tools-buttons-list-li-multiline-text";
      {
        let text = document.createElement("span");
        text.innerText = `${result.name}`;
        multilineText.appendChild(text);
      }
      buttonSpan.appendChild(multilineText);
      buttonSpan.addEventListener("click", (event) => {
        onSearchResultClicked(result.dlid, 0);
      });
      li.appendChild(buttonSpan);
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fas fa-link"></i>`;
        buttonSpan.title = openInBrowserText;
        buttonSpan.addEventListener("click", (event) => {
          onSearchResultClicked(result.dlid, 1);
        });
        li.appendChild(buttonSpan);
      }
      ul.appendChild(li);
    }
  } else {
    let li = document.createElement("li");
    li.className = "tools-collection-li";
    let text = document.createElement("span");
    // when 0 results/error openInAcbrText stores the text for that
    text.innerText = openInAcbrText;
    li.appendChild(text);
    ul.appendChild(li);
  }
  searchResultsDiv.appendChild(ul);
  // pagination top
  if (results.hasNext || results.hasPrev) {
    searchResultsDiv.appendChild(generatePaginationHtmlDisroot(results));
  }

  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  closeModal();
}

function generatePaginationHtmlDisroot(results) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  if (results.pageNum > 1) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(1, results.query);
    });
    paginationDiv.appendChild(span);
  }
  if (results.hasPrev) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(results.pageNum - 1, results.query);
    });
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` | `;
  paginationDiv.appendChild(span);
  if (results.hasNext) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(results.pageNum + 1, results.query);
    });
    paginationDiv.appendChild(span);
  }
  // NOTE: don't know the total number of pages, so can't add a button to
  // go to the end directly
  return paginationDiv;
}

////////////////////////////////////////////////////////////

async function onSearchDDG(text, url) {
  if (!url) {
    text = g_searchInput.value;
    g_searchResultsPrevUrls = [];
    g_searchResultsNextUrl = undefined;
  }
  if (!g_openModal) showSearchModal(); // TODO: check if first time?
  updateModalTitleText(g_localizedModalSearchingTitleText);
  // DDG: sendIpcToMain("search", text, url, window.navigator.userAgent);
  sendIpcToMain("search", text, url, window.navigator.userAgent);
}

function updateResultsDDG(
  searchResults,
  noResultsText,
  openInAcbrText,
  openInBrowserText
) {
  ///////////////////////////////////////////
  //
  document
    .querySelector("#tool-search-results-h3")
    .classList.remove("set-display-none");
  const searchResultsDiv = document.querySelector(
    "#tool-cbp-search-results-div"
  );
  searchResultsDiv.innerHTML = "";
  ////////////////////////////////////////////
  if (searchResults && searchResults.links.length > 0) {
    // pagination top
    if (searchResults.prevUrl || searchResults.nextUrl) {
      searchResultsDiv.appendChild(generatePaginationHtmlDDG(searchResults));
    }
    // list
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    for (let index = 0; index < searchResults.links.length; index++) {
      const bookData = searchResults.links[index];
      let li = document.createElement("li");
      li.className = "tools-buttons-list-li";
      let buttonSpan = document.createElement("span");
      buttonSpan.className = "tools-buttons-list-button";
      buttonSpan.innerHTML = `<i class="fas fa-file fa-2x"></i>`;
      buttonSpan.title = openInAcbrText;
      let multilineText = document.createElement("span");
      multilineText.className = "tools-buttons-list-li-multiline-text";
      {
        let text = document.createElement("span");
        text.innerText = reduceString(bookData.title);
        multilineText.appendChild(text);
      }
      buttonSpan.appendChild(multilineText);
      buttonSpan.addEventListener("click", (event) => {
        onSearchResultClicked(bookData.id, 0);
      });
      li.appendChild(buttonSpan);
      {
        let buttonSpan = document.createElement("span");
        buttonSpan.className = "tools-buttons-list-button";
        buttonSpan.innerHTML = `<i class="fas fa-link"></i>`;
        buttonSpan.title = openInBrowserText;
        buttonSpan.addEventListener("click", (event) => {
          onSearchResultClicked(bookData.id, 1);
        });
        li.appendChild(buttonSpan);
      }
      ul.appendChild(li);
    }
    searchResultsDiv.appendChild(ul);
    // pagination top
    if (searchResults.prevUrl || searchResults.nextUrl) {
      searchResultsDiv.appendChild(generatePaginationHtmlDDG(searchResults));
    }
  } else {
    let ul = document.createElement("ul");
    ul.className = "tools-collection-ul";
    let li = document.createElement("li");
    li.className = "tools-collection-li";
    let text = document.createElement("span");
    text.innerText = noResultsText;
    li.appendChild(text);
    ul.appendChild(li);
    searchResultsDiv.appendChild(ul);
  }
  ///////////////////////////////////////////
  updateColumnsHeight();
  document.getElementById("tools-columns-right").scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
  closeModal();
}

function generatePaginationHtmlDDG(searchResults) {
  let paginationDiv = document.createElement("div");
  paginationDiv.className = "tools-collection-pagination";
  // if (g_searchResultsPrevUrls.length > 1) {
  //   let span = document.createElement("span");
  //   span.className = "tools-collection-pagination-button";
  //   span.innerHTML = '<i class="fas fa-angle-double-left"></i>';
  //   span.addEventListener("click", (event) => {
  //     onSearch(searchResults.text, g_searchResultsPrevUrls[0]);
  //   });
  //   paginationDiv.appendChild(span);
  // }
  if (searchResults.prevUrl) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-left"></i>';
    span.addEventListener("click", (event) => {
      onSearch(searchResults.text, searchResults.prevUrl);
    });
    paginationDiv.appendChild(span);
  }
  let span = document.createElement("span");
  span.innerHTML = ` | `;
  paginationDiv.appendChild(span);
  if (searchResults.nextUrl) {
    let span = document.createElement("span");
    span.className = "tools-collection-pagination-button";
    span.innerHTML = '<i class="fas fa-angle-right"></i>';
    span.addEventListener("click", (event) => {
      onSearch(searchResults.text, searchResults.nextUrl);
    });
    paginationDiv.appendChild(span);
  }
  // NOTE: don't know the total number of pages, so can't add a button to
  // go to the end directly
  return paginationDiv;
}
