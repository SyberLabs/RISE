# Privacy Policy

**Last updated: 6 September 2026**

> **This document has not been reviewed by a lawyer.** Every factual claim in
> it was checked against the RISE source code, but whether those facts satisfy
> any particular law is a question for counsel.

---

## The short version

RISE runs entirely in your browser. Your reading, your writing, your journals,
your saved projects and your settings are stored on your own device and are
never sent to us. We have no server that receives them, because we have no
server at all beyond the one that hands your browser the application files.

We do not use cookies. We do not use analytics. We do not track you across
sites or across visits. We have no accounts, so we do not know who you are. We
have never sold or shared personal information, and there is nothing to sell.

The rest of this document is the detail behind those sentences.

---

## 1. Who is responsible

RISE is published by **Mateo Robles**, doing business as **SyberLabs**
("we", "us"), in California, United States.

For any question about this policy or your data, contact
**syberlabs.software@gmail.com**.

Under the UK GDPR and EU GDPR we are the *controller* for the limited
processing described in sections 4 and 5. For everything in section 3 there is
no controller relationship at all, because the data never reaches us.

---

## 2. What RISE is

RISE is a browser-based audiovisual reader. It presents public-domain texts
over generative visuals and imagery held by museums and archives. It is
experimental software offered without charge.

There is no sign-up, no login and no user account of any kind.

---

## 3. What stays on your device

The following is written to your browser's own storage, on your own computer or
phone. **None of it is transmitted to us.** We cannot read it, we cannot
recover it for you, and we do not know it exists.

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

### Text you paste or upload

Text you bring to RISE is processed in your browser and stored in the same
local storage above. It is never uploaded. This is a property of how the
application is built, not a promise about how we behave: there is no endpoint
that accepts it.

---

## 4. What our own server sees

The application files are served by **Netlify**, which acts as our hosting
processor. Like any web server, Netlify's infrastructure records ordinary
request data, which typically includes your IP address, the time of the
request, the file requested, and your browser's user-agent string.

We use these logs only to serve the site and to understand faults. We do not
build profiles from them, and we do not combine them with anything else.

Netlify's own handling of this data is governed by
<https://www.netlify.com/privacy/>.

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

The hosts your browser may contact are:

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

- **No cookies.** RISE sets none. There is no `document.cookie` call anywhere
  in the application.
- **No analytics.** No Google Analytics, no Tag Manager, no Plausible, no
  Sentry, no product analytics of any kind. No third-party script of any kind
  runs on the page.
- **No advertising, no pixels, no fingerprinting.**
- **No cross-site or cross-visit tracking.** Nothing stored on your device is
  an identifier for you; it is your own work and your own settings.
- **No sale or sharing of personal information**, as those terms are used in
  the California Consumer Privacy Act. There is no personal information in our
  possession to sell.
- **No camera, microphone or location access.** The application is served with
  a `Permissions-Policy` header that denies all three at the browser level,
  regardless of what any code might ask for.

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

**No third party collects personally identifiable information about your
activity across websites through RISE.** We run no third-party scripts. The
museums and archives in section 5 receive a request for a text or an artwork,
as any website you visit receives a request; none of them is given an
identifier for you, and none is placed here to observe you.

---

## 8. Your controls

Because your data is on your device, you hold it directly.

- **Export.** Settings offers an export that assembles everything RISE has
  stored — settings, journals, projects and media — into a single file you keep.
- **Erase.** Settings also offers an erase that clears that storage. It
  covers every key and database listed in section 3; an automated check
  fails the build if a new one is ever added without being registered.
- **Clear it yourself.** Clearing site data for this domain in your browser
  removes everything RISE has stored, with no involvement from us.

If you are in the UK, EU or another jurisdiction granting data-subject rights,
those rights — access, rectification, erasure, restriction, portability,
objection — apply to the request-log data described in section 4. Write to
**syberlabs.software@gmail.com**. You also have the right to complain to your
supervisory authority; in the UK that is the Information Commissioner's Office.

For the on-device data in section 3 we cannot action such a request, because we
have no copy to access, correct or delete. The export and erase controls give
you the same outcome immediately.

---

## 9. California residents

RISE is published from California, and the same answer applies wherever you
are: we hold no personal information about you beyond the hosting request logs
in section 4.

**We do not sell or share personal information**, and never have, as those
terms are defined in the California Consumer Privacy Act. We do not use or
disclose sensitive personal information for any purpose that would require an
opt-out. We do not offer financial incentives for data.

The CCPA's obligations attach to businesses above thresholds — annual gross
revenue over roughly $26.6 million, or buying, selling or sharing the personal
information of 100,000 or more California consumers, or earning half of revenue
from selling it. RISE meets none of them, and it is free. We nonetheless
describe our handling here in full, and the export and erase controls in
section 8 are available to everybody without asking.

Under California Civil Code § 1798.83, "Shine the Light", you may ask whether
we disclosed personal information to third parties for their direct marketing.
We do not, and never have.

---

## 10. Legal basis (UK/EU GDPR)

- **Serving the site**, including the request logs in section 4: our legitimate
  interest in delivering and securing the application (Article 6(1)(f)).
- **Storing your work on your device**, in section 3: necessary to provide the
  service you have asked for. It holds your reading and your writing, carries no
  identifier, and is not used to observe you.

We do not rely on consent for anything today, because nothing we do requires
it. If that changes — for example if analytics were ever introduced — we would
ask first.

---

## 11. Retention

We retain nothing of yours, so there is nothing for us to expire. Hosting
request logs are retained by Netlify under its own schedule.

Data on your device persists until you erase it or clear your browser storage.

---

## 12. International transfers

The third parties in section 5 are located in various countries, including the
United States. Your browser contacts them directly; we do not transfer anything
to them, because we hold nothing to transfer.

---

## 13. Children

RISE is not directed at children and is not intended for anyone under 13. We do
not knowingly collect personal information from children, and we hold no
personal information about any reader beyond the request logs in section 4.
There is no account system, so we hold no age information about anybody. If you
believe a child has provided us with personal information, write to
syberlabs.software@gmail.com and we will delete anything we hold.

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
<https://rise.syberlabs.space/>
