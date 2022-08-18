const { ipcRenderer } = require("electron");

let g_ipcChannel = "mgr-hist--";

let g_itemsListDiv = document.querySelector("#items-list");

let g_localizedRemoveFromListText = "";
let g_localizedOpenFromListText = "";

///////////////////////////////////////////////////////////////////////////////

function reducePathString(input) {
  var length = 80;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
  g_ipcChannel + "update-localization",
  (event, title, localization, tooltipsLocalization) => {
    document.title = title;
    for (let index = 0; index < localization.length; index++) {
      const element = localization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.innerHTML = element.text;
      }
    }

    for (let index = 0; index < tooltipsLocalization.length; index++) {
      const element = tooltipsLocalization[index];
      const domElement = document.querySelector("#" + element.id);
      if (domElement !== null) {
        domElement.title = element.text;
      }
      if (element.id === "tooltip-remove-from-list") {
        g_localizedRemoveFromListText = element.text;
      } else if (element.id === "tooltip-open-from-list") {
        g_localizedOpenFromListText = element.text;
      }
    }
  }
);

ipcRenderer.on(g_ipcChannel + "build-list", (event, history) => {
  g_itemsListDiv.innerHTML = "";
  for (let index = history.length - 1; index >= 0; index--) {
    const fileInfo = history[index];
    g_itemsListDiv.innerHTML += `<li class="collection-item">
    <div>
      <a style="cursor: pointer; margin-right: 5px" onclick="renderer.onOpenItem(${index})" title="${g_localizedOpenFromListText}"
        ><i class="fa fa-folder-open"></i
      >&nbsp;&nbsp;${reducePathString(fileInfo.filePath)}</a><a
        style="cursor: pointer"
        onclick="renderer.onRemoveItem(this, ${index})"
        class="secondary-content"
        ><i
          class="fas fa-window-close"
          style="color: red !important"
          title="${g_localizedRemoveFromListText}"
        ></i
      ></a>
    </div>
  </li>`;
  }
  if (history.length < 20) {
    for (let index = 0; index < 20 - history.length; index++) {
      g_itemsListDiv.innerHTML += `<li class="collection-item">
          <div>&nbsp;</div>
       </li>`;
    }
  }
});

function onClearAll(element) {
  ipcRenderer.send(g_ipcChannel + "remove-all");
}
exports.onClearAll = onClearAll;

function onRemoveItem(element, index) {
  // element.parentElement.parentElement.parentElement.removeChild(
  //   element.parentElement.parentElement
  // );
  ipcRenderer.send(g_ipcChannel + "remove-item", index);
}
exports.onRemoveItem = onRemoveItem;

function onOpenItem(index) {
  ipcRenderer.send(g_ipcChannel + "open-item", index);
}
exports.onOpenItem = onOpenItem;

///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(g_ipcChannel + "update-title-text", (event, text) => {
  g_modalTitle.innerHTML = text;
});
