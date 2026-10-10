# The connector called from Claude, 2026-10-10

Tool-test path 2 for RISE's connector-directory submission: both tools called by Claude
through the RISE connector attached to a claude.ai account. Path 1, the MCP Inspector, is in
[INSPECTOR-RUN-2026-10-10.md](INSPECTOR-RUN-2026-10-10.md). The submission packet that cites
both is [the connector submission packet](../../product/discussions/2026-10-10-connector-submission-packet.md).

| | |
| --- | --- |
| When | 2026-10-10 |
| Surface | A Claude Code session with the RISE connector attached to the claude.ai account; the tools appeared to Claude as connector tools, not as a local server |
| Server | `https://rise.syberlabs.io/api/mcp` (custom connector, no authentication) |
| Live release | `a70c4437` at the time |
| Corresponds to | Demo prompt 5, "Show me the parts of an animal cell in RISE." |

## The calls

### 1. `rise_guide`

Arguments: `{"style": "premium-educational"}`.

Result: the format reference. It held the v1 and v2 examples, the beat rules, the scene
engines with their parameters and cues, the code-scene contract and `rise.lib`, the figure
(SVG) rules with the allowed element list, the premium-educational guidance, and the three
worked Currents (`vector-length`, `slope-of-a-curve`, `parts-of-a-cell`). It contained no
"3Blue1Brown" and no imperative second-person instruction lines.

### 2. `rise_present`

Arguments: `{"current": …}`, the guide's worked Current `parts-of-a-cell`: schema
`rise.current.v2`, style `premium-educational`, theme `jade`, one SVG figure scene `cell` (the
guide's worked figure), seven beats including one hold and one shown closing line, and
`origin` `{"kind": "model", "name": "Claude Fable 5.1", "provider": "Anthropic"}`.

Result: **accepted**. The tool returned the Current as `structuredContent`, unchanged: the
figure was admitted and nothing was refused, so a host that renders the card would have
presented it.

## What this run does not cover

A Claude Code session calls the tools but does not render the card. Before attesting in the
portal, the owner still has to run the demo prompts in the claude.ai chat interface (where the
card renders and plays) and in the Claude iOS and Android apps. Record those runs here when
they are done.
