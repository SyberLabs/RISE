# Provider decision: OpenRouter

On 25 September 2026 the user reported Jev was not working and explicitly approved moving forward with OpenRouter. This supersedes the earlier recommendation to try TypeSafe first.

The useful requirement is a reliable decision before reading progression. The implementation preserves that boundary while replacing the provider-specific request and response. One native server-side fetch is sufficient; an SDK and a multi-provider framework add no needed behavior here.

The [OpenRouter structured-output API](https://openrouter.ai/docs/guides/features/structured-outputs) accepts JSON Schema on compatible provider endpoints. RISE requests one configured model and validates the returned action locally. It does not turn a self-reported number into confidence and does not use response healing to accept malformed decisions.

Routing requires support for the requested parameters and excludes endpoints whose policy allows data collection. These routing settings do not themselves establish zero retention by OpenRouter or every processor. See [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection) and RISE's [privacy policy](../../PRIVACY.md).

Laya remains a possible later self-hosted evaluation. Its [model card](https://huggingface.co/convaiinnovations/laya) cautions that the base checkpoint needs specialization; similar response shapes do not prove equivalent reading decisions. There is no Laya runtime or silent fallback in this change.
