# Task 1 report: validated MCP tool results

Implemented the worker tool result and port handling for `rise.current.v1`. A valid tool call now returns `structuredContent.current` with the exact validated input and says that RISE accepted it for presentation. An invalid result has no structured Current; the MCP port ignores any tool result marked `isError: true`. The browser fake host now asks the real `handleMcp` worker handler for its result and can deliver the result alone or after tool input.

No transport, `APP_URI`, schema, dependency, persistent state, model call, or production configuration changed. The valid tool result is admission for presentation; playback remains with the RISE app.

## Red evidence

Command:

```text
/cygdrive/c/Users/MATEO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe node_modules/vitest/vitest.mjs run worker/mcp-server.test.js src/live/hosts/mcp-port.test.js
```

Observed before production edits: both files failed at the new assertions for the expected reasons. Worker `result.structuredContent` was `undefined` instead of `{ current: BLACK_HOLES_CURRENT }`; `currentFrom(METHODS.toolResult, { isError: true, structuredContent: ... })` returned the Current instead of `null`. The other 57 tests passed.

## Green evidence

Command:

```text
/cygdrive/c/Users/MATEO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe node_modules/vitest/vitest.mjs run worker/mcp-server.test.js src/live/hosts/mcp-port.test.js
```

Observed after edits: 2 test files passed, 59 tests passed.

Command:

```text
/cygdrive/c/Users/MATEO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe node_modules/@playwright/test/cli.js test e2e/live-mcp.spec.js
```

Observed: the initial run passed all 9 tests. After strengthening the invalid-result assertion to verify the actual worker response, the final full run passed 8 tests and reported one flaky Dive/Surface test. Its first attempt waited for the phrase “that nothing, not even light” after playback had advanced to “kilometres from the centre for every solar mass”; Playwright's retry passed. The result-only valid and invalid worker scenarios both passed.

Focused follow-up command:

```text
/cygdrive/c/Users/MATEO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe node_modules/@playwright/test/cli.js test e2e/live-mcp.spec.js --grep 'A Dive is a question'
```

Observed: 1 test passed. No assertions were weakened.

After moving the tool-input notification ahead of the worker response to match host ordering, the affected browser subset (`--grep 'validated tool result|invalid worker result|host’s model answers'`) passed 3/3. The browser build printed pre-existing warnings about mixed JSON import attributes and chunks over 300 kB. The e2e suite exercised the real worker handler locally through the fake host; no product-host session was run.

`git diff --check` passed.
