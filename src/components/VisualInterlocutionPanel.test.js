/**
 * Regression tests for preset visibility in the Visual Settings panel.
 *
 * A SOL sequence (or archetype) launches with a visualConfig preset; the
 * panel must render that preset visibly and modifiably — and must not
 * wipe it back to defaults on the first user interaction.
 */
import { describe, it, expect, vi } from 'vitest';
import { VisualInterlocutionPanel } from './VisualInterlocutionPanel.js';
import { WIKIMEDIA_CATEGORIES } from '../sources/visual/wikimedia.js';
import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { MemoryCore } from '../core/memory.js';
import { endVisualInterlocutionSession } from '../core/visual-safety.js';

// SOL Dawn's visual preset, as it arrives via `...visualConfig` spread
// SOL's dawn preset once sourced the searched 'solar' category. That
// family is retired (SOURCE-CURATION-SPEC) and the sequence now reads
// with the Light Field, so the fixture carries a collection that still
// exists — the invariant under test is that a NESTED preset survives
// construction and is visible in the UI, not which category it names.
const SOL_DAWN_CONFIG = {
    visualMode: 'interlocution',
    interlocution: { frequency: 0.2, duration: 120, sourced: ['aic-landscapes'], procedural: [] }
};

function makePanel(options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const panel = new VisualInterlocutionPanel(container, { expanded: true, ...options });
    return { panel, container };
}

describe('Chapel collection editing in the panel', () => {
    const CHAPEL_LAUNCH = {
        visualMode: 'interlocution',
        interlocution: {
            sourceFamily: 'collections',
            frequency: 0.12,
            duration: 1600,
            procedural: [],
            sourced: ['chapel-passion', 'chapel-crucifixion'],
            atriumCollections: ['chapel-passion', 'chapel-crucifixion']
        }
    };

    it('renders chapel pills with ✕ and a + orb offering the remaining collections', () => {
        const { container } = makePanel({ ...CHAPEL_LAUNCH, consentScope: 'chapel-test' });
        const chips = [...container.querySelectorAll('.vi-chapel-chip')];
        expect(chips.map(chip => chip.textContent.replace(/✕/g, '').trim()))
            .toEqual(['The Passion', 'The Crucifixion']);
        expect(container.querySelectorAll('[data-chapel-remove]')).toHaveLength(2);

        // The + orb reveals exactly the collections NOT in play
        container.querySelector('[data-action="chapel-add-toggle"]').click();
        const options = [...container.querySelectorAll('[data-chapel-add]')];
        expect(options.map(option => option.dataset.chapelAdd).sort())
            .toEqual(['chapel-nativity', 'chapel-patriarchs', 'chapel-prophets', 'chapel-resurrection', 'dore:all']);
    });

    it('✕ returns a collection to the pool; + draws one in — sourced and pills stay one truth', () => {
        const onChange = vi.fn();
        const { panel, container } = makePanel({ ...CHAPEL_LAUNCH, consentScope: 'chapel-test', onChange });

        container.querySelector('[data-chapel-remove="chapel-crucifixion"]').click();
        let config = panel.getConfig();
        expect(config.interlocution.sourced).toEqual(['chapel-passion']);
        expect(config.interlocution.atriumCollections).toEqual(['chapel-passion']);
        // The removed collection re-enters the + pool
        container.querySelector('[data-action="chapel-add-toggle"]').click();
        expect([...container.querySelectorAll('[data-chapel-add]')].map(option => option.dataset.chapelAdd))
            .toContain('chapel-crucifixion');

        // Add Nativity
        container.querySelector('[data-chapel-add="chapel-nativity"]').click();
        config = panel.getConfig();
        expect(config.interlocution.sourced).toEqual(['chapel-passion', 'chapel-nativity']);
        expect(onChange).toHaveBeenCalled();
    });

    it('the collection tray is closed until + opens it, and [hidden] genuinely hides it', async () => {
        const { container } = makePanel({ ...CHAPEL_LAUNCH, consentScope: 'chapel-test' });
        const menu = container.querySelector('.vi-chapel-add-menu');
        // Closed by default
        expect(menu.hidden).toBe(true);
        // The CSS must carry an explicit [hidden] rule: the tray's own
        // display:flex would otherwise win the cascade over the UA's
        // [hidden] style — the bug that left the tray permanently open.
        const { readFileSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const css = readFileSync(resolve('src/components/VisualInterlocutionPanel.css'), 'utf8');
        expect(css).toMatch(/\.vi-chapel-add-menu\[hidden\]\s*\{[^}]*display:\s*none/);

        // + opens; adding keeps it open for the next add; the orb closes it
        container.querySelector('[data-action="chapel-add-toggle"]').click();
        expect(menu.hidden).toBe(false);
        container.querySelector('[data-chapel-add="chapel-nativity"]').click();
        expect(container.querySelector('.vi-chapel-add-menu').hidden).toBe(false);
        container.querySelector('[data-action="chapel-add-toggle"]').click();
        expect(container.querySelector('.vi-chapel-add-menu').hidden).toBe(true);
    });

    it('the Doré aggregate is tradeable; per-book Doré plates are removable but book-bound', () => {
        // A Gospel launch can draw the whole Doré cycle in
        const { panel, container } = makePanel({ ...CHAPEL_LAUNCH, consentScope: 'chapel-test' });
        container.querySelector('[data-action="chapel-add-toggle"]').click();
        const pool = [...container.querySelectorAll('[data-chapel-add]')].map(o => o.dataset.chapelAdd);
        expect(pool).toContain('dore:all');
        container.querySelector('[data-chapel-add="dore:all"]').click();
        expect(panel.getConfig().interlocution.sourced).toContain('dore:all');

        // A Doré-native book (Judges): its plates pill is removable…
        const { panel: dore, container: doreC } = makePanel({
            visualMode: 'interlocution',
            consentScope: 'chapel-test',
            interlocution: {
                sourced: ['dore:judges'], procedural: [],
                atriumCollections: ['dore:judges']
            }
        });
        expect(doreC.querySelector('[data-chapel-remove="dore:judges"]')).not.toBeNull();
        // …and while its plates are in play, the aggregate is not offered
        doreC.querySelector('[data-action="chapel-add-toggle"]').click();
        const dorePool = [...doreC.querySelectorAll('[data-chapel-add]')].map(o => o.dataset.chapelAdd);
        expect(dorePool).not.toContain('dore:all');
        // remove the book plates → the aggregate returns to the pool
        doreC.querySelector('[data-chapel-remove="dore:judges"]').click();
        expect(dore.getConfig().interlocution.sourced).toEqual([]);
        doreC.querySelector('[data-action="chapel-add-toggle"]').click();
        expect([...doreC.querySelectorAll('[data-chapel-add]')].map(o => o.dataset.chapelAdd))
            .toContain('dore:all');
    });

    it('non-chapel curated chips stay informational — no ✕, no orb', () => {
        const { container } = makePanel({
            visualMode: 'interlocution',
            consentScope: 'chapel-test',
            interlocution: {
                sourced: ['atr-plato'],
                procedural: [],
                atriumCollections: ['atr-plato']
            }
        });
        expect(container.querySelector('[data-chapel-remove]')).toBeNull();
        expect(container.querySelector('[data-action="chapel-add-toggle"]')).toBeNull();
    });

    it('names the active Chapel icon in the Focals panel instead of appearing unset', () => {
        const { container } = makePanel({
            visualMode: 'focals',
            focals: { type: 'icon', iconId: 'icon-pantocrator-sinai' }
        });
        const active = container.querySelector('.vi-focals-icon-active');
        expect(active).not.toBeNull();
        expect(active.textContent).toContain('Christ Pantocrator · Sinai, 6th c.');
        // A glyph focal shows no icon banner
        const { container: plain } = makePanel({
            visualMode: 'focals',
            focals: { type: 'standard', standardGlyph: 'breath' }
        });
        expect(plain.querySelector('.vi-focals-icon-active')).toBeNull();
    });

    it('releases a Chapel-held focal when leaving Focals, preserving user-owned focals', () => {
        const icon = makePanel({
            visualMode: 'focals',
            focals: { type: 'icon', iconId: 'icon-pantocrator-sinai' }
        });
        icon.panel.hasConsent = true;
        icon.container.querySelector('[data-visual-mode="interlocution"]').click();
        expect(icon.panel.getConfig()).toMatchObject({
            visualMode: 'interlocution',
            focals: { type: 'standard', iconId: null }
        });

        const personal = makePanel({
            visualMode: 'focals',
            focals: { type: 'personal', personalImage: 'data:image/png;base64,AAAA' }
        });
        personal.panel.setVisualMode('interlocution');
        expect(personal.panel.getConfig().focals).toMatchObject({
            type: 'personal',
            personalImage: 'data:image/png;base64,AAAA'
        });
    });
});


/**
 * Grant the flash consent a reader would already hold.
 *
 * The notice now belongs to the PRESENTATION, not the mode: Rhythmic
 * opens on Gallery and never flashes, so nothing is asked until behind
 * stream or full frame is chosen. Tests about what those surfaces do
 * afterwards should not each re-enact the prompt.
 */
async function grantFlashConsent(container, presentation = 'behind-stream') {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="photosensitivity-modal" class="hidden">
        <button id="safety-cancel">Cancel</button>
        <button id="safety-accept">Accept</button>
      </div>
    `);
    container.querySelector(`[data-presentation="${presentation}"]`).click();
    document.querySelector('#safety-accept').click();
    await Promise.resolve();
    await Promise.resolve();
}

describe('VisualInterlocutionPanel preset visibility', () => {
    it('asks at the flash surface, not at the mode', async () => {
        endVisualInterlocutionSession();
        document.body.insertAdjacentHTML('beforeend', `
          <div id="photosensitivity-modal" class="hidden">
            <button id="safety-cancel">Cancel</button>
            <button id="safety-accept">Accept</button>
          </div>
        `);
        const onChange = vi.fn();
        const { panel, container } = makePanel({
            visualMode: 'off',
            consentScope: 'panel-draft',
            onChange
        });

        // CHOOSING RHYTHMIC ASKS NOTHING. It opens on Gallery, which never
        // flashes; the notice belongs to the surface that does.
        container.querySelector('[data-visual-mode="interlocution"]').click();
        await Promise.resolve();
        expect(document.querySelector('#photosensitivity-modal').classList.contains('hidden')).toBe(true);
        expect(panel.getConfig().visualMode).toBe('interlocution');

        // Declining at the flash surface leaves the reader where they were,
        // never silently switched onto a presence they refused.
        const before = panel.getConfig().interlocution.presentation;
        container.querySelector('[data-presentation="full-frame"]').click();
        document.querySelector('#safety-cancel').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(panel.getConfig().interlocution.presentation).toBe(before);
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ visualMode: 'interlocution' }),
            expect.any(Array)
        );

        panel.destroy();
        container.remove();
        document.querySelector('#photosensitivity-modal')?.remove();
        endVisualInterlocutionSession();
    });

    it('releases a Chapel focal when the reader leaves Focals', async () => {
        endVisualInterlocutionSession();
        document.body.insertAdjacentHTML('beforeend', `
          <div id="photosensitivity-modal" class="hidden">
            <button id="safety-cancel">Cancel</button>
            <button id="safety-accept">Accept</button>
          </div>
        `);
        const onChange = vi.fn();
        const { panel, container } = makePanel({
            visualMode: 'focals',
            consentScope: 'panel-icon-cancel',
            focals: { type: 'icon', iconId: 'icon-pantocrator-sinai' },
            onChange
        });

        // A Chapel-held icon exists only in Focals, and leaving is the
        // explicit release. There is no longer a prompt to cancel the
        // switch with, so the click IS the explicit act.
        container.querySelector('[data-visual-mode="interlocution"]').click();
        await Promise.resolve();

        expect(panel.getConfig().visualMode).toBe('interlocution');
        expect(panel.getConfig().focals?.iconId).toBeFalsy();
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ visualMode: 'interlocution' }),
            expect.any(Array)
        );

        panel.destroy();
        container.remove();
        document.querySelector('#photosensitivity-modal')?.remove();
        endVisualInterlocutionSession();
    });

    it('offers an exact thumbnail subset for the shared Global Pool', () => {
        localStorage.removeItem('rise_global_images_v1');
        MemoryCore.saveGlobalImage('data:image/png;base64,AAAA', { name: 'Alpha' });
        MemoryCore.saveGlobalImage('data:image/png;base64,BBBB', { name: 'Beta' });
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'personal',
                procedural: [],
                sourced: ['global-pool'],
                globalPool: { mode: 'all', assetIds: [] }
            },
            onChange: config => { emitted = config; }
        });

        expect(container.querySelectorAll('[data-global-pool-mode]')).toHaveLength(2);
        expect(container.querySelector('[data-global-pool-mode="all"]').classList.contains('active')).toBe(true);

        container.querySelector('[data-global-pool-mode="selected"]').click();
        const thumbnails = container.querySelectorAll('[data-global-asset-id]');
        expect(thumbnails).toHaveLength(2);
        expect(panel.getConfig().interlocution.globalPool).toEqual({ mode: 'selected', assetIds: [] });

        const selectedId = thumbnails[0].dataset.globalAssetId;
        thumbnails[0].click();
        expect(emitted.interlocution.globalPool).toEqual({ mode: 'selected', assetIds: [selectedId] });
        expect(container.querySelector(`[data-global-asset-id="${selectedId}"]`).getAttribute('aria-pressed')).toBe('true');

        panel.destroy();
        container.remove();
        localStorage.removeItem('rise_global_images_v1');
    });

    it('honors a nested interlocution preset passed at construction (SOL launch path)', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        const config = panel.getConfig();
        expect(config.visualMode).toBe('interlocution');
        expect(config.interlocution.frequency).toBe(0.2);
        expect(config.interlocution.duration).toBe(150);
        expect(config.interlocution.sourced).toEqual(['aic-landscapes']);

        // The preset is visible: the checkbox exists and is checked
        const presetCheckbox = container.querySelector('[data-sourced="aic-landscapes"]');
        expect(presetCheckbox).not.toBeNull();
        expect(presetCheckbox.checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('still honors legacy flattened options', () => {
        const { panel, container } = makePanel({ frequency: 0.4, sourced: ['aic-ukiyoe'], procedural: ['klee'] });
        const config = panel.getConfig();
        expect(config.interlocution.frequency).toBe(0.4);
        expect(config.interlocution.sourced).toEqual(['aic-ukiyoe']);
        expect(config.interlocution.procedural).toEqual(['klee']);
        panel.destroy();
        container.remove();
    });

    it('retires ASCII without stranding a config that still names it', async () => {
        // The control is gone (a cool experiment that did not earn its
        // place). A reader who once chose it must not be left in a mode
        // with no control to leave by, so every saved config lands on
        // native — the same migration met- ids got, for the same reason.
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                renderLanguage: 'ascii',
                sourceFamily: 'procedural',
                procedural: ['klee'],
                sourced: []
            },
            onChange: config => { emitted = config; }
        });

        expect(container.querySelector('[data-render-language]')).toBeNull();
        expect(panel.config.interlocution.renderLanguage).toBe('native');

        // …and the rest of that config is untouched by the migration.
        await grantFlashConsent(container, 'behind-stream');
        expect(emitted.interlocution.renderLanguage).toBe('native');
        expect(emitted.interlocution.procedural).toEqual(['klee']);

        panel.destroy();
        container.remove();
    });

    it('offers Gallery first among the presentation surfaces', () => {
        // The order of a set of buttons is a recommendation whether or not
        // it is meant as one, and Gallery is the surface that never
        // flashes and never goes black.
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });
        const order = [...container.querySelectorAll('[data-presentation]')]
            .map(b => b.dataset.presentation);
        expect(order).toEqual(['continuous', 'behind-stream', 'full-frame']);
        panel.destroy();
        container.remove();
    });

    it('renders the categories the Wikimedia provider defines (minus AIC-shadowed ids)', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        for (const id of Object.keys(WIKIMEDIA_CATEGORIES)) {
            if (id === 'romantic') continue; // legacy-routed to AIC; lives in the AIC section
            expect(container.querySelector(`[data-sourced="${id}"]`), `missing checkbox for '${id}'`).not.toBeNull();
        }

        panel.destroy();
        container.remove();
    });

    it('renders every Art Institute category under its namespaced aic- id', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        for (const id of Object.keys(MUSEUM_CATEGORIES)) {
            expect(container.querySelector(`[data-sourced="aic-${id}"]`), `missing AIC checkbox for '${id}'`).not.toBeNull();
        }
        // Bare (un-namespaced) AIC ids must not appear as checkboxes
        expect(container.querySelector('[data-sourced="renaissance"]')).toBeNull();
        expect(container.querySelector('[data-sourced="landscapes"]')).toBeNull();
        expect(container.querySelector('[data-sourced="romantic"]')).toBeNull();

        panel.destroy();
        container.remove();
    });

    it('groups collections by manner and subject, losing none', () => {
        // A reader picking imagery is asking one of two questions: in
        // what MANNER was this painted, or what is IN the picture. The
        // grouping comes from the museum registry's own `kind`, so the
        // panel can never drift from that taxonomy.
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        // SCOPED TO THE MUSEUM SECTION. This selector was panel-wide and
        // passed only because one accordion used groups; Science
        // Collections broke it by existing. The assertion is about the
        // museum taxonomy, so it should name the section it means.
        const museum = container.querySelector('[data-toggle="aic"]').closest('.vi-accordion');
        const groups = [...museum.querySelectorAll('[data-collection-group]')];
        expect(groups.map(g => g.dataset.collectionGroup)).toEqual(['style', 'subject']);
        for (const group of groups) {
            expect(group.querySelector('.vi-collection-group-label').textContent.trim())
                .toBeTruthy();
        }

        // Every category lands in exactly one group — untyped categories
        // would vanish from the UI silently.
        const grouped = groups.flatMap(g =>
            [...g.querySelectorAll('[data-sourced]')].map(b => b.getAttribute('data-sourced')));
        expect(new Set(grouped).size).toBe(grouped.length);
        expect(new Set(grouped)).toEqual(
            new Set(Object.keys(MUSEUM_CATEGORIES).map(id => `aic-${id}`)));

        panel.destroy();
        container.remove();
    });

    it('keeps science collections in their own section, not among the paintings', () => {
        // SOURCE-EXPANSION-SPEC §1 calls art-of vs witness-of load-bearing:
        // a Rembrandt and a Hubble deep field answer different questions and
        // carry different rights. Folding them into one list would bury the
        // distinction the rights apparatus was built around.
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        const science = container.querySelector('[data-toggle="science"]').closest('.vi-accordion');
        expect(container.querySelector('[data-toggle="science"]').textContent)
            .toContain('Science Collections');
        expect([...science.querySelectorAll('[data-sourced]')]
            .map(b => b.getAttribute('data-sourced'))).toEqual(['sci-astronomy']);

        // …and it is NOT inside the museum section.
        const museum = container.querySelector('[data-toggle="aic"]').closest('.vi-accordion');
        expect(museum.querySelector('[data-sourced="sci-astronomy"]')).toBeNull();

        panel.destroy();
        container.remove();
    });

    it('no longer names one institution for a cross-institution pool', () => {
        // The header read "Art Institute Collection" while Landscapes was
        // 178 Rijksmuseum works to 83 AIC and Animals was Audubon plates
        // from Cincinnati and Michigan. The ids stay `aic-*` — renaming
        // them would break every saved selection for no reader-visible
        // gain — but the heading no longer claims what is not true.
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        const header = container.querySelector('[data-toggle="aic"]');
        expect(header.textContent).toContain('Museum Collections');
        expect(header.textContent).not.toContain('Art Institute');
        expect(container.querySelector('[data-sourced="aic-landscapes"]')).toBeTruthy();

        panel.destroy();
        container.remove();
    });

    it('places each collection under the heading its registry kind names', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        for (const [id, cat] of Object.entries(MUSEUM_CATEGORIES)) {
            const box = container.querySelector(`[data-sourced="aic-${id}"]`);
            const group = box.closest('[data-collection-group]');
            expect(group?.dataset.collectionGroup, `${id} is grouped wrongly`)
                .toBe(cat.kind);
        }

        panel.destroy();
        container.remove();
    });

    it('an AIC preset is visible and checked (e.g. archetype with aic-oldmasters)', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.3, duration: 80, sourced: ['aic-oldmasters'], procedural: [] }
        });

        const box = container.querySelector('[data-sourced="aic-oldmasters"]');
        expect(box).not.toBeNull();
        expect(box.checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('retires stale met-* ids while preserving other compatible sources', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.3, duration: 80, sourced: ['aic-surrealism', 'met-egyptian'], procedural: [] }
        });

        expect(container.querySelector('[data-sourced="aic-surrealism"]')).toBeNull();
        expect(container.querySelector('[data-sourced="met-egyptian"]')).toBeNull();
        expect(panel.getConfig().interlocution.sourced).toEqual(['aic-surrealism']);
        expect(panel.getConfig().interlocution.procedural).toEqual([]);
        // The replacement categories are offered
        expect(container.querySelector('[data-sourced="aic-ukiyoe"]')).not.toBeNull();
        expect(container.querySelector('[data-sourced="aic-postimpressionism"]')).not.toBeNull();
        expect(container.querySelector('[data-sourced="aic-oldmasters"]')).not.toBeNull();
        expect(container.querySelector('[data-sourced="aic-portraits"]')).not.toBeNull();

        panel.destroy();
        container.remove();
    });

    it('migrates a saved Met-only preset to procedural Klee', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.3, duration: 80, sourced: ['met-egyptian'], procedural: [] }
        });

        expect(panel.getConfig().interlocution.sourced).toEqual([]);
        expect(panel.getConfig().interlocution.procedural).toEqual(['klee']);
        expect(container.querySelector('[data-procedural="klee"]').checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('switching a collection preset to Procedural clears painting categories', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            ...SOL_DAWN_CONFIG,
            onChange: (config) => { emitted = config; }
        });

        // The source family is the deliberate boundary. Temporal settings
        // remain intact while incompatible image categories are discarded.
        expect(panel.getConfig().interlocution.sourceFamily).toBe('collections');
        container.querySelector('[data-source-family="procedural"]').click();

        const kleeCheckbox = container.querySelector('[data-procedural="klee"]');
        kleeCheckbox.checked = true;
        kleeCheckbox.dispatchEvent(new Event('change'));

        expect(emitted).not.toBeNull();
        expect(emitted.interlocution.sourceFamily).toBe('procedural');
        expect(emitted.interlocution.sourced).toEqual([]);
        expect(emitted.interlocution.duration).toBe(150);
        expect(emitted.interlocution.procedural).toContain('klee');

        panel.destroy();
        container.remove();
    });

    it('preserves mixed sources only when Blend is explicit', () => {
        const { panel, container } = makePanel({
            ...SOL_DAWN_CONFIG,
            interlocution: {
                ...SOL_DAWN_CONFIG.interlocution,
                sourceFamily: 'blend'
            }
        });

        const kleeCheckbox = container.querySelector('[data-procedural="klee"]');
        kleeCheckbox.checked = true;
        kleeCheckbox.dispatchEvent(new Event('change'));

        expect(panel.getConfig().interlocution).toMatchObject({
            sourceFamily: 'blend',
            sourced: ['aic-landscapes']
        });
        expect(panel.getConfig().interlocution.procedural).toContain('klee');

        panel.destroy();
        container.remove();
    });

    it('treats a partial preset source array as a complete selection replacement', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        panel.setConfig({ interlocution: { procedural: ['klee'] } });

        expect(panel.getConfig().interlocution).toMatchObject({
            sourceFamily: 'procedural',
            procedural: ['klee'],
            sourced: [],
            duration: 150
        });

        panel.destroy();
        container.remove();
    });

    it('exposes stepped Presence values with meaningful assistive text', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { duration: 200, procedural: ['klee'], sourced: [] },
            onChange: config => { emitted = config; }
        });
        const slider = container.querySelector('[data-slider="duration"]');

        expect(slider.min).toBe('0');
        expect(slider.max).toBe('7');
        expect(slider.value).toBe('1');
        expect(slider.getAttribute('aria-valuetext')).toBe('200 milliseconds, punctuation');

        slider.value = '7';
        slider.dispatchEvent(new Event('input'));
        expect(emitted.interlocution.duration).toBe(2000);
        expect(slider.getAttribute('aria-valuetext')).toBe('2.0 seconds, tableau');
        expect(container.querySelector('[data-value="duration"]').textContent).toBe('2.0 s');

        panel.destroy();
        container.remove();
    });

    it('displays a saved non-step presence at the nearest step without rewriting it', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { duration: 333, procedural: ['klee'], sourced: [] }
        });
        const slider = container.querySelector('[data-slider="duration"]');

        expect(panel.getConfig().interlocution.duration).toBe(333);
        expect(slider.value).toBe('2');
        expect(slider.getAttribute('aria-valuetext')).toBe('300 milliseconds, interruption');
        expect(container.querySelector('[data-value="duration"]').textContent).toBe('300 ms');

        panel.destroy();
        container.remove();
    });

    it('Living Response section: Responsive is disabled outside Rhythmic mode but keeps its state', () => {
        const { panel, container } = makePanel({
            visualMode: 'attractor',
            interlocution: { frequency: 0.3, duration: 80, sourced: [], procedural: [], responsive: true }
        });

        const responsive = container.querySelector('[data-responsive]');
        expect(responsive.disabled).toBe(true);
        expect(responsive.checked).toBe(true); // stored preference preserved, visibly

        // Living Text stays operable in any mode
        expect(container.querySelector('[data-livingtext]').disabled).toBe(false);

        panel.destroy();
        container.remove();
    });

    it('Living Response section: Responsive is operable in Rhythmic mode', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });
        expect(container.querySelector('[data-responsive]').disabled).toBe(false);
        panel.destroy();
        container.remove();
    });

    it('mood/rhythm sub-toggles appear only when Responsive is on, defaulting enabled', () => {
        const off = makePanel({ ...SOL_DAWN_CONFIG });
        expect(off.container.querySelector('[data-responsive-mood]')).toBeNull();
        off.panel.destroy();
        off.container.remove();

        const on = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.2, duration: 80, sourced: [], procedural: ['klee'], responsive: true }
        });
        const mood = on.container.querySelector('[data-responsive-mood]');
        const rhythm = on.container.querySelector('[data-responsive-rhythm]');
        expect(mood).not.toBeNull();
        expect(rhythm).not.toBeNull();
        expect(mood.checked).toBe(true);
        expect(rhythm.checked).toBe(true);
        on.panel.destroy();
        on.container.remove();
    });

    it('toggling a sub-intent emits the updated config', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.2, duration: 80, sourced: [], procedural: ['klee'], responsive: true },
            onChange: (config) => { emitted = config; }
        });

        const mood = container.querySelector('[data-responsive-mood]');
        mood.checked = false;
        mood.dispatchEvent(new Event('change'));

        expect(emitted.interlocution.responsiveMood).toBe(false);
        expect(emitted.interlocution.responsiveRhythm).toBe(true);
        expect(emitted.interlocution.responsive).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('genesis panel: glass tile toggle defaults on and emits config changes', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'genesis',
            onChange: (config) => { emitted = config; }
        });

        const glass = container.querySelector('[data-genesis-glass]');
        expect(glass).not.toBeNull();
        expect(glass.checked).toBe(true);

        glass.checked = false;
        glass.dispatchEvent(new Event('change'));
        expect(emitted.genesis.glass).toBe(false);
        expect(emitted.visualMode).toBe('genesis');

        panel.destroy();
        container.remove();
    });

    it('setConfig merges a preset into an already-constructed panel', () => {
        const { panel, container } = makePanel({});
        panel.setConfig(SOL_DAWN_CONFIG);

        const config = panel.getConfig();
        expect(config.visualMode).toBe('interlocution');
        expect(config.interlocution.sourced).toEqual(['aic-landscapes']);
        expect(container.querySelector('[data-sourced="aic-landscapes"]').checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('setConfig also migrates a late Met-only archetype preset', () => {
        const { panel, container } = makePanel({});
        panel.setConfig({
            visualMode: 'interlocution',
            interlocution: { sourced: ['met-egyptian'], procedural: [] }
        });

        expect(panel.getConfig().interlocution.sourced).toEqual([]);
        expect(panel.getConfig().interlocution.procedural).toEqual(['klee']);
        expect(container.querySelector('[data-procedural="klee"]').checked).toBe(true);

        panel.destroy();
        container.remove();
    });
});

describe('Harmonograph climate chips', () => {
    it('chips appear only when harmonograph is enabled; Auto is the default', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { procedural: [], sourced: [] }
        });
        panel.activeAccordions = ['procedural'];
        panel.render();
        panel.attachEvents();
        expect(container.querySelector('[data-preset-group="harmonograph"]')).toBeNull();

        container.querySelector('[data-procedural="harmonograph"]').click();
        const chips = container.querySelectorAll('[data-for="harmonograph"]');
        expect(chips.length).toBe(7);
        expect(container.querySelector('[data-for="harmonograph"][data-preset="auto"]')
            .classList.contains('active')).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('selecting a climate pins it in config; klee preset is untouched', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { procedural: ['harmonograph', 'klee'], sourced: [], kleePreset: 'harmonic' }
        });
        panel.activeAccordions = ['procedural'];
        panel.render();
        panel.attachEvents();

        container.querySelector('[data-for="harmonograph"][data-preset="stormViolet"]').click();
        const config = panel.getConfig();
        expect(config.interlocution.harmonographClimate).toBe('stormViolet');
        expect(config.interlocution.kleePreset).toBe('harmonic');
        expect(container.querySelector('[data-for="harmonograph"][data-preset="stormViolet"]')
            .classList.contains('active')).toBe(true);

        panel.destroy();
        container.remove();
    });
});

describe('Stream-maintaining Rhythmic and Atrium collections', () => {
    it('offers the presentation surface with Full frame as the default', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] }
        });

        // Three surfaces: Gallery, background flash, foreground flash.
        expect(container.querySelectorAll('[data-presentation]')).toHaveLength(3);
        expect(container.querySelector('[data-presentation="full-frame"]').classList.contains('active')).toBe(true);
        expect(container.querySelector('[data-presentation="continuous"]')).not.toBeNull();
        expect(container.querySelector('[data-presentation="continuous-word"]')).toBeNull();
        expect(panel.getConfig().interlocution.presentation).toBe('full-frame');

        panel.destroy();
        container.remove();
    });

    it('behind-stream reveals the glass toggle and emits both fields', async () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] },
            onChange: config => { emitted = config; }
        });

        expect(container.querySelector('[data-presentation-glass]')).toBeNull();

        await grantFlashConsent(container, 'behind-stream');
        expect(emitted.interlocution.presentation).toBe('behind-stream');
        // Glass tile is on by default and only offered for this surface
        const glass = container.querySelector('[data-presentation-glass]');
        expect(glass).not.toBeNull();
        expect(glass.checked).toBe(true);

        glass.checked = false;
        glass.dispatchEvent(new Event('change', { bubbles: true }));
        expect(emitted.interlocution.streamGlass).toBe(false);
        // Source selection is untouched by a presentation change
        expect(emitted.interlocution.procedural).toEqual(['klee']);

        panel.destroy();
        container.remove();
    });

    it('Gallery replaces flash controls with independent cadence and restores them on return', async () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'procedural',
                procedural: ['klee'],
                sourced: [],
                frequency: 0.37,
                duration: 700
            },
            onChange: config => { emitted = config; }
        });
        expect(container.querySelector('[data-slider="frequency"]')).not.toBeNull();
        expect(container.querySelector('[data-slider="duration"]')).not.toBeNull();

        container.querySelector('[data-presentation="continuous"]').click();
        expect(emitted.interlocution.presentation).toBe('continuous');
        expect(container.querySelector('[data-slider="frequency"]')).toBeNull();
        expect(container.querySelector('[data-slider="duration"]')).toBeNull();

        const cadence = container.querySelector('[data-slider="gallery-cadence"]');
        expect(cadence).not.toBeNull();
        expect(cadence.value).toBe('50');
        cadence.value = '100';
        cadence.dispatchEvent(new Event('input', { bubbles: true }));
        expect(emitted.interlocution.galleryCadence).toBe(1);
        expect(container.querySelector('[data-value="gallery-cadence"]').textContent).toBe('≈ 8 s');

        // Gallery never rewrites the separate flash economy.
        expect(emitted.interlocution.frequency).toBe(0.37);
        expect(emitted.interlocution.duration).toBe(700);
        // The glass tile toggle is offered (the field needs legible text)
        const glass = container.querySelector('[data-presentation-glass]');
        expect(glass).not.toBeNull();
        expect(glass.checked).toBe(true);

        container.querySelector('[data-presentation="full-frame"]').click();
        expect(container.querySelector('[data-slider="gallery-cadence"]')).toBeNull();
        expect(container.querySelector('[data-slider="frequency"]').value).toBe('37');
        expect(panel.getConfig().interlocution.duration).toBe(700);
        expect(panel.getConfig().interlocution.galleryCadence).toBe(1);

        panel.destroy();
        container.remove();
    });

    it('seeds the surface-appropriate presence default, never an explicit choice', async () => {
        // Behind-stream imagery is peripheral: it defaults to a full
        // 1s beat where a full-frame cut defaults to 200ms. The slider
        // follows the surface only while it sits on an untouched
        // default; a value the user chose is never rewritten.
        const untouched = makePanel({
            visualMode: 'interlocution',
            interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] }
        });
        expect(untouched.panel.getConfig().interlocution.duration).toBe(200);

        await grantFlashConsent(untouched.container, 'behind-stream');
        expect(untouched.panel.getConfig().interlocution.duration).toBe(1000);

        untouched.container.querySelector('[data-presentation="full-frame"]').click();
        expect(untouched.panel.getConfig().interlocution.duration).toBe(200);
        untouched.panel.destroy();
        untouched.container.remove();

        const explicit = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'procedural', procedural: ['klee'], sourced: [],
                duration: 700
            }
        });
        explicit.container.querySelector('[data-presentation="behind-stream"]').click();
        expect(explicit.panel.getConfig().interlocution.duration).toBe(700);
        explicit.panel.destroy();
        explicit.container.remove();
    });

    it('shows curated collections only for an Atrium launch that carries them', () => {
        const plain = makePanel({
            visualMode: 'interlocution',
            interlocution: { sourceFamily: 'blend', procedural: ['klee'], sourced: ['geometry'] }
        });
        expect(plain.container.querySelector('.vi-atrium-collections')).toBeNull();
        plain.panel.destroy();
        plain.container.remove();

        const atrium = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'blend',
                procedural: ['harmonograph'],
                sourced: ['aic-oldmasters', 'geometry'],
                atriumCollections: ['aic-oldmasters', 'geometry']
            }
        });
        const section = atrium.container.querySelector('.vi-atrium-collections');
        expect(section).not.toBeNull();
        // Human-readable provider names, not raw ids
        expect(section.textContent).toContain('Old Masters');
        expect(section.textContent).not.toContain('aic-oldmasters');
        expect(atrium.container.querySelectorAll('.vi-atrium-collection-chip')).toHaveLength(2);

        atrium.panel.destroy();
        atrium.container.remove();
    });
});

describe('Attractor filament color', () => {
    it('offers the five colors and reports the selection', () => {
        const { panel, container } = makePanel({ visualMode: 'attractor' });

        const swatches = container.querySelectorAll('[data-attractor-palette]');
        expect([...swatches].map(s => s.dataset.attractorPalette))
            .toEqual(['white', 'red', 'blue', 'gold', 'purple']);
        // White is the default and reads as pressed
        expect(container.querySelector('[data-attractor-palette="white"]')
            .getAttribute('aria-pressed')).toBe('true');

        container.querySelector('[data-attractor-palette="purple"]').click();
        expect(panel.getConfig().attractor.palette).toBe('purple');
        expect(container.querySelector('[data-attractor-palette="purple"]')
            .classList.contains('active')).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('preserves a saved palette and form through construction', () => {
        const { panel, container } = makePanel({
            visualMode: 'attractor',
            attractor: { system: 'halvorsen', palette: 'blue', form: 'kaleido' }
        });
        expect(panel.getConfig().attractor)
            .toMatchObject({ system: 'halvorsen', palette: 'blue', form: 'kaleido' });
        panel.destroy();
        container.remove();
    });
});

describe('Atrium-exclusive pattern pills', () => {
    it('names a blueprint plate and a liberation field in human terms', () => {
        // These sequences carry no sourced imagery, but they ARE curated —
        // the reader should see that the visuals were chosen for the
        // passage rather than left to chance.
        const plate = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'procedural', procedural: ['blueprint'], sourced: [],
                atriumCollections: ['blueprint:beam-engine']
            }
        });
        expect(plate.container.querySelector('.vi-atrium-collections')).not.toBeNull();
        expect(plate.container.querySelector('.vi-atrium-collection-chip').textContent)
            .toBe('Beam Engine — Plate');
        plate.panel.destroy();
        plate.container.remove();

        const field = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'procedural', procedural: ['freedom'], sourced: [],
                atriumCollections: ['freedom:haiti-france']
            }
        });
        expect(field.container.querySelector('.vi-atrium-collection-chip').textContent)
            .toBe('Haiti · France');
        field.panel.destroy();
        field.container.remove();
    });

    it('keeps blueprint and freedom out of the browsable procedural list', () => {
        // Both are Atrium-exclusive: they arrive only with the sequence
        // that curated them, never as a generic option.
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] }
        });
        expect(container.querySelector('[data-procedural="blueprint"]')).toBeNull();
        expect(container.querySelector('[data-procedural="freedom"]')).toBeNull();
        expect(container.querySelector('[data-procedural="ostensoria"]')).not.toBeNull();
        expect(container.querySelector('[data-procedural="apparitio"]')).not.toBeNull();
        expect(container.querySelector('[data-procedural="attractor"]')).not.toBeNull();
        expect(container.querySelector('[data-procedural="attractor"]')
            .closest('label')?.textContent).toMatch(/Attractor/);
        panel.destroy();
        container.remove();
    });
});

describe('Special Collection banner (PERICOPE-IMAGERY-SPEC)', () => {
    it('shows the read-only program banner and suppresses the editable chips', () => {
        const { panel, container } = makePanel({ visualMode: 'interlocution' });
        panel.setProgramInfo({ episodes: 7 });
        const banner = container.querySelector('.vi-program-active');
        expect(banner).not.toBeNull();
        expect(banner.querySelector('.vi-program-name').textContent).toContain('7 episodes');
        // the "From this reading" editable chip block must not appear
        expect(container.querySelector('.vi-chapel-collections')).toBeNull();
    });

    it('clears the banner for an ordinary reading', () => {
        const { panel, container } = makePanel({ visualMode: 'interlocution' });
        panel.setProgramInfo({ episodes: 3 });
        expect(container.querySelector('.vi-program-active')).not.toBeNull();
        panel.setProgramInfo(null);
        expect(container.querySelector('.vi-program-active')).toBeNull();
    });
});

describe('From-this-reading pill ownership across source changes (2026-07 leak fix)', () => {
    const launch = (sourced, atriumCollections) => ({
        visualMode: 'interlocution',
        interlocution: { sourced, procedural: [], atriumCollections }
    });

    it('a Chapel→Atrium switch clears the Chapel domain flag and label', () => {
        const { panel } = makePanel({ visualMode: 'interlocution' });
        panel.setConfig(launch(['chapel-passion'], ['chapel-passion']));
        expect(panel._chapelLaunch).toBe(true);
        // switch to an Atrium blueprint launch
        panel.setConfig(launch(['blueprint:beam-engine'], ['blueprint:beam-engine']));
        expect(panel._chapelLaunch).toBe(false);
        expect(panel.config.interlocution.atriumCollections).toEqual(['blueprint:beam-engine']);
    });

    it('a source that omits atriumCollections CLEARS it (no stale pill leak)', () => {
        const { panel } = makePanel({ visualMode: 'interlocution' });
        panel.setConfig(launch(['blueprint:beam-engine'], ['blueprint:beam-engine']));
        expect(panel.config.interlocution.atriumCollections).toEqual(['blueprint:beam-engine']);
        // a plain source (Yoga Sutras) that carries no collections
        panel.setConfig({ visualMode: 'interlocution', interlocution: { sourced: ['aic-landscapes'], procedural: [] } });
        expect(panel.config.interlocution.atriumCollections).toEqual([]);
    });

    it('atriumCollections is launch-scoped and omitted by a new source config', () => {
        // The pills belong to the loaded reading, not the tab's reusable
        // preferences. ChamberOrbital persists them beside that reading and
        // supplies them again only when the same reading is reconstructed.
        const { panel } = makePanel({ visualMode: 'interlocution' });
        panel.setConfig(launch(['chapel-passion'], ['chapel-passion']));
        // a config with NO interlocution key leaves prior pills untouched
        // (mode-only change), but any source-bearing config replaces them
        panel.setConfig(launch(['gutenberg'], undefined));
        expect(panel.config.interlocution.atriumCollections).toEqual([]);
    });
});

describe('the photosensitivity notice belongs to the surface that flashes', () => {
    // It used to guard the MODE. Rhythmic opens on Gallery — a field that
    // crossfades and never goes black — so the warning described a risk
    // the reader had not chosen yet, and accepting it dropped them onto
    // full frame. One gate deeper: the presentation is where the flash is.
    it('lets Gallery be chosen with no prompt at all', async () => {
        endVisualInterlocutionSession();
        document.body.insertAdjacentHTML('beforeend', `
          <div id="photosensitivity-modal" class="hidden">
            <button id="safety-cancel">Cancel</button><button id="safety-accept">Accept</button>
          </div>
        `);
        const { panel, container } = makePanel({
            visualMode: 'interlocution', consentScope: 'gallery-scope',
            interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] }
        });

        container.querySelector('[data-presentation="continuous"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(document.querySelector('#photosensitivity-modal').classList.contains('hidden')).toBe(true);
        expect(panel.getConfig().interlocution.presentation).toBe('continuous');

        panel.destroy();
        container.remove();
        document.querySelector('#photosensitivity-modal')?.remove();
        endVisualInterlocutionSession();
    });

    it('keeps three Presentation chips and hangs wordFill inside Gallery, not as a fourth surface', async () => {
        endVisualInterlocutionSession();
        const settings = { chamberMask: false, chamberFace: 'jp', fontSize: 'medium' };
        globalThis.rise = { settings };
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] }
        });

        const modes = [...container.querySelectorAll('[data-visual-mode]')].map(btn => btn.dataset.visualMode);
        expect(modes).toEqual(['off', 'focals', 'attractor', 'genesis', 'interlocution']);
        expect([...container.querySelectorAll('[data-presentation]')].map(btn => btn.dataset.presentation))
            .toEqual(['continuous', 'behind-stream', 'full-frame']);
        expect(container.querySelector('[data-presentation="continuous-word"]')).toBeNull();
        expect(container.querySelector('[data-word-fill]')).toBeNull();
        expect(panel.getConfig().interlocution.wordFill).toEqual({ mode: 'same' });

        container.querySelector('[data-presentation="continuous"]').click();
        await Promise.resolve();

        expect(panel.getConfig().interlocution.presentation).toBe('continuous');
        const hook = container.querySelector('[data-word-fill]');
        expect(hook).toBeTruthy();
        expect(container.querySelector('.vi-presentation-surface [data-word-fill]')).toBeNull();
        expect(hook.value).toBe('same');

        hook.value = 'sourced:aic-ukiyoe';
        hook.dispatchEvent(new Event('change', { bubbles: true }));
        expect(panel.getConfig().interlocution.wordFill).toEqual({
            mode: 'pick',
            sourceFamily: 'collections',
            sourced: ['aic-ukiyoe'],
            procedural: []
        });
        expect(panel.getConfig().interlocution.presentation).toBe('continuous');
        expect(settings.chamberFace).toBe('jp');
        expect(settings.fontSize).toBe('medium');
        expect(settings.chamberMask).toBe(false);

        panel.destroy();
        container.remove();
        delete globalThis.rise;
        endVisualInterlocutionSession();
    });

    it('a procedural word-fill pick does not steal a non-empty gallery collection', async () => {
        const settings = { chamberMask: false, chamberFace: 'jp', fontSize: 'medium' };
        globalThis.rise = { settings };
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'collections',
                procedural: [],
                sourced: ['aic-landscapes'],
                presentation: 'continuous'
            }
        });

        const hook = container.querySelector('[data-word-fill]');
        expect(hook).toBeTruthy();
        hook.value = 'procedural:fractal';
        hook.dispatchEvent(new Event('change', { bubbles: true }));

        expect(panel.getConfig().interlocution.sourced).toEqual(['aic-landscapes']);
        expect(panel.getConfig().interlocution.procedural).toEqual([]);
        expect(panel.getConfig().interlocution.sourceFamily).toBe('collections');
        expect(panel.getConfig().interlocution.wordFill).toEqual({
            mode: 'pick',
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });

        panel.destroy();
        container.remove();
        delete globalThis.rise;
        endVisualInterlocutionSession();
    });

    it.each(['behind-stream', 'full-frame'])('asks before %s', async (surface) => {
        endVisualInterlocutionSession();
        document.body.insertAdjacentHTML('beforeend', `
          <div id="photosensitivity-modal" class="hidden">
            <button id="safety-cancel">Cancel</button><button id="safety-accept">Accept</button>
          </div>
        `);
        const { panel, container } = makePanel({
            visualMode: 'interlocution', consentScope: `ask-${surface}`,
            interlocution: {
                sourceFamily: 'procedural', procedural: ['klee'], sourced: [],
                presentation: 'continuous'
            }
        });

        container.querySelector(`[data-presentation="${surface}"]`).click();
        document.querySelector('#safety-cancel').click();
        await Promise.resolve();
        await Promise.resolve();
        // Declined: still on the surface that never flashes.
        expect(panel.getConfig().interlocution.presentation).toBe('continuous');

        await grantFlashConsent(container, surface);
        expect(panel.getConfig().interlocution.presentation).toBe(surface);

        panel.destroy();
        container.remove();
        document.querySelector('#photosensitivity-modal')?.remove();
        endVisualInterlocutionSession();
    });
});

describe('PREP Visual Settings Face (FM-RISE-34)', () => {
    afterEach(() => {
        delete globalThis.rise;
        document.body.replaceChildren();
    });

    function faceRow(container) {
        const mode = container.querySelector('.vi-mode-selector');
        return mode?.nextElementSibling;
    }

    it('places Literary | Display | Thick | Japanese chips under the mode selector on every mode', () => {
        const { panel, container } = makePanel({ expanded: true, visualMode: 'off' });
        const row = faceRow(container);

        expect(container.querySelector('.vi-content')?.contains(row)).toBe(true);
        expect(row.classList.contains('vi-source-family')).toBe(true);
        expect([...row.querySelectorAll('[data-chamber-face]')].map((btn) => [
            btn.dataset.chamberFace,
            btn.textContent.replace(/\s+/g, ' ').trim(),
            btn.classList.contains('vi-source-family-btn')
        ])).toEqual([
            ['literary', 'Literary', true],
            ['display', 'Display', true],
            ['thick', 'Thick', true],
            ['jp', 'Japanese', true]
        ]);
        expect(row.querySelector('[data-chamber-face="jp"]').style.fontFamily)
            .toMatch(/Noto Serif JP|var\(--font-jp\)/);
        expect(row.textContent).toMatch(/The letters, not the room/);
        expect(container.querySelector('.vi-focals-panel')?.querySelector('[data-chamber-face]')).toBeNull();
        expect(container.querySelector('[data-presentation="continuous-word"]')).toBeNull();
        expect([...container.querySelectorAll('[data-visual-mode]')].map((btn) => btn.dataset.visualMode))
            .toEqual(['off', 'focals', 'attractor', 'genesis', 'interlocution']);

        for (const id of ['off', 'focals', 'attractor', 'genesis', 'interlocution']) {
            container.querySelector(`[data-visual-mode="${id}"]`).click();
            expect(faceRow(container)?.querySelector('[data-chamber-face="thick"]')).toBeTruthy();
        }

        panel.destroy();
    });

    it('persists only allowlisted Face ids to rise.settings and never into visualConfig', () => {
        const settings = { chamberFace: 'literary', fontSize: 'medium' };
        const handleSettingsChange = vi.fn((key, value) => {
            settings[key] = value;
        });
        const onChange = vi.fn();
        globalThis.rise = { settings, handleSettingsChange };
        const { panel, container } = makePanel({
            expanded: true,
            visualMode: 'off',
            onChange
        });

        container.querySelector('[data-chamber-face="jp"]').click();
        expect(handleSettingsChange).toHaveBeenCalledWith('chamberFace', 'jp');
        expect(settings.chamberFace).toBe('jp');
        expect(onChange).not.toHaveBeenCalled();
        expect(panel.getConfig().chamberFace).toBeUndefined();
        expect(panel.getConfig().interlocution.chamberFace).toBeUndefined();
        expect(panel.getConfig().visualMode).toBe('off');

        const forged = container.querySelector('[data-chamber-face="jp"]');
        forged.dataset.chamberFace = 'papyrus';
        forged.click();
        expect(handleSettingsChange).not.toHaveBeenCalledWith('chamberFace', 'papyrus');
        expect(settings.chamberFace).toBe('jp');
        expect(settings.fontSize).toBe('medium');

        panel.destroy();
    });
});

describe('PREP Visual Settings Size (FM-RISE-36)', () => {
    afterEach(() => {
        delete globalThis.rise;
        document.body.replaceChildren();
    });

    function faceRow(container) {
        const mode = container.querySelector('.vi-mode-selector');
        return mode?.nextElementSibling;
    }

    function sizeRow(container) {
        return faceRow(container)?.nextElementSibling;
    }

    it('places S | M | L | Fit chips with Face under the mode selector on every mode', () => {
        const { panel, container } = makePanel({ expanded: true, visualMode: 'off' });
        const row = sizeRow(container);

        expect(container.querySelector('.vi-content')?.contains(row)).toBe(true);
        expect(row.classList.contains('vi-source-family')).toBe(true);
        expect([...row.querySelectorAll('[data-font-size]')].map((btn) => [
            btn.dataset.fontSize,
            btn.textContent.replace(/\s+/g, ' ').trim(),
            btn.classList.contains('vi-source-family-btn')
        ])).toEqual([
            ['s', 'S', true],
            ['m', 'M', true],
            ['l', 'L', true],
            ['fit', 'Fit', true]
        ]);
        expect(row.querySelector('[data-font-size="m"]').getAttribute('aria-pressed')).toBe('true');
        expect(faceRow(container)?.querySelector('[data-chamber-face="thick"]')).toBeTruthy();
        expect(container.querySelector('.vi-focals-panel')?.querySelector('[data-font-size]')).toBeNull();
        expect(container.querySelector('[data-presentation="continuous-word"]')).toBeNull();
        expect([...container.querySelectorAll('[data-visual-mode]')].map((btn) => btn.dataset.visualMode))
            .toEqual(['off', 'focals', 'attractor', 'genesis', 'interlocution']);

        for (const id of ['off', 'focals', 'attractor', 'genesis', 'interlocution']) {
            container.querySelector(`[data-visual-mode="${id}"]`).click();
            expect(sizeRow(container)?.querySelector('[data-font-size="fit"]')).toBeTruthy();
            expect(faceRow(container)?.querySelector('[data-chamber-face="literary"]')).toBeTruthy();
        }

        panel.destroy();
    });

    it('persists s|m|l|fit as small|medium|large|fit and never into visualConfig', () => {
        const settings = { chamberFace: 'literary', fontSize: 'medium' };
        const handleSettingsChange = vi.fn((key, value) => {
            settings[key] = value;
        });
        const onChange = vi.fn();
        globalThis.rise = { settings, handleSettingsChange };
        const { panel, container } = makePanel({
            expanded: true,
            visualMode: 'off',
            onChange
        });

        container.querySelector('[data-font-size="l"]').click();
        expect(handleSettingsChange).toHaveBeenCalledWith('fontSize', 'large');
        expect(settings.fontSize).toBe('large');
        expect(onChange).not.toHaveBeenCalled();
        expect(panel.getConfig().fontSize).toBeUndefined();
        expect(panel.getConfig().interlocution.fontSize).toBeUndefined();
        expect(panel.getConfig().visualMode).toBe('off');
        expect(sizeRow(container).textContent).not.toMatch(/Words fill the chamber/);

        container.querySelector('[data-font-size="fit"]').click();
        expect(handleSettingsChange).toHaveBeenCalledWith('fontSize', 'fit');
        expect(settings.fontSize).toBe('fit');
        expect(sizeRow(container).textContent).toMatch(/Words fill the chamber/);
        expect(onChange).not.toHaveBeenCalled();

        const forged = container.querySelector('[data-font-size="fit"]');
        forged.dataset.fontSize = 'huge';
        forged.click();
        expect(handleSettingsChange).not.toHaveBeenCalledWith('fontSize', 'huge');
        expect(settings.fontSize).toBe('fit');
        expect(settings.chamberFace).toBe('literary');

        panel.destroy();
    });
});

describe('Attractor listing chrome (FM-UI-6)', () => {
    const LIVING_IDS = ['harmonograph', 'ostensoria', 'apparitio', 'attractor'];

    function listedPanel() {
        return makePanel({
            visualMode: 'interlocution',
            interlocution: {
                presentation: 'continuous',
                sourceFamily: 'procedural',
                procedural: [],
                sourced: []
            }
        });
    }

    it('names Attractor the same string on the chip and in the word-source list', () => {
        const { panel, container } = listedPanel();
        const chipLabel = container.querySelector('[data-procedural="attractor"]')
            ?.closest('label')
            ?.querySelector('.vi-checkbox-label')
            ?.textContent;
        const wordLabel = container.querySelector('option[value="procedural:attractor"]')?.textContent;
        expect(chipLabel).toBe('Attractor');
        expect(wordLabel).toBe('Attractor');
        expect(chipLabel).toBe(wordLabel);
        panel.destroy();
        container.remove();
    });

    it('lists living procedurals Harmonograph · Iris Plate · Spectral Plate · Attractor, Attractor last', () => {
        const { panel, container } = listedPanel();
        const chipIds = [...container.querySelectorAll('[data-procedural]')].map(el => el.dataset.procedural);
        const wordIds = [...container.querySelectorAll('[data-word-fill] option')]
            .map(el => el.value)
            .filter(value => value.startsWith('procedural:'))
            .map(value => value.slice('procedural:'.length));
        expect(chipIds.filter(id => LIVING_IDS.includes(id))).toEqual(LIVING_IDS);
        expect(wordIds.filter(id => LIVING_IDS.includes(id))).toEqual(LIVING_IDS);
        expect(chipIds.indexOf('attractor')).toBeGreaterThan(chipIds.indexOf('apparitio'));
        expect(wordIds.indexOf('attractor')).toBeGreaterThan(wordIds.indexOf('apparitio'));
        panel.destroy();
        container.remove();
    });

    it('does not put a Live badge on Attractor', () => {
        const { panel, container } = listedPanel();
        const wrapper = container.querySelector('[data-procedural="attractor"]')?.closest('.vi-checkbox-wrapper');
        expect(wrapper?.textContent).not.toMatch(/Live/);
        expect(container.querySelector('option[value="procedural:attractor"]')?.textContent).not.toMatch(/Live/);
        panel.destroy();
        container.remove();
    });

    it('does not publish Storm of Steel', () => {
        const { panel, container } = listedPanel();
        const chips = [...container.querySelectorAll('[data-procedural]')]
            .map(el => el.closest('label')?.textContent || '');
        const words = [...container.querySelectorAll('[data-word-fill] option')].map(el => el.textContent);
        expect([...chips, ...words].join('\n')).not.toMatch(/Storm of Steel|Drumfire/);
        panel.destroy();
        container.remove();
    });

    it('applies Attractor as a procedural instantly without adding a sixth visualMode', () => {
        const onChange = vi.fn();
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            onChange,
            interlocution: {
                presentation: 'continuous',
                sourceFamily: 'procedural',
                procedural: [],
                sourced: []
            }
        });
        expect([...container.querySelectorAll('[data-visual-mode]')].map(btn => btn.dataset.visualMode))
            .toEqual(['off', 'focals', 'attractor', 'genesis', 'interlocution']);

        container.querySelector('[data-procedural="attractor"]').click();
        expect(onChange).toHaveBeenCalled();
        expect(panel.getConfig().visualMode).toBe('interlocution');
        expect(panel.getConfig().interlocution.procedural).toEqual(['attractor']);

        const hook = container.querySelector('[data-word-fill]');
        hook.value = 'procedural:attractor';
        hook.dispatchEvent(new Event('change', { bubbles: true }));
        expect(panel.getConfig().visualMode).toBe('interlocution');
        expect(panel.getConfig().interlocution.wordFill).toEqual({
            mode: 'pick',
            sourceFamily: 'procedural',
            procedural: ['attractor'],
            sourced: []
        });
        expect([...container.querySelectorAll('[data-visual-mode]')].map(btn => btn.dataset.visualMode))
            .toEqual(['off', 'focals', 'attractor', 'genesis', 'interlocution']);

        panel.destroy();
        container.remove();
    });
});

describe('source-family chips and word-fill hoist (FM-RISE-46)', () => {
    const FAMILY_IDS = ['procedural', 'collections', 'personal', 'blend'];

    function familyChips(container) {
        return [...container.querySelectorAll('[data-source-family]')].map(btn => [
            btn.dataset.sourceFamily,
            btn.disabled,
            btn.getAttribute('aria-disabled'),
            getComputedStyle(btn).pointerEvents
        ]);
    }

    function sourceGroup(container) {
        return container.querySelector('[aria-label="Rhythmic source family"]')
            || container.querySelector('[aria-label="Source family"]');
    }

    it('Collections / Personal / Blend stay selected and do not snap back to Procedural', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                presentation: 'continuous',
                sourceFamily: 'procedural',
                procedural: ['klee', 'harmonograph', 'attractor'],
                sourced: []
            }
        });

        for (const family of ['collections', 'personal', 'blend']) {
            const chip = container.querySelector(`[data-source-family="${family}"]`);
            expect(chip.disabled).toBe(false);
            expect(chip.getAttribute('aria-disabled')).not.toBe('true');
            expect(getComputedStyle(chip).pointerEvents).not.toBe('none');
            chip.click();
            expect(panel.getConfig().interlocution.sourceFamily).toBe(family);
            expect(container.querySelector(`[data-source-family="${family}"]`)
                .getAttribute('aria-pressed')).toBe('true');
            expect(container.querySelector('[data-source-family="procedural"]')
                .getAttribute('aria-pressed')).toBe('false');
        }

        panel.destroy();
        container.remove();
    });

    it('selecting Collections unhides the collections accordion instead of leaving only Procedural', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                presentation: 'continuous',
                sourceFamily: 'procedural',
                procedural: ['fractal'],
                sourced: []
            }
        });

        container.querySelector('[data-source-family="collections"]').click();
        expect(panel.getConfig().interlocution.sourceFamily).toBe('collections');
        const museum = [...container.querySelectorAll('.vi-accordion-header')]
            .find(btn => btn.textContent.includes('Museum Collections'))
            ?.closest('.vi-accordion');
        expect(museum).toBeTruthy();
        expect(museum.hidden).toBe(false);
        const procedural = [...container.querySelectorAll('.vi-accordion-header')]
            .find(btn => btn.textContent.includes('Procedural Patterns'))
            ?.closest('.vi-accordion');
        expect(procedural.hidden).toBe(true);

        panel.destroy();
        container.remove();
    });

    it.each(['off', 'attractor', 'genesis', 'interlocution'])(
        'shows the four source chips and word-fill on %s',
        (visualMode) => {
            const { panel, container } = makePanel({
                visualMode,
                interlocution: {
                    presentation: visualMode === 'interlocution' ? 'continuous' : undefined,
                    sourceFamily: 'procedural',
                    procedural: ['klee'],
                    sourced: []
                }
            });

            expect(familyChips(container).map(([id]) => id)).toEqual(FAMILY_IDS);
            expect(familyChips(container).every(([, disabled, ariaDisabled, pointer]) => (
                disabled === false && ariaDisabled !== 'true' && pointer !== 'none'
            ))).toBe(true);
            expect(container.querySelector('[data-word-fill]')).toBeTruthy();
            expect(container.querySelector('[data-presentation="continuous-word"]')).toBeNull();
            if (visualMode !== 'interlocution') {
                expect(sourceGroup(container)?.querySelector('[data-word-fill]')).toBeNull();
            }

            panel.destroy();
            container.remove();
        }
    );

    it('keeps Focals free of source-family and word-fill chrome', () => {
        const { panel, container } = makePanel({
            visualMode: 'focals',
            interlocution: {
                sourceFamily: 'procedural',
                procedural: ['klee'],
                sourced: []
            }
        });

        expect(container.querySelector('[data-source-family]')).toBeNull();
        expect(container.querySelector('[data-word-fill]')).toBeNull();
        expect(container.querySelector('.vi-focals-panel')).toBeTruthy();
        expect(container.querySelector('.vi-focals-panel').hidden).toBe(false);

        panel.destroy();
        container.remove();
    });

    it('does not invent a fourth Presentation chip when word-fill is hoisted', async () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                presentation: 'continuous',
                sourceFamily: 'collections',
                procedural: [],
                sourced: ['aic-landscapes']
            }
        });

        expect([...container.querySelectorAll('[data-presentation]')].map(btn => btn.dataset.presentation))
            .toEqual(['continuous', 'behind-stream', 'full-frame']);
        expect(container.querySelector('[data-presentation="continuous-word"]')).toBeNull();
        expect(container.querySelector('[data-word-fill]')).toBeTruthy();

        panel.destroy();
        container.remove();
    });
});
