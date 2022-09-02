const { ipcRenderer } = require("electron");
const path = require("path");

let g_settings;
let g_player = {};
let g_playlist;
let g_tracks = [];
let g_currentTrackIndex = 0;
let g_tempAudioElement;
let g_tempAudioIndex;
let g_selectedTrackFileIndex;

ipcRenderer.on("audio-player", (event, ...args) => {
  if (args[0] === "init") {
    init(args[1], args[2]);
  } else if (args[0] === "show") {
    if (args[1]) {
      document.getElementById(args[2]).classList.remove("ap-hidden");
    } else {
      document.getElementById(args[2]).classList.add("ap-hidden");
    }
  } else if (args[0] === "open-playlist") {
    pauseTrack(false);
    g_playlist = args[1];
    g_selectedTrackFileIndex = undefined;
    createTracksList(false);
    updatePlaylistInfo();
    playTrack(g_currentTrackIndex, 0);
    fillTimes();
    fillTags();
  } else if (args[0] === "add-to-playlist") {
    let load = false;
    if (g_tracks.length === 0) load = true;
    let fileUrls = args[1];
    fileUrls.forEach((element) => {
      g_playlist.files.push({ url: element });
    });
    createTracksList(g_tracks.length > 0);
    if (load) loadTrack(0, 0);
    refreshUI();
    fillTimes(); // calls updatePlaylistInfo
    fillTags();
  } else if (args[0] === "update-layout-pos") {
    let container = document.getElementById("audio-player-container");
    if (args[1] == 0) {
      container.classList.remove("ap-layout-bottom-left");
      container.classList.add("ap-layout-top-left");
    } else {
      container.classList.add("ap-layout-bottom-left");
      container.classList.remove("ap-layout-top-left");
    }
  } else if (args[0] === "update-localization") {
    updateLocalization(args[1]);
  }
});

function updateLocalization(localization) {
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.title = element.text;
    }
  }
}

function fillTimes() {
  try {
    g_tempAudioIndex = 0;
    g_tempAudioIndex = getNextToFill();
    if (g_tempAudioIndex >= 0) {
      if (!g_tempAudioElement)
        g_tempAudioElement = document.createElement("audio");
      g_tempAudioElement.muted = true;
      g_tempAudioElement.preload = true;
      g_tempAudioElement.src = g_playlist.files[g_tempAudioIndex].url;
      g_tempAudioElement.addEventListener("loadeddata", function () {
        g_playlist.files[g_tempAudioIndex].duration =
          g_tempAudioElement.duration;
        g_tempAudioIndex++;
        g_tempAudioIndex = getNextToFill();
        if (
          g_tempAudioIndex > 0 &&
          g_tempAudioIndex < g_playlist.files.length
        ) {
          // NOTE: I'm downloading it twice, maybe only do this for local files?
          g_tempAudioElement.src = g_playlist.files[g_tempAudioIndex].url;
        } else {
          g_tempAudioElement.removeAttribute("src");
          g_tempAudioElement = null;
          updatePlaylistInfo();
        }
      });
    } else {
      updatePlaylistInfo();
    }
  } catch (error) {
    // TODO
  }
}

function getNextToFill() {
  for (let index = g_tempAudioIndex; index < g_playlist.files.length; index++) {
    const file = g_playlist.files[index];
    if (file.duration) continue;
    if (/^http:\/\/|https:\/\//.test(file.url)) continue;
    return index;
  }
  return -1;
}

async function fillTags() {
  const musicmetadata = require("music-metadata");
  for (let index = 0; index < g_playlist.files.length; index++) {
    const file = g_playlist.files[index];
    try {
      if (file.title && file.artist) continue;
      if (!/^http:\/\/|https:\/\//.test(file.url)) {
        let url = file.url;
        const metadata = await musicmetadata.parseFile(file.url);
        if (file.url === url) {
          if (metadata?.common?.artist) file.artist = metadata.common.artist;
          if (metadata?.common?.title) file.title = metadata.common.title;
        } else {
          // playlist changed in the meantime !!
          break;
        }
      }
    } catch (error) {
      // TODO
      console.log(error);
    }
  }
  updatePlaylistInfo();
}

function createTracksList(isRefresh) {
  let currentFileIndex;
  if (!isRefresh && g_tempAudioElement) {
    // playlist changed, abort time background retrieval
    g_tempAudioElement.removeAttribute("src");
    g_tempAudioElement = null;
  }
  if (isRefresh && g_tracks.length > 0)
    currentFileIndex = g_tracks[g_currentTrackIndex].fileIndex;
  g_tracks = [];
  for (let index = 0; index < g_playlist.files.length; index++) {
    if (g_settings.shuffle && currentFileIndex === index) {
      continue;
    }
    g_tracks.push({ fileIndex: index, fileUrl: g_playlist.files[index].url });
  }
  // shuffled
  if (g_settings.shuffle) {
    g_tracks = shuffleArray(g_tracks);
    if (currentFileIndex !== undefined) {
      g_tracks.unshift({
        fileIndex: currentFileIndex,
        fileUrl: g_playlist.files[currentFileIndex].url,
      });
    }
    g_currentTrackIndex = 0;
  } else {
    // linear
    if (currentFileIndex !== undefined) g_currentTrackIndex = currentFileIndex;
    else g_currentTrackIndex = 0;
  }
}

function updatePlaylistInfo() {
  g_player.divPlaylistTracks.innerHTML = "";
  if (!g_playlist || g_tracks.length === 0) {
    return;
  }
  for (let index = 0; index < g_playlist.files.length; index++) {
    const file = g_playlist.files[index];
    let duration = "--:--";
    const div = document.createElement("div");
    div.id = "ap-playlist-track-" + index;
    div.classList.add("ap-div-playlist-track");
    if (g_tracks[g_currentTrackIndex].fileIndex === index) {
      div.classList.add("ap-div-playlist-current-track");
    }
    if (index === g_selectedTrackFileIndex) {
      div.classList.add("ap-div-playlist-selected-track");
    }
    if (file.duration !== undefined && file.duration >= 0) {
      duration = getFormatedTimeFromSeconds(file.duration);
    }
    div.addEventListener("click", function () {
      onPlaylistTrackClicked(index);
    });
    div.addEventListener("dblclick", function () {
      onPlaylistTrackDoubleClicked(index);
    });
    let content = `<span title="${file.url}">${reducePlaylistNameString(
      file.title && file.artist
        ? `${file.artist} - ${file.title}`
        : path.basename(file.url, path.extname(file.url))
    )}</span
  ><span class="ap-span-playlist-track-time">${duration}</span>`;
    div.innerHTML = content;
    g_player.divPlaylistTracks.appendChild(div);
  }
}

function loadTrack(index, time) {
  try {
    g_currentTrackIndex = index;
    g_selectedTrackFileIndex = g_tracks[g_currentTrackIndex].fileIndex;
    g_player.engine.src = g_tracks[g_currentTrackIndex].fileUrl;
    g_player.engine.currentTime = time;
    g_player.sliderTime.value = time;
    return true;
  } catch (error) {
    return false;
  }
}

function playTrack(index, time) {
  if (!loadTrack(index, time)) return;
  g_player.engine.play();
  g_player.isPlaying = true;
  refreshUI();
  scrollToCurrent();
}

function pauseTrack(refresh = true) {
  g_player.engine.pause();
  g_player.isPlaying = false;
  if (refresh) refreshUI();
}

function scrollToCurrent() {
  if (g_currentTrackIndex && g_tracks.length > g_currentTrackIndex) {
    let index = g_tracks[g_currentTrackIndex].fileIndex;
    let divId = "ap-playlist-track-" + index;
    document.getElementById(divId).scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }
}

function refreshUI() {
  if (g_tracks.length > 0) {
    if (g_player.engine.src) {
      g_player.buttonPlay.classList.remove("ap-disabled");
      g_player.buttonPause.classList.remove("ap-disabled");
    } else {
      g_player.buttonPlay.classList.add("ap-disabled");
      g_player.buttonPause.classList.add("ap-disabled");
    }

    if (g_player.isPlaying) {
      g_player.buttonPlay.classList.add("hide");
      g_player.buttonPause.classList.remove("hide");
    } else {
      g_player.buttonPlay.classList.remove("hide");
      g_player.buttonPause.classList.add("hide");
    }

    if (g_settings.repeat || g_currentTrackIndex > 0) {
      g_player.buttonPrev.classList.remove("ap-disabled");
    } else {
      g_player.buttonPrev.classList.add("ap-disabled");
    }
    if (g_settings.repeat || g_tracks.length - 1 > g_currentTrackIndex) {
      g_player.buttonNext.classList.remove("ap-disabled");
    } else {
      g_player.buttonNext.classList.add("ap-disabled");
    }
  } else {
    g_player.buttonPlay.classList.remove("hide");
    g_player.buttonPlay.classList.add("ap-disabled");
    g_player.buttonPause.classList.add("hide");
    g_player.buttonPrev.classList.add("ap-disabled");
    g_player.buttonNext.classList.add("ap-disabled");
  }

  if (g_player.engine.volume > 0) {
    g_player.buttonVolumeOn.classList.add("ap-hidden");
    g_player.buttonVolumeOff.classList.remove("ap-hidden");
  } else {
    g_player.buttonVolumeOn.classList.remove("ap-hidden");
    g_player.buttonVolumeOff.classList.add("ap-hidden");
  }

  if (g_settings.shuffle) {
    g_player.buttonShuffleOff.classList.remove("ap-hidden");
    g_player.buttonShuffleOn.classList.add("ap-hidden");
  } else {
    g_player.buttonShuffleOff.classList.add("ap-hidden");
    g_player.buttonShuffleOn.classList.remove("ap-hidden");
  }
  if (g_settings.repeat) {
    g_player.buttonRepeatOff.classList.remove("ap-hidden");
    g_player.buttonRepeatOn.classList.add("ap-hidden");
  } else {
    g_player.buttonRepeatOff.classList.add("ap-hidden");
    g_player.buttonRepeatOn.classList.remove("ap-hidden");
  }

  if (g_tracks.length > 0) {
    g_player.buttonClear.classList.remove("ap-disabled");
    g_player.buttonSave.classList.remove("ap-disabled");
  } else {
    g_player.buttonClear.classList.add("ap-disabled");
    g_player.buttonSave.classList.add("ap-disabled");
  }
  if (g_tracks.length > 0 && g_selectedTrackFileIndex !== undefined) {
    g_player.buttonDelete.classList.remove("ap-disabled");
  } else {
    g_player.buttonDelete.classList.add("ap-disabled");
  }
  updatePlaylistInfo();
}

function onButtonClicked(buttonName) {
  if (buttonName === "play") {
    g_player.engine.play();
    g_player.isPlaying = true;
  } else if (buttonName === "pause") {
    pauseTrack(false);
  } else if (buttonName === "prev") {
    if (g_settings.repeat && g_currentTrackIndex === 0)
      playTrack(g_tracks.length - 1, 0);
    else playTrack(g_currentTrackIndex - 1, 0);
  } else if (buttonName === "next") {
    if (g_settings.repeat && g_currentTrackIndex === g_tracks.length - 1)
      playTrack(0, 0);
    else playTrack(g_currentTrackIndex + 1, 0);
  } else if (buttonName === "open") {
    ipcRenderer.send("audio-player", "open-files");
  } else if (buttonName === "playlist") {
    if (g_player.divPlaylist.classList.contains("ap-hidden")) {
      g_player.divPlaylist.classList.remove("ap-hidden");
      g_settings.showPlaylist = true;
    } else {
      g_player.divPlaylist.classList.add("ap-hidden");
      g_settings.showPlaylist = false;
    }
  } else if (buttonName === "volume-off") {
    g_player.lastVolume = g_player.engine.volume;
    g_player.engine.volume = 0;
  } else if (buttonName === "volume-on") {
    if (g_player.lastVolume) g_player.engine.volume = g_player.lastVolume;
    else g_player.engine.volume = 1;
  } else if (buttonName === "close") {
    ipcRenderer.send("audio-player", "close");
  }
  // playlist
  else if (buttonName === "shuffle-on") {
    g_settings.shuffle = true;
    createTracksList(true);
  } else if (buttonName === "shuffle-off") {
    g_settings.shuffle = false;
    createTracksList(true);
  } else if (buttonName === "repeat-on") {
    g_settings.repeat = true;
  } else if (buttonName === "repeat-off") {
    g_settings.repeat = false;
  } else if (buttonName === "clear") {
    if (g_tracks.length <= 0) return;
    g_playlist.files = [];
    g_tracks = [];
    g_selectedTrackFileIndex = undefined;
    pauseTrack(true);
  } else if (buttonName === "add") {
    ipcRenderer.send("audio-player", "add-files");
  } else if (buttonName === "delete") {
    if (g_tracks.length <= 0 || g_selectedTrackFileIndex === undefined) return;
    let currentTrackFileIndex = g_tracks[g_currentTrackIndex].fileIndex;
    // delete
    g_playlist.files.splice(g_selectedTrackFileIndex, 1);
    let selectedTrackIndex = 0;
    for (let index = 0; index < g_tracks.length; index++) {
      const track = g_tracks[index];
      if (track.fileIndex === g_selectedTrackFileIndex)
        selectedTrackIndex = index;
      if (track.fileIndex > g_selectedTrackFileIndex) {
        track.fileIndex--;
        track.fileUrl = g_playlist.files[track.fileIndex].url;
      }
    }
    g_tracks.splice(selectedTrackIndex, 1);
    // update current index / playing track if needed
    if (currentTrackFileIndex === g_selectedTrackFileIndex) {
      // deleting the current one
      if (g_currentTrackIndex < g_tracks.length) {
        if (g_player.isPlaying) {
          playTrack(g_currentTrackIndex, 0);
        } else {
          loadTrack(g_currentTrackIndex, 0);
        }
      } else {
        // the deleted one was the last
        pauseTrack(false);
        g_currentTrackIndex = 0;
        if (g_tracks.length > 0) loadTrack(0, 0);
      }
    } else {
      if (g_currentTrackIndex < selectedTrackIndex) {
        // keep the same
      } else {
        g_currentTrackIndex--;
      }
    }
    if (g_tracks.length > 0) {
      g_selectedTrackFileIndex = g_tracks[g_currentTrackIndex].fileIndex;
    } else {
      g_selectedTrackFileIndex = undefined;
    }
    updatePlaylistInfo();
  } else if (buttonName === "save-playlist") {
    if (g_playlist.files.length > 0)
      ipcRenderer.send("audio-player", "save-playlist", g_playlist);
  }

  refreshUI();
}

exports.onPlaylistTrackClicked = onPlaylistTrackClicked;
function onPlaylistTrackClicked(fileIndex) {
  g_selectedTrackFileIndex = fileIndex;
  updatePlaylistInfo();
}

exports.onPlaylistTrackDoubleClicked = onPlaylistTrackDoubleClicked;
function onPlaylistTrackDoubleClicked(fileIndex) {
  let newTrackIndex;
  for (let index = 0; index < g_tracks.length; index++) {
    if (g_tracks[index].fileIndex === fileIndex) {
      newTrackIndex = index;
      break;
    }
  }
  if (newTrackIndex !== undefined) playTrack(newTrackIndex, 0);
}

function onSliderTimeChanged(slider) {
  if (!isNaN(g_player.engine.duration))
    g_player.engine.currentTime =
      (slider.value * g_player.engine.duration) / 100;
}

function onSliderVolumeChanged(slider) {
  g_player.engine.volume = slider.value / 100;
}

function getFormatedTimeFromSeconds(seconds) {
  if (isNaN(seconds)) return "00:00";
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds - hours * 3600) / 60);
  seconds = Math.floor(seconds - hours * 3600 - minutes * 60);
  if (minutes < 10) minutes = "0" + minutes;
  if (seconds < 10) seconds = "0" + seconds;
  return minutes + ":" + seconds;
}

function reducePlaylistNameString(input) {
  var length = 28;
  input =
    input.length > length
      ? "..." + input.substring(input.length - length, input.length)
      : input;
  return input;
}

// ref: https://en.wikipedia.org/wiki/Fisher-Yates_shuffle#The_modern_algorithm
// ref: https://www.geeksforgeeks.org/how-to-shuffle-an-array-using-javascript/
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }

  return array;
}

function init(settings, playlist) {
  g_player.engine = document.getElementById("html-audio");
  ///////
  g_player.buttonOpen = document.getElementById("ap-button-open");
  g_player.buttonOpen.addEventListener("click", function () {
    onButtonClicked("open");
  });

  g_player.buttonPlay = document.getElementById("ap-button-play");
  g_player.buttonPlay.addEventListener("click", function () {
    onButtonClicked("play");
  });
  g_player.buttonPause = document.getElementById("ap-button-pause");
  g_player.buttonPause.addEventListener("click", function () {
    onButtonClicked("pause");
  });
  g_player.buttonPrev = document.getElementById("ap-button-prev");
  g_player.buttonPrev.addEventListener("click", function () {
    onButtonClicked("prev");
  });
  g_player.buttonNext = document.getElementById("ap-button-next");
  g_player.buttonNext.addEventListener("click", function () {
    onButtonClicked("next");
  });

  g_player.textTime = document.getElementById("ap-text-time");
  g_player.sliderTime = document.getElementById("ap-slider-time");
  g_player.sliderTime.addEventListener("input", function () {
    onSliderTimeChanged(g_player.sliderTime);
  });

  g_player.buttonVolumeOff = document.getElementById("ap-button-volume-off");
  g_player.buttonVolumeOff.addEventListener("click", function () {
    onButtonClicked("volume-off");
  });
  g_player.buttonVolumeOn = document.getElementById("ap-button-volume-on");
  g_player.buttonVolumeOn.addEventListener("click", function () {
    onButtonClicked("volume-on");
  });
  g_player.textVolume = document.getElementById("ap-text-volume");
  g_player.sliderVolume = document.getElementById("ap-slider-volume");
  g_player.sliderVolume.addEventListener("input", function () {
    onSliderVolumeChanged(g_player.sliderVolume);
  });
  g_player.sliderVolume.addEventListener("change", function () {
    refreshUI();
  });

  g_player.divPlaylist = document.getElementById("ap-div-playlist");
  g_player.buttonPlaylist = document.getElementById("ap-button-playlist");
  g_player.buttonPlaylist.addEventListener("click", function () {
    onButtonClicked("playlist");
  });
  g_player.buttonClose = document.getElementById("ap-button-close");
  g_player.buttonClose.addEventListener("click", function () {
    onButtonClicked("close");
  });
  //////
  g_player.divPlaylistTracks = document.getElementById(
    "ap-div-playlist-tracks"
  );

  g_player.buttonShuffleOn = document.getElementById("ap-button-shuffle-on");
  g_player.buttonShuffleOn.addEventListener("click", function () {
    onButtonClicked("shuffle-on");
  });
  g_player.buttonShuffleOff = document.getElementById("ap-button-shuffle-off");
  g_player.buttonShuffleOff.addEventListener("click", function () {
    onButtonClicked("shuffle-off");
  });
  g_player.buttonRepeatOn = document.getElementById("ap-button-repeat-on");
  g_player.buttonRepeatOn.addEventListener("click", function () {
    onButtonClicked("repeat-on");
  });
  g_player.buttonRepeatOff = document.getElementById("ap-button-repeat-off");
  g_player.buttonRepeatOff.addEventListener("click", function () {
    onButtonClicked("repeat-off");
  });

  g_player.buttonClear = document.getElementById("ap-button-clear");
  g_player.buttonClear.addEventListener("click", function () {
    onButtonClicked("clear");
  });
  g_player.buttonAdd = document.getElementById("ap-button-add");
  g_player.buttonAdd.addEventListener("click", function () {
    onButtonClicked("add");
  });
  g_player.buttonDelete = document.getElementById("ap-button-delete");
  g_player.buttonDelete.addEventListener("click", function () {
    onButtonClicked("delete");
  });
  g_player.buttonSave = document.getElementById("ap-button-save");
  g_player.buttonSave.addEventListener("click", function () {
    onButtonClicked("save-playlist");
  });
  //////

  // Events
  g_player.engine.addEventListener("timeupdate", function () {
    g_player.textTime.innerHTML =
      getFormatedTimeFromSeconds(this.currentTime) +
      " / " +
      getFormatedTimeFromSeconds(this.duration);
    if (!isNaN(this.duration))
      g_player.sliderTime.value = (100 * this.currentTime) / this.duration;
  });

  g_player.engine.addEventListener("volumechange", function () {
    g_player.textVolume.innerHTML = `${Math.floor(this.volume * 100)}%`;
    g_player.sliderVolume.value = this.volume * 100;
  });

  g_player.engine.addEventListener("loadeddata", function () {
    if (g_tracks.length <= 0) return;
    let fileIndex = g_tracks[g_currentTrackIndex].fileIndex;
    if (
      !g_playlist.files[fileIndex].duration ||
      g_playlist.files[fileIndex].duration == -1
    ) {
      g_playlist.files[fileIndex].duration = g_player.engine.duration;
      updatePlaylistInfo();
    }
  });

  g_player.engine.addEventListener("ended", function () {
    if (g_tracks.length - 1 > g_currentTrackIndex) {
      playTrack(g_currentTrackIndex + 1, 0);
    } else {
      if (g_settings.repeat) {
        playTrack(0, 0);
      } else {
        pauseTrack(false);
        loadTrack(0, 0);
      }
    }
    refreshUI();
  });

  // load settings & playlist
  g_settings = settings;
  g_playlist = playlist;

  g_player.isPlaying = false;
  g_player.engine.volume = g_settings.volume;
  g_player.textVolume.innerHTML = `${Math.floor(g_settings.volume * 100)}%`;
  g_player.sliderVolume.value = g_settings.volume * 100;
  if (g_settings.showPlaylist)
    g_player.divPlaylist.classList.remove("ap-hidden");
  else g_player.divPlaylist.classList.add("ap-hidden");
  if (g_playlist.files.length > 0) {
    createTracksList(false);
    let trackIndex = 0;
    if (g_settings.currentFileIndex) {
      for (let index = 0; index < g_tracks.length; index++) {
        const track = g_tracks[index];
        if (track.fileIndex === g_settings.currentFileIndex) {
          trackIndex = index;
          break;
        }
      }
    }
    loadTrack(trackIndex, g_settings.currentTime ?? 0);
    refreshUI();
    fillTimes(); // calls updatePlaylistInfo
    fillTags();
  }
  refreshUI();
  setTimeout(scrollToCurrent, 100);

  // will send settings and playlist to main
  // so on quit the info is immediately available
  // TODO: maybe do it a more efficient way
  sendConfigUpdateTimeout();
}

let g_configUpdateTimeout;
function sendConfigUpdateTimeout() {
  g_settings.volume = g_player.engine.volume;
  if (g_tracks.length > 0)
    g_settings.currentFileIndex = g_tracks[g_currentTrackIndex].fileIndex;
  else g_settings.currentFileIndex = undefined;
  g_settings.currentTime = g_player.engine.currentTime;
  ipcRenderer.send("audio-player", "update-config", g_settings, g_playlist);
  g_configUpdateTimeout = setTimeout(sendConfigUpdateTimeout, 2000);
}
// TODO: call clearTimeout(g_configUpdateTimeout); on exit?
