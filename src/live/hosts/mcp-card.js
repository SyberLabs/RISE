/**
 * The page an MCP host is given as RISE's app, self-contained.
 *
 * Claude restricts `frameDomains` pending security review, and ChatGPT asks a
 * written justification for a frame of the server's own domain, so the card
 * does not frame RISE's page (mcp-relay.js): it IS RISE's page. The deployed
 * index.html is served with every address of its own (its modules, styles,
 * fonts and icons) made absolute at RISE's origin, and a
 * `<meta name="rise-embed">` naming the route the card opens, which the app
 * reads instead of the host's address (src/core/embed-address.js).
 *
 * The addresses are absolute, not under a `<base>`, because a host's sandbox
 * refuses one: Claude's policy carries `base-uri 'self'`, and a root-relative
 * address there is the sandbox's, not RISE's. The addresses the app forms as
 * it runs are RISE's by the same rule: a module's chunks and assets are
 * addressed from the module itself (vite.config.js), and a path written in
 * the code goes through siteUrl (embed-address.js).
 *
 * What the card may reach is declared, and only RISE's origin: modules,
 * styles, fonts and images (`resourceDomains`) and fetches (`connectDomains`).
 * It frames nothing. A Web Worker cannot start from another origin; the
 * engines that use one fall back to the main thread.
 *
 * The card also carries that boundary itself, as a `<meta>` policy ahead of
 * everything it loads, so it holds whatever policy a host does or does not
 * apply (a host's policy applies as well; the stricter of the two wins). It
 * has no 'unsafe-eval', and a `blob:` worker inherits it: a generated scene
 * can neither build code from a string nor load or fetch from another origin.
 */
import { EMBED_PATH, isOrigin } from './mcp-relay.js';

export const CARD_PATH = EMBED_PATH;

/** The content-security declaration of the card. */
export function cardCsp(origin) {
  return { connectDomains: [origin], resourceDomains: [origin], frameDomains: [] };
}

/**
 * The card's own Content Security Policy. `blob:` is for the scene worker, its module and the figures'
 * images; `data:` images for the few the styles inline; inline styles for the Chamber's element styles.
 */
export function cardPolicy(origin) {
  return [
    "default-src 'none'",
    `script-src ${origin} blob:`,
    'worker-src blob:',
    `connect-src ${origin}`,
    `img-src ${origin} blob: data:`,
    `font-src ${origin}`,
    `style-src ${origin} 'unsafe-inline'`,
    `media-src ${origin} blob:`
  ].join('; ');
}

/**
 * @param {object} options
 * @param {string} options.origin where RISE is served from
 * @param {string} options.indexHtml the deployed index.html
 * @param {string} [options.path] the route the card opens
 */
export function cardHtml({ origin, indexHtml, path = CARD_PATH }) {
  if (!isOrigin(origin)) throw new TypeError('The card is given an origin, and nothing but an origin');
  if (!/^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/u.test(path)) throw new TypeError('The card opens a plain path');
  const page = String(indexHtml);
  if (/<base[\s>]/iu.test(page)) throw new TypeError('The page has a base of its own');
  // Every root-relative address of the page's own becomes RISE's; a protocol-relative `//` is not one.
  // The web app manifest goes: a host's policy has no manifest-src for RISE (it only reports the
  // blocked fetch), and a card is never installed.
  const html = page.replace(/\s*<link\b[^>]*\brel="manifest"[^>]*>/iu, '').replace(/\b(src|href)="\/(?!\/)/gu, `$1="${origin}/`);
  const head = /<head(?:\s[^>]*)?>/iu.exec(html);
  if (!head) throw new TypeError('The page has no head');
  const at = head.index + head[0].length;
  // The policy first: a <meta> policy governs only what the parser meets after it.
  // The path is an attribute value: its ampersands are written as entities and read back decoded.
  return `${html.slice(0, at)}\n<meta http-equiv="Content-Security-Policy" content="${cardPolicy(origin)}">`
    + `\n<meta name="rise-embed" content="${path.replace(/&/gu, '&amp;')}">${html.slice(at)}`;
}
