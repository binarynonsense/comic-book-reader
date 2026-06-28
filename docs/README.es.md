# ACBR - Comic Book Reader

Un lector y conversor de cómics para archivos en formato CBZ, CBR, CB7, EPUB, FB2, MOBI 7 y PDF.

<img alt="git_banner" src="https://github.com/user-attachments/assets/da605b30-7bb3-40a5-8f36-f3f2e0541faf" />

## Contenidos:

- [Características](#características)
- [Descargas](#descargas)
- [Contribuciones](#contribuciones)
- [Otros](#otros)

## Características:

- Versiones para Windows y Linux
- Modos de ventana y pantalla completa
- Interfaz de usuario disponible en Inglés, español, ruso, alemán, árabe, filipino y japonés.
- Compatibilidad parcial con mando 
- Modo portátil (al crear un archivo llamado _portable.txt_ en la misma carpeta que el ejecutable)
- Lector:
  - Formatos de archivo compatibles<sup>[[1]](#note_1)</sup>:
    - Cómics: CBZ, CBR, CB7, PDF y EPUB
    - Archivos de imagen: JPG, PNG, WebP y AVIF
    - Ebooks: PDF, FB2, MOBI 7<sup>[[4]](#note_4)</sup> y EPUB
  - Modos de página: 'página simple', 'página doble' y 'página doble (centrar primera página')
  - Vistas de pagina: 'ajustar a anchura', 'ajustar a altura', 'ajustar a ambos' y 'escalar a altura' personalizable
  - Rotación de página  
  - Restaura automáticamente el último cómic, y página, abierto en la sesión anterior, y recuerda las posiciones de página de los últimos cómics.
- Pantalla de inicio:
  - Mostrar, organizar y abrir rápidamente archivos y carpetas de cómics usando sus listas predeterminadas de favoritos y recientes, permitiendo la creación de listas adicionales personalizadas.
- Editor de metadatos:
  - Ver los metadatos en archivos PDF y EPUB o almacenados en archivos ComicInfo.xml dentro de cómics CBR, CBZ y CB7.
  - Crear y/o modificar los metadatos en archivos PDF y EPUB o almacenados en archivos ComicInfo.xml dentro de cómics CBR<sup>[[3]](#note_3)</sup>, CBZ y CB7 no encriptados.
  - Buscar e importar metadatos de cómics de Comic Vine (es necesaria una [clave API de Comic Vine](https://comicvine.gamespot.com/api/)).
- Reproductor de multimedia integrado:
  - Audio: archivos MP3, Ogg, WAV, M3U y M3U8
  - Vídeo: códecs y formatos compatibles con la web (MP4, WebM...) y archivos de subtítulos SRT
  - Puede exportar listas de reproducción a archivos M3U.
  - Admite más formatos, códecs y funciones si FFmpeg está [disponible](<https://github.com/binarynonsense/comic-book-reader/wiki/Third%E2%80%90Party-Executables-(rar,-ffmpeg...)>).
  - Se puede iniciar en [modo independiente](https://github.com/binarynonsense/comic-book-reader/wiki/Media-Player:-Launch-in-Stand-Alone-Mode).
- Herramientas<sup>[[5]](#note_5)</sup>:
  - Convertir/Redimensionar:
    - Cómics y libros (CBR, CBZ, CB7, FB2, MOBI 7<sup>[[4]](#note_4)</sup>, PDF o EPUB) a cómics (CBR<sup>[[3]](#note_3)</sup>, CBZ, CB7, PDF o EPUB<sup>[[2]](#note_2)</sup>).
    - Imágenes (JPG, PNG, AVIF o WebP).
  - Crear:
    - Un cómic (CBR<sup>[[3]](#note_3)</sup>, CBZ, CB7, PDF o EPUB<sup>[[2]](#note_2)</sup>) a partir de una lista de archivos de imagen, libros y/o cómics.
    - Una imagen de código QR a partir de un texto.
  - Extraer:
    - Páginas de cómics (a JPG, PNG, AVIF o WebP).
    - Texto (OCR) de una página de cómic o archivo de imagen.
    - El texto de un código QR en una página de cómic o un archivo de imagen.
    - Una paleta de colores de una página de cómic o un archivo de imagen (se puede exportar a un archivo de paleta GPL o ACO).
  - Buscar y/o abrir:
    - Libros/cómics de Digital Comics Museum, Internet Archive Books, Project Gutenberg, Webcómics xkcd y Comic Book Plus.
    - Audiolibros de Librivox.
    - Términos del diccionario Wiktionary.
    - Streams de radio de radio-browser.
    - Fuentes RSS de podcasts y websites.
  - Arte:
    - Creador de plantillas de páginas y miniaturas de cómic
    - Extractor de paletta de colores
  - Otras:
    - Lector de RSS
    - Radio por internet

> Notas:
>
> <a name="note_1"></a>[1]: Incluyendo archivos PDF, CBZ, CB7 y CBR protegidos con contraseña.
>
> <a name="note_2"></a>[2]: Solo imágenes.
>
> <a name="note_3"></a>[3]: La creación y modificación de archivos CBR están desactivadas por defecto. Se pueden activar en las preferencias pero requieren que una herramienta de línea de comandos de terceros ([rar](https://github.com/binarynonsense/comic-book-reader/wiki/Third%E2%80%90Party-Executables-(rar,-ffmpeg...)) se encuentre instalada en el sistema.
>
> <a name="note_4"></a>[4]: Solo se admiten archivos legacy MOBI (MOBI 7). Los formatos más recientes, como KF8 (AZW3), no son compatibles.
>
> <a name="note_5"></a>[5]: Algunas de las herramientas también pueden ejecutarse directamente [a través de la línea de comandos](https://github.com/binarynonsense/comic-book-reader/wiki/Command%E2%80%90Line-Tools:-Launch-Options) en lugar de la interfaz gráfica de usuario.

## Descargas:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://raw.githubusercontent.com/binarynonsense/acbr-builder/refs/heads/main/badges/stable.svg" title="latest stable version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://raw.githubusercontent.com/binarynonsense/acbr-builder/refs/heads/main/badges/latest.svg" title="latest version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://raw.githubusercontent.com/binarynonsense/acbr-builder/refs/heads/main/badges/downloads.svg" title="total downloads"></a>

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
- [itch.io](https://binarynonsense.itch.io/comic-book-reader)

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
