<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://mastodon.social/@binarynonsense"><img src="https://github.com/binarynonsense/comic-book-reader/assets/8535921/053fff88-5e38-4928-8b50-9ecaf1be20f1" title="my mastodon"></a>
</p>

# ACBR - Comic Book Reader

Isang comic book reader at converter para sa mga CBZ, CBR, CB7, EPUB at PDF na mga file.

![git_banner](https://github.com/user-attachments/assets/6ef7ded2-749a-4efd-a6b7-109d0f33d603)

<p align="center">
  <span>English</span> |
  <a href="./README.es.md">Español</a> | 
  <a href="./README.ru.md">Русский</a> | 
  <a href="./README.de.md">Deutsch</a> | 
  <a href="./README.ar.md">العربية</a> | 
  <a href="./README.fil.md">Filipino</a>
</p>

## Nilalaman:

- [Mga Tampok](#features)
- [Mga Pag-download](#downloads)
- [Mga Kontribusyon](#contributions)
- [Lisensya](#license)
- [Iba Pa](#other)

## Mga Tampok:

- Mga bersyon ng Windows at Linux
- Mga suportadong format ng file<sup>[1]</sup>:
  - Comic books:
    - CBZ, CBR, CB7, PDF<sup>[5]</sup> at EPUB<sup>[2]</sup>
  - Mga imahe:
    - JPG, PNG, WebP at AVIF
  - Mga Ebooks:
    - PDF<sup>[5]</sup> at EPUB<sup>[3]</sup>
- Mode ng windowed (simpleng UI) at mode ng buong screen (walang UI)
- 'Fit to width', 'fit to height' at isang nako-customize na 'scale to height' na mga page view
- Pag-ikot ng pahina
- UI ay available sa:
  - English, Spanish, Russian, German, Arabic at Filipino
- Awtomatikong nire-restore ang huling binuksang libro at pahina ng nakaraang session, at inaalala ang huling posisyon ng mga pahina ng libro.
- Portable mode (sa pamamagitan ng paggawa ng file na tinatawag na portable.txt sa parehong folder ng executable)
- Metadata editor:
  - Tingnan ang metadata sa PDF at EPUB na mga file o naka-imbak sa ComicInfo.xml na mga file sa loob ng CBR, CBZ at CB7 na comic books.
  - Lumikha at/o baguhin ang metadata sa PDF at EPUB na mga file o naka-imbak sa ComicInfo.xml na mga file sa loob ng mga unencrypted na CBR<sup>[4]</sup>, CBZ at CB7 na comic books.
  - Maghanap at mag-import ng comic book metadata mula sa Comic Vine (isang [Comic Vine API key](https://comicvine.gamespot.com/api/) ay kinakailangan).
- Integrated na audio player:
  - Sumusuporta sa MP3, Ogg, WAV, M3U at M3U8 na mga file.
  - Maaaring mag-export ng mga playlist sa M3U na mga file.
- Mga Tools:
  - Files:
    - Convert/Resize:
      - Comic books (CBR, CBZ, CB7, PDF<sup>[5]</sup> o EPUB<sup>[2]</sup> sa CBR<sup>[4]</sup>, CBZ, CB7, PDF o EPUB)
      - Mga imahe (JPG, PNG, AVIF o WebP)
    - Lumikha:
      - Isang comic book (CBR<sup>[4]</sup>, CBZ, CB7, PDF o EPUB) mula sa isang listahan ng mga image files at/o comic books
      - Isang QR code na imahe mula sa teksto
    - I-extract:
      - Mga comic book pages (sa JPG, PNG, AVIF o WebP)
      - Teksto (OCR) mula sa isang comic book page o image file
      - Teksto mula sa isang QR code sa isang comic book page o image file
      - Isang color palette mula sa isang comic book page o image file
        - Maaaring i-export sa isang GPL o ACO na palette file.
  - Search:
    - Maghanap at magbukas ng mga libro/comics mula sa:
      - Digital Comics Museum
      - Internet Archive Books
      - Project Gutenberg
      - xkcd Webcomics
      - Comic Book Plus
    - Maghanap at magbukas ng mga audiobooks mula sa:
      - Librivox AudioBooks
    - Maghanap ng mga termino sa diksyunaryo mula sa:
      - Wiktionary Dictionary
    - Maghanap at magbukas ng mga radio station streams mula sa:
      - radio-browser
  - Art:
    - Comic book page at thumbnails template maker
    - Color palette extractor
  - Iba Pa:
    - RSS reader

> Mga Tala:
>
> [1]: Kasama ang password-protected na PDF, CBZ (hindi sinusuportahan ang AES encryption), CB7 at CBR na mga file.
>
> [2]: Imahe lamang.
>
> [3]: Ang pagbabasa ng EPUB Ebooks ay isang eksperimentong / karagdagang tampok na labas sa pangunahing layunin ng proyekto. Maaaring hindi gumana para sa lahat ng mga file at maaaring alisin sa mga susunod na bersyon kung kinakailangan.
>
> [4]: Ang paggawa at pagbabago ng mga CBR na file ay naka-disable sa default. Maaari itong paganahin sa mga preferences ngunit nangangailangan ng isang third-party na command-line tool ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) mula sa WinRAR) na naka-install sa system.
>
> [5]: Hindi sinusuportahan ang PDF na mga file na mas malaki sa 2GB.

## Mga Pag-download:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a>

Bersyon na Matatag:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Self-Extracting)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

Lahat ng bersyon (matatag at beta):

- [Listahan ng mga Release](https://github.com/binarynonsense/comic-book-reader/releases)

## Mga Kontribusyon:

- Russian localization ni [vanja-san](https://github.com/vanja-san)
- German localization ni [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)
- Arabic localization ni [Ahmed (ahmed-0011)](https://github.com/ahmed-0011)
- Filipino localization ni [AndrewL (CodeByMoriarty)](https://github.com/CodeByMoriarty)

May impormasyon tungkol sa kung paano mag-contribute sa proyekto sa [CONTRIBUTING.md](../CONTRIBUTING.md) file.

## Lisensya:

Ang code ng ACBR ay inilabas sa ilalim ng BSD 2-Clause [lisensya](../LICENSE). Para tingnan ang mga lisensya ng mga node modules at iba pang mga library na ginamit sa proyekto, pumunta sa [licenses](../licenses/) na folder.

## Iba Pa:

Mga screenshot, karagdagang detalye tungkol sa mga kontrol at iba pang ekstrang impormasyon ay matatagpuan sa [wiki ng proyekto](https://github.com/binarynonsense/comic-book-reader/wiki).
