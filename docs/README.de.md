<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://mastodon.social/@binarynonsense"><img src="https://github.com/binarynonsense/comic-book-reader/assets/8535921/053fff88-5e38-4928-8b50-9ecaf1be20f1" title="my mastodon"></a>
</p>

# ACBR - Comic Book Reader

Ein Comicbuch Leser und Konverter für CBZ, CBR, CB7, EPUB und PDF Dateien.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <a href="./README.en.md">English</a> | 
  <a href="./README.es.md">Español</a> | 
  <a href="./README.ru.md">Русский</a> | 
  <span>Deutsch</span> | 
  <a href="./README.ar.md">العربية</a>
</p>

## Inhalt:

- [Funktionen](#funktionen)
- [Downloads](#downloads)
- [Beiträge](#beiträge)
- [Lizenz](#lizenz)
- [Anderes](#anderes)

## Funktionen:

- Windows & Linux Versionen
- Kompatible Dateiformate<sup>[1]</sup>:
  - Comicbücher:
    - CBZ, CBR, CB7, PDF und EPUB<sup>[2]</sup>
  - Bilddateien:
    - JPG, PNG, WebP und AVIF
  - Ebooks:
    - PDF und EPUB<sup>[3]</sup>
- Fenster- (einfache Benutzeroberfläche) und Vollbild- (keine Benutzeroberfläche) Modi.
- 'Breitenanpassung', 'Höhenanpassung' und eine anpassbare 'Höhenskalierung' Seitenansicht
- Seitenrotation
- Benutzeroberfläche verfügbar auf:
  - Englisch, Spanisch, Russisch, Deutsch und Arabisch
- Automatische Wiederherstellung der vergangenen Sitzung, mit Erinnerung der letzten Seitenposition.
- Tragbarer Modus (durch das Erstellen einer Datei namens portable.txt im selben Ordner wie die Anwendung)
- Metadateneditor:
  - Ansicht der Metadaten welche in PDF und EPUB Dateien oder ComicInfo.xml Dateien innerhalb CBR, CBZ und CB7 Comicbüchern gespeichert sind.
  - Erstelle und/oder modifiziere die Metadaten welche in PDF und EPUB Dateien oder ComicInfo.xml Dateien innerhalb unverschlüsselten CBR<sup>[4]</sup>, CBZ und CB7 Comicbüchern gespeichert sind.
  - Suche nach und importiere Comicbuch Metadaten von Comic Vine (hierfür wird ein [Comic Vine API key](https://comicvine.gamespot.com/api/) benötigt).
- Integrierter Audio-player:
  - Unterstützt MP3, Ogg, WAV, M3U und M3U8 Dateien.
  - Kann Playlists als M3U Dateien exportieren.
- Werkzeuge:
  - Konvertieren/größe Ändern:
    - Comicbücher (CBR, CBZ, CB7, PDF oder EPUB<sup>[2]</sup> zu CBR<sup>[4]</sup>, CBZ, CB7, PDF oder EPUB)
    - Bilder (JPG, PNG, AVIF oder WebP)
  - Erstelle:
    - Ein Comicbuch (CBR<sup>[4]</sup>, CBZ, CB7, PDF oder EPUB) aus einer Liste von Bild Dateien und/oder Comicbüchern
    - Ein QR Code Bild aus Text
  - Extrahiere:
    - Comicbuch Seiten (zu JPG, PNG, AVIF oder WebP)
    - Text (OCR) aus einer Comicbuch Seite oder Bilddatei
    - QR Code Text aus einer Comicbuch Seite oder Bilddatei
    - Eine Farbpalette aus einer Comicbuch Seite oder Bilddatei
      - Kann zu einer GPL oder ACO Paletten-datei extrahiert werden.
  - Weiteres:
    - Suche und öffne Bücher/Comics von:
      - Digital Comics Museum
      - Internet Archive Books
      - Project Gutenberg
      - xkcd Webcomics
      - Comic Book Plus
    - Suche und öffne Hörbücher von:
      - Librivox AudioBooks
    - Suche Wörterbucheinträge in:
      - Wiktionary Dictionary
    - Suche und öffne Radiosender-streams von:
      - radio-browser

> Hinweise:
>
> [1]: Dazu gehören Passwort geschützte PDF, CBZ (AES Verschlüsselung nicht unterstützt), CB7 und CBR Dateien.
>
> [2]: Nur Bilder.
>
> [3]: EPUB E-Books lesen ist ein experimentelles / extra Feature außerhalb des Hauptumfangs des Projektes. Es könnte nicht für alle Dateien funktionieren, und im Bedarfsfall in zukünftigen Versionen entfernt werden.
>
> [4]: Das Erstellen und Modifizieren von CBR Dateien ist standardmäßig deaktiviert. Diese Funktionen können über die Einstellungen aktiviert werden, benötigen aber ein Drittanbieter Kommandozeilen-werkzeug ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) von WinRAR), welches im System installiert sein muss.

## Downloads:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a>

Stabile Version:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (selbstextrahierend)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

Alle Versionen (Stabil und Beta):

- [Veröffentlichungsliste](https://github.com/binarynonsense/comic-book-reader/releases)

## Beiträge:

- Russische Lokalisierung von [vanja-san](https://github.com/vanja-san)
- Deutsche Lokalisierung von [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)
- Arabische Lokalisierung von [Ahmed (ahmed-0011)](https://github.com/ahmed-0011)

Informationen darüber, wie man zu dem Projekt beitragen kann, gibt es im [CONTRIBUTING.md](../CONTRIBUTING.md) Dokument.

## Lizenz:

ACBRs Code ist unter der BSD 2-Clause [Lizenz](../LICENSE) veröffentlicht. Um die Lizenzen der Knoten-Module, sowie weiteren Libraries, welche in diesem Projekt verwendet wurden, zu überprüfen begeben Sie sich zum [Lizenzen](../licenses/) Ordner.

## Anderes:

Screenshots, weitere Details über die Steuerung und andere zusätzliche Informationen können im [Wiki des Projekts](https://github.com/binarynonsense/comic-book-reader/wiki) gefunden werden.
