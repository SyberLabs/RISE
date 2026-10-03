import { execFileSync } from 'node:child_process';

const source = 'refs/heads/rise/audio-assets';
const expectedTree = '1373a337cb8e72411d67bb8269cb92711c3441b4';

execFileSync('git', [
  '-c', 'protocol.version=2', 'fetch', '--depth=1',
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
