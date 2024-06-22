/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fileFormats = require("./file-formats");
const temp = require("./temp");
const log = require("./logger");

exports.getMetadata = async function (filePath, currentMetadata, password) {
  let fileMetadata = currentMetadata ? currentMetadata : {};
  try {
    //////////////////
    const tempFolderPath = temp.createSubFolder();
    const opfEntries = await fileFormats.getEpubOpfEntriesList(
      filePath,
      password
    );
    if (!opfEntries || opfEntries.length <= 0) {
      throw "no metadata file found";
    }
    let entryPath;
    for (let index = 0; index < opfEntries.length; index++) {
      const opf = opfEntries[index];
      if (opf.startsWith("OEBPS") || opf.startsWith("OPS")) {
        entryPath = opf;
        break;
      }
    }
    if (!entryPath) {
      throw "no metadata file found";
    }
    const buffer = await fileFormats.extract7ZipEntryBuffer(
      filePath,
      entryPath,
      password,
      tempFolderPath,
      "zip"
    );
    temp.deleteSubFolder(tempFolderPath);
    const xmlFileData = buffer?.toString();
    //////////////////////////
    if (xmlFileData === undefined) {
      throw "no metadata file found";
    }
    const { XMLParser, XMLValidator } = require("fast-xml-parser");
    const isValidXml = XMLValidator.validate(xmlFileData);
    if (isValidXml !== true) {
      throw "invalid xml";
    }
    // open
    const parserOptions = {
      ignoreAttributes: false,
      allowBooleanAttributes: true,
    };
    const parser = new XMLParser(parserOptions);
    let json = parser.parse(xmlFileData);
    if (!json["package"] || !json["package"]["metadata"]) {
      throw "invalid metadata";
    }
    // log.test(json["package"]["metadata"]);

    function addMetadataEntry(jsonKey, metadataKey) {
      let contents = json["package"]["metadata"][jsonKey];
      if (contents) {
        if (Array.isArray(contents) && contents.length > 0) {
          fileMetadata[metadataKey] = "";
          contents.forEach(function (item, index, array) {
            if (typeof contents[0] === "string") {
              fileMetadata[metadataKey] += item;
              if (index != array.length - 1) {
                fileMetadata[metadataKey] += ", ";
              }
            } else {
              if (item["#text"]) {
                fileMetadata[metadataKey] += item["#text"];
                if (index != array.length - 1) {
                  fileMetadata[metadataKey] += ", ";
                }
              }
            }
          });
        } else if (typeof contents === "string") {
          fileMetadata[metadataKey] = contents;
        } else {
          fileMetadata[metadataKey] = contents["#text"];
        }
      }
    }

    addMetadataEntry("dc:title", "title");
    addMetadataEntry("dc:creator", "author");
    addMetadataEntry("dc:subject", "subject");
    addMetadataEntry("dc:description", "description");
    addMetadataEntry("dc:language", "language");
    addMetadataEntry("dc:publisher", "publisher");
    addMetadataEntry("dc:date", "publicationDate");

    fileMetadata["format"] = "EPUB";
    const formatVersion = json["package"]["@_version"];
    if (formatVersion) fileMetadata["format"] += " v" + formatVersion;

    // pdf example from render-pdf's loadPdf
    // {
    //     encrypted: password && password.trim() !== "",
    //     creator: metadata.info.Creator,
    //     producer: metadata.info.Producer,
    //     created: metadata.info.CreationDate,
    //     modified: metadata.info.ModDate,
    //     format: "PDF " + metadata.info.PDFFormatVersion,
    //     author: metadata.info.Author,
    //     subject: metadata.info.Subject,
    //     keywords: metadata.info.Keywords,
    //     title: metadata.info.Title,
    //   }
    //////////////////////////
    return fileMetadata;
  } catch (error) {
    log.error(error);
    return currentMetadata;
  }
};

// json metadata examples:

// waroftheworlds gutenberg
// {
//     'dc:rights': 'Public domain in the USA.',
//     'dc:identifier': { '#text': 'http://www.gutenberg.org/36', '@_id': 'id' },
//     'dc:creator': { '#text': 'H. G. Wells', '@_id': 'author_0' },
//     meta: [
//       {
//         '#text': 'Wells, H. G. (Herbert George)',
//         '@_property': 'file-as',
//         '@_refines': '#author_0'
//       },
//       {
//         '#text': 'aut',
//         '@_property': 'role',
//         '@_refines': '#author_0',
//         '@_scheme': 'marc:relators'
//       },
//       {
//         '#text': '2024-06-01T07:58:20Z',
//         '@_property': 'dcterms:modified'
//       },
//       { '@_name': 'cover', '@_content': 'id-5537589769737049517' }
//     ],
//     'dc:title': 'The War of the Worlds',
//     'dc:language': 'en',
//     'dc:subject': [
//       'Science fiction',
//       'War stories',
//       'Martians -- Fiction',
//       'Mars (Planet) -- Fiction',
//       'Space warfare -- Fiction',
//       'Imaginary wars and battles -- Fiction',
//       'Life on other planets -- Fiction'
//     ],
//     'dc:date': '2004-10-01',
//     'dc:source': 'https://www.gutenberg.org/files/36/36-h/36-h.htm'
//   }

// comicinfotextfile acbr
// {
//     'dc:title': { '#text': 'cbr_test_comicinfoxml', '@_id': 't1' },
//     'dc:identifier': {
//       '#text': 'f3db6b05-4904-422c-8c59-b31322e076f0',
//       '@_id': 'book-id'
//     },
//     meta: [
//       {
//         '#text': 'uuid',
//         '@_refines': '#book-id',
//         '@_property': 'identifier-type',
//         '@_scheme': 'xsd:string'
//       },
//       {
//         '#text': '2024-06-22T15:07:19Z',
//         '@_property': 'dcterms:modified'
//       },
//       { '@_name': 'cover', '@_content': 'image_cover' },
//       { '@_name': 'generator', '@_content': 'acbr' }
//     ],
//     'dc:language': 'en'
//   }

// spawn humble

// {
//     'dc:identifier': {
//       '#text': 'urn:isbn:SPAWN0149',
//       '@_id': 'bookid',
//       '@_opf:scheme': 'ISBN'
//     },
//     'dc:title': 'Spawn #149',
//     'dc:creator': [
//       {
//         '#text': 'Brian Holguin, Todd McFarlane',
//         '@_opf:role': 'aut',
//         '@_opf:file-as': 'McFarlane,  Brian Holguin, Todd'
//       },
//       {
//         '#text': 'Angel Medina, Allen Martinez, Danny Miki, Victor Olazaba, Brian Haberlin',
//         '@_opf:role': 'art',
//         '@_opf:file-as': 'Haberlin,  Angel Medina, Allen Martinez, Danny Miki, Victor Olazaba, Brian'
//       },
//       { '@_opf:role': 'ill', '@_opf:file-as': ',' },
//       { '@_opf:role': 'ill', '@_opf:file-as': ',' },
//       { '@_opf:role': 'cov', '@_opf:file-as': ',' },
//       { '@_opf:role': 'edt', '@_opf:file-as': ',' }
//     ],
//     'dc:description': `"Spawn sifts through the rubble of his life -- broken shards of memory and lost pieces of the past -- in a desperate attempt to find a terrible secret that the fallen angel Mammon has hidden inside of him. As the Hellspawn's searching leads him into unexpected quarters and face-to-face with enemies old and new, he can't shake the feeling that no matter what he does, no matter which path he chooses, he is doing precisely what Mammon wants."`,
//     'dc:publisher': 'Image Comics',
//     'dc:date': '2005-09-01',
//     'dc:language': 'en-US',
//     'dc:rights': 'Copyright #x00A9; Image Comics',
//     meta: { '@_name': 'cover', '@_content': 'cover' },
//     '@_xmlns:opf': 'http://www.idpf.org/2007/opf',
//     '@_xmlns:dc': 'http://purl.org/dc/elements/1.1/'
//   }
