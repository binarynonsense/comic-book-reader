<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://twitter.com/binarynonsense"><img src="https://user-images.githubusercontent.com/8535921/189104963-ae74d98e-ddb3-4068-8958-7028ecae2966.png" title="my twitter"></a>
</p>

# ACBR - Comic Book Reader

Ein Comicbuch Leser und Konverter für CBZ, CBR, CB7, EPUB und PDF Dateien.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <a href="./README.en.md">English</a> | 
  <a href="./README.es.md">Español</a> | 
  <a href="./README.ru.md">Русский</a> | 
  <span>Deutsch</span>
</p>

## Inhalt:

- [Funktionen](#funktionen)
- [Steuerung](#steuerung)
- [Downloads](#downloads)
- [Beiträge](#beiträge)
- [Verwandte Projekte](#verwandte-projekte)
- [Lizenz](#lizenz)
- [Anderes](#anderes)

## Funktionen:

- Windows & GNU/Linux Versionen.
- Kompatible Datei-formate:

  - Comicbücher:
    - CBZ
    - CBR
    - CB7
    - PDF
    - EPUB
  - Bilddateien:
    - JPG
    - PNG
    - WebP
    - AVIF
  - Ebooks:
    - PDF
    - EPUB

  Dazu gehören Passwort geschützte PDF, CBZ (AES Verschlüsselung nicht unterstützt), CB7 und CBR Dateien.

- Fenster- (einfache Benutzeroberfläche) und Vollbild- (keine Benutzeroberfläche) Modi.
- 'Breitenanpassung', 'Höhenanpassung' und eine anpassbare 'Höhenskalierung' Seitenansicht.
- Seitenrotation.
- Benutzeroberfläche verfügbar auf:
  - Englisch
  - Spanisch
  - Russisch
  - Deutsch
- Automatische Wiederherstellung der vergangenen Sitzung, mit Erinnerung der letzten Seitenposition.
- Tragbarer Modus (durch das Erstellen einer Datei namens portable.txt im selben Ordner wie die Anwendung).
- ComicInfo.xml Editor:
  - Ansicht der Metadaten welche in ComicInfo.xml Dateien innerhalb CBR, CBZ und CB7 Comicbüchern gespeichert sind.
  - Erstelle und/oder modifiziere die Metadaten welche in ComicInfo.xml Dateien innerhalb unverschlüsselten CBR\*, CBZ und CB7 Comicbüchern gespeichert sind.
  - Suche nach und importiere Comicbuch Metadaten von Comic Vine (für die funktionalität wird ein [Comic Vine API key](https://comicvine.gamespot.com/api/) benötigt).
- Integrierter Audio-player:
  - unterstützt .mp3, .ogg, .wav, .m3u und .m3u8 Dateien.
  - Kann Playlists als .m3u Dateien exportieren.
- Werkzeuge:
  - Konvertieren/größe Ändern:
    - Comicbücher (CBR, CBZ, CB7, PDF oder EPUB zu CBR\*, CBZ, CB7, PDF oder EPUB).
    - Bilder (JPG, PNG, AVIF oder WebP).
  - Erstelle:
    - Ein Comicbuch (CBR\*, CBZ, CB7, PDF oder EPUB) aus einer Liste von Bild Dateien und/oder Comicbüchern.
    - Eine QR Code Bild aus Text.
  - Extrahiere:
    - Comicbuch Seiten (zu JPG, PNG, AVIF oder WebP).
    - Text (OCR) aus einer Comicbuch Seite oder Bilddatei.
    - QR Code Text aus einer Comicbuch Seite oder Bilddatei.
    - Eine Farb-palette aus einer Comicbuch Seite oder Bilddatei.
      - kann zu einer .gpl oder .aco Paletten-datei extrahiert werden.
  - Weiteres:
    - Suche und öffne Bücher/Comics von:
      - Digital Comics Museum.
      - Internet Archive Books.
      - Project Gutenberg.
      - xkcd Webcomics.
    - Suche und öffne Hörbücher von:
      - Librivox AudioBooks.
    - Suche Wörterbucheinträge in:
      - Wiktionary Dictionary.

(\*) Das Erstellen und Modifizieren von CBR Dateien ist standardmäßig deaktiviert. Diese Funktionen können über die Einstellungen aktiviert werden, benötigen aber ein Drittanbieter Kommandozeilen-Werkzeug ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) von WinRAR), welches im System installiert sein muss.

## Steuerung:

- Werkzeugleiste:
  - Knöpfe: 'Öffne Datei', 'Vorherige Seite', 'Nächste Seite', 'An Breite Anpassen', 'An Höhe Anpassen', 'Rotiere gegen Uhrzeigerrichtung', 'Rotiere in Uhrzeigerrichtung' und 'Vollbild Aktivieren'.
  - Schieberegler: zum schnellen Blättern.
- Tasten:
  - 'Pfeil Rechts' oder 'Bild Ab' um zur nächsten Seite zu gehen.
  - 'Pfeil Links' oder 'Bild Auf' um zur vorherigen Seite zu gehen.
  - 'Pfeil Hoch' um die Seite hoch zu scrollen, 'Pfeil Runter' um die Seite herunter zu scrollen.
  - 'WASD' um die Seite vertikal und horizontal zu scrollen.
  - 'F11' um in den Vollbildmodus zu wechseln.
  - 'Strg+O' um eine Datei zum Öffnen auszuwählen.
  - 'Strg++' und 'Strg+-' zum Zoomen. 'Strg+0' zum Zurückstellen des Zooms.
- Maus:
  - 'Mausrad' scrollt die Seite hoch und runter.
  - 'Linksklick' öffnet die nächste Seite wenn die rechte Seite der Oberfläche geklickt wurde, und die vorherige wenn die rechte geklickt wurde.
  - 'Rechtsklick' öffnet ein Kontextmenü mit ru­di­men­tären navigations Optionen.
  - 'Strg+Mausrad' zum Zoomen.

## Downloads:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (selbstextrahierend)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

## Beiträge:

- Russische Lokalisierung von [vanja-san](https://github.com/vanja-san)
- Deutsche Lokalisierung von [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)

Informationen darüber, wie man zu dem Projekt beitragen kann, gibt es im [CONTRIBUTING.md](../CONTRIBUTING.md) Dokument.

## Verwandte Projekte:

- [ACBT - Comic Book Tools](https://github.com/binarynonsense/comic-book-tools)
  - Eine Stand-Alone Kommandozeilen-version einiger Werkzeuge aus ACBR.

## Lizenz:

ACBRs Code ist unter der BSD 2-Clause [Lizenz](../LICENSE) veröffentlicht. Um die Lizenzen der Knoten-Module, sowie weiteren Libraries, welche in diesem Projekt verwendet wurden, zu überprüfen begeben Sie sich zum [Lizenzen](../licenses/) Ordner.

## Anderes:

Screenshots, weitere Details über die Steuerung und andere zusätzliche Informationen können im [Wiki des Projekts](https://github.com/binarynonsense/comic-book-reader/wiki) gefunden werden.
