import { build } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CSS = `:root{font:14px/1.45 system-ui,sans-serif;color:#eee;background:#111}*{box-sizing:border-box}body{margin:0;padding:12px}main{max-width:760px;margin:auto}h1,h2{font-weight:600}h1{font-size:1.1rem}h2{font-size:1rem;margin:.8em 0 .4em}p{margin:.45em 0;color:#bbb}button{margin:.25em .35em .25em 0;padding:.45em .65em;border:1px solid #555;border-radius:6px;background:#222;color:#eee;cursor:pointer}#surface{height:260px;position:relative;overflow:hidden;background:#050609;border:1px solid #333;border-radius:8px}#surface .attractor-canvas{position:absolute;inset:0;width:100%;height:100%}.still-surface{position:absolute;inset:0;display:grid;place-items:center;color:#777;background:#090a0d}#log{max-height:190px;overflow:auto;padding-left:2em;font:11px/1.35 ui-monospace,monospace}#log li{margin:.2em 0;overflow-wrap:anywhere}#status,#reader-status{color:#ddd}section{border-top:1px solid #333;margin-top:1em;padding-top:.5em}.evidence{color:#aaa}`;

export async function buildDecoupledWidgetHtml() {
  const result = await build({
    configFile: false, root: ROOT, mode: 'production', logLevel: 'silent',
    build: {
      write: false, emptyOutDir: false, minify: true,
      lib: { entry: resolve(ROOT, 'scripts/gate0-decoupled/widget-entry.js'), formats: ['es'], fileName: 'gate0-decoupled-widget.js' },
      rollupOptions: { output: { inlineDynamicImports: true } }
    }
  });
  const assets = (Array.isArray(result) ? result : [result]).flatMap(output => output.output ?? []);
  const module = assets.find(asset => asset.type === 'chunk' && asset.fileName.endsWith('.js'));
  if (!module || module.imports.length || module.dynamicImports.length || assets.some(asset => asset.type === 'asset')) {
    throw new Error('The decoupled widget must build into one self-contained module.');
  }
  const script = module.code.replace(/<\/script/giu, '<\\/script');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RISE Gate 0 decoupled</title><style>${CSS}</style></head><body><main><h1>RISE Gate 0 decoupled visual</h1><p id="instance">Waiting for initial delivery.</p><div id="surface" aria-label="Visual surface"></div><p id="server-sequence">Server sequence not received</p><p id="applied-sequence">Widget applied sequence not received</p><p id="delivery-source">Delivery source: none</p><p id="server-times">Admission, bridge receipt, renderer acceptance, and frame callback are separate observations.</p><p id="status" role="status">Widget status: waiting.</p><section><h2>Reader controls</h2><button id="set-04" type="button">Set intensity 0.4</button><button id="set-075" type="button">Set intensity 0.75</button><button id="still" type="button">Set still</button><button id="read" type="button">Read server state</button><button id="stop" type="button">Stop</button><p id="reader-status">No reader request sent.</p></section><section><h2>Reader markers</h2><button id="context" type="button">Send marker to model context</button><button id="message" type="button">Send marker message</button><p class="evidence">Host acknowledgments do not prove model receipt.</p></section><section><h2>Bounded evidence</h2><button id="export" type="button">Export log</button><ol id="log"></ol></section></main><script type="module">${script}</script></body></html>`;
}
