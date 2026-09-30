/**
 * Bradley–Terry strengths from pairwise wins.
 *
 * Minorization-maximization on positive strengths, then a mean-centered
 * log score. Ties count as half a win for each item. Judgments are read
 * and never written.
 */

export function fitBradleyTerry(judgments, { questionId, iterations = 100 } = {}) {
    if (typeof questionId !== 'string' || questionId.length === 0) {
        throw new TypeError('questionId is required so prompts are not pooled');
    }
    const rows = (judgments || []).filter(item => item.questionId === questionId);
    const wins = new Map();
    const pairCounts = new Map();
    const touch = (id) => {
        if (!wins.has(id)) wins.set(id, 0);
    };
    const pairKey = (a, b) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);

    for (const row of rows) {
        touch(row.leftId);
        touch(row.rightId);
        const key = pairKey(row.leftId, row.rightId);
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        if (row.winner === 'left') wins.set(row.leftId, wins.get(row.leftId) + 1);
        else if (row.winner === 'right') wins.set(row.rightId, wins.get(row.rightId) + 1);
        else {
            wins.set(row.leftId, wins.get(row.leftId) + 0.5);
            wins.set(row.rightId, wins.get(row.rightId) + 0.5);
        }
    }

    const ids = [...wins.keys()];
    if (ids.length < 2 || rows.length === 0) {
        return {
            model: 'bradley-terry-v1',
            questionId,
            status: 'insufficient-comparisons',
            scores: {},
            iterations: 0,
            observations: rows.length
        };
    }

    const strength = new Map(ids.map(id => [id, 1]));
    let used = 0;
    for (let step = 0; step < iterations; step += 1) {
        used = step + 1;
        let maxDelta = 0;
        for (const id of ids) {
            let denominator = 0;
            for (const other of ids) {
                if (other === id) continue;
                const comparisons = pairCounts.get(pairKey(id, other)) || 0;
                if (!comparisons) continue;
                denominator += comparisons / (strength.get(id) + strength.get(other));
            }
            const next = denominator > 0 ? Math.max(wins.get(id) / denominator, 1e-8) : strength.get(id);
            maxDelta = Math.max(maxDelta, Math.abs(next - strength.get(id)));
            strength.set(id, next);
        }
        if (maxDelta < 1e-9) break;
    }

    const logs = ids.map(id => Math.log(strength.get(id)));
    const mean = logs.reduce((sum, value) => sum + value, 0) / logs.length;
    const scores = {};
    ids.forEach((id, index) => {
        scores[id] = logs[index] - mean;
    });

    return Object.freeze({
        model: 'bradley-terry-v1',
        questionId,
        status: 'fitted',
        scores: Object.freeze(scores),
        iterations: used,
        observations: rows.length
    });
}
