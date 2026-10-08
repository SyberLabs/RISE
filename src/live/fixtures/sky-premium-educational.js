/**
 * The first Current Claude composed for RISE in the field (2026-10-08, claude.ai,
 * Sonnet, after reading the premium-educational guide): seventeen beats over one
 * generated scene with four cues, maths in what is shown, and a closing line held.
 * It validated and then failed to compile on a movement cap of sixteen the beats
 * had outgrown; the reader saw "Nothing was said". Kept whole, as it was sent, so
 * the card is tested against a reading a model actually writes.
 */
export const SKY_PREMIUM_EDUCATIONAL = Object.freeze({
  "schema": "rise.current.v2",
  "id": "why-the-sky-is-blue",
  "title": "Why the sky is blue",
  "theme": "cobalt",
  "style": "premium-educational",
  "origin": {
    "kind": "model",
    "name": "Claude",
    "provider": "Anthropic"
  },
  "scenes": [
    {
      "id": "sky",
      "code": "export const reportsCompletion = true;\nexport default function scene(rise) {\n const { lib, size } = rise;\n const plane = lib.axes({ x: [380, 720], y: [-0.25, 1.3] });\n const f = l => Math.pow(400 / l, 4);\n const st = { a: 0 };\n const curve = { to: 0 };\n const pair = { t: 0 };\n const rat = { t: 0 };\n const bx = 450, rx = 650;\n return {\n frame() {\n const ctx = rise.ctx;\n lib.clear();\n lib.grid(plane);\n plane.draw();\n if (st.a > 0) {\n ctx.save();\n ctx.globalAlpha = st.a;\n for (let l = 400; l < 700; l += 5) {\n const hue = 270 * (700 - l) / 300;\n ctx.fillStyle = 'hsl(' + hue + ',80%,55%)';\n const x0 = plane.toX(l), x1 = plane.toX(l + 5);\n const y0 = plane.toY(-0.04), y1 = plane.toY(-0.16);\n ctx.fillRect(x0, Math.min(y0, y1), x1 - x0 + 1, Math.abs(y1 - y0));\n }\n ctx.restore();\n if (st.a >= 1) {\n const ly = plane.toY(-0.16) / size.dpr + 16;\n lib.label('violet', { at: [plane.toX(400) / size.dpr, ly], color: lib.color('muted'), align: 'center' });\n lib.label('red', { at: [plane.toX(700) / size.dpr, ly], color: lib.color('muted'), align: 'center' });\n }\n }\n if (curve.to > 0) lib.plot(plane, f, { to: curve.to });\n if (pair.t > 0) {\n const dash = { color: lib.color('muted'), dash: [6, 6] };\n lib.line(plane, [bx, 0], [bx, f(bx) * pair.t], dash);\n lib.line(plane, [rx, 0], [rx, f(rx) * pair.t], dash);\n }\n if (pair.t >= 1) {\n lib.point(plane, [bx, f(bx)], { label: 'blue' });\n lib.point(plane, [rx, f(rx)], { label: 'red' });\n }\n if (rat.t > 0) {\n const hl = { color: lib.color('highlight'), dash: [6, 6] };\n lib.line(plane, [bx, f(bx)], [bx - 60 * rat.t, f(bx)], hl);\n lib.line(plane, [rx, f(rx)], [rx - 260 * rat.t, f(rx)], hl);\n }\n if (rat.t >= 1) {\n lib.label('over 4 times', { at: [plane.toX(392) / size.dpr, plane.toY((f(bx) + f(rx)) / 2) / size.dpr], color: lib.color('highlight') });\n }\n },\n cue(name, { instant }) {\n if (name === 'strip') return lib.tween(st, { a: 1 }, { ms: 1500, instant }).then(() => rise.done());\n if (name === 'curve') return lib.tween(curve, { to: 1 }, { ms: 2500, instant }).then(() => rise.done());\n if (name === 'pair') return lib.tween(pair, { t: 1 }, { ms: 1500, instant }).then(() => rise.done());\n if (name === 'ratio') return lib.tween(rat, { t: 1 }, { ms: 1800, instant }).then(() => rise.done());\n }\n };\n}"
    }
  ],
  "beats": [
    {
      "say": "Sunlight looks white, but it is every colour at once.",
      "scene": "sky",
      "cue": "strip"
    },
    {
      "hold": {
        "ms": 1500,
        "maxMs": 3000
      }
    },
    {
      "say": "Each colour is a wave, and each has its own wavelength. Violet is short. Red is long.",
      "emphasis": [
        "Violet",
        "Red"
      ]
    },
    {
      "hold": {
        "ms": 1200
      }
    },
    {
      "say": "When light passes through air, molecules bounce some of it sideways. This is called scattering."
    },
    {
      "say": "How strongly light scatters depends on its wavelength. The shorter the wave, the more it scatters.",
      "cue": "curve"
    },
    {
      "hold": {
        "ms": 2000,
        "maxMs": 4000
      }
    },
    {
      "say": "The rule is that scattering goes as one over the wavelength to the fourth power.",
      "show": "$\\text{scattering} \\propto \\dfrac{1}{\\lambda^4}$",
      "emphasis": [
        "fourth power"
      ]
    },
    {
      "hold": {
        "ms": 2000
      }
    },
    {
      "say": "Compare blue light, at about four hundred fifty nanometres, with red light, at about six hundred fifty.",
      "cue": "pair"
    },
    {
      "hold": {
        "ms": 1500,
        "maxMs": 3500
      }
    },
    {
      "say": "Blue is scattered more than four times as strongly as red.",
      "show": "$\\left(\\dfrac{650}{450}\\right)^4 \\approx 4.4$",
      "cue": "ratio",
      "emphasis": [
        "four times"
      ]
    },
    {
      "hold": {
        "ms": 2000,
        "maxMs": 4000
      }
    },
    {
      "say": "So the Sun's light is scattered all across the sky. From every direction, what reaches your eye is mostly blue."
    },
    {
      "say": "Violet scatters even more. But the Sun gives off less of it, the upper air absorbs some, and our eyes respond weakly to it. So blue wins."
    },
    {
      "say": "At sunset, the light crosses far more air. The blue is scattered away on the way, and the oranges and reds are what is left."
    },
    {
      "show": "Short waves scatter most, so the sky is blue.",
      "hold": {
        "ms": 3500
      },
      "place": "centre",
      "size": "larger"
    }
  ]
});
