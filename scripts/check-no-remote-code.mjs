import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_PATTERNS = [
  { pattern: /\beval\s*\(/, label: "eval(...)" },
  { pattern: /new\s+Function\s*\(/, label: "new Function(...)" },
  { pattern: /<script[^>]+src=["']https?:\/\//i, label: "remote <script src>" },
  { pattern: /importScripts\s*\(\s*["']https?:\/\//, label: "remote importScripts()" },
  { pattern: /(?:src|href)=["']https:\/\/(?!ui5\.sap\.com|github\.com|buymeacoffee\.com)/i, label: "unexpected remote asset reference" },
];

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {string[]}
 */
export function scanFileForRemoteCode(filePath, content) {
  const violations = [];
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`${filePath}: ${label}`);
    }
  }
  return violations;
}

/**
 * @param {string} dirPath
 * @returns {string[]}
 */
export function scanDirForRemoteCode(dirPath) {
  const violations = [];
  let entries;
  try {
    entries = readdirSync(dirPath);
  } catch {
    return violations;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      violations.push(...scanDirForRemoteCode(fullPath));
      continue;
    }
    if (!/\.(js|mjs|html)$/.test(entry)) {
      continue;
    }
    const content = readFileSync(fullPath, "utf-8");
    violations.push(...scanFileForRemoteCode(fullPath, content));
  }
  return violations;
}

function runCli() {
  const distPath = fileURLToPath(new URL("../dist", import.meta.url));
  const violations = scanDirForRemoteCode(distPath);
  if (violations.length > 0) {
    console.error("Remote-code verification failed:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }
  console.log("Remote-code verification passed.");
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  runCli();
}
