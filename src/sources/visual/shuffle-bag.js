/**
 * Draw items without replacement, then reshuffle for the next cycle.
 *
 * Providers use this for candidate metadata only: it does not retain decoded
 * images or perform I/O. A stable key gives each curated category an
 * independent deck, and the cycle boundary avoids an immediate repeat when
 * at least two candidates exist.
 */
export class ShuffleBag {
    constructor(random = Math.random) {
        this.random = random;
        this._states = new Map();
    }

    _identity(item) {
        if (item && typeof item === 'object') {
            return String(item.id ?? item.title ?? item.url ?? JSON.stringify(item));
        }
        return String(item);
    }

    _shuffle(items) {
        for (let index = items.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(this.random() * (index + 1));
            [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
        }
        return items;
    }

    draw(key, items = []) {
        const unique = [];
        const seen = new Set();
        for (const item of items) {
            const id = this._identity(item);
            if (seen.has(id)) continue;
            seen.add(id);
            unique.push(item);
        }
        if (unique.length === 0) return null;

        const signature = unique.map(item => this._identity(item)).join('\u001f');
        let state = this._states.get(key);

        // Pools can GROW mid-cycle (non-blocking pin enrichment appends
        // late-resolving works). A pure superset must not reset the deck —
        // a reset re-entered already-shown works, and during a chunked
        // enrichment it reshuffled on every batch so the cycle never
        // completed. Instead, shuffle only the newcomers into what
        // remains; the drawn history stands. Any other change (removal,
        // replacement) is a genuinely different pool and resets below.
        if (state?.ids && state.signature !== signature && state.remaining.length > 0) {
            const additions = unique.filter(item => !state.ids.has(this._identity(item)));
            if (additions.length > 0
                && additions.length === unique.length - state.ids.size) {
                state.remaining.push(...additions);
                this._shuffle(state.remaining);
                for (const item of additions) state.ids.add(this._identity(item));
                state.signature = signature;
            }
        }

        if (!state || state.signature !== signature || state.remaining.length === 0) {
            const lastId = state?.lastId ?? null;
            const remaining = this._shuffle([...unique]);

            // draw() pops from the end. Keep a cycle boundary from showing
            // the same candidate twice when another candidate is available.
            if (lastId !== null
                && remaining.length > 1
                && this._identity(remaining.at(-1)) === lastId) {
                [remaining[0], remaining[remaining.length - 1]] = [
                    remaining[remaining.length - 1],
                    remaining[0]
                ];
            }

            state = {
                signature,
                remaining,
                lastId,
                ids: new Set(unique.map(item => this._identity(item)))
            };
            this._states.set(key, state);
        }

        const selected = state.remaining.pop();
        state.lastId = this._identity(selected);
        return selected;
    }

    clear(key) {
        if (key === undefined) this._states.clear();
        else this._states.delete(key);
    }
}
