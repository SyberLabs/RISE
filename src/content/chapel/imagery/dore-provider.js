/**
 * Doré cycle provider — serves one book's plates to the cortex.
 *
 * Category ids are `dore:<bookId>` (e.g. `dore:josue`), supplied only
 * by Chapel launches for CYCLE-classified books. Same isolation as
 * every chapel surface: never registered, never browsable, no
 * fallback — a book without plates yields nothing.
 *
 * Plates are pinned Commons files with baked URLs; no API call is
 * needed at session time, so this provider resolves instantly and
 * cannot stall the preparation screen.
 */

import { DORE_PLATES, dorePlatesForBook, doreAttribution } from './dore.js';
import { ShuffleBag } from '../../../sources/visual/shuffle-bag.js';

export function hasDoreBook(categoryId) {
  const bookId = String(categoryId || '').replace(/^dore:/, '');
  // `dore:all` is the aggregate: the whole 1866 cycle as one voice,
  // tradeable onto any Chapel reading (e.g. the Apocalypse with the
  // full Old Testament sweep behind it).
  if (bookId === 'all') return true;
  return DORE_PLATES.some(plate => plate.book === bookId);
}

class DoreCycleProvider {
  constructor() {
    this.id = 'chapel-dore';
    this.name = 'Doré Bible cycle';
    this.contentType = 'image';
    // The bag walks a book's plates without repeats until exhausted —
    // the cycle is meant to be SEEN through, not sampled.
    this._bag = new ShuffleBag();
  }

  async getRandom(filter = {}) {
    const categoryId = filter.category || '';
    // The aggregate draws from ALL plates; plates are static records,
    // so a large pool costs nothing at session time.
    const images = await this.getImagesInCategory(categoryId, 200);
    if (images.length === 0) return null;
    const image = this._bag.draw(categoryId, images);
    if (!image) return null;
    return {
      id: image.id,
      type: 'image',
      name: image.title,
      data: image,
      providerId: this.id,
      metadata: {
        artist: 'Gustave Doré',
        date: '1866',
        license: 'PUBLIC_DOMAIN',
        attribution: image.attribution,
        sourceUrl: image.sourceUrl,
        sourceName: 'Wikimedia Commons',
        categoryId
      }
    };
  }

  async getImagesInCategory(categoryId, limit = 40) {
    const bookId = String(categoryId || '').replace(/^dore:/, '');
    const plates = bookId === 'all' ? DORE_PLATES : dorePlatesForBook(bookId);
    return plates.slice(0, limit).map(plate => ({
      id: `dore:${plate.plate}`,
      title: plate.title,
      url: plate.image,
      fullUrl: plate.image,
      artist: 'Gustave Doré',
      date: '1866',
      license: 'PUBLIC_DOMAIN',
      attribution: doreAttribution(plate),
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(plate.file)}`,
      sourceName: 'Wikimedia Commons'
    }));
  }

  async getImageInfo(item) {
    return item || null;
  }
}

let instance = null;
export function getDoreCycleProvider() {
  if (!instance) instance = new DoreCycleProvider();
  return instance;
}
