/**
 * A SATELLITE'S STATUS SITS ON THE DISC'S MIDDLE, WHATEVER IT SAYS.
 *
 * It did not. `.orbit-status` was clamped to 78% of the content box, and
 * a line WIDER than its box is not centred on it: Chrome pins the
 * overflow to the start edge and lets the rest run off the right. So
 * "Collections" sat 8px right of the orb's middle, "Procedural" 7.5 and
 * "Attractor" 5.7, while every status whose words happened to fit was
 * exact — which is why it read as one status misbehaving.
 *
 * THE VOCABULARY IS DERIVED, NOT LISTED. A guard written against the
 * statuses that exist today would not have caught "Collections" the day
 * that engine was named, so the words come from the taxonomy and the
 * style definitions themselves. A new engine whose name does not fit its
 * disc fails here rather than shipping off-centre.
 */
import { test, expect } from '@playwright/test';
import { taxonomyLeaves } from '../src/core/visual-taxonomy.js';
import { ATTRACTOR_SYSTEMS, FOCAL_GLYPHS, KLEE_PRESETS } from '../src/core/visual-style-definitions.js';

const GATE = { code: 'rise2025', name: 'Centring', vault: null, timestamp: Date.now() };
const SEED = { text: 'Light enters form. '.repeat(60).trim(), textSource: 'Metamorphoses', origin: null };

/** Every word ChamberOrbital can put in a status line. */
const statusWords = () => {
    const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
    const id = x => (typeof x === 'string' ? x : (x?.id ?? x?.name ?? ''));
    const words = new Set();
    const add = phrase => String(phrase).split(/\s+/).filter(Boolean).forEach(w => words.add(w));

    taxonomyLeaves().forEach(leaf => add(leaf.label));
    ATTRACTOR_SYSTEMS.forEach(x => add(cap(id(x))));
    KLEE_PRESETS.forEach(x => add(cap(id(x))));
    FOCAL_GLYPHS.forEach(x => add(cap(id(x))));
    // The literals getVisualPreview / getAudioStatus / getTemporalStatus
    // write themselves, rather than read from a table.
    [
        'Off', 'Focals', 'Attractor', 'Genesis', 'Personal', 'Icon', 'Rosa Mystica',
        'Procedural', 'Sourced', 'Mixed', 'Silent', 'Aurora', 'Faded Signal',
        'Gregorian', 'Znamenny', 'Configuration missing', '240 WPM'
    ].forEach(add);
    return [...words].sort((a, b) => b.length - a.length);
};

const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 800 },
    { width: 1078, height: 900 },
    { width: 390, height: 844 }
];

const ORBS = ['.orbit-visual', '.orbit-audio', '.orbit-temporal'];

/** Every line box of the status, measured against the disc's centre. */
const measure = (page, words) => page.evaluate(({ orbs, words: list }) => {
    const out = [];
    for (const sel of orbs) {
        const node = document.querySelector(sel);
        const status = node.querySelector('.orbit-status');
        const keep = status.textContent;
        for (const word of list) {
            // The real shape of a status: a glyph, a space, then the word.
            status.textContent = `◈ ${word}`;
            const disc = node.getBoundingClientRect();
            const centre = disc.left + disc.width / 2;
            const text = status.firstChild;
            const range = document.createRange();
            const byLine = new Map();
            for (let i = 0; i < text.length; i++) {
                range.setStart(text, i);
                range.setEnd(text, i + 1);
                const box = range.getBoundingClientRect();
                const line = Math.round(box.top);
                if (!byLine.has(line)) byLine.set(line, []);
                byLine.get(line).push(box);
            }
            for (const boxes of byLine.values()) {
                const left = Math.min(...boxes.map(b => b.left));
                const right = Math.max(...boxes.map(b => b.right));
                out.push({
                    orb: sel.replace('.orbit-', ''),
                    word,
                    width: +(right - left).toFixed(1),
                    offset: +(((left + right) / 2) - centre).toFixed(2),
                    rim: +((disc.width - (right - left)) / 2).toFixed(1)
                });
            }
        }
        status.textContent = keep;
    }
    return out;
}, { orbs: ORBS, words });

test('every status word sits on its disc, at every size', async ({ page }) => {
    const words = statusWords();
    expect(words.length).toBeGreaterThan(40);

    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });

    const offCentre = [];
    const overRim = [];
    for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(350);
        const at = `${viewport.width}x${viewport.height}`;
        for (const row of await measure(page, words)) {
            // Half a pixel is a rounding artefact; anything more is a
            // line that was pinned rather than centred.
            if (Math.abs(row.offset) > 0.75) {
                offCentre.push(`${at} ${row.orb} "${row.word}" off by ${row.offset}px`);
            }
            if (row.rim < 0) {
                overRim.push(`${at} ${row.orb} "${row.word}" ${-row.rim}px past the rim`);
            }
        }
    }

    expect(offCentre, offCentre.slice(0, 8).join('\n')).toEqual([]);
    expect(overRim, overRim.slice(0, 8).join('\n')).toEqual([]);
});
