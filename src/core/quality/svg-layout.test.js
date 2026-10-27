import { describe, expect, it } from 'vitest';
import { svgLayoutProblems, textAdvance } from './svg-layout.js';
import { DRY_RUN_1_THREE_FRAMES, PUBLISHED } from './fixtures/figures.js';

const fig = (body, { viewBox = '0 0 400 300', root = 'fill="currentColor" font-size="20"' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${root}>${body}</svg>`;
const rules = svg => svgLayoutProblems(svg).problems.map(problem => problem.rule);

describe('the published figures and the one that overlapped', () => {
  it.each(Object.keys(PUBLISHED))('passes the admitted picture on beat %s of the published digest', beat => {
    expect(svgLayoutProblems(PUBLISHED[beat])).toMatchObject({ problems: [], notes: [] });
  });

  it('refuses the first dry run’s three frames: "harmonograph" was drawn across its box', () => {
    const { problems } = svgLayoutProblems(DRY_RUN_1_THREE_FRAMES);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ rule: 'text-crosses-shape', line: 33 });
    expect(problems[0].message).toMatch(/^the text "harmonograph" at x 72, y 206 crosses the edge of the <rect> on line 11 \(x 6, y 10, 132 by 310\)/u);
  });
});

describe('text-overlap', () => {
  it('finds two labels whose boxes meet, and names both and where', () => {
    const { problems } = svgLayoutProblems(fig('<text x="20" y="100">Before</text><text x="60" y="108">After</text>'));
    expect(problems).toEqual([{
      rule: 'text-overlap',
      line: 1,
      message: 'the text "After" at x 60, y 108 overlaps the text "Before" at x 20, y 100; move one clear of the other, or use fewer words'
    }]);
  });

  it('lets lines 24 units apart at 20 units tall stand, and refuses lines 16 apart', () => {
    expect(rules(fig('<text x="20" y="100">One line</text><text x="20" y="124">Next line</text>'))).toEqual([]);
    expect(rules(fig('<text x="20" y="100">One line</text><text x="20" y="116">Next line</text>'))).toEqual(['text-overlap']);
  });

  it('reads tspans as lines of their own, each placed by its x, y and dy', () => {
    expect(rules(fig('<text x="200" y="100" text-anchor="middle"><tspan x="200">Merged pull</tspan><tspan x="200" dy="24">requests</tspan></text>'))).toEqual([]);
    expect(rules(fig('<text x="200" y="100" text-anchor="middle"><tspan x="200">Merged pull</tspan><tspan x="200" dy="8">requests</tspan></text>'))).toEqual(['text-overlap']);
  });
});

describe('text-crosses-shape', () => {
  const box = '<rect x="100" y="100" width="120" height="60" fill="none" stroke="currentColor" stroke-width="2"/>';

  it('lets a label sit inside a box or outside it, and refuses one across its edge', () => {
    expect(rules(fig(`${box}<text x="160" y="137" text-anchor="middle">Inside</text>`))).toEqual([]);
    expect(rules(fig(`${box}<text x="160" y="80" text-anchor="middle">Above it</text>`))).toEqual([]);
    expect(rules(fig(`${box}<text x="160" y="137" text-anchor="middle">Much too wide here</text>`))).toEqual(['text-crosses-shape']);
  });

  it('holds circles and ellipses by their bounding box', () => {
    expect(rules(fig('<circle cx="200" cy="150" r="40" fill="none" stroke="currentColor"/><text x="200" y="157" text-anchor="middle">Core</text>'))).toEqual([]);
    expect(rules(fig('<ellipse cx="200" cy="150" rx="40" ry="20" fill="currentColor"/><text x="230" y="157">Edge</text>'))).toEqual(['text-crosses-shape']);
  });

  it('holds a line, and a path’s segments, absolute or relative, to the stroke they draw', () => {
    expect(rules(fig('<line x1="20" y1="100" x2="380" y2="100" stroke="currentColor"/><text x="40" y="105">Axis</text>'))).toEqual(['text-crosses-shape']);
    expect(rules(fig('<line x1="20" y1="100" x2="380" y2="100" stroke="currentColor"/><text x="40" y="130">Axis</text>'))).toEqual([]);
    expect(rules(fig('<path d="M20,100 H380" stroke="currentColor"/><text x="40" y="105">Axis</text>'))).toEqual(['text-crosses-shape']);
    expect(rules(fig('<path d="m20,100 h360" stroke="currentColor"/><text x="40" y="105">Axis</text>'))).toEqual(['text-crosses-shape']);
    // An elbow connector: the label beside its corner touches no segment, though it is inside its bounding box.
    expect(rules(fig('<path d="M100,40 V200 H300" fill="none" stroke="currentColor"/><text x="120" y="120">Beside</text>'))).toEqual([]);
  });

  it('ignores a shape that draws nothing: no fill and no stroke', () => {
    expect(rules(fig(`<rect x="100" y="100" width="120" height="60" fill="none"/><text x="160" y="137" text-anchor="middle">Much too wide here</text>`))).toEqual([]);
  });

  it('skips a path with an arc, and says so', () => {
    const result = svgLayoutProblems(fig('<path d="M20,100 A50,50 0 0 1 120,100" stroke="currentColor" fill="none"/><text x="40" y="105">Arc</text>'));
    expect(result.problems).toEqual([]);
    expect(result.notes).toEqual(['the <path> on line 1 draws an arc, which is not modelled; it is not checked against the text']);
  });
});

describe('text-outside', () => {
  it('finds text that runs past the viewBox, and says which side', () => {
    const { problems } = svgLayoutProblems(fig('<text x="330" y="100">Overflowing</text>'));
    expect(problems).toEqual([{
      rule: 'text-outside',
      line: 1,
      message: 'the text "Overflowing" at x 330, y 100 runs outside the viewBox (0 0 400 300) on the right; move it inside, or use fewer words'
    }]);
    expect(rules(fig('<text x="200" y="10" text-anchor="middle">Top</text>'))).toEqual(['text-outside']);
  });

  it('places text under translate and scale', () => {
    expect(rules(fig('<g transform="translate(300 0)"><text x="60" y="100">Moved</text></g>'))).toEqual(['text-outside']);
    expect(rules(fig('<g transform="translate(300 0) scale(0.5)"><text x="20" y="100" font-size="40">Moved</text></g>'))).toEqual([]);
  });
});

describe('text-too-small', () => {
  it('measures a label as a phone 390 pixels wide shows it', () => {
    const { problems } = svgLayoutProblems(fig('<text x="20" y="100" font-size="11">Fine print</text>'));
    expect(problems).toEqual([{
      rule: 'text-too-small',
      line: 1,
      message: 'the text "Fine print" at x 20, y 100 is 10.7 pixels tall on a phone 390 pixels wide; make it at least 12 pixels, a font-size of at least 12.4 in this viewBox'
    }]);
    expect(rules(fig('<text x="20" y="100" font-size="13">Fine print</text>'))).toEqual([]);
  });

  it('counts the scale it is drawn under, the viewBox’s width and the room’s', () => {
    expect(rules(fig('<g transform="scale(0.5)"><text x="40" y="200">Small</text></g>'))).toEqual(['text-too-small']);
    expect(rules(fig('<text x="20" y="100" font-size="20">Wide box</text>', { viewBox: '0 0 800 600' }))).toEqual(['text-too-small']);
    expect(svgLayoutProblems(fig('<text x="20" y="100" font-size="13">Fine</text>'), { roomWidth: 300 }).problems.map(problem => problem.rule)).toEqual(['text-too-small']);
  });
});

describe('text-low-contrast', () => {
  it('finds dark ink on the room’s near-black ground, and gives the ratio', () => {
    const { problems } = svgLayoutProblems(fig('<text x="20" y="100" fill="#333333">Dim</text>'));
    expect(problems).toEqual([{
      rule: 'text-low-contrast',
      line: 1,
      message: 'the text "Dim" at x 20, y 100 is #333333 on the room’s ground #0a0a0f, a contrast of 1.5:1; ink it in currentColor or a light colour, at least 4.5:1'
    }]);
  });

  it('resolves the fill from the attribute, the style, the parent and currentColor', () => {
    expect(rules(fig('<text x="20" y="100">Ink</text>'))).toEqual([]);
    expect(rules(fig('<text x="20" y="100" style="fill: #222">Styled</text>'))).toEqual(['text-low-contrast']);
    expect(rules(fig('<g fill="#202020"><text x="20" y="100">Inherited</text></g>'))).toEqual(['text-low-contrast']);
    expect(rules(fig('<text x="20" y="100">Coloured</text>', { root: 'color="#1a1a1a" fill="currentColor" font-size="20"' }))).toEqual(['text-low-contrast']);
    // With no fill anywhere, SVG paints text black.
    expect(rules(fig('<text x="20" y="100">Unfilled</text>', { root: 'font-size="20"' }))).toEqual(['text-low-contrast']);
  });

  it('blends the ink with the ground by its opacity', () => {
    expect(rules(fig('<g opacity="0.3"><text x="20" y="100">Faint</text></g>'))).toEqual(['text-low-contrast']);
    expect(rules(fig('<text x="20" y="100" fill-opacity="0.8">Soft</text>'))).toEqual([]);
  });

  it('measures a label drawn wholly on a filled rect against the rect', () => {
    const bar = '<rect x="240" y="60" width="100" height="260" fill="currentColor"/>';
    // A dry run's chart: a dark number on a light bar reads.
    expect(rules(fig(`${bar}<text x="290" y="100" text-anchor="middle" fill="#000">143.9</text>`))).toEqual([]);
    const { problems } = svgLayoutProblems(fig(`${bar}<text x="290" y="100" text-anchor="middle">143.9</text>`));
    expect(problems.map(problem => problem.message)).toEqual(['the text "143.9" at x 290, y 100 is #eef0ff on the <rect> on line 1 (#eef0ff), a contrast of 1:1; ink it in currentColor or a light colour, at least 4.5:1']);
  });

  it('sees a translucent rect over the filled rect it lies on, not over the room’s ground', () => {
    // A light ground drawn by the figure, a faint dark-blue tint on it, dark-blue words on the tint: they read.
    const tinted = '<rect width="400" height="400" fill="#ffffff"/><rect x="20" y="60" width="300" height="60" fill="#0b57d0" fill-opacity="0.14"/>';
    expect(rules(fig(`${tinted}<text x="40" y="100" fill="#0b57d0">Changed</text>`))).toEqual([]);
    // The same tint with no rect under it is seen over the room's near-black ground, where the words do not read.
    expect(rules(fig('<rect x="20" y="60" width="300" height="60" fill="#0b57d0" fill-opacity="0.14"/><text x="40" y="100" fill="#0b57d0">Changed</text>'))).toEqual(['text-low-contrast']);
  });

  it('measures against the ground it is given', () => {
    expect(svgLayoutProblems(fig('<text x="20" y="100">Ink</text>'), { ground: '#ffffff' }).problems.map(problem => problem.rule)).toEqual(['text-low-contrast']);
  });
});

describe('what it does not model, it says, and never guesses', () => {
  it('skips text under a rotation, and says so', () => {
    const result = svgLayoutProblems(fig('<g transform="rotate(30)"><text x="390" y="100">Turned</text></g>'));
    expect(result.problems).toEqual([]);
    expect(result.notes).toEqual(['the text "Turned" on line 1 is under a transform other than translate and scale (rotate(30)); it is not checked']);
  });

  it('skips a figure with a style sheet, whose rules could set any size or colour', () => {
    const result = svgLayoutProblems(fig('<style>.a { font-size: 4px }</style><text class="a" x="390" y="100">Styled</text>'));
    expect(result).toEqual({ problems: [], notes: ['the figure has a <style> sheet, which is not read; its layout is not checked'], work: 0 });
  });

  it('skips a figure admission refuses', () => {
    expect(svgLayoutProblems('<svg><script/></svg>')).toEqual({ problems: [], notes: ['the figure is not admitted; its layout is not checked'], work: 0 });
  });

  it('draws nothing from defs, markers, clip paths or hidden text, and nothing from an empty label', () => {
    expect(rules(fig('<defs><text id="t" x="390" y="100">Hidden</text></defs><text x="390" y="100" display="none">Gone</text><text x="390" y="100"> </text><text x="390" y="100" font-size="0">Zero</text>'))).toEqual([]);
  });

  it('honours textLength, a label’s drawn width', () => {
    expect(rules(fig('<rect x="100" y="100" width="120" height="60" fill="none" stroke="currentColor"/><text x="160" y="137" text-anchor="middle" textLength="100">Much too wide here</text>'))).toEqual([]);
  });

  it('skips a figure with more comparisons than maxWork allows, and says so, so a caller can bound its time', () => {
    const svg = fig('<rect x="0" y="0" width="10" height="10" fill="currentColor"/><text x="20" y="100">One</text><text x="20" y="200">Two</text>');
    // Two labels against two labels and one shape: 2 × (2 + 1) comparisons.
    expect(svgLayoutProblems(svg, { maxWork: 6 }).notes).toEqual([]);
    expect(svgLayoutProblems(svg, { maxWork: 5 })).toEqual({ problems: [], notes: ['the figure has 6 comparisons to make, more than the 5 this check was given; its layout is not checked'], work: 6 });
    expect(svgLayoutProblems(svg).work).toBe(6);
  });

  it('is pure: the same figure, the same answer', () => {
    expect(svgLayoutProblems(DRY_RUN_1_THREE_FRAMES)).toEqual(svgLayoutProblems(DRY_RUN_1_THREE_FRAMES));
  });
});

describe('the width of a label', () => {
  it('is Helvetica’s advance per character, in em, and 0.56 em for a character outside its table', () => {
    expect(textAdvance('validators')).toBeCloseTo(4.279, 3);
    expect(textAdvance('harmonograph')).toBeCloseTo(6.503, 3);
    expect(textAdvance('文字')).toBeCloseTo(1.12, 3);
  });
});
