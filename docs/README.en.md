<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://mastodon.social/@binarynonsense"><img src="https://github.com/binarynonsense/comic-book-reader/assets/8535921/053fff88-5e38-4928-8b50-9ecaf1be20f1" title="my mastodon"></a>
</p>

# ACBR - Comic Book Reader

A comic book reader and converter for CBZ, CBR, CB7, EPUB and PDF files.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <span>English</span> |
  <a href="./README.es.md">Español</a> | 
  <a href="./README.ru.md">Русский</a> | 
  <a href="./README.de.md">Deutsch</a> | 
  <a href="./README.ar.md">العربية</a>
</p>

## Contents:

- [Features](#features)
- [Downloads](#downloads)
- [Contributions](#contributions)
- [License](#license)
- [Other](#other)

## Features:

- Windows & Linux versions
- Compatible file formats:
  - Comic books:
    - CBZ, CBR, CB7, PDF and EPUB<sup>[1]</sup>
  - Image files:
    - JPG, PNG, WebP and AVIF
  - Ebooks:
    - PDF and EPUB<sup>[2]</sup>
    
  Including password protected PDF, CBZ (AES encryption not supported), CB7 and CBR files.
- Windowed (simple UI) and full-screen (no UI) modes
- 'Fit to width', 'fit to height' and a customizable 'scale to height' page views
- Page rotation
- UI available in:
  - English, Spanish, Russian, German and Arabic
- Automatically restores the previous session's last opened book and page, and remembers the last books' page positions.
- Portable mode (by creating a file named portable.txt in the same folder as the executable)
- ComicInfo.xml editor:
  - View the metadata stored in ComicInfo.xml files inside CBR, CBZ and CB7 comic books.
  - Create and/or modify the metadata stored in ComicInfo.xml files inside unencrypted CBR<sup>[3]</sup>, CBZ and CB7 comic books.
  - Search for and import comic book metadata from Comic Vine (a [Comic Vine API key](https://comicvine.gamespot.com/api/) is required).
- Integrated audio player:
  - Supports MP3, Ogg, WAV, M3U and M3U8 files.
  - Can export playlists to M3U files.
- Tools:
  - Convert/Resize:
    - Comic books (CBR, CBZ, CB7, PDF or EPUB<sup>[1]</sup> to CBR<sup>[3]</sup>, CBZ, CB7, PDF or EPUB)
    - Images (JPG, PNG, AVIF or WebP)
  - Create:
    - A comic book (CBR<sup>[3]</sup>, CBZ, CB7, PDF or EPUB) from a list of image files and/or comic books
    - A QR code image from text
  - Extract:
    - Comic book pages (to JPG, PNG, AVIF or WebP)
    - Text (OCR) from a comic book page or image file
    - A QR code's text from a comic book page or image file
    - A color palette from a comic book page or image file
      - Can be exported to a GPL or ACO palette file.
  - Other:
    - Search and open books/comics from:
      - Digital Comics Museum
      - Internet Archive Books
      - Project Gutenberg
      - xkcd Webcomics
    - Search and open audiobooks from:
      - Librivox AudioBooks
    - Search dictionary terms from:
      - Wiktionary Dictionary
    - Search and open radio station streams from:
      - radio-browser

> Notes:
>
> [1]: Images only.
>
> [2]: Reading EPUB Ebooks is an experimental / extra feature outside the main scope of the project. It may not work for all files and could be removed in future versions if necessary.
>
> [3]: Creating and modifying CBR files are disabled by default. They can be enabled in the preferences but require a third-party command-line tool ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) from WinRAR) to be installed in the system.

## Downloads:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a>

Stable version:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Self-Extracting)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

All versions (stable and beta):

- [Releases list](https://github.com/binarynonsense/comic-book-reader/releases)

## Contributions:

- Russian localization by [vanja-san](https://github.com/vanja-san)
- German localization by [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)
- Arabic localization by [Ahmed (ahmed-0011)](https://github.com/ahmed-0011)

There's info about how to contribute to the project in the [CONTRIBUTING.md](../CONTRIBUTING.md) file.

## License:

ACBR's code is released under the BSD 2-Clause [license](../LICENSE). To check the licenses of the node modules and other libraries used in the project go to the [licenses](../licenses/) folder.

## Other:

Screenshots, more details about the controls and other extra information can be found on [the project's Wiki](https://github.com/binarynonsense/comic-book-reader/wiki).
