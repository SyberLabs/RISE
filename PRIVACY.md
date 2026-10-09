# Privacy Policy

**Last updated: 9 October 2026**

> **This document has not been reviewed by a lawyer.** Every factual claim in
> it was checked against the RISE source code, but whether those facts satisfy
> any particular law is a question for counsel.

---

## The short version

RISE stores your projects, journals, and settings in your browser. Text you
bring to a Chamber reading is presented and paced locally. Chamber playback
does not send your reading to a model service. RISE's servers run no AI model.
AI features are optional and use a connection you own: either your own
OpenRouter account, where this page sends your request straight to OpenRouter
and usage is billed to you, or Kev running on your own computer through local
RISE. An OpenRouter key stays in this tab's memory and is never sent to RISE's
servers.
If you press **Speak**, your browser may use its speech service to turn your
voice into editable text. RISE does not receive the microphone audio.
Inside ChatGPT or Claude, RISE receives only the reading your assistant writes
for it, plays it, and keeps nothing.
If you subscribe to RISE Plus or sign in as an authorized administrator and its voice is on, the text of readings of your
own material is sent through RISE's server to ElevenLabs to be voiced, and the
audio is kept only in your browser; see section 4.

Create's hosted writing service has been retired and is unavailable. RISE no
longer sends thoughts or revision instructions to any writer.

Keep stores the generated piece in this browser; it does not store the original
thought, detail, or revision instruction. Generated prose can itself contain
sensitive information. Text and project exports are files you deliberately save.
Import and playback do not call the writer.

For subscribers we set one cookie when you buy Plus: a signed token that carries your
Stripe subscription number, with no name or email in it. We do not use
analytics. We do not track you across sites or across visits. We have no
reader accounts. Administrators sign in through Cloudflare Access, which processes their identity and sets its authorization cookie (section 4). If you buy Plus, Stripe processes the payment and knows the email you
paid with; we do not keep it. We do not sell personal information. Network
processing occurs for hosting, external resources you request, the optional
decision actions, and the Plus voice described below.

Scriptorium also has separate optional model routing. It sends the typed
composition intent and target word count to the decision connection you chose.
Local prompt preparation remains available without a model call.

The rest of this document is the detail behind those sentences.

---

## 1. Who is responsible

RISE is published by **Mateo Robles**, doing business as **SyberLabs**
("we", "us"), in California, United States.

For any question about this policy or your data, contact
**syberlabs.software@gmail.com**.

Under the UK GDPR and EU GDPR we are the *controller* for the limited
processing described in sections 4 and 5.

---

## 2. What RISE is

RISE is a browser-based audiovisual reader. It presents public-domain texts
over generative visuals and imagery held by museums and archives. It is
experimental software, and reading in it is free. RISE Plus, an optional
subscription, adds a spoken voice (section 4).

Readers need no sign-up, login or user account. Plus is a receipt, not a
reader account: a paid Stripe subscription and one cookie. Administrator
voice access requires a separate Cloudflare Access sign-in.

---

## 3. What stays on your device

The following is written to your browser's own storage, on your own computer or
phone. RISE does not synchronize this storage to a server, and we cannot recover
it for you. Text selected for a reading stays in the browser as the Chamber
presents it, except the text the Plus voice sends to be voiced (section 4).
Browser storage belongs to its exact site origin: saved work at
`rise.syberlabs.space` does not appear at `rise.syberlabs.io`.

### Local storage

| Key | What it holds | Cleared by erase |
| --- | --- | --- |
| `rise-settings` | Your preferences: pace, colourway, audio, safety choices | yes |
| `rise_recursions_v1` | Journals and reflections you write | yes |
| `rise_workshop_v1` | Reading compositions ("blueprints") you build | yes |
| `rise_global_images_v1` | Imagery you have attached to your own work | yes |
| `rise_sol_plan_v1` | A saved plan from a retired room, kept so it is not lost | yes |
| `rise_orbital_prefs_v1` | Chamber layout preferences | yes |
| `rise_orbital_text_v1` | The text of the reading you last had open | yes |
| `rise_chapel_icon_v1` | The Chapel icon you chose | yes |
| `rise_chapel_rosary_mode_v1` | Which form of the Rosary you pray | yes |
| `rise_rosarium_sound_v1` | The Rosary's soundscape | yes |
| `rise_rosarium_advance_v1` | Whether the Rosary advances on its own | yes |
| `rise_via_sound_v1` | The Via's soundscape | yes |
| `rise_via_advance_v1` | Whether the Via advances on its own | yes |
| `rise-stance-note-seen` | That you have dismissed a one-time notice | yes |
| `rise-beta-session` | That you have passed the access gate | no — see below |

`rise-beta-session` records only that you entered the beta, not who you are.
Erase leaves it deliberately, because clearing it would sign you out of a door
that no longer locks; it goes when the gate does. Clearing your browser's site
data removes it along with everything else.

### Session storage

| Key | What it holds |
| --- | --- |
| `rise_stale_reload` | Where you were headed, so a mid-release reload does not lose your place |

Session storage is discarded when you close the tab.

### IndexedDB

| Database | What it holds |
| --- | --- |
| `rise-personal-assets` | Audio and imagery you have added to your own compositions |
| `rise-workshop-media` | Media belonging to projects you are building |
| `rise-source-cache` | A cache of texts and catalogue responses, so the same request is not repeated |
| `rise-plus-voice` | Plus only: the audio voiced for your own readings, so playing it again costs nothing |

If you use the Plus voice, the audio voiced for your readings is stored only in
this browser's IndexedDB. Erase clears it. Voicing the same text again on
another device, or after Erase, uses your allowance again.

### Text you paste or upload

Text you bring to RISE is processed in your browser and stored in the same
local storage above. Chamber playback does not send excerpts, intent, feedback,
mode, or pace to a reading service or model provider. The Plus voice, when it
is on, sends the text of a reading of your own material to be voiced, as
section 4 describes. An AI reading request
sends the short preference you submit, whether typed or dictated, not the
reading or saved work in your browser.

---

## 4. What hosting and decision services receive

### Your decision connection

RISE offers two optional ways to use AI, and runs no model on its own servers:

- **Connect OpenRouter.** You sign in to your own OpenRouter account, which
  issues a key for RISE in your browser (OAuth PKCE). The key is held only in
  this tab's memory, is sent only to `openrouter.ai`, and is forgotten when you
  disconnect, reload, or close the tab. It is never sent to RISE's servers,
  stored, logged, or exported. Browser extensions you install can read what a
  page holds; RISE loads no third-party scripts. Each request goes from your
  browser to OpenRouter and TypeSafe (the Jev model) under their own policies,
  and is billed to your OpenRouter account. During sign-in, a random one-time
  verifier and state are kept in this tab's session storage and deleted when
  you return.
- **Run locally.** Local RISE runs Kev on your own computer. Requests go from
  the page to a service on the same computer and do not leave it.

What each feature sends, and only when you use it:

- **AI reading request** (Home): the preference you submit and public catalog
  criteria. Not your book text, reading history, saved work, or media.
- **Scriptorium routing:** the typed intent (up to 2,000 characters) and target
  word count. Saved texts, Library entries, source text, media, reading
  history, and proposals are not part of it.
- **Visual direction** while you read: sections of the reading's text, one at
  a time as you read. For a released RISE text this happens automatically
  while you are connected; for text you brought, only after you press **Send
  this reading to Jev** (or **to Kev**, when you run RISE locally) in the
  reading's visual panel, and it stops when you press **Stop sending**. Text
  already sent cannot be recalled.

RISE's server publishes the public reading catalog (released editions,
sounds, and type options, as a static file). It does
not receive your requests or your key. Former server-side AI routes remain
only to tell older tabs they are retired. The exceptions are the optional
OpenAI Live answer below, which is switched off on this site, and the Plus
voice.

### The Plus voice

RISE Plus is an optional subscription, $8.99 a month, that voices readings of
your own material when the Plus voice is on. There is no RISE reader account.
Authorized administrators may use the same voice after Cloudflare Access
sign-in, with separate shared daily and monthly allowances.

- **Payment.** Stripe processes the payment and holds the details you give it,
  under its own policy (<https://stripe.com/privacy>). RISE's server then sets
  one signed, HttpOnly cookie, `__Secure-rise_plus`, sent only to `/api/plus`, that
  carries your Stripe subscription number.
- **Voicing.** To voice a reading, your browser sends its text to RISE's
  server, which sends it to ElevenLabs on SyberLabs' account and returns the
  audio to your browser. Before voicing, the server checks with Stripe that the
  subscription is active, at most once a minute, and Stripe tells it when a
  subscription ends or its payment is refunded or disputed. RISE's server
  keeps no copy of your text or of the audio.
- **Where the audio is kept.** Only in your browser's IndexedDB (section 3).
  Erase clears it. Voicing the same text again on another device, or after
  Erase, uses your allowance again.
- **What the server keeps.** For each Stripe subscription, in a Cloudflare
  Durable Object: the characters voiced in the current billing period and
  in the current UTC day; what
  Stripe last said of the subscription (whether it is active, its customer
  number and its billing period), for one minute of use; how many voicing
  requests it made this minute; whether it was ended, refunded or disputed;
  and the ids of the last 50 Stripe events about it. The server also keeps the
  paid-invoice budget, its cost-policy snapshot and reserved or charged voice costs used to enforce the
  spend ceiling. The allowance is up to 105,000 characters per paid billing
  period, at most 25,000 of them a day, and may be lower according to the
  invoice-derived voice budget. Taxes, discounts and fee or fixed-cost reserves
  can reduce that budget. If the subscription lapses or a limit is reached,
  reading continues without the voice.
- **Administrator sign-in.** Cloudflare Access authenticates approved
  administrators and provides a signed authorization token, including their
  email and subject identifier, under [Cloudflare's policy](https://www.cloudflare.com/privacypolicy/).
  The Worker verifies the token; it does not persist the email, subject or token.
  A separate Durable Object counts the administrators' shared daily voice
  usage and monthly voice spend, enforcing their configured ceilings.
  No reading text or audio is stored in that meter. This identity processing
  is separate from a reader's Stripe subscription.
- **What ElevenLabs keeps.** ElevenLabs processes the text and returns the
  audio under its own policy (<https://elevenlabs.io/privacy-policy>). By
  default it retains the text and audio of each request in the account's
  history, and its policy sets no fixed period for that. Its zero-retention
  mode is offered only to Enterprise customers, and RISE does not use it
  (<https://elevenlabs.io/docs/developers/resources/zero-retention-mode>).
  ElevenLabs states that it may use data from accounts that have not opted out
  to improve its models. RISE does not assert a retention guarantee for
  ElevenLabs.

### Live answers (experimental)

The Live Current page (`/live`) answers a typed question as a spoken, timed
reading. By default it uses a built-in demonstration that makes no network
request. Two providers can be chosen instead, each with a key you type into the
page. The key is held only in that page's memory and forgotten when the session
ends, is refused, or the page closes; it is not stored in your browser. What the
provider receives is your prompt (up to 2,000 characters), RISE's fixed
instructions, and, if you stop an answer to ask about a place in it, the
new question you type (up to 2,000 characters) together with the passages of
that answer you stopped in. Each provider bills your key and
processes the request under its own policy.

- **Google Gemini.** Your browser sends the request, with your Gemini API key
  in a request header, directly to Google at
  `generativelanguage.googleapis.com`. RISE's servers do not see the key or the
  request. See <https://policies.google.com/privacy>.
- **OpenAI Realtime.** This route is switched off on rise.syberlabs.io
  (`LIVE_REALTIME_ENABLED` is `false`), so today it refuses every request.
  When it is switched on, your browser sends your OpenAI key, in a request
  header, and a WebRTC session description (connection details, not your
  prompt) once to RISE's server at `/api/live/realtime`. The server uses the
  key for one request to OpenAI to open the session, with RISE's fixed
  instructions, and returns OpenAI's answer to your browser. It does not store
  or log the key, does not put it in a URL, and does not pass on OpenAI's error
  text, which could contain it. Your prompt and the answer then travel
  directly between your browser and OpenAI and never reach RISE's server.
  Session starts are counted per IP address for one minute, by Cloudflare's
  rate limiter, to stop abuse; RISE keeps no record of them. See
  <https://openai.com/policies/privacy-policy/>.

### RISE inside ChatGPT or Claude

If you add RISE to ChatGPT or Claude, your assistant can present an answer
through RISE. When it does, it calls RISE's tool (`rise_present`) at
`https://rise.syberlabs.io/api/mcp` with the reading it wrote: a title, the
text of its passages, and optionally a theme, a look, and short notes.

- RISE's server checks that reading and hands it back to your assistant's app
  to play. It does not store it, does not log its text, and sends it nowhere
  else.
- RISE receives only what your assistant puts in that call. It never receives
  your conversation, your other messages, your assistant's memory, or your
  files.
- The player runs inside your assistant's app, in a sandbox your assistant
  controls, and loads RISE's code, fonts, and content from
  `rise.syberlabs.io`, like any page of this site (see **Hosting requests**).
- The reading is spoken by your device's own speech voice. RISE's server does
  not produce or receive audio. Some operating systems use an online speech
  service of their own, under that provider's policy.
- Settings you change in the player (theme, text size, how vivid the imagery
  is) are kept in your browser's storage for the player.
- Requests to the tool are counted per IP address for one minute, by
  Cloudflare's rate limiter, to stop abuse. RISE keeps no record of them.

Your assistant's own provider (OpenAI or Anthropic) governs your conversation
under its own privacy policy.

### Optional voice dictation

Pressing **Speak** on a reading request asks your browser to use the microphone.
The browser may process speech on your device or send audio to its own speech
service, depending on the browser. That provider's privacy policy governs its
processing. RISE application code receives only the resulting text in the
editable request field; it does not upload, save, or log microphone audio.
You can edit or discard the text. It is sent to the decision provider only if you submit the
request. Denying microphone permission leaves typed requests available.

### Hosting requests

**Cloudflare** serves `rise.syberlabs.io` and its API. **Netlify** still serves
`rise.syberlabs.space`, where existing browser-local work remains available.
These hosting providers process ordinary request data such as IP address,
request time, requested path, and browser user-agent to deliver and secure the
sites. We use hosting data to diagnose faults, not to build visitor profiles.
The providers' handling is described at
<https://www.cloudflare.com/privacypolicy/> and
<https://www.netlify.com/privacy/>.

If you connect OpenRouter, OpenRouter and TypeSafe receive the fields needed
for each decision you request, under their own policies
(<https://openrouter.ai/privacy>); RISE does not assert a retention guarantee
for them. Local Kev keeps requests on your computer. No model call occurs when
you prepare locally or choose settings yourself.

---

## 5. What your browser fetches from other people

RISE holds texts and artworks *by reference*. When you open a reading, your
browser may request material directly from the institution that holds it.
**Those requests come from your browser, not from us, and we never see them** —
but the receiving organisation will see your IP address, as it would for any
website you visit.

Requests are made anonymously: no account, no credentials, no identifier of
yours is attached, and remote images are loaded with a `no-referrer` policy so
the receiving host is not told which page you were on. If a source is
unreachable, RISE degrades quietly rather than failing.

The content hosts your browser may contact are:

- **Project Gutenberg** — `www.gutenberg.org`
- **arXiv** — `export.arxiv.org`
- **Wikimedia Commons** — `commons.wikimedia.org`, `upload.wikimedia.org`
- **The Metropolitan Museum of Art** — `collectionapi.metmuseum.org`
- **The Art Institute of Chicago** — `api.artic.edu`, `www.artic.edu`
- **The Cleveland Museum of Art** — `openaccess-api.clevelandart.org`
- **The Rijksmuseum** — `id.rijksmuseum.nl`
- **corsproxy.io** — a relay used only where a source does not permit direct
  browser requests
- **Image hosts belonging to the above** — artwork files are served from the
  institutions' own image servers

Each is governed by its own privacy policy, not ours.

**Typefaces are served by us.** RISE previously loaded its fonts from
Google's font CDN, which meant every visitor's browser contacted Google on
every page load. The font files are now hosted on this site, so that
transfer no longer happens.

---

## 6. What we do not do

We state these plainly because the absence is the point.

- **Subscriber cookie.** The Worker sets `__Secure-rise_plus` when you claim a
  purchase; it is HttpOnly, read only by `/api/plus/*`, and never by page
  script. Cloudflare Access sets a separate authorization cookie for
  administrator sign-in. Neither grants authority through a browser role flag.
- **The Plus voice.** With a Plus subscription or verified administrator access and its voice on, the text of readings
  of your own material goes through RISE's server to ElevenLabs on our account,
  and the audio is kept only in your browser. RISE's server keeps no copy of
  either (section 4).
- **No analytics.** No Google Analytics, no Tag Manager, no Plausible, no
  Sentry, no product analytics of any kind. No third-party script of any kind
  runs on the page.
- **No advertising, no pixels, no fingerprinting.**
- **No advertising or reading-history tracking across sites or visits.**
  Subscriber and administrator authorization cookies identify their respective
  entitlements; saved reading work and settings remain on your device.
- **No sale or sharing of personal information**, as those terms are used in
  the California Consumer Privacy Act. Optional Scriptorium routing is for the
  action you choose, not advertising. An AI request goes to the decision
  connection you chose (your OpenRouter account or Kev on your computer).
- **No camera or location access.** The browser security policy denies both.
  It permits the microphone only on RISE's own origin, for optional voice
  dictation. RISE asks for microphone access only after you press **Speak**.

---

## 7. Do Not Track, and tracking by others

California's Online Privacy Protection Act requires every site to say how it
answers a browser's "Do Not Track" signal. Ours is a short answer.

**RISE does not track you — with or without the signal.** It does not follow
you across other websites, does not build a profile of you over time, and does
not carry any advertising or analytics that could. There is no behaviour here
for a Do Not Track signal to switch off, so RISE does not act on the signal
differently: the behaviour the signal asks a site to stop is behaviour RISE
never performs.

**RISE runs no third-party tracking scripts.** The museums and archives in
section 5 receive direct requests for texts or artworks as described there.
Separately, if you connect OpenRouter, the AI requests you make go from your
browser to OpenRouter as described in section 4. These are requests for the
action you chose, not cross-site tracking.

---

## 8. Your controls

Because your data is on your device, you hold it directly.

- **Export.** Settings offers an export of some saved data. It is incomplete
  and there is no complete import path, so it cannot transfer all work from
  `.space` to `.io` or serve as a complete backup.
- **Erase.** Settings also offers an erase that clears that storage. It
  covers every key and database listed in section 3; an automated check
  fails the build if a new one is ever added without being registered.
- **Clear it yourself.** Clearing site data for this domain in your browser
  removes everything RISE has stored, with no involvement from us.

If you are in the UK, EU or another jurisdiction granting data-subject rights,
those rights — access, rectification, erasure, restriction, portability,
objection — concern the server processing described in section 4. Write to
**syberlabs.software@gmail.com**. You also have the right to complain to your
supervisory authority; in the UK that is the Information Commissioner's Office.

For the on-device data in section 3 we cannot action such a request, because we
have no copy to access, correct or delete. The local erase control can delete
that copy immediately. If you connected OpenRouter, it processes your requests
under its own policy; contact OpenRouter about its processing or retention.
Text you voiced with Plus is retained by ElevenLabs under its own policy, as
section 4 describes.

---

## 9. California residents

RISE is published from California. Our server processing is hosting request
data and, for Plus, the voicing, subscription budget/usage records and
administrator identity verification and shared daily/monthly meters, as
described in section 4; AI requests go to the connection you chose.

**We do not sell personal information**, as that term is defined in the
California Consumer Privacy Act. The optional Scriptorium route is disclosed in
section 4. We do not use or disclose sensitive personal information for any
purpose that would require an opt-out. We do not offer financial incentives
for data.

The CCPA's obligations attach to businesses above thresholds — annual gross
revenue over roughly $26.6 million, or buying, selling or sharing the personal
information of 100,000 or more California consumers, or earning half of revenue
from selling it. RISE meets none of them, and reading in it is free. We nonetheless
describe our handling here in full, and the export and erase controls in
section 8 are available to everybody without asking.

Under California Civil Code § 1798.83, "Shine the Light", you may ask whether
we disclosed personal information to third parties for their direct marketing.
We do not, and never have.

---

## 10. Legal basis (UK/EU GDPR)

- **Serving the sites and the public catalog**, including request data in
  section 4: our legitimate interest in
  delivering and securing the application and fulfilling the action you chose
  (Article 6(1)(f)).
- **Storing your work on your device**, in section 3: necessary to provide the
  service you have asked for. It holds your reading and your writing, carries no
  identifier, and is not used to observe you.

We do not rely on consent for anything today, because nothing we do requires
it. If that changes — for example if analytics were ever introduced — we would
ask first.

---

## 11. Retention

RISE does not receive or persist AI requests. An OpenRouter, Gemini, or OpenAI
key is held only in the page's memory and never stored. If the OpenAI Live route
is switched on, RISE's server uses the reader's OpenAI key for one request to
open a session and keeps neither the key nor the request; see section 4. Google
and OpenAI process Live requests under their own policies. Cloudflare and Netlify handle hosting and
API request data under their own policies. OpenRouter processes the requests
you send it under its own policy; see section 4. No provider-side retention
guarantee is made here.

For Plus, RISE's server keeps the current subscription period's character and
financial budget/usage records, its current daily count and the standing,
rate-limit and event records described in section 4. A newer billing period
replaces the old period's meter; a newer day replaces the daily meter,
including the separate shared administrator meter; a newer month replaces
the administrator monthly spend meter. RISE stores no reading text or
audio in these records. ElevenLabs retains voiced text
and audio, and Stripe retains payment records, under their own policies; see
section 4.

Data on your device persists until you erase it or clear your browser storage.

---

## 12. International transfers

The third parties in section 5 are located in various countries, including the
United States. Your browser contacts the listed reading and image sources
directly. If you connect OpenRouter, your browser sends AI requests to
OpenRouter and TypeSafe; consult their policies for processing locations and
transfers. The Plus voice sends text to ElevenLabs, and Stripe processes Plus
payments; the same applies to them. Local Kev keeps requests on your computer.

---

## 13. Children

RISE is not directed at children and is not intended for anyone under 13. We do
not knowingly collect personal information from children. A reader who
chooses model routing may include personal information in the intent sent as
described in section 4.
There is no account system, so we hold no age information about anybody. If you
believe a child has provided us with personal information, write to
syberlabs.software@gmail.com. We will review data held by RISE and explain the
available deletion steps. Requests sent through a reader's own OpenRouter
account are processed by OpenRouter and TypeSafe; contact OpenRouter about them.

Some readings are drawn from adult literary and philosophical works. RISE also
presents moving light and generative visuals, and carries a photosensitivity
warning before any session that may flash. Please see the Terms of Use.

---

## 14. Changes

If this policy changes materially we will update the date at the top and note
the change in the repository history, which is public. Continuing to use RISE
after a change means the revised policy applies.

---

## 15. Contact

**Mateo Robles**, doing business as **SyberLabs**
**syberlabs.software@gmail.com**
<https://rise.syberlabs.io/>
