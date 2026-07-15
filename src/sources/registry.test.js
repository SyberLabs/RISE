import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceProvider } from './provider.js';
import { SourceRegistry } from './registry.js';

class TestProvider extends SourceProvider {
    constructor(id, initialize) {
        super({ id, name: id, contentType: 'text' });
        this.initialize = initialize;
    }

    async _doInit() {
        await this.initialize();
    }
}

describe('SourceRegistry initialization contract', () => {
    const ids = [];

    afterEach(() => {
        ids.forEach(id => SourceRegistry.unregister(id));
        ids.length = 0;
        vi.restoreAllMocks();
    });

    it('returns a stable status without reinitializing ready providers', async () => {
        const initialize = vi.fn().mockResolvedValue(undefined);
        const id = `test-${crypto.randomUUID()}`;
        ids.push(id);
        SourceRegistry.register(new TestProvider(id, initialize));

        const first = await SourceRegistry.initAll();
        const second = await SourceRegistry.initAll();

        expect(initialize).toHaveBeenCalledTimes(1);
        expect(first.failures).toEqual([]);
        expect(second.ready.some(provider => provider.id === id)).toBe(true);
    });
});
