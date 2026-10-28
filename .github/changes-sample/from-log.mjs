// A one-off (delete before merging): the digest JSON a dry-run sample job printed in its log, written to a file.
//   node from-log.mjs <job.log> <outDir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const [log, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const lines = readFileSync(log, 'utf8').split('\n').map(line => line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/u, ''));
let name = null, body = [];
const flush = () => { if (name) writeFileSync(`${outDir}/${name}`, body.join('\n').trim() + '\n'); };
for (const line of lines) {
  const head = /^=== (\S+\.json)$/u.exec(line);
  if (head) { flush(); name = head[1]; body = []; continue; }
  if (name && /^##\[|^Post job|^Cleaning up/u.test(line)) { flush(); name = null; continue; }
  if (name) body.push(line);
}
flush();
