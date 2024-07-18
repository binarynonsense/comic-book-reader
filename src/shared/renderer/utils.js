/**
 * @license
 * Copyright 2020-2024 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function isVersionOlder(testVersion, referenceVersion) {
  const test = separateVersionText(testVersion);
  const reference = separateVersionText(referenceVersion);
  if (test === undefined || reference === undefined) return true;

  if (test.major < reference.major) return true;
  if (test.major > reference.major) return false;
  if (test.minor < reference.minor) return true;
  if (test.minor > reference.minor) return false;
  if (test.patch < reference.patch) return true;
  if (test.patch > reference.patch) return false;
  // TODO: too complex, may have errors, make better/simpler
  if (test.beta === undefined && test.alpha === undefined) {
    return false;
  }
  if (reference.beta === undefined && reference.alpha === undefined) {
    if (test.beta !== undefined || test.alpha !== undefined) {
      return true;
    }
  }
  // both have alpha or beta
  if (reference.beta !== undefined) {
    if (test.beta !== undefined) {
      if (reference.beta > test.beta) return true;
      else return false;
    } else {
      return true;
    }
  } else {
    // reference has alpha
    if (test.beta !== undefined) {
      return false;
    }
    // beta has alpha
    if (reference.alpha > test.alpha) return true;
    else return false;
  }
}

function separateVersionText(version) {
  try {
    const regex =
      /^(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)((-alpha(?<alpha>[0-9]+))|(-beta(?<beta>[0-9]+))*)$/;
    let match = version.match(regex);
    if (match === null) return undefined;
    return match.groups;
  } catch (error) {
    console.log("match error");
  }
}

export async function delay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function encodeImgPath(filePath) {
  let { fileName, folderPath } = getFolderAndNameFromFilePath(filePath);
  return folderPath + "/" + encodeURIComponent(fileName);
}

export function getFolderAndNameFromFilePath(filePath) {
  const lastIndex = Math.max(
    filePath.lastIndexOf("\\"),
    filePath.lastIndexOf("/")
  );
  const fileName = filePath.substring(lastIndex + 1);
  const folderPath = filePath.substring(0, lastIndex);
  return { fileName, folderPath };
}
