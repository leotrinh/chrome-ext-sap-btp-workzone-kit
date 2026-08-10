/** Blueprint §15 — format valid, existence against a real SAPUI5 release not verified. */
const VERSION_FORMAT = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function isValidVersionFormat(value: string): boolean {
  return VERSION_FORMAT.test(value.trim());
}
