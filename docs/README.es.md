<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://mastodon.social/@binarynonsense"><img src="https://github.com/binarynonsense/comic-book-reader/assets/8535921/053fff88-5e38-4928-8b50-9ecaf1be20f1" title="my mastodon"></a>
</p>

# ACBR - Comic Book Reader

Un lector y conversor de cómics para archivos en formato CBZ, CBR, CB7, EPUB y PDF.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <a href="./README.en.md">English</a> |
  <span>Español</span> | 
  <a href="./README.ru.md">Русский</a> | 
  <a href="./README.de.md">Deutsch</a> | 
  <a href="./README.ar.md">العربية</a> | 
  <a href="./README.fil.md">Filipino</a>
</p>

## Contenidos:

- [Características](#características)
- [Descargas](#descargas)
- [Contribuciones](#contribuciones)
- [Licencia](#licencia)
- [Otros](#otros)

## Características:

- Versiones para Windows y Linux
- Formatos de archivo compatibles<sup>[1]</sup>:
  - Cómics:
    - CBZ, CBR, CB7, PDF<sup>[5]</sup> y EPUB<sup>[2]</sup>
  - Archivos de imagen:
    - JPG, PNG, WebP y AVIF
  - Ebooks:
    - PDF<sup>[5]</sup> y EPUB<sup>[3]</sup>
- Modos de ventana (IU simple) y pantalla completa (sin IU)
- Vistas de pagina: 'ajustar a anchura', 'ajustar a altura' y 'escalar a altura' personalizable
- Rotación de página
- Interfaz de usuario disponible en:
  - Inglés, español, ruso, alemán, árabe y filipino<sup>(beta)</sup>.
- Restaura automáticamente el último cómic, y página, abierto en la sesión anterior, y recuerda las posiciones de página de los últimos cómics.
- Modo portátil (al crear un archivo llamado portable.txt en la misma carpeta que el ejecutable)
- Editor de metadatos:
  - Ver los metadatos en archivos PDF y EPUB o almacenados en archivos ComicInfo.xml dentro de cómics CBR, CBZ y CB7.
  - Crear y/o modificar los metadatos en archivos PDF y EPUB o almacenados en archivos ComicInfo.xml dentro de cómics CBR<sup>[4]</sup>, CBZ y CB7 no encriptados.
  - Buscar e importar metadatos de cómics de Comic Vine (es necesaria una [clave API de Comic Vine](https://comicvine.gamespot.com/api/)).
- Reproductor de audio integrado:
  - Admite archivos MP3, Ogg, WAV, M3U y M3U8.
  - Puede exportar listas de reproducción a archivos M3U.
- Herramientas:
  - Convertir/Redimensionar:
    - Cómics (CBR, CBZ, CB7, PDF<sup>[5]</sup> o EPUB<sup>[2]</sup> a CBR<sup>[4]</sup>, CBZ, CB7, PDF o EPUB)
    - Imágenes (JPG, PNG, AVIF o WebP)
  - Crear:
    - Un cómic (CBR<sup>[4]</sup>, CBZ, CB7, PDF o EPUB) a partir de una lista de archivos de imagen y/o cómics
    - Una imagen de código QR a partir de un texto
    - Plantillas de páginas y miniaturas de cómic<sup>(beta)</sup>
  - Extraer:
    - Páginas de cómics (a JPG, PNG, AVIF o WebP)
    - Texto (OCR) de una página de cómic o archivo de imagen
    - El texto de un código QR en una página de cómic o un archivo de imagen
    - Una paleta de colores de una página de cómic o un archivo de imagen
      - Se puede exportar a un archivo de paleta GPL o ACO.
  - Otras:
    - Buscar y abrir libros/cómics de:
      - Digital Comics Museum
      - Internet Archive Books
      - Project Gutenberg
      - Webcómics xkcd
      - Comic Book Plus
    - Buscar y abrir audiolibros de:
      - Librivox
    - Búsqueda de términos de diccionario de:
      - Diccionario Wiktionary
    - Buscar y abrir streams de radio de:
      - radio-browser

> Notas:
>
> [1]: Incluyendo archivos PDF, CBZ (cifrado AES no compatible), CB7 y CBR protegidos con contraseña.
>
> [2]: Solo imágenes.
>
> [3]: La lectura de Ebooks EPUB es una función experimental/extra más allá de los objectivos principales del proyecto. Es posible que no funcione para todos los archivos y podría eliminarse en versiones futuras si surge la necesidad.
>
> [4]: La creación y modificación de archivos CBR están desactivadas por defecto. Se pueden activar en las preferencias pero requieren que una herramienta de línea de comandos de terceros ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) de WinRAR) se encuentre instalada en el sistema.
>
> [5]: No se admiten archivos PDF de más de 2 GB.

## Descargas:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a>

Versión estable:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Self-Extracting)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

Todas las versiones (estables y betas):

- [Lista de lanzamientos](https://github.com/binarynonsense/comic-book-reader/releases)

## Contribuciones:

- Traducción al ruso por [vanja-san](https://github.com/vanja-san).
- Traducción al alemán por [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)
- Traducción al árabe por [Ahmed (ahmed-0011)](https://github.com/ahmed-0011)
- Traducción al filipino por [AndrewL (CodeByMoriarty)](https://github.com/CodeByMoriarty)

Hay información sobre cómo contribuir al proyecto en el fichero [CONTRIBUTING.md](../CONTRIBUTING.md).

## Licencia:

El código de ACBR se publica bajo la [licencia](../LICENSE) BSD 2-Clause. Para comprobar las licencias de los módulos de node y otras librerías utilizadas en el proyecto, vaya a la carpeta [licencias](../licenses/).

## Otros:

Capturas de pantalla, más información sobre los controles y otra información extra se pueden encontrar en [la Wiki del proyecto](https://github.com/binarynonsense/comic-book-reader/wiki).
