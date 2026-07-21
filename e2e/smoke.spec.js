/**
 * The six sacred flows — browser-level contracts that unit tests
 * cannot see. Each of these encodes a regression that was actually
 * shipped (or nearly shipped) and was caught only by ear or eye:
 *
 *   1. The portal presents its triad and the living SOL strip
 *   2. Begin with Aurora → the soundscape truly sounds
 *   3. Leave, Begin again → it sounds the SECOND time (the level-
 *      overwrite regression)
 *   4. Exiting a session resumes the lobby drone
 *   5. Procedural-only selection shows no painting categories
 *      (the additive-arrays regression)
 *   6. The loaded text and settings survive a refresh
 */
import { test, expect } from '@playwright/test';

const GATE_SESSION = {
    code: 'rise2025',
    name: 'Smoke Harness',
    vault: null,
    timestamp: Date.now()
};

const SEED_TEXT = {
    text: 'The pendulum draws the chord it hears. '.repeat(40).trim(),
    textSource: 'Smoke Seed',
    origin: null
};

/** Seed the gate (and optionally text/prefs) before the app boots. */
async function boot(page, { text = true, prefs = null } = {}) {
    await page.addInitScript(({ gate, seedText, seedPrefs }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        if (seedText) localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seedText));
        if (seedPrefs) localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(seedPrefs));
    }, { gate: GATE_SESSION, seedText: text ? SEED_TEXT : null, seedPrefs: prefs });
    await page.goto('/');
    await expect(page.locator('.portal-sol-strip')).toBeVisible({ timeout: 15_000 });
}

async function enterChamber(page) {
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 10_000 });
}

/** Reach into the live engine for ground truth about what sounds. */
function audioState(page) {
    return page.evaluate(() => {
        const engine = window.rise?.audioEngine;
        return {
            sessionActive: !!engine?.sessionActive,
            soundscape: !!engine?.layers?.soundscape,
            soundscapeVolume: engine?.config?.layerVolumes?.soundscape ?? null,
            ambient: !!engine?.layers?.ambient,
            contextState: engine?.context?.state ?? 'none'
        };
    });
}

async function beginSession(page) {
    await page.locator('#begin-btn').click();
    // Model a real reader: wait until the session display is actually
    // streaming before interacting further (also lets the route
    // transition fully settle so Escape has a rightful owner)
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
}

async function exitSession(page) {
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
    await page.keyboard.press('Escape');
    // The chamber asks before terminating — confirm through its modal
    const confirm = page.locator('#exit-confirm');
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.click();
    // Exit returns to the orbital prep (chamber), not the portal — the
    // text card and Begin button are the settled destination
    await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });
}

test('1 · portal presents the four tools and the living entries', async ({ page }) => {
    await boot(page, { text: false });
    // The nav row is tools you own; Atrium and SOL are specialized entries
    const nav = page.locator('.nav-secondary .nav-item');
    await expect(nav).toHaveCount(3);
    await expect(page.locator('.portal-atrium-door[data-nav="atrium"]')).toBeVisible();
    await expect(page.locator('.sol-strip-window')).not.toBeEmpty();
    // The door deepens with today's featured sequence once the lazy
    // corpus metadata arrives at idle
    await expect(page.locator('.atrium-door-detail')).toContainText('today ·', { timeout: 10_000 });
});

test('2+3 · Aurora sounds — and sounds again the second time', async ({ page }) => {
    await boot(page, {
        prefs: { soundscape: 'aurora', audioPreset: 'silent' }
    });
    await enterChamber(page);

    // First session
    await beginSession(page);
    await expect.poll(async () => (await audioState(page)).soundscape,
        { timeout: 15_000 }).toBe(true);
    let state = await audioState(page);
    expect(state.sessionActive).toBe(true);
    expect(state.contextState).toBe('running');

    // Leave — then the regression case: begin a SECOND session. Exit
    // lands back on the orbital, so Begin is ready without re-navigating.
    await exitSession(page);
    await beginSession(page);

    await expect.poll(async () => (await audioState(page)).soundscape,
        { timeout: 15_000 }).toBe(true);
    state = await audioState(page);
    // The exact bug: teardown stored the muted 0 as the configured mix
    expect(state.soundscapeVolume).toBeGreaterThan(0);
});

test('4 · exiting a session resumes the lobby drone', async ({ page }) => {
    await boot(page, { prefs: { soundscape: 'aurora', audioPreset: 'silent' } });
    await enterChamber(page);
    await beginSession(page);
    await expect.poll(async () => (await audioState(page)).soundscape,
        { timeout: 15_000 }).toBe(true);

    await exitSession(page);
    const state = await expect.poll(async () => {
        const s = await audioState(page);
        return s.sessionActive === false && s.ambient ? 'lobby' : JSON.stringify(s);
    }, { timeout: 20_000 }).toBe('lobby');
});

test('5 · procedural-only selection shows no painting categories', async ({ page }) => {
    // A corrupted legacy shape: procedural family but paintings still
    // in the sourced array — the additive-arrays regression
    await boot(page, {
        prefs: {
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    sourceFamily: 'procedural',
                    procedural: ['klee'],
                    sourced: ['aic-oldmasters', 'aic-portraits'],
                    frequency: 0.2,
                    duration: 80
                }
            }
        }
    });
    await enterChamber(page);

    const normalized = await page.evaluate(() => {
        const raw = localStorage.getItem('rise_orbital_prefs_v1');
        return JSON.parse(raw)?.visualInterlocution?.interlocution ?? null;
    });
    // Wait for the orbital to persist its normalized view at least once
    await page.locator('[data-orbit="visual"]').click();
    await page.waitForTimeout(300);

    const panelState = await page.evaluate(() => {
        const checked = [...document.querySelectorAll('[data-sourced]')]
            .filter(el => el.checked).map(el => el.dataset.sourced);
        return { checkedSourced: checked };
    });
    expect(panelState.checkedSourced).toEqual([]);
});

test('6 · text and settings survive a refresh', async ({ page }) => {
    await boot(page, {
        prefs: { wpm: 340, soundscape: 'faded-signal', audioPreset: 'silent' }
    });
    await enterChamber(page);
    await expect(page.locator('.chamber-orbital')).toContainText('Smoke Seed');

    await page.reload();
    await expect(page.locator('.portal-sol-strip')).toBeVisible({ timeout: 15_000 });
    await enterChamber(page);

    await expect(page.locator('.chamber-orbital')).toContainText('Smoke Seed');
    const restored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('rise_orbital_prefs_v1') || '{}'));
    expect(restored.wpm).toBe(340);
    expect(restored.soundscape).toBe('faded-signal');
    await expect(page.locator('#begin-btn')).toBeEnabled();
});

test('7 · restored flashes present an operable warning before loading, every session', async ({ page }) => {
    await boot(page, {
        prefs: {
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    sourceFamily: 'procedural',
                    procedural: ['klee'],
                    sourced: [],
                    frequency: 0.2,
                    duration: 80
                }
            }
        }
    });
    await enterChamber(page);

    await page.locator('#begin-btn').click();
    const warning = page.locator('#photosensitivity-modal');
    await expect(warning).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await warning.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);

    await exitSession(page);
    await page.locator('#begin-btn').click();
    await expect(warning).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await warning.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
});

test('8 · declining the warning enters the session with flashes disabled', async ({ page }) => {
    await boot(page, {
        prefs: {
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    sourceFamily: 'procedural',
                    procedural: ['klee'],
                    sourced: [],
                    frequency: 0.2,
                    duration: 80
                }
            }
        }
    });
    await enterChamber(page);

    await page.locator('#begin-btn').click();
    const warning = page.locator('#photosensitivity-modal');
    await expect(warning).toBeVisible({ timeout: 10_000 });
    await warning.locator('#safety-cancel').click();

    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.evaluate(() =>
        window.rise?.currentSession?.visualConfig?.visualMode
    )).toBe('off');
});

test('9 - in-session Visuals control kills a live presence and keeps safety layers reachable', async ({ page }) => {
    await boot(page, {
        prefs: {
            paceV2: true,
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    sourceFamily: 'procedural',
                    procedural: ['turrell'],
                    sourced: [],
                    frequency: 1,
                    duration: 2000,
                    responsive: false
                }
            }
        }
    });
    await enterChamber(page);
    await page.locator('#begin-btn').click();
    await expect(page.locator('#photosensitivity-modal')).toBeVisible({ timeout: 10_000 });
    await page.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);

    const cortex = page.locator('#visual-cortex');
    const toggle = page.locator('#visuals-toggle-btn');
    await expect(cortex).toBeVisible({ timeout: 15_000 });
    await page.locator('#chamber-display').hover();
    await expect(toggle).toBeVisible();

    const liveLayers = await page.evaluate(() => ({
        cortex: Number(getComputedStyle(document.querySelector('#visual-cortex')).zIndex),
        controls: Number(getComputedStyle(document.querySelector('#chamber-controls')).zIndex)
    }));
    expect(liveLayers.controls).toBeGreaterThan(liveLayers.cortex);

    await toggle.click();
    await expect(cortex).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => page.evaluate(() =>
        window.rise?.currentSession?.visualConfig?.visualMode
    )).toBe('off');

    // The off state is session-local and suppresses every later opportunity.
    await page.waitForTimeout(3000);
    await expect(cortex).toBeHidden();
    expect(await page.evaluate(() =>
        JSON.parse(localStorage.getItem('rise_orbital_prefs_v1') || '{}')
          ?.visualInterlocution?.visualMode
    )).toBe('interlocution');

    // The Chamber intentionally lets its controls dematerialize after idle;
    // ordinary pointer activity must reveal them before the second action.
    await page.locator('#chamber-display').hover();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(cortex).toBeVisible({ timeout: 10_000 });

    // Escape opens the exit confirmation, whose Player.pause cascade must
    // synchronously kill the current presence and remain visually topmost.
    await page.keyboard.press('Escape');
    await expect(cortex).toBeHidden();
    const exitOverlay = page.locator('#exit-confirm-overlay');
    await expect(exitOverlay).toBeVisible();
    const exitLayers = await page.evaluate(() => ({
        controls: Number(getComputedStyle(document.querySelector('#chamber-controls')).zIndex),
        exit: Number(getComputedStyle(document.querySelector('#exit-confirm-overlay')).zIndex)
    }));
    expect(exitLayers.exit).toBeGreaterThan(exitLayers.controls);
});

test('10 · Atrium point preserves origin, curated config, Begin, exit, and return state', async ({ page }) => {
    await boot(page, { text: false });
    await page.locator('[data-nav="atrium"]').click();
    await expect(page.locator('.atrium')).toBeVisible({ timeout: 15_000 });

    await page.locator('[data-view-mode="graph"]').click();
    await page.locator('[data-select-id="ph-thinker-aristotle"]').last().click();
    await expect(page.locator('.atrium-detail h2')).toHaveText('Aristotle');
    await page.locator('.atrium-launch-gate [data-action="configure-launch"]').click();

    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15_000 });
    const configured = await page.evaluate(() => {
        const instance = window.rise?.router?.views?.get('chamber')?.instance;
        return {
            soundscape: instance?.config?.soundscape,
            curve: instance?.config?.curve,
            origin: instance?.config?.origin,
            visuals: instance?.config?.visualInterlocution?.interlocution
        };
    });
    expect(configured.soundscape).toBe('aurora');
    expect(configured.curve).toBe('flat');
    expect(configured.origin.data).toMatchObject({
        domain: 'philosophy',
        selectedId: 'ph-thinker-aristotle',
        viewMode: 'graph'
    });
    expect(configured.visuals.frequency).toBeLessThanOrEqual(0.15);
    expect(configured.visuals.procedural).toEqual(['harmonograph']);
    // Aristotle is a DEPICTED subject, so it resolves to its pinned
    // collection — reviewed museum works (Rembrandt's Aristotle with a
    // Bust of Homer) rather than four keyword pools. Atrium-scoped
    // `atr-` ids are corpus content, never offered in the general
    // Collections browser.
    expect(configured.visuals.sourced)
        .toEqual(['atr-aristotle']);
    expect(configured.visuals.atriumCollections)
        .toEqual(['atr-aristotle']);

    // The panel names them for this reading, in human terms
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vi-atrium-collections')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.vi-atrium-collection-chip')).toHaveCount(1);
    await expect(page.locator('.vi-atrium-collections')).toContainText('Aristotle');
    // …and the subject category is NOT browsable as a generic option
    await expect(page.locator('[data-sourced="atr-aristotle"]')).toHaveCount(0);
    await page.locator('[data-close="visual"]').click();

    await page.locator('#begin-btn').click();
    const warning = page.locator('#photosensitivity-modal');
    await expect(warning).toBeVisible({ timeout: 10_000 });
    await warning.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);

    await exitSession(page);
    await page.locator('[data-action="origin-return"]').click();
    await expect(page.locator('.atrium')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-view-mode="graph"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.atrium-detail h2')).toHaveText('Aristotle');
});

test('11 · Atrium dialogue keeps speaker labels at the head of Phrase atoms', async ({ page }) => {
    await boot(page, { text: false });
    await page.locator('[data-nav="atrium"]').click();
    await expect(page.locator('.atrium')).toBeVisible({ timeout: 15_000 });

    await page.locator('[data-view-mode="graph"]').click();
    await page.locator('[data-select-id="ph-movement-sophistic"]').last().click();
    await expect(page.locator('.atrium-detail h2')).toHaveText('Sophistic Movement');
    await page.locator('.atrium-launch-gate [data-action="configure-launch"]').click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15_000 });

    const chunkMode = await page.evaluate(() => (
        window.rise?.router?.views?.get('chamber')?.instance?.config?.chunkMode
    ));
    expect(chunkMode).toBe('phrase');

    await page.locator('#begin-btn').click();
    const warning = page.locator('#photosensitivity-modal');
    await expect(warning).toBeVisible({ timeout: 10_000 });

    const dialogueAtoms = await page.evaluate(() => (
        (window.rise?.currentSession?.atoms || [])
            .filter(atom => atom.sourceId === 'pass-protagoras-measure' && atom.content)
            .map(atom => atom.content)
    ));
    const speakerTurns = dialogueAtoms.filter(content => /(?:THEAETETUS|SOCRATES):/.test(content));
    expect(speakerTurns.length).toBeGreaterThan(10);
    expect(speakerTurns.every(content => /^(?:THEAETETUS|SOCRATES):\s+\S/.test(content))).toBe(true);
    expect(dialogueAtoms).toContain('THEAETETUS: O yes,');
    expect(dialogueAtoms.some(content => /\s(?:THEAETETUS|SOCRATES):$/.test(content))).toBe(false);

    // The chunking assertion is independent of external-art hydration. Enter
    // with flashes declined so this test remains a deterministic text-flow E2E.
    await warning.locator('#safety-cancel').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
});
