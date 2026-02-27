/**
 * @license
 * Copyright 2020-2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

let g_tempAudioElement;
let g_tempAudioIndex;

let g_playlist;
let g_tracks = [];
let g_currentTrackIndex = 0;
let g_selectedTrackFileIndex;

let g_ffmpegAvailable = false; // not used?
let g_player;
let g_settings;

let sendIpcToMain, onPlaylistTrackDoubleClicked;

export function init(
  player,
  loadedPlaylist,
  settings,
  ffmpegAvailable,
  _sendIpcToMain,
  _onPlaylistTrackDoubleClicked,
) {
  sendIpcToMain = _sendIpcToMain;
  onPlaylistTrackDoubleClicked = _onPlaylistTrackDoubleClicked;
  g_player = player;
  g_playlist = loadedPlaylist;
  g_settings = settings;
  g_ffmpegAvailable = ffmpegAvailable;
  if (g_playlist.files.length > 0) {
    createTracksList(false);
    let trackIndex = 0;
    if (g_settings.currentFileIndex) {
      for (let index = 0; index < g_playlist.length; index++) {
        const track = g_playlist[index];
        if (track.fileIndex === g_settings.currentFileIndex) {
          trackIndex = index;
          break;
        }
      }
    }
    // loadTrack(trackIndex, g_settings.currentTime ?? 0);
    // refreshUI();
    fillTimes(); // calls updatePlaylistInfo
    fillTags();
    return trackIndex;
  }
  return undefined;
}

// export function setPlaylist(playlist) {
//   g_playlist = playlist;
// }

export function getPlaylist() {
  return g_playlist;
}

export function getTracks() {
  return g_tracks;
}
export function setTracks(tracks) {
  g_tracks = tracks;
}

export function getCurrentTrackIndex() {
  return g_currentTrackIndex;
}
export function setCurrentTrackIndex(currentTrackIndex) {
  g_currentTrackIndex = currentTrackIndex;
}

export function getSelectedTrackFileIndex() {
  return g_selectedTrackFileIndex;
}
export function setSelectedTrackFileIndex(selectedTrackFileIndex) {
  g_selectedTrackFileIndex = selectedTrackFileIndex;
}

export function openPlaylist(playlist) {
  pauseTrack(false);
  g_playlist = playlist;
  g_selectedTrackFileIndex = undefined;
  createTracksList(false);
  updatePlaylistInfo();
  //   playTrack(g_currentTrackIndex, 0);
  fillTimes();
  fillTags();
}

export function addToPlaylist(files, startPlaying, allowDuplicates = false) {
  let returnTrackIndex;
  if (files && Array.isArray(files) && files.length > 0) {
    if (!allowDuplicates) {
      const newFiles = files.filter((file) => !isFileInPlaylist(file));
      if (newFiles.length === 0) {
        // no new one
        const listIndex = getPlaylistIndex(files[0]);
        // playTrack(listIndex, 0);
        return listIndex;
      } else {
        files = newFiles;
      }
    }
    // TODO: MAYBE: start first new song by default after adding?
    const oldLength = g_tracks.length;
    g_playlist.files.push(...files);
    createTracksList(g_tracks.length > 0);
    if (oldLength === 0 || startPlaying) {
      //   playTrack(oldLength, 0);
      returnTrackIndex = oldLength;
    }
    // refreshUI();
    fillTimes(); // calls updatePlaylistInfo
    fillTags();
  }
  return returnTrackIndex;
}

export function onTagsFilled(updatedFiles) {
  if (updatedFiles && updatedFiles.length > 0) {
    for (let index = 0; index < g_playlist.files.length; index++) {
      const file = g_playlist.files[index];
      if (file.title && file.artist) continue;
      for (let j = 0; j < updatedFiles.length; j++) {
        const updatedFile = updatedFiles[j];
        if (updatedFile.url === file.url) {
          file.artist = updatedFile.artist;
          file.title = updatedFile.title;
        }
      }
    }
  }
  updatePlaylistInfo();
}

//////////////

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

export function updateCurrentFileTags(title, artist, duration) {
  let index = g_tracks[g_currentTrackIndex].fileIndex;
  if (title) g_playlist.files[index].title = title;
  if (artist) g_playlist.files[index].artist = artist;
  if (duration) g_playlist.files[index].duration = duration;
  updatePlaylistInfo();
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

function fillTags() {
  sendIpcToMain("fill-tags", g_playlist.files);
}

////////////////////////////////////////////////

function isFileInPlaylist(file) {
  for (let i = 0; i < g_playlist.files.length; i++) {
    const playlistFile = g_playlist.files[i];
    if (playlistFile.url === file.url) return true;
  }
  return false;
}

function getPlaylistIndex(file) {
  for (let i = 0; i < g_playlist.files.length; i++) {
    const playlistFile = g_playlist.files[i];
    if (playlistFile.url === file.url) return i;
  }
  return -1;
}

////////////////////////////////////////////////

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

export function updatePlaylistInfo() {
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
    let fullName;
    if (file.title && file.artist) {
      fullName = `${file.artist} - ${file.title}`;
    } else if (file.title) {
      fullName = `${file.title}`;
    } else {
      var filenameextension = file.url.replace(/^.*[\\\/]/, "");
      var filename = filenameextension.substring(
        0,
        filenameextension.lastIndexOf("."),
      );
      //var ext = filenameextension.split(".").pop();
      if (!filename || filename == "") filename = file.url;
      fullName = filename;
    }
    let content = `<span title="${fullName}\n${file.url}" class="ap-span-playlist-track-title">${fullName}</span
  ><span class="ap-span-playlist-track-time">${duration}</span>`;
    div.innerHTML = content;
    g_player.divPlaylistTracks.appendChild(div);
  }
}

////////////////////////////////////////////////

export function scrollToCurrent() {
  if (
    g_currentTrackIndex !== undefined &&
    g_tracks.length > g_currentTrackIndex
  ) {
    let index = g_tracks[g_currentTrackIndex].fileIndex;
    let divId = "ap-playlist-track-" + index;
    document.getElementById(divId).scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }
}

function onPlaylistTrackClicked(fileIndex) {
  g_selectedTrackFileIndex = fileIndex;
  updatePlaylistInfo();
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

export function getFormatedTimeFromSeconds(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return "--:--";
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds - hours * 3600) / 60);
  seconds = Math.floor(seconds - hours * 3600 - minutes * 60);
  if (minutes < 10) minutes = "0" + minutes;
  if (seconds < 10) seconds = "0" + seconds;
  return minutes + ":" + seconds;
}
