<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://twitter.com/binarynonsense"><img src="https://user-images.githubusercontent.com/8535921/189104963-ae74d98e-ddb3-4068-8958-7028ecae2966.png" title="my twitter"></a>
</p>

# ACBR - Comic Book Reader

Un lector y conversor de cómics para archivos en formato cbz, cbr, cb7, epub y pdf.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <a href="./README.en.md">English</a> |
  <span>Español</span> | 
  <a href="./README.ru.md">Русский</a> | 
  <a href="./README.de.md">Deutsch</a>
</p>

## Contenidos:

- [Características](#características)
- [Controles](#controles)
- [Descargas](#descargas)
- [Contribuciones](#contribuciones)
- [Proyectos Relacionados](#proyectos-relacionados)
- [Licencia](#licencia)

## Características:

- Versiones para Windows y GNU/Linux.
- Formatos de archivo compatibles:

  - Cómics:
    - .cbz
    - .cbr
    - .cb7
    - .pdf
    - .epub
  - Archivos de imagen:
    - .jpg
    - .png
    - .webp
    - .avif
  - Ebooks:
    - .pdf
    - .epub

  Incluyendo archivos pdf, cbz (cifrado AES no compatible), cb7 y cbr protegidos con contraseña.

- Modos de ventana (IU simple) y pantalla completa (sin IU).
- Vistas de pagina: 'ajustar a anchura', 'ajustar a altura' y 'escalar a altura' personalizable.
- Rotación de página.
- Interfaz de usuario disponible en:
  - Inglés
  - Español
  - Ruso
  - Alemán
- Restaura automáticamente el último cómic, y página, abierto en la sesión anterior, y recuerda las posiciones de página de los últimos cómics.
- Modo portátil (al crear un archivo llamado portable.txt en la misma carpeta que el ejecutable).
- Editor de ComicInfo.xml:
  - Ver los metadatos almacenados en archivos ComicInfo.xml dentro de cómics cbr, cbz y cb7.
  - Crear y/o modificar los metadatos almacenados en archivos ComicInfo.xml dentro de cómics cbz y cb7 no encriptados.
- Reproductor de audio integrado:
  - admite archivos .mp3, .ogg, .wav, .m3u y .m3u8.
  - puede exportar listas de reproducción a archivos .m3u.
- Herramientas:
  - Convertir/Redimensionar:
    - cómics (cbr, cbz, cb7, pdf o epub a cbz, cb7, pdf o epub).
    - imágenes (jpg, png, avif o webp).
  - Crear:
    - un cómic (cbz, cb7, pdf o epub) a partir de una lista de archivos de imagen.
    - una imagen de código QR a partir de un texto.
  - Extraer:
    - páginas de cómics (a jpg, png, avif o webp).
    - texto (OCR) de una página de cómic o archivo de imagen.
    - el texto de un código QR en una página de cómic o un archivo de imagen.
    - una paleta de colores de una página de cómic o un archivo de imagen.
      - se puede exportar a un archivo de paleta .gpl o .aco.
  - Otras:
    - buscar y abrir libros/cómics de:
      - Digital Comics Museum.
      - Internet Archive Books.
      - Project Gutenberg.
      - Webcómics xkcd.
    - buscar y abrir audiolibros de:
      - Librivox.
    - búsqueda de términos de diccionario de:
      - Diccionario Wiktionary.

## Controles:

- Barra de herramientas:
  - botones: 'abrir archivo', 'página anterior', 'página siguiente', 'ajustar al ancho', 'ajustar al alto', 'girar en sentido antihorario', 'girar en sentido horario' y 'alternar pantalla completa'.
  - control deslizante: utilícelo para ir rápidamente a cualquier página del libro.
- Teclas:
  - 'flecha derecha' o 'página abajo' para ir a la página siguiente.
  - 'flecha izquierda' o 'retroceder página' para ir a la anterior.
  - 'flecha arriba' para desplazar la página hacia arriba, 'flecha abajo' para desplazar la página hacia abajo.
  - 'wasd' para desplazar la página vertical y horizontalmente.
  - 'f11' para alternar el modo de pantalla completa.
  - 'ctrl+O' para elegir un archivo para abrir.
  - 'ctrl++' y 'ctrl+-' para acercar o alejar la vista. 'ctrl+0' para restablecerla.
- Ratón:
  - 'rueda de desplazamiento' desplaza la página hacia arriba y hacia abajo.
  - 'clic con el botón izquierdo' abre la página siguiente si se hace clic en el lado derecho del área de visualización y la página anterior si se hace clic en el lado izquierdo.
  - 'clic derecho' abre un menú contextual con algunas opciones básicas de navegación.
  - 'ctrl+rueda de desplazamiento' para acercar o alejar la vista.

## Descargas:

- [Windows](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [Windows (Auto Extraíble)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [Linux](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [Linux (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

## Contribuciones:

- Traducción al ruso por [vanja-san](https://github.com/vanja-san).
- Traducción al alemán por [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)

Hay información sobre cómo contribuir al proyecto en el fichero [CONTRIBUTING.md](../CONTRIBUTING.md).

## Proyectos Relacionados:

- [ACBT - Comic Book Tools](https://github.com/binarynonsense/comic-book-tools)
  - Versión independiente para línea de comandos de alguna de las herramientas disponibles en ACBR.

## Licencia:

El código de ACBR se publica bajo la [licencia](../LICENSE) BSD 2-Clause. Para comprobar las licencias de los módulos de node y otras librerías utilizadas en el proyecto, vaya a la carpeta [licencias](../licenses/).
