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
    log.test(json["package"]["metadata"]);

    function addMetadataEntry(json, jsonKey, metadataKey) {
      let values = json["package"]["metadata"]["dc:creator"];
      if (values) {
        if (Array.isArray(values)) {
          fileMetadata.author = "";
          values.forEach(function (creator, index, array) {
            if (creator["#text"]) {
              if (index != 0) {
                fileMetadata.author += " ,";
              }
              fileMetadata.author += creator["#text"];
            }
          });
        } else {
          fileMetadata.author = values;
        }
      }
    }

    if (json["package"]["metadata"]["dc:title"]) {
      fileMetadata.title = json["package"]["metadata"]["dc:title"];
    }
    if (json["package"]["metadata"]["dc:creator"]) {
      let creators = json["package"]["metadata"]["dc:creator"];
      if (Array.isArray(creators)) {
        fileMetadata.author = "";
        creators.forEach(function (creator, index, array) {
          if (creator["#text"]) {
            if (index != 0) {
              fileMetadata.author += " ,";
            }
            fileMetadata.author += creator["#text"];
          }
        });
      } else {
        fileMetadata.author = creators;
      }
    }
    if (json["package"]["metadata"]["dc:subject"]) {
      fileMetadata.subject =
        json["package"]["metadata"]["dc:subject"].join("; ");
    }
    if (json["package"]["metadata"]["dc:description"]) {
      fileMetadata.description = json["package"]["metadata"]["dc:description"];
    }
    // pdf example
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
