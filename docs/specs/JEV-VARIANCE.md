# SyberLabs Jev Variance Harness

Jev makes one Choice decision per uncached reading request. The Worker supplies
the released book catalog, the reader's intent, and a rotating experience hint.
Jev returns only choice IDs. The Worker expands them into the Chamber JSON; it
never asks Jev to write reading text or CSS.

For each intent and catalog revision, an atomic Redis counter advances the
turn. The counter key is an HMAC, so the raw intent is absent from Redis keys.
Four short-lived decision cache slots limit repeat calls for the same intent.

When the reader explicitly asks to discover something new, adjacent turns
offer disjoint halves of the released catalog. Jev chooses within the offered
half, so adjacent discovery requests cannot return the same book while the
catalog stays fixed. Requests that name a book or author, or describe a theme,
keep the full catalog. Rotating visual directions encourage different Chamber
settings when the reader leaves those settings open. Explicit preferences
always take priority.

The hard guarantee is book diversity for adjacent broad discovery turns. Jev
may choose the same settings, or the same book for a specific request, when
that best honors the reader's intent. The harness adds no second model call.
