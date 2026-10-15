import { describe, expect, it } from 'vitest';
import { processTalkProblems } from './process-talk.js';

describe('process talk: the making spoken of instead of the subject', () => {
  it('finds the closing lines of the dry runs, and names the phrase and the beat', () => {
    const beats = [
      'This week RISE Live got a frame for every visual.',
      'That is the week. Whether the model follows the new picture rules will show in the next dry run.',
      'That way a later fix settles an earlier caveat. Whether the model obeys is for the next dry run to show.'
    ];
    expect(processTalkProblems(beats)).toEqual([
      { rule: 'process-talk', beat: 1, phrase: 'will show in', message: 'beat 1 says "will show in", which speaks of how this reading was made, not of what changed; say what changed, or leave the sentence out' },
      { rule: 'process-talk', beat: 1, phrase: 'dry run', message: 'beat 1 says "dry run", which speaks of how this reading was made, not of what changed; say what changed, or leave the sentence out' },
      { rule: 'process-talk', beat: 2, phrase: 'dry run', message: 'beat 2 says "dry run", which speaks of how this reading was made, not of what changed; say what changed, or leave the sentence out' }
    ]);
  });

  it.each([
    ['A test run showed it holds.', 'test run'],
    ['This run drew six pictures.', 'This run'],
    ['A later run will settle it.', 'later run'],
    ['The pipeline wrote it in one pass.', 'The pipeline'],
    ['It waits on a later review.', 'later review'],
    ['As of writing, nothing is deployed.', 'As of writing'],
    ['Time will tell.', 'will tell'],
    ['Whether it works remains to be seen.', 'remains to be seen']
  ])('finds "%s"', (text, phrase) => {
    expect(processTalkProblems(text).map(problem => problem.phrase)).toEqual([phrase]);
  });

  it.each([
    'On one test machine, the swarm went from 16.4 to 143.9 frames a second.',
    'A later fix settles an earlier caveat.',
    'The room will show the picture on its beat.',
    'The Node pipeline moved into its own folder.',
    'The harmonograph can now run with two rotary pendulums.',
    'It runs Mondays.'
  ])('lets the subject speak: "%s"', text => {
    expect(processTalkProblems(text)).toEqual([]);
  });

  it('lets a phrase stand when the pull requests themselves speak of it', () => {
    const subject = 'Move the digest pipeline out of src/core. The connector submission is still under review.';
    expect(processTalkProblems('The pipeline now lives in scripts. The connector is under review.', { subject })).toEqual([]);
    expect(processTalkProblems('The pipeline now lives in scripts.', { subject: 'Speed up the swarm.' }).map(problem => problem.phrase)).toEqual(['The pipeline']);
  });

  it('reads one text as beat 0, and skips what is not text', () => {
    expect(processTalkProblems('Next dry run.')[0].beat).toBe(0);
    expect(processTalkProblems([undefined, 'fine', 42])).toEqual([]);
  });
});
