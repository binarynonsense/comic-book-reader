# ACBR - Comic Book Reader

A comic book reader and converter for CBZ, CBR, CB7, EPUB, FB2, MOBI and PDF files.

![git_banner](https://github.com/user-attachments/assets/6ef7ded2-749a-4efd-a6b7-109d0f33d603)

<p align="center">
  <span>English</span> |
  <a href="./README.es.md">Español</a> | 
  <a href="./README.ru.md">Русский</a> | 
  <a href="./README.de.md">Deutsch</a> | 
  <a href="./README.ar.md">العربية</a> | 
  <a href="./README.fil.md">Filipino</a>
</p>

## Contents:

- [Features](#features)
- [Downloads](#downloads)
- [Contributions](#contributions)
- [Other](#other)

## Features:

- Windows & Linux versions
- Compatible file formats<sup>[1]</sup>:
  - Comic books:
    - CBZ, CBR, CB7, PDF and EPUB
  - Image files:
    - JPG, PNG, WebP and AVIF
  - Ebooks:
    - PDF, FB2, MOBI and EPUB
- Windowed (simple UI) and full-screen (no UI) modes
- 'Single page', 'double page' and 'double page (center first page)' page modes
- 'Fit to width', 'fit to height' and a customizable 'scale to height' page views
- Page rotation
- UI available in:
  - English, Spanish, Russian, German, Arabic and Filipino
- Automatically restores the previous session's last opened book and page, and remembers the last books' page positions.
- Portable mode (by creating a file named portable.txt in the same folder as the executable)
- Metadata editor:
  - View the metadata in PDF and EPUB files or stored in ComicInfo.xml files inside CBR, CBZ and CB7 comic books.
  - Create and/or modify the metadata in PDF and EPUB files or stored in ComicInfo.xml files inside unencrypted CBR<sup>[3]</sup>, CBZ and CB7 comic books.
  - Search for and import comic book metadata from Comic Vine (a [Comic Vine API key](https://comicvine.gamespot.com/api/) is required).
- Integrated audio player:
  - Supports MP3, Ogg, WAV, M3U and M3U8 files.
  - Can export playlists to M3U files.
- Tools:
  - Files:
    - Convert/Resize:
      - Comic books and ebooks (CBR, CBZ, CB7, FB2, MOBI, PDF or EPUB) to comic books (CBR<sup>[3]</sup>, CBZ, CB7, PDF or EPUB<sup>[2]</sup>)
      - Images (JPG, PNG, AVIF or WebP)
    - Create:
      - A comic book (CBR<sup>[3]</sup>, CBZ, CB7, PDF or EPUB<sup>[2]</sup>) from a list of image files, ebooks and/or comic books
      - A QR code image from text
    - Extract:
      - Comic book pages (to JPG, PNG, AVIF or WebP)
      - Text (OCR) from a comic book page or image file
      - A QR code's text from a comic book page or image file
      - A color palette from a comic book page or image file
        - Can be exported to a GPL or ACO palette file.
  - Search:
    - Search and open books/comics from:
      - Digital Comics Museum
      - Internet Archive Books
      - Project Gutenberg
      - xkcd Webcomics
      - Comic Book Plus
    - Search and open audiobooks from:
      - Librivox AudioBooks
    - Search dictionary terms from:
      - Wiktionary Dictionary
    - Search and open radio station streams from:
      - radio-browser
    - Search and open RSS feeds from podcasts and websites.
  - Art:
    - Comic book page and thumbnails template maker
    - Color palette extractor
  - Other:
    - RSS reader
    - Internet Radio

> Notes:
>
> [1]: Including password protected PDF, CBZ, CB7 and CBR files.
>
> [2]: Images only.
>
> [3]: Creating and modifying CBR files are disabled by default. They can be enabled in the preferences but require a third-party command-line tool ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) from WinRAR) to be installed in the system.

## Downloads:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a>

Stable version:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Self-Extracting)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)
- [Linux (deb)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_deb.zip)
- [Linux (flatpak)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_flatpak.zip)

> Note: For Linux distributions that require setting an AppArmor profile for Electron apps to run, like Ubuntu 24.04, it's best not to choose the regular or AppImage versions as they probably won't work by default due to that restriction.

All versions (stable and beta):

- [Releases list](https://github.com/binarynonsense/comic-book-reader/releases)

Also available on:

- [Flathub](https://flathub.org/apps/com.binarynonsense.acbr)

## Contributions:

Design and Programming:
- [Álvaro García (binarynonsense)](https://github.com/binarynonsense)
    
Localizations:
- [Álvaro García (binarynonsense)](https://github.com/binarynonsense) (English, Español)
- [vanja-san](https://github.com/vanja-san) (Русский)
- [Timo Heidutzek (trzyglow)](https://github.com/trzyglow) (Deutsch)
- [Ahmed (ahmed-0011)](https://github.com/ahmed-0011) (العربية)
- [AndrewL (CodeByMoriarty)](https://github.com/CodeByMoriarty) (Filipino)

There's info about how to contribute to the project in the [CONTRIBUTING.md](./CONTRIBUTING.md) file.

## Other:

Screenshots and more details can be found on [the project's Wiki](https://github.com/binarynonsense/comic-book-reader/wiki).
