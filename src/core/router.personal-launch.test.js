import { describe, it, expect, vi } from 'vitest';
import { Router } from './router.js';
import { Create } from '../components/Create.js';
import { createPersonalProject } from './personal-project.js';

describe('personal launch navigation ownership', () => {
  it('protects unsaved work on any missing route chunk, and recovers after all work is kept', async () => {
    localStorage.clear(); sessionStorage.clear();
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
    const container = document.createElement('div'); container.id = 'view-create';
    document.body.replaceChildren(container);
    const view = new Create(container);
    view.setDraft(createPersonalProject({ title: 'Draft', paragraphs: ['one two three four '.repeat(12).trim(), 'five six seven eight '.repeat(12).trim()], writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' }));
    const router = new Router(); router.transitionDuration = 0;
    router.registerView('create', { container, init: () => view });
    router.registerView('vault', { container: document.createElement('div'), init: () => { throw new TypeError('Failed to fetch dynamically imported module'); } });
    await router.navigate('create'); await router.navigate('vault');
    expect(reload).not.toHaveBeenCalled();
    expect(container.hidden).toBe(false);
    await view.act('keep'); await router.navigate('vault');
    expect(reload).toHaveBeenCalledOnce();
    router.destroy();
  });
  it('announces queued intent synchronously and prevents stale chamber initialization', async () => {
    const intent = vi.fn();
    const router = new Router({ onNavigationIntent: intent });
    const init = vi.fn();
    const a = document.createElement('main');
    router.registerView('create', { container: a, init: () => ({}) });
    router.registerView('chamber-session', { container: document.createElement('main'), init });
    router.registerView('portal', { container: document.createElement('main'), init: () => ({}) });
    router.fadeIn = vi.fn().mockResolvedValue();
    router.fadeOut = vi.fn().mockResolvedValue();
    await router.navigate('create');
    let release;
    router.fadeOut.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const launch = router.navigate('chamber-session');
    const leave = router.navigate('portal');
    expect(intent).toHaveBeenLastCalledWith('portal', {});
    release();
    expect(await launch).toBe(false);
    expect(await leave).toBe(true);
    expect(init).not.toHaveBeenCalled();
    router.destroy();
  });
});
