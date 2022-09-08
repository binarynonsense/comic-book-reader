
## v2.4.0

- Added an integrated audio player. Supports .mp3, .ogg, .wav, .m3u and .m3u8 files, and can export playlists to .m3u files.
- Added a tool to search and open audiobooks from Librivox.
- Added a tool to search dictionary terms from Wiktionary.

## v2.3.0

- Added support for .epub ebooks (there are now two modes to open .epub files: as a comic book, images only, or as an ebook).
- Added a new tool to search through the books in the "Project Gutenberg" website, and open them in the system's browser or download and view their .epub version directly in ACBR (requires an internet connection).
- Added a new tool to select webcomics from the "xkcd" website, and open them in the system's browser or view them directly in ACBR (requires an internet connection).
- Added a section in the preferences to customize if you want the program to remember which mode you used to open an .epub (ebook or comic book) or ask every time.
- Some minor UI improvements and bug fixes.

## v2.2.1

Hotfix:

- Fixed rotation not working for image and online files.

## v2.2.0

- Added a new tool to search through some of the online books in the "Internet Archive" website's collection, and open them in the system's browser or view them directly in ACBR (requires an internet connection).
- Added a new tool to search through the comic books in the "Digital Comic Museum" website's online preview viewer, and open them in the system's browser or view them directly in ACBR (requires an internet connection).
- Added a section in the preferences to customize the layout of some of the UI's elements.
- Some minor fixes and improvements.

## v2.1.0

- Added support for cb7 files.
- Added support for opening image files and image folders in the reader.
- Added support for the avif image format in the reader and some of the tools.
- Added a new tool to extract color palettes from comic book pages or image files, with the option to export them to a .gpl or .aco palette file.
- Added a new tool to extract QR codes' text from comic book pages or image files.
- Added a new tool to create QR code images from text.
- Added support for password protected pdf files in the reader.
- Added support for password protected cbr files in the reader.
- Added support for password protected cbz files in the reader (AES encryption not supported, only zipCrypto).
- Added support for password protected cb7 files in the reader.
- Added a new 'Scale to Height' zoom setting, allowing setting the zoom scale to one of the preset values or a custom one.
- The view's zoom can now be increased or decreased from the menus or using 'ctrl++', 'ctrl+-', or 'ctrl+scroll wheel'.
- WASD keys can now be used to scroll the page horizontally and vertically.
- Added a basic file history manager.
- The loading page indicator can now be customized (size, position and background transparency).
- The program can now be made portable by creating a file named portable.txt in the same folder as its executable. This will make it look for, and save, its configuration files inside that folder, instead of the default behavior of saving them system-wide.
- Added an option in the preferences to hide the mouse cursor when inactive.
- A few other minor improvements and bug fixes.

## v2.0.0

- Added a dedicated menu bar section for the tools.
- Added a tool to resize and/or convert image files to other formats.
- Added a tool to extract the pages from comic book files to image files.
- Added a tool to extract text (OCR) from comic book pages or image files.
- Added more options to the convert/resize comic books tool.
- Added more options to the create comic book tool.
- Updated electron and other libraries to their latest versions.
- Improved how PDFs are extracted and created. Some of the tools now have advanced options related to this.
- Fixed some minor bugs.

## v1.2.6

- Added support for themes and a menu option (File>Preferences>Color Themes) to choose between 3 different ones (the original and dark and light new ones, with the dark one being now the default).
- Added a new auto open option to the preferences (File>Preferences>Auto Open), disabled by default, to automatically open the next file in the same folder after reaching the end of the current one and trying to navigate to the next page (it can be set to also do the same for the previous file when reaching the beginning and trying to navigate to the previous page).
- Added Russian to the available languages (translation contributed by vanja-san).
- FIXED: File>Open... dialogue not restricting the files to only ones with compatible extensions (bug introduced in the previous version).
- FIXED: application hanging when dropping a folder into it (now it just ignores it).

## v1.2.5

- Added support for files containing WebP images.
- Added a new tool (File > Create...) to create a cbz, pdf or epub file from a list of image files.
- AppImage version for Linux now available.
- FIXED: window title not being reset after the current file is closed.

## v1.2.4

- When a file is opened it's added to the history right away (it was added only after closing it).
- Increased the length limit for the file name in the title bar for bigger screen sizes.
- Added an option to show a clock in the upper right corner.
- FIXED: left/right arrows and page down/up keys not working after last update.

## v1.2.3

- Added a small text at the bottom of the view area showing the page number in full-screen mode, or when the toolbar is disabled (and the menu option to disable it if the user doesn't want/like it)
- FIX: set "en" as the current locale if the one asked for didn't exist. It was loading it correctly but not saving it to the settings.
- FIX: generate the mime type of the page images correctly, although it didn't seem to matter :)

## v1.2.2

- Added a sub-menu in the preferences menu to set the 'mouse click hotspots' layout (or to disable them). By default if the left side of the view area is left-clicked the previous page is loaded, and if the right side is left-clicked the next page is loaded.
- The values from the settings save file are now sanitized after loading them.

## v1.2.1

- Added "Open Recent" menu item.
- Added the infrastructure to allow loading user made localization files.
- FIX: The list of files from zip and rar files is now sorted in natural order (previously, they were sorted using the default numerical order, which could be incorrect in some cases).
- FIX: Change the image files' extension in the resizer if their format is changed.

## v1.2.0

- Added tools to:
  - Convert/Resize files from cbr, cbz, pdf or epub to cbz, pdf or epub.
  - Export the current page to an image file.
- Moved some of the cpu intensive work to child processes so the program doesn't feel unresponsive.
- Added a loading spinner image to indicate when something is loading.
- The file format is now deduced from the file data itself instead of from its extension (so, even if a cbz file is renamed to cbr it will be correctly detected as a zip compressed file).
- A bunch more of small performance and usability tweaks...

## v1.1.1

- The language of the UI can now be changed from the menu bar (settings>languages). Languages available in this version: English and Spanish.

## v1.1.0

- Added .epub (images only) to the compatible files.
- Pages can now be rotated.
- Page submenu (go to first, go to last and go to...) added to the main and context menus.
- You can now drag and drop a file into the program's window and it will open it.
- If you use the 'open with' option in the operative system to open a compatible file using ACBR it should now start the program and open that file.

## v1.0.0

- First public version of ACBR.
