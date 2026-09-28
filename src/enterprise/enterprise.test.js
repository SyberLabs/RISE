import { describe, expect, it, vi } from 'vitest';
import { bindTenant, combineCorpora, corpusFromRecords, ingestCorpus } from './corpus.js';
import { admitToStage, permit, validateCard, validateProgram } from './gate.js';
import { renderChart } from './chart.js';
import { prepareTalk } from './prepare.js';
import { embed, indexProgram, matchLexical, matchSemantic } from './match.js';
import { indexCorpus, retrieve } from './retrieve.js';
import {
    RAIL_POLICY,
    initialRailState,
    reduceRail,
    ruleDecider,
    sanitizeDecision
} from './decision.js';
import { openSession } from './session.js';
import { mapRecognitionEvent } from './speech.js';
import { renderRail } from './rail-view.js';
import { renderStage } from './stage-view.js';

const PRESENTER = 'ada';

function corpusInput() {
    return {
        documents: [
            {
                id: 'pricing',
                title: 'Pricing note',
                audiences: ['all-hands'],
                pages: [
                    { page: 1, text: 'Northwind renewal price is 12.4 million for the Atlas plan.' },
                    { page: 2, text: 'Pipeline figures sit in the revenue table.' }
                ]
            },
            {
                id: 'board-memo',
                title: 'Board memo',
                audiences: ['board'],
                pages: [
                    { page: 1, text: 'The acquisition price is 880 million and stays in the board room.' }
                ]
            }
        ],
        tables: [
            {
                id: 'pipeline',
                title: 'Pipeline revenue',
                documentId: 'pricing',
                page: 2,
                columns: [
                    { id: 'quarter', name: 'Quarter', kind: 'label' },
                    { id: 'revenue', name: 'Revenue', kind: 'number' }
                ],
                rows: [
                    { quarter: 'Q1', revenue: '4.2' },
                    { quarter: 'Q2', revenue: '5.1' },
                    { quarter: 'Q3', revenue: '6.0' }
                ]
            }
        ],
        entities: [
            { id: 'atlas', name: 'Atlas', aliases: ['Atlas plan'], documentIds: ['pricing'] },
            { id: 'northwind', name: 'Northwind', documentIds: ['pricing'] },
            { id: 'nightfall', name: 'Project Nightfall', documentIds: ['board-memo'] }
        ]
    };
}

function deck() {
    return {
        id: 'q3-briefing',
        slides: [
            { id: 'atlas-renewal', title: 'Atlas renewal', notes: 'Walk through the Atlas plan price' },
            { id: 'quarterly-revenue', title: 'Quarterly revenue', notes: 'Show pipeline revenue by quarter' },
            { id: 'acquisition', title: 'Acquisition', notes: 'State the acquisition price' }
        ]
    };
}

function prepared() {
    const corpus = ingestCorpus(corpusInput());
    const program = prepareTalk({
        deck: deck(),
        corpus,
        audienceId: 'all-hands',
        presenterId: PRESENTER
    });
    return { corpus, program };
}

function passageCard(overrides = {}) {
    return {
        id: 'card:atlas-renewal:passage:pricing:1',
        title: 'Atlas renewal',
        topicId: 'atlas-renewal',
        kind: 'passage',
        layouts: ['quote'],
        layout: 'quote',
        body: 'Northwind renewal price is 12.4 million for the Atlas plan.',
        chart: null,
        provenance: [{ documentId: 'pricing', page: 1, tableId: null, query: 'Atlas renewal' }],
        ...overrides
    };
}

function chartCard(overrides = {}) {
    return {
        id: 'card:quarterly-revenue:chart:pipeline',
        title: 'Quarterly revenue',
        topicId: 'quarterly-revenue',
        kind: 'chart',
        layouts: ['bar', 'line', 'table'],
        layout: 'bar',
        body: null,
        chart: { tableId: 'pipeline', labelColumnId: 'quarter', valueColumnIds: ['revenue'] },
        provenance: [{ documentId: 'pricing', page: 2, tableId: 'pipeline', query: 'Quarterly revenue' }],
        ...overrides
    };
}

describe('corpus ingest', () => {
    it('refuses to mix residencies and accepts one record connector', () => {
        const binding = { tenantId: 'northwind', residency: 'eu' };
        const left = corpusFromRecords(corpusInput(), binding);
        expect(left.tenantId).toBe('northwind');
        expect(left.residency).toBe('eu');
        const other = bindTenant(corpusInput(), { tenantId: 'northwind', residency: 'us' });
        expect(() => combineCorpora(left, other)).toThrow(/residency/i);
        const right = bindTenant({
            documents: [{
                id: 'ops',
                title: 'Ops note',
                audiences: ['all-hands'],
                pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
            }],
            tables: [],
            entities: []
        }, binding);
        expect(combineCorpora(left, right).documents).toHaveLength(left.documents.length + 1);
        expect(ingestCorpus(corpusInput()).residency).toBe('local');
    });

    it('rejects a number cell that is not a bare numeral', () => {
        const input = corpusInput();
        input.tables[0].rows[0].revenue = '4.2 million';
        expect(() => ingestCorpus(input)).toThrow(/number/i);
    });

    it('rejects a table whose document the room cannot open', () => {
        const input = corpusInput();
        input.tables[0].documentId = 'missing';
        expect(() => ingestCorpus(input)).toThrow(/document/i);
    });
});

describe('the card gate', () => {
    const corpus = () => ingestCorpus(corpusInput());

    it('admits a passage only when the body is the cited page', () => {
        const source = corpus();
        expect(validateCard(passageCard(), source, 'all-hands').kind).toBe('passage');
        expect(() => validateCard(passageCard({
            body: 'Northwind renewal price is 999 million for the Atlas plan.'
        }), source, 'all-hands')).toThrow();
    });

    it('refuses a chart that carries its own numbers', () => {
        const source = corpus();
        const card = chartCard({
            chart: {
                tableId: 'pipeline',
                labelColumnId: 'quarter',
                valueColumnIds: ['revenue'],
                values: [999]
            }
        });
        expect(() => validateCard(card, source, 'all-hands')).toThrow();
    });

    it('refuses a title whose number is not in the cited source', () => {
        const source = corpus();
        expect(() => validateCard(passageCard({ title: 'Grew 40 percent' }), source, 'all-hands')).toThrow();
    });

    it('withholds a board document from the all-hands room', () => {
        const source = corpus();
        const secret = passageCard({
            body: 'The acquisition price is 880 million and stays in the board room.',
            provenance: [{ documentId: 'board-memo', page: 1, tableId: null, query: 'Acquisition' }]
        });
        expect(permit(secret, source, 'all-hands')).toBe(false);
        expect(() => validateCard(secret, source, 'all-hands')).toThrow();
        expect(permit(passageCard(), source, 'all-hands')).toBe(true);
    });
});

describe('chart assembly', () => {
    it('draws every plotted number from the table cell', () => {
        const corpus = ingestCorpus(corpusInput());
        const drawn = renderChart(chartCard(), corpus);
        expect(drawn.rows.map(row => row.values)).toEqual([['4.2'], ['5.1'], ['6.0']]);
        expect(drawn.rows.map(row => row.label)).toEqual(['Q1', 'Q2', 'Q3']);
        const asLine = renderChart(chartCard({ layout: 'line' }), corpus);
        const asTable = renderChart(chartCard({ layout: 'table' }), corpus);
        expect(asLine.rows).toEqual(drawn.rows);
        expect(asTable.rows).toEqual(drawn.rows);
    });
});

describe('prepared talk', () => {
    it('builds gated cards for the deck and drops the board memo', () => {
        const { corpus, program } = prepared();
        validateProgram(program, corpus);
        const bodies = program.cards.map(card => card.body).filter(Boolean);
        expect(bodies).toContain('Northwind renewal price is 12.4 million for the Atlas plan.');
        expect(JSON.stringify(program)).not.toContain('880');
        expect(program.cards.some(card => card.kind === 'chart'
            && card.chart.tableId === 'pipeline')).toBe(true);
        const acquisition = program.topics.find(topic => topic.id === 'acquisition');
        expect(acquisition.cardIds).toEqual([]);
        expect(program.presenterId).toBe(PRESENTER);
        expect(program.entities.map(entity => entity.name)).toEqual(['Atlas', 'Northwind']);
        expect(Object.isFrozen(program.cards[0])).toBe(true);
    });
});

describe('retrieval', () => {
    it('retrieves a permitted sentence and skips the board memo', () => {
        const corpus = ingestCorpus({
            documents: [
                {
                    id: 'ops',
                    title: 'Ops note',
                    audiences: ['all-hands'],
                    pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
                },
                {
                    id: 'board-memo',
                    title: 'Board memo',
                    audiences: ['board'],
                    pages: [{ page: 1, text: 'The acquisition price is 880 million and stays in the board room.' }]
                }
            ],
            tables: [],
            entities: []
        });
        const found = retrieve(indexCorpus(corpus, 'all-hands'), 'cafeteria soup tuesday');
        expect(found).toHaveLength(1);
        expect(found[0].body).toBe('The cafeteria serves soup on Tuesday.');
        expect(found[0].id).toBe('card:retrieval:ops:1:0');
        expect(validateCard(found[0], corpus, 'all-hands').kind).toBe('passage');
        expect(JSON.stringify(found)).not.toContain('880');
        expect(retrieve(indexCorpus(corpus, 'all-hands'), 'acquisition price')).toEqual([]);
    });
});

describe('match tiers', () => {
    it('spots an entity in a partial transcript', () => {
        const { corpus, program } = prepared();
        const index = indexProgram(program, corpus);
        const ranked = matchLexical(index, 'Atla');
        expect(ranked[0].id).toContain('passage');
        expect(ranked[0].tier).toBe('lexical');
    });

    it('keeps lexical and semantic work inside the latency ceilings', () => {
        const { corpus, program } = prepared();
        const index = indexProgram(program, corpus);
        const lexicalStarted = performance.now();
        for (let i = 0; i < 50; i += 1) matchLexical(index, 'Atlas renewal price');
        expect(performance.now() - lexicalStarted).toBeLessThan(1000);

        const semanticStarted = performance.now();
        for (let i = 0; i < 50; i += 1) matchSemantic(index, 'Atlas renewal price');
        expect(performance.now() - semanticStarted).toBeLessThan(2000);
    });

    it('reranks by embedding nearest neighbour when the words diverge', () => {
        const { corpus, program } = prepared();
        const embedder = (text) => {
            const vector = new Float64Array(2);
            if (/revenue|sales/i.test(text)) vector[0] = 1;
            else vector[1] = 1;
            return vector;
        };
        const index = indexProgram(program, corpus, embedder);
        const query = 'how sales changed over the year';
        const lexical = matchLexical(index, query);
        const semantic = matchSemantic(index, query, { embed: embedder });
        expect(semantic[0].id).toContain('chart');
        expect(semantic[0].tier).toBe('semantic');
        expect(lexical[0]?.id || '').not.toContain('chart');
        const once = embed('Atlas plan');
        const twice = embed('Atlas plan');
        expect([...once]).toEqual([...twice]);
        const norm = Math.hypot(...once);
        expect(norm).toBeCloseTo(1, 5);
    });
});

describe('JEV rail decision', () => {
    const candidates = [
        { id: 'a', title: 'A', score: 0.8, layouts: ['quote'] }
    ];

    it('chooses show, hold, or dismiss and nothing else', () => {
        expect(ruleDecider({
            window: 'Atlas',
            candidates,
            rail: []
        })).toEqual({ action: 'show', cardId: 'a', layout: 'quote' });
        expect(ruleDecider({
            window: 'Atlas',
            candidates,
            rail: [{ id: 'a', title: 'A' }]
        }).action).toBe('hold');
        expect(ruleDecider({
            window: 'nothing',
            candidates: [{ id: 'a', title: 'A', score: 0.05, layouts: ['quote'] }],
            rail: []
        }).action).toBe('dismiss');
    });

    it('refuses a decision that is not an id choice', () => {
        expect(sanitizeDecision({
            action: 'show', cardId: 'a', layout: 'quote', note: 'price is 999'
        }, candidates).refused).toBe(true);
        expect(sanitizeDecision({
            action: 'show', cardId: 'missing', layout: 'quote'
        }, candidates).action).toBe('hold');
        expect(sanitizeDecision({
            action: 'show', cardId: 'a', layout: 'bar'
        }, candidates).refused).toBe(true);
        expect(sanitizeDecision({
            action: 'show', cardId: 'a', layout: 'quote'
        }, candidates)).toMatchObject({ action: 'show', cardId: 'a', layout: 'quote', refused: false });
    });

    it('holds a near match until the rail is allowed to move', () => {
        const policy = { ...RAIL_POLICY, cooldownMs: 1000, dwellMs: 8000, margin: 0.12, maxRail: 3 };
        let state = initialRailState();
        state = reduceRail(state, {
            type: 'verdict', action: 'show', cardId: 'a', layout: 'quote', score: 0.8, title: 'A', at: 1000
        }, policy).state;
        const cooled = reduceRail(state, {
            type: 'verdict', action: 'show', cardId: 'b', layout: 'quote', score: 0.95, title: 'B', at: 1500
        }, policy);
        expect(cooled.effect).toBe('hold');
        expect(cooled.state.cards.map(card => card.id)).toEqual(['a']);

        const near = reduceRail(state, {
            type: 'verdict', action: 'show', cardId: 'b', layout: 'quote', score: 0.85, title: 'B', at: 2500
        }, policy);
        expect(near.effect).toBe('hold');

        const clear = reduceRail(state, {
            type: 'verdict', action: 'show', cardId: 'b', layout: 'quote', score: 0.95, title: 'B', at: 2500
        }, policy);
        expect(clear.effect).toBe('show');
        expect(clear.state.cards.map(card => card.id)).toEqual(['a', 'b']);

        const dismissed = reduceRail(state, {
            type: 'verdict', action: 'dismiss', cardId: null, layout: null, score: 0, title: '', at: 3000
        }, policy);
        expect(dismissed.state.cards.map(card => card.id)).toEqual(['a']);

        const speaker = reduceRail(state, { type: 'dismiss', cardId: 'a', at: 3000 }, policy);
        expect(speaker.state.cards).toEqual([]);
        expect(speaker.state.dismissedIds).toEqual(['a']);
    });
});

describe('live session', () => {
    it('shows a prepared card from a finalized sentence and records latency', () => {
        const { corpus, program } = prepared();
        let seen = null;
        const session = openSession({
            program,
            corpus,
            now: () => 1500,
            decider(view) {
                seen = view;
                return ruleDecider(view);
            }
        });
        const result = session.hear({
            text: 'Atlas renewal price',
            final: true,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 1000
        });
        expect(result.tier).toBe('semantic');
        expect(result.action).toBe('show');
        expect(result.latencyMs).toBe(500);
        expect(seen.candidates[0].title).toBeTruthy();
        expect(JSON.stringify(seen)).not.toContain('12.4');
        expect(JSON.stringify(seen)).not.toContain('880');
        expect(JSON.stringify(seen)).not.toContain('board room');
        const card = session.rail()[0];
        expect(card.body).toContain('12.4');
        expect(card.provenance[0].documentId).toBe('pricing');
        expect(session.metrics()).toMatchObject({
            shown: 1,
            promoted: 0,
            speakerDismissed: 0,
            acceptanceRate: 0,
            dismissRate: 0,
            provenanceComplete: true
        });
        expect(session.metrics().numbers.untraced).toBe(0);
    });

    it('treats a draft as lexical and ignores a second presenter', () => {
        const { corpus, program } = prepared();
        const session = openSession({ program, corpus, now: (at) => at });
        const draft = session.hear({
            text: 'Atlas renewal price',
            final: false,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 1000
        });
        expect(draft.tier).toBe('lexical');
        expect(draft.action).toBe('show');
        const other = session.hear({
            text: 'pipeline revenue by quarter',
            final: true,
            speaker: 'presenter',
            speakerId: 'bruno',
            at: 9000
        });
        expect(other.action).toBe('ignore');
        expect(session.rail()).toHaveLength(1);
    });

    it('puts a permitted card on the stage only after promote', () => {
        const { corpus, program } = prepared();
        const session = openSession({ program, corpus, now: (at) => at });
        session.hear({
            text: 'Atlas renewal price',
            final: true,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 1000
        });
        expect(session.stage()).toEqual([]);
        const card = program.cards.find(item => item.kind === 'passage');
        expect(admitToStage(card, corpus, 'all-hands')).toBe(true);
        expect(admitToStage(passageCard({
            body: 'The acquisition price is 880 million and stays in the board room.',
            provenance: [{ documentId: 'board-memo', page: 1, tableId: null, query: 'Acquisition' }]
        }), corpus, 'all-hands')).toBe(false);
        const id = session.rail()[0].id;
        expect(session.promote(id)).toEqual({ action: 'promote' });
        expect(session.stage().map(item => item.id)).toEqual([id]);
        expect(session.stage()[0].body).toContain('12.4');
        expect(session.retract(id)).toEqual({ action: 'retract' });
        expect(session.stage()).toEqual([]);
        expect(session.rail().map(item => item.id)).toEqual([id]);
        session.dismiss(id);
        expect(session.stage()).toEqual([]);
        expect(session.rail()).toEqual([]);
        expect(session.metrics().promoted).toBe(1);
        expect(session.metrics().speakerDismissed).toBe(0);
        expect(session.debrief().stage).toHaveLength(1);
    });

    it('counts a promotion and a dismissal separately from cards never shown', () => {
        const { corpus, program } = prepared();
        const session = openSession({ program, corpus, now: (at) => at });
        session.hear({
            text: 'Atlas renewal price',
            final: true,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 1000
        });
        const shown = session.rail()[0];
        session.promote(shown.id);
        expect(session.metrics()).toMatchObject({
            shown: 1,
            promoted: 1,
            acceptanceRate: 1,
            dismissRate: 0
        });
        session.dismiss(shown.id);
        expect(session.rail()).toEqual([]);
        expect(session.metrics().speakerDismissed).toBe(0);

        session.hear({
            text: 'pipeline revenue by quarter',
            final: true,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 20000
        });
        const chart = session.rail().find(card => card.kind === 'chart');
        expect(chart.chart.rows.map(row => row.values)).toEqual([['4.2'], ['5.1'], ['6.0']]);
        session.dismiss(chart.id);
        expect(session.metrics()).toMatchObject({
            shown: 2,
            promoted: 1,
            speakerDismissed: 1,
            acceptanceRate: 0.5,
            dismissRate: 0.5,
            provenanceComplete: true
        });
    });

    it('retrieves for an audience final that misses the prepared program', () => {
        const input = corpusInput();
        input.documents.push({
            id: 'ops',
            title: 'Ops note',
            audiences: ['all-hands'],
            pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
        });
        const corpus = ingestCorpus(input);
        const program = prepareTalk({
            deck: deck(),
            corpus,
            audienceId: 'all-hands',
            presenterId: PRESENTER
        });
        const session = openSession({ program, corpus, now: (at) => at });
        const missed = session.hear({
            text: 'cafeteria soup tuesday',
            final: false,
            speaker: 'audience',
            speakerId: 'guest',
            at: 1000
        });
        expect(missed.action).not.toBe('show');
        const found = session.hear({
            text: 'cafeteria soup tuesday',
            final: true,
            speaker: 'audience',
            speakerId: 'guest',
            at: 1000
        });
        expect(found.action).toBe('show');
        expect(session.rail()[0].body).toBe('The cafeteria serves soup on Tuesday.');
        expect(session.stage()).toEqual([]);
        expect(session.promote(session.rail()[0].id).action).toBe('promote');
        expect(session.stage()[0].body).toContain('soup');
        expect(JSON.stringify(session.stage())).not.toContain('880');
    });

    it('lets every listed presenter speak on the same rail', () => {
        const { corpus } = prepared();
        const program = prepareTalk({
            deck: deck(),
            corpus,
            audienceId: 'all-hands',
            presenterId: PRESENTER,
            presenterIds: [PRESENTER, 'bruno']
        });
        expect(program.presenterIds).toEqual([PRESENTER, 'bruno']);
        const session = openSession({ program, corpus, now: (at) => at });
        const spoken = session.hear({
            text: 'Atlas renewal price',
            final: true,
            speaker: 'presenter',
            speakerId: 'bruno',
            at: 1000
        });
        expect(spoken.action).toBe('show');
        expect(session.rail()).toHaveLength(1);
        expect(() => prepareTalk({
            deck: deck(),
            corpus,
            audienceId: 'all-hands',
            presenterId: PRESENTER,
            presenterIds: ['bruno']
        })).toThrow();
    });

    it('binds a reasoning request onto the rail and not the stage', () => {
        const input = corpusInput();
        input.documents.push({
            id: 'ops',
            title: 'Ops note',
            audiences: ['all-hands'],
            pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
        });
        const corpus = ingestCorpus(input);
        const program = prepareTalk({
            deck: deck(),
            corpus,
            audienceId: 'all-hands',
            presenterId: PRESENTER
        });
        const session = openSession({ program, corpus, now: (at) => at });
        const result = session.requestReasoning({ text: 'cafeteria soup tuesday', at: 1000 });
        expect(result.tier).toBe('reasoning');
        expect(result.action).toBe('show');
        expect(session.rail()[0].body).toContain('soup');
        expect(session.stage()).toEqual([]);
        expect(session.rail()[0].body).not.toContain('880');
    });

    it('records an audience question with no card as a follow-up gap', () => {
        const { corpus, program } = prepared();
        const session = openSession({ program, corpus, now: (at) => at });
        session.hear({
            text: 'What is the cafeteria menu tomorrow',
            final: true,
            speaker: 'audience',
            speakerId: 'guest',
            at: 1000
        });
        expect(session.rail()).toEqual([]);
        expect(session.debrief().gaps).toEqual([
            { text: 'What is the cafeteria menu tomorrow', speaker: 'audience', at: 1000 }
        ]);
        expect(session.debrief().followUp).toEqual(session.debrief().gaps);
        expect(session.hints()).toEqual(['Atlas', 'Northwind']);
        expect(session.hints()).not.toContain('Project Nightfall');
    });
});

describe('speaker rail', () => {
    it('shows a card on the stage element only after promote', () => {
        const { corpus, program } = prepared();
        const session = openSession({ program, corpus, now: () => 1500 });
        const railRoot = document.createElement('div');
        const stageRoot = document.createElement('div');
        const rail = renderRail(railRoot, session);
        const stage = renderStage(stageRoot, session);
        rail.hear({
            text: 'Atlas renewal price',
            final: true,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 1000
        });
        expect(stageRoot.querySelector('[data-surface="stage"]')).not.toBeNull();
        expect(stageRoot.textContent).not.toContain('12.4');
        railRoot.querySelector('[data-action="promote"]').click();
        stage.update();
        expect(stageRoot.textContent).toContain('12.4');
        expect(stageRoot.textContent).toContain('pricing');
        expect(stageRoot.querySelector('[data-action="promote"]')).toBeNull();
        stageRoot.querySelector('[data-action="retract"]').click();
        expect(stageRoot.textContent).not.toContain('12.4');
        expect(railRoot.querySelector('[data-surface="stage"]')).toBeNull();
    });

    it('promotes and dismisses only from the speaker controls', () => {
        const { corpus, program } = prepared();
        const session = openSession({ program, corpus, now: () => 1500 });
        const root = document.createElement('div');
        const view = renderRail(root, session);
        view.hear({
            text: 'Atlas renewal price',
            final: true,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 1000
        });
        expect(root.textContent).toContain('12.4');
        expect(root.textContent).toContain('pricing');
        expect(root.textContent).toContain('Promoted 0');
        expect(root.querySelector('[data-surface="stage"]')).toBeNull();

        root.querySelector('[data-action="promote"]').click();
        expect(root.textContent).toContain('Promoted 1');
        expect(session.metrics().acceptanceRate).toBe(1);

        root.querySelector('[data-action="dismiss"]').click();
        expect(root.textContent).not.toContain('12.4');
        expect(session.metrics().speakerDismissed).toBe(0);
    });
});

describe('recognition mapper', () => {
    it('maps a labeled transcript and treats an unknown voice as the audience', () => {
        expect(mapRecognitionEvent({
            transcript: 'Atlas renewal price',
            isFinal: false,
            speakerLabel: 'ada',
            at: 20
        }, { presenterIds: ['ada'] })).toEqual({
            text: 'Atlas renewal price',
            final: false,
            speaker: 'presenter',
            speakerId: 'ada',
            at: 20
        });
        expect(mapRecognitionEvent({
            transcript: 'cafeteria soup tuesday',
            isFinal: true,
            at: 40
        }, { presenterIds: ['ada'] }).speaker).toBe('audience');
    });
});

describe('recognition hints stay inside the room', () => {
    it('does not call a decider with document text when the model returns prose', () => {
        const { corpus, program } = prepared();
        const decider = vi.fn(() => ({
            action: 'show',
            cardId: program.cards[0].id,
            layout: 'quote',
            script: 'The price is 999 million'
        }));
        const session = openSession({ program, corpus, decider, now: (at) => at });
        const result = session.hear({
            text: 'Atlas renewal price',
            final: true,
            speaker: 'presenter',
            speakerId: PRESENTER,
            at: 1000
        });
        expect(result.action).toBe('hold');
        expect(session.rail()).toEqual([]);
        expect(JSON.stringify(decider.mock.calls[0][0])).not.toContain('12.4');
    });
});
