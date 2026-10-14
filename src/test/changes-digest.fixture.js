/**
 * A small RISE Changes digest and its index for tests, in the shape the weekly
 * workflow writes to the `changes-data` branch (`syberlabs.changes-digest/v1`,
 * `syberlabs.changes-index/v1`). This fixture is the contract the page reads:
 * if the generator renames a field, change it here first. Never shipped: only
 * tests import it. The pull requests are real ones (SyberLabs/RISE #652 to
 * #671); five are included and cited by the reading's beats, two are records
 * only, and one was routed to no audience.
 */

export const CHANGES_ID = '2026-10-13';
const COMPOSER = 'claude-sonnet-5-5';

const change = (number, mergedAt, mergeSha, title, route, included, reason) => ({
  number, title, url: `https://github.com/SyberLabs/RISE/pull/${number}`, mergedAt, mergeSha, route, included, reason
});

const team = (significance, kind) => ({ audience: 'team', significance, kind });

export function changesDigestFixture() {
  return {
    schema: 'syberlabs.changes-digest/v1',
    id: CHANGES_ID,
    audience: 'team',
    title: 'What changed in RISE, 12–13 October',
    period: { from: '2026-10-12T09:00:00Z', to: '2026-10-13T09:00:00Z' },
    generatedAt: '2026-10-13T09:04:12Z',
    model: { router: COMPOSER, composer: COMPOSER, via: 'Claude Code' },
    changes: [
      change(652, '2026-10-13T04:48:36Z', '2f13e80af5cb49184a311370384692a7a887a46d', 'The attractor can be a swarm, and the harmonograph rotary', team('notable', 'design'), true, 'routed'),
      change(653, '2026-10-13T05:00:11Z', '1169a51c090a00614fa0ffcf7b796e37eb61dbc3', 'RISE Live: Sophia holds every visual in one of three frames — the inner eye, the outer shell, the full frame', team('major', 'feature'), true, 'routed'),
      change(654, '2026-10-13T05:02:12Z', '4e6ce08dd44336bf05588adacc2309b4655c3e03', 'SCR-007: delivery deployed (#652 live at 2f13e80a)', { audience: 'skip', significance: 'minor', kind: 'records' }, false, 'records-only'),
      change(655, '2026-10-13T05:18:17Z', '526a2a91f5e1f27cf4550a4babe0da03b5729b1b', 'RISE Live remembers the room: each new question goes up with the earlier questions and what RISE said', team('major', 'feature'), true, 'routed'),
      change(657, '2026-10-13T05:23:55Z', 'a78c1467179051b13e75c8c566c594ce564e3976', 'LIVE-028: delivery deployed (#653 live in 4e6ce08d)', { audience: 'skip', significance: 'minor', kind: 'records' }, false, 'records-only'),
      change(660, '2026-10-13T06:16:58Z', '8df83ce773a301d17578cea43d046056dda5cd22', 'RISE Live: a visual the reader names is shown at once, with no model call (LIVE-029)', team('notable', 'feature'), true, 'routed'),
      change(662, '2026-10-13T06:01:39Z', '008d0cc5ab8bb569e050cfd5430dbcd82a323560', 'A choice opened while /live fades in stays open', { audience: 'skip', significance: 'minor', kind: 'fix' }, false, 'routed'),
      change(667, '2026-10-13T09:30:42Z', '7903b4ce87206a8676eba7f6204f8415ce3d151c', 'A visual the reader names in a held Live reading reaches the screen at once, not at the next phrase', team('minor', 'fix'), true, 'routed')
    ],
    current: {
      schema: 'rise.current.v2',
      id: `changes-${CHANGES_ID}`,
      title: 'What changed in RISE, 12–13 October',
      theme: 'cobalt',
      origin: { kind: 'model', name: COMPOSER, provider: 'Anthropic, via Claude Code' },
      scenes: [
        { id: 'swarm', engine: 'attractor', params: { trace: 'swarm' } },
        { id: 'calm', engine: 'still' }
      ],
      beats: [
        { say: 'This week RISE Live learned to remember the room: each new question goes up with the questions before it, and with what RISE said in answer.', scene: 'swarm' },
        { say: 'Sophia now holds every visual in one of three frames: the inner eye, the outer shell, and the full frame.', show: 'Three frames: the inner eye, the outer shell, the full frame.' },
        { hold: { ms: 1500 } },
        { say: 'A visual the reader names is shown at once, with no model call, and a held reading shows it without waiting for the next phrase.', scene: 'calm' },
        { say: 'And the attractor can now be drawn as a swarm, with the harmonograph turned rotary.', scene: 'swarm' }
      ]
    },
    sources: { 0: [655], 1: [653], 3: [660, 667], 4: [652] }
  };
}

export function changesIndexFixture() {
  return {
    schema: 'syberlabs.changes-index/v1',
    digests: [
      { id: CHANGES_ID, audience: 'team', title: 'What changed in RISE, 12–13 October', period: { from: '2026-10-12T09:00:00Z', to: '2026-10-13T09:00:00Z' }, count: 8 },
      { id: '2026-10-12', audience: 'team', title: 'What changed in RISE, 5–12 October', period: { from: '2026-10-05T09:00:00Z', to: '2026-10-12T09:00:00Z' }, count: 31 }
    ]
  };
}

/** A generated scene the scene admission refuses: it reaches for the network. */
export const REFUSED_SCENE = {
  id: 'reach',
  code: 'export default function scene(rise) { fetch("https://example.com/"); return { frame() {} }; }'
};
