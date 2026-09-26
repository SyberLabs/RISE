> Historical Jev checkpoint review. Superseded for provider integration by [the OpenRouter review](openrouter-review.md); these test counts and TypeSafe statements describe the earlier implementation.

# Runtime integration review

## Findings

- Fixed: PageReader previously deduplicated by source passage only. If one long paragraph flowed onto another page, the later page could be revealed without a new decision. PageReader now requests one decision for the requested page's combined text excerpt (maximum 2,000 characters), keyed by page index and the exact submitted excerpt. A rejected page retains its target; retry requests that same excerpt again.
- Fixed: `ready` events from Player and PageReader now include Jev's `action`. PageReader reports one action for the page after its decision, so multiple passage requests cannot consume feedback on an earlier paragraph or hide a slower recommendation behind a later continue result.
- Adapted `e2e/page-typography.spec.js` to assert the intentional Jev pagination contract and that elongation remains blocked. `e2e/page-mode.spec.js` already covers the bounded paginated behavior. `e2e/page-controls.spec.js` checks control visibility, not elongated projection, and needs no change. `e2e/page-roundtrip.spec.js` is skipped while `JOURNEYS = []`.

## Consent and service boundary

The Chamber factory opens consent before initializing the player or revealing text. The client sends same-origin JSON to `/api/jev-decision`, bounds excerpts to 2,000 characters and intent/feedback to 500, and constrains pace to 100–500 WPM (default 200). The browser does not receive the provider key. The endpoint validates origin, method, media type, body size and result shape, uses a server-side key, applies an 8-second upstream timeout, and configures 30 requests per IP per minute. A failed or invalid decision blocks progression; there is no fallback decision.

Rosarium and Via check generation and active phase after awaiting a decision, so a late answer does not show a prayer after the room changes phase. Root also fixed Escape-to-chooser to cancel the pending request and increment its generation; dedicated regression tests cover both rooms.

## Validation

- Focused Jev unit run: 6 files, 47 tests passed (`PageReader.jev`, `Player.jev`, devotional gate/integration, consent gate, and conductor).
- Browser e2e was not run by this review; the Page Jev browser check is being run separately. `e2e/page-typography.spec.js` was updated but not browser-verified here.
- Root's deployed endpoint probe returned HTTP 503 because the server-side TypeSafe key is not configured. Live Jev decisions are therefore not verified; the endpoint correctly fails closed.
- No claim is made here about real service availability, deploy-time rate-limit enforcement, or browser/audio playback.
