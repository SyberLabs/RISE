/**
 * A SCORE'S READING OPENS LEGIBLE.
 *
 * The Scriptorium offers no type controls: a score carries its imagery, its
 * sound and its pace, and the room's whole argument is that nothing is left
 * to configure. But face and size are the READER's settings, carried in from
 * wherever they were last set — so a reader who left the Chamber on Thick +
 * Fit arrives here with a word that is a hole onto imagery a score may never
 * provide, and the reading opens invisible.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Scriptorium', vault: null, timestamp: Date.now() };
const SCORE = JSON.stringify({
    schema: 'rise.experience-program.v1',
    id: 'self-transformation-great-work',
    authority: 'proposed',
    editable: true,
    tracks: [
        { id: 'movements', kind: 'movement', clips: [{ id: 'm1',
            anchor: { sourceIds: ['oedipus-rex'] },
            data: { index: 0, title: 'The Great Work' } }] },
        { id: 'visuals', kind: 'visual', fallback: { kind: 'still' }, clips: [
            { id: 'v1', cue: { kind: 'procedural', collections: ['rockgarden'] },
              anchor: { sourceIds: ['oedipus-rex'], fromProgress: 0, toProgress: 0.3 } },
            { id: 'v2', cue: { kind: 'procedural', collections: ['turrell'] },
              anchor: { sourceIds: ['oedipus-rex'], fromProgress: 0.3, toProgress: 1 } }
        ] },
        { id: 'pace', kind: 'reading', clips: [{ id: 'p1',
            cue: { kind: 'pace', wpm: 120, chunkMode: 'phrase' },
            anchor: { sourceIds: ['oedipus-rex'] } }] }
    ]
});

test('a reading opens readable however the reader left the Chamber', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript((gate) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        // The state a reader arrives in from a Fit mask elsewhere.
        localStorage.setItem('rise-settings', JSON.stringify({
            chamberFace: 'thick', fontSize: 'fit'
        }));
    }, GATE);
    await page.goto('/');
    await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-nav="scriptorium"]').first().click();
    await expect(page.locator('.scriptorium')).toBeVisible({ timeout: 15_000 });

    await page.locator('#scriptorium-paste').fill(SCORE);
    await page.getByRole('button', { name: 'Examine' }).click();
    await page.getByRole('button', { name: 'Begin reading' }).click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 60_000 });

    const warn = page.locator('#photosensitivity-modal');
    if (await warn.isVisible().catch(() => false)) await warn.locator('#safety-accept').click();
    await page.waitForTimeout(4000);

    const seen = await page.evaluate(() => {
        const atom = document.querySelector('#atom-display');
        const cs = getComputedStyle(atom);
        return {
            word: (atom.textContent || '').trim(),
            face: window.rise?.settings?.chamberFace,
            size: window.rise?.settings?.fontSize,
            fill: cs.webkitTextFillColor || cs.color,
            masked: atom.classList.contains('is-mask'),
            glass: atom.classList.contains('glass-tile'),
            streamGlass: window.rise?.currentSession?.visualConfig?.interlocution?.streamGlass
        };
    });
    // eslint-disable-next-line no-console
    console.log('SCORE READING ' + JSON.stringify(seen));

    expect(seen.word.length, 'there are words').toBeGreaterThan(0);
    // The reading is not a hole onto imagery a score never promised.
    expect(seen.masked, 'no mask over a score that offers no ink').toBe(false);
    expect(seen.fill, 'the words are inked, not transparent')
        .not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);

    // Opened on the traditional face at a fixed scale, whatever was carried in.
    expect(seen.face, 'the traditional face').toBe('literary');
    expect(seen.size, 'a fixed scale, not Fit').not.toBe('fit');
    // And the glass a score already asks for can finally apply.
    expect(seen.streamGlass, 'the score asks for glass').toBe(true);
    expect(seen.glass, 'and nothing is holding the frame against it').toBe(true);
});
