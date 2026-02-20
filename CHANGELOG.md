# v3.17.1

- Fixed creating a comic book from only images not working in the previous version.
- Fixed setting a non-writable folder as temp folder breaking the app.

# v3.17.0

- Added support for reading, converting from and extracting EPUB, FB2 and MOBI ebooks (newer formats like KF8 (AZW3) are not compatible).
- Increased the performance reading and converting PDF and RAR files. Also, files of those types bigger than 2GB are now supported.
- Fixed a bug introduced in the previous version that made the app not launch for new users.

# v3.16.0

- Added an alternative PDF library, based on PDFium, that can be used instead of the default one, based on PDFjs, both in the Reader and the conversion tools. It can be set as the one to be used for the Reader in the program's preferences (File Formats section), and in the advanced settings of each tool for them. Hopefully, this may be of help as an alternative if a PDF file happens to have stability or compatibility issues with the default library. One current limitation is that some big files that the default one is able to load will fail to do with this new one.
- Added a new section in the Preferences, Comic Book Reader, and moved some of the settings there.
- Added a new setting in the Preferences, in the PDF subsection of the File Formats section, to select the dpi at which the pages of a PDF file are rendered in the Reader.
- Added a new subsection in the Preferences, Advanced > External Files, to allow loading external files to add more localizations. I've also made a [repository](https://github.com/binarynonsense/acbr-unofficial-extensions) to share some unofficial ones I made using machine translation. One of my requirements to include a localization as part of ACBR is that it must be human made, for quality reasons, but I thought this would be useful for users that want to generate their own using that type of tools or test a human made one they are working on.
- Added a System Monitor 'widget' that shows the system total CPU and Memory use. To show or hide it use the menu entry View > System Monitor. To get more accurate stats in the Flatpak version some extra permissions are required (see the [wiki](https://github.com/binarynonsense/comic-book-reader/wiki) for more info).
- Added an advanced option in the conversion tools to extract PDF pages based on a target height instead of dpi.
- Improved the memory management and simplicity in the code that uses the PDFjs library.
- Implemented the image processing (scale, change image format...) speed improvements from the previous version in the "Extract Comic Books" tool.
- Added a new advanced option in the preferences to enable saving the debug events log to file (useful for bug reports).
- Made the program resilient against malformed environment variables containing null bytes.
- Fixed dpi calculations when rendering PDF pages with the default library. Resulting files are often bigger now for the same dpi setting, but that's because the previous calculations resulted in real dpis lower than the requested one.

# v3.15.0

- Increased, significantly, the speed of conversions that require image processing (scale, change image format...) in the "Convert Comic Books" tool by piping all the image processing operations for a page together, instead of doing them in stages as before, and also using worker threads to work on multiple pages at once. There are now advanced options to fine tune some parameters of this new method, which is now the default, in the tool's settings section (or to select the old method, which has the new operation piping but doesn't use worker threads, just in case it works better in some cases).
- Added the total time the conversion took to the end of the log in the "Convert Comic Books" tool.
- Added advanced image operations to crop and add borders in the "Convert Comic Books" tool.
- Added an advanced input option, "Input Folders Contain", in the "Convert Comic Books" tool to select how to treat the contents of folders in the input list: either look for comic book files inside them (as up to now) or for images (that will be treated as the contents of a single comic book). With this second option, it's now possible to batch convert folders containing images into comic book files.
- Added an advanced output option, "Keep Subfolders Structure", in the "Convert Comic Books" tool to choose to keep the subfolder structure from folders in the input list when the advanced input option "Search Input Folders Recursively" is enabled and an output folder for all files has been selected in the output options. This will replicate the folder and subfolder structure from the folders in the input list in the selected output folder and place the converted files in the corresponding place.
- Increased the default history capacity to 50 and made the "History" tool show the current number of entries vs the current capacity in the "Recent" section title.
- Added small tags to the file icons in the "Home Screen" for known extensions and other small quality of life improvements.
- Added a new section in the history file to remember files in the "Home Screen" lists but not in recent.
- Fixed toast notification's close button's color in light color mode.
- Fixed "Home Screen" breaking for rtl languages.
- Fixed book in user list in "Home Screen" not opening if it wasn't in the recent history.
- Fixed the final log being truncated in some of the tools if errors occurred.

# v3.14.1

- Fixed default page mode setting in preferences not being correctly saved when the "Double Page (Center First Page)" option was chosen.

# v3.14.0

- Added the option to create more lists in the Home Screen besides the Favorites and Latest ones.
- Added a representation of a book's completion percentage in the Home Screen lists. It shows as a thin line at the bottom of a book's card which gets longer the closer the last page read was compared to the total number of pages (if the page was the last one, the line will have a 100% length). It'll only appear for books in the history that have also been opened after this feature was added, as it needs some data not stored in the history by previous versions.
- Added expand and collapse buttons to the lists in the Home Screen.
- Added a button to open the integrated file browser in the Home Screen.
- Added a "Home Screen" section to the preferences.
- Improved PDF page rendering time and image quality.
- Changed some buttons in the reader's toolbar (zoom, pages direction and page mode) so that they now show the icon corresponding to the current state for the corresponding setting and clicking them opens a vertical submenu where the user can choose from all the available options.
- Fixed not showing any space between the text and the icon in the list titles in the Home Screen for rtl languages.

# v3.13.0

- Added some small quality of life improvements to the Home Screen, like drag and drop to sort the favorites list, new options to open the containing folder of a file in one the lists or add one in the recent files list to the favorites one...
- Added two new theme preferences: one that automatically sets the theme to "ACBR Light" or "ACBR Dark" based on the operative system settings and the other based on the time of day (the time at which the light and dark themes are set can be customized).
- Added 'Open Containing Folder' entry to the reader's context menu.
- Fixed CBZ files containing __MACOSX folders failing to load in the reader and convert in the tools as they included invalid image files. __MACOSX folders are now ignored.
- Fixed invalid page images breaking the reader. When the image corresponding to a page can't be loaded it's now replaced by a generic "file not found" page.

# v3.12.5

- Fixed RSS reader getting stuck when trying to load a no longer valid favorite feed URL.
- Fixed audio player showing above some of the modal windows.
- Fixed some of the modal windows hiding the toolbar while they were open.

# v3.12.4

- Fixed convert comic books, extract comic books, convert images and create comic book tools progressively slowing down while processing a large batch of files, which was due to the log text's increasingly bigger length impacting the time it took to update it.
- Fixed PDF metadata editor getting stuck trying to load data from files with undefined creation and/or modification dates.

# v3.12.3

- Added a button to open the output folder in the convert comic books, extract comic books, convert images and create comic book tools.
- Fixed PDF metadata editor showing 'undefined' as the value for some entries if they were empty.
- Fixed audio player always leaving space for the toolbar when placed at the bottom even in the tools and home screen.

# v3.12.2

- Fixed failing to open files from the search results of the gutenberg tool in the flatpak version due to lack of write permissions. The cache to store downloaded files is now created in the same folder as the config files.
- Fixed not being able to use the space bar and the arrow keys to edit the names of the home screen favorites.
- Fixed log showing a generic error message when there's not enough free disk space in the temp folder to extract files during conversions (can happen with the default temp folder and moderately big files in the flatpak version, for example).
- Configured the single-file bundle flatpak version to have similar settings as the flatpak now available on flathub.

# v3.12.1

- Added a .flatpak package for Linux that, as an alternative to the recently added .deb, should run in distributions, like Ubuntu 24.04, where the regular and AppImage versions have trouble to by default for not having an AppArmor profile. It's also the only one that currently fully works with the Steam Deck, even on game mode.
- Added keyboard and gamepad shortcuts to change page mode.
- Updated some of the core libraries and localization files.

# v3.12.0

- Added the option to show two pages at once in the reader. You can now switch between "Single Page", "Double Page" and "Double Page (Center First Page)" in the "View > Layout > Page Mode" entry of the menu bar, or change it using the tool bar.
- Added more scaling options to some of the tools (convert comic books, create comic book, convert images and extract comic books). Now the pages can be scaled by percentage, height or width.
- Added an automatic check for updates. Periodically, the program will look during its start process for a newer stable version of ACBR on GitHub and show a small notification if there's one (if you click it, it will open the corresponding release page in the system's browser). It can be configured, or completely disabled, on the preferences (by default it will check for updates if more than a week has passed since the last time it did).
- Added a "copy log" button to the results modal of some of the tools (create comic, convert comics, convert images and extract comics) and a list of failed files, if any, at the end of the log.
- Added a "Reset All" button to the preferences.
- Added a list of configuration files, and their paths, to the advanced section of the preferences.
- Updated some of the core libraries.
- Fixed some minor issues.

## v3.11.1

- Fixed arrows and space bar not working in some input boxes.

## v3.11.0

- Redesigned the layout and added a new section to the RSS Reader tool to search for feeds. You can now search for website feeds (based on the feedsearch.dev API) and podcast feeds (based on the iTunes Search API). For the podcasts one, once you select a feed from the results it opens in the content view, like any other feed, and then you can listen to any episode listed in the feed using ACBR's audio player by clicking on the play button.
- Added a new section to the Internet Radio tool to save favorite stations and support for m3u8 streams in the Audio Player.
- Added a 'Scroll to Top' button to the RSS reader.
- Added a 'Copy Image URL' entry to the context menu that appears when right clicking an image in the RSS reader.
- Added a 'Save Image As...' entry to the context menu that appears when right clicking an image in the RSS reader.
- Added a "Clear List" button to the create comic book, extract comic book, convert comic books and convert images tools.
- Made all menu shortcuts customizable.
- Tweaked the themes' colors.
- Updated some of the core libraries.
- Fixed some minor issues.

## v3.10.2

- Fixed the internet radio tool's search not working due to the queried server no longer being available.
- Fixed showing the wrong keyboard shortcuts in the menu bar for the zoom related entries.

## v3.10.1

- Added a .deb package for Linux that should work with distributions, like Ubuntu 24.04, that require setting an AppArmor profile for Electron apps to run, as the regular and AppImage versions don't currently work on them due to that restriction.
- Updated the Arabic localization.

## v3.10.0

- Added a new tool: "RSS Reader". A basic RSS and Atom feed reader that includes some default feeds relating to comic books.
- Made the tools' sliders always show their current value.
- Removed an unused image quality slider from the 'Extract Pages' tool.
- Made some small tweaks and visual changes to the user interface.
- Updated some of the core libraries to newer versions.
- Fixed the updates checker wrongly reporting the program's version as up to date in some situations (v3.8.0 to v3.9.0 had this bug and will not report v3.10.0 as newer). 

## v3.9.0

- Added a settings section to the 'Convert Comics', 'Create Comic', 'Convert Images' and 'Extract Pages' tools where the user can reset the tool's options to their default values or configure it so it remembers the ones selected the last time it was used (this is disabled by default).
- Fixed choosing the option to split output files into multiple parts no longer working correctly.

## v3.8.1

- Fixed search results not showing in metadata editors.

## v3.8.0

- Added a new tool: Template Maker. A direct port of my comic book page and thumbnails maker app.
- Added a new option in the preferences to set the clock format (12h or 24h).
- Added a "Close File" entry to the right-click context menu.
- Added a new entry in the menu (Help > Check for Updates) to check if there's a newer stable version available on github and give the option to open its download page in the browser if there's one.
- Added Filipino localization (contributed by AndrewL (CodeByMoriarty)).
- Disabled forced colors when using a high contrast OS theme.
- Modified the color themes.
- Fixed dragging and dropping files no longer working and producing errors and crashes due to a breaking change in Electron's API.

## v3.7.1

- Added the missing Russian localization entries so all languages are now up-to-date.
- Updated some of the core libraries to newer versions.

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
