# ACBR - Comic Book Reader

Ein Comicbuch Leser und Konverter für CBZ, CBR, CB7, EPUB, FB2, MOBI und PDF Dateien.

<img alt="git_banner" src="https://github.com/user-attachments/assets/60a04322-d9cd-45f3-bf46-d0658ecfe784" />

## Inhalt:

- [Funktionen](#funktionen)
- [Downloads](#downloads)
- [Beiträge](#beiträge)
- [Anderes](#anderes)

## Funktionen:

- Windows & Linux Versionen
- Kompatible Dateiformate<sup>[1]</sup>:
  - Comicbücher: CBZ, CBR, CB7, PDF und EPUB
  - Bilddateien: JPG, PNG, WebP und AVIF
  - E-Books: PDF, FB2, MOBI<sup>[4]</sup> und EPUB
- Fenster- (einfache Benutzeroberfläche) und Vollbild- (keine Benutzeroberfläche) Modi.
- 'Einzelseite', 'Doppelseite' und 'Doppelseite (erste Seite zentrieren)' Seitenmodi
- 'Breitenanpassung', 'Höhenanpassung' und eine anpassbare 'Höhenskalierung' Seitenansicht
- Seitenrotation
- Benutzeroberfläche verfügbar auf: Englisch, Spanisch, Russisch, Deutsch, Arabisch, Filipino und Japanisch.
- Automatische Wiederherstellung der vergangenen Sitzung, mit Erinnerung der letzten Seitenposition.
- Tragbarer Modus (durch das Erstellen einer Datei namens _portable.txt_ im selben Ordner wie die Anwendung)
- Metadateneditor:
  - Ansicht der Metadaten welche in PDF und EPUB Dateien oder ComicInfo.xml Dateien innerhalb CBR, CBZ und CB7 Comicbüchern gespeichert sind.
  - Erstelle und/oder modifiziere die Metadaten welche in PDF und EPUB Dateien oder ComicInfo.xml Dateien innerhalb unverschlüsselten CBR<sup>[3]</sup>, CBZ und CB7 Comicbüchern gespeichert sind.
  - Suche nach und importiere Comicbuch Metadaten von Comic Vine (hierfür wird ein [Comic Vine API key](https://comicvine.gamespot.com/api/) benötigt).
- Integrierter Mediaplayer:
  - Audio: MP3, Ogg, WAV, M3U und M3U8 Dateien
  - Video: Web-kompatible Codecs und Formate wie MP4 und WebM, Youtube URLs und SRT Untertiteldateien
  - Kann Playlists als M3U Dateien exportieren.
  - Mehr Formate, Codecs und Funktionen werden unterstützt falls FFmpeg [verfügbar](https://github.com/binarynonsense/comic-book-reader/wiki/Third%E2%80%90Party-Executables-(rar,-ffmpeg...)) ist.
- Werkzeuge:
  - Konvertieren/Größe ändern:
    - Comicbücher und E-Books (CBR, CBZ, CB7, FB2, MOBI<sup>[4]</sup>, PDF oder EPUB) zu Comicbücher (CBR<sup>[3]</sup>, CBZ, CB7, PDF oder EPUB<sup>[2]</sup>).
    - Bilder (JPG, PNG, AVIF oder WebP).
  - Erstelle:
    - Ein Comicbuch (CBR<sup>[3]</sup>, CBZ, CB7, PDF oder EPUB<sup>[2]</sup>) aus einer Liste von Bilddateien, E-Books und/oder Comicbüchern.
    - Einen QR Code Bild aus Text.
  - Extrahiere:
    - Comicbuch Seiten (zu JPG, PNG, AVIF oder WebP).
    - Text (OCR) aus einer Comicbuch Seite oder Bilddatei.
    - QR Code Text aus einer Comicbuch Seite oder Bilddatei.
    - Eine Farbpalette aus einer Comicbuch Seite oder Bilddatei (kann zu einer GPL oder ACO Palettendatei extrahiert werden).
  - Suche und öffne:
    - Bücher/Comics von Digital Comics Museum, Internet Archive Books, Project Gutenberg, xkcd Webcomics und Comic Book Plus.
    - Hörbücher von Librivox AudioBooks.
    - Wörterbucheinträge in Wiktionary Dictionary.
    - Radiosenderstreams von radio-browser.
    - RSS Feeds von Podcasts und Websites.
  - Kunst:
    - Comicbuch Seitenvorlagen- und Vorschaubildersteller
    - Farbpalettenextrahierer
  - Weiteres:
    - RSS Reader
    - Internet Radio

> Hinweise:
>
> [1]: Dazu gehören Passwort geschützte PDF, CBZ, CB7 und CBR Dateien.
>
> [2]: Nur Bilder.
>
> [3]: Das Erstellen und Modifizieren von CBR Dateien ist standardmäßig deaktiviert. Diese Funktionen können über die Einstellungen aktiviert werden, benötigen aber ein Drittanbieter Kommandozeilen-werkzeug ([rar](https://github.com/binarynonsense/comic-book-reader/wiki/Third%E2%80%90Party-Executables-(rar,-ffmpeg...))), welches im System installiert sein muss.
>
> [4]: Nur "legacy" MOBI (MOBI 7) Dateien werden unterstützt. Neuere Formate wie KF8 (AZW3) sind nicht kompatibel.

## Downloads:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://img.shields.io/github/downloads/binarynonsense/comic-book-reader/total" title="total downloads"></a>

Stabile Version:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (selbstextrahierend)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)
- [Linux (deb)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_deb.zip)
- [Linux (flatpak)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_flatpak.zip)

> Anmerkung: Für Linux-Distributionen welche das Aufsetzen von einem AppArmor Profil zum Ausführen von Electron Apps benötigen, z.B. Ubuntu 24.04, sollte man nicht die reguläre oder die AppImage Version wählen, da sie aufgrund dieser Beschränkung wahrscheinlich nicht standardmäßig funktionieren.

Alle Versionen (Stabil und Beta):

- [Veröffentlichungsliste](https://github.com/binarynonsense/comic-book-reader/releases)

Auch verfügbar auf:

- [Flathub](https://flathub.org/apps/com.binarynonsense.acbr)

## Beiträge:

Design and Programmierung:

- [Álvaro García (binarynonsense)](https://github.com/binarynonsense)

Lokalisierungen:

- [Álvaro García (binarynonsense)](https://github.com/binarynonsense) (English, Español)
- [vanja-san](https://github.com/vanja-san) (Русский)
- [Timo Heidutzek (trzyglow)](https://github.com/trzyglow) (Deutsch)
- [Ahmed (ahmed-0011)](https://github.com/ahmed-0011) (العربية)
- [AndrewL (CodeByMoriarty)](https://github.com/CodeByMoriarty) (Filipino)
- [coolvitto](https://github.com/coolvitto) (日本語)

Informationen darüber, wie man zu dem Projekt beitragen kann, gibt es im [CONTRIBUTING.md](../CONTRIBUTING.md) Dokument.

## Anderes:

Screenshots und weitere Details können im [Wiki des Projekts](https://github.com/binarynonsense/comic-book-reader/wiki) gefunden werden.
