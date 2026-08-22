#!/usr/bin/env node
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoSkills = join(dirname(fileURLToPath(import.meta.url)), "..", ".cursor", "skills");
const destRoot = join(homedir(), ".cursor", "skills");
const names = readdirSync(repoSkills, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

mkdirSync(destRoot, { recursive: true });

for (const name of names) {
  const dest = join(destRoot, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(repoSkills, name), dest, { recursive: true });
}

console.log(`Installed user skills into ${destRoot}:`);
for (const name of names) {
  console.log(`  /${name}`);
}
console.log("");
console.log("This only covers this machine. Skills do not sync across devices.");
console.log("For always-on behavior on Windows, Mac, iPhone, and Cloud Agents,");
console.log("paste .cursor/USER-RULES.md into Cursor Settings → Rules (once).");
