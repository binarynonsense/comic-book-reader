/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

// NOTE: experiments, not used, maybe delete someday but I'm keeping them
// here until I'm sure I won't need them or to refactor them

async function searchDDG(text, url, useragent) {
  log.test("+++++++++++");
  console.log(useragent);
  // NOTE: using duckduckgo.com as the search engine
  try {
    if (!url) {
      if (text.trim().length === 0) {
        throw "query's text is empty";
      }
      // ref: https://duckduckgo.com/duckduckgo-help-pages/results/syntax/
      url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(
        text + " site:comicbookplus.com"
      )}`;
      // NOTE: tried inurl:dlid, doesn't really seem to do anything
      // text + " inurl:dlid site:comicbookplus.com"
    }
    log.test(url);
    const axios = require("axios").default;
    const response = await axios.get(url, {
      timeout: 15000,
      // NOTE: tried headers to avoid being ided as a bot, no luck
      //headers: { "User-Agent": useragent, withCredentials: true },
    });
    let nextUrl;
    // e.g. <a rel="next" href="/lite/?q=mars+site%3Acomicbookplus.com&amp;v=l&amp;kl=wt-wt&amp;l=us-en&amp;p=&amp;s=73&amp;ex=-1&amp;o=json&amp;dl=en&amp;ct=ES&amp;sp=0&amp;vqd=4-111953606416844614702827187214412193094&amp;host_region=eun&amp;dc=97&amp;api=%2Fd.js">
    let regex = /rel="next" href="\/lite\/\?q=(.*)">/;
    let match = response.data.match(regex);
    if (match && match[1]) {
      nextUrl = `https://lite.duckduckgo.com/lite/?q=${match[1]}`;
    }
    let prevUrl;
    //  <a rel="prev" href="/lite/?q=mars+inurl%3Adlid+site%3Acomicbookplus.com&amp;s=23&amp;v=l&amp;kl=us-en&amp;dc=-74&amp;nextParams=&amp;api=d.js&amp;vqd=4-218811986882710962361145831623280930728&amp;o=json">&lt; Previous Page</a> //
    regex = /rel="prev" href="\/lite\/\?q=(.*)">/;
    match = response.data.match(regex);
    if (match && match[1]) {
      prevUrl = `https://lite.duckduckgo.com/lite/?q=${match[1]}`;
    }
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    const dom = new JSDOM(response.data);
    const resultLinks = dom.window.document.querySelectorAll(".result-link");
    let results = { nextUrl, prevUrl, links: [], text, url };
    if (resultLinks && resultLinks.length > 0) {
      resultLinks.forEach((element) => {
        if (element.nodeName.toLowerCase() === "a" && element.href) {
          const href = element.href;
          // e.g. <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcomicbookplus.com%2F%3Fdlid%3D78597&amp;rut=cf36420565b1828fec62912e62aaedffc513ed9762220eaa4579cbbaa85c670e" class="result-link">Jim Solar Space Sheriff - Battle for Mars - Comic Book Plus</a>
          const regex = /uddg=(.*)&rut=/;
          const match = href.match(regex);
          if (match && match[1] && match[1].includes("dlid")) {
            let comicId;
            let parts = decodeURIComponent(match[1]).split("dlid=");
            if (parts.length === 2) {
              comicId = parts[1];
            }
            if (comicId) {
              results.links.push({
                title: element.textContent.replace(" - Comic Book Plus", ""),
                id: comicId,
              });
            }
          }
        }
      });
    } else {
      if (response.data.includes("Unfortunately, bots use DuckDuckGo too")) {
        log.test("DuckDuckGo thinks you are a bot");
      }
    }
    log.test("+++++++++++");
    sendIpcToRenderer(
      "update-results",
      results,
      _("tool-shared-ui-search-nothing-found"),
      _("tool-shared-ui-search-item-open-acbr"),
      _("tool-shared-ui-search-item-open-browser")
    );
  } catch (error) {
    console.error(error);
    sendIpcToRenderer(
      "update-results",
      undefined,
      _("tool-shared-ui-search-nothing-found")
    );
  }
}
