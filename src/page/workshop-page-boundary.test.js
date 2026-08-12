import { afterEach, describe, expect, it } from 'vitest';
import {
  workshopEditorDataToProject,
  workshopProjectToSessionConfig
} from '../core/workshop-project.js';
import { hydrateSessionSequenceAssets } from '../core/workshop-asset-durability.js';
import { compileSession } from '../core/session-compiler.js';
import { compileVisualScoreProgram } from '../core/visual-score-lane.js';
import { buildWorkshopVisualAssetRegistry } from '../components/workshop/workshop-visual-assets.js';
import { PageReader } from './PageReader.js';

const IMAGE = 'data:image/png;base64,cHJvamVjdA==';
const TEXT = 'Still water reflects the moon.';

describe('Workshop → Page visual boundary', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('preserves a held fallback and hydrates a passage personal focal end to end', async () => {
    const editor = {
      id: 'page-focal-project',
      title: 'Page focal project',
      intent: 'reflection',
      sources: [{
        id: 'source-1', name: 'Source', providerId: 'local',
        type: 'text/plain', data: TEXT
      }],
      wpm: 200,
      paceV2: true,
      chunkMode: 'word',
      curve: 'flat',
      displayMode: 'focal',
      soundscape: 'none',
      audioPreset: 'silent',
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: {
          presentation: 'continuous',
          fallbackCue: {
            kind: 'field', renderer: 'focal',
            config: { type: 'standard', standardGlyph: 'anchor' }
          }
        }
      },
      sequenceVisualAssets: [{
        id: 'portrait', kind: 'image', uri: IMAGE,
        name: 'Portrait', color: '#7fd4a4'
      }],
      visualScoreAssignments: [{
        id: 'passage-focal', sourceId: 'source-1', assetId: 'surface:focal',
        lane: 'visual', fromCharacter: 12, toCharacter: 20,
        quoteStart: 'reflects', quoteEnd: 'reflects',
        cue: {
          kind: 'field', renderer: 'focal',
          config: { type: 'personal', personalAssetId: 'portrait' }
        }
      }]
    };

    const registry = buildWorkshopVisualAssetRegistry({
      projectAssets: editor.sequenceVisualAssets,
      visualConfig: editor.visualConfig
    });
    editor.experienceProgram = compileVisualScoreProgram({
      programId: 'workshop-page-focal',
      sources: editor.sources.map(source => ({
        id: source.id, name: source.name, text: source.data
      })),
      assets: registry.map(entry => entry.asset),
      assignments: editor.visualScoreAssignments,
      visualFallback: editor.visualConfig.interlocution.fallbackCue
    });

    const project = workshopEditorDataToProject(editor, { id: editor.id });
    const sessionInput = await hydrateSessionSequenceAssets(
      workshopProjectToSessionConfig(project)
    );
    const session = compileSession(sessionInput);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const reader = new PageReader(host, { session, title: session.name });
    reader.render();

    expect(session.visualConfig.visualMode).toBe('interlocution');
    expect(host.querySelector('.page-masthead .page-focal')?.textContent).toBe('⚓');
    expect(host.querySelector('.page-passage-focal img')?.getAttribute('src')).toBe(IMAGE);
    expect(host.querySelector('.page-passage-focal')?.dataset.episode).toBe('passage-focal');
    expect(host.textContent).toContain('Still water');
    expect(host.textContent).toContain('reflects');
    reader.destroy();
  });
});
