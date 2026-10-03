const LANES = [
  { id: 'reader', label: 'Reader', note: 'Audiovisual reading experience' },
  { id: 'live-sdk', label: 'Live + RiseSDK', note: 'Live interaction and developer tools' },
  { id: 'shared', label: 'Shared foundation', note: 'Capabilities that support both directions' },
];
const STATUS_LABELS = {
  planned: 'Planned',
  in_progress: 'In progress',
  blocked: 'Blocked',
  in_review: 'In review',
  done: 'Done',
};
const DELIVERY_LABELS = {
  not_shipped: 'Not shipped',
  branch: 'On branch',
  merged: 'Merged',
  deployed: 'Deployed',
  accepted: 'Accepted',
};

function createElement(document, tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function safeExternalUrl(reference) {
  try {
    const url = new URL(reference);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function safeReferenceUrl(reference, sourceRef) {
  if (typeof reference !== 'string' || !reference.trim()) return null;
  const trimmed = reference.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) {
    return safeExternalUrl(trimmed);
  }

  const [path, ...fragmentParts] = trimmed.split('#');
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('?')) return null;
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || /[%\u0000-\u001f]/.test(segment))) return null;
  const fragment = fragmentParts.length ? `#${encodeURIComponent(fragmentParts.join('#'))}` : '';
  const encodedPath = segments.map(encodeURIComponent).join('/');
  const ref = /^[\da-f]{7,64}$/i.test(String(sourceRef ?? '')) ? sourceRef : 'codex/roadmap-tracker';
  return `https://github.com/SyberLabs/RISE/blob/${ref}/${encodedPath}${fragment}`;
}

export function filterTasks(tasks, filters = {}) {
  const query = String(filters.query ?? '').trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (filters.lane && task.lane !== filters.lane) return false;
    if (filters.milestone && task.milestone !== filters.milestone) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (!query) return true;
    const haystack = [task.id, task.title, task.milestone, task.owner, task.summary, task.blocker]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  });
}

function referenceCommitSha(reference) {
  if (typeof reference !== 'string') return null;
  if (/^[\da-f]{7,64}$/i.test(reference)) return reference.toLowerCase();
  try {
    const url = new URL(reference);
    if (url.protocol !== 'https:') return null;
    const match = url.pathname.match(/\/commit\/([\da-f]{7,64})(?:\/|$)/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function pullRequestNumber(reference) {
  if (typeof reference !== 'string') return null;
  try {
    const url = new URL(reference);
    if (url.protocol !== 'https:') return null;
    return url.pathname.match(/\/pull\/(\d+)(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function evidenceMatchesCommit(evidence, commit) {
  if (evidence.kind === 'commit') {
    const evidenceSha = referenceCommitSha(evidence.ref);
    const commitSha = String(commit.sha).toLowerCase();
    return evidenceSha && (commitSha.startsWith(evidenceSha) || evidenceSha.startsWith(commitSha));
  }
  if (evidence.kind === 'pr') {
    const number = pullRequestNumber(evidence.ref);
    return number && new RegExp(`(?:#|pull/)${number}(?:\b|$)`, 'i').test(commit.subject);
  }
  return false;
}

export function mapRecentCommits(commits, tasks) {
  return commits.map((commit) => ({
    commit,
    taskIds: tasks.filter((task) => task.evidence.some((evidence) => evidenceMatchesCommit(evidence, commit))).map((task) => task.id),
  }));
}

function formatDate(value) {
  if (!value) return 'Date unknown';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return `${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}

function addSafeLink(document, parent, reference, label, sourceRef) {
  const href = safeReferenceUrl(reference, sourceRef);
  if (!href) {
    parent.append(createElement(document, 'span', 'reference-text', label || reference));
    return;
  }
  const link = createElement(document, 'a', '', label || reference);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  parent.append(link);
}

function createTaskCard(document, task, taskMap, sourceRef) {
  const card = createElement(document, 'article', `task-card${task.status === 'blocked' ? ' is-blocked' : ''}`);
  const top = createElement(document, 'div', 'task-topline');
  const id = createElement(document, 'span', 'task-id', task.id);
  const status = createElement(document, 'span', `status-pill status-${task.status}`, STATUS_LABELS[task.status] || task.status);
  top.append(id, status);

  const title = createElement(document, 'h4', 'task-title', task.title);
  const meta = createElement(document, 'p', 'task-meta', `${task.owner || 'Unassigned'} · ${task.priority} priority · ${DELIVERY_LABELS[task.delivery] || task.delivery}`);
  const description = createElement(document, 'p', 'task-summary', task.summary || 'No summary recorded yet.');
  card.append(top, title, meta, description);

  if (task.blocker) card.append(createElement(document, 'p', 'task-blocker', `Blocked: ${task.blocker}`));
  const dependencies = createElement(document, 'div', 'task-detail');
  const dependencyNames = task.dependencies.map((id) => taskMap.get(id)?.title || id);
  dependencies.append(createElement(document, 'strong', '', task.dependencies.length ? 'Depends on ' : 'Dependencies '));
  dependencies.append(createElement(document, 'span', '', dependencyNames.length ? dependencyNames.join(', ') : 'None'));
  card.append(dependencies);

  if (task.acceptance.length) {
    const acceptance = createElement(document, 'div', 'task-detail acceptance-list');
    acceptance.append(createElement(document, 'strong', '', 'Acceptance'));
    const list = createElement(document, 'ul', '');
    for (const criterion of task.acceptance) list.append(createElement(document, 'li', '', criterion));
    acceptance.append(list);
    card.append(acceptance);
  }

  if (task.evidence.length) {
    const evidence = createElement(document, 'div', 'task-detail evidence-list');
    evidence.append(createElement(document, 'strong', '', 'Evidence'));
    for (const item of task.evidence) {
      const row = createElement(document, 'div', 'evidence-row');
      row.append(createElement(document, 'span', 'evidence-kind', item.kind));
      addSafeLink(document, row, item.ref, item.ref, sourceRef);
      row.append(createElement(document, 'span', 'evidence-note', item.note));
      evidence.append(row);
    }
    card.append(evidence);
  }

  const updated = createElement(document, 'p', 'task-updated', `Updated ${formatDate(task.updatedAt)} · r${task.revision}`);
  card.append(updated);
  return card;
}

function renderReadiness(document, container, tasks) {
  container.replaceChildren();
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const waiting = tasks.filter((task) => task.status !== 'done' && task.dependencies.some((id) => taskMap.get(id)?.status !== 'done'));
  const readyNow = tasks.filter((task) => task.priority === 'now' && task.status === 'planned' && task.dependencies.every((id) => taskMap.get(id)?.status === 'done'));
  const blocked = tasks.filter((task) => task.status === 'blocked');
  const queued = tasks.filter((task) => task.status !== 'done' && ['next', 'later'].includes(task.priority));

  const wrap = createElement(document, 'div', 'readiness-grid');
  const readyCard = createElement(document, 'article', 'readiness-card readiness-ready');
  readyCard.append(createElement(document, 'p', 'eyebrow', 'Current priority'), createElement(document, 'h2', '', `Ready now · ${readyNow.length}`));
  readyCard.append(createElement(document, 'p', 'readiness-copy', readyNow.length ? readyNow.map((task) => task.title).join(' · ') : 'No planned “now” tasks have clear dependencies.'));
  const queuedCard = createElement(document, 'article', 'readiness-card readiness-queued');
  queuedCard.append(createElement(document, 'p', 'eyebrow', 'Future priorities'), createElement(document, 'h2', '', `Next / later · ${queued.length}`));
  queuedCard.append(createElement(document, 'p', 'readiness-copy', queued.length ? queued.map((task) => `${task.priority}: ${task.title}`).join(' · ') : 'No next or later work is queued.'));
  const blockedCard = createElement(document, 'article', 'readiness-card readiness-waiting');
  blockedCard.append(createElement(document, 'p', 'eyebrow', 'Needs attention'), createElement(document, 'h2', '', `Blocked or waiting · ${blocked.length + waiting.length}`));
  const uniqueWaiting = new Map([...blocked, ...waiting].map((task) => [task.id, task]));
  blockedCard.append(createElement(document, 'p', 'readiness-copy', uniqueWaiting.size ? [...uniqueWaiting.values()].map((task) => task.title).join(' · ') : 'No blocked tasks or unfinished dependencies.'));
  wrap.append(readyCard, queuedCard, blockedCard);
  container.append(wrap);
}

function renderLanes(document, container, tasks, filters, sourceRef) {
  container.replaceChildren();
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const visibleTasks = filterTasks(tasks, filters);
  for (const lane of LANES) {
    const laneTasks = visibleTasks.filter((task) => task.lane === lane.id);
    const section = createElement(document, 'section', 'lane-column');
    section.append(createElement(document, 'div', 'lane-heading', ''));
    const heading = section.lastElementChild;
    const labelWrap = createElement(document, 'div', '');
    labelWrap.append(createElement(document, 'h3', '', lane.label), createElement(document, 'p', '', lane.note));
    heading.append(labelWrap, createElement(document, 'span', 'lane-count', String(laneTasks.length)));

    const milestones = [...new Set(laneTasks.map((task) => task.milestone))].sort((a, b) => a.localeCompare(b));
    if (!milestones.length) section.append(createElement(document, 'p', 'empty-state', 'No tasks match these filters.'));
    for (const milestone of milestones) {
      const group = createElement(document, 'div', 'milestone-group');
      group.append(createElement(document, 'h4', 'milestone-title', milestone));
      for (const task of laneTasks.filter((item) => item.milestone === milestone)) group.append(createTaskCard(document, task, taskMap, sourceRef));
      section.append(group);
    }
    container.append(section);
  }
}

function renderActivity(document, container, tasks) {
  container.replaceChildren();
  const records = tasks.flatMap((task) => task.activity.map((item) => ({ ...item, taskId: task.id, taskTitle: task.title })))
    .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);
  if (!records.length) {
    container.append(createElement(document, 'p', 'empty-state', 'No task activity recorded yet.'));
    return;
  }
  for (const item of records) {
    const row = createElement(document, 'article', 'activity-row');
    row.append(createElement(document, 'time', 'activity-date', formatDate(item.date)), createElement(document, 'p', '', item.summary));
    row.append(createElement(document, 'span', 'activity-task', `${item.taskTitle} · ${item.taskId}`));
    container.append(row);
  }
}

function commitUrl(sha) {
  return /^[\da-f]{7,64}$/i.test(String(sha)) ? `https://github.com/SyberLabs/RISE/commit/${encodeURIComponent(sha)}` : null;
}

function renderCommits(document, container, commits, tasks) {
  container.replaceChildren();
  if (!commits.length) {
    container.append(createElement(document, 'p', 'empty-state', 'No recent commits found.'));
    return;
  }
  for (const { commit, taskIds } of mapRecentCommits(commits, tasks)) {
    const row = createElement(document, 'article', 'commit-row');
    const title = createElement(document, 'div', 'commit-title');
    const href = commitUrl(commit.sha);
    if (href) {
      const link = createElement(document, 'a', 'commit-subject', commit.subject);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      title.append(link);
      const sha = createElement(document, 'a', 'commit-sha', String(commit.sha).slice(0, 8));
      sha.href = href;
      sha.target = '_blank';
      sha.rel = 'noopener noreferrer';
      title.append(sha);
    } else {
      title.append(createElement(document, 'span', 'commit-subject', commit.subject));
      title.append(createElement(document, 'span', 'commit-sha', String(commit.sha)));
    }
    row.append(title, createElement(document, 'time', 'commit-date', formatDate(commit.date)));
    const mapped = createElement(document, 'div', 'commit-mapping');
    if (!taskIds.length) {
      mapped.dataset.unmapped = 'true';
      mapped.append(createElement(document, 'span', 'unmapped-tag', 'Unmapped work'));
      mapped.append(createElement(document, 'span', 'muted-note', 'Add reviewed commit or PR evidence to a task to connect it.'));
    } else {
      mapped.append(createElement(document, 'span', 'mapped-tag', `Linked · ${taskIds.join(', ')}`));
    }
    row.append(mapped);
    container.append(row);
  }
}

export function renderDashboard(document, data, state = {}) {
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const commits = Array.isArray(data?.recentCommits) ? data.recentCommits : [];
  const milestoneSelect = document.querySelector('#milestone-filter');
  if (milestoneSelect) {
    const selected = state.filters?.milestone ?? milestoneSelect.value;
    const milestones = [...new Set(tasks.map((task) => task.milestone))].sort((a, b) => a.localeCompare(b));
    milestoneSelect.replaceChildren();
    const allOption = createElement(document, 'option', '', 'All milestones');
    allOption.value = '';
    milestoneSelect.append(allOption);
    for (const milestone of milestones) {
      const option = createElement(document, 'option', '', milestone);
      option.value = milestone;
      milestoneSelect.append(option);
    }
    milestoneSelect.value = milestones.includes(selected) ? selected : '';
  }
  renderReadiness(document, document.querySelector('#readiness'), tasks);
  renderLanes(document, document.querySelector('#lanes'), tasks, state.filters ?? {}, data?.sourceRef);
  renderActivity(document, document.querySelector('#activity'), tasks);
  renderCommits(document, document.querySelector('#commits'), commits, tasks);
  const timeNode = document.querySelector('#snapshot-time');
  if (timeNode) timeNode.textContent = state.loadedAt ? formatDate(state.loadedAt) : formatDate(data?.generatedAt);
  const connectionNode = document.querySelector('#connection-state');
  if (connectionNode) {
    connectionNode.className = `connection-state ${state.error ? 'is-error' : state.stale ? 'is-stale' : 'is-current'}`;
    connectionNode.textContent = state.error ? `Refresh failed · showing ${state.loadedAt ? 'last loaded snapshot' : 'no data'}` : state.stale ? 'Snapshot may be stale' : 'Up to date';
  }
  const errorNode = document.querySelector('#error-message');
  if (errorNode) {
    errorNode.hidden = !state.error;
    errorNode.textContent = state.error ? `Could not refresh tracker: ${state.error}` : '';
  }
  const modeNode = document.querySelector('#mode-badge');
  if (modeNode) modeNode.textContent = state.mode === 'static' ? 'Static snapshot' : 'Local tracker';
}

function readFilters(document) {
  return {
    lane: document.querySelector('#lane-filter').value,
    milestone: document.querySelector('#milestone-filter').value,
    status: document.querySelector('#status-filter').value,
    query: document.querySelector('#search-input').value,
  };
}

function startDashboard() {
  const document = globalThis.document;
  const mode = document.documentElement.dataset.trackerMode === 'static' ? 'static' : 'api';
  const state = { mode, filters: {}, data: null, loadedAt: null, error: null, stale: false };
  const refresh = async () => {
    try {
      const url = mode === 'static' ? new URL('snapshot.json', document.baseURI) : new URL('/api/tracker', document.baseURI);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.data = data;
      state.loadedAt = data.generatedAt || new Date().toISOString();
      state.error = null;
      state.stale = false;
      renderDashboard(document, data, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      state.stale = Boolean(state.data);
      if (state.data) renderDashboard(document, state.data, state);
      else renderDashboard(document, { tasks: [], recentCommits: [] }, state);
    }
  };

  document.querySelector('#refresh-button').addEventListener('click', refresh);
  for (const selector of ['#lane-filter', '#milestone-filter', '#status-filter', '#search-input']) {
    document.querySelector(selector).addEventListener('input', () => {
      state.filters = readFilters(document);
      if (state.data) renderDashboard(document, state.data, state);
      state.filters = readFilters(document);
    });
    document.querySelector(selector).addEventListener('change', () => {
      state.filters = readFilters(document);
      if (state.data) renderDashboard(document, state.data, state);
      state.filters = readFilters(document);
    });
  }
  refresh();
  if (mode === 'api') globalThis.setInterval(refresh, 15_000);
}

if (typeof document !== 'undefined' && document.querySelector('#refresh-button')) startDashboard();
