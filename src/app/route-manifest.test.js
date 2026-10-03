import { describe, expect, it, vi } from 'vitest';
import { createRouteManifest } from './route-manifest.js';

const ROUTE_IDS = [
  'portal',
  'keystones',
  'mint',
  'vault',
  'chamber',
  'chamber-session',
  'library',
  'journeys',
  'workshop',
  'settings',
  'rosarium',
  'curia',
  'scriptorium',
  'via',
  'emotions',
  'visual-lab',
  'visual-catalog',
  'live',
  'chapel',
  'today'
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
      }
      routes.find(route => route.id === id).create({}, null, { [exportName]: Room });
      return received;
    };

    for (const [id, exportName] of [
      ['portal', 'Portal'],
      ['vault', 'Vault'],
      ['chamber', 'ChamberOrbital'],
      ['library', 'Library'],
      ['journeys', 'Journeys'],
      ['rosarium', 'Rosarium'],
      ['via', 'Via'],
      ['chapel', 'Chapel']
    ]) {
      expect(roomOptions(id, exportName).getAudioEngine, `${id} audio boundary`).toBe(getAudioEngine);
    }
    expect(roomOptions('portal', 'Portal').getCurrentSession).toBe(getCurrentSession);
    expect(roomOptions('settings', 'Settings').notify).toBe(notify);
  });

  it('creates Today with navigation and the session starter', () => {
    const handleNavigate = vi.fn();
    const handleBeginSession = vi.fn();
    let received;
    class TodayPoem {
      constructor(_container, options) {
        received = options;
      }
    }
    createRouteManifest({ handleNavigate, handleBeginSession })
      .find(route => route.id === 'today')
      .create({}, null, { TodayPoem });
    expect(received).toEqual({ onNavigate: handleNavigate, onBegin: handleBeginSession });
  });

  it('gives Home the session starter Today begins its poem with', () => {
    const handleBeginSession = vi.fn();
    let received;
    class Portal {
      constructor(_container, options) {
        received = options;
      }
    }
    createRouteManifest({ handleBeginSession }).find(route => route.id === 'portal').create({}, null, { Portal });
    expect(received.onBeginSession).toBe(handleBeginSession);
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
