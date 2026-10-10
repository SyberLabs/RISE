# MCP Inspector run, 2026-10-10

Tool-test path 1 for RISE's connector-directory submission: every tool and the card resource
called against the live server with the official MCP Inspector, from its command line. The
other path, the connector called from Claude, is in [CLAUDE-RUN-2026-10-10.md](CLAUDE-RUN-2026-10-10.md).
The submission packet that cites both is
[the connector submission packet](../../product/discussions/2026-10-10-connector-submission-packet.md).

| | |
| --- | --- |
| When | 2026-10-10, about 05:10 to 05:15 UTC |
| Server | `https://rise.syberlabs.io/api/mcp`, Streamable HTTP, no authentication |
| Live release | `a70c443701f8a73a27de846a690568c309d6c87f` (`/release.txt` at the time) |
| Inspector | `@modelcontextprotocol/inspector` **2.10.1** (latest on npm at the time), CLI mode |
| Node | v22.23.2, Windows 11; run from a checkout of `main` at `a70c4437` |
| Secrets | none exist for this server; nothing below is redacted, only trimmed where marked |

Every call below was answered over the network by the live Worker. Each exited 0, except the
two deliberate refusals in section 4, which exit 5: the Inspector's code for a tool result
with `isError: true`, which it also reports as `{"error":{"code":"tool_is_error",…}}`.

## Summary

| Call | Result |
| --- | --- |
| `tools/list` | Two tools, `rise_present` and `rise_guide`, each with a title, a description, an input schema and annotations `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`. 10,747 bytes as compact JSON. `--strict` reports no schema portability problem. |
| `tools/list --app-info` | `rise_present` has an app: `ui://rise/current`, `text/html;profile=mcp-app`, `connectDomains` and `resourceDomains` only `https://rise.syberlabs.io`, `frameDomains: []`. `rise_guide` has none. |
| `tools/call rise_guide` (`style=premium-educational`) | The format reference, 23,503 bytes of text, 381 lines: the v1 example and rules, beats, the scene engines with parameters and cues, the code-scene contract, the premium-educational guidance, three worked Currents (`vector-length`, `slope-of-a-curve`, `parts-of-a-cell`) and the figure rules. No `3Blue1Brown`. |
| `tools/call rise_present` (the worked `parts-of-a-cell`) | Accepted. A one-line receipt as text; `structuredContent.current` is the Current sent, byte for byte. |
| `tools/call rise_present` (an invalid Current) | Refused cleanly: `isError: true` and a one-line validator message. |
| `tools/call rise_guide` (an unknown style) | Refused cleanly: `isError: true` and the list of styles. |
| `resources/list` | Three resources: the card `ui://rise/current` and the two style references. |
| `resources/read ui://rise/current` | 7,528 bytes of HTML, `text/html;profile=mcp-app`, with its own Content Security Policy (no `unsafe-eval`) and the same CSP and display modes in `_meta` as the tool declares. |

## Commands and results

The commands are as run. On Windows the `rise_present` call was made from Git Bash, so that
the Current's JSON reaches the Inspector unaltered; `cell-args.json` is
`{"current": <the worked Current>}`, written from `EXAMPLES` in
`src/live/guide/styles/premium-educational.js`.

### 1. `tools/list`

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method tools/list
```

The full listing is 25,779 bytes pretty-printed, mostly the `current` input schema. Each tool
as the listing gave it, without its input schema:

```json
{"name":"rise_present","title":"Present a reading in RISE","annotations":{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false},"_meta":{"ui":{"resourceUri":"ui://rise/current"},"ui/resourceUri":"ui://rise/current","openai/toolInvocation/invoking":"Preparing the reading","openai/toolInvocation/invoked":"The reading is ready to play"},"required":["current"],"descriptionBytes":1844}
{"name":"rise_guide","title":"RISE style reference","annotations":{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false},"required":["style"],"descriptionBytes":157}
```

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method tools/list --strict
```

Exit 0, nothing on standard error: no portability problem of any severity.

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method tools/list --app-info --advertise-apps
```

```json
{"hasApp":true,"toolName":"rise_present","resourceUri":"ui://rise/current","csp":{"connectDomains":["https://rise.syberlabs.io"],"resourceDomains":["https://rise.syberlabs.io"],"frameDomains":[]},"prefersBorder":false,"resourceMimeType":"text/html;profile=mcp-app"}
{"hasApp":false,"toolName":"rise_guide"}
```

### 2. `tools/call rise_guide`

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method tools/call --tool-name rise_guide --tool-arg style=premium-educational
```

One text block, 23,503 bytes. Its first lines:

```text
A RISE Current is one JSON object. RISE speaks its passages aloud and shows each as it is spoken.

{
  "schema": "rise.current.v1",
  "id": "light-and-holes",
  "title": "Why a black hole is black",
  "theme": "cobalt",
  "look": "signal",
  "origin": {
    "kind": "model",
    "name": "Your name",
    "provider": "Who runs you"
  },
```

Its sections, by the line each begins on: `Rules:` (28), `Beats:` (91), the scenes and their
parameters and cues (102), `rise.lib` (137), `Premium Educational ("style": "premium-educational")`
(159), `How to write it:` (165), `The worked Currents in this style, each accepted by RISE as
it stands:` (176) with the three Currents at 178, 241 and 309, and `Figures: a picture you draw
as SVG.` (365).

### 3. `tools/call rise_present` with the worked Current `parts-of-a-cell`

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method tools/call --tool-name rise_present \
  --tool-args-json "$(cat cell-args.json)"
```

The arguments: the guide's worked Current as it stands, 2,427 bytes: `schema`
`rise.current.v2`, `style` `premium-educational`, `theme` `jade`, one SVG figure scene `cell`
(the guide's worked figure), seven beats including one hold and a closing shown line, and the
guide's placeholder `origin` (`{"kind":"model","name":"Your name","provider":"Who runs you"}`).

The result:

```json
{
  "content": [
    { "type": "text", "text": "RISE is presenting \"The parts of an animal cell\" (id \"parts-of-a-cell\") to the reader: 7 beats, about 36 seconds. The reader starts it with Play." }
  ],
  "structuredContent": { "current": "… the Current sent, unchanged (compared byte for byte) …" }
}
```

### 4. Refusals

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method tools/call --tool-name rise_present \
  --tool-args-json '{"current":{"schema":"rise.current.v1","id":"x","title":"Empty","segments":[]}}' \
  --format json
```

```json
{"result":{"content":[{"type":"text","text":"RISE refused this Current: Expected a plain object ($.origin). Correct it and call rise_present again."}],"isError":true}}
```

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method tools/call --tool-name rise_guide --tool-arg style=nonexistent --format json
```

```json
{"result":{"content":[{"type":"text","text":"Call rise_guide with {\"style\": <a style>} only; the styles are premium-educational, open-field."}],"isError":true}}
```

### 5. `resources/list`

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method resources/list
```

```json
{
  "resources": [
    {
      "name": "rise-current",
      "title": "RISE",
      "uri": "ui://rise/current",
      "description": "Plays a Current: spoken in the device’s own voice and shown as it is spoken.",
      "mimeType": "text/html;profile=mcp-app"
    },
    {
      "name": "rise-guide-premium-educational",
      "title": "RISE style: premium-educational",
      "uri": "ui://rise/guide/premium-educational",
      "description": "The format reference for the premium-educational style, with worked Currents.",
      "mimeType": "text/markdown"
    },
    {
      "name": "rise-guide-open-field",
      "title": "RISE style: open-field",
      "uri": "ui://rise/guide/open-field",
      "description": "The format reference for the open-field style, with worked Currents.",
      "mimeType": "text/markdown"
    }
  ]
}
```

### 6. `resources/read ui://rise/current`

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli https://rise.syberlabs.io/api/mcp \
  --transport http --method resources/read --uri ui://rise/current
```

One content entry, 7,528 bytes of text. Its metadata:

```json
{"uri":"ui://rise/current","mimeType":"text/html;profile=mcp-app","_meta":{"ui":{"csp":{"connectDomains":["https://rise.syberlabs.io"],"resourceDomains":["https://rise.syberlabs.io"],"frameDomains":[]},"prefersBorder":false},"openai/widgetDomain":"https://rise.syberlabs.io","openai/ui":{"availableDisplayModes":["inline","fullscreen","pip"]},"openai/widgetDescription":"A spoken reading of the answer, its words and a visual shown as they are spoken, which the reader starts with Play and can pause and resume."}}
```

The HTML, its first 40 lines of 138:

```html
<!DOCTYPE html>
<html lang="en">

<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://rise.syberlabs.io blob:; worker-src blob:; connect-src https://rise.syberlabs.io; img-src https://rise.syberlabs.io blob: data:; font-src https://rise.syberlabs.io; style-src https://rise.syberlabs.io 'unsafe-inline'; media-src https://rise.syberlabs.io blob:">
<meta name="rise-embed" content="/live?embed=mcp">
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description"
    content="RISE — an audiovisual reader. Curated texts, paced reading, and museum imagery arranged around the words.">
  <meta name="theme-color" content="#06051A">
  <title>RISE — Audiovisual Reader</title>
  <link rel="icon" href="https://rise.syberlabs.io/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="https://rise.syberlabs.io/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="https://rise.syberlabs.io/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="https://rise.syberlabs.io/apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="RISE">
  <meta property="og:title" content="RISE — Audiovisual Reader">
  <meta property="og:description"
    content="A text does not have to appear only as a page. Curated texts, paced reading, and museum imagery arranged around the words.">
  <meta property="og:url" content="https://rise.syberlabs.io/">
  <meta property="og:image" content="https://rise.syberlabs.io/og-cover.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="RISE — Audiovisual Reader">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="RISE — Audiovisual Reader">
  <meta name="twitter:description"
    content="A text does not have to appear only as a page. Curated texts, paced reading, and museum imagery arranged around the words.">
  <meta name="twitter:image" content="https://rise.syberlabs.io/og-cover.png">
  <link rel="canonical" href="https://rise.syberlabs.io/">
  <!-- The chrome's two faces, latin only: Instrument Sans (one variable file
       for 400/500/600) and Instrument Serif. Everything else swaps in. -->
  <link rel="preload" href="https://rise.syberlabs.io/fonts/instrument-sans-normal-2ee17598.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="https://rise.syberlabs.io/fonts/instrument-serif-normal-5eb09b5a.woff2" as="font" type="font/woff2" crossorigin>

  <!-- The saved colourway, before first paint. A file, not inline: the
       policy is script-src 'self'. Must stay ahead of the stylesheet. -->
  <!-- Styles imported via app.js module -->
```
