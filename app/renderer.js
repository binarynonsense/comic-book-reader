const { ipcRenderer, remote } = require("electron");

ipcRenderer.on("show-img", (event, img64) => {
  //webFrame.clearCache();
  let _out = '<img src="' + img64 + '" />';
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

document.onclick = function (event) {
  ipcRenderer.send("mouse-click", true);
};

document.oncontextmenu = function (event) {
  ipcRenderer.send("mouse-click", false);
};

// ref: https://stackoverflow.com/questions/4481485/changing-css-pseudo-element-styles-via-javascript
function hideScrollBar() {
  //document.getElementById("editor").classList.add("hidden-scrollbar");
  document.body.classList.add("hidden-scrollbar");
}

function showScrollBar() {
  document.body.classList.remove("hidden-scrollbar");
}

ipcRenderer.on("set-scrollbar", (event, isVisible) => {
  if (isVisible) {
    showScrollBar();
  } else {
    hideScrollBar();
  }
  // alt to toggle: element.classList.contains(class);
});
