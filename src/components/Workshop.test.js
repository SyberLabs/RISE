/**
 * Workshop refinement tests — craft-first architecture (creator leads,
 * shared shelves follow), the modern Atmosphere with soundscapes, and
 * exclusive-beds behavior matching the Chamber's audio panel.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    endVisualInterlocutionSession,
    grantVisualInterlocutionConsent
} from '../core/visual-safety.js';

// jsdom has no indexedDB; PersonalSwells probes it during pool render
if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

const { Workshop } = await import('./Workshop.js');

function makeWorkshop(onCreateSession = vi.fn(), options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const workshop = new Workshop(container, {
        onNavigate: vi.fn(),
        onCreateSession,
        ...options
    });
    return { workshop, container, onCreateSession };
}

describe('Workshop Composition Studio architecture', () => {
    it('coordinates one asset library, score canvas, and contextual inspector', () => {
        const { workshop, container } = makeWorkshop();

        const form = container.querySelector('#workshop-form');
        const panes = [...form.querySelectorAll(':scope > .studio-pane')];
        expect(panes.map(pane => [...pane.classList].find(name => name.startsWith('studio-')
            && name !== 'studio-pane'))).toEqual([
            'studio-asset-library', 'studio-score-canvas', 'studio-inspector'
        ]);

        // Audio defaults and personal entry events now share the same library
        // architecture instead of living in a subordinate settings shelf.
        expect(container.querySelector('.studio-shared-shelves')).toBeNull();
        expect(container.querySelector('.config-section')).toBeNull();
        expect(container.querySelector('[data-soundscape]')).toBeNull();
        expect(container.querySelector('#studio-audio-library-panel #personal-swell-list')).not.toBeNull();
        expect(container.querySelector('[data-asset-lane="audio"]').disabled).toBe(false);
        expect(container.querySelector('#visual-asset-search')).not.toBeNull();
        expect(container.querySelector('[data-asset-group="procedural"]')).not.toBeNull();
        expect(container.querySelector('#vi-panel-container')).toBeNull();

        container.remove();
    });

    it('presents exact images, collections, procedural families, shared assets, and surfaces together', () => {
        const { container } = makeWorkshop();
        const form = container.querySelector('#workshop-form');
        expect(form.textContent).toContain('Unified registry');
        expect(form.textContent).toContain('Passage visuals belong to selected text');
        expect(form.textContent).toContain('Old Masters');
        expect(form.textContent).toContain('Klee Lines');
        expect(form.textContent).toContain('Focal');
        expect(form.querySelector('[data-preview-ref="klee"]')?.getAttribute('style'))
            .toContain('gradient');
        expect(form.querySelector('[data-preview-ref="aic-oldmasters"]')).not.toBeNull();
        const registry = form.querySelector('#visual-assets-list');
        const presentation = form.querySelector('#studio-visual-presentation');
        expect(registry.compareDocumentPosition(presentation) & Node.DOCUMENT_POSITION_FOLLOWING)
            .toBeTruthy();
        expect(presentation.textContent).toContain('Presentation');
        expect(presentation.querySelector('[data-visual-surface="scored"]')).not.toBeNull();
        expect(form.querySelector('#studio-visual-inspector').textContent).not.toContain('Presentation');
        container.remove();
    });

    it('hydrates a selected collection card with the exact sampled artwork without dirtying the project', async () => {
        const resolveCollectionPreview = vi.fn().mockResolvedValue({
            url: 'https://images.example/old-masters.jpg',
            alt: 'Portrait sampled from Old Masters'
        });
        const { workshop, container } = makeWorkshop(vi.fn(), { resolveCollectionPreview });
        workshop.activate();
        workshop.editorDirty = false;

        workshop.selectEditorAsset('collection:aic-oldmasters');
        const entry = workshop.selectedVisualAssetEntry();
        await workshop.ensureCollectionPreview(entry);

        expect(resolveCollectionPreview).toHaveBeenCalledTimes(1);
        expect(resolveCollectionPreview).toHaveBeenCalledWith('aic-oldmasters', {
            signal: expect.any(AbortSignal)
        });
        const previews = container.querySelectorAll(
            '[data-preview-ref="aic-oldmasters"][data-preview-status="ready"]'
        );
        expect(previews.length).toBeGreaterThanOrEqual(2);
        expect([...previews].every(preview => preview.tagName === 'IMG')).toBe(true);
        expect(previews[0].getAttribute('src')).toBe('https://images.example/old-masters.jpg');
        expect(workshop.editorDirty).toBe(false);

        workshop.destroy();
        container.remove();
    });

    it('filters without dirtying the project and inspects selected assets contextually', () => {
        const { workshop, container } = makeWorkshop();
        workshop.editorDirty = false;

        container.querySelector('[data-asset-group="procedural"]').click();
        expect(workshop.visualAssetGroup).toBe('procedural');
        expect(workshop.editorDirty).toBe(false);
        expect(container.querySelectorAll('.studio-asset-card')).toHaveLength(6);

        container.querySelector('[data-editor-asset-id="procedural:klee"]').click();
        expect(container.querySelector('.studio-selected-asset')?.textContent).toContain('Klee Lines');
        expect(container.querySelector('[data-action="set-editor-asset-default"]')).not.toBeNull();
        expect(workshop.editorDirty).toBe(false);

        container.remove();
    });

    it('commits surface and procedural defaults through the contextual inspector contract', async () => {
        const { workshop, container } = makeWorkshop();

        expect(await workshop.setVisualSurface('focal')).toBe(true);
        expect(workshop.sessionData.visualConfig.visualMode).toBe('focals');
        expect(container.querySelector('[data-editor-asset-id="surface:focal"]')
            .closest('.studio-asset-card').classList.contains('is-default')).toBe(true);

        grantVisualInterlocutionConsent(workshop.visualConsentScope);
        expect(await workshop.setEditorAssetDefault('procedural:klee')).toBe(true);
        expect(workshop.sessionData.visualConfig).toMatchObject({
            visualMode: 'interlocution',
            interlocution: {
                sourceFamily: 'procedural',
                procedural: ['klee'],
                sourced: []
            }
        });

        endVisualInterlocutionSession();
        workshop.destroy();
        container.remove();
    });

    it('keeps project switching and transport actions above the score', () => {
        const { container } = makeWorkshop();

        const manager = container.querySelector('.workshop-sequence-manager');
        expect(manager.querySelector('#workshop-sequence-select')).not.toBeNull();
        expect(manager.textContent).toContain('Sequence');
        expect(container.querySelector('[data-action="reset-workshop"]')).not.toBeNull();
        expect(container.querySelector('.studio-header [data-action="preview"]')).not.toBeNull();
        expect(container.querySelector('.studio-header #create-btn')).not.toBeNull();

        container.remove();
    });

    it('keeps the library and inspector source counts synchronized with edits', () => {
        const { workshop, container } = makeWorkshop();

        workshop.addSource({
            id: 'counter-source',
            name: 'Counter source',
            type: 'text/plain',
            data: 'A source added after the shell was rendered.'
        }, { id: 'local' });

        expect(container.querySelector('[data-studio-source-count="number"]').textContent).toBe('1');
        expect(container.querySelector('[data-studio-source-count="label"]').textContent).toBe('1 source');

        workshop.removeSource(0);
        expect(container.querySelector('[data-studio-source-count="number"]').textContent).toBe('0');
        expect(container.querySelector('[data-studio-source-count="label"]').textContent).toBe('0 sources');

        container.remove();
    });
});

describe('Workshop Phase 6 audio authoring', () => {
    it('authors, replaces, erases, and restores an audio bed transactionally', () => {
        const { workshop, container } = makeWorkshop();
        workshop.addSource({
            id: 'audio-source', name: 'Audio source', type: 'text/plain',
            data: 'Alpha beta gamma delta epsilon.'
        }, { id: 'local', name: 'Local' });
        workshop.selectAudioAsset('soundscape:aurora');
        expect(workshop.scoreView).toBe('audio');
        expect(container.querySelector('button[data-score-view="audio"]').getAttribute('aria-selected')).toBe('true');

        workshop.pendingScoreSelection = {
            sourceId: 'audio-source', fromCharacter: 0, toCharacter: 16
        };
        expect(workshop.assignPendingAudioScore()).toBe(true);
        expect(workshop.sessionData.audioScoreAssignments).toHaveLength(1);
        expect(container.querySelector('.audio-score-mark')).not.toBeNull();
        expect(container.querySelector('.audio-score-clip').textContent).toContain('Aurora');

        workshop.selectAudioAsset('tone:deep');
        expect(workshop.replaceAudioAssignmentAsset(workshop.selectedAudioAssignmentId)).toBe(true);
        expect(workshop.sessionData.audioScoreAssignments[0].assetId).toBe('tone:deep');
        expect(workshop.undoAudioScore()).toBe(true);
        expect(workshop.sessionData.audioScoreAssignments[0].assetId).toBe('soundscape:aurora');
        expect(workshop.redoAudioScore()).toBe(true);
        expect(workshop.sessionData.audioScoreAssignments[0].assetId).toBe('tone:deep');

        workshop.eraseAudioAssignment(workshop.selectedAudioAssignmentId);
        expect(workshop.sessionData.audioScoreAssignments).toEqual([]);
        container.remove();
    });

    it('compiles visual, bed, and swell clips as independent synchronized tracks', () => {
        const { workshop, container } = makeWorkshop();
        workshop.addSource({
            id: 'combined-source', name: 'Combined source', type: 'text/plain',
            data: 'Alpha beta gamma delta epsilon.'
        }, { id: 'local', name: 'Local' });
        workshop.addSequenceVisualAsset('data:image/png;base64,Y29tYmluZWQ=', 'Combined');
        workshop.selectedScoreAssetId = workshop.sessionData.sequenceVisualAssets[0].id;
        workshop.pendingScoreSelection = { sourceId: 'combined-source', fromCharacter: 0, toCharacter: 16 };
        expect(workshop.assignPendingVisualScore()).toBe(true);
        const visual = workshop.sessionData.visualScoreAssignments[0];

        workshop.personalSwells = [{ id: 'bell', name: 'Bell' }];
        workshop.selectAudioAsset('swell:bell');
        workshop.pendingScoreSelection = { sourceId: 'combined-source', fromCharacter: 0, toCharacter: 16 };
        expect(workshop.assignPendingAudioScore()).toBe(true);
        expect(workshop.sessionData.audioScoreAssignments[0].syncGroup).toBe(`sync-${visual.id}`);

        const payload = workshop.prepareSessionPayload();
        expect(payload.experienceProgram.tracks.map(track => track.kind))
            .toEqual(['movement', 'visual', 'swell']);
        expect(payload.soundscape).toBe('none');
        expect(payload.audioPreset).toBe('silent');
        container.remove();
    });

    it('offers Visual, Audio, and Combined views with unambiguous highlight treatments', () => {
        const { workshop, container } = makeWorkshop();
        workshop.addSource({ id: 'views', name: 'Views', type: 'text/plain', data: 'Alpha beta gamma.' },
            { id: 'local', name: 'Local' });
        expect([...container.querySelectorAll('[data-action="set-score-view"]')]
            .map(button => button.textContent)).toEqual(['Visual', 'Audio', 'Combined']);
        container.querySelector('[data-score-view="combined"]').click();
        expect(workshop.scoreView).toBe('combined');
        expect(container.querySelector('.audio-score-lane')).not.toBeNull();
        expect(container.querySelector('[aria-label="Visual assignments"]')).not.toBeNull();
        container.remove();
    });
});

describe('Workshop visual score lane', () => {
    function addScoringFixture(workshop) {
        workshop.addSource({
            id: 'score-source',
            name: 'Score source',
            type: 'text/plain',
            data: 'Still water reflects the moon. Wind crosses the reeds.'
        }, { id: 'local' });
        const asset = workshop.addSequenceVisualAsset(
            'data:image/png;base64,c2NvcmU=',
            'Moon image'
        );
        workshop.updateVisualAssetsList();
        return asset;
    }

    it('authors a stable span from a DOM text selection and compiles its exact asset cue', () => {
        const { workshop, container } = makeWorkshop();
        const asset = addScoringFixture(workshop);
        const text = container.querySelector('#visual-score-text');
        const range = document.createRange();
        range.setStart(text.firstChild, 6);
        range.setEnd(text.firstChild, 20);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        container.querySelector('[data-action="assign-score-selection"]').click();

        expect(workshop.sessionData.visualScoreAssignments).toHaveLength(1);
        expect(workshop.sessionData.visualScoreAssignments[0]).toMatchObject({
            sourceId: 'score-source',
            assetId: asset.id,
            fromCharacter: 6,
            toCharacter: 20,
            quoteStart: 'water reflects'
        });
        expect(container.querySelector('.visual-score-mark')?.textContent).toBe('water reflects');
        expect(container.querySelector('.visual-score-preview img')?.getAttribute('src'))
            .toBe(asset.uri);

        const payload = workshop.prepareSessionPayload();
        const visualClip = payload.experienceProgram.tracks
            .find(track => track.kind === 'visual').clips[0];
        expect(visualClip.anchor).toMatchObject({
            sourceIds: ['score-source'],
            fromCharacter: 6,
            toCharacter: 20
        });
        expect(visualClip.cue.collections).toEqual([`sequence-asset:${asset.id}`]);
        expect(payload.sequenceVisualAssets[0].id).toBe(asset.id);

        workshop.destroy();
        container.remove();
    });

    it('requires deliberate replacement for overlaps and erases assignments from the lane', () => {
        const { workshop, container } = makeWorkshop();
        addScoringFixture(workshop);
        workshop.pendingScoreSelection = {
            sourceId: 'score-source', fromCharacter: 0, toCharacter: 11
        };
        expect(workshop.assignPendingVisualScore()).toBe(true);
        const originalId = workshop.sessionData.visualScoreAssignments[0].id;

        workshop.pendingScoreSelection = {
            sourceId: 'score-source', fromCharacter: 6, toCharacter: 19
        };
        expect(workshop.assignPendingVisualScore()).toBe(false);
        expect(workshop.sessionData.visualScoreAssignments.map(item => item.id)).toEqual([originalId]);
        expect(container.querySelector('#replace-score-overlap').classList.contains('hidden')).toBe(false);

        container.querySelector('#replace-score-overlap').click();
        expect(workshop.sessionData.visualScoreAssignments).toHaveLength(1);
        expect(workshop.sessionData.visualScoreAssignments[0]).toMatchObject({
            fromCharacter: 6,
            toCharacter: 19
        });
        expect(workshop.sessionData.visualScoreAssignments[0].id).not.toBe(originalId);
        const replacementId = workshop.sessionData.visualScoreAssignments[0].id;

        container.querySelector('[data-action="undo-visual-score"]').click();
        expect(workshop.sessionData.visualScoreAssignments.map(item => item.id)).toEqual([originalId]);
        container.querySelector('[data-action="redo-visual-score"]').click();
        expect(workshop.sessionData.visualScoreAssignments.map(item => item.id)).toEqual([replacementId]);

        container.querySelector('[data-action="erase-score-assignment"]').click();
        expect(workshop.sessionData.visualScoreAssignments).toEqual([]);
        expect(container.querySelector('.visual-score-empty')).not.toBeNull();

        container.querySelector('[data-action="undo-visual-score"]').click();
        expect(workshop.sessionData.visualScoreAssignments.map(item => item.id)).toEqual([replacementId]);

        workshop.destroy();
        container.remove();
    });

    it('assigns procedural and sourced collection cards through the same score interaction', () => {
        const { workshop, container } = makeWorkshop();
        workshop.addSource({
            id: 'mixed-source', name: 'Mixed source', type: 'text/plain',
            data: 'Klee crosses the threshold. Old masters answer.'
        }, { id: 'local' });

        workshop.selectEditorAsset('procedural:klee');
        workshop.pendingScoreSelection = {
            sourceId: 'mixed-source', fromCharacter: 0, toCharacter: 4
        };
        expect(workshop.assignPendingVisualScore()).toBe(true);
        expect(workshop.sessionData.visualScoreAssignments[0].assetId).toBe('procedural:klee');

        workshop.pendingScoreSelection = {
            sourceId: 'mixed-source', fromCharacter: 28, toCharacter: 39
        };
        workshop.selectEditorAsset('collection:aic-oldmasters');
        expect(container.querySelector('#visual-score-selection').textContent).toContain('Old masters');
        container.querySelector('[data-action="assign-score-selection"]').click();
        expect(workshop.sessionData.visualScoreAssignments).toHaveLength(2);

        const payload = workshop.prepareSessionPayload();
        const cues = payload.experienceProgram.tracks
            .find(track => track.kind === 'visual').clips.map(clip => clip.cue);
        expect(cues).toEqual([
            { kind: 'procedural', collections: ['klee'] },
            { kind: 'sourced', collections: ['aic-oldmasters'] }
        ]);
        expect(payload.visualConfig.interlocution.sourceFamily).toBe('blend');
        expect(container.querySelector('[data-editor-asset-id="collection:aic-oldmasters"]')
            .closest('.studio-asset-card').textContent).toContain('1 clip');

        workshop.destroy();
        container.remove();
    });

    it('replaces a selected clip asset as one undoable command', () => {
        const { workshop, container } = makeWorkshop();
        workshop.addSource({
            id: 'replace-source', name: 'Replace source', type: 'text/plain',
            data: 'A visual relationship can change without moving its anchor.'
        }, { id: 'local' });
        workshop.selectEditorAsset('procedural:klee');
        workshop.pendingScoreSelection = {
            sourceId: 'replace-source', fromCharacter: 2, toCharacter: 21
        };
        workshop.assignPendingVisualScore();
        const assignment = workshop.sessionData.visualScoreAssignments[0];

        workshop.selectEditorAsset('procedural:turrell');
        expect(container.querySelector('[data-action="replace-score-asset"]')).not.toBeNull();
        container.querySelector('[data-action="replace-score-asset"]').click();
        expect(workshop.sessionData.visualScoreAssignments[0]).toMatchObject({
            id: assignment.id, assetId: 'procedural:turrell',
            fromCharacter: assignment.fromCharacter, toCharacter: assignment.toCharacter
        });

        workshop.undoVisualScore();
        expect(workshop.sessionData.visualScoreAssignments[0].assetId).toBe('procedural:klee');

        workshop.destroy();
        container.remove();
    });

    it('removing a sequence image also removes every span assigned to it', () => {
        const { workshop, container } = makeWorkshop();
        addScoringFixture(workshop);
        workshop.pendingScoreSelection = {
            sourceId: 'score-source', fromCharacter: 0, toCharacter: 11
        };
        workshop.assignPendingVisualScore();

        const remove = container.querySelector('[data-action="remove-visual"]');
        remove.click();
        expect(workshop.sessionData.sequenceVisualAssets).toHaveLength(1);
        expect(remove.textContent).toContain('Confirm');
        expect(document.activeElement).toBe(remove);
        remove.click();

        expect(workshop.sessionData.sequenceVisualAssets).toEqual([]);
        expect(workshop.sessionData.visualScoreAssignments).toEqual([]);
        expect(container.querySelector('.visual-score-empty')).not.toBeNull();

        workshop.destroy();
        container.remove();
    });

    it('persists stable asset and span identities with the canonical score', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container } = makeWorkshop();
        const asset = addScoringFixture(workshop);
        workshop.sessionData.title = 'Scored sequence';
        workshop.pendingScoreSelection = {
            sourceId: 'score-source', fromCharacter: 0, toCharacter: 11
        };
        workshop.assignPendingVisualScore();
        const assignmentId = workshop.sessionData.visualScoreAssignments[0].id;

        const saved = workshop.persistSequenceToVault();

        expect(saved.sequenceVisualAssets[0].id).toBe(asset.id);
        expect(saved.visualScoreAssignments[0]).toMatchObject({
            id: assignmentId,
            assetId: asset.id
        });
        expect(saved.experienceProgram.metadata.kind).toBe('workshop-visual-score');
        expect(saved.experienceProgram.tracks.find(track => track.kind === 'visual').clips[0].id)
            .toBe(assignmentId);

        workshop.destroy();
        container.remove();
        localStorage.removeItem('rise_workshop_v1');
    });
});

describe('Workshop visual selection repair', () => {
    function addSelectionSource(workshop) {
        workshop.addSource({
            id: 'selection-source', name: 'Selection source', type: 'text/plain',
            data: 'The selected passage opens its own visual assignment palette.'
        }, { id: 'local' });
    }

    function selectCharacters(container, fromCharacter, toCharacter) {
        const text = container.querySelector('#visual-score-text');
        const range = document.createRange();
        range.setStart(text.firstChild, fromCharacter);
        range.setEnd(text.firstChild, toCharacter);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return text;
    }

    it('opens a contextual palette on pointer lift and preserves the source span while choosing a visual', async () => {
        const { workshop, container } = makeWorkshop();
        addSelectionSource(workshop);
        workshop.activate();

        const text = container.querySelector('#visual-score-text');
        text.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        selectCharacters(container, 4, 20);
        document.dispatchEvent(new Event('selectionchange'));
        expect(workshop.pendingScoreSelection).toBeNull();

        text.dispatchEvent(new Event('pointerup', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 90));
        expect(workshop.pendingScoreSelection).toEqual({
            sourceId: 'selection-source', fromCharacter: 4, toCharacter: 20
        });
        expect(container.querySelector('.studio-passage-popover')?.getAttribute('role')).toBe('dialog');
        expect(container.querySelector('.studio-passage-popover').textContent).toContain('selected passage');

        const picker = container.querySelector('[data-passage-asset-picker]');
        picker.value = 'procedural:klee';
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(workshop.pendingScoreSelection).toEqual({
            sourceId: 'selection-source', fromCharacter: 4, toCharacter: 20
        });
        expect(window.getSelection().toString()).toBe('selected passage');

        const assign = container.querySelector('.studio-passage-popover [data-action="assign-score-selection"]');
        expect(assign.disabled).toBe(false);
        assign.click();
        expect(container.querySelector('.visual-score-mark')?.textContent).toBe('selected passage');
        expect(container.querySelector('.studio-passage-popover.is-confirmation')).not.toBeNull();

        workshop.destroy();
        container.remove();
    });

    it('captures scoped selectionchange, touchend, and keyboard selection paths', async () => {
        const { workshop, container } = makeWorkshop();
        addSelectionSource(workshop);
        workshop.activate();

        selectCharacters(container, 0, 3);
        document.dispatchEvent(new Event('selectionchange'));
        await new Promise(resolve => setTimeout(resolve, 90));
        expect(workshop.pendingScoreSelection).toMatchObject({ fromCharacter: 0, toCharacter: 3 });

        workshop.cancelPendingScoreSelection({ announce: false });
        const touchText = selectCharacters(container, 4, 12);
        touchText.dispatchEvent(new Event('touchend', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 95));
        expect(workshop.pendingScoreSelection).toMatchObject({ fromCharacter: 4, toCharacter: 12 });

        workshop.cancelPendingScoreSelection({ announce: false });
        const keyboardText = selectCharacters(container, 13, 20);
        keyboardText.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
        expect(workshop.pendingScoreSelection).toMatchObject({ fromCharacter: 13, toCharacter: 20 });

        workshop.destroy();
        container.remove();
    });

    it('activates Scored for the first assignment and lets the author undo only that activation', () => {
        const { workshop, container } = makeWorkshop();
        addSelectionSource(workshop);
        workshop.selectEditorAsset('procedural:klee');
        workshop.pendingScoreSelection = {
            sourceId: 'selection-source', fromCharacter: 4, toCharacter: 20
        };

        expect(workshop.visualSurface()).toBe('off');
        expect(workshop.assignPendingVisualScore()).toBe(true);
        expect(workshop.visualSurface()).toBe('scored');
        expect(container.querySelector('.visual-score-activation-notice')?.textContent)
            .toContain('Scored visuals activated');

        container.querySelector('[data-action="undo-scored-activation"]').click();
        expect(workshop.visualSurface()).toBe('off');
        expect(workshop.sessionData.visualScoreAssignments).toHaveLength(1);
        expect(workshop.prepareSessionPayload().visualConfig.visualMode).toBe('off');
        expect(container.querySelector('.visual-score-activation-notice')).toBeNull();

        workshop.destroy();
        container.remove();
    });

    it('offers immediate preview, replace, and erase controls after assignment', async () => {
        const { workshop, container } = makeWorkshop();
        addSelectionSource(workshop);
        workshop.selectEditorAsset('procedural:klee');
        workshop.pendingScoreSelection = {
            sourceId: 'selection-source', fromCharacter: 4, toCharacter: 20
        };
        workshop.assignPendingVisualScore();
        const assignmentId = workshop.sessionData.visualScoreAssignments[0].id;

        const picker = container.querySelector('.is-confirmation [data-passage-asset-picker]');
        picker.value = 'procedural:turrell';
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        container.querySelector('[data-action="replace-score-confirmation"]').click();
        expect(workshop.sessionData.visualScoreAssignments[0]).toMatchObject({
            id: assignmentId, assetId: 'procedural:turrell'
        });

        container.querySelector('[data-action="preview-score-assignment"]').click();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(document.activeElement).toBe(container.querySelector('.visual-score-preview'));

        container.querySelector('.studio-passage-popover [data-action="erase-score-assignment"]').click();
        expect(workshop.sessionData.visualScoreAssignments).toEqual([]);
        expect(container.querySelector('.studio-passage-popover')).toBeNull();

        workshop.destroy();
        container.remove();
    });

    it('closes the Source Library after adding a source and returns focus to the text', async () => {
        const { workshop, container } = makeWorkshop(vi.fn(), { viewportWidth: 390 });
        workshop.setStudioSurface('sources', { focus: false });
        workshop.openSourceBrowser();
        const browser = workshop.sourceBrowser;
        browser.onSelect({
            id: 'browser-source', name: 'Browser source', type: 'text/plain', data: 'Added once.'
        }, { id: 'local' });

        expect(browser._destroyed).toBe(true);
        expect(workshop.sessionData.sources).toHaveLength(1);
        expect(workshop.studioSurface).toBe('score');
        await new Promise(resolve => setTimeout(resolve, 340));
        expect(workshop.sourceBrowser).toBeNull();
        expect(document.activeElement).toBe(container.querySelector('#visual-score-text'));

        workshop.destroy();
        container.remove();
    });
});

describe('Workshop draft lifecycle', () => {
    it('binds visual consent to the launched draft without persisting the scope', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container, onCreateSession } = makeWorkshop();
        workshop.sessionData.title = 'Scoped visual session';
        workshop.addSource({
            id: 'scope-source',
            name: 'Scope source',
            type: 'text/plain',
            data: 'a bounded draft'
        }, { id: 'local' });
        const expectedScope = workshop.visualConsentScope;

        workshop.createSession();

        expect(onCreateSession).toHaveBeenCalledWith(expect.objectContaining({
            visualConfig: expect.objectContaining({ consentScope: expectedScope })
        }));
        const [saved] = JSON.parse(localStorage.getItem('rise_workshop_v1'));
        expect(saved.visualConfig?.consentScope).toBeUndefined();

        workshop.destroy();
        container.remove();
        localStorage.removeItem('rise_workshop_v1');
    });

    it('opens Recursion on a clean canvas and keeps prior unsaved work memory-only', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container } = makeWorkshop();

        workshop.sessionData.title = 'Unfinished study';
        workshop.addSource({
            id: 'draft-source',
            name: 'Draft source',
            type: 'text/plain',
            data: 'material still being arranged'
        }, { id: 'local' });

        workshop.update({ draftIntent: 'new-recursion', text: 'what remained after the session' });

        expect(workshop.sessionData.title).toBe('');
        expect(workshop.sessionData.sources).toHaveLength(1);
        expect(workshop.sessionData.sources[0].metadata.source).toBe('chamber-recursion');
        expect(workshop.suspendedDrafts).toHaveLength(1);
        expect(localStorage.getItem('rise_workshop_v1')).toBeNull();

        const draftId = workshop.suspendedDrafts[0].id;
        const picker = container.querySelector('#workshop-sequence-select');
        picker.value = `draft:${draftId}`;
        picker.dispatchEvent(new Event('change', { bubbles: true }));

        expect(workshop.sessionData.title).toBe('Unfinished study');
        expect(workshop.sessionData.sources[0].name).toBe('Draft source');
        expect(workshop.suspendedDrafts.some(draft => draft.data.sources[0]?.metadata?.source === 'chamber-recursion')).toBe(true);

        workshop.destroy();
        container.remove();
    });

    it('clears a saved sequence and reopens it for explicit editing without duplicating it', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container } = makeWorkshop();

        workshop.sessionData.title = 'First form';
        workshop.addSource({
            id: 'one',
            name: 'Source one',
            type: 'text/plain',
            data: 'one two three'
        }, { id: 'local' });
        container.querySelector('[data-action="save-draft"]').click();

        const [saved] = JSON.parse(localStorage.getItem('rise_workshop_v1'));
        expect(workshop.sessionData.title).toBe('');
        expect(workshop.sessionData.sources).toHaveLength(0);

        const picker = container.querySelector('#workshop-sequence-select');
        picker.value = `saved:${saved.id}`;
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        expect(workshop.sessionData.title).toBe('First form');

        const titleInput = container.querySelector('#session-title');
        titleInput.value = 'Revised form';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        container.querySelector('[data-action="save-draft"]').click();

        const blueprints = JSON.parse(localStorage.getItem('rise_workshop_v1'));
        expect(blueprints).toHaveLength(1);
        expect(blueprints[0].id).toBe(saved.id);
        expect(blueprints[0].title).toBe('Revised form');
        expect(workshop.sessionData.sources).toHaveLength(0);

        workshop.destroy();
        container.remove();
        localStorage.removeItem('rise_workshop_v1');
    });

    it('requires confirmation before Reset discards the active draft', () => {
        const { workshop, container } = makeWorkshop();
        const titleInput = container.querySelector('#session-title');
        titleInput.value = 'Do not discard accidentally';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));

        const reset = container.querySelector('[data-action="reset-workshop"]');
        reset.click();
        expect(workshop.sessionData.title).toBe('Do not discard accidentally');
        expect(reset.textContent).toContain('Confirm Reset');

        reset.click();
        expect(workshop.sessionData.title).toBe('');
        expect(workshop.suspendedDrafts).toHaveLength(0);

        workshop.destroy();
        container.remove();
    });
});

describe('Workshop atmosphere: exclusive beds', () => {
    function chooseAudio(container, assetId) {
        container.querySelector(`[data-audio-asset-id="${assetId}"]`).click();
        container.querySelector('[data-action="apply-audio-default"]').click();
    }

    it('keeps selection ephemeral and commits through the Audio Inspector', () => {
        const { workshop, container } = makeWorkshop();
        workshop.editorDirty = false;

        container.querySelector('[data-audio-asset-id="soundscape:aurora"]').click();
        expect(workshop.sessionData.soundscape).toBe('none');
        expect(workshop.editorDirty).toBe(false);
        expect(container.querySelector('#studio-audio-inspector').open).toBe(true);

        container.querySelector('[data-action="apply-audio-default"]').click();
        expect(workshop.sessionData.soundscape).toBe('aurora');
        expect(workshop.editorDirty).toBe(true);
        expect(container.querySelector('[data-audio-bed]').textContent).toBe('Aurora');

        workshop.destroy();
        container.remove();
    });

    it('owns and stops exact audio previews without changing project defaults', async () => {
        const audioEngine = {
            init: vi.fn().mockResolvedValue(undefined),
            resume: vi.fn().mockResolvedValue(undefined),
            applyPreset: vi.fn(),
            startSoundscape: vi.fn(),
            stopSoundscape: vi.fn(),
            playSwell: vi.fn().mockResolvedValue(undefined),
            stopSwell: vi.fn()
        };
        const { workshop, container } = makeWorkshop(vi.fn(), {
            audioEngineProvider: () => audioEngine,
            audioPreviewDurationMs: 30000
        });

        workshop.selectAudioAsset('soundscape:aurora');
        await workshop.previewSelectedAudioDefault();
        expect(audioEngine.startSoundscape).toHaveBeenCalledWith('aurora');
        expect(workshop.sessionData.soundscape).toBe('none');
        expect(container.querySelector('[data-action="stop-audio-preview"]').disabled).toBe(false);

        workshop.audioPreview.stop();
        expect(audioEngine.stopSoundscape).toHaveBeenCalledWith(true);
        expect(workshop.audioPreviewState.state).toBe('idle');

        workshop.selectAudioAsset('swell:personal');
        await workshop.previewSelectedAudioDefault('exact-swell-id');
        expect(audioEngine.playSwell).toHaveBeenCalledWith('exact-swell-id');
        workshop.destroy();
        expect(audioEngine.stopSwell).toHaveBeenCalledWith(true);
        container.remove();
    });

    it('keeps conductor controls synchronized without reconstructing the score canvas', () => {
        const { workshop, container } = makeWorkshop();
        workshop.addSource({
            id: 'paced-source', name: 'Paced source', type: 'text/plain',
            data: Array.from({ length: 200 }, (_, index) => `word${index}`).join(' ')
        }, { id: 'local' });
        const scoreCanvas = container.querySelector('.studio-score-canvas');
        const slider = container.querySelector('#wpm-slider');

        slider.value = '400';
        slider.dispatchEvent(new Event('input', { bubbles: true }));

        expect(container.querySelector('[data-reading-summary]').textContent).toContain('400 WPM');
        expect(container.querySelector('[data-reading-duration]').textContent).toBe('30 sec');
        expect(container.querySelector('.studio-score-canvas')).toBe(scoreCanvas);

        workshop.destroy();
        container.remove();
    });

    it('offers audio defaults in the unified library with Silence active by default', () => {
        const { workshop, container } = makeWorkshop();
        const cards = container.querySelectorAll('[data-audio-card-id]');
        expect(cards).toHaveLength(7);
        expect(container.querySelector('[data-audio-card-id="tone:silent"]')
            .classList.contains('is-current')).toBe(true);
        expect(workshop.sessionData.soundscape).toBe('none');
        container.remove();
    });

    it('a soundscape rests the tones; a tone bed rests the soundscape', () => {
        const { workshop, container } = makeWorkshop();

        chooseAudio(container, 'tone:gateway');
        expect(workshop.sessionData.audioPreset).toBe('gateway');

        chooseAudio(container, 'soundscape:aurora');
        expect(workshop.sessionData.soundscape).toBe('aurora');
        expect(workshop.sessionData.audioPreset).toBe('silent');
        expect(container.querySelector('[data-audio-card-id="soundscape:aurora"]')
            .classList.contains('is-current')).toBe(true);

        chooseAudio(container, 'tone:deep');
        expect(workshop.sessionData.soundscape).toBe('none');
        expect(container.querySelector('[data-audio-card-id="tone:deep"]')
            .classList.contains('is-current')).toBe(true);

        container.remove();
    });

    it("'Personal' is an entry swell, not a bed — it coexists with a soundscape", () => {
        const { workshop, container } = makeWorkshop();

        chooseAudio(container, 'soundscape:faded-signal');
        chooseAudio(container, 'swell:personal');

        expect(workshop.sessionData.audioPreset).toBe('personal');
        expect(workshop.sessionData.soundscape).toBe('faded-signal');

        container.remove();
    });

    it('the soundscape rides the blueprint into the Vault', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container } = makeWorkshop();

        chooseAudio(container, 'soundscape:aurora');
        workshop.sessionData.title = 'Aurora Session';
        container.querySelector('[data-action="save-draft"]').click();

        const [saved] = JSON.parse(localStorage.getItem('rise_workshop_v1'));
        expect(saved.schema).toBe('rise.workshop-project.v1');
        expect(saved.defaults.audio.soundscape).toBe('aurora');

        container.remove();
        localStorage.removeItem('rise_workshop_v1');
    });
});

describe('Workshop Phase 5 responsive and accessibility contracts', () => {
    function addResponsiveFixture(workshop) {
        workshop.addSource({
            id: 'responsive-source', name: 'Responsive source', type: 'text/plain',
            data: 'The selected passage survives every responsive surface transition.'
        }, { id: 'local' });
        return workshop.addSequenceVisualAsset(
            'data:image/png;base64,cmVzcG9uc2l2ZQ==',
            'Responsive image'
        );
    }

    it('preserves a captured phone selection through the asset sheet and Assign', () => {
        const { workshop, container } = makeWorkshop(vi.fn(), { viewportWidth: 390 });
        const asset = addResponsiveFixture(workshop);
        const scoreText = container.querySelector('#visual-score-text');
        workshop.pendingScoreSelection = {
            sourceId: 'responsive-source', fromCharacter: 4, toCharacter: 20
        };
        workshop.refreshSelectionActionBar();

        container.querySelector('[data-action="choose-score-asset"]').click();
        expect(container.querySelector('.workshop-studio').dataset.studioSurface).toBe('assets');
        expect(workshop.pendingScoreSelection).toEqual({
            sourceId: 'responsive-source', fromCharacter: 4, toCharacter: 20
        });
        expect(container.querySelector('#visual-score-text')).toBe(scoreText);

        container.querySelector('#studio-selection-actions [data-action="assign-score-selection"]').click();
        expect(workshop.sessionData.visualScoreAssignments).toHaveLength(1);
        expect(workshop.sessionData.visualScoreAssignments[0].assetId).toBe(asset.id);
        expect(container.querySelector('.workshop-studio').dataset.studioSurface).toBe('score');

        workshop.destroy();
        container.remove();
    });

    it('models tablet drawers without reconstructing the canvas or losing active clips', () => {
        const { workshop, container } = makeWorkshop(vi.fn(), { viewportWidth: 900 });
        addResponsiveFixture(workshop);
        workshop.pendingScoreSelection = {
            sourceId: 'responsive-source', fromCharacter: 0, toCharacter: 3
        };
        workshop.assignPendingVisualScore();
        const assignmentId = workshop.sessionData.visualScoreAssignments[0].id;
        const canvas = container.querySelector('.studio-score-canvas');

        container.querySelector('[data-studio-surface-target="sources"]').click();
        expect(container.querySelector('.workshop-studio').dataset.studioSurface).toBe('sources');
        expect(container.querySelector('.studio-score-canvas')).toBe(canvas);
        workshop.selectScoreAssignment(assignmentId);
        container.querySelector('[data-studio-surface-target="inspector"]').click();
        expect(workshop.selectedScoreAssignmentId).toBe(assignmentId);
        expect(container.querySelector('.studio-score-canvas')).toBe(canvas);

        workshop.destroy();
        container.remove();
    });

    it('uses roving keyboard focus for asset listboxes and library tabs', () => {
        const { workshop, container } = makeWorkshop();
        const visualOptions = [...container.querySelectorAll('#visual-assets-list [role="option"]')];
        visualOptions[0].focus();
        visualOptions[0].dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', bubbles: true
        }));
        expect(document.activeElement).toBe(visualOptions[1]);
        expect(visualOptions[1].tabIndex).toBe(0);

        const visualTab = container.querySelector('[data-asset-lane="visual"]');
        visualTab.focus();
        visualTab.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight', bubbles: true
        }));
        expect(document.activeElement).toBe(container.querySelector('[data-asset-lane="audio"]'));
        expect(workshop.activeAssetLane).toBe('audio');

        workshop.destroy();
        container.remove();
    });

    it('restores focus after partial registry refreshes and responsive drawer close', async () => {
        const { workshop, container } = makeWorkshop(vi.fn(), { viewportWidth: 390 });
        const option = container.querySelector('[data-editor-asset-id="procedural:klee"]');
        option.focus();
        option.click();
        expect(document.activeElement?.dataset.focusKey).toBe('visual-asset:procedural:klee');

        const assetsNav = container.querySelector('[data-studio-surface-target="assets"]');
        assetsNav.focus();
        assetsNav.click();
        container.querySelector('.studio-asset-library [data-action="close-studio-surface"]').click();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(document.activeElement).toBe(assetsNav);

        workshop.destroy();
        container.remove();
    });

    it('traps source previews as dialogs and restores focus when they close', async () => {
        const { workshop, container } = makeWorkshop();
        workshop.addSource({
            id: 'preview-source', name: 'Preview source', type: 'text/plain', data: 'Preview text.'
        }, { id: 'local' });
        const trigger = container.querySelector('[data-action="preview-source"]');
        trigger.focus();
        trigger.click();

        const dialog = document.querySelector('.source-preview-modal');
        expect(dialog.getAttribute('role')).toBe('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.contains(document.activeElement)).toBe(true);
        dialog.querySelector('.source-preview-close').click();
        await new Promise(resolve => setTimeout(resolve, 220));
        expect(document.activeElement).toBe(trigger);
        expect(document.querySelector('.source-preview-modal')).toBeNull();

        workshop.destroy();
        container.remove();
    });

    it('makes highlights keyboard-selectable and exposes names beyond colour', () => {
        const { workshop, container } = makeWorkshop();
        addResponsiveFixture(workshop);
        workshop.pendingScoreSelection = {
            sourceId: 'responsive-source', fromCharacter: 4, toCharacter: 20
        };
        workshop.assignPendingVisualScore();
        workshop.selectedScoreAssignmentId = null;
        workshop.updateVisualScoreEditor();

        const highlight = container.querySelector('.visual-score-mark');
        expect(highlight.getAttribute('role')).toBe('button');
        expect(highlight.getAttribute('aria-label')).toContain('Responsive image');
        highlight.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(workshop.selectedScoreAssignmentId).not.toBeNull();

        workshop.destroy();
        container.remove();
    });

    it('bounds a 512-clip lane while retaining every source highlight', () => {
        const { workshop, container } = makeWorkshop();
        const sourceText = Array.from({ length: 512 }, () => 'a').join(' ');
        workshop.sessionData.sources = Array.from({ length: 16 }, (_, index) => ({
            id: index === 0 ? 'dense-source' : `support-${index}`,
            name: `Dense source ${index + 1}`, type: 'text/plain',
            data: index === 0 ? sourceText : `supporting source ${index}`,
            words: index === 0 ? 512 : 3, providerId: 'local'
        }));
        const assets = Array.from({ length: 24 }, (_, index) => workshop.addSequenceVisualAsset(
            `data:image/png;base64,ZGVuc2Ut${index}`, `Dense image ${index + 1}`
        ));
        workshop.sessionData.visualScoreAssignments = Array.from({ length: 512 }, (_, index) => ({
            id: `dense-${index}`, sourceId: 'dense-source', assetId: assets[index % assets.length].id,
            fromCharacter: index * 2, toCharacter: index * 2 + 1,
            quoteStart: 'a', quoteEnd: 'a'
        }));
        workshop.activeScoreSourceId = 'dense-source';
        workshop.selectedScoreAssignmentId = 'dense-511';
        const startedAt = performance.now();
        workshop.refreshVisualScoreView();
        const elapsed = performance.now() - startedAt;

        expect(container.querySelectorAll('.visual-score-mark')).toHaveLength(512);
        expect(container.querySelectorAll('.visual-score-clip')).toHaveLength(161);
        expect(container.querySelector('.visual-score-lane-limit').textContent).toContain('512 clips');
        expect(workshop.sessionData.sources).toHaveLength(16);
        expect(workshop.sessionData.sequenceVisualAssets).toHaveLength(24);
        expect(elapsed).toBeLessThan(2000);

        workshop.destroy();
        container.remove();
    });

    it('keeps internal runtime terminology out of the public Studio copy', () => {
        const { workshop, container } = makeWorkshop();
        const copy = container.textContent.toLowerCase();
        expect(copy).not.toContain('interlocution');
        expect(copy).not.toContain('source family');
        expect(copy).not.toContain('compatibility projection');
        expect(copy).not.toContain('lowering');
        workshop.destroy();
        container.remove();
    });

    it('releases resize, preview, timer, and collection ownership on destroy', () => {
        const audioEngine = {
            stopSoundscape: vi.fn(), stopSwell: vi.fn(), applyPreset: vi.fn()
        };
        const { workshop, container } = makeWorkshop(vi.fn(), {
            viewportWidth: 1280, audioEngineProvider: () => audioEngine
        });
        workshop.resetTimer = setTimeout(() => {}, 10000);
        workshop.assetRemovalTimer = setTimeout(() => {}, 10000);
        workshop.announcementTimer = setTimeout(() => {}, 10000);
        workshop.visualSelectionCaptureTimer = setTimeout(() => {}, 10000);
        workshop.activate();
        const viewportBeforeDestroy = workshop.studioViewport;

        workshop.destroy();
        expect(workshop.collectionPreviewAbortController.signal.aborted).toBe(true);
        expect(workshop.resetTimer).toBeNull();
        expect(workshop.assetRemovalTimer).toBeNull();
        expect(workshop.announcementTimer).toBeNull();
        expect(workshop.visualSelectionCaptureTimer).toBeNull();
        expect(workshop.boundContainerKeydownHandler).toBeNull();
        window.dispatchEvent(new Event('resize'));
        expect(workshop.studioViewport).toBe(viewportBeforeDestroy);

        container.remove();
    });
});
