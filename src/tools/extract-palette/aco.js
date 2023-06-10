const fs = require("fs");

// ref (1): https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577411_pgfId-1055819
// ref (2): http://www.nomodes.com/aco.html
// ref: https://github.com/lemieuxster/node-aco
// ref: https://www.w3schools.com/nodejs/met_buffer_alloc.asp
// ref: https://www.geeksforgeeks.org/node-js-fs-createwritestream-method/
// ref: https://www.geeksforgeeks.org/node-js-buffer-writeuint16be-method/
// ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charCodeAt

exports.createFile = function (filePath, palette, version = 1) {
  let stream;
  try {
    if (version < 1 || version > 2) version = 1;
    // version 2's code has issues (at least gimp doesn't like it), don't use it for now
    if (version === 2) version = 1;
    stream = fs.createWriteStream(filePath);
    //////////
    // version
    write2Bytes(stream, version);
    // num colors
    write2Bytes(stream, palette.rgbColors.length);
    // colors
    for (let index = 0; index < palette.rgbColors.length; index++) {
      const rgbColor = palette.rgbColors[index];
      const hexColor = palette.hexColors[index];
      // color space = 0 (rgb)
      write2Bytes(stream, 0);
      // from ref (1): each color is 10 bytes
      // r, g, b (0-65535)
      write2Bytes(stream, rgbColor.r * 257);
      write2Bytes(stream, rgbColor.g * 257);
      write2Bytes(stream, rgbColor.b * 257);
      // from ref (1): the extra values are undefined and should be written as zeros
      write2Bytes(stream, 0);
      if (version === 2) {
        // name (I use the hex color as name for the color)
        // from ref (2): 0 | len + 1 | len words (UTF-16 representation of the name) | 0
        write2Bytes(stream, 0);
        write2Bytes(stream, hexColor.length + 1);
        for (let charIndex = 0; charIndex < hexColor.length; charIndex++) {
          // charCodeAt returns an integer between 0 and 65535 representing the UTF-16 code
          write2Bytes(stream, hexColor.charCodeAt(charIndex));
        }
        write2Bytes(stream, 0);
      }
    }
    //////////
    stream.end();
    return true;
  } catch (error) {
    if (stream !== undefined) stream.end();
    return false;
  }
};

function write2Bytes(stream, value) {
  let buffer = new Buffer.alloc(2);
  buffer.writeUInt16BE(value);
  stream.write(buffer);
}
