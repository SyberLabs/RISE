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
    // the Portal, where a reader arrives on purpose and has nothing running.
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
            'input[name="chamber-accent"]',
            '[data-setting="chamberMask"]',
            '[data-setting="showProgress"]',
            '[data-setting="showArtworkLabels"]',
            '#master-volume',
            '[data-setting="photosensitivityMode"]',
            '[data-setting="reducedMotion"]'
        ]) expect(container.querySelector(kept), kept).toBeTruthy();
        session.destroy();
    });

    it('keeps the full panel in the Portal, where nothing is running', () => {
        const { container, settings } = mountSettings();
        for (const kept of [
            '[data-setting="enableAmbient"]',
            '[data-action="export-data"]',
            '[data-action="clear-history"]',
            '.settings-about'
        ]) expect(container.querySelector(kept), kept).toBeTruthy();
        settings.destroy();
    });

    it('keeps Size on S | M | L | XL | Fit chips and drops the 0–2 slider', () => {
        const { container, settings, onChange } = mountSettings({ fontSize: 'medium' });
        const radios = [...container.querySelectorAll('input[name="font-size"]')];

        expect(container.querySelector('#font-size')).toBeNull();
        expect(radios.map((radio) => [
            radio.dataset.fontSize,
            radio.value,
            radio.closest('label')?.textContent.replace(/\s+/g, ' ').trim()
        ])).toEqual([
            ['s', 'small', 'S'],
            ['m', 'medium', 'M'],
            ['l', 'large', 'L'],
            ['xl', 'xlarge', 'XL'],
            ['fit', 'fit', 'Fit']
        ]);
        expect(radios.find((radio) => radio.value === 'medium').checked).toBe(true);
        expect(container.querySelector('#font-size-hint')?.hidden).toBe(true);

        radios.find((radio) => radio.value === 'large').click();
        expect(onChange).toHaveBeenCalledWith('fontSize', 'large');

        radios.find((radio) => radio.value === 'xlarge').click();
        expect(onChange).toHaveBeenCalledWith('fontSize', 'xlarge');

        radios.find((radio) => radio.value === 'fit').click();
        expect(onChange).toHaveBeenCalledWith('fontSize', 'fit');
        expect(container.querySelector('#font-size-hint')?.hidden).toBe(false);
        expect(container.querySelector('#font-size-hint')?.textContent)
            .toMatch(/Fit waits for the chamber|Words fill the chamber/);

        const forged = radios.find((radio) => radio.value === 'large');
        forged.value = 'huge';
        forged.checked = true;
        forged.dispatchEvent(new Event('change'));
        expect(onChange).not.toHaveBeenCalledWith('fontSize', 'huge');

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

    it('places Accent after Face/Size with the four offered chips and fail copy', () => {
        const { container, settings, onChange } = mountSettings();
        const radios = [...container.querySelectorAll('input[name="chamber-accent"]')];
        const faceRow = container.querySelector('#chamber-face-label')?.closest('.settings-row');
        const sizeRow = container.querySelector('#font-size-label')?.closest('.settings-row');
        const accentRow = container.querySelector('#chamber-accent-label')?.closest('.settings-row');

        expect(container.querySelector('#chamber-accent-label')?.textContent.trim()).toBe('Accent');
        expect(faceRow.compareDocumentPosition(accentRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(sizeRow.compareDocumentPosition(accentRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(radios.map((radio) => [
            radio.value,
            radio.closest('label')?.textContent.replace(/\s+/g, ' ').trim()
        ])).toEqual([
            ['default', 'Default'],
            ['slate', 'Slate'],
            ['amber', 'Amber'],
            ['gecko', 'Jade']
        ]);
        expect(radios.find((radio) => radio.value === 'default').checked).toBe(true);
        expect(container.querySelector('#chamber-accent-fail')?.textContent.trim())
            .toBe('Accent did not take.');
        expect(container.querySelector('#chamber-accent-fail')?.hidden).toBe(true);

        radios.find((radio) => radio.value === 'amber').click();
        expect(onChange).toHaveBeenCalledWith('chamberAccent', 'amber');
        expect(radios.every((radio) => radio.closest('[role="radiogroup"]')
            === radios[0].closest('[role="radiogroup"]'))).toBe(true);
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

    it('keeps a stored accent that is no longer offered visible and chosen', () => {
        const { container, settings } = mountSettings({ chamberAccent: 'cobalt' });
        const radios = [...container.querySelectorAll('input[name="chamber-accent"]')];

        expect(radios.map((radio) => radio.value)).toEqual(['default', 'slate', 'cobalt', 'amber', 'gecko']);
        expect(radios.find((radio) => radio.value === 'cobalt').checked).toBe(true);
        settings.destroy();
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

    it('coerces an unknown persisted accent to the default and ignores a forged radio value', () => {
        const { container, settings, onChange } = mountSettings({ chamberAccent: 'violet' });
        const radios = [...container.querySelectorAll('input[name="chamber-accent"]')];

        expect(radios.find((radio) => radio.value === 'default').checked).toBe(true);

        const gecko = radios.find((radio) => radio.value === 'gecko');
        gecko.value = 'chartreuse';
        gecko.checked = true;
        gecko.dispatchEvent(new Event('change'));

        expect(onChange).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalledWith('chamberAccent', 'chartreuse');
        settings.destroy();
    });

    it('emits chamberMask as a boolean and defaults the toggle off', () => {
        const { container, settings, onChange } = mountSettings();
        const toggle = container.querySelector('[data-setting="chamberMask"]');

        expect(toggle).toBeTruthy();
        expect(toggle.type).toBe('checkbox');
        expect(toggle.checked).toBe(false);

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
        expect(onChange).toHaveBeenCalledWith('chamberMask', true);
        expect(onChange.mock.calls.every(([, value]) => typeof value === 'boolean')).toBe(true);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
        expect(onChange).toHaveBeenLastCalledWith('chamberMask', false);
        settings.destroy();
    });

    it('returns through onClose when opened from Chamber and still goes Portal from the route', () => {
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
        expect(onNavigate).toHaveBeenCalledWith('portal');
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
        section.scrollIntoView = scroll;
        await settings.update({ pane: 'affect' });
        expect(container.querySelector('[data-affect-toggle]').checked).toBe(true);
        expect(section.hidden).toBe(false);
        expect(section.querySelector('canvas.emotions-field')).not.toBeNull();
        expect(scroll).toHaveBeenCalled();
        settings.destroy();
    });

    it('leaves affect out of the panel opened over a reading', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const settings = new Settings(container, { scope: 'session' });
        expect(container.querySelector('[data-section="affect"]')).toBeNull();
        settings.destroy();
    });
});
