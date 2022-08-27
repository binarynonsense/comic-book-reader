const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const mainProcess = require("../../main");
const { BookType } = require("../../constants");
const fileUtils = require("../../file-utils");

let g_window;
const g_ipcChannel = "tool-gut--";

let g_lastSearchPageSize;

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow) {
  if (g_window !== undefined) return;
  let [width, height] = parentWindow.getSize();
  height = (90 * height) / 100;
  if (height < 700) height = 700;
  width = 1024;

  g_window = new BrowserWindow({
    width: parseInt(width),
    height: parseInt(height),
    icon: path.join(__dirname, "../../assets/images/icon_256x256.png"),
    resizable: true,
    backgroundColor: "white",
    parent: parentWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  g_window.menuBarVisible = false;
  g_window.loadFile(`${__dirname}/index.html`);

  // if (isDev()) g_window.toggleDevTools();

  g_window.on("closed", () => {
    g_window = undefined;
  });

  g_window.webContents.on("did-finish-load", function () {
    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("tool-gut-title"),
      _("tool-shared-ui-search-placeholder"),
      getLocalization()
    );
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-searching").toUpperCase()
    );

    // e.g.
    // https://www.gutenberg.org/ebooks/68783
    // https://www.gutenberg.org/cache/epub/68783/pg68783.epub
    // mirror:
    // https://gutenberg.pglaf.org/cache/epub/68783/pg68783.epub
    let mirrorsContent = `<option value="https://gutenberg.pglaf.org/">gutenberg.pglaf.org</option>`;
    //mirrorsContent += `<option value="http://eremita.di.uminho.pt/gutenberg/">eremita.di.uminho.pt/gutenberg</option>`;
    mirrorsContent += `<option value="http://gutenberg.readingroo.ms/">gutenberg.readingroo.ms</option>`;
    mirrorsContent += `<option value="https://www.gutenberg.org/">gutenberg.org</option>`;

    g_window.webContents.send(
      g_ipcChannel + "init",
      mirrorsContent,
      getPortableCacheFolder(),
      mainProcess.getSettingsProperty("toolGutUseCache")
    );
  });
};

////////////////////////////////////////////////////////////////////////

function getPortableCacheFolder() {
  return path.join(fileUtils.getExeFolderPath(), "acbr-cache", "gutenberg");
}
exports.getPortableCacheFolder = getPortableCacheFolder;

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "open-id", (event, bookId, mirrorUrl) => {
  const url = `${mirrorUrl}cache/epub/${bookId}/pg${bookId}.epub`;
  mainProcess.openEbookFromPath(url, 0, {
    data: { source: "gut", bookType: BookType.EBOOK },
  });
  g_window.close();
});

ipcMain.on(g_ipcChannel + "search", (event, text, pageNum) => {
  let content = `<div style="margin-top: 50px !important"></div>`;
  (async () => {
    try {
      const axios = require("axios").default;
      if (text.trim().length === 0) {
        content += `<ul class="collection">`;
        content += `<li class="collection-item"><span class="title">${_(
          "tool-shared-ui-search-nothing-found"
        )}</span></li>`;
        content += `</ul>`;
        g_window.webContents.send(g_ipcChannel + "update-results", content);
        return;
      }

      // uses https://gutendex.com/
      // e.g. https://gutendex.com/books/?page=2&search=jules+verne',
      // if this stops working try parsing official search engine
      // e.g. https://www.gutenberg.org/ebooks/search/?query=jules+verne
      let searchQuery = encodeURIComponent(text);
      const response = await axios.get(
        `https://gutendex.com/books?page=${pageNum}&search=${searchQuery}`,
        { timeout: 10000 }
      );
      let searchResults = response.data;
      if (!searchResults.count) throw "error";
      /*
        {
          "count": <number>,
          "next": <string or null>,
          "previous": <string or null>,
          "results": <array of Books>
        }
      */
      const totalResultsNum = searchResults.count;
      const resultsNum = searchResults.results.length;
      if (!g_lastSearchPageSize || pageNum === 1)
        g_lastSearchPageSize = resultsNum;

      // Pagination arrows
      let paginationContent = "";
      if (totalResultsNum > g_lastSearchPageSize) {
        const totalPagesNum = Math.ceil(totalResultsNum / g_lastSearchPageSize);
        paginationContent += `<p style="margin-top:15px;text-align: center;">`;
        if (pageNum > 2)
          paginationContent += `<a style="cursor: pointer; margin-right: 5px;" onclick="renderer.onSearch(1, '${text}')"
      >&#60;&#60</a>`;
        if (pageNum > 1)
          paginationContent += `<a style="cursor: pointer; margin-right: 5px;" onclick="renderer.onSearch(${
            pageNum - 1
          }, '${text}')"
      >&#60;</a>`;
        paginationContent += ` ${pageNum} / ${totalPagesNum} `;
        if (pageNum < totalPagesNum)
          paginationContent += `<a style="cursor: pointer; margin-left: 5px;" onclick="renderer.onSearch(${
            pageNum + 1
          }, '${text}')"
      >&#62;</a>`;
        if (pageNum < totalPagesNum - 1)
          paginationContent += `<a style="cursor: pointer; margin-left: 5px;" onclick="renderer.onSearch(${totalPagesNum}, '${text}')"
      >&#62;&#62;</a>`;
        paginationContent += `</p>`;
      }
      content += paginationContent;

      // List
      content += `<ul class="collection">`;

      if (totalResultsNum <= 0) {
        content += `<li class="collection-item"><span class="title">${_(
          "tool-shared-ui-search-nothing-found"
        )}</span></li>`;
      } else {
        for (let index = 0; index < resultsNum; index++) {
          const bookData = searchResults.results[index];
          if (bookData.media_type !== "Text") continue;
          /*
            Book
            {
              "id": <number of Project Gutenberg ID>,
              "title": <string>,
              "subjects": <array of strings>,
              "authors": <array of Persons>,
              "translators": <array of Persons>,
              "bookshelves": <array of strings>,
              "languages": <array of strings>,
              "copyright": <boolean or null>,
              "media_type": <string>,
              "formats": <Format>,
              "download_count": <number>
            }
            Person
            {
              "birth_year": <number or null>,
              "death_year": <number or null>,
              "name": <string>
            }
          */
          let authors = "";
          const numAuthors = bookData.authors.length;
          for (let index = 0; index < numAuthors; index++) {
            authors += bookData.authors[index].name;
            if ((index === 0 && numAuthors > 1) || index < numAuthors - 1)
              authors += "; ";
          }
          authors = reduceString(authors);
          if (!authors || authors === "") authors = "&nbsp;&nbsp;";

          content += `<li class="collection-item">      
          <span class="title"><a style="cursor: pointer; margin-right: 5px;" title="${_(
            "tool-shared-ui-search-item-open-acbr"
          )}" onclick="renderer.onSearchResultClicked(${bookData.id}, 0)"
            ><i class="fa fa-folder-open"></i> ${reduceString(
              bookData.title
            )}</a><br>${authors}</span>
            <a
              style="cursor: pointer"
              onclick="renderer.onSearchResultClicked(${bookData.id}, 1)"
              class="secondary-content"
              ><i
                class="fa fa-link" aria-hidden="true"
                title="${_("tool-shared-ui-search-item-open-browser")}"
              ></i
            ></a>
          </li>`;
        }
      }
      content += `</ul>`;

      content += `<div style="margin-top:15px;">${paginationContent}</div>`;

      g_window.webContents.send(g_ipcChannel + "update-results", content);
    } catch (error) {}
  })(); // async
});

ipcMain.on(g_ipcChannel + "update-use-cache", (event, value) => {
  mainProcess.setSettingsProperty("toolGutUseCache", value);
});

///////////////////////////////////////////////////////////////////////////////

function reduceString(input) {
  if (!input) return undefined;
  var length = 80;
  input = input.length > length ? input.substring(0, length) + "..." : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "text-tab-1",
      text: _("tool-shared-tab-search").toUpperCase(),
    },
    {
      id: "text-tab-2",
      text: _("tool-shared-tab-openurl").toUpperCase(),
    },
    {
      id: "text-tab-3",
      text: _("tool-shared-tab-options").toUpperCase(),
    },
    {
      id: "text-tab-4",
      text: _("tool-shared-tab-about").toUpperCase(),
    },

    {
      id: "button-search",
      text: _("tool-shared-ui-search-button").toUpperCase(),
    },

    {
      id: "text-url",
      text: _("tool-gut-text-url"),
    },
    {
      id: "button-url-open-acbr",
      text: _("tool-shared-ui-button-open-in-acbr").toUpperCase(),
    },
    {
      id: "button-url-open-browser",
      text: _("tool-shared-ui-button-open-in-browser").toUpperCase(),
    },

    {
      id: "text-options-mirrors",
      text: _("tool-gut-text-options-mirrors"),
    },
    {
      id: "text-options-search-engine",
      text: _("tool-gut-text-options-search-engine"),
    },
    {
      id: "text-options-cache-folder",
      text: _("tool-gut-text-options-cache-folder"),
    },
    {
      id: "text-options-cache-downloads",
      text: _("tool-gut-text-options-cache-downloads"),
    },
    {
      id: "button-options-open-cache-folder",
      text: _("tool-gut-button-options-open-cache-folder"),
    },

    {
      id: "text-about-1",
      text: _("tool-shared-ui-about-text-1", "Project Gutenberg"),
    },
    {
      id: "text-about-2",
      text: _("tool-shared-ui-about-text-2"),
    },
    {
      id: "text-about-3",
      text: _("tool-shared-ui-about-text-3"),
    },
    {
      id: "button-open-pg-browser",
      text: _("tool-gut-button-open-pg-browser").toUpperCase(),
    },
    {
      id: "button-open-donate-browser",
      text: _("tool-gut-button-open-donate-browser").toUpperCase(),
    },
  ];
}
