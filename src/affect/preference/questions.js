/**
 * Pairwise prompts. A latent name records what a win means.
 * Bradley–Terry does not flip winners; the latent name does that work
 * for anyone reading the scores.
 */

export const PAIR_QUESTIONS = Object.freeze({
    'more-tense': Object.freeze({
        id: 'more-tense',
        prompt: 'Which passage feels more tense?',
        latent: 'tension'
    }),
    calmer: Object.freeze({
        id: 'calmer',
        prompt: 'Which feels calmer?',
        latent: 'calm'
    }),
    'more-intimate': Object.freeze({
        id: 'more-intimate',
        prompt: 'Which is more intimate?',
        latent: 'intimacy'
    }),
    'better-fit': Object.freeze({
        id: 'better-fit',
        prompt: 'Which presentation better fits this passage?',
        latent: 'fit'
    }),
    'coherent-melancholy': Object.freeze({
        id: 'coherent-melancholy',
        prompt: 'Which treatment produces more coherent melancholy?',
        latent: 'coherent-melancholy'
    }),
    'intentional-dissonance': Object.freeze({
        id: 'intentional-dissonance',
        prompt: 'Which version feels intentionally dissonant rather than accidentally mismatched?',
        latent: 'intentional-dissonance'
    })
});

export function questionById(id) {
    return PAIR_QUESTIONS[id] || null;
}
