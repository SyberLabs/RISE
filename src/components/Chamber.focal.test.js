import { describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

function makeChamber() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = {
    title: 'Personal focal', atoms: [], totalDuration: 0, atomCount: 0,
    visualConfig: { visualMode: 'off' },
    sequenceVisualAssets: [{
      id: 'portrait', kind: 'image', uri: 'blob:http://localhost/portrait'
    }]
  };
  return {
    chamber: new Chamber(container, { session, player: null, autoStart: false }),
    container
  };
}

describe('Chamber personal focal field', () => {
  it('resolves the durable image id inside the focal frame, not the full-frame media plane', () => {
    const { chamber, container } = makeChamber();
    const mounted = chamber.mountVisualFieldCue({
      kind: 'field', renderer: 'focal',
      config: { type: 'personal', personalAssetId: 'portrait' }
    });

    expect(mounted.node.classList.contains('chamber-focal')).toBe(true);
    expect(mounted.node.querySelector('.focal-personal .focal-image')?.src)
      .toBe('blob:http://localhost/portrait');
    expect(mounted.node.querySelector('video')).toBeNull();

    mounted.destroy();
    chamber.destroy();
    container.remove();
  });

  it('resolves a project image for Page without consulting an external provider', async () => {
    const provider = { resolveCollectionWorks: () => { throw new Error('provider should not run'); } };
    const works = await Chamber.prototype._resolvePageCollection.call({
      session: {
        sequenceVisualAssets: [{
          id: 'portrait', kind: 'image', name: 'Portrait',
          uri: 'blob:http://localhost/portrait'
        }]
      }
    }, 'sequence-asset:portrait', 1, null, provider);

    expect(works).toEqual([{
      name: 'Portrait',
      data: { url: 'blob:http://localhost/portrait', title: 'Portrait' }
    }]);
  });

  it('defers direct-Page presenters without rewriting the authored visual mode', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
      title: 'Page first', atoms: [], totalDuration: 0, atomCount: 0,
      projection: 'page',
      visualConfig: {
        visualMode: 'focals', focals: { type: 'standard', standardGlyph: 'star' }
      }
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });

    expect(session.visualConfig.visualMode).toBe('focals');
    expect(chamber._temporalVisualsDeferred).toBe(true);
    expect(container.querySelector('.chamber-focal')).toBeNull();
    chamber.destroy();
    container.remove();
  });

  it('builds and pauses a direct-Page Genesis sampler without installing Stream hosts', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
      title: 'Genesis page', atoms: [], totalDuration: 0, atomCount: 0,
      projection: 'page',
      visualConfig: { visualMode: 'genesis', genesis: { preset: 'harmonic' } }
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });

    expect(chamber._temporalVisualsDeferred).toBe(true);
    expect(chamber.kleeField).not.toBeNull();
    expect(chamber.kleeField.paused).toBe(true);
    chamber.destroy();
    container.remove();
  });
});
