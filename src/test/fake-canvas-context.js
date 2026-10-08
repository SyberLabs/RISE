/**
 * A 2D canvas context that draws nothing and records what it was asked:
 * every method call as [name, ...args] in `calls`, a count per name in
 * `counts`, and every property set kept, so a test can read back the last
 * lineWidth or font. Any method a scene may call answers; the few that
 * return something return a plausible shape. Used by the scene library's
 * tests and by the headless run of npm run eval:creative.
 */
const RETURNS = {
  measureText: text => ({ width: String(text).length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createConicGradient: () => ({ addColorStop() {} }),
  createPattern: () => ({}),
  getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) }),
  isPointInPath: () => false,
  isPointInStroke: () => false,
  getLineDash: () => []
};

export function fakeCanvasContext() {
  const calls = [];
  const counts = {};
  const state = {
    calls, counts,
    fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    globalAlpha: 1, globalCompositeOperation: 'source-over', lineCap: 'butt', lineJoin: 'miter', lineDashOffset: 0,
    shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)', filter: 'none', imageSmoothingEnabled: true
  };
  return new Proxy(state, {
    get(target, key) {
      if (key in target || typeof key === 'symbol') return target[key];
      return (...args) => {
        calls.push([key, ...args]);
        counts[key] = (counts[key] ?? 0) + 1;
        return RETURNS[key]?.(...args);
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    }
  });
}
