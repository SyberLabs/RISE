/**
 * RISE Curated Archive provider.
 *
 * Workshop used to browse the source adapters that originally populated the
 * product (starter excerpts, a legacy sacred bundle, Gutenberg, and ArXiv).
 * The Library registry is now the authoritative, rights-aware catalogue. This
 * provider exposes that registry through the ordinary SourceProvider contract
 * so every authoring surface sees the same works, shelves, editions, and text.
 */

import { SourceProvider } from '../provider.js';
import {
    LIBRARY_TEXTS,
    LIBRARY_CATEGORIES,
    DIVISIONS
} from '../../content/library.js';

function holdingsPhrase(text) {
    const count = Number(text.chapterCount);
    if (Number.isFinite(count) && count > 0) {
        const noun = text.chapterTitled ? 'section' : (text.chapterNoun || 'reading').toLowerCase();
        return `${count} ${noun}${count === 1 ? '' : 's'}`;
    }
    if (Number.isFinite(text.wordCount) && text.wordCount > 0) {
        return `${new Intl.NumberFormat('en-US').format(text.wordCount)} words`;
    }
    return '';
}

function editionStatement(text) {
    const provenance = text.provenance || {};
    return [
        provenance.translator ? `Translated by ${provenance.translator}` : null,
        provenance.year || null
    ].filter(Boolean).join(' · ');
}

function matchesShelf(text, category) {
    if (!category || category === 'all') return true;
    return text.category === category
        || text.traditionShelf === category
        || text.subjectShelves?.includes(category);
}

function searchableText(text) {
    return [
        text.title,
        text.author,
        text.description,
        text.tradition,
        text.why,
        text.division,
        ...(text.tags || []),
        ...(text.functions || [])
    ].filter(Boolean).join(' ').toLocaleLowerCase();
}

export class ArchiveTextProvider extends SourceProvider {
    constructor() {
        super({
            id: 'library-archive',
            name: 'Curated Archive',
            contentType: 'text',
            tier: 1,
            description: 'The complete curated, edition-verified RISE text library',
            supportsSearch: true,
            supportsPreload: false
        });

        this.isLibraryRegistry = true;
        this._textIndex = new Map();
    }

    async _doInit() {
        this._textIndex = new Map(LIBRARY_TEXTS.map(text => [text.id, text]));
    }

    get count() {
        return LIBRARY_TEXTS.length;
    }

    getFacets() {
        return {
            shelves: LIBRARY_CATEGORIES.map(category => ({
                ...category,
                count: LIBRARY_TEXTS.filter(text => matchesShelf(text, category.id)).length
            })),
            divisions: DIVISIONS.map(division => ({
                ...division,
                count: LIBRARY_TEXTS.filter(text => text.division === division.id).length
            }))
        };
    }

    _filteredTexts(filter = {}) {
        let texts = LIBRARY_TEXTS.filter(text => matchesShelf(text, filter.category));
        if (filter.division) texts = texts.filter(text => text.division === filter.division);
        if (filter.tags?.length) {
            texts = texts.filter(text => filter.tags.some(tag => text.tags?.includes(tag)));
        }
        return texts.sort((a, b) => a.title.localeCompare(b.title));
    }

    async list(filter = {}) {
        await this.init();
        let texts = this._filteredTexts(filter);
        if (Number.isFinite(filter.offset) && filter.offset > 0) texts = texts.slice(filter.offset);
        if (Number.isFinite(filter.limit) && filter.limit > 0) texts = texts.slice(0, filter.limit);
        return Promise.all(texts.map(text => this._toContentItem(text, false)));
    }

    async search(query, filter = {}) {
        await this.init();
        const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
        const texts = this._filteredTexts(filter)
            .filter(text => !normalizedQuery || searchableText(text).includes(normalizedQuery));
        return Promise.all(texts.map(text => this._toContentItem(text, false)));
    }

    async get(id) {
        await this.init();
        const text = this._textIndex.get(id);
        if (!text) return null;
        return this._toContentItem(text, true);
    }

    async _toContentItem(text, includeContent) {
        const shelf = LIBRARY_CATEGORIES.find(category => category.id === text.category);
        const division = DIVISIONS.find(item => item.id === text.division);
        const sequences = includeContent && typeof text.getSequences === 'function'
            ? await text.getSequences()
            : [];
        const data = includeContent
            ? sequences.map(sequence => sequence?.content ?? sequence).filter(Boolean)
            : null;

        return {
            id: text.id,
            type: 'text',
            name: text.title,
            data,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: text.author,
                tradition: text.tradition,
                description: text.description,
                shelfId: text.category,
                shelf: shelf?.name || text.category,
                shelfIcon: shelf?.icon || '◇',
                traditionShelf: text.traditionShelf,
                subjectShelves: text.subjectShelves || [],
                divisionId: text.division,
                division: division?.name || text.division || '',
                chapterCount: text.chapterCount,
                chapterNoun: text.chapterTitled ? 'section' : (text.chapterNoun || 'reading'),
                canBrowseParts: Number(text.chapterCount) > 1,
                holdings: holdingsPhrase(text),
                edition: editionStatement(text),
                translator: text.provenance?.translator,
                editionYear: text.provenance?.year,
                rightsBasis: text.provenance?.basis,
                extent: text.extent,
                why: text.why,
                tags: text.tags || []
            }
        };
    }

    async getContents(id) {
        await this.init();
        const text = this._textIndex.get(id);
        if (!text) return null;

        let divisions;
        if (typeof text.getDivisions === 'function') {
            divisions = await text.getDivisions();
        } else {
            const sequences = typeof text.getSequences === 'function'
                ? await text.getSequences()
                : [];
            const entries = sequences.map((sequence, index) => {
                const content = sequence?.content ?? sequence ?? '';
                return {
                    id: sequence?.id ?? index,
                    label: sequence?.name || sequence?.title || `Reading ${index + 1}`,
                    title: sequence?.title || '',
                    content,
                    words: sequence?.words || String(content).trim().split(/\s+/).filter(Boolean).length
                };
            });
            divisions = {
                divided: entries.length > 1,
                reason: 'registry-sequences',
                noun: text.chapterTitled ? null : (text.chapterNoun || 'Reading'),
                entries
            };
        }

        return {
            item: await this._toContentItem(text, false),
            divided: divisions?.divided === true && divisions.entries?.length > 1,
            reason: divisions?.reason,
            noun: divisions?.noun || null,
            entries: (divisions?.entries || []).map((entry, index) => ({
                id: entry.id ?? index,
                label: entry.label || `Reading ${index + 1}`,
                title: entry.title || '',
                content: entry.content || '',
                words: entry.words || String(entry.content || '').trim().split(/\s+/).filter(Boolean).length
            }))
        };
    }

    async getEntry(id, entryId) {
        const contents = await this.getContents(id);
        const entry = contents?.entries.find(candidate => String(candidate.id) === String(entryId));
        if (!entry) return null;
        return {
            ...contents.item,
            id: `${id}::${entry.id}`,
            name: `${contents.item.name} · ${entry.title || entry.label}`,
            data: entry.content,
            metadata: {
                ...contents.item.metadata,
                parentWorkId: id,
                divisionId: entry.id,
                divisionLabel: entry.label,
                divisionTitle: entry.title,
                holdings: `${new Intl.NumberFormat('en-US').format(entry.words)} words`
            }
        };
    }
}
