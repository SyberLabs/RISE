#!/usr/bin/env node
/**
 * Read the records participants sent back and say what they show, and no more.
 *
 *   node scripts/summarize-live-study.mjs records/            every .json in a folder
 *   node scripts/summarize-live-study.mjs a.json b.json       these files
 *
 * A file that is not a study record is named and skipped, never guessed at. A
 * record whose spoken condition had no voice that spoke is kept out of the
 * analysis and counted. The conclusion is the one src/live/eval/study.js is
 * allowed to draw: it says nothing at all below ten per group, and if a live
 * Current beat the generic visualizer only in how it was rated, it says that.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_MEASURES, CONDITIONS, MEASURES, summarize, validateRecord } from '../src/live/eval/study.js';

const cell = value => (value === null || value === undefined ? '–' : String(value));

/** @param {{records: object[], skipped: string[]}} input */
export function report({ records, skipped = [] }) {
    const { groups, contrasts, excluded, conclusion } = summarize(records);
    const lines = [];
    lines.push(`Records read: ${records.length}. Left out of the analysis (a spoken condition with no voice that spoke): ${excluded}. Skipped as not study records: ${skipped.length}.`);
    for (const name of skipped) lines.push(`  skipped ${name}`);
    lines.push('');
    lines.push(['condition'.padEnd(24), 'n'.padStart(3), ...ALL_MEASURES.map(measure => measure.slice(0, 11).padStart(12))].join(' '));
    for (const condition of CONDITIONS) {
        const group = groups[condition.id];
        lines.push([
            condition.id.padEnd(24),
            String(group.n).padStart(3),
            ...ALL_MEASURES.map(measure => `${cell(group.measures[measure].mean)}${group.measures[measure].n ? ` (${group.measures[measure].n})` : ''}`.padStart(12))
        ].join(' '));
    }
    lines.push('');
    lines.push('A live Current against each other condition: difference in means, 95% interval (resampled), by tier.');
    for (const tier of ['primary', 'secondary', 'exploratory']) {
        for (const contrast of contrasts.filter(item => item.tier === tier)) {
            lines.push(`  ${tier.padEnd(11)} ${contrast.measure.padEnd(13)} vs ${contrast.against.padEnd(18)} ${String(contrast.difference).padStart(7)}  [${contrast.low}, ${contrast.high}]  n=${contrast.nSubject}/${contrast.nAgainst}`);
        }
    }
    lines.push('');
    lines.push(`Conclusion (${conclusion.kind}): ${conclusion.text}`);
    lines.push('');
    lines.push(`Primary measures: ${MEASURES.primary.join(', ')}. Secondary: ${MEASURES.secondary.join(', ')}. Exploratory: ${MEASURES.exploratory.join(', ')}.`);
    return lines.join('\n');
}

export function load(paths) {
    const files = [];
    for (const path of paths) {
        if (statSync(path).isDirectory()) {
            for (const entry of readdirSync(path).filter(name => name.endsWith('.json')).sort()) files.push(join(path, entry));
        } else {
            files.push(path);
        }
    }
    const records = [];
    const skipped = [];
    for (const file of files) {
        try {
            records.push(validateRecord(JSON.parse(readFileSync(file, 'utf8'))));
        } catch {
            skipped.push(file);
        }
    }
    return { records, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const paths = process.argv.slice(2);
    if (paths.length === 0) {
        console.error('Usage: node scripts/summarize-live-study.mjs <folder or files of study records>');
        process.exit(2);
    }
    console.log(report(load(paths)));
}
