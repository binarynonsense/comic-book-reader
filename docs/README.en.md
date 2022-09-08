<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://twitter.com/binarynonsense"><img src="https://user-images.githubusercontent.com/8535921/189104963-ae74d98e-ddb3-4068-8958-7028ecae2966.png" title="my twitter"></a>
</p>

# ACBR - Comic Book Reader

A comic book reader and converter for cbz, cbr, cb7, epub and pdf files.

![git_banner](https://user-images.githubusercontent.com/8535921/189077872-0b8dab41-9c0f-4487-9462-7cd2ba49e35a.png)

<p align="center">
  <span>English</span> |
  <a href="./README.es.md">Español</a>
</p>

## Contents:

* [Features](#features)
* [Controls](#controls)
* [Downloads](#downloads)
* [Contributions](#contributions)
* [License](#license)

## Features:

- Windows & GNU/Linux versions.
- Compatible file formats:

  - Comic books:
    - .cbz
    - .cbr
    - .cb7
    - .pdf
    - .epub
  - Image files:
    - .jpg
    - .png
    - .webp
    - .avif
  - Ebooks:
    - .pdf
    - .epub

  Including password protected pdf, cbz (AES encryption not supported), cb7 and cbr files.

- Windowed (simple UI) and full-screen (no UI) modes.
- 'Fit to width', 'fit to height' and a customizable 'scale to height' page views.
- Page rotation.
- UI available in:
  - English
  - Spanish
  - Russian
- Automatically restores the previous session's last opened book and page, and remembers the last books' page positions.
- Portable mode (by creating a file named portable.txt in the same folder as the executable).
- Integrated audio player:
  - supports .mp3, .ogg, .wav, .m3u and .m3u8 files.
  - can export playlists to .m3u files.
- Tools:
  - Convert/Resize:
    - comic books (cbr, cbz, cb7, pdf or epub to cbz, cb7, pdf or epub).
    - images (jpg, png, avif or webp).
  - Create:
    - a comic book (cbz, cb7, pdf or epub) from a list of image files.
    - a QR code image from text.
  - Extract:
    - comic book pages (to jpg, png, avif or webp).
    - text (OCR) from a comic book page or image file.
    - a QR code's text from a comic book page or image file.
    - a color palette from a comic book page or image file.
      - can be exported to a .gpl or .aco palette file.
  - Other:
    - search and open books/comics from:
      - Digital Comics Museum.
      - Internet Archive Books.
      - Project Gutenberg.
      - xkcd Webcomics.
    - search and open audiobooks from:
      - Librivox AudioBooks.
    - search dictionary terms from:
      - Wiktionary Dictionary.

## Controls:

- Toolbar :
  - buttons: 'open file', 'previous page', 'next page', 'fit to width', 'fit to height', 'rotate counterclockwise', 'rotate clockwise' and 'toggle fullscreen'.
  - slider: use it to quickly go to any page in the book.
- Keys:
  - 'right arrow' or 'page down' to go the next page.
  - 'left arrow' or 'page up' to go to the previous one.
  - 'up arrow' to scroll the page up, 'down arrow' to scroll the page down.
  - 'wasd' to scroll the page vertically and horizontally.
  - 'f11' to toggle full-screen mode.
  - 'ctrl+O' to choose a file to open.
  - 'ctrl++' and 'ctrl+-' to zoom in or zoom out the view. 'ctrl+0' to reset it.
- Mouse:
  - 'scroll wheel' scrolls the page up and down.
  - 'left-click' opens the next page if the right side of the view area is clicked and the previous page if the left side is clicked.
  - 'right-click' opens a context menu with some basic navigation options.
  - 'ctrl+scroll wheel' to zoom in or zoom out the view.

## Downloads

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Self-Extracting)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

## Contributions

- Russian localization by [vanja-san](https://github.com/vanja-san)

There's more info about how to contribute to the project in the [CONTRIBUTING.md](./CONTRIBUTING.md) file.

## License

ACBR's code is released under the BSD 2-Clause [license](../LICENSE). To check the licenses of the node modules and other libraries used in the project go to the [licenses](../licenses/) folder.
