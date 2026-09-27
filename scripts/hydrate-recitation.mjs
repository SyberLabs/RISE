import { execFileSync } from 'node:child_process';

const source = 'refs/heads/rise/audio-assets';
const expectedTree = '9879dfa2441540d1d03a350e158e4d7e5b9ee277';

execFileSync('git', [
  '-c', 'protocol.version=2', 'fetch', '--depth=1', '--filter=blob:none',
  'origin', source
], { stdio: 'inherit' });

const actualTree = execFileSync('git', [
  'rev-parse', 'FETCH_HEAD:public/audio/recitation'
], { encoding: 'utf8' }).trim();
if (actualTree !== expectedTree) {
  throw new Error(`Recitation assets changed: expected ${expectedTree}, got ${actualTree}`);
}

execFileSync('git', [
  'restore', '--source=FETCH_HEAD', '--worktree', '--', 'public/audio/recitation'
], { stdio: 'inherit' });
console.log(`Restored recitation assets from ${actualTree}`);
