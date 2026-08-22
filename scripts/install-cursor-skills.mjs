#!/usr/bin/env node
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  join(repoRoot, ".cursor", "skills"),
  join(repoRoot, ".agents", "skills"),
];
const destRoots = [
  join(homedir(), ".cursor", "skills"),
  join(homedir(), ".agents", "skills"),
  join(homedir(), ".codex", "skills"),
  join(homedir(), ".claude", "skills"),
];

const installed = new Set();

for (const srcRoot of sources) {
  const names = readdirSync(srcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const destRoot of destRoots) {
    mkdirSync(destRoot, { recursive: true });
    for (const name of names) {
      const dest = join(destRoot, name);
      rmSync(dest, { recursive: true, force: true });
      cpSync(join(srcRoot, name), dest, { recursive: true });
      installed.add(name);
    }
  }
}

console.log("Installed user skills into:");
for (const destRoot of destRoots) {
  console.log(`  ${destRoot}`);
}
console.log("Skills:");
for (const name of [...installed].sort()) {
  console.log(`  /${name}`);
}
console.log("");
console.log("This only covers this machine. Skills do not sync across devices.");
console.log("Use one Cursor User Rule (see .cursor/USER-RULES.md), not a second rule.");
