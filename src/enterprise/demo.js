/**
 * The fixture the speaker-rail page drives. Same shape as the suite:
 * one deck, two documents, one table, one audience.
 */

import { ingestCorpus } from './corpus.js';
import { prepareTalk } from './prepare.js';
import { openSession } from './session.js';

export function demoCorpusInput() {
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

export function demoDeck() {
    return {
        id: 'q3-briefing',
        slides: [
            { id: 'atlas-renewal', title: 'Atlas renewal', notes: 'Walk through the Atlas plan price' },
            { id: 'quarterly-revenue', title: 'Quarterly revenue', notes: 'Show pipeline revenue by quarter' },
            { id: 'acquisition', title: 'Acquisition', notes: 'State the acquisition price' }
        ]
    };
}

export function createDemoSession(now = () => Date.now(), { onEvent } = {}) {
    const corpus = ingestCorpus(demoCorpusInput());
    const program = prepareTalk({
        deck: demoDeck(),
        corpus,
        audienceId: 'all-hands',
        presenterId: 'ada'
    });
    return { corpus, program, session: openSession({ program, corpus, now, onEvent }) };
}
