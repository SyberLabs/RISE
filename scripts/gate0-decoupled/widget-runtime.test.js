import { describe, expect, it } from 'vitest';
import { CLIENT_LOG_LIMIT, validateSnapshot, createWidgetController } from './widget-runtime.mjs';
import { createDecoupledRunState, dispatchDecoupled } from './server.mjs';

const baseline = Object.freeze({
  runId: 'run-a', sequence: 0, visual: 'still', intensity: null,
  serverReceivedAt: null, serverAppliedAt: null, observedAt: '2026-10-03T12:00:00.000Z'
});
const snapshot = (sequence, visual = 'attractor', intensity = 0.65) => ({
  runId: 'run-a', sequence, visual, intensity,
  serverReceivedAt: `2026-10-03T12:00:0${sequence}.000Z`,
  serverAppliedAt: `2026-10-03T12:00:0${sequence}.500Z`,
  observedAt: `2026-10-03T12:00:0${sequence}.750Z`
});

describe('decoupled widget runtime', () => {
  it('validates and detaches the exact seven-field sequence-zero snapshot', () => {
    expect(validateSnapshot({ ...baseline })).not.toBeNull();
    expect(validateSnapshot({ ...baseline, sequence: 1 })).toBeNull();
    expect(validateSnapshot({ ...baseline, serverReceivedAt: '2026-10-03T12:00:00.001Z', serverAppliedAt: '2026-10-03T12:00:00.002Z' })).toBeNull();
    const input = { ...baseline };
    const accepted = validateSnapshot(input);
    input.observedAt = 'mutated';
    expect(accepted.observedAt).toBe(baseline.observedAt);
    expect(Object.isFrozen(accepted)).toBe(true);
  });

  it('keeps source from the bridge path and advances only after renderer acceptance', () => {
    const rendered = [];
    let frame;
    const controller = createWidgetController({
      mountAttractor: intensity => { const renderer = { intensity, destroy() { this.destroyed = true; } }; rendered.push(renderer); return renderer; },
      setIntensity: (intensity, renderer) => { renderer.intensity = intensity; return true; },
      showStill: () => {}, requestFrame: callback => { frame = callback; return 1; }, cancelFrame: () => {}
    });
    expect(controller.accept(baseline, 'initial_render').status).toBe('applied');
    expect(controller.accept(snapshot(1), 'host_notification').status).toBe('applied');
    expect(controller.accept(snapshot(1), 'manual_read').status).toBe('duplicate');
    expect(controller.accept(snapshot(2, 'attractor', 0.75), 'reader_mutation').status).toBe('applied');
    expect(controller.renderer).toBe(rendered[0]);
    expect(controller.renderer.intensity).toBe(0.75);
    expect(controller.sequence).toBe(2);
    expect(controller.runId).toBe('run-a');
    expect(controller.log.map(entry => entry.deliverySource)).toEqual(['initial_render', 'host_notification', 'manual_read', 'reader_mutation']);
    frame();
    expect(controller.log.at(-1).animationFrameObservedAt).toEqual(expect.any(String));
    controller.teardown();
    expect(controller.renderer).toBeNull();
    expect(rendered[0].destroyed).toBe(true);
  });

  it('opens the current nonzero snapshot after an earlier server mutation', async () => {
    const state = createDecoupledRunState({ runId: 'run-a', now: () => '2026-10-03T12:00:01.000Z' });
    const mutation = await (await dispatchDecoupled({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'rise_set_visual', arguments: { runId: 'run-a', visual: 'attractor', intensity: 0.4 } } }, state, '')).json();
    const opened = await (await dispatchDecoupled({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'rise_open_visual', arguments: {} } }, state, '')).json();
    const current = opened.result.structuredContent;
    expect(mutation.result.structuredContent.sequence).toBe(1);
    expect(validateSnapshot(current)).not.toBeNull();
    expect(current).toMatchObject({ runId: 'run-a', sequence: 1, visual: 'attractor', intensity: 0.4 });
    const controller = createWidgetController({ mountAttractor: intensity => ({ intensity, destroy() {} }), setIntensity: () => true, showStill: () => {}, requestFrame: () => 1, cancelFrame: () => {} });
    expect(controller.accept(current, 'initial_render').status).toBe('applied');
    expect(controller.sequence).toBe(1);
    expect(controller.runId).toBe('run-a');
    expect(controller.renderer.intensity).toBe(0.4);
    expect(state.sequence).toBe(1);
  });

  it('refuses invalid, mismatched, stale, forged-source, and renderer-refused snapshots', () => {
    let mounts = 0;
    const controller = createWidgetController({ mountAttractor: () => { mounts += 1; return null; }, setIntensity: () => false, showStill: () => {}, requestFrame: () => 1, cancelFrame: () => {} });
    expect(controller.accept({ ...snapshot(1), observedAt: 'invalid-time' }, 'initial_render').status).toBe('refused');
    expect(controller.accept(baseline, 'forged-source').status).toBe('refused');
    expect(controller.sequence).toBe(0);
    expect(mounts).toBe(0);
    expect(controller.accept(baseline, 'initial_render').status).toBe('applied');
    expect(controller.accept(snapshot(1), 'reader_mutation').status).toBe('refused');
    expect(controller.sequence).toBe(0);
    expect(mounts).toBe(1);
    const good = createWidgetController({ mountAttractor: () => ({ destroy() {} }), setIntensity: () => true, showStill: () => {}, requestFrame: () => 1, cancelFrame: () => {} });
    expect(good.accept(baseline, 'initial_render').status).toBe('applied');
    expect(good.accept(snapshot(2), 'host_notification').status).toBe('applied');
    expect(good.accept(snapshot(1), 'reader_mutation').status).toBe('stale');
    expect(good.accept({ ...snapshot(3), runId: 'run-b' }, 'manual_read').status).toBe('refused');
    expect(good.accept({ ...snapshot(3), extra: true }, 'host_notification').status).toBe('refused');
    expect(good.sequence).toBe(2);
  });

  it('caps evidence at 128 records and keeps teardown idempotent', () => {
    const controller = createWidgetController({ mountAttractor: () => ({ destroy() {} }), setIntensity: () => true, showStill: () => {}, requestFrame: () => 1, cancelFrame: () => {} });
    controller.accept(baseline, 'initial_render');
    for (let i = 0; i < 140; i += 1) controller.appendEvidence({ type: 'test', i });
    expect(CLIENT_LOG_LIMIT).toBe(128);
    expect(controller.log).toHaveLength(128);
    controller.teardown();
    controller.teardown();
    expect(controller.accept(snapshot(1), 'host_notification').status).toBe('ignored');
  });
});
