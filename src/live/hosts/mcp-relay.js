/**
 * The page an MCP host is given as RISE's app, and what it does.
 *
 * A host shows an app by loading an HTML document into a sandboxed frame it
 * controls, on an origin of its own. RISE's app is the whole live Current: the
 * shell, the Player, the Chamber, the controls. That is a site, not a document,
 * so the document the host is given does one thing: it frames RISE's own page
 * (`/live?embed=mcp`) and passes the host's messages between the two. The page
 * inside then speaks to the host through it as it would to a parent.
 *
 * The relay understands nothing it passes. It forwards JSON-RPC objects and no
 * other messages, from the host to the page and back; it sends to the page
 * only at the page's own origin, and takes from it only what that origin, from
 * that frame, sent. It fetches and evaluates nothing. What the host sends is
 * still read by the page's port (mcp-port.js), which reads only a parent and
 * bounds and validates everything; the relay is that parent.
 *
 * The script is a string, not a function, because it is served as text: a
 * function's source is rewritten by bundlers, and what is tested here is the
 * text the host will run.
 *
 * NOT VERIFIED IN A PRODUCT HOST. Whether a host lets a view frame another page
 * (the `frameDomains` it is asked for) is the host's policy. The frame asks for
 * sound and nothing else: no microphone (the embed takes no speech) and no full
 * screen (nothing in the embed calls the Fullscreen API).
 */

/** The relay's script, with the page's origin given as a JSON string. Uses nothing but the window it runs in. */
export function relayScript(origin) {
    const child = JSON.stringify(origin).replace(/</gu, '\\u003c');
    return `(function () {
  var CHILD = ${child};
  var frame = document.getElementById('app');
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.jsonrpc !== '2.0') return;
    if (event.source === frame.contentWindow) {
      if (event.origin !== CHILD) return;
      window.parent.postMessage(data, '*');
    } else if (event.source === window.parent) {
      frame.contentWindow.postMessage(data, CHILD);
    }
  });
})();`;
}

/** An origin, and nothing but: scheme, host, and a port if it has one. */
export function isOrigin(value) {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
    } catch {
        return false;
    }
}

export const EMBED_PATH = '/live?embed=mcp';

/**
 * @param {object} options
 * @param {string} options.origin where RISE is served from
 * @param {string} [options.path] the page to frame
 */
export function relayHtml({ origin, path = EMBED_PATH }) {
    if (!isOrigin(origin)) throw new TypeError('The relay is given an origin, and nothing but an origin');
    if (!/^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/u.test(path)) throw new TypeError('The relay is given a plain path');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RISE</title>
<style>html,body{margin:0;height:100%;background:#06051A}iframe{display:block;border:0;width:100%;height:100%}</style>
</head>
<body>
<iframe id="app" title="RISE" src="${origin}${path}" allow="autoplay"></iframe>
<script>${relayScript(origin)}</script>
</body>
</html>
`;
}
