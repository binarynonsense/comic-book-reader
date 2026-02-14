# ACBR - Comic Book Reader

Un lector y conversor de cómics para archivos en formato CBZ, CBR, CB7, EPUB y PDF.

![git_banner](https://github.com/user-attachments/assets/6ef7ded2-749a-4efd-a6b7-109d0f33d603)

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
- Modos de página: 'página simple', 'página doble' y 'página doble (centrar primera página'
- Vistas de pagina: 'ajustar a anchura', 'ajustar a altura' y 'escalar a altura' personalizable
- Rotación de página
- Interfaz de usuario disponible en:
  - Inglés, español, ruso, alemán, árabe y filipino
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
  - Ficheros:
    - Convertir/Redimensionar:
      - Cómics (CBR, CBZ, CB7, PDF<sup>[5]</sup> o EPUB<sup>[2]</sup> a CBR<sup>[4]</sup>, CBZ, CB7, PDF o EPUB)
      - Imágenes (JPG, PNG, AVIF o WebP)
    - Crear:
      - Un cómic (CBR<sup>[4]</sup>, CBZ, CB7, PDF o EPUB) a partir de una lista de archivos de imagen y/o cómics
      - Una imagen de código QR a partir de un texto
    - Extraer:
      - Páginas de cómics (a JPG, PNG, AVIF o WebP)
      - Texto (OCR) de una página de cómic o archivo de imagen
      - El texto de un código QR en una página de cómic o un archivo de imagen
      - Una paleta de colores de una página de cómic o un archivo de imagen
        - Se puede exportar a un archivo de paleta GPL o ACO.
  - Buscar:
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
    - Buscar y abrir fuentes RSS de podcasts y websites.
  - Arte:
    - Creador de plantillas de páginas y miniaturas de cómic
    - Extractor de paletta de colores
  - Otras:
    - Lector de RSS
    - Radio por internet

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
- [Linux (deb)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_deb.zip)
- [Linux (flatpak)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_flatpak.zip)

> Nota: Para distribuciones de Linux que requieren la configuración de un perfil de AppArmor para la ejecución de aplicaciones Electron, como Ubuntu 24.04, es mejor no elegir la versiones estándar o AppImage dado que probablemente no sean compatibles por defecto debido a esta restricción.

Todas las versiones (estables y betas):

- [Lista de lanzamientos](https://github.com/binarynonsense/comic-book-reader/releases)

También disponible en:

- [Flathub](https://flathub.org/apps/com.binarynonsense.acbr)

## Contribuciones:

Diseño y Programación:
- [Álvaro García (binarynonsense)](https://github.com/binarynonsense/)
  
Localizaciones:
- [Álvaro García (binarynonsense)](https://github.com/binarynonsense/) (English, Español)
- [vanja-san](https://github.com/vanja-san) (Русский)
- [Timo Heidutzek (trzyglow)](https://github.com/trzyglow) (Deutsch)
- [Ahmed (ahmed-0011)](https://github.com/ahmed-0011) (العربية)
- [AndrewL (CodeByMoriarty)](https://github.com/CodeByMoriarty) (Filipino)

Hay información sobre cómo contribuir al proyecto en el fichero [CONTRIBUTING.md](../CONTRIBUTING.md).

## Otros:

Se pueden encontrar capturas de pantalla y más información en [la Wiki del proyecto](https://github.com/binarynonsense/comic-book-reader/wiki).
