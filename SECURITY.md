# Security

## How to report

Please report a vulnerability privately, by either of these:

- **GitHub's private advisory form:** <https://github.com/SyberLabs/RISE/security/advisories/new>
- **Email:** syberlabs.software@gmail.com

Do not open a public issue for a vulnerability. Say what you found, where, and how to
reproduce it. A short proof of concept helps more than a long write-up.

The same contacts are published at <https://rise.syberlabs.io/.well-known/security.txt>.

## What is in scope

- The site at <https://rise.syberlabs.io/> and the Cloudflare Worker that serves it,
  including its `/api/*` routes.
- The MCP connector at `https://rise.syberlabs.io/api/mcp`: its two tools (`rise_guide`,
  `rise_present`), the card it serves (`ui://rise/current`), and the sandbox that runs a
  model-written scene inside that card.
- The source in this repository.

Out of scope: the services RISE links to or reads from (museums, archives, Project
Gutenberg, OpenRouter, the hosts that embed the card), findings that need a compromised
device or browser, and load or denial-of-service testing against the live site. Please
do not test in ways that degrade the site for its readers or touch anyone's data but
your own.

## What to expect

RISE is a small project at SyberLabs. We will reply to say a report arrived, tell you
what we are doing about it, and say when a fix is live. There is no fixed response time and no bug bounty. If you would like to be
credited when the fix is published, say so in the report.
