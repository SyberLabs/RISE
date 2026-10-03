import { describe, expect, it, vi } from 'vitest';
import { createRouteManifest } from './route-manifest.js';

const ROUTE_IDS = [
  'portal',
  'vault',
  'chamber',
  'chamber-session',
  'library',
  'workshop',
  'settings',
  'scriptorium',
  'emotions',
  'visual-lab',
  'visual-catalog',
  'live'
];

describe('createRouteManifest', () => {
  it('declares every application route exactly once', () => {
    const routes = createRouteManifest({
      handleNavigate: vi.fn()
    });

    expect(routes.map(route => route.id)).toEqual(ROUTE_IDS);
    expect(new Set(routes.map(route => route.id)).size).toBe(routes.length);
    for (const route of routes) {
      expect(route.containerId).toMatch(/^view-/u);
      expect(route.load).toBeTypeOf('function');
      expect(route.create).toBeTypeOf('function');
    }
  });

  it('forwards shell capabilities to every room that consumes them', () => {
    const getAudioEngine = vi.fn();
    const getCurrentSession = vi.fn();
    const notify = vi.fn();
    const routes = createRouteManifest({
      getAudioEngine,
      getCurrentSession,
      getSettings: () => ({}),
      showToast: notify
    });
    const roomOptions = (id, exportName) => {
      let received;
      class Room {
        constructor(_container, options) {
          received = options;
        }

        update() {}
      }
      routes.find(route => route.id === id).create({}, null, { [exportName]: Room });
      return received;
    };

    for (const [id, exportName] of [
      ['portal', 'Portal'],
      ['vault', 'Vault'],
      ['chamber', 'ChamberOrbital'],
      ['library', 'Library']
    ]) {
      expect(roomOptions(id, exportName).getAudioEngine, `${id} audio boundary`).toBe(getAudioEngine);
    }
    const panes = roomOptions('library', 'Library').paneCapabilities;
    for (const pane of ['chapel', 'rosary', 'stations', 'journeys']) {
      expect(panes[pane].getAudioEngine, `${pane} audio boundary`).toBe(getAudioEngine);
    }
    expect(roomOptions('portal', 'Portal').getCurrentSession).toBe(getCurrentSession);
    expect(roomOptions('settings', 'Settings').notify).toBe(notify);
  });

  it('hands each Library pane what its own room was given', async () => {
    const operations = {
      handleNavigate: vi.fn(),
      handleBeginSession: vi.fn(),
      launchKeystone: vi.fn(),
      openMintedProgram: vi.fn(),
      router: { updateAddress: vi.fn() }
    };
    let received;
    const shown = [];
    class Library {
      constructor(_container, options) { received = options; }
      update(data) { shown.push(data); }
    }
    await createRouteManifest(operations).find(route => route.id === 'library')
      .create({}, { pane: 'today' }, { Library });
    const panes = received.paneCapabilities;
    expect(Object.keys(panes).sort()).toEqual(
      ['chapel', 'journeys', 'keystones', 'mint', 'provenance', 'rosary', 'stations', 'today']
    );
    expect(panes.today).toEqual({ onNavigate: operations.handleNavigate, onBegin: operations.handleBeginSession });
    expect(panes.keystones.onLaunch).toBe(operations.launchKeystone);
    expect(panes.mint.onOpen).toBe(operations.openMintedProgram);
    expect(shown).toEqual([{ pane: 'today' }]);
    // A Chapel chapter's address stays a Chapel address.
    panes.chapel.onAddressChange({ bookId: 'john', chapter: 3 });
    expect(operations.router.updateAddress).toHaveBeenCalledWith({ bookId: 'john', chapter: 3, pane: 'chapel' });
  });

  it('creates the catalog with the navigation callback and address search', () => {
    const handleNavigate = vi.fn();
    const route = createRouteManifest({ handleNavigate }).find(item => item.id === 'visual-catalog');
    let received;
    class VisualCatalog { constructor(_container, options) { received = options; } }
    route.create({}, { search: '?q=light' }, { VisualCatalog });
    received.onNavigate('portal');
    expect(handleNavigate).toHaveBeenCalledWith('portal');
    expect(received.search).toBe('?q=light');
  });
});
