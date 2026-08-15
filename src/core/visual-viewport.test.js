import { describe, it, expect } from 'vitest';
import {
  applyVisualViewportBottom,
  CHAMBER_VV_BOTTOM_VAR,
  clearVisualViewportBottom,
  visualViewportBottomInset
} from './visual-viewport.js';

describe('visualViewportBottomInset', () => {
  it('is 0 when the visual viewport fills the layout viewport', () => {
    expect(visualViewportBottomInset({
      innerHeight: 720,
      visualViewport: { offsetTop: 0, height: 720 }
    })).toBe(0);
  });

  it('lifts chrome by the hidden strip under a large-viewport innerHeight', () => {
    // iPhone 14-ish: 100vh / innerHeight still 844 while Safari chrome
    // leaves ~720px of glass. The control bar used to live in that 124px.
    expect(visualViewportBottomInset({
      innerHeight: 844,
      visualViewport: { offsetTop: 0, height: 720 }
    })).toBe(124);
  });

  it('follows a pinch-zoom that shifts the visual viewport up', () => {
    expect(visualViewportBottomInset({
      innerHeight: 844,
      visualViewport: { offsetTop: 80, height: 500 }
    })).toBe(264);
  });

  it('never goes negative when the visual viewport reports larger', () => {
    expect(visualViewportBottomInset({
      innerHeight: 700,
      visualViewport: { offsetTop: 0, height: 844 }
    })).toBe(0);
  });

  it('is 0 without a visualViewport (desktop jsdom)', () => {
    expect(visualViewportBottomInset({ innerHeight: 800 })).toBe(0);
    expect(visualViewportBottomInset(null)).toBe(0);
  });
});

describe('applyVisualViewportBottom', () => {
  it('writes the CSS variable the Chamber bar reads', () => {
    const root = { style: new Map() };
    root.style.setProperty = (key, value) => root.style.set(key, value);
    root.style.removeProperty = (key) => root.style.delete(key);

    const inset = applyVisualViewportBottom(root, {
      innerHeight: 844,
      visualViewport: { offsetTop: 0, height: 720 }
    });
    expect(inset).toBe(124);
    expect(root.style.get(CHAMBER_VV_BOTTOM_VAR)).toBe('124px');

    clearVisualViewportBottom(root);
    expect(root.style.has(CHAMBER_VV_BOTTOM_VAR)).toBe(false);
  });
});
