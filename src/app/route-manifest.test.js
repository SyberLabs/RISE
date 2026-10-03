import { describe, expect, it, vi } from 'vitest';
import { createRouteManifest } from './route-manifest.js';

const ROUTE_IDS = [
  'portal',
  'chamber',
  'chamber-session',
  'library',
  'make',
  'settings',
  'emotions',
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
      ['chamber', 'ChamberOrbital'],
      ['library', 'Library']
    ]) {
      expect(roomOptions(id, exportName).getAudioEngine, `${id} audio boundary`).toBe(getAudioEngine);
    }
    const panes = roomOptions('library', 'Library').paneCapabilities;
    for (const pane of ['chapel', 'rosary', 'stations', 'journeys']) {
      expect(panes[pane].getAudioEngine, `${pane} audio boundary`).toBe(getAudioEngine);
    }
    const tabs = roomOptions('make', 'Make').tabCapabilities;
    expect(tabs.vault.getAudioEngine, 'vault audio boundary').toBe(getAudioEngine);
    expect(tabs.workshop.audioEngineProvider, 'workshop audio boundary').toBe(getAudioEngine);
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

  it('hands each Make tab what its own room was given, and opens the addressed tab', async () => {
    const operations = {
      handleNavigate: vi.fn(),
      handleCreateSession: vi.fn(),
      handleSequenceSelection: vi.fn(),
      handleSettingsTransaction: vi.fn(),
      useRecipeInReading: vi.fn(),
      refreshVaultBlueprints: vi.fn(),
      getSettings: vi.fn()
    };
    let received;
    const shown = [];
    class Make {
      constructor(_container, options) { received = options; }
      update(data) { shown.push(data); }
    }
    await createRouteManifest(operations).find(route => route.id === 'make')
      .create({}, { pane: 'visual-catalog', search: '?q=light' }, { Make });
    const tabs = received.tabCapabilities;
    expect(Object.keys(tabs)).toEqual(['workshop', 'vault', 'scriptorium', 'visual-lab', 'visual-catalog']);
    expect(tabs.workshop.onBlueprintsChanged).toBe(operations.refreshVaultBlueprints);
    expect(tabs.vault.onSelectBlueprint).toBe(operations.handleCreateSession);
    expect(tabs.scriptorium.onSettingsTransaction).toBe(operations.handleSettingsTransaction);
    expect(tabs['visual-lab'].mode).toBe('route');
    tabs['visual-lab'].onEditInWorkshop();
    expect(operations.handleNavigate).toHaveBeenCalledWith('workshop');
    tabs['visual-catalog'].onNavigate('portal');
    expect(operations.handleNavigate).toHaveBeenCalledWith('portal');
    expect(shown).toEqual([{ pane: 'visual-catalog', search: '?q=light' }]);
  });
});
