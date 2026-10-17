/**
 * The LaTeX converter turns a Project Gutenberg LaTeX edition into the plain
 * Markdown a School source file holds: chapters as `##` headings, paragraphs
 * at blank lines, mathematics kept in its TeX form inside brackets, notes
 * and the distributor's matter left out, and nothing it does not understand
 * passed through silently.
 */
import { describe, expect, it } from 'vitest';
import { latexToMarkdown } from './latex.js';

const SPAN = { from: '\\mainmatter', to: '\\centerline{\\textsc{the end.}}' };
const book = body => `\\begin{verbatim}\nProject Gutenberg licence\n\\end{verbatim}\n\\frontmatter\nPreface.\n\\mainmatter\n${body}\n\\centerline{\\textsc{the end.}}\nEnd of the Project Gutenberg EBook\n`;

describe('latexToMarkdown', () => {
  it('reads only the span, one ## heading per chapter, from its short title, keeping a longer printed title as its first paragraph', () => {
    const { markdown, chapters } = latexToMarkdown(book([
      '\\chapter[NATURE AND DESIGN OF THIS WORK]{\\large NATURE AND DESIGN OF THIS WORK.}',
      '',
      '1. The design of the following',
      'treatise is to investigate.',
      '',
      '\\chapter[DIVISION OF PROPOSITIONS]',
      '{\\large OF THE DIVISION OF PROPOSITIONS INTO ``PRIMARY.\'\'}',
      '',
      '2. Second.'
    ].join('\n')), SPAN);
    expect(chapters).toBe(2);
    expect(markdown).toBe([
      '## Chapter I: Nature and Design of This Work',
      '1. The design of the following treatise is to investigate.',
      '## Chapter II: Division of Propositions',
      'OF THE DIVISION OF PROPOSITIONS INTO “PRIMARY.”',
      '2. Second.'
    ].join('\n\n'));
    expect(markdown).not.toMatch(/Gutenberg|Preface/u);
  });

  it('keeps mathematics as its TeX in brackets, a lone symbol bare, and a display on the line it was set in', () => {
    const { markdown } = latexToMarkdown(book([
      '\\chapter[SIGNS]{}',
      'The law $x^2 = x$ holds of the class $x$ and of $1$;',
      'we have',
      '\\begin{equation*}',
      '  x(1 - x) = 0, \\tag{3}',
      '\\end{equation*}',
      'and \\[ y = 1 \\] also, and $P[V] = p$.'
    ].join('\n')), SPAN);
    expect(markdown).toBe('## Chapter I: Signs\n\nThe law [x^2 = x] holds of the class x and of 1; we have [x(1 - x) = 0, \\tag{3}] and [y = 1] also, and [P[ V ] = p].');
  });

  it('drops notes with their nested braces and comments, and unwraps emphasis', () => {
    const { markdown, dropped } = latexToMarkdown(book([
      '\\chapter[NOTES]{}',
      'It is \\emph{certain}\\footnote{See \\textit{Metaphysica}, {III}, 3.} and',
      '% a proofer\'s comment',
      '\\textit{true}.\\footnotemark[2]'
    ].join('\n')), SPAN);
    expect(markdown).toBe('## Chapter I: Notes\n\nIt is certain and true.');
    expect(dropped).toEqual({ footnotes: 4 });
  });

  it('drops a note set inside mathematics', () => {
    const { markdown, dropped } = latexToMarkdown(book([
      '\\chapter[NOTES]{}',
      'Thus $x = y\\footnotemark$ and $z = 0\\footnote{As before.}$ hold.'
    ].join('\n')), SPAN);
    expect(markdown).toBe('## Chapter I: Notes\n\nThus [x = y] and [z = 0] hold.');
    expect(dropped).toEqual({ footnotes: 2 });
  });

  it('sets quotes, dashes, accents, small capitals and Greek as printed', () => {
    const { markdown } = latexToMarkdown(book([
      '\\chapter[TYPE]{}',
      '``Logic\'\'---the \\lq art\\rq\\ of \\textit{\\`{a} posteriori}, p.~261--262, Prop.\\ \\textsc{iv}. \\&c.',
      'Virtue is a passion (\\textgreek{p\'ajos}) or a habit (\\textgreek{<\'exis}), \\textgreek{fasvi}:',
      '$\\acute{\\omega}\\varsigma\\ \\kappa\\alpha\\grave{\\iota}$, but $\\mu\\nu$ is a product.'
    ].join('\n')), SPAN);
    expect(markdown).toBe('## Chapter I: Type\n\n“Logic”—the ‘art’ of à posteriori, p. 261–262, Prop. IV. &c. '
      + 'Virtue is a passion (πάθος) or a habit (ἕξις), φασι: ώς καὶ, but [\\mu\\nu] is a product.');
  });

  it('reads a table or a verse a line at a time, and refuses a command it does not know', () => {
    const { markdown } = latexToMarkdown(book([
      '\\chapter[FORMS]{}',
      '\\begin{center}',
      '\\begin{tabular}[h!]{ll@{\\hspace{0in}}cl}',
      '1st. & Universal affirmative & All $Y$\'s are $X$\'s.\\\\',
      '2nd. & Universal negative & No $Y$\'s are $X$\'s.\\\\',
      '\\end{tabular}',
      '\\end{center}'
    ].join('\n')), SPAN);
    expect(markdown).toBe('## Chapter I: Forms\n\n1st. Universal affirmative All Y’s are X’s. 2nd. Universal negative No Y’s are X’s.');
    expect(() => latexToMarkdown(book('\\chapter[X]{}\nA \\mystery{word}.'), SPAN)).toThrow(/\\mystery/u);
    expect(() => latexToMarkdown('no span here', SPAN)).toThrow(/mainmatter/u);
  });
});
