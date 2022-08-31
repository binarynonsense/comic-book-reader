const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mainProcess = require("../../main");

let g_window;
let g_parentWindow;
const g_ipcChannel = "tool-vox--";

const g_queryPageSize = 50;

function isDev() {
  return process.argv[2] == "--dev";
}

function _(...args) {
  return mainProcess.i18n_.apply(null, args);
}

exports.showWindow = function (parentWindow) {
  if (g_window !== undefined) return; // TODO: focus the existing one?
  g_parentWindow = parentWindow;
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

  if (isDev()) g_window.toggleDevTools();

  g_window.on("closed", () => {
    g_window = undefined;
  });

  g_window.webContents.on("did-finish-load", function () {
    g_window.webContents.send(
      g_ipcChannel + "update-localization",
      _("tool-iab-title"),
      _("tool-shared-ui-search-placeholder"),
      getLocalization()
    );
    g_window.webContents.send(
      g_ipcChannel + "modal-update-title",
      _("tool-shared-modal-title-searching").toUpperCase()
    );

    g_window.webContents.send(g_ipcChannel + "init");
  });
};

////////////////////////////////////////////////////////////////////////

ipcMain.on(g_ipcChannel + "open", (event, identifier, fileUrls) => {
  // TODO
  let playlist = {
    id: identifier,
    source: "librivox",
    files: [],
  };
  fileUrls.forEach((url) => {
    playlist.files.push({ url: url, duration: -1 });
  });
  mainProcess.showAudioPlayer(true, false);
  g_parentWindow.webContents.send("audio-player", "open-playlist", playlist);
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
      let searchQuery = `q=(${encodeURIComponent(text)})`;
      let collectionQuery = `+AND+collection%3A(librivoxaudio)`;
      const response = await axios.get(
        `https://archive.org/advancedsearch.php?${searchQuery}${collectionQuery}+AND+mediatype%3A(audio)&fl[]=identifier&fl[]=title&fl[]=creator&sort[]=&sort[]=&sort[]=&rows=${g_queryPageSize}&page=${pageNum}&output=json`,
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
          "tool-shared-ui-search-nothing-found"
        )}</span></li>`;
      } else {
        const queryResultsNum = searchResults.response.docs.length;
        for (let index = 0; index < queryResultsNum; index++) {
          const bookData = searchResults.response.docs[index];
          // e.g.
          // identifier: "originalillustra00cast"
          // imagecount: 650
          // title: "The Original Illustrated Sherlock Holmes"
          let authors = reduceString(bookData.creator);
          if (!authors || authors === "") authors = "&nbsp;&nbsp;";
          content += `<li class="collection-item">      
            <span class="title"><a style="cursor: pointer; margin-right: 5px;" title="${_(
              "tool-shared-ui-search-item-open-acbr"
            )}" onclick="renderer.onSearchResultClicked(${index}, 0)"
              ><i class="fa fa-folder-open"></i> ${reduceString(
                bookData.title
              )}</a><br>${authors}</span>
              <a
                style="cursor: pointer"
                onclick="renderer.onSearchResultClicked(${index}, 1)"
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

      g_window.webContents.send(
        g_ipcChannel + "update-results",
        content,
        searchResults
      );
    } catch (error) {
      // console.error(error);
      content += `<ul class="collection">`;
      content += `<li class="collection-item"><span class="title">${_(
        "tool-shared-ui-search-nothing-found"
      )}</span></li>`;
      content += `</ul>`;
      g_window.webContents.send(g_ipcChannel + "update-results", content);
    }
  })(); // async
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
      text: _("tool-shared-tab-options").toUpperCase(),
    },
    {
      id: "text-tab-3",
      text: _("tool-shared-tab-about").toUpperCase(),
    },
    {
      id: "search-button",
      text: _("tool-shared-ui-search-button").toUpperCase(),
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
      id: "text-about-1",
      text: _(
        "tool-shared-ui-about-text-1",
        _("tool-shared-ui-about-text-1-books"),
        "Internet Archive"
      ),
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
      id: "button-open-ia-browser",
      text: _("tool-iab-button-open-ia-browser").toUpperCase(),
    },
    {
      id: "button-open-donate-browser",
      text: _("tool-iab-button-open-donate-browser").toUpperCase(),
    },
  ];
}
