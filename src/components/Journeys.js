/**
 * The Journeys threshold.
 *
 * A provisional home. When there are several Journeys this becomes a
 * landing page of its own; for now it is one room with one work in it,
 * and it is built so that adding the second costs nothing.
 *
 * WHAT A READER IS SHOWN BEFORE DECIDING (JOURNEYS-SPEC §3.1)
 * ──────────────────────────────────────────────────────────
 * The thesis, the movements, the duration, and the credits. Not a
 * synopsis and not a pitch: the argument itself, stated plainly, so a
 * reader can decline it. A Journey is twenty-odd minutes of someone
 * else's ordering of the world and it should be possible to say no to
 * that on the evidence.
 *
 * The counterpressures are shown too, which is unusual for an
 * introduction. §1.3 requires every movement to state how its source
 * RESISTS the thesis rather than illustrating it, and a reader who can
 * see that resistance is being invited into an argument rather than
 * walked through a conclusion.
 *
 * IT LAUNCHES DIRECTLY, NOT THROUGH THE ORBITAL. §3.3: the reader may
 * pause, exit, silence, and ask for reduced motion, but does not
 * rewrite a published Journey by opening the generic Session controls.
 * So Begin compiles the authored config and enters the reading.
 */

import { createJourneyHandoff, journeyIntroduction } from '../content/journeys/handoff.js';
import { resolveJourneyPassages } from '../content/journeys/passages.js';
import './Journeys.css';

/**
 * Everything published here, shortest first.
 *
 * The Demonstration leads because it is the one a reader can afford to
 * try. It is not a Journey — §1.1 — and its card says so; it sits here
 * because this is where someone arrives, and asking them for
 * seventy-five minutes before they know what any of it is would lose
 * most of them at the door.
 */
/**
 * ON ICE — 2026-08-18.
 *
 * A Journey names its sources and quotes their exact words, so it is a promise
 * about a particular EDITION. RISE now serves Standard Ebooks editions only:
 * Storm of Steel has no such edition and is withheld, and Homer and Milton
 * arrive in different translations than the ones these passages were written
 * against. Every quotation anchor into them refuses, correctly.
 *
 * Journeys will not be ready for release regardless, so they are withdrawn
 * rather than re-anchored in haste — re-authoring someone's score against a
 * new translation is an editorial act, not a repair. The scores stay in the
 * tree with their tests; nothing reaches a reader or the Scriptorium.
 */
const JOURNEYS = [
];

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Journeys {
    constructor(container, options = {}) {
        this.container = container;
        this.onNavigate = options.onNavigate || (() => {});
        this.onBeginSession = options.onBeginSession || (() => {});
        this._intros = new Map();
        this._busy = false;

        this.render();
        this.attachEvents();
        // The introductions need their passages resolved to state a
        // real duration and real credits. Done after first paint so the
        // room is there while the Archive is read.
        this.hydrate();
    }

    render() {
        this.container.innerHTML = `
      <div class="journeys" role="main">
        <header class="journeys-header">
          <!-- Journeys is reached from the Vault's first screen now,
               so back is the Vault. -->
          <button class="btn-ghost" data-nav="vault">
            <span class="icon" aria-hidden="true">←</span> Vault
          </button>
          <h1 class="journeys-title text-light">Journeys</h1>
        </header>

        <p class="journeys-intro text-fog">
          A Journey is several works becoming movements in one argument.
          Not a theme and not an anthology: each movement revises the one
          before it, and the sources are allowed to resist the claim being
          made of them.
        </p>

        <div class="journeys-list">
          ${JOURNEYS.map(({ journey }) => this.renderCard(journey)).join('')}
        </div>
      </div>`;
    }

    renderCard(journey) {
        const intro = this._intros.get(journey.id);
        const publishable = journey.status === 'publishable';

        const movements = (intro?.movements || journey.movements).map((movement, i) => `
      <li class="journey-movement">
        <span class="journey-movement-index font-mono">${String(i + 1).padStart(2, '0')}</span>
        <div class="journey-movement-body">
          <span class="journey-movement-title">${esc(movement.title)}</span>
          ${movement.passages?.length
            ? `<span class="journey-movement-works text-mist">${
                esc(movement.passages.map(p => p.work).filter(Boolean).join(' · '))}</span>`
            : ''}
          ${movement.counterpressure
            ? `<span class="journey-movement-against text-fog">${esc(movement.counterpressure)}</span>`
            : ''}
        </div>
      </li>`).join('');

        return `
      <article class="journey-card card" data-journey="${esc(journey.id)}">
        <header class="journey-card-head">
          <h2 class="journey-name text-light">${esc(journey.title)}</h2>
          ${journey.subtitle
            ? `<p class="journey-sub text-mist font-mono">${esc(journey.subtitle)}</p>` : ''}
        </header>

        <p class="journey-thesis">${esc(journey.thesis)}</p>

        <dl class="journey-claims">
          <dt class="text-mist">What becomes impossible</dt>
          <dd class="text-fog">${esc(journey.transformation)}</dd>
          <dt class="text-mist">Where it leaves you</dt>
          <dd class="text-fog">${esc(journey.terminalCondition)}</dd>
        </dl>

        <ol class="journey-movements">${movements}</ol>

        <footer class="journey-card-foot">
          <div class="journey-meta font-mono text-mist">
            <span>${(intro?.movements || journey.movements).length} movements</span>
            <span>${intro?.estimatedMinutes
                ? `${intro.estimatedMinutes} min`
                : `~${journey.estimatedMinutes} min`}</span>
            ${intro?.credits?.length ? `<span>${intro.credits.length} editions</span>` : ''}
          </div>
          <button class="btn-primary journey-begin" data-begin="${esc(journey.id)}"
                  ${publishable ? '' : 'disabled'}>
            ${publishable ? 'Begin' : 'Not yet ready'}
          </button>
        </footer>

        ${intro?.credits?.length ? `
          <details class="journey-credits">
            <summary class="text-mist">Editions</summary>
            <ul>${intro.credits.map(c => `<li class="text-fog">${esc(c)}</li>`).join('')}</ul>
          </details>` : ''}

        ${!publishable && journey.openRequirements?.length ? `
          <p class="journey-blocked text-mist">${esc(journey.openRequirements[0])}</p>` : ''}
      </article>`;
    }

    /**
     * Resolve each Journey's passages so its introduction can state a
     * real duration and real editions.
     *
     * A failure here is not fatal: the card keeps the manifest's own
     * estimate and simply shows no credits. A Journey that cannot
     * resolve will refuse at Begin, which is where the refusal belongs.
     */
    async hydrate() {
        for (const { journey, passages } of JOURNEYS) {
            try {
                const { resolved } = await resolveJourneyPassages(passages);
                this._intros.set(journey.id, journeyIntroduction(journey, resolved));
            } catch (error) {
                console.warn('[Journeys] Could not resolve', journey.id, error?.message);
            }
        }
        const list = this.container.querySelector('.journeys-list');
        if (list) {
            list.innerHTML = JOURNEYS.map(({ journey }) => this.renderCard(journey)).join('');
        }
    }

    attachEvents() {
        this.container.addEventListener('click', async (event) => {
            const back = event.target.closest('[data-nav]');
            if (back) return this.onNavigate(back.dataset.nav);

            const begin = event.target.closest('[data-begin]');
            if (!begin || this._busy) return;

            const entry = JOURNEYS.find(j => j.journey.id === begin.dataset.begin);
            if (!entry) return;

            this._busy = true;
            const label = begin.dataset.label || begin.textContent;
            begin.dataset.label = label;
            begin.textContent = 'Preparing…';
            begin.disabled = true;
            window.rise?.audioEngine?.playClick?.();

            try {
                const handoff = await createJourneyHandoff(entry.journey, entry.passages);
                // Straight into the reading. An authored Journey does not
                // pass through the orbital, where its pace and imagery
                // would become knobs (§3.3).
                await this.onBeginSession({
                    ...handoff.config,
                    text: handoff.text,
                    source: handoff.source,
                    textSource: handoff.source
                });
            } catch (error) {
                // Reverent degradation: a Journey that cannot be
                // assembled says so quietly and stays where it is.
                console.error('[Journeys] Handoff failed:', error);
                begin.textContent = 'Unavailable';
                const card = begin.closest('.journey-card');
                const note = document.createElement('p');
                note.className = 'journey-blocked text-mist';
                note.textContent = error?.code === 'JOURNEY_PASSAGE_DRIFT'
                    ? 'This Journey was written about a text that has since changed.'
                    : 'This Journey could not be assembled from the Archive.';
                card?.appendChild(note);
                setTimeout(() => { begin.textContent = label; begin.disabled = false; }, 2400);
            } finally {
                this._busy = false;
                // ALWAYS GIVE THE BUTTON BACK.
                //
                // Beginning a Journey hands off to the app, which asks
                // for photosensitivity consent before the Chamber opens
                // — so this promise stays pending while a modal owns
                // the screen, which is right. What was wrong is that it
                // only ever restored the label on FAILURE. Decline the
                // notice, or come back to Journeys afterwards, and the
                // button sat disabled reading "Preparing…" for good,
                // with no way to start the reading again.
                //
                // The reading has navigated away by now, so restoring
                // is invisible when it succeeds and is the difference
                // between a live door and a dead one when it does not.
                if (begin.isConnected && begin.textContent === 'Preparing…') {
                    begin.textContent = label;
                    begin.disabled = false;
                }
            }
        });
    }

    activate() {}
    deactivate() {}
    destroy() {}
}
