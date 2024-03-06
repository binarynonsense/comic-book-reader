<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://twitter.com/binarynonsense"><img src="https://user-images.githubusercontent.com/8535921/189104963-ae74d98e-ddb3-4068-8958-7028ecae2966.png" title="my twitter"></a>
</p>

# ACBR - Comic Book Reader

Un lector y conversor de cómics para archivos en formato CBZ, CBR, CB7, EPUB y PDF.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <a href="./README.en.md">English</a> |
  <span>Español</span> | 
  <a href="./README.ru.md">Русский</a> | 
  <a href="./README.de.md">Deutsch</a>
</p>

## Contenidos:

- [Características](#características)
- [Controles Básicos](#controles-básicos)
- [Descargas](#descargas)
- [Contribuciones](#contribuciones)
- [Proyectos Relacionados](#proyectos-relacionados)
- [Licencia](#licencia)
- [Otros](#otros)

## Características:

- Versiones para Windows y Linux.
- Formatos de archivo compatibles:

  - Cómics:
    - CBZ, CBR, CB7, PDF y EPUB.
  - Archivos de imagen:
    - JPG, PNG, WebP y AVIF.
  - Ebooks:
    - PDF y EPUB.

  Incluyendo archivos PDF, CBZ (cifrado AES no compatible), CB7 y CBR protegidos con contraseña.

- Modos de ventana (IU simple) y pantalla completa (sin IU).
- Vistas de pagina: 'ajustar a anchura', 'ajustar a altura' y 'escalar a altura' personalizable.
- Rotación de página.
- Interfaz de usuario disponible en:
  - Inglés, Español, Ruso y Alemán
- Restaura automáticamente el último cómic, y página, abierto en la sesión anterior, y recuerda las posiciones de página de los últimos cómics.
- Modo portátil (al crear un archivo llamado portable.txt en la misma carpeta que el ejecutable).
- Editor de ComicInfo.xml:
  - Ver los metadatos almacenados en archivos ComicInfo.xml dentro de cómics CBR, CBZ y CB7.
  - Crear y/o modificar los metadatos almacenados en archivos ComicInfo.xml dentro de cómics CBR\*, CBZ y CB7 no encriptados.
  - Buscar e importar metadatos de cómics de Comic Vine (es necesaria una [clave API de Comic Vine](https://comicvine.gamespot.com/api/)).
- Reproductor de audio integrado:
  - Admite archivos MP3, Ogg, WAV, M3U y M3U8.
  - Puede exportar listas de reproducción a archivos M3U.
- Herramientas:
  - Convertir/Redimensionar:
    - Cómics (CBR, CBZ, CB7, PDF o EPUB a CBR\*, CBZ, CB7, PDF o EPUB).
    - Imágenes (JPG, PNG, AVIF o WebP).
  - Crear:
    - Un cómic (CBR\*, CBZ, CB7, PDF o EPUB) a partir de una lista de archivos de imagen y/o cómics.
    - Una imagen de código QR a partir de un texto.
  - Extraer:
    - Páginas de cómics (a JPG, PNG, AVIF o WebP).
    - Texto (OCR) de una página de cómic o archivo de imagen.
    - El texto de un código QR en una página de cómic o un archivo de imagen.
    - Una paleta de colores de una página de cómic o un archivo de imagen.
      - Se puede exportar a un archivo de paleta GPL o ACO.
  - Otras:
    - Buscar y abrir libros/cómics de:
      - Digital Comics Museum.
      - Internet Archive Books.
      - Project Gutenberg.
      - Webcómics xkcd.
    - Buscar y abrir audiolibros de:
      - Librivox.
    - Búsqueda de términos de diccionario de:
      - Diccionario Wiktionary.

(\*) La creación y modificación de archivos CBR están desactivadas por defecto. Se pueden activar en las preferencias pero requieren que una herramienta de línea de comandos de terceros ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) de WinRAR) se encuentre instalada en el sistema.

## Controles Básicos:

- Barra de herramientas:
  - Botones: 'Abrir archivo', 'Página anterior', 'Página siguiente', 'Ajustar al ancho', 'Ajustar al alto', 'Girar en sentido antihorario', 'Girar en sentido horario' y 'Alternar pantalla completa'.
  - Control deslizante: utilícelo para ir rápidamente a cualquier página del libro.
- Teclas:
  - 'Flecha derecha' o 'Página abajo' para ir a la página siguiente.
  - 'Flecha izquierda' o 'Retroceder página' para ir a la anterior.
  - 'Flecha arriba' para desplazar la página hacia arriba, 'Flecha abajo' para desplazar la página hacia abajo.
  - 'WASD' para desplazar la página vertical y horizontalmente.
  - 'F11' para alternar el modo de pantalla completa.
  - 'Ctrl+O' para elegir un archivo para abrir.
  - 'Ctrl++' y 'Ctrl+-' para acercar o alejar la vista. 'Ctrl+0' para restablecerla.
- Ratón:
  - 'Rueda de desplazamiento' desplaza la página hacia arriba y hacia abajo.
  - 'Clic con el botón izquierdo' abre la página siguiente si se hace clic en el lado derecho del área de visualización y la página anterior si se hace clic en el lado izquierdo.
  - 'Clic derecho' abre un menú contextual con algunas opciones básicas de navegación.
  - 'Ctrl+rueda de desplazamiento' para acercar o alejar la vista.

## Descargas:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=estable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=última&include_prereleases" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=descargas" title="total downloads"></a>

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

Hay información sobre cómo contribuir al proyecto en el fichero [CONTRIBUTING.md](../CONTRIBUTING.md).

## Proyectos Relacionados:

- [ACBT - Comic Book Tools](https://github.com/binarynonsense/comic-book-tools)
  - Versión independiente para línea de comandos de alguna de las herramientas disponibles en ACBR.

## Licencia:

El código de ACBR se publica bajo la [licencia](../LICENSE) BSD 2-Clause. Para comprobar las licencias de los módulos de node y otras librerías utilizadas en el proyecto, vaya a la carpeta [licencias](../licenses/).

## Otros:

Capturas de pantalla, más información sobre los controles y otra información extra se pueden encontrar en [la Wiki del proyecto](https://github.com/binarynonsense/comic-book-reader/wiki).
