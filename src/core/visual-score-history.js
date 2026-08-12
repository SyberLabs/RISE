const COMMAND_TYPES = new Set([
  'assign', 'replace-overlap', 'erase', 'replace-asset', 'configure-visual'
]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class VisualScoreHistoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VisualScoreHistoryError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new VisualScoreHistoryError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function snapshot(assignments, selectedAssignmentId = null) {
  if (!Array.isArray(assignments)) {
    fail('VISUAL_HISTORY_ASSIGNMENTS', 'A visual history snapshot requires assignments.');
  }
  return freeze({
    assignments: assignments.map(item => ({ ...item })),
    selectedAssignmentId: typeof selectedAssignmentId === 'string'
      ? selectedAssignmentId
      : null
  });
}

function canonicalHistory(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.past)
    || !Array.isArray(value.future)) {
    fail('VISUAL_HISTORY_STATE', 'Visual history state is invalid.');
  }
  return value;
}

export function createVisualScoreHistory(limit = DEFAULT_LIMIT) {
  const bounded = Number.isInteger(limit)
    ? Math.max(1, Math.min(MAX_LIMIT, limit))
    : DEFAULT_LIMIT;
  return freeze({ limit: bounded, past: [], future: [] });
}

export function recordVisualScoreCommand(history, {
  type, before, after, selectedBefore = null, selectedAfter = null
}) {
  const current = canonicalHistory(history);
  if (!COMMAND_TYPES.has(type)) {
    fail('VISUAL_HISTORY_COMMAND', `Unsupported visual score command: ${String(type)}`);
  }
  const command = freeze({
    type,
    before: snapshot(before, selectedBefore),
    after: snapshot(after, selectedAfter)
  });
  return freeze({
    limit: current.limit,
    past: [...current.past, command].slice(-current.limit),
    future: []
  });
}

export function undoVisualScoreCommand(history) {
  const current = canonicalHistory(history);
  if (!current.past.length) return freeze({ history: current, snapshot: null, command: null });
  const command = current.past[current.past.length - 1];
  return freeze({
    history: freeze({
      limit: current.limit,
      past: current.past.slice(0, -1),
      future: [command, ...current.future]
    }),
    snapshot: command.before,
    command
  });
}

export function redoVisualScoreCommand(history) {
  const current = canonicalHistory(history);
  if (!current.future.length) return freeze({ history: current, snapshot: null, command: null });
  const command = current.future[0];
  return freeze({
    history: freeze({
      limit: current.limit,
      past: [...current.past, command].slice(-current.limit),
      future: current.future.slice(1)
    }),
    snapshot: command.after,
    command
  });
}

export function visualScoreHistoryStatus(history) {
  const current = canonicalHistory(history);
  return Object.freeze({
    canUndo: current.past.length > 0,
    canRedo: current.future.length > 0,
    undoLabel: current.past.at(-1)?.type || null,
    redoLabel: current.future[0]?.type || null
  });
}
