# ACBR - Comic Book Reader

A comic book reader and converter for cbz, cbr, cb7, epub and pdf files.

<p align="center">
  <img width="299" height="224" src="https://raw.githubusercontent.com/binarynonsense/comic-book-reader/master/screenshots/screenshot_01.jpg"> <img width="299" height="224" src="https://raw.githubusercontent.com/binarynonsense/comic-book-reader/master/screenshots/screenshot_02.jpg"> <img width="299" height="224" src="https://raw.githubusercontent.com/binarynonsense/comic-book-reader/master/screenshots/screenshot_03.jpg">
</p>

## Features:

- Windows & GNU/Linux versions.
- Compatible file formats:
  - .cbz
  - .cbr
  - .cb7
  - .pdf
  - .epub (images only)
  - image files (.jpg, .png, .webp or .avif)
  Including password protected pdf, cbz (AES encryption not supported), cb7 and cbr files.
- Windowed (simple UI) and full-screen (no UI) modes.
- 'Fit to width', 'fit to height' and a customizable 'scale to height' page views.
- Page rotation.
- UI available in:
  - English
  - Spanish
- Automatically restores the previous session's last opened book and page, and remembers the last books' page positions.
- Portable mode (by creating a file named portable.txt in the same folder as the executable).
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

## License

ACBR's code is released under the BSD 2-Clause [license](./LICENSE). To check the licenses of the node modules and other libraries used in the project go to the [licenses](./licenses/) folder.
