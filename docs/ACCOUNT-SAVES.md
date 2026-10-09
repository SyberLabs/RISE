# SyberLabs account backups

The upper-right Sign in entrance uses the SyberLabs Google/GitHub account and returns to RISE. Signed-in readers open Account there for the portal and explicit text-work backups. Existing enabled-account admission remains controlled by SyberLabs; this change does not open public enrollment.

In Make, import a text into the browser library first. Account → Save a text work uploads only the chosen work's text, divisions and display metadata. It never uploads provider credentials, journals, images, audio, or video. Workshop compositions remain browser-local. Account → Restore a text work validates a saved work with the existing LocalWorks validator before writing it. A different existing copy requires selecting Replace an existing browser copy.

Backups use the version-one account service at `https://syberlabs.io/admin/api/v1`: credentialed GET account/list/detail, and POST saves with the explicit mutation header, app `rise`, and a retry-stable UUID. List, detail and save requests also carry `X-SyberLabs-Expected-User` with the account ID captured when the operation began; the server refuses changed-account cookies before any read or write. A changed-account refusal discards a pending retry and asks the reader to reopen Account. Payloads are limited to 1 MiB; the shared service enforces 50 saves and 10 MiB per user. Each save is a snapshot, and no automatic synchronization or overwrite occurs. Failed requests preserve browser data. Download existing backups from the portal if storage is full.

Deploy the central account producer before this consumer. Preview and localhost are intentionally excluded from production credentialed CORS. Tests simulate the protocol and use real IndexedDB for local restore; live cross-origin account validation belongs to the production deployment check.

Restores also retain the account entrance’s captured identity generation. An observed account change permanently invalidates the old panel; validation checks again at the actual IndexedDB write boundary after asynchronous shelf reads, so an older detail response cannot replace the browser copy.

Replacement validation and the account restore write share one IndexedDB readwrite transaction. A newer draft saved in another tab after the initial restore precheck is preserved unless replacement was explicitly chosen.
