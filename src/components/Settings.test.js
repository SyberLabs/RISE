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
