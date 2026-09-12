import { describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

/**
 * Browsers will not start audio without a gesture, and RISE has a path
 * that reaches a reading without collecting one: the threshold gate
 * grants access immediately when localStorage already holds a session,
 * so a returning reader is admitted with no click at all. The context is
 * then created suspended and the reading opens in silence.
 *
 * These cover the two decisions that path now makes. They call the
 * methods against a plain object rather than mounting a Chamber, because
 * what is under test is the decision, not the room.
 */
const wantsAudio = session =>
    Chamber.prototype._sessionWantsAudio.call({ session, audioEngine: {} });

describe('a reading that needs a clock', () => {
    it('knows when a session has something to say or play', () => {
        expect(wantsAudio({ recitation: { enabled: true } })).toBe(true);
        expect(wantsAudio({ soundscape: 'rain' })).toBe(true);
        expect(wantsAudio({ audioPreset: 'theta' })).toBe(true);
        expect(wantsAudio({ selectedSwellId: 'swell-1' })).toBe(true);
        expect(wantsAudio({ audioProgram: { segments: [{}] } })).toBe(true);
    });

    it('knows when it does not', () => {
        expect(wantsAudio({})).toBe(false);
        expect(wantsAudio({ soundscape: 'none' })).toBe(false);
        expect(wantsAudio({ audioPreset: 'silent' })).toBe(false);
        expect(wantsAudio({ audioProgram: { segments: [] } })).toBe(false);
        expect(wantsAudio({ recitation: { enabled: false } })).toBe(false);
    });

    it('needs no clock when there is no engine to ask', () => {
        expect(Chamber.prototype._sessionWantsAudio.call({
            session: { recitation: { enabled: true } },
            audioEngine: null
        })).toBe(false);
    });
});

describe('handing the opening back to the reader', () => {
    const room = () => {
        const pre = { style: { display: 'none', opacity: '0' } };
        const display = { style: { display: 'flex', opacity: '1' } };
        return {
            pre,
            display,
            ctx: {
                container: {
                    querySelector: sel => (sel === '#chamber-pre' ? pre
                        : sel === '#chamber-display' ? display : null)
                }
            }
        };
    };

    it('shows the threshold and hides the stream', () => {
        const { pre, display, ctx } = room();

        expect(Chamber.prototype._deferToGesture.call(ctx)).toBe(true);

        expect(display.style.display).toBe('none');
        expect(pre.style.display).toBe('');
        expect(pre.style.opacity).toBe('1');
    });

    it('reports failure when there is no threshold to show', () => {
        // A silent reading is still better than no reading, so the caller
        // carries on when this cannot help.
        expect(Chamber.prototype._deferToGesture.call({
            container: { querySelector: () => null }
        })).toBe(false);
    });
});
