export class Sanitize {
  static string(input, defaultString, validStrings) {
    let isValid = true;
    if (typeof input !== "string") {
      isValid = false;
    } else if (validStrings) {
      isValid = false;
      for (let index = 0; index < validStrings.length; index++) {
        if (input === validStrings[index]) {
          isValid = true;
          break;
        }
      }
    }
    if (isValid) {
      return input;
    } else {
      return defaultString;
    }
  }

  static number(input) {
    let value = Number(input);
    if (typeof value !== "number") {
      return undefined;
    }
    return value;
  }

  static bool(input) {
    if (typeof input !== "boolean") {
      return undefined;
    }
    return input;
  }

  static color(input) {
    let regex = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i;
    if (typeof input !== "string" || !regex.test(input)) {
      return undefined;
    }
    return input;
  }

  static version(input) {
    if (typeof input !== "string") {
      return undefined;
    }
    if (!this.separateVersionText(input)) {
      return undefined;
    }
    return input;
  }

  static separateVersionText(version) {
    const regex =
      /^(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)(-beta(?<beta>[0-9]+))*$/;
    let match = version.match(regex);
    if (match === null) return undefined;
    return match.groups;
  }

  static isVersionOlder(testVersion, referenceVersion) {
    const test = separateVersionText(testVersion);
    const reference = separateVersionText(referenceVersion);
    if (test === undefined || reference === undefined) return true;
    if (test.major < reference.major) return true;
    if (test.minor < reference.minor) return true;
    if (test.patch < reference.patch) return true;
    if (test.beta !== undefined) {
      if (reference.beta === undefined) return true;
      if (test.beta < reference.beta) return true;
    }
    return false;
  }
}
