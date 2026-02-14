<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://mastodon.social/@binarynonsense"><img src="https://github.com/binarynonsense/comic-book-reader/assets/8535921/053fff88-5e38-4928-8b50-9ecaf1be20f1" title="my mastodon"></a>
</p>

# ACBR - Comic Book Reader

Программа для чтения и конвертирования комиксов с расширениями файлов CBZ, CBR, CB7, EPUB и PDF.

![git_banner](https://github.com/user-attachments/assets/6ef7ded2-749a-4efd-a6b7-109d0f33d603)

<p align="center">
  <a href="./README.en.md">English</a> |
  <a href="./README.es.md">Español</a> |
  <span>Русский</span> | 
  <a href="./README.de.md">Deutsch</a> | 
  <a href="./README.ar.md">العربية</a> | 
  <a href="./README.fil.md">Filipino</a>
</p>

## Содержание:

- [Особенности](#особенности)
- [Скачать](#скачать)
- [Вклад](#участники-вклада)
- [Другое](#другое)

## Особенности:

- Совместим с Windows и Linux.
- Совместимые расширения файлов<sup>[1]</sup>:
  - Комиксы:
    - CBZ, CBR, CB7, PDF и EPUB<sup>[2]</sup>.
  - Изображения:
    - JPG, PNG, WebP и AVIF.
  - Электронные книги:
    - PDF и EPUB<sup>[3]</sup>.
- Оконный (простой интерфейс) и полноэкранный (без интерфейса) режимы.
- "Подгонка по ширине", "подгонка по высоте" и настраиваемые виды страниц "масштабирование по высоте".
- Поворот страницы.
- Интерфейс доступен на:
  - Английском, Испанском, Русском, Немецком и Арабском.
- Автоматически восстанавливает последнюю открытую книгу и страницу предыдущего сеанса и запоминает позиции страниц последних книг.
- Переносной режим (создайте файл с именем portable.txt в той же папке, что и исполняемый файл).
- Редактор метаданных:
  - просматривайте метаданные в файлах PDF и EPUB или хранящиеся в файлах ComicInfo.xml внутри комиксов CBR, CBZ и CB7.
  - создавайте и/или изменяйте метаданные в файлах PDF и EPUB или хранящиеся в файлах ComicInfo.xml в незашифрованных комиксах CBR<sup>[4]</sup>, CBZ и CB7.
  - ищите и импортируйте метаданные комиксов из Comic Vine (требуется [ключ Comic Vine API](https://comicvine.gamespot.com/api/)).
- Встроенный аудиоплеер:
  - поддерживаются расширения файлов MP3, Ogg, WAV, M3U и M3U8
  - можно экспортировать плейлист в файл M3U
- Инструменты:
  - Файлы:
    - Конвертировать/изменять:
      - Комиксы (CBR, CBZ, CB7, PDF<sup>[5]</sup> или EPUB<sup>[2]</sup> в CBR<sup>[4]</sup>, CBZ, CB7, PDF или EPUB)
      - Изображения (JPG, PNG, AVIF или WebP)
    - Создавать:
      - Комикс (CBR<sup>[4]</sup>, CBZ, CB7, PDF или EPUB) из списка файлов изображений и/или комиксов
      - Изображение QR-кода из текста
    - Извлекать:
      - Страницы комикса (в JPG, PNG, AVIF или WebP)
      - Текст (OCR) со страницы комиксов или файла изображения
      - Текст QR-кода со страницы комиксов или файла изображения
      - Цветовую палитру со страницы комиксов или файла изображения
        - Может быть экспортирован в файл палитры GPL или ACO.
  - Поиск:
    - Поиск и открытые книг/комиксов из:
      - Digital Comics Museum
      - Internet Archive Books
      - Project Gutenberg
      - xkcd Webcomics
      - Comic Book Plus
    - Поиск и открытие аудиокниг из:
      - Librivox AudioBooks
    - Поиск словарных терминов из:
      - Викисловаря
    - Поиск и открытие потоков радиостанций из:
      - radio-browser
  - Арт:
    - Создание страницы комикса и шаблон миниатюр
    - Извлечение цветовой палитры
  - Другое:
    - RSS-ридер

> Примечания:
>
> [1]: Включая защищенные паролем файлы PDF, CBZ (шифрование AES не поддерживается), CB7 и CBR.
>
> [2]: Только изображения.
>
> [3]: Чтение электронных книг в формате EPUB — это экспериментальная/дополнительная функция, выходящая за рамки основной задачи проекта. Это может работать не для всех файлов и при необходимости может быть удалено в будущих версиях.
>
> [4]: По умолчанию создание и изменение файлов CBR отключено. Их можно включить в настройках, но для этого необходимо установить в систему сторонний инструмент командной строки ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) из WinRAR).

## Скачать:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a>

Стабильная версия:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Самораспаковка)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)
- [Linux (deb)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_deb.zip)
- [Linux (flatpak)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_flatpak.zip)

Все версии (стабильные и бета):

- [Список релизов](https://github.com/binarynonsense/comic-book-reader/releases)

## Участники вклада:

- Русская локализация от [vanja-san](https://github.com/vanja-san)
- Немецкая локализация от [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)
- Арабская локализация от [Ahmed (ahmed-0011)](https://github.com/ahmed-0011)

Информация о том, как внести свой вклад в проект, содержится в файле [CONTRIBUTING.md](../CONTRIBUTING.md).

## Другое:

Скриншоты, подробности об элементах управления и другую дополнительную информацию можно найти на [вики проекта](https://github.com/binarynonsense/comic-book-reader/wiki).
