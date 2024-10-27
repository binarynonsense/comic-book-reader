## v3.7.1

- Updated some of the core libraries to newer versions.
- Updated the Russian localization.

## v3.7.0

- Added a menu entry in the 'View > Layout > Show' section to show / hide the loading indicator.
- Added the possibility of applying some simple image operations to the pages (brightness and saturation) during the conversion to the advanced options of the comics converter tool.
- Updated some of the core libraries to newer versions.
- Fixed a bug introduced in the previous version that made exporting pages and reading/editing metadata not work for EPUB, CBZ and CB7 files.

## v3.6.3

- Fixed detecting the wrong number of pages inside CBZ and CB7 files in some rare situations.

## v3.6.2

- Fixed Delta E method not working in the extract palette tool.

## v3.6.1

- Fixed broken images in the cropper canvas when using the extract palette, QR and text tools in some specific cases (files with names containing special characters like #).

## v3.6.0

- Added EPUB metadata support to the file properties window.
- Added an EPUB metadata editor.
- Added a PDF metadata editor.
- Added an option in the history tool to set the maximum number of recent files to remember.
- Added a new tool to search and open comic books and audio files from the website "Comic Book Plus".
- Changed the way numerical image file names are generated (used during PDF extraction and in the comic creation tool) to pad them with zeros, so viewers that don't use natural sorting display the pages in the correct order.
- Updated some of the core libraries to newer versions.
- Fixed modal windows letting Space and Enter key events be passed to their parent element.
- Fixed moving the toolbar slider sometimes made the page scroll.
- Fixed some minor issues.

## v3.5.1

- Fixed missing "Name" label in the output options section of the comic creation tool's UI.

## v3.5.0

- Updated some of the core libraries to newer versions.
- Added mouse click+drag as an input option to scroll a page.
- Added touch screen input support: drag to scroll a page, pinch-zoom to zoom in and out and double tap to switch between the default zoom levels.
- Added Arabic localization (contributed by Ahmed (ahmed-0011)).
- Made the UI rearrange its components if a right-to-left language is set.
- Added a Home Screen shown when there's no file opened, with a button to open a file dialog and lists of favorite files and folders and latest files.
- Added Gamepad button mapping to the preferences.
- Added preferences, history and a convert files buttons to the Home Screen.
- Clicking the mouse wheel button now opens the quick menu (it can be configured in the preferences).
- Added the option to include folders in the input list of the convert and create comics tools. The folders in the input list will be searched for valid files to use during the conversion/creation process (there's an advanced option to enable searching them recursively and another to select which file types are valid).
- Added an option in the convert comics tool to select between choosing an output folder for all files or saving each one in the same folder as its corresponding input file.
- Added an advanced option in the convert comics tool to select between overwriting the output file if it already exists, save it with a name not already in use or skip saving it.
- Added an experimental color mode preference (light or dark) for EPUB ebooks.
- Added an option in the preferences to set maximum number of latest files shown in the Home Screen.
- Added a new tool, Internet Radio, to search through the list of radio stations available on radio-browser.info and open them in the system's browser or in ACBR's audio player.
- Handled trying to open a file by launching a second instance (or from the file explorer when the app is already running). The second instance is canceled, as before, but the already running one now asks for confirmation to open the provided file.
- Customized the ACBR Light theme so the Home Screen colors fit better with the rest of the design.
- Fixed left and right arrows not working on input fields inside modals.
- Fixed mouse drag being detected as click in the reader.
- Fixed some minor issues.

## v3.4.1

- Fixed not receiving key events in the input element of some of the modal windows, like the one that's invoked by "Page > Go To...", due to a bug introduced in the previous version.

## v3.4.0

- Updated some of the core libraries to newer versions.
- Added support for converting and extracting CBR files bigger than 2GB.
- Added support for converting, extracting and creating CBZ files bigger than 2GB.
- Added support for reading CBR and CBZ files bigger than 2GB. 
- Added the option to remap the reader's navigation keys in the preferences.
- Improved temporary folders creation and cleanup.
- Added F2 as a shortcut to show the current file's properties in the reader.
- Added options to change the quality parameter used when encoding each type of image file format to the advanced section of some tools and removed the generic image quality one.
- Added an option to enable mozjpeg when encoding JPGs to the advanced section of some tools.
- Changed how the comics conversion tool treats input files with multiple folders. It now preserves the original folder structure whenever possible, hopefully avoiding the chance of having output files with out of order or missing pages in some specific situations.
- Made running more than one instance of the app at the same time not possible. This is needed to prevent problems with the temp folder, settings and history management.
- Increased the minor version number to 4, given the amount of changes and fixes already accumulated during the latest betas, making this new release v3.4.0 instead of the initially planned v3.3.3.
- Fixed PDF files with a path containing the hashtag character (#) not working.
- Fixed not being able to drag and drop input files into the extract tool like in similar tools.
- Fixed malformed settings file not being handled properly.
- Fixed last fullscreen state not being correctly saved in the settings some times.
- Fixed the conversion tool's cancel button not working correctly under in some cases.

## v3.3.2

- Fixed gamepad buttons being detected as pressed at the start in some circumstances and causing undesired input events.
- Changed the gamepad mapping for "go to the first page" and "go to the last page" from "Y" and "A" to "BACK + Y" and "BACK + A" as they were too easy to press by accident.   

## v3.3.1

- Made all the contents of the tools' left panel stick to the top, not just the action buttons.
- Made the info bubbles stackable.
- Fixed the scrollbar moving with the arrow keys in the file browser and history tools.

## v3.3.0

- Added a quick menu that can be opened from the reader by pressing the gamepad's start button or F1 in the keyboard.
- Added a file browser that can be opened from the quick menu and works with mouse, keyboard and gamepad.
- Added a button to open the history tool from the quick menu and adapted the tool to also work with keyboard and gamepad.
- Added a brief bounce animation to the modals.
- The full screen state is now saved on exit and restored on launch.
- Fixed a gap showing at the top of the modals' background in full screen mode.
- Fixed a gap showing at the top of the tools' background in full screen mode.
- Fixed the focus indicator not showing some times in the modals and the browser and history tools when using the gamepad, and customized its style.
- Fixed the battery level value having a large number of decimals in some cases.

## v3.2.8

- Included the ability to drag and drop files into a tool so they are added to its input files list (if the tool has one).
- Drag and dropping multiple files into the program's icon now initializes the program with the "convert comics" tool open and those files added to the input files list (dropping only one file opens that file in the reader, as in previous versions).
- Added command line arguments to directly open the provided file/s with the reader or one of the tools, set some of that tool's options...
- Improved the keyboard and gamepad page scrolling smoothness.
- Fixed the "show battery" menu entry not being disabled outside the reader.

## v3.2.7

- Added a battery level indicator.
- Simplified the reader's gamepad controls layout (may expand it in the future).
- Fixed the delay between changing the page's image and resetting its position.

## v3.2.6

- Added Steam Deck and Gaming Mode detection so a better configuration is now set by default when running in that mode on the Deck. Adding the "--no-sandbox" command-line flag to the launch options is still needed in Gaming Mode.
- Fixed the development mode being incorrectly detected under some circumstances.
- Fixed the image flickering while zooming in/out.
- Fixed the image being duplicated some times when zooming quickly.
- Fixed the reader's scrollbar moving to the top after coming back from a tool.

## v3.2.5

- Hotfix:
  - Fixed a crash at initialization when no configuration file was found.

## v3.2.4

- Removed the ellipses from the menu entries that no longer open a dialog or separate window for additional information, and from some that were using them incorrectly.
- Added context menus to all the tools.

## v3.2.3

- Hotfix:
  - Fixed error when clicking 'Toggle Full Screen' in the context menu.
  - Fixed 'Zoom > Increase', 'Zoom > Decrease' and 'Zoom > Reset' in the menu bar doing nothing.

## v3.2.2

- Updated the documentation.
- Fixed some debug messages being logged as errors.
- All the language localization files are now up to date.

## v3.2.1

- Hotfix:
  - Fixed error window showing after quitting in some cases.

## v3.2.0

- Added an option in the preferences to enable using a third-party command-line application (rar from WinRAR) to create and modify cbr files.
- Added the ability to search for and import comic book metadata from Comic Vine to the ComicInfo.xml editor. A Comic Vine API key is required for it to work.
- Added an option in the comic book conversion and creation tools to split the output into multiple files.
- Added an option in the comic book conversion and creation tools to password protect the output files. Only available for some of the output formats (cbz, cb7, pdf and cbr).
- Made the creation tool accept not only image files as input but also comic book files.
- Added an option in the preferences to save the temp folder path as relative.
- Added an option in the preferences to choose which PDF library is used for reading, the oldest (quicker but less robust) or the newest (slower but more robust).
- Fixed an error in the PDF creation code when using an advanced option other than the default one.

## v3.1.0

- Added a ComicInfo.xml viewer/editor that can be opened from the properties window if the file format allows it. ComicInfo.xml files inside cbr, cbz and cb7 comic books can be viewed and ComicInfo.xml files inside unencrypted cbz and cb7 comic books can be created and edited.
- Added the option to change the temp folder in the preferences.
- Fixed modals not stopping the input events' propagation.

## v3.0.1

- Hotfix:
  - Fixed icon not showing in taskbar.

## v3.0.0

- Redesigned the user interface and refactored the internal structure and code.
- Fixed cb7 files containing more than images not opening or failing at some point.
- Added a File>Properties entry to the menu that opens a modal window showing some data about the current file.
- Other small fixes, tweaks and improvements.

## v2.4.7

- Hotfix:
  - Fixed pages being always turned when a scroll boundary was reached, regardless of the preferences, when using the keys or gamepad.

## v2.4.6

- Added basic gamepad support to the reader. Changing pages, scrolling and zooming can now be done using one.
- Added a new menu section View>Filter to apply optional color filters to the pages, and included one to make the paper look older, for digital versions of classic comics that look too bright/colorful.
- Added code to cleanup the cache, and as many other unneeded files generated by electron as possible, from the program's userData folder on exit.
- Updated and improved the German translation (contributed by Timo Heidutzek (trzyglow)).

## v2.4.5

- Added support for ComicInfo.xml files in the comic books converter. If the original contains a ComicBook.xml file and the output format allows it, the file is now preserved and even updated if the pages were changed in format or scale (previously this xml file was ignored and not included in the output comic file).
- Switched to a custom epub generator, instead of the third-party library used so far, to be able to focus only on those features needed to create comic book files and add some new options.
- Added a new section to the Advanced options of the comic book conversion tool to allow creating epubs with the images embedded as base64 in the html and limiting the image formats to only those allowed by the specification.
- Added an option to the preferences, disabled by default, to automatically turn the page when a scroll boundary is reached (i.e. if you keep scrolling after reaching the top/bottom of the page the previous/next page will be loaded).

## v2.4.4

- Fixed the conversion to epub format no longer working correctly due to a bug introduced in version 2.3.0.
- Added some improvements to the German translation (contributed by Timo Heidutzek (trzyglow)).

## v2.4.3

- Added German to the available languages (translation contributed by Timo Heidutzek (trzyglow)).

## v2.4.2

- Fixed tools failing to convert or extract some pdf files.

## v2.4.1

- Updated the Russian localization (contributed by vanja-san)
- Added a docs folder with English, Spanish and Russian README files.

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
