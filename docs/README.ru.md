<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://twitter.com/binarynonsense"><img src="https://user-images.githubusercontent.com/8535921/189104963-ae74d98e-ddb3-4068-8958-7028ecae2966.png" title="my twitter"></a>
</p>

# ACBR - Comic Book Reader

Программа для чтения и конвертирования комиксов с расширениями файлов CBZ, CBR, CB7, EPUB и PDF.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <a href="./README.en.md">English</a> |
  <a href="./README.es.md">Español</a> |
  <span>Русский</span> | 
  <a href="./README.de.md">Deutsch</a>
</p>

## Содержание:

- [Особенности](#особенности)
- [Скачать](#скачать)
- [Вклад](#вклад)
- [Лицензия](#лицензия)

## Особенности:

- Совместим с Windows и Linux.
- Совместимые расширения файлов:

  - Комиксы:
    - CBZ, CBR, CB7, PDF и EPUB.
  - Изображения:
    - JPG, PNG, WebP и AVIF.
  - Электронные книги:
    - PDF и EPUB.

  Включая защищенные паролем файлы PDF, CBZ (шифрование AES не поддерживается), CB7 и CBR.

- Оконный (простой пользовательский интерфейс) и полноэкранный (без пользовательского интерфейса) режимы.
- "Подгонка по ширине", "подгонка по высоте" и настраиваемые виды страниц "масштабирование по высоте".
- Поворот страницы.
- Интерфейс доступен на:
  - Английском
  - Испанском
  - Русском
  - Немецком
- Автоматически восстанавливает последнюю открытую книгу и страницу предыдущего сеанса и запоминает позиции страниц последних книг.
- Переносной режим (путем создания файла с именем portable.txt в той же папке, что и исполняемый файл).
- Встроенный аудиоплеер:
  - поддерживаются расширения файлов MP3, Ogg, WAV, M3U и M3U8
  - можно экспортировать плейлист в файл M3U
- Инструменты:
  - Конвертация/Изменение размера:
    - комиксов (CBR, CBZ, CB7, PDF или EPUB в CBZ, CB7, PDF или EPUB).
    - изображений (JPG, PNG, AVIF или WebP).
  - Создание:
    - комиксов (CBZ, CB7, PDF или EPUB) из списка изображений.
    - изображение QR-кода из текста.
  - Извлечение:
    - страниц комиксов (в JPG, PNG, AVIF или WebP).
    - текста (OCR) со страницы комикса или изображения.
    - текста QR-кода со страницы комикса или с изображения.
    - цветовой палитры со страницы комикса или с изображения.
      - можно экспортировать в файл палитры GPL или ACO.
  - Другое:
    - поиск и открытые книг/комиксов из:
      - Digital Comics Museum.
      - Internet Archive Books.
      - Project Gutenberg.
      - xkcd Webcomics.
    - поиск и открытие аудиокниг из:
      - Librivox AudioBooks.
    - поиск словарных терминов из:
      - Викисловаря.

## Скачать:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a>

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Самораспаковка)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

## Участники вклада:

- Русская локализация от [vanja-san](https://github.com/vanja-san)
- Немецкая локализация от [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)

Информация о том, как внести свой вклад в проект, содержится в файле [CONTRIBUTING.md](../CONTRIBUTING.md).

## Лицензия:

Код ACBR выпущен в соответствии с [лицензией](../LICENSE) BSD 2-Clause. Чтобы проверить лицензии модулей узла и других библиотек, используемых в проекте, перейдите в папку [лицензий](../licenses/).
