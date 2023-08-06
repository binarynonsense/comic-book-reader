/**
 * @license
 * Copyright 2020-2023 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

export function isVersionOlder(testVersion, referenceVersion) {
  const test = separateVersionText(testVersion);
  const reference = separateVersionText(referenceVersion);
  if (test === undefined || reference === undefined) return true;
  if (test.major < reference.major) return true;
  if (test.minor < reference.minor) return true;
  if (test.patch < reference.patch) return true;
  if (test.beta !== undefined) {
    if (reference.beta === undefined && reference.alpha === undefined)
      return true;
    if (reference.beta !== undefined) {
      if (test.beta < reference.beta) return true;
    }
  }
  if (test.alpha !== undefined) {
    if (reference.beta !== undefined) return true;
    if (reference.alpha === undefined) return true;
    if (test.alpha < reference.alpha) return true;
  }
  return false;
}

function separateVersionText(version) {
  try {
    // TODO: alpha-beta test is not correct, but good enough for now, fix it
    // I added |-alpha for a quick fix for what I needed but is not correct
    const regex =
      /^(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)(-alpha(?<alpha>[0-9]+))|(-beta(?<beta>[0-9]+))*$/;
    let match = version.match(regex);
    if (match === null) return undefined;
    return match.groups;
  } catch (error) {
    console.log("match error");
  }
}
