/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { utilityProcess, MessageChannelMain } = require("electron");
const fs = require("fs");
const path = require("path");
const core = require("../../../core/main");
const base = require("../main");
const { _ } = require("../../../shared/main/i18n");
const reader = require("../../../reader/main");
const fileUtils = require("../../../shared/main/file-utils");
const utils = require("../../../shared/main/utils");
const fileFormats = require("../../../shared/main/file-formats");
const { FileDataType } = require("../../../shared/main/constants");
const { fork } = require("child_process");
const temp = require("../../../shared/main/temp");

const log = require("../../../shared/main/logger");

///////////////////////////////////////////////////////////////////////////////
// SETUP //////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

let g_fileData;
let g_worker;

exports.open = function (fileData, settings) {
  base.sendIpcToCoreRenderer(
    "insert-html-afterbegin",
    ".tools-menu-sections",
    fs
      .readFileSync(path.join(__dirname, "index-section-buttons.html"))
      .toString(),
  );
  base.sendIpcToCoreRenderer(
    "insert-html-afterend",
    "#tools-title",
    fs.readFileSync(path.join(__dirname, "index-sections.html")).toString(),
  );
  base.sendIpcToRenderer("set-subtool", "cix");
  updateLocalizedText();
  let languages = getISOLanguages();
  base.sendIpcToRenderer("show", fileData, languages, settings.canEditRars());
  g_fileData = fileData;
};

exports.close = function () {
  if (g_worker !== undefined) {
    // kill it after one use
    g_worker.kill();
    g_worker = undefined;
  }
};

///////////////////////////////////////////////////////////////////////////////
// TOOL ///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

exports.loadMetadata = async function () {
  let xmlFileData;
  if (g_fileData.metadata && g_fileData.metadata.comicInfoId) {
    let buf;
    switch (g_fileData.type) {
      case FileDataType.ZIP:
        {
          // buf = fileFormats.extractZipEntryBuffer(
          //   g_fileData.path,
          //   g_fileData.metadata.comicInfoId,
          //   g_fileData.password
          // );
          const tempFolderPath = temp.createSubFolder();
          const result = await fileFormats.extract7ZipEntryBuffer(
            g_fileData.path,
            g_fileData.metadata.comicInfoId,
            g_fileData.password,
            tempFolderPath,
            "zip",
          );
          temp.deleteSubFolder(tempFolderPath);
          if (result.success) {
            buf = result.data;
          }
        }
        break;
      case FileDataType.RAR:
        {
          const tempFolderPath = temp.createSubFolder();
          buf = await fileFormats.extractRarEntryBuffer(
            g_fileData.path,
            g_fileData.metadata.comicInfoId,
            g_fileData.password,
            tempFolderPath,
          );
          temp.deleteSubFolder(tempFolderPath);
        }
        break;
      case FileDataType.SEVENZIP:
        {
          const tempFolderPath = temp.createSubFolder();
          const result = await fileFormats.extract7ZipEntryBuffer(
            g_fileData.path,
            g_fileData.metadata.comicInfoId,
            g_fileData.password,
            tempFolderPath,
          );
          temp.deleteSubFolder(tempFolderPath);
          if (result.success) {
            buf = result.data;
          }
        }
        break;
    }
    if (buf) xmlFileData = buf.toString();
  }

  const { XMLParser, XMLValidator } = require("fast-xml-parser");
  try {
    if (xmlFileData === undefined) {
      throw "no comicinfo";
    }
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
    let data = parser.parse(xmlFileData);
    if (!data["ComicInfo"]) {
      throw "invalid comicinfo";
    }
    base.sendIpcToRenderer("load-metadata", data, undefined);
  } catch (error) {
    try {
      xmlFileData = `<?xml version="1.0"?>
  <ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">  
  </ComicInfo>`;
      // open
      const parserOptions = {
        ignoreAttributes: false,
        allowBooleanAttributes: true,
      };
      const parser = new XMLParser(parserOptions);
      let data = parser.parse(xmlFileData);
      base.sendIpcToRenderer(
        "load-metadata",
        data,
        error === "no comicinfo" ? undefined : error,
      );
    } catch (error) {
      // TODO: can't recuperate from this!!
      // close???
    }
  }
};

exports.updatePages = function (data) {
  let tempFolderPath = temp.createSubFolder();
  if (g_worker !== undefined) {
    // kill it after one use
    g_worker.kill();
    g_worker = undefined;
  }
  if (g_worker === undefined) {
    if (core.useUtilityProcess()) {
      g_worker = utilityProcess.fork(
        path.join(__dirname, "../../../shared/main/tools-worker.js"),
      );
    } else {
      g_worker = fork(
        path.join(__dirname, "../../../shared/main/tools-worker.js"),
      );
    }
    g_worker.on("message", (message) => {
      g_worker.kill(); // kill it after one use
      if (message.success) {
        updatePagesDataFromImages(data, tempFolderPath);
        return;
      } else {
        base.sendIpcToRenderer("pages-updated", undefined);
        temp.deleteSubFolder(tempFolderPath);
        return;
      }
    });
  }
  if (core.useUtilityProcess()) {
    const { port1 } = new MessageChannelMain();
    g_worker.send(
      [
        core.getLaunchInfo(),
        "extract",
        g_fileData.path,
        g_fileData.type,
        tempFolderPath,
        g_fileData.password,
      ],
      [port1],
    );
  } else {
    g_worker.send([
      core.getLaunchInfo(),
      "extract",
      g_fileData.path,
      g_fileData.type,
      tempFolderPath,
      g_fileData.password,
    ]);
  }
};

async function updatePagesDataFromImages(data, tempFolderPath) {
  try {
    const sharp = require("sharp");
    let imgFilePaths = fileUtils.getImageFilesInFolderRecursive(tempFolderPath);
    imgFilePaths.sort(utils.compare);

    if (!data["ComicInfo"]["Pages"]) {
      data["ComicInfo"]["Pages"] = {};
    }
    if (!data["ComicInfo"]["Pages"]["Page"]) {
      data["ComicInfo"]["Pages"]["Page"] = [];
    }
    let oldPagesArray = data["ComicInfo"]["Pages"]["Page"].slice();
    data["ComicInfo"]["Pages"]["Page"] = [];
    for (let index = 0; index < imgFilePaths.length; index++) {
      let pageData = {
        "@_Image": "",
        "@_ImageSize": "",
        "@_ImageWidth": "",
        "@_ImageHeight": "",
      };
      if (oldPagesArray.length > index) {
        pageData = oldPagesArray[index];
      }
      let filePath = imgFilePaths[index];
      pageData["@_Image"] = index;
      let fileStats = fs.statSync(filePath);
      let fileSizeInBytes = fileStats.size;
      pageData["@_ImageSize"] = fileSizeInBytes;
      const metadata = await sharp(filePath).metadata();
      pageData["@_ImageWidth"] = metadata.width;
      pageData["@_ImageHeight"] = metadata.height;
      data["ComicInfo"]["Pages"]["Page"].push(pageData);
    }

    temp.deleteSubFolder(tempFolderPath);
    base.sendIpcToRenderer("pages-updated", data);
  } catch (error) {
    temp.deleteSubFolder(tempFolderPath);
    base.sendIpcToRenderer("pages-updated", undefined);
  }
}

exports.saveMetadataToFile = async function (data) {
  try {
    const { XMLBuilder } = require("fast-xml-parser");
    // rebuild
    const builderOptions = {
      ignoreAttributes: false,
      format: true,
      suppressBooleanAttributes: false, // write booleans with text
    };
    const builder = new XMLBuilder(builderOptions);
    const outputXmlData = builder.build(data);
    const isUpdate = g_fileData.metadata.comicInfoId !== undefined;
    const entryName = isUpdate
      ? g_fileData.metadata.comicInfoId
      : "ComicInfo.xml";
    if (
      g_fileData.type === FileDataType.ZIP ||
      g_fileData.type === FileDataType.SEVENZIP
    ) {
      const tempFolderPath = temp.createSubFolder();
      const xmlFilePath = path.resolve(tempFolderPath, entryName);
      if (path.dirname(xmlFilePath) !== tempFolderPath) {
        fs.mkdirSync(path.dirname(xmlFilePath), { recursive: true });
      }
      fs.writeFileSync(xmlFilePath, outputXmlData);
      let success = await fileFormats.update7ZipWithFolderContents(
        g_fileData.path,
        tempFolderPath,
        g_fileData.password,
        g_fileData.type === FileDataType.ZIP ? "zip" : undefined,
      );
      temp.deleteSubFolder(tempFolderPath);
      if (!success) {
        throw "error updating 7zip entry";
      }
    } else if (g_fileData.type === FileDataType.RAR) {
      const tempFolderPath = temp.createSubFolder();
      const xmlFilePath = path.resolve(tempFolderPath, entryName);
      fs.writeFileSync(xmlFilePath, outputXmlData);
      let success = fileFormats.updateRarEntry(
        utils.getRarCommand(settings.getValue("rarExeFolderPath")),
        g_fileData.path,
        entryName,
        tempFolderPath,
      );
      temp.deleteSubFolder(tempFolderPath);
      if (!success) {
        throw "error updating RAR entry";
      }
    }
    if (!isUpdate) {
      reader.updateFileDataMetadataEntry("comicInfoId", entryName);
    }
    base.sendIpcToRenderer("saving-done");
  } catch (error) {
    log.error(error);
    base.sendIpcToRenderer("saving-done", error);
  }
};

///////////////////////////////////////////////////////////////////////////////
// LOCALIZATION ///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

function updateLocalizedText() {
  let baseLocalizedText = base.getLocalizedText();
  base.sendIpcToRenderer(
    "update-localization",
    [...baseLocalizedText[0], ...getLocalization()],
    [...baseLocalizedText[1], ...getTooltipsLocalization()],
    {
      savingMessageUpdate: _("tool-metadata-cix-warning-save-update"),
      savingMessageCreate: _("tool-metadata-cix-warning-save-create"),
      savingMessageSuccessUpdate: _(
        "tool-metadata-cix-modal-message-success-update",
      ),
      savingMessageSuccessCreate: _(
        "tool-metadata-cix-modal-message-success-create",
      ),
      savingMessageErrorUpdate: _(
        "tool-metadata-cix-modal-message-could-not-update",
      ),
      savingMessageErrorCreate: _(
        "tool-metadata-cix-modal-message-could-not-create",
      ),

      loadingMessageErrorInvalid: _(
        "tool-metadata-cix-modal-message-not-valid",
      ),
      ...baseLocalizedText[2],
    },
    [
      [
        _("tool-metadata-data-page-type-frontcover"),
        _("tool-metadata-data-page-type-innercover"),
        _("tool-metadata-data-page-type-roundup"),
        _("tool-metadata-data-page-type-story"),
        _("tool-metadata-data-page-type-advertisement"),
        _("tool-metadata-data-page-type-editorial"),
        _("tool-metadata-data-page-type-letters"),
        _("tool-metadata-data-page-type-preview"),
        _("tool-metadata-data-page-type-backCover"),
        _("tool-metadata-data-page-type-other"),
        _("tool-metadata-data-page-type-deleted"),
      ],
      [
        _("tool-metadata-data-page-table-header-image"),
        _("tool-metadata-data-page-table-header-imagesize"),
        _("tool-metadata-data-page-table-header-imagewidth"),
        _("tool-metadata-data-page-table-header-imageheight"),
        _("tool-metadata-data-page-table-header-doublepage"),
        _("tool-metadata-data-page-table-header-type"),
      ],
    ],
  );
}
exports.updateLocalizedText = updateLocalizedText;

function getTooltipsLocalization() {
  return [
    {
      id: "tool-metadata-tooltip-page-data",
      text: _("tool-metadata-cix-tooltip-update-pages"),
    },
  ];
}

function getLocalization() {
  return [
    {
      id: "tool-metadata-title-text",
      text: _("tool-metadata-cix-title").toUpperCase(),
    },
    //////////////////////////////////////////////
    {
      id: "tool-metadata-section-2-button-text",
      text: _("tool-metadata-section-details"),
    },
    {
      id: "tool-metadata-section-3-button-text",
      text: _("tool-metadata-section-creators"),
    },
    {
      id: "tool-metadata-section-4-button-text",
      text: _("tool-metadata-section-pages"),
    },
    {
      id: "tool-metadata-section-5-button-text",
      text: _("tool-metadata-section-other-data"),
    },
    ////////////////////////////////
    {
      id: "tool-metadata-section-2-text",
      text: _("tool-metadata-section-details"),
    },
    {
      id: "tool-metadata-section-3-text",
      text: _("tool-metadata-section-creators"),
    },
    {
      id: "tool-metadata-section-4-text",
      text: _("tool-metadata-section-pages"),
    },
    {
      id: "tool-metadata-section-5-text",
      text: _("tool-metadata-section-other-data"),
    },
    ////////////////////////////////
    {
      id: "tool-metadata-cbr-no-edit-rar-text",
      text: _("tool-metadata-cix-warning-rar"),
    },
    {
      id: "tool-metadata-cbr-no-edit-encrypted-text",
      text: _("tool-metadata-cix-warning-encrypted"),
    },
    {
      id: "tool-metadata-update-pages-button-text",
      text: _("ui-modal-prompt-button-update").toUpperCase(),
    },
    ////////////////////////////////
    {
      id: "tool-metadata-data-title-text",
      text: _("tool-metadata-data-title"),
    },
    {
      id: "tool-metadata-data-series-text",
      text: _("tool-metadata-data-series"),
    },
    {
      id: "tool-metadata-data-number-text",
      text: _("tool-metadata-data-number"),
    },
    {
      id: "tool-metadata-data-count-text",
      text: _("tool-metadata-data-count"),
    },
    {
      id: "tool-metadata-data-volume-text",
      text: _("tool-metadata-data-volume"),
    },
    {
      id: "tool-metadata-data-summary-text",
      text: _("tool-metadata-data-summary"),
    },
    {
      id: "tool-metadata-data-year-text",
      text: _("tool-metadata-data-year"),
    },
    {
      id: "tool-metadata-data-month-text",
      text: _("tool-metadata-data-month"),
    },
    {
      id: "tool-metadata-data-day-text",
      text: _("tool-metadata-data-day"),
    },
    {
      id: "tool-metadata-data-genre-text",
      text: _("tool-metadata-data-genre"),
    },

    {
      id: "tool-metadata-data-languageiso-text",
      text: _("tool-metadata-data-languageiso"),
    },
    {
      id: "tool-metadata-data-writer-text",
      text: _("tool-metadata-data-writer"),
    },
    {
      id: "tool-metadata-data-penciller-text",
      text: _("tool-metadata-data-penciller"),
    },
    {
      id: "tool-metadata-data-inker-text",
      text: _("tool-metadata-data-inker"),
    },
    {
      id: "tool-metadata-data-colorist-text",
      text: _("tool-metadata-data-colorist"),
    },
    {
      id: "tool-metadata-data-letterer-text",
      text: _("tool-metadata-data-letterer"),
    },
    {
      id: "tool-metadata-data-coverartist-text",
      text: _("tool-metadata-data-coverartist"),
    },
    {
      id: "tool-metadata-data-editor-text",
      text: _("tool-metadata-data-editor"),
    },
    {
      id: "tool-metadata-data-publisher-text",
      text: _("tool-metadata-data-publisher"),
    },
    {
      id: "tool-metadata-data-imprint-text",
      text: _("tool-metadata-data-imprint"),
    },
    {
      id: "tool-metadata-data-pagecount-text",
      text: _("tool-metadata-data-pagecount"),
    },
    {
      id: "tool-metadata-data-pages-text",
      text: _("tool-metadata-data-pages"),
    },
    {
      id: "tool-metadata-data-format-text",
      text: _("tool-metadata-data-format"),
    },
    {
      id: "tool-metadata-data-notes-text",
      text: _("tool-metadata-data-notes"),
    },
    {
      id: "tool-metadata-data-alternateseries-text",
      text: _("tool-metadata-data-alternateseries"),
    },
    {
      id: "tool-metadata-data-alternatenumber-text",
      text: _("tool-metadata-data-alternatenumber"),
    },
    {
      id: "tool-metadata-data-alternatecount-text",
      text: _("tool-metadata-data-alternatecount"),
    },
    {
      id: "tool-metadata-data-web-text",
      text: _("tool-metadata-data-web"),
    },
    {
      id: "tool-metadata-data-blackwhite-text",
      text: _("tool-metadata-data-blackwhite"),
    },
    {
      id: "tool-metadata-data-blackwhite-option-unknown-text",
      text: _("tool-metadata-data-blackwhite-option-unknown"),
    },
    {
      id: "tool-metadata-data-blackwhite-option-no-text",
      text: _("tool-metadata-data-blackwhite-option-no"),
    },
    {
      id: "tool-metadata-data-blackwhite-option-yes-text",
      text: _("tool-metadata-data-blackwhite-option-yes"),
    },
    {
      id: "tool-metadata-data-manga-text",
      text: _("tool-metadata-data-manga"),
    },
    {
      id: "tool-metadata-data-manga-option-unknown-text",
      text: _("tool-metadata-data-manga-option-unknown"),
    },
    {
      id: "tool-metadata-data-manga-option-no-text",
      text: _("tool-metadata-data-manga-option-no"),
    },
    {
      id: "tool-metadata-data-manga-option-yes-text",
      text: _("tool-metadata-data-manga-option-yes"),
    },
    {
      id: "tool-metadata-data-manga-option-yesrightleft-text",
      text: _("tool-metadata-data-manga-option-yesrightleft"),
    },
    {
      id: "tool-metadata-data-scaninformation-text",
      text: _("tool-metadata-data-scaninformation"),
    },
    {
      id: "tool-metadata-data-characters-text",
      text: _("tool-metadata-data-characters"),
    },
    {
      id: "tool-metadata-data-maincharacterorteam-text",
      text: _("tool-metadata-data-maincharacterorteam"),
    },
    {
      id: "tool-metadata-data-teams-text",
      text: _("tool-metadata-data-teams"),
    },
    {
      id: "tool-metadata-data-locations-text",
      text: _("tool-metadata-data-locations"),
    },
    {
      id: "tool-metadata-data-storyarc-text",
      text: _("tool-metadata-data-storyarc"),
    },
    {
      id: "tool-metadata-data-seriesgroup-text",
      text: _("tool-metadata-data-seriesgroup"),
    },
    {
      id: "tool-metadata-data-agerating-text",
      text: _("tool-metadata-data-agerating"),
    },
    {
      id: "tool-metadata-data-communityrating-text",
      text: _("tool-metadata-data-communityrating"),
    },
    {
      id: "tool-metadata-data-review-text",
      text: _("tool-metadata-data-review"),
    },
  ];
}

// hardcoded replacement for ISO6391.getLanguages(ISO6391.getAllCodes())
// so I don't need the library
// generate:
// const fs = require('node:fs');
// const ISO6391 = require('iso-639-1');
// const data = ISO6391.getLanguages(ISO6391.getAllCodes());
// const fileContent = `function getISOLanguages() {
//   return ${JSON.stringify(data, null, 2)};
// }
// fs.writeFileSync("./iso-languages.js", fileContent);
function getISOLanguages() {
  return [
    { code: "ab", name: "Abkhazian", nativeName: "аҧсуа бызшәа" },
    { code: "aa", name: "Afar", nativeName: "Afaraf" },
    { code: "af", name: "Afrikaans", nativeName: "Afrikaans" },
    { code: "ak", name: "Akan", nativeName: "Akan" },
    { code: "sq", name: "Albanian", nativeName: "Shqip" },
    { code: "am", name: "Amharic", nativeName: "አማርኛ" },
    { code: "ar", name: "Arabic", nativeName: "العربية" },
    { code: "an", name: "Aragonese", nativeName: "aragonés" },
    { code: "hy", name: "Armenian", nativeName: "Հայերեն" },
    { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
    { code: "av", name: "Avaric", nativeName: "авар мацӀ" },
    { code: "ae", name: "Avestan", nativeName: "avesta" },
    { code: "ay", name: "Aymara", nativeName: "aymar aru" },
    { code: "az", name: "Azerbaijani", nativeName: "azərbaycan dili" },
    { code: "bm", name: "Bambara", nativeName: "bamanankan" },
    { code: "ba", name: "Bashkir", nativeName: "башҡорт теле" },
    { code: "eu", name: "Basque", nativeName: "euskara" },
    { code: "be", name: "Belarusian", nativeName: "беларуская мова" },
    { code: "bn", name: "Bengali", nativeName: "বাংলা" },
    { code: "bh", name: "Bihari languages", nativeName: "भोजपुरी" },
    { code: "bi", name: "Bislama", nativeName: "Bislama" },
    { code: "bs", name: "Bosnian", nativeName: "bosanski jezik" },
    { code: "br", name: "Breton", nativeName: "brezhoneg" },
    { code: "bg", name: "Bulgarian", nativeName: "български език" },
    { code: "my", name: "Burmese", nativeName: "ဗမာစာ" },
    { code: "ca", name: "Catalan", nativeName: "català" },
    { code: "ch", name: "Chamorro", nativeName: "Chamoru" },
    { code: "ce", name: "Chechen", nativeName: "нохчийн мотт" },
    { code: "ny", name: "Chichewa", nativeName: "chiCheŵa" },
    { code: "zh", name: "Chinese", nativeName: "中文" },
    { code: "cv", name: "Chuvash", nativeName: "чӑваш чӗлхи" },
    { code: "kw", name: "Cornish", nativeName: "Kernewek" },
    { code: "co", name: "Corsican", nativeName: "corsu" },
    { code: "cr", name: "Cree", nativeName: "ᓀᐦᐃᔭᐑᐣ" },
    { code: "hr", name: "Croatian", nativeName: "hrvatski jezik" },
    { code: "cs", name: "Czech", nativeName: "čeština" },
    { code: "da", name: "Danish", nativeName: "dansk" },
    { code: "dv", name: "Divehi", nativeName: "ދިވެހިބަސް" },
    { code: "nl", name: "Dutch", nativeName: "Nederlands" },
    { code: "dz", name: "Dzongkha", nativeName: "རྫོང་ཁ" },
    { code: "en", name: "English", nativeName: "English" },
    { code: "eo", name: "Esperanto", nativeName: "Esperanto" },
    { code: "et", name: "Estonian", nativeName: "eesti" },
    { code: "ee", name: "Ewe", nativeName: "Eʋegbe" },
    { code: "fo", name: "Faroese", nativeName: "føroyskt" },
    { code: "fj", name: "Fijian", nativeName: "vosa Vakaviti" },
    { code: "fi", name: "Finnish", nativeName: "suomi" },
    { code: "fr", name: "French", nativeName: "français" },
    { code: "ff", name: "Fulah", nativeName: "Fulfulde" },
    { code: "gl", name: "Galician", nativeName: "galego" },
    { code: "ka", name: "Georgian", nativeName: "ქართული" },
    { code: "de", name: "German", nativeName: "Deutsch" },
    { code: "el", name: "Greek", nativeName: "ελληνικά" },
    { code: "gn", name: "Guarani", nativeName: "Avañe'ẽ" },
    { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
    { code: "ht", name: "Haitian", nativeName: "Kreyòl ayisyen" },
    { code: "ha", name: "Hausa", nativeName: "هَوُسَ" },
    { code: "he", name: "Hebrew", nativeName: "עברית" },
    { code: "hz", name: "Herero", nativeName: "Otjiherero" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
    { code: "ho", name: "Hiri Motu", nativeName: "Hiri Motu" },
    { code: "hu", name: "Hungarian", nativeName: "magyar" },
    { code: "ia", name: "Interlingua", nativeName: "Interlingua" },
    { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
    { code: "ie", name: "Interlingue", nativeName: "Interlingue" },
    { code: "ga", name: "Irish", nativeName: "Gaeilge" },
    { code: "ig", name: "Igbo", nativeName: "Asụsụ Igbo" },
    { code: "ik", name: "Inupiaq", nativeName: "Iñupiaq" },
    { code: "io", name: "Ido", nativeName: "Ido" },
    { code: "is", name: "Icelandic", nativeName: "íslenska" },
    { code: "it", name: "Italian", nativeName: "italiano" },
    { code: "iu", name: "Inuktitut", nativeName: "ᐃᓄᒃᑎᑐᑦ" },
    { code: "ja", name: "Japanese", nativeName: "日本語" },
    { code: "jv", name: "Javanese", nativeName: "Basa Jawa" },
    { code: "kl", name: "Kalaallisut", nativeName: "kalaallisut" },
    { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
    { code: "kr", name: "Kanuri", nativeName: "Kanuri" },
    { code: "ks", name: "Kashmiri", nativeName: "कश्मीरी" },
    { code: "kk", name: "Kazakh", nativeName: "қазақ тілі" },
    { code: "km", name: "Central Khmer", nativeName: "ខ្មែរ" },
    { code: "ki", name: "Kikuyu", nativeName: "Gikuyu" },
    { code: "rw", name: "Kinyarwanda", nativeName: "Ikinyarwanda" },
    { code: "ky", name: "Kirghiz", nativeName: "Кыргызча" },
    { code: "kv", name: "Komi", nativeName: "коми кыв" },
    { code: "kg", name: "Kongo", nativeName: "Kikongo" },
    { code: "ko", name: "Korean", nativeName: "한국어" },
    { code: "ku", name: "Kurdish", nativeName: "Kurdî" },
    { code: "kj", name: "Kuanyama", nativeName: "Kuanyama" },
    { code: "la", name: "Latin", nativeName: "latine" },
    { code: "lb", name: "Luxembourgish", nativeName: "Lëtzebuergesch" },
    { code: "lg", name: "Ganda", nativeName: "Luganda" },
    { code: "li", name: "Limburgan", nativeName: "Limburgs" },
    { code: "ln", name: "Lingala", nativeName: "lingála" },
    { code: "lo", name: "Lao", nativeName: "ພາສາລາວ" },
    { code: "lt", name: "Lithuanian", nativeName: "lietuvių kalba" },
    { code: "lu", name: "Luba-Katanga", nativeName: "Tshiluba" },
    { code: "lv", name: "Latvian", nativeName: "latviešu valoda" },
    { code: "gv", name: "Manx", nativeName: "Gaelg" },
    { code: "mk", name: "Macedonian", nativeName: "македонски јазик" },
    { code: "mg", name: "Malagasy", nativeName: "fiteny malagasy" },
    { code: "ms", name: "Malay", nativeName: "bahasa Melayu" },
    { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
    { code: "mt", name: "Maltese", nativeName: "Malti" },
    { code: "mi", name: "Maori", nativeName: "te reo Māori" },
    { code: "mr", name: "Marathi", nativeName: "मराठी" },
    { code: "mh", name: "Marshallese", nativeName: "Kajin M̧ajeļ" },
    { code: "mn", name: "Mongolian", nativeName: "Монгол хэл" },
    { code: "na", name: "Nauru", nativeName: "Dorerin Naoero" },
    { code: "nv", name: "Navajo", nativeName: "Diné bizaad" },
    { code: "nd", name: "North Ndebele", nativeName: "isiNdebele" },
    { code: "ne", name: "Nepali", nativeName: "नेपाली" },
    { code: "ng", name: "Ndonga", nativeName: "Owambo" },
    { code: "nb", name: "Norwegian Bokmål", nativeName: "Norsk bokmål" },
    { code: "nn", name: "Norwegian Nynorsk", nativeName: "Norsk nynorsk" },
    { code: "no", name: "Norwegian", nativeName: "Norsk" },
    { code: "ii", name: "Nuosu", nativeName: "ꆈꌠ꒿ Nuosuhxop" },
    { code: "nr", name: "South Ndebele", nativeName: "isiNdebele" },
    { code: "oc", name: "Occitan", nativeName: "occitan" },
    { code: "oj", name: "Ojibwa", nativeName: "ᐊᓂᔑᓈᐯᒧᐑᓐ" },
    { code: "cu", name: "Church Slavic", nativeName: "ѩзыкъ словѣньскъ" },
    { code: "om", name: "Oromo", nativeName: "Afaan Oromoo" },
    { code: "or", name: "Oriya", nativeName: "ଓଡ଼ିଆ" },
    { code: "os", name: "Ossetian", nativeName: "ирон æвзаг" },
    { code: "pa", name: "Panjabi", nativeName: "ਪੰਜਾਬੀ" },
    { code: "pi", name: "Pali", nativeName: "पाऴि" },
    { code: "fa", name: "Persian", nativeName: "فارسی" },
    { code: "pl", name: "Polish", nativeName: "polski" },
    { code: "ps", name: "Pashto", nativeName: "پښتو" },
    { code: "pt", name: "Portuguese", nativeName: "português" },
    { code: "qu", name: "Quechua", nativeName: "Runa Simi" },
    { code: "rm", name: "Romansh", nativeName: "rumantsch" },
    { code: "rn", name: "Rundi", nativeName: "Ikirundi" },
    { code: "ro", name: "Romanian", nativeName: "română" },
    { code: "ru", name: "Russian", nativeName: "русский язык" },
    { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्" },
    { code: "sc", name: "Sardinian", nativeName: "sardu" },
    { code: "sd", name: "Sindhi", nativeName: "सिन्धी" },
    { code: "se", name: "Northern Sami", nativeName: "davvisámegiella" },
    { code: "sm", name: "Samoan", nativeName: "gagana fa'a Samoa" },
    { code: "sg", name: "Sango", nativeName: "yângâ tî sängö" },
    { code: "sr", name: "Serbian", nativeName: "српски језик" },
    { code: "gd", name: "Gaelic", nativeName: "Gàidhlig" },
    { code: "sn", name: "Shona", nativeName: "chiShona" },
    { code: "si", name: "Sinhala", nativeName: "සිංහල" },
    { code: "sk", name: "Slovak", nativeName: "slovenčina" },
    { code: "sl", name: "Slovenian", nativeName: "slovenščina" },
    { code: "so", name: "Somali", nativeName: "Soomaaliga" },
    { code: "st", name: "Southern Sotho", nativeName: "Sesotho" },
    { code: "es", name: "Spanish", nativeName: "español" },
    { code: "su", name: "Sundanese", nativeName: "Basa Sunda" },
    { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
    { code: "ss", name: "Swati", nativeName: "SiSwati" },
    { code: "sv", name: "Swedish", nativeName: "svenska" },
    { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
    { code: "te", name: "Telugu", nativeName: "తెలుగు" },
    { code: "tg", name: "Tajik", nativeName: "тоҷикӣ" },
    { code: "th", name: "Thai", nativeName: "ไทย" },
    { code: "ti", name: "Tigrinya", nativeName: "ትግርኛ" },
    { code: "bo", name: "Tibetan", nativeName: "བོད་ཡིག" },
    { code: "tk", name: "Turkmen", nativeName: "Türkmen" },
    { code: "tl", name: "Tagalog", nativeName: "Wikang Tagalog" },
    { code: "tn", name: "Tswana", nativeName: "Setswana" },
    { code: "to", name: "Tonga", nativeName: "faka Tonga" },
    { code: "tr", name: "Turkish", nativeName: "Türkçe" },
    { code: "ts", name: "Tsonga", nativeName: "Xitsonga" },
    { code: "tt", name: "Tatar", nativeName: "татар теле" },
    { code: "tw", name: "Twi", nativeName: "Twi" },
    { code: "ty", name: "Tahitian", nativeName: "Reo Tahiti" },
    { code: "ug", name: "Uighur", nativeName: "ئۇيغۇرچە" },
    { code: "uk", name: "Ukrainian", nativeName: "українська мова" },
    { code: "ur", name: "Urdu", nativeName: "اردو" },
    { code: "uz", name: "Uzbek", nativeName: "O'zbek" },
    { code: "ve", name: "Venda", nativeName: "Tshivenḓa" },
    { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
    { code: "vo", name: "Volapük", nativeName: "Volapük" },
    { code: "wa", name: "Walloon", nativeName: "walon" },
    { code: "cy", name: "Welsh", nativeName: "Cymraeg" },
    { code: "wo", name: "Wolof", nativeName: "Wolof" },
    { code: "fy", name: "Western Frisian", nativeName: "Frysk" },
    { code: "xh", name: "Xhosa", nativeName: "isiXhosa" },
    { code: "yi", name: "Yiddish", nativeName: "ייִדיש" },
    { code: "yo", name: "Yoruba", nativeName: "Yorùbá" },
    { code: "za", name: "Zhuang", nativeName: "Saɯ cueŋƅ" },
    { code: "zu", name: "Zulu", nativeName: "isiZulu" },
  ];
}
