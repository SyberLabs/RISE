import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Create } from './Create.js';
import { MemoryCore } from '../core/memory.js';
import { createPersonalProject, serializePersonalProject } from '../core/personal-project.js';
const piece = { title: '<img src=x onerror=alert(1)>', paragraphs: ['A quiet word. '.repeat(20).trim(), 'Another moment. '.repeat(20).trim()], writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' };
let container;
beforeEach(() => { localStorage.clear(); container = document.createElement('div'); document.body.replaceChildren(container); });
afterEach(() => vi.restoreAllMocks());
const fill = (name, value) => { container.querySelector(`[name="${name}"]`).value = value; };
describe('Create', () => {
  it('does not erase a new thought typed while the previous one is being written', async () => {
    let resolve;
    const view = new Create(container, { request: () => new Promise(r => { resolve = r; }) });
    fill('thought', 'first'); const pending = view.generate(false);
    fill('thought', 'next thought'); resolve(piece); await pending;
    expect(container.querySelector('[name="thought"]').value).toBe('next thought');
  });
  it('shows all text as strings without autoplay, keeps before Start, and preserves text on media failure', async () => {
    const onCreateSession = vi.fn().mockResolvedValue(false);
    const view = new Create(container, { request: vi.fn().mockResolvedValue(piece), onCreateSession });
    fill('thought', 'PRIVATE'); fill('detail', 'PRIVATE DETAIL');
    await view.generate(false);
    expect(container.querySelector('[data-title]').textContent).toBe(piece.title);
    expect(container.querySelector('img')).toBeNull();
    expect(onCreateSession).not.toHaveBeenCalled();
    expect(container.querySelector('[data-text]').textContent).toContain(piece.paragraphs[1]);
    await view.act('keep');
    expect(localStorage.getItem('rise_workshop_v1')).not.toContain('PRIVATE');
    await view.act('start');
    expect(onCreateSession).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-draft]').hidden).toBe(false);
    expect(container.querySelector('[data-status]').textContent).toMatch(/full text/);
  });
  it.each(['cancel','navigation'])('ignores late responses after %s even when transport ignores abort', async reason => {
    let resolve;
    const request = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue({ ...piece, title: 'New' });
    const view = new Create(container, { request }); fill('thought', 'a');
    const pending = view.generate(false);
    if (reason === 'cancel') await view.act('cancel');
    else if (reason === 'navigation') view.navigationIntent();
    resolve(piece); await pending;
    expect(view.draft).toBeUndefined();
  });
  it('keeps one writer attempt alive through duplicate submit, Copy, and Keep', async () => {
    let resolve, signal;
    const request = vi.fn((_input, options) => { signal = options.signal; return new Promise(r => { resolve = r; }); });
    const view = new Create(container, { request }); view.setDraft(createPersonalProject(piece));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } });
    fill('instruction', 'A new title');
    const pending = view.generate(true);
    expect(container.querySelector('[data-form="revise"] button').disabled).toBe(true);
    await view.generate(true); await view.act('copy'); await view.act('keep');
    expect(request).toHaveBeenCalledTimes(1); expect(signal.aborted).toBe(false);
    resolve({ ...piece, title: 'Revision' }); await pending;
    expect(view.draft.title).toBe('Revision');
    expect(container.querySelector('[data-form="revise"] button').disabled).toBe(false);
  });
  it('warns cancellation may still count and permits a deliberate next request', async () => {
    let resolve;
    const request = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue(piece);
    const view = new Create(container, { request }); fill('thought', 'one');
    const pending = view.generate(false); await view.act('cancel');
    expect(container.querySelector('[data-status]').textContent).toMatch(/attempt.*still count/i);
    await view.generate(false); resolve({ ...piece, title: 'Old' }); await pending;
    expect(view.draft.title).toBe(piece.title);
  });
  it('does not put a kept, unrelated Vault composition into revision history', () => {
    const view = new Create(container); const a = createPersonalProject(piece); const b = createPersonalProject(piece);
    MemoryCore.saveWorkshopBlueprint(a);
    view.setDraft(a); view.update({ project: b });
    expect(view.history).toEqual([]);
  });
  it.each(['a new piece', 'a Vault revision'])('keeps an unkept paid draft recoverable when %s replaces it', async source => {
    const view = new Create(container, { request: vi.fn().mockResolvedValue({ ...piece, title: 'Second' }) });
    const first = createPersonalProject(piece); view.setDraft(first);
    if (source === 'a new piece') { fill('thought', 'another'); await view.generate(false); }
    else { const kept = createPersonalProject(piece); MemoryCore.saveWorkshopBlueprint(kept); view.update({ project: kept }); }
    expect(view.draft).not.toBe(first);
    expect(container.dataset.unkept).toBe('true');
    await view.act('previous'); expect(view.draft).toBe(first);
  });
  it('restores unsaved parent, never saves implicitly, and preserves parent on storage failure', async () => {
    const request = vi.fn().mockResolvedValueOnce(piece).mockResolvedValueOnce({ ...piece, title: 'Revision' });
    const view = new Create(container, { request }); fill('thought', 'a'); await view.generate(false);
    const parent = view.draft;
    fill('instruction', 'Change title'); await view.generate(true);
    expect(request.mock.calls[1][0]).toMatchObject({ mode: 'revise', parent: { title: parent.title }, instruction: 'Change title' });
    expect(view.draft.provenance.parentRevisionId).toBe(parent.id);
    expect(localStorage.getItem('rise_workshop_v1')).toBeNull();
    vi.spyOn(MemoryCore, 'saveWorkshopBlueprintAsync').mockRejectedValue(new Error('Storage full'));
    await view.act('keep');
    expect(container.querySelector('[data-status]').textContent).toMatch(/copy or export/);
    expect(view.history[0]).toBe(parent);
    await view.act('previous'); expect(view.draft).toBe(parent);
    expect(container.querySelector('[data-title]').textContent).toBe(parent.title);
  });
  it('bounds import before file read and refuses collisions before changing the draft', async () => {
    const view = new Create(container);
    const text = vi.fn(); await view.importFile({ size: 65537, text }); expect(text).not.toHaveBeenCalled();
    const p = createPersonalProject(piece); MemoryCore.saveWorkshopBlueprint(p);
    const changed = JSON.parse(serializePersonalProject(p)); changed.updatedAt++;
    await view.importFile({ size: 1000, text: async () => JSON.stringify(changed) });
    expect(view.draft).toBeUndefined();
    expect(container.querySelector('[data-status]').textContent).toMatch(/different content/);
    await view.importFile({ size: 1000, text: async () => serializePersonalProject(p) });
    expect(view.draft).toEqual(p);
  });
});
