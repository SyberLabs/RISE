# Maths in both channels: seen and heard from one parse

Date: 2026-10-26. Owner decisions recorded in §2. Applies to RISE Live and Composer (one runtime, one Chamber).

## 1. What a reader meets today

- A formula shows as its TeX in a small monospace face (`E = \frac{1}{2}\hbar\omega`), and a bare `\omega` sits in a sentence.
- The voice reads the markup: dollars, backslashes, "frac", braces.
- "It costs $5 and $10" is typeset as the formula "5 and", and the second dollar is lost.

Reproduced 2026-10-26 by running model-shaped beats through the Live parser and the Current compiler (the production demo answers only about black holes; a real model needs the reader's key).

Causes, each in its own layer:

1. **The typesetter loads too late in Live.** The Chamber fetches KaTeX only if its Session already has maths when it is built (`Chamber.js`, `session.hasMath`). Live builds the Chamber from the first beats of a streaming answer; a formula arriving later is drawn with the not-yet-loaded fallback (`.atom-math.is-source`, monospace) and never redrawn.
2. **Detection is narrow.** `math-text.js` knows `$…$` and `$$…$$` only: not `\(…\)`, `\[…\]`, TeX in backticks or bare commands, and it has no currency rule.
3. **Nothing speaks maths.** The voice is given a beat's `say` verbatim (`beats.js`). It is right only when the model writes `@say <spoken> => <shown>`.
4. **Bars are rewritten.** Live's parser turns every `|` into `/` (`neutralise`), so `$|x|$` would be typeset as `/x/`.
5. **A formula can be cut.** Current text is chunked by sentence and then by word windows; a formula with spaces can be split across two phrases.

## 2. Owner decisions (2026-10-26)

| Question | Decision |
| --- | --- |
| How maths is spoken | Speech Rule Engine (SRE) with ClearSpeak, loaded only when a reading has maths. The download may grow within scope, as long as the total is not massive by conventional standards. A spoken form the model writes (`say => show`) still wins. |
| How long a formula dwells | At least as long as it takes to say, plus about 300 ms per level of structure (fraction, root, sum and the like), the extra capped at about 2.5 s. |
| How display equations enter | Each is a beat of its own: the formula alone on screen, centred, never reflowing the sentence around it. |

## 3. Design: one parse, two renderings

### 3.1 Finding maths (`src/core/math-text.js`, pure, reached by the Worker)

`splitMath(text)` returns `{ kind: 'text' | 'math', value, display }` parts and is the only reader of maths in a text. It recognises:

- display: `$$…$$`, `\[…\]`;
- inline: `$…$`, `\(…\)`;
- TeX in backticks: `` `…` `` whose content holds a TeX command (`\name`);
- bare TeX outside any delimiter: a run that starts at a known command (an allowlist of Greek letters, operators, relations and structures, so `C:\Users` and `\n` are never maths) and extends over its brace groups, sub- and superscripts and adjacent commands.

`$…$` follows Pandoc's rule (the opening `$` has a non-space to its right; the closing one a non-space to its left and no digit after it), and a span whose content starts with a digit and holds no maths sign (`\ ^ _ = + < >`) is money, not maths. Code fences are never read for maths: Live reads them as scene sources before any words exist.

`hasMath(text)` is `splitMath(text).some(math)`.

`fallbackMath(tex)` gives `{ text, speech }` without KaTeX: Unicode for the common commands (Greek, operators, relations, `^2` as ², `_0` as ₀, `\frac{a}{b}` as a⁄b) and plain words for the voice ("omega", "a over b", "squared"). It is what both channels use when a span cannot be parsed or the typesetter has not loaded, so neither ever shows or says a backslash.

### 3.2 Entering the text

- **Live** (`segment-parser.js`): `neutralise` leaves maths spans intact except their bars: `|` becomes `\vert ` and `\|` becomes `\Vert ` inside a span (TeX's own names for the same signs). Bars outside maths are neutralised as before.
- **Composer**: the validator keeps refusing `|`; the guide tells the model to write `\vert` in maths.

### 3.3 Phrases (`src/core/chunker.js`, `rise-current.js`)

With `math: true` (passed only by the Current compiler), the chunker masks each maths span as one word before any split and restores it after, so no rule cuts inside a formula. Each display span is promoted to a paragraph of its own, so it becomes its own phrase: the formula alone, centred (decision 3). Reader texts are chunked exactly as before.

### 3.4 Typesetting and speech (`src/core/math-typeset.js`, browser only)

`loadMath()` fetches, once: KaTeX, its stylesheet, SRE, and SRE's `base` and `en` rule files as RISE's own build assets (SRE's `custom` loader with `delay: true`, so it never fetches from a CDN). SRE runs ClearSpeak with the `TriangleSymbol_Delta` preference. Two names in the English rules are corrected as they load: ℏ "h bar" (not "italic h over two pi") and `lim` "the limit" (not "lim").

`typeset(tex, display)` parses once with KaTeX (`output: 'htmlAndMathml'`) and returns `{ html, speech }`: the HTML for the eye, with KaTeX's MathML beside it for screen readers, and SRE's ClearSpeak reading of that same MathML (without KaTeX's `mathvariant="normal"`, which SRE would say aloud as "normal"). A span KaTeX refuses takes `fallbackMath`. Results are kept by `(tex, display)`, so a formula reads and sounds the same everywhere in a session.

`speakable(text)` is the text with each maths part replaced by its speech. Pauses come from punctuation: a display formula ends a sentence; an inline formula with structure is followed by a comma when the next character is not already punctuation.

Measured (SRE 4.1.4, brotli): code 75 KB, `en` rules 31 KB, `base` 16 KB, loaded only by a reading with maths, never on first load. ClearSpeak takes 2–30 ms a formula in Node.

### 3.5 Holding a formula until it can be shown and said (`src/live/runtime.js`)

The runtime starts `loadMath()` at the first sign of maths in a stream (a segment's text as it arrives) or when a sealed Current with maths opens. Until the load settles (ready or failed), or 3 s have passed, it commits no new passage that holds maths: the reading already on screen goes on, and the formula's passage arrives whole, typeset and spoken, never as source that later snaps into place. After 3 s it commits with the fallback for both channels.

Each committed passage's spoken text is computed once (`speakable`) and the same string goes to the speech governor and the voice. The governor's atom map applies the same `speakable` to each phrase before finding it in the spoken text, so a formula's phrase maps exactly onto its speech, not by proportion.

### 3.6 The Chamber (`Chamber.js`, `Chamber.css`)

- A Session with maths starts the load as before; when the load settles, formulas already drawn from the fallback are redrawn once (the Reader site builds the Chamber before a load can finish).
- Inline maths takes the reading face's size and colour and sits on its baseline without changing the line's height; display maths is centred with room above and below. Both themes inherit `currentColor`. The fallback is set in the reading face, never monospace.

### 3.7 Dwell

- A shown-only beat: each formula phrase lasts at least its estimated speaking time (its plain reading at 65 ms a character) plus 300 ms per structure, that extra capped at 2.5 s (`MATH_DWELL`). The beat grows by what its formulas need; its other phrases keep their share of the hold.
- A spoken formula: the voice is the clock, and the formula stays until its speech ends; the pause after it comes from punctuation (§3.4). A precise extra 300 ms per level needs a pause inside a passage that no voice has today (browser, ElevenLabs, provider TTS and the test voice all speak a passage straight through). That is §5's follow-up.

### 3.8 What the model is told

The Live instructions and the Composer guide keep "maths you show goes between $ signs" and add: RISE says it aloud, so a `@say` may hold the formula itself; write `say => show` only for a reading of your own; inside maths write `\vert`, never the bar.

## 4. Proof

- A corpus (`src/core/math-corpus.js`) of inputs models write: nested fractions, matrices, aligned equations, mixed text and maths, every delimiter form, backticks, bare commands, currency, file paths, malformed TeX, bars. Tests run both channels over it: what is shown (parts, KaTeX renders without error or falls back with no backslash) and what is said (no `$`, `\`, `{`, `}`, `^`, `_` ever reaches the voice; named readings for the key formulas).
- Streaming: the parser's chunk invariance holds for maths cut at every offset.
- The runtime: a formula arriving after the Chamber is up is typeset, the voice says its speech, and the governor maps it exactly.
- A browser test: a Live answer whose third beat has maths shows `.katex` and no `.is-source` or `.is-fallback`.

## 5. Not in this change

- **Voice pauses inside a passage** (the precise 300 ms per level for spoken formulas, §3.7). Its own PR, across the four voices.
- **Composer's refusal of `|` in maths** (§3.2) stays; the guide covers it.
- **Maths in scene labels** (canvas text) stays untypeset, as the Creative Control design says.
