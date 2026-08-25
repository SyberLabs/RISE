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

    it('keeps Size on S | M | L | Fit chips and drops the 0–2 slider', () => {
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
            ['fit', 'fit', 'Fit']
        ]);
        expect(radios.find((radio) => radio.value === 'medium').checked).toBe(true);
        expect(container.querySelector('#font-size-hint')?.hidden).toBe(true);

        radios.find((radio) => radio.value === 'large').click();
        expect(onChange).toHaveBeenCalledWith('fontSize', 'large');

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

        expect(ids).toEqual(['literary', 'display', 'thick', 'jp']);
        expect(radios.map((radio) => radio.closest('label')?.textContent.replace(/\s+/g, ' ').trim()))
            .toEqual(['Literary', 'Display', 'Thick', 'Japanese']);
        expect(radios.find((radio) => radio.value === 'literary').checked).toBe(true);
        expect(container.textContent).not.toMatch(/Inter|JetBrains/);
        expect(container.textContent).not.toMatch(/Crimson Pro|Marcellus|Space Grotesk|Noto Serif/);
        expect(container.querySelector('#chamber-face-fail')?.textContent.trim())
            .toBe('Face did not take.');
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

    it('places Accent after Face/Size with the eleven chrome chips and fail copy', () => {
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
            ['ivory', 'Ivory'],
            ['purple', 'Amethyst'],
            ['cobalt', 'Cobalt'],
            ['amber', 'Amber'],
            ['sunset', 'Sunset'],
            ['gecko', 'Jade'],
            ['garnet', 'Garnet'],
            ['teal', 'Teal'],
            ['orchid', 'Orchid']
        ]);
        expect(radios.find((radio) => radio.value === 'default').checked).toBe(true);
        expect(container.querySelector('#chamber-accent-fail')?.textContent.trim())
            .toBe('Accent did not take.');
        expect(container.querySelector('#chamber-accent-fail')?.hidden).toBe(true);

        radios.find((radio) => radio.value === 'cobalt').click();
        expect(onChange).toHaveBeenCalledWith('chamberAccent', 'cobalt');
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
        expect(css).toMatch(
            /\.settings-control\[aria-labelledby="chamber-accent-label"\]\s*\{[^}]*flex-wrap:\s*wrap/s
        );
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

