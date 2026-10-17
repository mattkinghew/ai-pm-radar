import { readFileSync } from "node:fs";

export function parseDotEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function loadProjectEnv(target = process.env, envPath) {
  let fileValues = {};
  try {
    fileValues = parseDotEnv(readFileSync(envPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  for (const [key, value] of Object.entries(fileValues)) {
    if (target[key] === undefined) target[key] = value;
  }
  return target;
}
