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

    it('keeps the font-size slider on small / medium / large', () => {
        const { container, settings, onChange } = mountSettings({ fontSize: 'medium' });
        const slider = container.querySelector('#font-size');
        const value = container.querySelector('#font-size-value');

        expect(slider.value).toBe('1');
        expect(value.textContent.trim()).toBe('medium');

        slider.value = '0';
        slider.dispatchEvent(new Event('input'));
        expect(onChange).toHaveBeenCalledWith('fontSize', 'small');
        expect(value.textContent.trim()).toBe('small');

        slider.value = '2';
        slider.dispatchEvent(new Event('input'));
        expect(onChange).toHaveBeenCalledWith('fontSize', 'large');
        expect(value.textContent.trim()).toBe('large');

        expect(onChange.mock.calls.every(([key]) => key === 'fontSize')).toBe(true);
        settings.destroy();
    });

    it('emits only allowlisted Chamber face ids and defaults to literary', () => {
        const { container, settings, onChange } = mountSettings();
        const radios = [...container.querySelectorAll('input[name="chamber-face"]')];
        const ids = radios.map((radio) => radio.value);

        expect(ids).toEqual(['literary', 'display', 'thick', 'jp']);
        expect(radios.find((radio) => radio.value === 'literary').checked).toBe(true);
        expect(container.textContent).not.toMatch(/Inter|JetBrains/);

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
});

