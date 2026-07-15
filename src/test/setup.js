import { vi } from 'vitest';

function gradient() {
  return { addColorStop: vi.fn() };
}

function create2dContext(canvas) {
  const base = {
    canvas,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(gradient),
    createRadialGradient: vi.fn(gradient),
    createPattern: vi.fn(() => ({})),
    measureText: vi.fn(text => ({ width: String(text).length * 8 })),
    putImageData: vi.fn(),
    getImageData: vi.fn((x, y, width, height) => ({
      width,
      height,
      data: new Uint8ClampedArray(Math.max(0, width * height * 4))
    })),
    createImageData: vi.fn((width, height) => ({
      width,
      height,
      data: new Uint8ClampedArray(Math.max(0, width * height * 4))
    }))
  };
  return new Proxy(base, {
    get(target, property) {
      if (!(property in target)) target[property] = vi.fn();
      return target[property];
    }
  });
}

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(function getContext(type) {
      if (type !== '2d') return null;
      if (!this.__rise2dContext) this.__rise2dContext = create2dContext(this);
      return this.__rise2dContext;
    })
  });
}
