import { escapeHtml } from '../core/sanitize.js';
import {
  HISTORY_CORPUS,
  HISTORY_LANES,
  HISTORY_RANGE,
  PHILOSOPHY_CORPUS,
  PHILOSOPHY_ERAS,
  ATRIUM_EDITORIAL_ECHOES,
  compileAtriumItinerary,
  echoDestination,
  echoesFor,
  evaluateAnchorReadiness,
  evaluateJourneyReadiness,
  findAtriumPoint,
  launchCoverageFor
} from '../content/atrium/index.js';
import { assertAtriumCorpus } from '../content/atrium/validate.js';

const DEFAULT_SELECTION = Object.freeze({
  philosophy: 'ph-thinker-plato',
  history: 'hist-rights-man'
});

const RELATIONSHIP_LABELS = Object.freeze({
  influence: { outgoing: 'influences', incoming: 'is influenced by' },
  critique: { outgoing: 'critiques', incoming: 'is critiqued by' },
  synthesis: { outgoing: 'is synthesized by', incoming: 'synthesizes material from' },
  transmission: { outgoing: 'is transmitted to', incoming: 'receives transmission from' },
  revival: { outgoing: 'is revived by', incoming: 'revives' },
  'institutional-succession': { outgoing: 'is succeeded by', incoming: 'succeeds' },
  'teacher-student': { outgoing: 'teaches', incoming: 'studies with' },
  'contemporaneous-dialogue': { outgoing: 'is in dialogue with', incoming: 'is in dialogue with' }
});

export function layoutPhilosophyConstellation(nodes, edges) {
  const byEra = new Map(PHILOSOPHY_ERAS.map(era => [era.id, []]));
  nodes.forEach(node => byEra.get(node.era)?.push(node));
  byEra.forEach(items => items.sort((a, b) => a.label.localeCompare(b.label)));
  const positions = new Map();
  PHILOSOPHY_ERAS.forEach((era, eraIndex) => {
    const items = byEra.get(era.id) || [];
    if (eraIndex > 0) {
      items.sort((a, b) => {
        const barycenter = node => {
          const neighbors = edges
            .filter(edge => edge.to === node.id || edge.from === node.id)
            .map(edge => positions.get(edge.to === node.id ? edge.from : edge.to)?.row)
            .filter(Number.isFinite);
          return neighbors.length ? neighbors.reduce((sum, row) => sum + row, 0) / neighbors.length : Number.MAX_SAFE_INTEGER;
        };
        return barycenter(a) - barycenter(b) || a.label.localeCompare(b.label);
      });
    }
    items.forEach((node, row) => positions.set(node.id, {
      x: 42 + eraIndex * 250,
      y: 72 + row * 92,
      row,
      eraIndex
    }));
  });
  return positions;
}

function formatKind(kind) {
  return String(kind || '').replaceAll('-', ' ');
}

function formatProvider(provider) {
  return formatKind(provider).replace(/\b\w/g, character => character.toUpperCase());
}

export class Atrium {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onConfigureLaunch = options.onConfigureLaunch || options.onConfigureJourney || null;
    this.domain = options.domain === 'history' ? 'history' : 'philosophy';
    const narrowScreen = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 680px)').matches;
    this.viewMode = ['map', 'list', 'graph'].includes(options.viewMode)
      ? options.viewMode
      : (options.viewMode == null && narrowScreen)
      ? 'list'
      : 'map';
    this.query = '';
    this.activeLane = 'all';
    this.confidence = new Set(['high', 'medium', 'contested']);
    this.selectedByDomain = { ...DEFAULT_SELECTION };
    if (typeof options.selectedId === 'string') {
      this.selectedByDomain[this.domain] = options.selectedId;
    }
    this.expandedJourneyId = typeof options.expandedJourneyId === 'string'
      ? options.expandedJourneyId
      : null;
    this.selectedEdgeId = null;
    this.pulseNodeId = null;
    this._abortController = new AbortController();
    this._resizeObserver = null;
    this._drawFrame = null;

    // Invalid editorial metadata should fail before it can become persuasive UI.
    this.corpusReport = assertAtriumCorpus();

    this.renderShell();
    this.attachEvents();
    this.renderBody();
  }

  renderShell() {
    this.container.innerHTML = `
      <main class="atrium" aria-labelledby="atrium-title">
        <header class="atrium-header">
          <div class="atrium-heading-row">
            <button class="btn-ghost atrium-back" data-action="back">
              <span aria-hidden="true">←</span>
              <span>Portal</span>
            </button>
            <div class="atrium-heading">
              <p class="atrium-kicker font-mono">INTERPRETIVE ATLAS · CORPUS ${escapeHtml(PHILOSOPHY_CORPUS.corpusVersion)}</p>
              <h1 id="atrium-title">Atrium</h1>
              <p class="atrium-deck">Follow the architecture of an idea, or enter history through a point in time.</p>
            </div>
            <div class="atrium-corpus-state" title="Metadata is available; source passages remain under edition and rights review.">
              <span class="atrium-state-dot" aria-hidden="true"></span>
              <span class="font-mono">CORPUS DRAFT</span>
            </div>
          </div>

          <div class="atrium-toolbar">
            <nav class="atrium-domain-tabs" aria-label="Atrium domains">
              <button data-domain="philosophy" aria-pressed="true">Philosophy</button>
              <button data-domain="history" aria-pressed="false">History</button>
            </nav>

            <label class="atrium-search">
              <span class="sr-only">Search the current Atrium domain</span>
              <span aria-hidden="true">⌕</span>
              <input type="search" placeholder="Search thinkers, traditions, themes…" autocomplete="off" />
            </label>

            <div class="atrium-view-switch" role="group" aria-label="View style">
              <button data-view-mode="map" aria-pressed="true">Map</button>
              <button data-view-mode="list" aria-pressed="false">List</button>
              <button data-view-mode="graph" aria-pressed="false">Graph</button>
            </div>
          </div>

          <div class="atrium-filter-row" aria-label="Atrium filters"></div>
        </header>

        <div class="atrium-content" aria-live="polite"></div>
      </main>
    `;
  }

  attachEvents() {
    const { signal } = this._abortController;
    this.container.addEventListener('click', event => this.handleClick(event), { signal });
    this.container.addEventListener('input', event => this.handleInput(event), { signal });
    this.container.addEventListener('keydown', event => this.handleKeydown(event), { signal });
    this.container.addEventListener('pointerover', event => this.handleConstellationHover(event), { signal });
    this.container.addEventListener('pointerout', event => this.handleConstellationHover(event), { signal });
  }

  handleConstellationHover(event) {
    const node = event.target.closest('[data-constellation-node]');
    const graph = event.target.closest('.atrium-constellation');
    if (!graph) return;
    const nodeId = event.type === 'pointerover' ? node?.dataset.constellationNode : null;
    graph.querySelectorAll('.atrium-constellation-edge').forEach(group => {
      group.classList.toggle('dimmed', Boolean(nodeId)
        && group.dataset.edgeFrom !== nodeId
        && group.dataset.edgeTo !== nodeId);
    });
  }

  handleClick(event) {
    const edge = event.target.closest('[data-edge-id]');
    if (edge && this.container.contains(edge)) {
      this.selectedEdgeId = edge.dataset.edgeId;
      this.renderBody({ preserveScroll: true });
      return;
    }
    const button = event.target.closest('button');
    if (!button || !this.container.contains(button)) return;

    if (button.dataset.action === 'back') {
      this.onNavigate('portal');
      return;
    }

    if (button.dataset.action === 'configure-launch') {
      const launches = [
        ...(this.domain === 'philosophy' ? PHILOSOPHY_CORPUS.journeys : HISTORY_CORPUS.journeys),
        findAtriumPoint(this.selectedByDomain[this.domain])
      ].filter(Boolean);
      const launch = launches.find(item => item.id === button.dataset.launchId);
      if (launch && evaluateJourneyReadiness(launch).ready && this.onConfigureLaunch) {
        this.onConfigureLaunch(launch, {
          domain: this.domain,
          viewMode: this.viewMode,
          selectedId: this.selectedByDomain[this.domain],
          expandedJourneyId: launch.kind === 'point' ? null : launch.id
        });
      }
      return;
    }

    if (button.dataset.echoId) {
      const echo = ATRIUM_EDITORIAL_ECHOES.find(item => item.id === button.dataset.echoId && item.status === 'reviewed');
      if (!echo) return;
      const destination = echoDestination(echo, this.domain);
      this.domain = destination.domain;
      this.selectedByDomain[this.domain] = destination.id;
      this.query = '';
      this.activeLane = 'all';
      this.expandedJourneyId = null;
      this.selectedEdgeId = null;
      if (this.domain === 'history' && this.viewMode === 'graph') this.viewMode = 'map';
      const input = this.container.querySelector('.atrium-search input');
      if (input) input.value = '';
      this.renderBody();
      return;
    }

    if (button.dataset.domain) {
      this.domain = button.dataset.domain;
      this.activeLane = 'all';
      this.query = '';
      this.expandedJourneyId = null;
      this.selectedEdgeId = null;
      if (this.domain === 'history' && this.viewMode === 'graph') this.viewMode = 'map';
      const input = this.container.querySelector('.atrium-search input');
      if (input) input.value = '';
      this.renderBody();
      return;
    }

    if (button.dataset.viewMode) {
      if (button.dataset.viewMode === 'graph' && this.domain !== 'philosophy') return;
      this.viewMode = button.dataset.viewMode;
      this.selectedEdgeId = null;
      this.renderBody();
      return;
    }

    if (button.dataset.journeyId) {
      this.expandedJourneyId = this.expandedJourneyId === button.dataset.journeyId
        ? null
        : button.dataset.journeyId;
      this.renderBody({ preserveScroll: true, preserveDetailScroll: true });
      return;
    }

    if (button.dataset.confidence) {
      const value = button.dataset.confidence;
      if (this.confidence.has(value) && this.confidence.size > 1) this.confidence.delete(value);
      else this.confidence.add(value);
      this.renderBody({ preserveScroll: true });
      return;
    }

    if (button.dataset.lane) {
      this.activeLane = button.dataset.lane;
      const visibleEvents = this.getFilteredHistoryEvents();
      if (!visibleEvents.some(item => item.id === this.selectedByDomain.history) && visibleEvents[0]) {
        this.selectedByDomain.history = visibleEvents[0].id;
      }
      this.renderBody({ preserveScroll: true });
      return;
    }

    if (button.dataset.selectId) {
      this.selectedByDomain[this.domain] = button.dataset.selectId;
      this.pulseNodeId = button.dataset.selectId;
      this.selectedEdgeId = null;
      this.expandedJourneyId = null;
      this.renderBody({ preserveScroll: true });
    }
  }

  handleInput(event) {
    if (!event.target.matches('.atrium-search input')) return;
    this.query = event.target.value.trim().toLocaleLowerCase();
    this.renderStageRegion({ preserveScroll: true, preserveFocus: true });
  }

  handleKeydown(event) {
    const edge = event.target.closest('[data-edge-id]');
    if (edge && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.selectedEdgeId = edge.dataset.edgeId;
      this.renderBody({ preserveScroll: true });
      return;
    }
    const item = event.target.closest('[data-select-id]');
    if (!item || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    const items = [...this.container.querySelectorAll('[data-select-id]:not([hidden])')];
    const current = items.indexOf(item);
    if (current < 0) return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    items[(current + direction + items.length) % items.length]?.focus();
  }

  renderBody(options = {}) {
    const content = this.container.querySelector('.atrium-content');
    const previousScroll = options.preserveScroll
      ? this.captureScroll(content, options.preserveDetailScroll)
      : null;
    const previousFocus = options.preserveFocus ? document.activeElement : null;

    this.syncControls();
    this.renderFilters();
    content.innerHTML = this.domain === 'philosophy'
      ? this.renderPhilosophy()
      : this.renderHistory();

    this.observeActiveMap();
    if (previousScroll) this.restoreScroll(content, previousScroll);
    if (previousFocus?.matches?.('.atrium-search input')) previousFocus.focus();
  }

  renderStageRegion(options = {}) {
    const stage = this.container.querySelector('.atrium-stage');
    if (!stage) return this.renderBody(options);
    const scroll = options.preserveScroll ? this.captureScroll(stage) : null;
    const search = this.container.querySelector('.atrium-search input');
    stage.innerHTML = this.domain === 'philosophy'
      ? this.renderPhilosophyStage()
      : this.renderHistoryStage();
    this.observeActiveMap();
    if (scroll) this.restoreScroll(stage, scroll);
    if (options.preserveFocus) search?.focus();
  }

  syncControls() {
    this.container.querySelectorAll('[data-domain]').forEach(button => {
      const active = button.dataset.domain === this.domain;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    });
    this.container.querySelectorAll('[data-view-mode]').forEach(button => {
      const active = button.dataset.viewMode === this.viewMode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
      button.hidden = button.dataset.viewMode === 'graph' && this.domain !== 'philosophy';
    });
    const search = this.container.querySelector('.atrium-search input');
    if (search) {
      search.placeholder = this.domain === 'philosophy'
        ? 'Search thinkers, traditions, themes…'
        : 'Search events, places, movements…';
    }
  }

  renderFilters() {
    const host = this.container.querySelector('.atrium-filter-row');
    if (this.domain === 'philosophy') {
      host.innerHTML = `
        <span class="atrium-filter-label font-mono">RELATIONSHIPS</span>
        ${['high', 'medium', 'contested'].map(value => `
          <button class="atrium-chip confidence-${value} ${this.confidence.has(value) ? 'active' : ''}"
            data-confidence="${value}" aria-pressed="${this.confidence.has(value)}">
            ${value}
          </button>
        `).join('')}
        <span class="atrium-filter-note">Lineage is evidence-rated, not algorithmically inferred.</span>
      `;
      return;
    }

    host.innerHTML = `
      <span class="atrium-filter-label font-mono">LANES</span>
      <button class="atrium-chip ${this.activeLane === 'all' ? 'active' : ''}" data-lane="all" aria-pressed="${this.activeLane === 'all'}">All</button>
      ${HISTORY_LANES.map(lane => `
        <button class="atrium-chip ${this.activeLane === lane.id ? 'active' : ''}" data-lane="${lane.id}"
          aria-pressed="${this.activeLane === lane.id}">${escapeHtml(lane.label)}</button>
      `).join('')}
    `;
  }

  getFilteredPhilosophyNodes() {
    if (!this.query) return PHILOSOPHY_CORPUS.nodes;
    return PHILOSOPHY_CORPUS.nodes.filter(node => [
      node.label,
      node.summary,
      node.kind,
      ...node.themes
    ].some(value => value.toLocaleLowerCase().includes(this.query)));
  }

  getFilteredHistoryEvents() {
    return HISTORY_CORPUS.events.filter(event => {
      const laneMatch = this.activeLane === 'all' || event.lanes.includes(this.activeLane);
      if (!laneMatch) return false;
      if (!this.query) return true;
      return [event.label, event.summary, event.geography, event.dates.display]
        .some(value => value.toLocaleLowerCase().includes(this.query));
    });
  }

  renderPhilosophy() {
    const selected = PHILOSOPHY_CORPUS.nodes.find(node => node.id === this.selectedByDomain.philosophy)
      || PHILOSOPHY_CORPUS.nodes[0];
    const selectedEdge = PHILOSOPHY_CORPUS.edges.find(edge => edge.id === this.selectedEdgeId) || null;

    return `
      <section class="atrium-explorer" aria-label="Ancient Foundations philosophy corpus">
        <div class="atrium-stage">
          ${this.renderPhilosophyStage()}
        </div>
        ${selectedEdge ? this.renderPhilosophyEdgeAside(selectedEdge) : this.renderPhilosophyDetail(selected)}
      </section>
    `;
  }

  renderPhilosophyStage() {
    const nodes = this.getFilteredPhilosophyNodes();
    const selected = PHILOSOPHY_CORPUS.nodes.find(node => node.id === this.selectedByDomain.philosophy)
      || PHILOSOPHY_CORPUS.nodes[0];
    const representation = this.viewMode === 'graph'
      ? this.renderPhilosophyConstellation(nodes, selected)
      : this.viewMode === 'list'
        ? this.renderPhilosophyList(nodes, selected)
        : this.renderPhilosophyMap(nodes, selected);
    return `
      <div class="atrium-stage-heading">
        <div>
          <p class="atrium-section-kicker font-mono">WESTERN PHILOSOPHY · PILOT I</p>
          <h2>Ancient Foundations</h2>
        </div>
        <p>${nodes.length} of ${PHILOSOPHY_CORPUS.nodes.length} nodes · ${PHILOSOPHY_CORPUS.edges.filter(edge => edge.status === 'reviewed').length} reviewed relationships</p>
      </div>
      ${representation}
    `;
  }

  renderPhilosophyConstellation(nodes, selected) {
    if (nodes.length === 0) return this.renderEmpty('No philosophy nodes match this search.');
    const ids = new Set(nodes.map(node => node.id));
    const edges = PHILOSOPHY_CORPUS.edges.filter(edge => ids.has(edge.from)
      && ids.has(edge.to)
      && this.confidence.has(edge.confidence));
    const positions = layoutPhilosophyConstellation(nodes, edges);
    const maxRows = Math.max(...PHILOSOPHY_ERAS.map(era => nodes.filter(node => node.era === era.id).length), 1);
    const width = 1540;
    const height = Math.max(620, 130 + maxRows * 92);
    const nodeMap = new Map(PHILOSOPHY_CORPUS.nodes.map(node => [node.id, node]));
    const selectedEdge = PHILOSOPHY_CORPUS.edges.find(edge => edge.id === this.selectedEdgeId) || null;
    const pathFor = edge => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return '';
      const x1 = from.x + 190;
      const y1 = from.y + 28;
      const x2 = to.x;
      const y2 = to.y + 28;
      const direction = x2 >= x1 ? 1 : -1;
      const bend = Math.max(34, Math.abs(x2 - x1) * 0.42);
      return `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`;
    };
    return `
      <div class="atrium-constellation-scroll atrium-scroll" tabindex="0" aria-label="Philosophy Constellation graph">
        <svg class="atrium-constellation" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
          role="group" aria-label="Layered directed graph of reviewed philosophy relationships">
          <g class="atrium-constellation-eras" aria-hidden="true">
            ${PHILOSOPHY_ERAS.map((era, index) => `<g>
              <line x1="${35 + index * 250}" y1="45" x2="${35 + index * 250}" y2="${height - 30}" />
              <text x="${42 + index * 250}" y="28">${escapeHtml(era.label)}</text>
            </g>`).join('')}
          </g>
          <g class="atrium-constellation-edges">
            ${edges.map(edge => {
              const incomingPulse = edge.to === this.pulseNodeId;
              const label = `${formatKind(edge.type)}: ${nodeMap.get(edge.from)?.label || edge.from} → ${nodeMap.get(edge.to)?.label || edge.to}, ${edge.confidence} confidence`;
              return `<g class="atrium-constellation-edge ${incomingPulse ? 'incoming-pulse' : ''}"
                data-edge-from="${escapeHtml(edge.from)}" data-edge-to="${escapeHtml(edge.to)}">
                <path class="atrium-constellation-line confidence-${edge.confidence} type-${edge.type}" d="${pathFor(edge)}" />
                <path class="atrium-edge-hit" d="${pathFor(edge)}" data-edge-id="${escapeHtml(edge.id)}"
                  role="button" tabindex="0" aria-label="${escapeHtml(label)}" aria-pressed="${selectedEdge?.id === edge.id}" />
              </g>`;
            }).join('')}
          </g>
          <g class="atrium-constellation-nodes">
            ${nodes.map(node => {
              const position = positions.get(node.id);
              return `<foreignObject x="${position.x}" y="${position.y}" width="190" height="62">
                <button xmlns="http://www.w3.org/1999/xhtml" class="atrium-constellation-node ${selected.id === node.id ? 'selected' : ''}"
                  data-select-id="${escapeHtml(node.id)}" data-constellation-node="${escapeHtml(node.id)}"
                  aria-pressed="${selected.id === node.id}">
                  <span>${escapeHtml(node.label)}</span><small>${escapeHtml(node.dates.display)}</small>
                </button>
              </foreignObject>`;
            }).join('')}
          </g>
        </svg>
        <div class="atrium-constellation-legend" aria-label="Relationship legend">
          <span class="type-influence">Influence</span><span class="type-critique">Critique</span>
          <span class="type-transmission">Transmission</span><span class="type-synthesis">Synthesis</span>
          <small>Solid high · fine medium · dashed contested</small>
        </div>
      </div>
    `;
  }

  renderPhilosophyEdgeAside(edge) {
    const nodeMap = new Map(PHILOSOPHY_CORPUS.nodes.map(node => [node.id, node]));
    const citations = edge.editorialReview?.citationRefs || edge.citationRefs || [];
    const stage = edge.editorialReview?.stage || 'pending';
    return `
      <aside class="atrium-detail" aria-live="polite" aria-label="Selected relationship detail">
        <div class="atrium-detail-scroll">
          <p class="atrium-detail-kind font-mono">RELATIONSHIP · ${escapeHtml(edge.evidence)}</p>
          <h2>${escapeHtml(nodeMap.get(edge.from)?.label || edge.from)} → ${escapeHtml(nodeMap.get(edge.to)?.label || edge.to)}</h2>
          <section class="atrium-edge-detail">
            <span class="font-mono">${escapeHtml(formatKind(edge.type))} · ${escapeHtml(edge.confidence)}</span>
            <p>${escapeHtml(edge.note || 'Claim-level editorial note pending.')}</p>
            <small>${escapeHtml(stage)} review · ${escapeHtml(citations.join(' · ') || 'citations pending')}</small>
          </section>
          <section class="atrium-detail-section">
            <h3>Citations</h3>
            <div class="atrium-source-list">
              ${citations.map(ref => {
                const source = PHILOSOPHY_CORPUS.researchSources[ref];
                return source
                  ? `<a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>`
                  : `<span class="atrium-muted">${escapeHtml(ref)}</span>`;
              }).join('')}
            </div>
          </section>
        </div>
      </aside>
    `;
  }

  renderPhilosophyMap(nodes, selected) {
    const visibleIds = new Set(nodes.map(node => node.id));
    const edges = PHILOSOPHY_CORPUS.edges.filter(edge =>
      visibleIds.has(edge.from)
      && visibleIds.has(edge.to)
      && this.confidence.has(edge.confidence)
    );

    if (nodes.length === 0) return this.renderEmpty('No philosophy nodes match this search.');

    return `
      <div class="atrium-graph-scroll atrium-scroll" tabindex="0" aria-label="Scrollable philosophy relationship map">
        <div class="atrium-graph" data-edge-ids="${escapeHtml(edges.map(edge => edge.id).join(','))}">
          <svg class="atrium-edge-layer" aria-hidden="true"></svg>
          ${PHILOSOPHY_ERAS.map(era => {
            const eraNodes = nodes.filter(node => node.era === era.id);
            return `
              <section class="atrium-era" aria-labelledby="era-${era.id}">
                <header>
                  <span class="atrium-era-index font-mono">0${era.order + 1}</span>
                  <h3 id="era-${era.id}">${escapeHtml(era.label)}</h3>
                </header>
                <div class="atrium-era-nodes">
                  ${eraNodes.map(node => this.renderPhilosophyNode(node, selected)).join('') || '<span class="atrium-era-empty">No matches</span>'}
                </div>
              </section>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderPhilosophyNode(node, selected) {
    return `
      <button class="atrium-node ${selected?.id === node.id ? 'selected' : ''}" data-select-id="${escapeHtml(node.id)}"
        data-node-id="${escapeHtml(node.id)}" aria-pressed="${selected?.id === node.id}">
        <span class="atrium-node-kind">${escapeHtml(formatKind(node.kind))}</span>
        <span class="atrium-node-label">${escapeHtml(node.label)}</span>
        <span class="atrium-node-date font-mono">${escapeHtml(node.dates.display)}</span>
      </button>
    `;
  }

  renderPhilosophyList(nodes, selected) {
    if (nodes.length === 0) return this.renderEmpty('No philosophy nodes match this search.');
    return `
      <div class="atrium-list atrium-scroll" role="list">
        ${PHILOSOPHY_ERAS.map(era => {
          const eraNodes = nodes.filter(node => node.era === era.id);
          if (eraNodes.length === 0) return '';
          return `
            <section class="atrium-list-group" role="group" aria-labelledby="list-era-${era.id}">
              <h3 id="list-era-${era.id}">${escapeHtml(era.label)}</h3>
              ${eraNodes.map(node => `
                <div class="atrium-list-entry" role="listitem">
                  <button class="atrium-list-item ${selected.id === node.id ? 'selected' : ''}"
                    data-select-id="${escapeHtml(node.id)}">
                    <span>
                      <strong>${escapeHtml(node.label)}</strong>
                      <small>${escapeHtml(node.summary)}</small>
                    </span>
                    <span class="font-mono">${escapeHtml(node.dates.display)}</span>
                  </button>
                </div>
              `).join('')}
            </section>
          `;
        }).join('')}
      </div>
    `;
  }

  renderPhilosophyDetail(node) {
    const relatedEdges = PHILOSOPHY_CORPUS.edges.filter(edge =>
      (edge.from === node.id || edge.to === node.id) && this.confidence.has(edge.confidence)
    );
    const nodeMap = new Map(PHILOSOPHY_CORPUS.nodes.map(item => [item.id, item]));
    const journeys = PHILOSOPHY_CORPUS.journeys.filter(journey => journey.anchorIds.includes(node.id));
    const sources = node.sourceRefs.map(id => PHILOSOPHY_CORPUS.researchSources[id]).filter(Boolean);

    return `
      <aside class="atrium-detail" aria-label="Selected philosophy node">
        <div class="atrium-detail-scroll">
          <p class="atrium-detail-kind font-mono">${escapeHtml(formatKind(node.kind))} · ${escapeHtml(node.dates.display)}</p>
          <h2>${escapeHtml(node.label)}</h2>
          <p class="atrium-detail-summary">${escapeHtml(node.summary)}</p>

          ${this.renderEditorialReview(node.editorialReview, { showSurvival: true })}

          <div class="atrium-theme-list" aria-label="Themes">
            ${node.themes.map(theme => `<span>${escapeHtml(theme)}</span>`).join('')}
          </div>

          <section class="atrium-detail-section">
            <h3>Relations</h3>
            ${relatedEdges.length ? `
              <ul class="atrium-relation-list">
                ${relatedEdges.map(edge => {
                  const outgoing = edge.from === node.id;
                  const other = nodeMap.get(outgoing ? edge.to : edge.from);
                  const phrase = RELATIONSHIP_LABELS[edge.type]?.[outgoing ? 'outgoing' : 'incoming']
                    || (outgoing ? formatKind(edge.type) : `receives ${formatKind(edge.type)} from`);
                  return `<li class="confidence-${edge.confidence}">
                    <span class="atrium-relation-mark" aria-hidden="true"></span>
                    <span>${escapeHtml(phrase)} <strong>${escapeHtml(other?.label || 'Unknown')}</strong></span>
                    <span class="font-mono">${escapeHtml(edge.evidence)} · ${escapeHtml(edge.confidence)} · ${edge.status === 'reviewed' ? 'editorial pass' : 'review pending'}</span>
                    <small class="atrium-relation-note">${escapeHtml(edge.note || 'Claim-level editorial note pending; this relationship remains a discovery hypothesis.')}</small>
                  </li>`;
                }).join('')}
              </ul>
            ` : '<p class="atrium-muted">No relationships in the current pilot.</p>'}
          </section>

          ${this.renderEchoSection('philosophy', node.id)}
          ${this.renderJourneySection(journeys)}
          ${this.renderSourceSection(sources)}
        </div>
        ${this.renderLaunchGate(node.id, journeys)}
      </aside>
    `;
  }

  renderHistory() {
    const selected = HISTORY_CORPUS.events.find(event => event.id === this.selectedByDomain.history)
      || HISTORY_CORPUS.events[0];

    return `
      <section class="atrium-explorer" aria-label="Atlantic Revolutions history corpus">
        <div class="atrium-stage">
          ${this.renderHistoryStage()}
        </div>
        ${this.renderHistoryDetail(selected)}
      </section>
    `;
  }

  renderHistoryStage() {
    const events = this.getFilteredHistoryEvents();
    const selected = HISTORY_CORPUS.events.find(event => event.id === this.selectedByDomain.history)
      || HISTORY_CORPUS.events[0];
    const representation = this.viewMode === 'list'
      ? this.renderHistoryList(events, selected)
      : this.renderHistoryTimeline(events, selected);
    return `
      <div class="atrium-stage-heading">
        <div>
          <p class="atrium-section-kicker font-mono">ATLANTIC WORLD · PILOT II</p>
          <h2>Revolutions, 1750–1850</h2>
        </div>
        <p>${events.length} of ${HISTORY_CORPUS.events.length} events · ${HISTORY_CORPUS.events.filter(event => event.status === 'reviewed').length} editorially reviewed</p>
      </div>
      ${representation}
    `;
  }

  renderHistoryTimeline(events, selected) {
    if (events.length === 0) return this.renderEmpty('No historical events match these filters.');
    const visibleLanes = this.activeLane === 'all'
      ? HISTORY_LANES
      : HISTORY_LANES.filter(lane => lane.id === this.activeLane);
    const decades = [];
    for (let year = HISTORY_RANGE.start; year <= HISTORY_RANGE.end; year += 10) decades.push(year);

    return `
      <div class="atrium-timeline-scroll atrium-scroll" tabindex="0" aria-label="Scrollable Atlantic Revolutions timeline">
        <div class="atrium-timeline">
          <div class="atrium-time-axis" aria-hidden="true">
            ${decades.map(year => `<span style="left:${this.yearPercent(year)}%">${year}</span>`).join('')}
          </div>
          ${visibleLanes.map(lane => {
            const laneEvents = events.filter(event =>
              this.activeLane === 'all' ? event.primaryLane === lane.id : event.lanes.includes(lane.id)
            );
            return `
              <section class="atrium-time-lane" aria-labelledby="lane-${lane.id}">
                <h3 id="lane-${lane.id}">${escapeHtml(lane.label)}</h3>
                <div class="atrium-time-track">
                  ${laneEvents.map((event, index) => `
                    <button class="atrium-event ${selected.id === event.id ? 'selected' : ''}"
                      style="left:${this.yearPercent(event.dates.start)}%; --event-level:${index % 4}"
                      data-select-id="${escapeHtml(event.id)}" title="${escapeHtml(`${event.dates.display} · ${event.label}`)}"
                      aria-pressed="${selected.id === event.id}">
                      <span class="atrium-event-dot" aria-hidden="true"></span>
                      <span class="atrium-event-label">${escapeHtml(event.label)}</span>
                      <span class="atrium-event-year font-mono">${escapeHtml(event.dates.display)}</span>
                    </button>
                  `).join('')}
                </div>
              </section>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  yearPercent(year) {
    return Math.max(0, Math.min(100, ((year - HISTORY_RANGE.start) / (HISTORY_RANGE.end - HISTORY_RANGE.start)) * 100));
  }

  renderHistoryList(events, selected) {
    if (events.length === 0) return this.renderEmpty('No historical events match these filters.');
    const decades = [...new Set(events.map(event => Math.floor(event.dates.start / 10) * 10))].sort((a, b) => a - b);
    return `
      <div class="atrium-list atrium-history-list atrium-scroll" role="list">
        ${decades.map(decade => `
          <section class="atrium-list-group" role="group" aria-labelledby="history-decade-${decade}">
            <h3 id="history-decade-${decade}">${decade}s</h3>
            ${events.filter(event => Math.floor(event.dates.start / 10) * 10 === decade).map(event => `
              <div class="atrium-list-entry" role="listitem">
                <button class="atrium-list-item ${selected.id === event.id ? 'selected' : ''}"
                  data-select-id="${escapeHtml(event.id)}">
                  <span>
                    <strong>${escapeHtml(event.label)}</strong>
                    <small>${escapeHtml(event.summary)}</small>
                  </span>
                  <span>
                    <span class="font-mono">${escapeHtml(event.dates.display)}</span>
                    <small>${escapeHtml(event.geography)}</small>
                  </span>
                </button>
              </div>
            `).join('')}
          </section>
        `).join('')}
      </div>
    `;
  }

  renderHistoryDetail(event) {
    const journeys = HISTORY_CORPUS.journeys.filter(journey => journey.anchorIds.includes(event.id));
    const sources = event.sourceRefs.map(id => HISTORY_CORPUS.researchSources[id]).filter(Boolean);
    const laneNames = event.lanes
      .map(id => HISTORY_LANES.find(lane => lane.id === id)?.label)
      .filter(Boolean);

    return `
      <aside class="atrium-detail" aria-label="Selected historical event">
        <div class="atrium-detail-scroll">
          <p class="atrium-detail-kind font-mono">${escapeHtml(event.dates.display)} · ${escapeHtml(event.geography)}</p>
          <h2>${escapeHtml(event.label)}</h2>
          <p class="atrium-detail-summary">${escapeHtml(event.summary)}</p>

          <div class="atrium-theme-list" aria-label="Timeline lanes">
            ${laneNames.map(lane => `<span>${escapeHtml(lane)}</span>`).join('')}
          </div>

          ${this.renderEditorialReview(event.editorialReview, { showDateBasis: true })}

          ${this.renderEchoSection('history', event.id)}
          ${this.renderJourneySection(journeys)}
          ${this.renderSourceSection(sources)}
        </div>
        ${this.renderLaunchGate(event.id, journeys)}
      </aside>
    `;
  }

  renderEditorialReview(review, { showSurvival = false, showDateBasis = false } = {}) {
    if (!review) {
      return `
        <section class="atrium-detail-section atrium-caution-panel">
          <h3>Editorial review pending</h3>
          <p>This discovery claim has not completed the internal evidence pass.</p>
        </section>
      `;
    }
    return `
      <section class="atrium-detail-section atrium-review-panel">
        <div class="atrium-review-heading">
          <h3>Editorial evidence pass</h3>
          <span class="font-mono">${escapeHtml(review.version)}</span>
        </div>
        <p class="atrium-review-status">Internal review recorded ${escapeHtml(review.reviewedOn)} · specialist sign-off pending</p>
        ${showSurvival && review.survivalNote
          ? `<p><strong>Textual survival.</strong> ${escapeHtml(review.survivalNote)}</p>`
          : ''}
        ${showDateBasis && review.dateBasis
          ? `<p><strong>Date basis.</strong> ${escapeHtml(review.dateBasis)}</p>`
          : ''}
      </section>
    `;
  }

  renderEchoSection(domain, recordId) {
    const echoes = echoesFor(domain, recordId);
    if (!echoes.length) return '';
    return `
      <section class="atrium-detail-section atrium-echoes">
        <h3>Echoes · editorial</h3>
        ${echoes.map(echo => {
          const destination = echoDestination(echo, domain);
          const records = destination.domain === 'philosophy' ? PHILOSOPHY_CORPUS.nodes : HISTORY_CORPUS.events;
          const target = records.find(record => record.id === destination.id);
          return `<button data-echo-id="${escapeHtml(echo.id)}">
            <span>${escapeHtml(echo.label)}</span>
            <strong>${escapeHtml(target?.label || destination.id)} →</strong>
            <small>${escapeHtml(echo.note)}</small>
          </button>`;
        }).join('')}
      </section>
    `;
  }

  renderJourneySection(journeys) {
    const expandedJourney = journeys.find(journey => journey.id === this.expandedJourneyId);
    return `
      <section class="atrium-detail-section">
        <h3>Planned journeys</h3>
        ${journeys.length ? `
          <ul class="atrium-journey-list">
            ${journeys.map(journey => {
              const readiness = evaluateJourneyReadiness(journey);
              const expanded = journey.id === this.expandedJourneyId;
              return `
                <li>
                  <button class="atrium-journey-button ${expanded ? 'expanded' : ''}"
                    data-journey-id="${escapeHtml(journey.id)}" aria-expanded="${expanded}">
                    <span>
                      <strong>${escapeHtml(journey.title)}</strong>
                      <small>${escapeHtml(journey.description)}</small>
                    </span>
                    <span class="atrium-lock font-mono">${readiness.readyPassages}/${readiness.totalPassages} CLEARED</span>
                  </button>
                </li>`;
            }).join('')}
          </ul>
          ${expandedJourney ? this.renderJourneyInspection(evaluateJourneyReadiness(expandedJourney)) : ''}
        ` : '<p class="atrium-muted">No curated journey is anchored here yet.</p>'}
      </section>
    `;
  }

  renderJourneyInspection(report) {
    const { journey } = report;
    const itinerary = report.ready ? compileAtriumItinerary(journey) : null;
    const readinessNote = report.ready
      ? 'Verified excerpts are packaged offline. Source text remains concealed here until the Chamber session begins.'
      : 'Candidate locations only. No source text is packaged or substituted while review is incomplete.';
    return `
      <div class="atrium-journey-inspection" aria-label="Source plan for ${escapeHtml(journey.title)}">
        <div class="atrium-journey-inspection-header">
          <span class="font-mono">SOURCE PLAN</span>
          <span>${itinerary?.ready ? `${escapeHtml(itinerary.totalLabel)} compiler total` : 'Duration pending clearance'}</span>
        </div>
        <ol class="atrium-source-plan">
          ${report.segments.map((segment, index) => `
            <li>
              <span class="atrium-segment-index font-mono">${String(index + 1).padStart(2, '0')}</span>
              <span class="atrium-segment-copy">
                <span class="atrium-segment-role font-mono">${escapeHtml(segment.role)}</span>
                <strong>${escapeHtml(segment.passage?.label || segment.passageId)}</strong>
                <small>${escapeHtml(segment.passage?.canonicalLocator || segment.passage?.locator || 'Passage locator unresolved')}</small>
                <small class="atrium-edition-candidate">${escapeHtml(segment.source?.author || 'Author unresolved')}, ${escapeHtml(segment.source?.workTitle || 'Edition unresolved')} · ${escapeHtml(formatProvider(segment.source?.provider) || 'Source pending')}</small>
              </span>
              <span class="atrium-readiness-state ${segment.ready ? 'ready' : 'blocked'} font-mono">
                ${segment.ready
                  ? escapeHtml(itinerary?.segments[index]?.durationLabel || 'READY')
                  : 'REVIEW'}
              </span>
            </li>
          `).join('')}
        </ol>
        ${Array.isArray(journey.openRequirements) && journey.openRequirements.length ? `
          <div class="atrium-open-requirements">
            <span class="font-mono">OPEN EDITORIAL REQUIREMENTS</span>
            <ul>${journey.openRequirements.map(requirement => `<li>${escapeHtml(requirement)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        <p class="atrium-readiness-note">${escapeHtml(readinessNote)}</p>
        ${report.ready ? `<button class="btn-secondary atrium-journey-enter" data-action="configure-launch"
          data-launch-id="${escapeHtml(journey.id)}" ${this.onConfigureLaunch ? '' : 'disabled'}>
          Enter journey · ${escapeHtml(itinerary.totalLabel)}
        </button>` : ''}
      </div>
    `;
  }

  renderSourceSection(sources) {
    return `
      <section class="atrium-detail-section">
        <h3>Research authorities</h3>
        <div class="atrium-source-list">
          ${sources.map(source => `
            <a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(source.label)} <span aria-hidden="true">↗</span>
            </a>
          `).join('') || '<span class="atrium-muted">Source record pending.</span>'}
        </div>
      </section>
    `;
  }

  renderLaunchGate(recordId, journeys) {
    const point = findAtriumPoint(recordId);
    const pointReady = point ? evaluateJourneyReadiness(point).ready : false;
    const itinerary = pointReady ? compileAtriumItinerary(point) : null;
    const readiness = evaluateAnchorReadiness(journeys);
    const coverage = launchCoverageFor(recordId);
    const canConfigure = Boolean(pointReady && this.onConfigureLaunch);
    const progress = pointReady
      ? `${point.segments.length} cleared ${point.segments.length === 1 ? 'passage' : 'passages'} · ${readiness.readyJourneys} curated ${readiness.readyJourneys === 1 ? 'journey' : 'journeys'} ready.`
      : coverage?.launchable === 'journey'
        ? `${readiness.readyJourneys} curated ${readiness.readyJourneys === 1 ? 'journey is' : 'journeys are'} ready. Open the source plan above to enter.`
        : coverage?.reason || 'No passage or journey has cleared the current source, rights, and text gates.';
    const pendingLabel = coverage?.launchable === 'journey'
      ? 'Journey available'
      : coverage?.completionDisposition === 'context-only'
        ? 'Context node'
        : coverage?.completionDisposition === 'evidence-bound'
          ? 'Evidence-bound'
          : coverage?.completionDisposition === 'alignment-repair'
            ? 'Coverage alignment pending'
            : 'Corpus passage pending';
    return `
      <div class="atrium-launch-gate">
        ${pointReady ? `<button class="btn-primary" data-action="configure-launch"
          data-launch-id="${escapeHtml(point.id)}"
          ${canConfigure ? '' : 'disabled'} aria-describedby="atrium-launch-note">
          Enter · ${escapeHtml(itinerary.totalLabel)}
        </button>` : `<div class="atrium-launch-pending" role="status">${escapeHtml(pendingLabel)}</div>`}
        <p id="atrium-launch-note">${escapeHtml(progress)}</p>
      </div>
    `;
  }

  renderEmpty(message) {
    return `
      <div class="atrium-empty">
        <span aria-hidden="true">◇</span>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  observeActiveMap() {
    this._resizeObserver?.disconnect();
    if (this._drawFrame) cancelAnimationFrame(this._drawFrame);
    if (this.domain !== 'philosophy' || this.viewMode !== 'map') return;

    const graph = this.container.querySelector('.atrium-graph');
    if (!graph) return;

    const scheduleDraw = () => {
      if (this._drawFrame) cancelAnimationFrame(this._drawFrame);
      this._drawFrame = requestAnimationFrame(() => this.drawPhilosophyEdges());
    };

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(scheduleDraw);
      this._resizeObserver.observe(graph);
    }
    scheduleDraw();
  }

  drawPhilosophyEdges() {
    this._drawFrame = null;
    const graph = this.container.querySelector('.atrium-graph');
    const svg = graph?.querySelector('.atrium-edge-layer');
    if (!graph || !svg) return;

    const allowedIds = new Set((graph.dataset.edgeIds || '').split(',').filter(Boolean));
    const graphRect = graph.getBoundingClientRect();
    const width = Math.max(graph.scrollWidth, graph.clientWidth, 1);
    const height = Math.max(graph.scrollHeight, graph.clientHeight, 1);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    const paths = PHILOSOPHY_CORPUS.edges
      .filter(edge => allowedIds.has(edge.id))
      .map(edge => {
        const from = graph.querySelector(`[data-node-id="${edge.from}"]`);
        const to = graph.querySelector(`[data-node-id="${edge.to}"]`);
        if (!from || !to) return '';
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const x1 = a.right - graphRect.left;
        const y1 = a.top - graphRect.top + a.height / 2;
        const x2 = b.left - graphRect.left;
        const y2 = b.top - graphRect.top + b.height / 2;
        const bend = Math.max(24, Math.abs(x2 - x1) * 0.42);
        const direction = x2 >= x1 ? 1 : -1;
        const d = `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`;
        return `<path class="atrium-edge confidence-${edge.confidence} type-${edge.type}" d="${d}" />`;
      })
      .join('');

    svg.innerHTML = paths;
  }

  captureScroll(content, includeDetail = false) {
    const primary = content?.querySelector('.atrium-scroll');
    const detail = includeDetail ? content?.querySelector('.atrium-detail-scroll') : null;
    if (!primary && !detail) return null;
    return {
      primary: primary ? { left: primary.scrollLeft, top: primary.scrollTop } : null,
      detail: detail ? { left: detail.scrollLeft, top: detail.scrollTop } : null
    };
  }

  restoreScroll(content, position) {
    const primary = content?.querySelector('.atrium-scroll');
    if (primary && position.primary) {
      primary.scrollLeft = position.primary.left;
      primary.scrollTop = position.primary.top;
    }
    const detail = content?.querySelector('.atrium-detail-scroll');
    if (detail && position.detail) {
      detail.scrollLeft = position.detail.left;
      detail.scrollTop = position.detail.top;
    }
  }

  update(data = {}) {
    if (data.domain === 'philosophy' || data.domain === 'history') this.domain = data.domain;
    if (['map', 'list', 'graph'].includes(data.viewMode)
      && !(data.viewMode === 'graph' && this.domain === 'history')) this.viewMode = data.viewMode;
    if (data.selectedId) this.selectedByDomain[this.domain] = data.selectedId;
    this.expandedJourneyId = typeof data.expandedJourneyId === 'string'
      ? data.expandedJourneyId
      : null;
    this.renderBody();
  }

  activate() {
    this.observeActiveMap();
  }

  deactivate() {
    this._resizeObserver?.disconnect();
    if (this._drawFrame) cancelAnimationFrame(this._drawFrame);
  }

  destroy() {
    this.deactivate();
    this._abortController.abort();
    this.container.replaceChildren();
  }
}

export default Atrium;
