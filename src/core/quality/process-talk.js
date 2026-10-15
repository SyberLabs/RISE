/**
 * Process talk: a reading that speaks of its own making (a dry run, a later review, "the pipeline") instead of its
 * subject (docs/plans/RISE-CHANGES.md, Quality gates). The first real dry runs closed on "will show in the next dry
 * run"; an instruction alone did not stop it, so this list does, and each hit is a sentence a repair can act on.
 *
 * The list is small and literal, each entry a phrase that names the making, not the change:
 *   dry run, test run, trial run, practice run
 *   this run, the next run, a later, future, following, previous or last run
 *   will show or will tell, followed by nothing, in, whether, if, once, after, when, soon or later ("the room will
 *     show the picture" is the subject and passes)
 *   remains to be seen
 *   a later, next, coming, future, final, pending or human review; under review
 *   as of writing, at the time of writing
 *   the pipeline, unless the pull requests speak of a pipeline
 * A phrase the pull requests themselves say (`subject`) is theirs to report, and passes.
 */

const PHRASES = [
  { pattern: /\bdry[- ]runs?\b/giu },
  { pattern: /\b(?:test|trial|practice) runs?\b/giu },
  { pattern: /\b(?:this|next|later|future|following|previous|last) runs?\b/giu },
  { pattern: /\bwill (?:show|tell)(?:(?= *[.,;:!?)]| *$)| (?:in|whether|if|once|after|when|soon|later)\b)/giu },
  { pattern: /\bremains to be seen\b/giu },
  { pattern: /\b(?:(?:later|next|coming|future|final|pending|human) review|under review)\b/giu },
  { pattern: /\b(?:as of|at the time of) (?:this )?writing\b/giu },
  { pattern: /\bthe pipeline\b/giu, subject: /\bpipeline\b/iu }
];

const flat = text => text.replace(/\s+/gu, ' ').toLowerCase();

/**
 * @param {string|unknown[]} texts one text, or one per beat (what is not text is skipped)
 * @param {{subject?: string}} [options] what the pull requests say: a phrase they say passes
 * @returns {Array<{rule: 'process-talk', beat: number, phrase: string, message: string}>} in beat order, then in the
 *   order each phrase is said
 */
export function processTalkProblems(texts, { subject = '' } = {}) {
  const said = flat(subject);
  const problems = [];
  (Array.isArray(texts) ? texts : [texts]).forEach((text, beat) => {
    if (typeof text !== 'string') return;
    const found = [];
    for (const { pattern, subject: theirs } of PHRASES) {
      for (const match of text.matchAll(pattern)) {
        const allowed = theirs ? theirs.test(subject) : said.includes(flat(match[0]));
        if (!allowed) found.push({ at: match.index, phrase: match[0] });
      }
    }
    for (const { phrase } of found.sort((a, b) => a.at - b.at)) {
      problems.push({
        rule: 'process-talk',
        beat,
        phrase,
        message: `beat ${beat} says "${phrase}", which speaks of how this reading was made, not of what changed; say what changed, or leave the sentence out`
      });
    }
  });
  return problems;
}
