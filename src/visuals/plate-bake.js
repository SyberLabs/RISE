/**
 * Cooperative plate bake. Gallery spreads accumulate + develop across
 * animation frames so the seam is a blit, not a 500–900 ms freeze.
 *
 * Engines expose beginBake / stepBake. generate() drains in one call
 * (catalog, chamber-stage, tests). PlateField pumps ~8 ms per frame
 * and starts the next bake as soon as a plate is committed.
 */

export const PLATE_BAKE_BUDGET_MS = 8;

export function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

/**
 * Run queue items until the budget is spent. Each job(remainMs) returns
 * true when that job is finished.
 *
 * @param {Array<function(number): boolean>} queue
 * @param {number} budgetMs
 * @returns {boolean} true when the queue is empty
 */
export function pumpBakeQueue(queue, budgetMs) {
    if (!queue || queue.length === 0) return true;
    const deadline = nowMs() + Math.max(0, budgetMs);
    while (queue.length) {
        const remain = deadline - nowMs();
        if (remain <= 0) return false;
        if (queue[0](remain)) queue.shift();
        else return false;
    }
    return true;
}
