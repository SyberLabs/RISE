import { describe, it, expect } from 'vitest';
import { pathForRoute, routeFromPath, ROUTE_ALIASES } from './route-url.js';

describe('route urls', () => {
    it('round-trips every route id', () => {
        for (const id of Object.keys(ROUTE_ALIASES)) {
            const path = pathForRoute(id);
            expect(path.startsWith('/')).toBe(true);
            expect(routeFromPath(path).id).toBe(ROUTE_ALIASES[id]);
        }
    });

    it('carries chapel data', () => {
        const path = pathForRoute('chapel', { bookId: 'genesis', chapter: 1 });
        expect(path).toBe('/library/chapel/genesis/1');
        expect(routeFromPath(path).data).toEqual({ bookId: 'genesis', chapter: 1 });
        expect(routeFromPath('/library/chapel')).toEqual({ id: 'chapel', data: {} });
        expect(routeFromPath('/library/chapel/genesis/x')).toBeNull();
    });

    it('keeps the public paths exactly as they were', () => {
        expect(routeFromPath('/try-rise')).toEqual({ id: 'keystones', data: {} });
        expect(routeFromPath('/keystone/meditations')).toEqual({ id: 'keystones', data: { slug: 'meditations' } });
        expect(pathForRoute('keystones', { slug: 'meditations' })).toBe('/try-rise');
        expect(pathForRoute('keystones')).toBe('/try-rise');
        expect(pathForRoute('live')).toBe('/live');
        expect(pathForRoute('visual-lab')).toBe('/visual-lab');
        expect(pathForRoute('visual-catalog')).toBe('/visual-catalog');
        expect(pathForRoute('emotions')).toBe('/emotions');
        expect(routeFromPath('/night-drive').data).toEqual({ demoMode: true });
    });

    it('gives Today the public path main shipped', () => {
        expect(routeFromPath('/today')).toEqual({ id: 'today', data: {} });
        expect(pathForRoute('today')).toBe('/today');
        expect(routeFromPath('/library/today')).toBeNull();
    });

    it('fixes the new paths', () => {
        expect(pathForRoute('chamber')).toBe('/read');
        expect(pathForRoute('chamber-session')).toBe('/read/session');
        expect(routeFromPath('/read/session')).toEqual({ id: 'chamber-session', data: {} });
        expect(pathForRoute('rosarium')).toBe('/library/rosary');
        expect(pathForRoute('via')).toBe('/library/stations');
        expect(pathForRoute('curia')).toBe('/library/provenance');
        expect(pathForRoute('vault')).toBe('/make/vault');
        expect(pathForRoute('settings')).toBe('/settings');
        expect(routeFromPath('/library/keystones').id).toBe('keystones');
    });

    it('round-trips query data and ignores transient data', () => {
        const catalog = pathForRoute('visual-catalog', { search: '?q=moon' });
        expect(catalog).toBe('/visual-catalog?q=moon');
        expect(routeFromPath('/visual-catalog', '?q=moon').data).toEqual({ search: '?q=moon' });
        expect(pathForRoute('vault', { section: 'blueprints' })).toBe('/make/vault?section=blueprints');
        expect(routeFromPath('/make/vault', '?section=blueprints').data).toEqual({ section: 'blueprints' });
        expect(pathForRoute('rosarium', { setId: 'joyful', door: true })).toBe('/library/rosary?set=joyful');
        expect(pathForRoute('chamber-session', { atoms: [1, 2, 3] })).toBe('/read/session');
    });

    it('lets a reading keep the public address it was opened from', () => {
        expect(pathForRoute('chamber-session', { publicPath: '/keystone/meditations' })).toBe('/keystone/meditations');
        expect(pathForRoute('chamber-session', { publicPath: '//evil.example' })).toBe('/read/session');
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
