/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const log = require("./logger");

exports.searchDisroot = function (results, dom, idText, replaceText) {
  try {
    const resultWrapper = dom.window.document.querySelectorAll(".result");
    if (resultWrapper && resultWrapper.length > 0) {
      resultWrapper.forEach((element) => {
        const a = element.querySelector("h3")?.querySelector("a");
        if (a && a.href && a.href.includes(idText)) {
          let comicId;
          let parts = a.href.split(idText + "=");
          if (parts.length === 2) {
            comicId = parts[1];
          }
          if (comicId) {
            results.links.push({
              name: a.textContent.replace(replaceText, ""),
              summary: element.querySelector(".content")?.textContent?.trim(),
              id: comicId,
            });
          }
        }
      });
    }
    results.hasNext =
      dom.window.document.querySelector("form.next_page") !== null;
    results.hasPrev =
      dom.window.document.querySelector("form.previous_page") !== null;
    if (results.links.length === 0) {
      throw "0 results";
    }
    return results;
  } catch (error) {
    throw error;
  }
};

exports.searchDDG = function (results, html, dom, idText, replaceText) {
  try {
    // e.g. <a rel="next" href="/lite/?q=mars+site%3Acomicbookplus.com&amp;v=l&amp;kl=wt-wt&amp;l=us-en&amp;p=&amp;s=73&amp;ex=-1&amp;o=json&amp;dl=en&amp;ct=ES&amp;sp=0&amp;vqd=4-111953606416844614702827187214412193094&amp;host_region=eun&amp;dc=97&amp;api=%2Fd.js">
    let regex = /rel="next" href="\/lite\/\?q=(.*)">/;
    let match = html.match(regex);
    if (match && match[1]) {
      results.hasNext = true;
      results.nextUrl = `https://lite.duckduckgo.com/lite/?q=${match[1]}`;
    }
    //  <a rel="prev" href="/lite/?q=mars+inurl%3Adlid+site%3Acomicbookplus.com&amp;s=23&amp;v=l&amp;kl=us-en&amp;dc=-74&amp;nextParams=&amp;api=d.js&amp;vqd=4-218811986882710962361145831623280930728&amp;o=json">&lt; Previous Page</a> //
    regex = /rel="prev" href="\/lite\/\?q=(.*)">/;
    match = html.match(regex);
    if (match && match[1]) {
      results.hasPrev = true;
      results.prevUrl = `https://lite.duckduckgo.com/lite/?q=${match[1]}`;
    }
    const resultLinks = dom.window.document.querySelectorAll(".result-link");
    if (resultLinks && resultLinks.length > 0) {
      resultLinks.forEach((resultLink) => {
        if (resultLink.nodeName.toLowerCase() === "a" && resultLink.href) {
          const href = resultLink.href;
          // e.g. <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcomicbookplus.com%2F%3Fdlid%3D78597&amp;rut=cf36420565b1828fec62912e62aaedffc513ed9762220eaa4579cbbaa85c670e" class="result-link">Jim Solar Space Sheriff - Battle for Mars - Comic Book Plus</a>
          const regex = /uddg=(.*)&rut=/;
          const match = href.match(regex);
          if (match && match[1] && match[1].includes(idText)) {
            let comicId;
            let parts = decodeURIComponent(match[1]).split(idText + "=");
            if (parts.length === 2) {
              comicId = parts[1];
            }
            if (comicId) {
              // try to get snippet
              let summary;
              const snippetParent =
                resultLink?.parentElement?.parentElement?.nextElementSibling;
              if (snippetParent) {
                const snippetElement =
                  snippetParent.querySelector(".result-snippet");
                if (snippetElement) {
                  summary = snippetElement.textContent?.trim();
                }
              }
              //////////
              results.links.push({
                name: resultLink.textContent.replace(replaceText, ""),
                summary,
                id: comicId,
              });
            }
          }
        }
      });
      if (results.links.length === 0) {
        throw "0 results";
      }
    } else {
      if (html.includes("Unfortunately, bots use DuckDuckGo too")) {
        log.editor("DuckDuckGo thinks we are a bot? :S");
      }
    }
    return results;
  } catch (error) {
    throw error;
  }
};
