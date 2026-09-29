# A live Current inside an MCP host

**Status:** the adapter, the messaging port and the proof that the real runtime works through them are built and tested against a **fake** host. The MCP server, the embeddable app bundle, and any trial in a real MCP host are **not built and not done**. Nothing here has run inside ChatGPT, Claude, or any other host.

## The idea, and why it needs so little

In an MCP host the provider is the host's own model. It does not stream to RISE; it calls a tool whose argument is a sealed Current (`rise.current.v1`). That is exactly the seam RISE already has: an external declarative answer, validated, lowered, and played by the existing Player. So the host adds no runtime logic. It adds an *adapter*:

```
host model ─ rise_present({ current, replyTo? }) ─▶ port.onCurrent ─▶ mcp-app adapter
   ▲                                                                        │ validateRiseCurrent (strict, fail closed)
   │                                                                        ▼
 ui/message (a Dive, with a one-time reference) ◀── runtime.dive       events ─▶ the same reducer, runtime, Player, voice
```

- `src/live/adapters/current-events.js` turns a sealed Current into the events a streaming provider would have sent, after `validateRiseCurrent`, so a hostile field, marker, anchor or oversize answer is refused before one event exists. Nothing is added: a sealed Current has no evidence and no condition, and none is invented.
- `src/live/adapters/mcp-app.js` is the adapter. A Dive is asked of the model as a message that quotes the place (as quoted, not as instruction) and carries a one-time reference the model must send back as `replyTo`; only a Current carrying that reference answers it. A model that never answers is timed out, the Dive fails, and the parent is untouched.
- `src/live/hosts/mcp-port.js` is the app's side of the host's messaging: JSON-RPC over `postMessage`, listening only to the frame's parent, ignoring anything malformed or oversize, reading a Current only from the two places one is expected, matching requests to answers, bounded and timed out. Every method name is in one table (`METHODS`).
- The voice is **RISE's own**. A host's voice timing is not something an app can rely on, and a Dive has to hold the voice, so the runtime's voice renderer speaks, exactly as everywhere else.

## The tool contract (as designed, unverified)

`rise_present` takes `{ current: <rise.current.v1>, replyTo?: string }`. `replyTo`, when present, is a reference RISE gave for a Dive and must be echoed exactly. The host's model is told this in the message RISE sends; a Current without the reference is not shown for a Dive. The sealed Current stays strict and unchanged: `replyTo` lives on the tool's argument, not in the Current.

## What is tested

| | Tested against a fake host |
|---|---|
| The same conformance suite every adapter passes (two scenarios cannot happen to it and are held by its own tests: an answer arrives whole so cannot be interrupted part way; there is no transport to lose) | yes |
| Answer read whole; refused whole, with nothing partly applied, if hostile; timed out if the host never answers | yes |
| Dive answered only by its reference; wrong, missing or hostile references ignored; host refusing the question | yes |
| The real runtime, Player, speech clock and voice through the adapter: read, Dive, Surface to the same atom, stop from any moment leaves no timer | yes |
| The port: only the parent, malformed and oversize ignored, requests matched, bounded, timed out, closed cleanly | yes |
| A real MCP host | **no** |

## What is not built

1. **The MCP server**: the tool definition, and the `ui://` resource that serves the app. It needs an MCP SDK dependency and somewhere to run; it is not a thing to add without a decision about both.
2. **The app bundle that runs inside the frame.** The Chamber is wired to the shell's router and factory. Embedding it means either a standalone Chamber mount without the router, or a slimmer presenter; the second would not be "the existing Player and Chamber runtime", so I have not chosen it silently. This is the largest remaining piece.
3. **Streaming.** An answer arrives whole, so the first words wait for the whole answer, unlike the standalone host. A host that streams a tool's partial input could be used later; the adapter states `streaming: false`.
4. **Evidence and conditions.** A sealed Current carries neither. If a host's model should be able to supply them, that is a change to the sealed schema, which I have kept strict on purpose.

## Platform limits to expect (from the extension as I understand it; unverified)

The app runs in a sandboxed frame. Whether it may use the microphone, `speechSynthesis`, autoplay or fullscreen depends on the frame's `allow` attributes and the host's policy, not on RISE. If speech is not available the reading is paced silently and says so, as it does in the standalone host. Network access from the frame is bounded by the host's policy; RISE needs none here, since the model's answer arrives through the host. Audio will need a user gesture. The host, not RISE, decides whether a message can be put into the conversation; a refused Dive says so in words.

## Where things are

`src/live/adapters/current-events.js`, `mcp-app.js`, `src/live/hosts/mcp-port.js`, tests beside them, `src/test/fake-mcp-port.js` and `sealed-current.js`.
