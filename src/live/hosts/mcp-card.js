/**
 * The page an MCP host is given as RISE's app, self-contained.
 *
 * Claude restricts `frameDomains` pending security review, and ChatGPT asks a
 * written justification for a frame of the server's own domain, so the card
 * does not frame RISE's page (mcp-relay.js): it IS RISE's page. The deployed
 * index.html is served with a `<base>` at RISE's origin, so every address the
 * app resolves (its modules, styles, fonts, content and audio) is RISE's, and
 * a `<meta name="rise-embed">` naming the route the card opens, which the app
 * reads instead of the host's address (src/core/embed-address.js).
 *
 * What the card may reach is declared, and only RISE's origin: modules,
 * styles, fonts and images (`resourceDomains`), fetches (`connectDomains`) and
 * the base itself (`baseUriDomains`). It frames nothing. A Web Worker cannot
 * start from another origin; the engines that use one fall back to the main
 * thread.
 */
import { EMBED_PATH, isOrigin } from './mcp-relay.js';

export const CARD_PATH = EMBED_PATH;

/** The content-security declaration of the card. */
export function cardCsp(origin) {
  return { connectDomains: [origin], resourceDomains: [origin], baseUriDomains: [origin], frameDomains: [] };
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
  const html = String(indexHtml);
  const head = /<head(?:\s[^>]*)?>/iu.exec(html);
  if (!head) throw new TypeError('The page has no head');
  if (/<base[\s>]/iu.test(html)) throw new TypeError('The page has a base of its own');
  const at = head.index + head[0].length;
  // The path is an attribute value: its ampersands are written as entities and read back decoded.
  return `${html.slice(0, at)}\n<base href="${origin}/">\n<meta name="rise-embed" content="${path.replace(/&/gu, '&amp;')}">${html.slice(at)}`;
}
