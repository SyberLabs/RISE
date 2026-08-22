/**
 * The shelf behind the Library door — real round trips.
 *
 * `fake-indexeddb` is a real IDB implementation, so nothing here is stubbed:
 * a record goes in through `save` and comes back out through `all` having
 * been structured-cloned, exactly as it would in a browser.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalWorkStore, MAX_LOCAL_WORKS } from './local-work-store.js';
import { draftLocalWork } from './local-works.js';

const shelf = new LocalWorkStore();
const work = (title, text = 'a stone set on a stone\r\n\r\nand the light going') =>
  draftLocalWork({ text, title, sourceName: `${title}.txt` });

beforeEach(async () => {
  await shelf.clear();
});

describe('what the shelf holds', () => {
  it('returns a work as the record it was given', async () => {
    const saved = await shelf.save(work('Poems'));
    const [back] = await shelf.all();
    expect(back.id).toBe(saved.id);
    expect(back.text).toBe(saved.text);
    expect(back.labels).toEqual(saved.labels);
    expect(await shelf.get(saved.id)).not.toBeNull();
  });

  it('replaces rather than duplicates when the same work is admitted twice', async () => {
    // The id is minted from the title, so dropping the same diary again is an
    // edit of what is shelved — not a second copy that will disagree with it.
    await shelf.save(work('Diary'));
    await shelf.save(work('Diary', 'a longer entry than before, with more said in it'));
    const all = await shelf.all();
    expect(all).toHaveLength(1);
    expect(all[0].text).toContain('more said in it');
  });

  it('drops one work without touching the others', async () => {
    const kept = await shelf.save(work('Poems'));
    const gone = await shelf.save(work('Diary'));
    await shelf.drop(gone.id);
    expect((await shelf.all()).map(record => record.id)).toEqual([kept.id]);
    expect(await shelf.get(gone.id)).toBeNull();
  });
});

describe('when something is wrong with a row', () => {
  it('serves the rest rather than taking the door down', async () => {
    // A record from a schema this build no longer understands. The reader
    // must not lose every other work they admitted in order to refuse it.
    const good = await shelf.save(work('Poems'));
    await shelf.init();
    await new Promise((resolve, reject) => {
      const request = shelf.db.transaction(['works'], 'readwrite')
        .objectStore('works')
        .put({ id: 'local-ruined', schema: 'rise.local-work.v0', text: 'x' });
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });

    const all = await shelf.all();
    expect(all.map(record => record.id)).toEqual([good.id]);
    expect(await shelf.get('local-ruined')).toBeNull();
  });

  it('refuses a record that was never valid, before it is written', async () => {
    await expect(shelf.save({ schema: 'rise.local-work.v1', id: 'local-x' }))
      .rejects.toMatchObject({ name: 'LocalWorkError' });
    expect(await shelf.all()).toHaveLength(0);
  });

  it('says the shelf is full in a sentence, rather than letting the quota say it', async () => {
    for (let i = 0; i < MAX_LOCAL_WORKS; i += 1) await shelf.save(work(`Work ${i}`));
    await expect(shelf.save(work('One too many')))
      .rejects.toMatchObject({ code: 'LOCAL_WORK_SHELF_FULL' });
    // And the work already shelved under that id may still be re-saved: a
    // full shelf must not lock a reader out of editing what is on it.
    await expect(shelf.save(work('Work 0'))).resolves.toBeTruthy();
  });
});
