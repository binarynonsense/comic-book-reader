const { ipcRenderer } = require("electron");

let g_player = {};
let g_playlist = {
  id: "",
  source: "",
  files: [],
};
let g_tracks = [];
let g_currentTrackIndex = 0;
let g_tempAudioElement;
let g_tempAudioIndex;
let g_selectedTrackFileIndex;

ipcRenderer.on("audio-player", (event, ...args) => {
  if (args[0] === "init") {
    init(false, false, 0.3, args[1]);
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
  } else if (args[0] === "update-layout-pos") {
    let container = document.getElementById("audio-player-container");
    if (args[1] == 0) {
      container.classList.remove("ap-layout-bottom-left");
      container.classList.add("ap-layout-top-left");
    } else {
      container.classList.add("ap-layout-bottom-left");
      container.classList.remove("ap-layout-top-left");
    }
  }
});

function fillTimes() {
  g_tempAudioIndex = 0;
  g_tempAudioIndex = getNextToFill();
  if (g_tempAudioIndex >= 0) {
    if (!g_tempAudioElement)
      g_tempAudioElement = document.createElement("audio");
    g_tempAudioElement.muted = true;
    g_tempAudioElement.preload = true;
    g_tempAudioElement.src = g_playlist.files[0].url;
    g_tempAudioElement.addEventListener("loadeddata", function () {
      g_playlist.files[g_tempAudioIndex].duration = g_tempAudioElement.duration;
      g_tempAudioIndex++;
      g_tempAudioIndex = getNextToFill();
      if (g_tempAudioIndex > 0 && g_tempAudioIndex < g_playlist.files.length) {
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
}

function getNextToFill() {
  for (let index = g_tempAudioIndex; index < g_playlist.files.length; index++) {
    const file = g_playlist.files[index];
    if (file.duration) continue;
    return index;
  }
  return -1;
}

function createTracksList(isRefresh) {
  let currentFileIndex;
  if (isRefresh && g_tracks.length > 0)
    currentFileIndex = g_tracks[g_currentTrackIndex].fileIndex;
  g_tracks = [];
  for (let index = 0; index < g_playlist.files.length; index++) {
    if (g_player.shuffle && currentFileIndex === index) {
      continue;
    }
    g_tracks.push({ fileIndex: index, fileUrl: g_playlist.files[index].url });
  }
  // shuffled
  if (g_player.shuffle) {
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
  if (!g_playlist || g_tracks.length === 0) {
    g_player.divPlaylistTracks.innerHTML = "";
    return;
  }
  let content = "";
  for (let index = 0; index < g_playlist.files.length; index++) {
    const file = g_playlist.files[index];
    let id = "";
    let duration = "--:--";
    let classlist = "ap-div-playlist-track";
    if (g_tracks[g_currentTrackIndex].fileIndex === index) {
      classlist += " ap-div-playlist-current-track";
    }
    if (index === g_selectedTrackFileIndex) {
      classlist += " ap-div-playlist-selected-track";
    }
    if (file.duration !== undefined && file.duration >= 0) {
      duration = getFormatedTimeFromSeconds(file.duration);
    }
    content += `<div class="${classlist}" onclick="player.onPlaylistTrackClicked(${index})"  ondblclick="player.onPlaylistTrackDoubleClicked(${index})"><span>${reducePlaylistNameString(
      file.url
    )}</span
  ><span class="ap-span-playlist-track-time">${duration}</span></div>`;
  }

  g_player.divPlaylistTracks.innerHTML = content;
}

function loadTrack(index, time) {
  g_currentTrackIndex = index;
  g_selectedTrackFileIndex = g_tracks[g_currentTrackIndex].fileIndex;
  g_player.engine.src = g_tracks[g_currentTrackIndex].fileUrl;
  g_player.engine.currentTime = time;
  g_player.sliderTime.value = time;
}

function playTrack(index, time) {
  loadTrack(index, time);
  g_player.engine.play();
  g_player.isPlaying = true;
  refreshUI();
}

function pauseTrack(refreshUI = true) {
  g_player.engine.pause();
  g_player.isPlaying = false;
  if (refreshUI) refreshUI();
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

    if (g_player.repeat || g_currentTrackIndex > 0) {
      g_player.buttonPrev.classList.remove("ap-disabled");
    } else {
      g_player.buttonPrev.classList.add("ap-disabled");
    }
    if (g_player.repeat || g_tracks.length - 1 > g_currentTrackIndex) {
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

  if (g_player.shuffle) {
    g_player.buttonShuffleOff.classList.remove("ap-hidden");
    g_player.buttonShuffleOn.classList.add("ap-hidden");
  } else {
    g_player.buttonShuffleOff.classList.add("ap-hidden");
    g_player.buttonShuffleOn.classList.remove("ap-hidden");
  }
  if (g_player.repeat) {
    g_player.buttonRepeatOff.classList.remove("ap-hidden");
    g_player.buttonRepeatOn.classList.add("ap-hidden");
  } else {
    g_player.buttonRepeatOff.classList.add("ap-hidden");
    g_player.buttonRepeatOn.classList.remove("ap-hidden");
  }
  updatePlaylistInfo();
}

function onButtonClicked(buttonName) {
  console.log(buttonName);
  if (buttonName === "play") {
    g_player.engine.play();
    g_player.isPlaying = true;
  } else if (buttonName === "pause") {
    pauseTrack(false);
  } else if (buttonName === "prev") {
    if (g_player.repeat && g_currentTrackIndex === 0)
      playTrack(g_tracks.length - 1, 0);
    else playTrack(g_currentTrackIndex - 1, 0);
  } else if (buttonName === "next") {
    if (g_player.repeat && g_currentTrackIndex === g_tracks.length - 1)
      playTrack(0, 0);
    else playTrack(g_currentTrackIndex + 1, 0);
  } else if (buttonName === "open") {
    ipcRenderer.send("audio-player", "open-files");
  } else if (buttonName === "playlist") {
    if (g_player.divPlaylist.classList.contains("ap-hidden")) {
      g_player.divPlaylist.classList.remove("ap-hidden");
    } else {
      g_player.divPlaylist.classList.add("ap-hidden");
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
    g_player.shuffle = true;
    createTracksList(true);
  } else if (buttonName === "shuffle-off") {
    g_player.shuffle = false;
    createTracksList(true);
  } else if (buttonName === "repeat-on") {
    g_player.repeat = true;
  } else if (buttonName === "repeat-off") {
    g_player.repeat = false;
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
      // deleteing the current one
      if (g_currentTrackIndex < g_tracks.length) {
        playTrack(g_currentTrackIndex, 0);
      } else {
        // the deleted one was the last
        pauseTrack(false);
        g_currentTrackIndex = 0;
        if (g_tracks.length > 0) g_player.engine.src = g_tracks[0].fileUrl;
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
      g_selectedTrackFileIndex = 0;
    }
    updatePlaylistInfo();
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

function init(shuffle, repeat, volume, localization) {
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

  g_player.buttonAdd = document.getElementById("ap-button-add");
  g_player.buttonAdd.addEventListener("click", function () {
    onButtonClicked("add");
  });
  g_player.buttonDelete = document.getElementById("ap-button-delete");
  g_player.buttonDelete.addEventListener("click", function () {
    onButtonClicked("delete");
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

  g_player.engine.addEventListener("ended", function () {
    if (g_tracks.length - 1 > g_currentTrackIndex) {
      playTrack(g_currentTrackIndex + 1, 0);
    } else {
      if (g_player.repeat) {
        playTrack(0, 0);
      } else {
        pauseTrack(false);
        loadTrack(0, 0);
      }
    }
    refreshUI();
  });

  // localization
  for (let index = 0; index < localization.length; index++) {
    const element = localization[index];
    const domElement = document.getElementById(element.id);
    if (domElement !== null) {
      domElement.title = element.text;
    }
  }

  g_player.isPlaying = false;
  g_player.shuffle = shuffle;
  g_player.repeat = repeat;
  g_player.engine.volume = volume;
  g_player.sliderVolume.value = volume * 100;
  g_player.divPlaylist.classList.add("ap-hidden");

  refreshUI();
}
