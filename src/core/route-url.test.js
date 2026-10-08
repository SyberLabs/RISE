import { describe, it, expect } from 'vitest';
import { addressIsOwnTo, pathForRoute, routeFromPath, ROUTE_ALIASES, ROUTE_PANES } from './route-url.js';

describe('route urls', () => {
    it('round-trips every route id', () => {
        for (const id of Object.keys(ROUTE_ALIASES)) {
            const data = ROUTE_PANES[id] ? { pane: ROUTE_PANES[id] } : {};
            const path = pathForRoute(ROUTE_ALIASES[id], data);
            expect(path.startsWith('/')).toBe(true);
            expect(routeFromPath(path).id).toBe(ROUTE_ALIASES[id]);
            // Make with no tab named is the Workshop.
            expect(routeFromPath(path).data.pane).toBe(data.pane ?? (id === 'make' ? 'workshop' : undefined));
        }
    });

    it('gives every Library pane its address, both ways', () => {
        const panes = {
            chapel: '/library/chapel',
            rosary: '/library/rosary',
            stations: '/library/stations',
            journeys: '/library/journeys',
            keystones: '/try-rise',
            mint: '/library/mint',
            provenance: '/library/provenance'
        };
        const libraryPanes = Object.entries(ROUTE_PANES)
            .filter(([id]) => ROUTE_ALIASES[id] === 'library').map(([, pane]) => pane);
        expect(libraryPanes.sort()).toEqual(Object.keys(panes).sort());
        for (const [pane, path] of Object.entries(panes)) {
            expect(pathForRoute('library', { pane })).toBe(path);
            expect(routeFromPath(path)).toEqual({ id: 'library', data: { pane } });
        }
        expect(pathForRoute('library')).toBe('/library');
        expect(pathForRoute('library', { pane: 'no-such-pane' })).toBeNull();
        expect(routeFromPath('/library/keystones')).toEqual({ id: 'library', data: { pane: 'keystones' } });
    });

    it('gives every Make tab the path its room had, both ways', () => {
        const tabs = {
            workshop: '/make/workshop',
            vault: '/make/vault',
            scriptorium: '/make/scriptorium',
            'visual-lab': '/visual-lab',
            'visual-catalog': '/visual-catalog'
        };
        for (const [pane, path] of Object.entries(tabs)) {
            expect(ROUTE_ALIASES[pane]).toBe('make');
            expect(ROUTE_PANES[pane]).toBe(pane);
            expect(pathForRoute('make', { pane })).toBe(path);
        }
        expect(pathForRoute('make')).toBe('/make/workshop');
        expect(routeFromPath('/make/workshop')).toEqual({ id: 'make', data: { pane: 'workshop' } });
        expect(routeFromPath('/make/vault', '?section=custom'))
            .toEqual({ id: 'make', data: { pane: 'vault', section: 'custom' } });
        expect(routeFromPath('/make/scriptorium')).toEqual({ id: 'make', data: { pane: 'scriptorium' } });
        expect(routeFromPath('/visual-lab')).toEqual({ id: 'make', data: { pane: 'visual-lab' } });
        expect(routeFromPath('/visual-catalog', '?q=moon'))
            .toEqual({ id: 'make', data: { pane: 'visual-catalog', search: '?q=moon' } });
    });

    it('opens the affect section of Settings at the Emotions path', () => {
        expect(ROUTE_ALIASES.emotions).toBe('settings');
        expect(ROUTE_PANES.emotions).toBe('affect');
        expect(routeFromPath('/emotions')).toEqual({ id: 'settings', data: { pane: 'affect' } });
        expect(pathForRoute('settings')).toBe('/settings');
        expect(routeFromPath('/settings')).toEqual({ id: 'settings', data: {} });
    });

    it('carries chapel data', () => {
        const path = pathForRoute('library', { pane: 'chapel', bookId: 'genesis', chapter: 1 });
        expect(path).toBe('/library/chapel/genesis/1');
        expect(routeFromPath(path)).toEqual({ id: 'library', data: { pane: 'chapel', bookId: 'genesis', chapter: 1 } });
        expect(routeFromPath('/library/chapel')).toEqual({ id: 'library', data: { pane: 'chapel' } });
        expect(routeFromPath('/library/chapel/genesis/x')).toBeNull();
    });

    it('keeps the public paths exactly as they were', () => {
        expect(routeFromPath('/try-rise')).toEqual({ id: 'library', data: { pane: 'keystones' } });
        expect(routeFromPath('/keystone/meditations'))
            .toEqual({ id: 'library', data: { pane: 'keystones', slug: 'meditations' } });
        expect(pathForRoute('library', { pane: 'keystones', slug: 'meditations' })).toBe('/try-rise');
        expect(pathForRoute('read', { pane: 'live' })).toBe('/live');
        expect(routeFromPath('/live', '?provider=openai')).toEqual({ id: 'read', data: { pane: 'live' } });
        expect(pathForRoute('make', { pane: 'visual-lab' })).toBe('/visual-lab');
        expect(pathForRoute('make', { pane: 'visual-catalog' })).toBe('/visual-catalog');
        expect(pathForRoute('settings', { pane: 'affect' })).toBe('/emotions');
        expect(routeFromPath('/night-drive').data).toEqual({ demoMode: true });
    });

    it('opens the arena, one case, and one of the four deciders on Home, at their own addresses', () => {
        for (const path of ['/arena', '/arena/quiet-evening', ...['openai', 'jev', 'kev', 'rules'].map(id => `/arena/quiet-evening/${id}`)]) {
            expect(routeFromPath(path)).toEqual({ id: 'home', data: { demoMode: true } });
            expect(addressIsOwnTo('home', path)).toBe(true);
        }
        expect(routeFromPath('/arena/quiet-evening/claude')).toBeNull();
        expect(routeFromPath('/arena/quiet-evening/jev/more')).toBeNull();
    });

    it('leaves /today to the app, which opens today\'s poem in the reader rather than a room', () => {
        expect(routeFromPath('/today')).toBeNull();
        expect(routeFromPath('/library/today')).toBeNull();
    });

    it('fixes the new paths', () => {
        expect(pathForRoute('read')).toBe('/read');
        expect(pathForRoute('read', { pane: 'setup' })).toBe('/read');
        expect(routeFromPath('/read')).toEqual({ id: 'read', data: { pane: 'setup' } });
        expect(pathForRoute('read', { pane: 'chamber' })).toBe('/read/session');
        expect(routeFromPath('/read/session')).toEqual({ id: 'read', data: { pane: 'chamber' } });
        expect(pathForRoute('make', { pane: 'vault' })).toBe('/make/vault');
        expect(pathForRoute('settings')).toBe('/settings');
    });

    it('round-trips query data and ignores transient data', () => {
        const catalog = pathForRoute('make', { pane: 'visual-catalog', search: '?q=moon' });
        expect(catalog).toBe('/visual-catalog?q=moon');
        expect(routeFromPath('/visual-catalog', '?q=moon').data).toEqual({ pane: 'visual-catalog', search: '?q=moon' });
        expect(pathForRoute('make', { pane: 'vault', section: 'blueprints' })).toBe('/make/vault?section=blueprints');
        expect(routeFromPath('/make/vault', '?section=blueprints').data).toEqual({ pane: 'vault', section: 'blueprints' });
        expect(pathForRoute('library', { pane: 'rosary', setId: 'joyful', door: true })).toBe('/library/rosary?set=joyful');
        expect(routeFromPath('/library/rosary', '?set=joyful&icon=pieta').data)
            .toEqual({ pane: 'rosary', setId: 'joyful', iconId: 'pieta' });
        expect(pathForRoute('read', { pane: 'chamber', session: { atoms: [1, 2, 3] } })).toBe('/read/session');
    });

    it('lets a reading keep the public address it was opened from', () => {
        const read = publicPath => pathForRoute('read', { pane: 'chamber', session: { publicPath } });
        expect(read('/keystone/meditations')).toBe('/keystone/meditations');
        expect(read('/p/some-sequence')).toBe('/p/some-sequence');
        expect(read('/live')).toBe('/live');
        expect(read('//evil.example')).toBe('/read/session');
    });

    it('tolerates trailing slashes and refuses bad escapes', () => {
        expect(routeFromPath('/library/').id).toBe('library');
        expect(routeFromPath('/keystone/%E0%A4%A')).toBeNull();
    });

    it('returns null for an unknown path or id', () => {
        expect(routeFromPath('/nothing/here')).toBeNull();
        expect(routeFromPath('/library/chapel/a/1/extra')).toBeNull();
        expect(pathForRoute('no-such-room')).toBeNull();
    });
});
