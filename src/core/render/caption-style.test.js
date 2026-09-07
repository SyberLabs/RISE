import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAPTION_COLOR,
  DEFAULT_CAPTION_EDGE_COLOR,
  DEFAULT_CAPTION_FONT_FAMILY,
  DEFAULT_CAPTION_FONT_SIZE,
  DEFAULT_CAPTION_POSITION,
  captionAllowsGlass,
  captionAnchor,
  captionCssFontSize,
  captionModeOn,
  parseCssColor,
  resolveCaptionStyle
} from './caption-style.js';

describe('MP4 caption style', () => {
  it('is off when caption is omitted so Chamber glass still follows the visual', () => {
    expect(captionModeOn(undefined)).toBe(false);
    expect(captionModeOn(null)).toBe(false);
    expect(resolveCaptionStyle(undefined)).toBeNull();
    expect(resolveCaptionStyle(null)).toBeNull();
    expect(captionAllowsGlass(undefined, true)).toBe(true);
    expect(captionAllowsGlass(null, true)).toBe(true);
    expect(captionAllowsGlass(undefined, false)).toBe(false);
  });

  it('fills documented defaults when caption is present', () => {
    expect(resolveCaptionStyle({})).toEqual({
      fontFamily: DEFAULT_CAPTION_FONT_FAMILY,
      fontSize: DEFAULT_CAPTION_FONT_SIZE,
      fontWeight: 600,
      lineHeight: 1.28,
      letterSpacing: 0,
      maxWidth: 0.9,
      color: DEFAULT_CAPTION_COLOR,
      edgeColor: DEFAULT_CAPTION_EDGE_COLOR,
      shadow: null,
      scrim: null,
      glass: false,
      position: DEFAULT_CAPTION_POSITION
    });
    expect(DEFAULT_CAPTION_FONT_FAMILY).toBe('"Helvetica Neue", Arial, sans-serif');
    expect(DEFAULT_CAPTION_FONT_SIZE).toBe(42);
    expect(DEFAULT_CAPTION_COLOR).toBe('#FFFFFF');
    expect(DEFAULT_CAPTION_EDGE_COLOR).toBe('#000000');
    expect(DEFAULT_CAPTION_POSITION).toBe('bottom-center');
    expect(captionAnchor('bottom-center')).toEqual({ x: 0.5, y: 0.9 });
  });

  it('keeps overrides and forces glass off in caption mode', () => {
    const caption = resolveCaptionStyle({
      fontFamily: 'Georgia, serif',
      fontSize: 56,
      color: '#FFEE00',
      edgeColor: '#111111',
      position: 'top-center'
    });
    expect(caption).toMatchObject({
      fontFamily: 'Georgia, serif',
      fontSize: 56,
      color: '#FFEE00',
      edgeColor: '#111111',
      position: 'top-center'
    });
    expect(captionAllowsGlass(caption, true)).toBe(false);
    expect(captionAllowsGlass({ fontSize: 42 }, true)).toBe(false);
    expect(captionAnchor('top-center')).toEqual({ x: 0.5, y: 0.1 });
    expect(captionAnchor('center')).toEqual({ x: 0.5, y: 0.5 });
    expect(captionAnchor({ x: 0.5, y: 0.9 })).toEqual({ x: 0.5, y: 0.9 });
    expect(captionAnchor({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 });
  });

  it('drops the outline when edgeColor is none', () => {
    expect(resolveCaptionStyle({ edgeColor: 'none' }).edgeColor).toBeNull();
    expect(resolveCaptionStyle({ color: '#F4C430', edgeColor: 'none' }).color).toBe('#F4C430');
  });

  it('opts glass back in only when the caption asks for it', () => {
    expect(captionAllowsGlass({ glass: true }, false)).toBe(true);
    expect(captionAllowsGlass({ glass: true }, true)).toBe(true);
    expect(captionAllowsGlass({ glass: false }, true)).toBe(false);
    expect(resolveCaptionStyle({ glass: true }).glass).toBe(true);
  });

  it('fills shadow and scrim shorthands and rejects nonsense', () => {
    expect(resolveCaptionStyle({ shadow: true }).shadow)
      .toEqual({ blur: 18, color: '#000000', opacity: 0.55 });
    expect(resolveCaptionStyle({ scrim: true }).scrim)
      .toEqual({ height: 0.34, color: '#0A0A0C', opacity: 0.62 });
    expect(resolveCaptionStyle({ scrim: { height: 0.5, opacity: 0.4 } }).scrim)
      .toEqual({ height: 0.5, color: '#0A0A0C', opacity: 0.4 });
    expect(resolveCaptionStyle({ shadow: 'yes', scrim: 3 })).toMatchObject({
      shadow: null,
      scrim: null
    });
  });

  it('keeps typographic overrides and falls back on unusable numbers', () => {
    expect(resolveCaptionStyle({
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: -0.01,
      maxWidth: 0.72
    })).toMatchObject({
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: -0.01,
      maxWidth: 0.72
    });
    expect(resolveCaptionStyle({ fontWeight: 0, lineHeight: -2, maxWidth: 9 }))
      .toMatchObject({ fontWeight: 600, lineHeight: 1.28, maxWidth: 1 });
  });

  it('scales 1080-wide CSS px onto the frame and parses hex color', () => {
    expect(captionCssFontSize(42, 1080)).toBe(42);
    expect(captionCssFontSize(42, 540)).toBe(21);
    expect(parseCssColor('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(parseCssColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(parseCssColor('nope', '#00FF00')).toEqual({ r: 0, g: 255, b: 0, a: 255 });
  });
});
