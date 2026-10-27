/**
 * The brands RISE has drawn its figures in for a customer, each reviewed in a pull request the way the reading themes
 * are: the three colors are looked at on every kind (fixtures/<kind>-<id>.svg) before the brand is used. A brand is
 * `confirmed` only once the company has approved its colors; until then nothing runs in it.
 */
export const BRANDS = Object.freeze({
  /**
   * Provisional, sampled on 2026-10-27 from a phone screenshot of githits.com: the page's ground, its body text, and
   * the pink where the wordmark's pink-to-orange fade starts (#FF4FAE, also its section labels). The fade's orange
   * (#FF872F, its code names) is not used: a brand has one accent. A screenshot can shift colors; GitHits confirms.
   */
  githits: Object.freeze({
    confirmed: false,
    brand: Object.freeze({ name: 'GitHits', ground: '#13161A', ink: '#D5D9DF', accent: '#FF4FAE' })
  }),
  /**
   * Provisional, read on 2026-10-27 from openstatusHQ/openstatus packages/ui/src/globals.css (their site was out of
   * reach): the dark theme's background and foreground, oklch(0.145 0 0) and oklch(0.985 0 0), which are also the
   * logo's black disc and white strokes, and the success green, oklch(0.72 0.19 150), that their status bars show for
   * operational. Converted from OKLCH to sRGB and rounded. The light theme fails the kit: no accent of theirs reaches
   * 4.5:1 on white and on its own tint. OpenStatus confirms.
   */
  openstatus: Object.freeze({
    confirmed: false,
    brand: Object.freeze({ name: 'openstatus', ground: '#0A0A0A', ink: '#FAFAFA', accent: '#20C45F' })
  })
});
