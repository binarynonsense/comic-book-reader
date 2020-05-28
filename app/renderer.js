const { ipcRenderer, remote } = require("electron");
const customTitlebar = require("custom-electron-titlebar");

let titlebar = new customTitlebar.Titlebar({
  backgroundColor: customTitlebar.Color.fromHex("#252525"),
  itemBackgroundColor: customTitlebar.Color.fromHex("#666"),
  icon: "./assets/images/icon_256x256.png",
});
//document.querySelector(".titlebar").style.height = "20px";
// document.title = "My new title";
// titlebar.updateTitle();
// titlebar.updateBackground(customTitlebar.Color.RED);
// document.title = "232323232";
// titlebar.updateTitle();
// titlebar.updateMenu(menu);

ipcRenderer.on("show-img", (event, img64) => {
  document.querySelector(".centered-block").style.display = "none";

  //webFrame.clearCache();
  let _out = '<img class="page" src="' + img64 + '" />';
  let _target = document.getElementById("page-container");
  // _target.insertAdjacentHTML("beforeend", _out);
  _target.innerHTML = _out;

  // ref: https://www.w3schools.com/howto/howto_js_scroll_to_top.asp
  document.documentElement.scrollTop = 0;

  //webFrame.clearCache(); // don't know if this does anything, haven't tested, I'0m afraid of memory leaks changing imgs
});

// document.onkeydown = function (evt) {
//   evt = evt || window.event;
//   if (evt.ctrlKey && evt.keyCode == 90) {
//     alert("Ctrl-Z");
//   }
// };

document.onkeydown = function (evt) {
  evt = evt || window.event;
  // ref: http://gcctech.org/csc/javascript/javascript_keycodes.htm
  if (evt.keyCode == 34 || evt.keyCode == 39) {
    // page down or arrow right
    ipcRenderer.send("mouse-click", true);
  } else if (evt.keyCode == 33 || evt.keyCode == 37) {
    // page up or arrow left
    ipcRenderer.send("mouse-click", false);
  } else if (evt.keyCode == 40) {
    // arrow down
    let container = document.querySelector(".container-after-titlebar");
    let amount = container.offsetHeight / 5;
    container.scrollBy(0, amount);
  } else if (evt.keyCode == 38) {
    // arrow up
    let container = document.querySelector(".container-after-titlebar");
    let amount = container.offsetHeight / 5;
    document.querySelector(".container-after-titlebar").scrollBy(0, -amount);
  } else if (evt.keyCode == 27) {
    // escape
    ipcRenderer.send("escape-pressed");
  }
};

document.onclick = function (event) {
  if (event.target.className === "page") {
    ipcRenderer.send("mouse-click", true);
  }
  //if (event.target.className !== "container-after-titlebar") return;
};

document.oncontextmenu = function (event) {
  if (event.target.className === "page") {
    ipcRenderer.send("mouse-click", false);
  }
};

// ref: https://stackoverflow.com/questions/4481485/changing-css-pseudo-element-styles-via-javascript
function hideScrollBar() {
  // generic:
  document.body.classList.add("hidden-scrollbar");
  // if custom title bar enabled:
  document
    .querySelector(".container-after-titlebar")
    .classList.add("hidden-scrollbar");
}

function showScrollBar() {
  // generic:
  document.body.classList.remove("hidden-scrollbar");
  // if custom title bar enabled:
  document
    .querySelector(".container-after-titlebar")
    .classList.remove("hidden-scrollbar");
}

ipcRenderer.on("set-scrollbar", (event, isVisible) => {
  if (isVisible) {
    showScrollBar();
  } else {
    hideScrollBar();
  }
  // alt to toggle: element.classList.contains(class);
});

function showMenuBar(show) {
  if (show) {
    document.querySelector(".titlebar").classList.remove("display-none");
    document
      .querySelector(".container-after-titlebar")
      .classList.remove("set-top-zero");
  } else {
    document.querySelector(".titlebar").classList.add("display-none");
    document
      .querySelector(".container-after-titlebar")
      .classList.add("set-top-zero");
  }
}

ipcRenderer.on("show-menu-bar", (event, show) => {
  showMenuBar(show);
});

ipcRenderer.on("update-menu", (event, menu) => {
  titlebar.updateMenu(menu);
});
