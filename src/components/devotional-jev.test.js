import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rosarium } from './Rosarium.js';
import { Via } from './Via.js';

afterEach(() => vi.useRealTimers());

for (const [Room, phase] of [[Rosarium, 'strand'], [Via, 'walking']]) {
    describe(`${Room.name} mandatory decisions`, () => {
        function fixture(allow) {
            const room = Object.create(Room.prototype);
            Object.assign(room, {
                phase, stepIndex: -1, _jevGeneration: 1,
                jev: { allow, destroy: vi.fn() },
                compiled: { steps: [
                    { text: 'First fixed prayer', durationMs: 1000, state: { bead: 0 } },
                    { text: 'Second fixed prayer', durationMs: 1000, state: { bead: 1 } }
                ] },
                strand: { setBead: vi.fn(), reset: vi.fn() },
                renderOverlay: vi.fn(), renderStage: vi.fn(), _mountPrayerArt: vi.fn(),
                _startSound: vi.fn(), _stopSound: vi.fn(), _beginVisualGeneration: vi.fn(),
                onNavigate: vi.fn()
            });
            return room;
        }

        it('does not reveal or skip a prayer while a decision is pending', async () => {
            let resolve;
            const allow = vi.fn(() => new Promise(done => { resolve = done; }));
            const room = fixture(allow);
            const pending = room.advance();
            await room.advance();
            expect(room.stepIndex).toBe(-1);
            expect(room.renderOverlay).not.toHaveBeenCalled();
            expect(room.renderStage).not.toHaveBeenCalled();
            expect(allow).toHaveBeenCalledOnce();
            resolve('continue');
            await pending;
            expect(room.stepIndex).toBe(0);
            expect(allow).toHaveBeenCalledWith('First fixed prayer');
        });

        it('cannot reveal a late prayer after exit', async () => {
            let resolve;
            const room = fixture(() => new Promise(done => { resolve = done; }));
            const pending = room.advance();
            room._exitToChapel();
            resolve('continue');
            await pending;
            expect(room.stepIndex).toBe(-1);
            expect(room.onNavigate).toHaveBeenCalledWith('chapel');
            expect(room._startSound).not.toHaveBeenCalled();
        });

        it('leaves without revealing text if the reader cancels consent', async () => {
            const room = fixture(async () => null);
            await room.advance();
            expect(room.stepIndex).toBe(-1);
            expect(room.onNavigate).toHaveBeenCalledWith('chapel');
        });

        it('cancels a pending decision when Escape returns to the chooser', async () => {
            let resolve;
            const room = fixture(() => new Promise(done => { resolve = done; }));
            const pending = room.advance();
            room.handleEscape();
            expect(room.jev.destroy).toHaveBeenCalledOnce();
            resolve('continue');
            await pending;
            expect(room.phase).toBe('choosing');
            expect(room.stepIndex).toBe(-1);
            expect(room._startSound).not.toHaveBeenCalled();
        });

        it('slows the fixed duration without changing the authored prayer', async () => {
            vi.useFakeTimers();
            const room = fixture(async () => 'slower');
            room.autoAdvance = true;
            await room.advance();
            expect(room.compiled.steps[0].text).toBe('First fixed prayer');
            expect(vi.getTimerCount()).toBe(1);
            vi.advanceTimersByTime(1000);
            expect(room.stepIndex).toBe(0);
            expect(vi.getTimerCount()).toBe(1);
            vi.clearAllTimers();
        });
    });
}
