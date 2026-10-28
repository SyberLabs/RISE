/**
 * Real system figures, kept as the system kind's reference cases: each spec is drawn from the pull requests it names,
 * in the brand it was made for, and every state of it and its animation are held to goldens (system-cases.test.js).
 * `npm run figures:systems` draws them all onto one contact sheet. To add a case, see docs/plans/SYSTEM-FIGURES.md.
 */
export const SYSTEM_CASES = Object.freeze({
  /** openstatusHQ/openstatus #2963 and #2964, and the rollback after them: the checker on Pub/Sub, then back. */
  'openstatus-cutover': Object.freeze({
    brand: 'openstatus',
    sources: ['openstatusHQ/openstatus#2963', 'openstatusHQ/openstatus#2964'],
    spec: { kind: 'system', title: 'Pub/Sub, then back again', states: ['Cloud Tasks', 'Pub/Sub', 'Rolled back'],
      nodes: [
        { id: 'workflows', label: 'Workflows', at: [0, 1] },
        { id: 'tasks', label: 'Cloud Tasks', at: [1, 0], shape: 'queue', in: ['Cloud Tasks', 'Rolled back'] },
        { id: 'pubsub', label: 'Pub/Sub', at: [1, 2], shape: 'queue', changed: true, in: ['Pub/Sub'] },
        { id: 'checker', label: 'Checker', at: [2, 1] },
        { id: 'tinybird', label: 'Tinybird', at: [2, 2], shape: 'store' }
      ],
      links: [
        { from: 'workflows', to: 'tasks', in: ['Cloud Tasks', 'Rolled back'] },
        { from: 'tasks', to: 'checker', in: ['Cloud Tasks', 'Rolled back'] },
        { from: 'workflows', to: 'pubsub', changed: true, in: ['Pub/Sub'] },
        { from: 'pubsub', to: 'checker', changed: true, in: ['Pub/Sub'] },
        { from: 'checker', to: 'tinybird', many: true },
        { from: 'tinybird', to: 'checker', label: '429s', changed: true, in: ['Pub/Sub'] }
      ] }
  }),
  /** openstatusHQ/openstatus #2974: results batched to Tinybird after 2 seconds or 5 MB, instead of one write a check. */
  'openstatus-batching': Object.freeze({
    brand: 'openstatus',
    sources: ['openstatusHQ/openstatus#2974'],
    spec: { kind: 'system', title: 'Tinybird writes, batched', states: ['A write per check', 'Batched'],
      nodes: [
        { id: 'checker', label: 'Checker', at: [0, 1] },
        { id: 'batcher', label: 'Batcher', at: [1, 0], shape: 'queue', changed: true, in: ['Batched'] },
        { id: 'tinybird', label: 'Tinybird', at: [2, 1], shape: 'store' }
      ],
      links: [
        { from: 'checker', to: 'tinybird', many: true, in: ['A write per check'] },
        { from: 'tinybird', to: 'checker', label: '429s', in: ['A write per check'] },
        { from: 'checker', to: 'batcher', many: true, in: ['Batched'] },
        { from: 'batcher', to: 'tinybird', label: '2s or 5 MB', changed: true, in: ['Batched'] }
      ] }
  }),
  /** openstatusHQ/openstatus #2992: cron, the public API and the dashboard share one checker payload builder. */
  'openstatus-builder': Object.freeze({
    brand: 'openstatus',
    sources: ['openstatusHQ/openstatus#2992'],
    spec: { kind: 'system', title: 'One payload builder', states: ['Three builders', 'One builder'],
      nodes: [
        { id: 'cron', label: 'Cron', at: [0, 0] },
        { id: 'api', label: 'Public API', at: [1, 0] },
        { id: 'dashboard', label: 'Dashboard', at: [0, 2] },
        { id: 'builder', label: 'Builder', at: [1, 1], changed: true, in: ['One builder'] },
        { id: 'checker', label: 'Checker', at: [2, 1] }
      ],
      links: [
        { from: 'cron', to: 'checker', in: ['Three builders'] },
        { from: 'api', to: 'checker', in: ['Three builders'] },
        { from: 'dashboard', to: 'checker', label: 'drifted', in: ['Three builders'] },
        { from: 'cron', to: 'builder', in: ['One builder'] },
        { from: 'api', to: 'builder', in: ['One builder'] },
        { from: 'dashboard', to: 'builder', in: ['One builder'] },
        { from: 'builder', to: 'checker', changed: true, in: ['One builder'] }
      ] }
  })
});
