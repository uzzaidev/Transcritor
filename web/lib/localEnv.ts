import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

const stripQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export function loadLocalEnvFallbacks() {
  if (loaded) {
    return;
  }
  loaded = true;

  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = stripQuotes(trimmed.slice(separator + 1));
    }
  }
}

export function getEnv(name: string) {
  loadLocalEnvFallbacks();
  return process.env[name];
}
