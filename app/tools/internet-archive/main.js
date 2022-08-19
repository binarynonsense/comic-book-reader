const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mainProcess = require("../../main");

let g_window;
const g_ipcChannel = "tool-iab--";

const g_queryPageSize = 50;

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
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
      _("tool-iab-title"),
      _("tool-iab-search-placeholder"),
      getLocalization()
    );
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-searching").toUpperCase()
    );

    let collectionsContent = `<option value="internetarchivebooks">Internet Archive Books</option>`;
    collectionsContent += `<option value="smithsonian">Smithsonian Libraries and Archives</option>`;
    collectionsContent += `<option value="americana">American Libraries</option>`;
    collectionsContent += `<option value="library_of_congress">The Library of Congress</option>`;
    collectionsContent += `<option value="wwIIarchive">WWII Archive</option>`;
    collectionsContent += `<option value="sciencefiction">The Science Fiction and Fantasy Fiction Collection</option>`;
    collectionsContent += `<option value="">${_(
      "tool-iab-collection-any"
    )}</option>`;

    let availabilityContent = `<option value="0">${_(
      "tool-iab-availability-always"
    )}</option>`;
    availabilityContent += `<option value="1">${_(
      "tool-iab-availability-any"
    )}</option>`;

    g_window.webContents.send(
      g_ipcChannel + "init",
      collectionsContent,
      availabilityContent
    );
  });
};

////////////////////////////////////////////////////////////////////////

function reduceString(input) {
  if (!input) return undefined;
  var length = 80;
  input = input.length > length ? input.substring(0, length) + "..." : input;
  return input;
}

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "open", (event, comicData) => {
  mainProcess.openWWWComicBook(comicData, async (pageNum) => {
    //////////////
    const axios = require("axios").default;

    try {
      let imgUrl = `https://archive.org/download/${comicData.comicId}/page/n${
        pageNum - 1
      }/mode/1up`;
      const response = await axios.get(imgUrl, {
        timeout: 10000,
        responseType: "arraybuffer",
      });
      let buf = Buffer.from(response.data, "binary");
      let img64 = "data:image/jpg;base64," + buf.toString("base64");
      return { pageImgSrc: img64, pageImgUrl: imgUrl };
    } catch (error) {
      // console.error(error);
      return undefined;
    }
    //////////////
  });
  g_window.close();
});

ipcMain.on(
  g_ipcChannel + "search",
  (event, text, pageNum, collection, availability) => {
    let content = `<div style="margin-top: 50px !important"></div>`;
    (async () => {
      try {
        const axios = require("axios").default;
        if (text.trim().length === 0) {
          content += `<ul class="collection">`;
          content += `<li class="collection-item"><span class="title">${_(
            "tool-iab-search-nothing-found"
          )}</span></li>`;
          content += `</ul>`;
          g_window.webContents.send(g_ipcChannel + "update-results", content);
          return;
        }
        let searchQuery = `q=(${encodeURIComponent(text)})`;
        let collectionQuery = "";
        if (collection && collection !== "")
          collectionQuery = `+AND+collection%3A(${collection})`;
        let readableQuery = "";
        if (availability == 0) {
          readableQuery = `+AND+lending___status%3A(is_readable)`;
        }
        const response = await axios.get(
          `https://archive.org/advancedsearch.php?${searchQuery}${collectionQuery}+AND+mediatype%3A(texts)${readableQuery}&fl[]=identifier&fl[]=imagecount&fl[]=title&fl[]=creator&sort[]=&sort[]=&sort[]=&rows=${g_queryPageSize}&page=${pageNum}&output=json`,
          { timeout: 10000 }
        );
        let searchResults = response.data;
        // e.g.
        // docs: (8) [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}]
        // numFound: 8
        // start: 0
        const totalResultsNum = searchResults.response.numFound;

        // Pagination arrows
        let paginationContent = "";
        if (totalResultsNum > g_queryPageSize) {
          const totalPagesNum = Math.ceil(totalResultsNum / g_queryPageSize);
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
            "tool-iab-search-nothing-found"
          )}</span></li>`;
        } else {
          const queryResultsNum = searchResults.response.docs.length;
          for (let index = 0; index < queryResultsNum; index++) {
            const bookData = searchResults.response.docs[index];
            // e.g.
            // identifier: "originalillustra00cast"
            // imagecount: 650
            // title: "The Original Illustrated Sherlock Holmes"
            content += `<li class="collection-item">      
            <span class="title"><a style="cursor: pointer; margin-right: 5px;" title="${_(
              "tool-iab-search-item-open-acbr"
            )}" onclick="renderer.onSearchResultClicked(${index}, 0)"
              ><i class="fa fa-folder-open"></i> ${reduceString(
                bookData.title
              )}</a><br>${
              reduceString(bookData.creator) ?? "&nbsp;&nbsp;"
            }</span>
              <a
                style="cursor: pointer"
                onclick="renderer.onSearchResultClicked(${index}, 1)"
                class="secondary-content"
                ><i
                  class="fa fa-link" aria-hidden="true"
                  title="${_("tool-iab-search-item-open-browser")}"
                ></i
              ></a>
            </li>`;
          }
        }
        content += `</ul>`;

        content += `<div style="margin-top:15px;">${paginationContent}</div>`;

        g_window.webContents.send(
          g_ipcChannel + "update-results",
          content,
          searchResults
        );
      } catch (error) {
        // console.error(error);
        content += `<ul class="collection">`;
        content += `<li class="collection-item"><span class="title">${_(
          "tool-iab-search-nothing-found"
        )}</span></li>`;
        content += `</ul>`;
        g_window.webContents.send(g_ipcChannel + "update-results", content);
      }
    })(); // async
  }
);

///////////////////////////////////////////////////////////////////////////////

function getLocalization() {
  return [
    {
      id: "tab-1-text",
      text: _("tool-iab-tab-1-text").toUpperCase(),
    },
    {
      id: "tab-2-text",
      text: _("tool-iab-tab-2-text").toUpperCase(),
    },
    {
      id: "tab-3-text",
      text: _("tool-iab-tab-3-text").toUpperCase(),
    },
    {
      id: "search-button",
      text: _("tool-iab-search-button").toUpperCase(),
    },

    {
      id: "options-collections-text",
      text: _("tool-iab-options-collections-text"),
    },
    {
      id: "text-advanced-options",
      text: _("tool-shared-ui-advanced-options"),
    },
    {
      id: "options-availability-text",
      text: _("tool-iab-options-availability-text"),
    },

    {
      id: "about-text-1",
      text: _("tool-iab-about-text-1"),
    },
    {
      id: "about-text-2",
      text: _("tool-iab-about-text-2"),
    },
    {
      id: "about-text-3",
      text: _("tool-iab-about-text-3"),
    },
    {
      id: "button-open-ia-browser",
      text: _("tool-iab-button-open-ia-browser").toUpperCase(),
    },
    {
      id: "button-open-donate-browser",
      text: _("tool-iab-button-open-donate-browser").toUpperCase(),
    },
  ];
}
