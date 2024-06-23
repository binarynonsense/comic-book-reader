/**
 * @license
 * Copyright 2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const fileFormats = require("./file-formats");
const temp = require("./temp");
const log = require("./logger");

exports.getMetadataProperties = async function (
  filePath,
  currentMetadata,
  password
) {
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
    //////////////////////////
    return fileMetadata;
  } catch (error) {
    log.error(error);
    return currentMetadata;
  }
};
