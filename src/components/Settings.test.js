import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportUserData } from '../core/user-data.js';
import { Settings } from './Settings.js';

vi.mock('../core/user-data.js', () => ({
    clearUserData: vi.fn(),
    exportUserData: vi.fn()
}));

describe('Settings artwork labels', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    it('renders the persisted toggle and emits changes', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const onChange = vi.fn();
        const settings = new Settings(container, {
            settings: { showArtworkLabels: false },
            onChange
        });

        const toggle = container.querySelector('[data-setting="showArtworkLabels"]');
        expect(toggle.checked).toBe(false);

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
        expect(onChange).toHaveBeenCalledWith('showArtworkLabels', true);
        settings.destroy();
    });

    it('reports a partial personal-data export instead of claiming full success', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const settings = new Settings(container);
        const toast = vi.spyOn(settings, 'showToast');
        vi.mocked(exportUserData).mockResolvedValue({
            exportSummary: { withheldMedia: 2 },
            warnings: ['Two video files were withheld.']
        });
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:export'),
            revokeObjectURL: vi.fn()
        });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await settings.exportData();

        expect(toast).toHaveBeenCalledWith(
            'Data exported with omissions: 2 media files listed but not included'
        );
        expect(toast).not.toHaveBeenCalledWith('Data exported successfully');
        settings.destroy();
    });
});

describe('Settings display type', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    function mountSettings(partial = {}, onChange = vi.fn()) {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const settings = new Settings(container, {
            settings: { fontSize: 'medium', ...partial },
            onChange
        });
        return { container, settings, onChange };
    }

    // THE TWO PANELS ARE NOT THE SAME PANEL. A reading cannot be resumed once
    // abandoned, so the door inside one carries only what can rescue it. What
    // is meaningless there (the LOBBY drone, the About plate) or destructive
    // there (export, and a clear that wipes the session and reloads) stays in
    // Home, where a reader arrives on purpose and has nothing running.
    it('withholds the between-sessions controls from the in-session panel', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const session = new Settings(container, {
            scope: 'session', settings: { fontSize: 'medium' }, onChange: vi.fn()
        });

        for (const gone of [
            '[data-setting="enableAmbient"]',
            '[data-action="export-data"]',
            '[data-action="clear-history"]',
            '.settings-about'
        ]) expect(container.querySelector(gone), gone).toBeNull();
        expect(container.textContent).not.toContain('Lobby drone');

        // Everything that can rescue a reading in progress is still here.
        for (const kept of [
            'input[name="font-size"]',
            'input[name="chamber-face"]',
            '[data-setting="livingText"]',
            '[data-setting="showProgress"]',
            '[data-setting="showArtworkLabels"]',
            '#master-volume',
            '[data-setting="photosensitivityMode"]',
            '[data-setting="reducedMotion"]'
        ]) expect(container.querySelector(kept), kept).toBeTruthy();
        session.destroy();
    });

    it('keeps the full panel in Home, where nothing is running', () => {
        const { container, settings } = mountSettings();
        for (const kept of [
            '[data-action="export-data"]',
            '[data-action="clear-history"]',
            '.settings-about'
        ]) expect(container.querySelector(kept), kept).toBeTruthy();
        settings.destroy();
    });

    it('offers S, M and L in both panels, and keeps a saved XL or Fit shown and chosen until another is picked', () => {
        for (const scope of [undefined, 'session']) {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const onChange = vi.fn();
            const panel = new Settings(container, { scope, settings: { fontSize: 'medium' }, onChange });
            const radios = [...container.querySelectorAll('input[name="font-size"]')];
            expect(radios.map(radio => [radio.value, radio.closest('label')?.textContent.trim()]), String(scope))
                .toEqual([['small', 'S'], ['medium', 'M'], ['large', 'L']]);
            expect(radios.find(radio => radio.value === 'medium').checked).toBe(true);
            radios.find(radio => radio.value === 'large').click();
            expect(onChange).toHaveBeenCalledWith('fontSize', 'large');
            const forged = radios.find(radio => radio.value === 'small');
            forged.value = 'huge';
            forged.checked = true;
            forged.dispatchEvent(new Event('change'));
            expect(onChange).not.toHaveBeenCalledWith('fontSize', 'huge');
            panel.destroy();
            container.remove();
        }
        for (const saved of ['xlarge', 'fit']) {
            const { container, settings } = mountSettings({ fontSize: saved });
            const radios = [...container.querySelectorAll('input[name="font-size"]')];
            expect(radios.map(radio => radio.value), saved).toEqual(['small', 'medium', 'large', saved]);
            expect(radios.find(radio => radio.value === saved).checked).toBe(true);
            settings.destroy();
        }
    });

    it('holds Living Text, on unless the reader turns it off, for every reading', () => {
        const { container, settings, onChange } = mountSettings();
        const toggle = container.querySelector('[data-setting="livingText"]');
        expect(toggle.checked).toBe(true);
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
        expect(onChange).toHaveBeenCalledWith('livingText', false);
        settings.destroy();
        const off = mountSettings({ livingText: false });
        expect(off.container.querySelector('[data-setting="livingText"]').checked).toBe(false);
        off.settings.destroy();
    });

    it('offers no imagery-through-words switch and no lobby drone: Inlay does the one, and the other is gone', () => {
        const { container, settings } = mountSettings();
        expect(container.querySelector('[data-setting="chamberMask"]')).toBeNull();
        expect(container.querySelector('[data-setting="enableAmbient"]')).toBeNull();
        expect(container.textContent).not.toMatch(/imagery through words|Ambient sound|Lobby drone/u);
        settings.destroy();
    });

    it('emits only allowlisted Chamber face ids and defaults to literary', () => {
        const { container, settings, onChange } = mountSettings();
        const radios = [...container.querySelectorAll('input[name="chamber-face"]')];
        const ids = radios.map((radio) => radio.value);

        expect(ids).toEqual(['literary', 'display', 'thick', 'mono', 'jp', 'sans', 'book']);
        expect(radios.map((radio) => radio.closest('label')?.textContent.replace(/\s+/g, ' ').trim()))
            .toEqual(['Literary', 'Display', 'Thick', 'Monospace', 'Japanese', 'Sans', 'Book']);
        expect(radios.find((radio) => radio.value === 'literary').checked).toBe(true);
        expect(container.textContent).not.toMatch(/Inter|JetBrains/);
        expect(container.textContent).not.toMatch(/Crimson Pro|Marcellus|Space Grotesk|Noto Serif/);
        expect(container.querySelector('#chamber-face-fail')?.textContent.trim())
            .toBe('Typeface did not take.');
        expect(container.querySelector('#chamber-face-fail')?.hidden).toBe(true);

        radios.find((radio) => radio.value === 'thick').click();
        expect(onChange).toHaveBeenCalledWith('chamberFace', 'thick');
        settings.destroy();
    });

    it('coerces an unknown persisted face to literary and ignores a forged radio value', () => {
        const { container, settings, onChange } = mountSettings({ chamberFace: 'papyrus' });
        const radios = [...container.querySelectorAll('input[name="chamber-face"]')];

        expect(radios.find((radio) => radio.value === 'literary').checked).toBe(true);
        expect(radios.every((radio) => radio.checked ? radio.value === 'literary' : true)).toBe(true);

        const thick = radios.find((radio) => radio.value === 'thick');
        thick.value = 'comic-sans';
        thick.checked = true;
        thick.dispatchEvent(new Event('change'));

        expect(onChange).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalledWith('chamberFace', 'comic-sans');
        settings.destroy();
    });

    it('offers no accent: the reading’s theme is the only colour a reader sees', () => {
        const { container, settings } = mountSettings();
        expect(container.querySelector('input[name="chamber-accent"]')).toBeNull();
        expect(container.querySelector('#chamber-accent-label')).toBeNull();
        expect(container.querySelector('#chamber-accent-fail')).toBeNull();
        expect(container.textContent).not.toMatch(/\bAccent\b/u);
        settings.destroy();
    });

    it('scrolls the existing Settings panel on a short phone', () => {
        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), 'Settings.css'),
            'utf8'
        );
        const rule = css.match(/^\.settings\s*\{[^}]+\}/m)?.[0];
        expect(rule).toMatch(/overflow-y:\s*auto/);
        expect(rule).toMatch(/-webkit-overflow-scrolling:\s*touch/);
        expect(rule).toMatch(/height:\s*100(?:vh|dvh)/);
        // Chip groups have to wrap rather than run off a phone. They
        // wrap as every chip group does now — Size and Face included — so the
        // rule is asserted where all three read it from.
        expect(css).toMatch(
            /\.settings-control\[role="radiogroup"\]\s*\{[^}]*flex-wrap:\s*wrap/s
        );
    });

    it('shows the destructive action as a plain secondary button, sentence case', () => {
        const { container, settings } = mountSettings();
        const clear = container.querySelector('[data-action="clear-history"]');

        expect(clear.classList.contains('btn-secondary')).toBe(true);
        expect(clear.textContent.trim()).toBe('Clear data');
        expect(container.querySelector('main')).toBeTruthy();
        expect(container.querySelector('[role="main"]')).toBeNull();
        expect(container.querySelector('[data-setting="enableBinaural"]')).toBeNull();
        settings.destroy();
    });

    it('returns through onClose when opened from Chamber and still goes Home from the route', () => {
        const overlay = document.createElement('div');
        document.body.appendChild(overlay);
        const onClose = vi.fn();
        const overlayNavigate = vi.fn();
        const overlaySettings = new Settings(overlay, {
            onClose,
            onNavigate: overlayNavigate
        });

        overlay.querySelector('[data-action="back"]').click();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(overlayNavigate).not.toHaveBeenCalled();
        expect(overlay.querySelector('[data-action="back"]').textContent).not.toMatch(/Portal/);
        expect(overlay.querySelector('[data-action="back"]').getAttribute('aria-label')).not.toMatch(/Portal/i);
        overlaySettings.destroy();

        const route = document.createElement('div');
        document.body.appendChild(route);
        const onNavigate = vi.fn();
        const portalSettings = new Settings(route, { onNavigate });
        route.querySelector('[data-action="back"]').click();
        expect(onNavigate).toHaveBeenCalledWith('home');
        portalSettings.destroy();
    });
});


describe('Settings affect section', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('mounts the Emotions map below its toggle when the toggle is turned on, and removes it when off', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const settings = new Settings(container);
        const section = container.querySelector('[data-section="affect"]');
        expect(section.hidden).toBe(true);
        expect(section.querySelector('.emotions')).toBeNull();

        const toggle = container.querySelector('[data-affect-toggle]');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(section.querySelector('canvas.emotions-field')).not.toBeNull());
        expect(section.hidden).toBe(false);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
        expect(section.hidden).toBe(true);
        expect(section.querySelector('.emotions')).toBeNull();
        settings.destroy();
    });

    it('opens the affect section when the router names it', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const settings = new Settings(container);
        const section = container.querySelector('[data-section="affect"]');
        const scroll = vi.fn();
        section.closest('.settings-section').scrollIntoView = scroll;
        await settings.update({ pane: 'affect' });
        expect(container.querySelector('[data-affect-toggle]').checked).toBe(true);
        expect(section.hidden).toBe(false);
        expect(section.querySelector('canvas.emotions-field')).not.toBeNull();
        expect(scroll).toHaveBeenCalled();
        settings.destroy();
    });

    it('waits until the room is shown to scroll to the affect section', async () => {
        const container = document.createElement('div');
        container.hidden = true;
        document.body.appendChild(container);
        const settings = new Settings(container);
        const section = container.querySelector('[data-section="affect"]');
        const scroll = vi.fn();
        section.closest('.settings-section').scrollIntoView = scroll;
        await settings.update({ pane: 'affect' });
        expect(scroll).not.toHaveBeenCalled();
        container.hidden = false;
        settings.activate();
        expect(scroll).toHaveBeenCalledTimes(1);
        settings.destroy();
    });

    it('stops the Emotions animation when Settings is left, and brings it back on return', async () => {
        // A stub that keeps the browser's promise: a cancelled frame never runs.
        const frames = new Map();
        let next = 0;
        vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.set(++next, callback); return next; }));
        vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const settings = new Settings(container);
        settings.activate();
        await settings.update({ pane: 'affect' });
        expect(frames.size).toBeGreaterThan(0);

        settings.deactivate();
        const scheduled = requestAnimationFrame.mock.calls.length;
        const pending = [...frames.values()];
        frames.clear();
        for (const frame of pending) frame(16);
        expect(requestAnimationFrame.mock.calls.length).toBe(scheduled);
        expect(container.querySelector('[data-section="affect"] .emotions')).toBeNull();

        settings.activate();
        await vi.waitFor(() => expect(container.querySelector('[data-section="affect"] canvas.emotions-field')).not.toBeNull());
        settings.destroy();
        vi.unstubAllGlobals();
    });

    it('opens the affect section in place when the router moves from Settings to Emotions', async () => {
        document.body.innerHTML = '<main id="settings-view"></main>';
        const { Router } = await import('../core/router.js');
        const router = new Router({ history: { pushState: vi.fn(), replaceState: vi.fn() } });
        router.transitionDuration = 0;
        const made = [];
        router.registerView('settings', {
            container: document.querySelector('#settings-view'),
            init: (el, data) => { const room = new Settings(el); made.push(room); return room.update(data).then(() => room); }
        });
        await router.navigate('settings');
        const update = vi.spyOn(made[0], 'update');
        await router.navigate('emotions');
        expect(made).toHaveLength(1);
        expect(update).toHaveBeenCalledWith({ pane: 'affect' });
        expect(document.querySelector('[data-affect-toggle]').checked).toBe(true);
        made[0].destroy();
        router.destroy();
    });

    it('leaves affect out of the panel opened over a reading', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const settings = new Settings(container, { scope: 'session' });
        expect(container.querySelector('[data-section="affect"]')).toBeNull();
        settings.destroy();
    });
});

describe('Settings Plus voice', () => {
    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    const mount = (settings = {}) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        return new Settings(container, { settings, onChange: vi.fn() });
    };

    it('offers the payment link until Plus is claimed in this browser', () => {
        const settings = mount();
        const link = settings.container.querySelector('a[href^="https://buy.stripe.com/"]');
        expect(link).toBeTruthy();
        expect(settings.container.textContent).toContain('$8.99 a month');
        expect(settings.container.querySelector('[data-setting="plusVoice"]')).toBeNull();
        expect(settings.container.querySelector('.settings-fail[hidden]')).toBeTruthy();
        settings.destroy();
    });

    it('shows the switch, on by default, and forgets the claim on request', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetchImpl);
        const settings = mount();
        const toggle = settings.container.querySelector('[data-setting="plusVoice"]');
        expect(toggle.checked).toBe(true);
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
        expect(settings.onChange).toHaveBeenCalledWith('plusVoice', false);

        await settings.forgetPlus();
        expect(fetchImpl).toHaveBeenCalledWith('/api/plus/forget', { method: 'POST' });
        expect(localStorage.getItem('rise.plus')).toBeNull();
        expect(settings.container.querySelector('[data-setting="plusVoice"]')).toBeNull();
        expect(settings.container.querySelector('a[href^="https://buy.stripe.com/"]')).toBeTruthy();
        settings.destroy();
    });

    it('says when the Worker reported a lapse', () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1, lapsed: true }));
        const settings = mount();
        const fail = settings.container.querySelector('.settings-fail:not([hidden])');
        expect(fail?.textContent).toBe('Plus voice has lapsed.');
        expect(settings.container.querySelector('[data-setting="plusVoice"]')).toBeNull();
        settings.destroy();
    });
});
