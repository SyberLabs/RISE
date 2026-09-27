/** Original, locally synthesized keyboard miniatures for Jev sound choices. */
const PIECES = {
  lullaby: {
    name: 'Lullaby', description: 'A soft rocking cradle song with open fifths and a descending, warm melody.',
    bpm: 66, partials: [[1, 1], [2, 0.16], [3, 0.035]], attack: 0.04, level: 0.025,
    bars: [
      [[60, 0, 2.8, 0.018], [67, 0, 2.8, 0.012], [72, 0.5, 1.2, 0.025], [76, 2, 1.5, 0.022], [74, 3, 0.8, 0.018]],
      [[57, 0, 2.8, 0.016], [64, 0, 2.8, 0.012], [72, 0.5, 1.3, 0.022], [69, 2, 1.4, 0.02], [67, 3, 0.8, 0.018]],
      [[53, 0, 2.8, 0.016], [60, 0, 2.8, 0.012], [69, 0.5, 1.2, 0.022], [72, 2, 1.3, 0.02], [69, 3, 0.8, 0.018]],
      [[55, 0, 2.8, 0.016], [62, 0, 2.8, 0.012], [71, 0.5, 1.2, 0.022], [67, 2, 1.4, 0.02], [64, 3, 0.8, 0.017]]
    ]
  },
  nocturne: {
    name: 'Nocturne', description: 'A spacious moonlit melody over gently shifting, low keyboard tones.',
    bpm: 54, partials: [[1, 1], [2, 0.25], [3, 0.1], [4, 0.025]], attack: 0.075, level: 0.022,
    bars: [
      [[48, 0, 3.7, 0.014], [60, 0, 3.7, 0.009], [76, 0.75, 2.1, 0.022], [79, 3, 0.9, 0.018]],
      [[44, 0, 3.7, 0.014], [56, 0, 3.7, 0.009], [77, 1, 1.6, 0.021], [76, 2.75, 1.1, 0.018]],
      [[41, 0, 3.7, 0.014], [53, 0, 3.7, 0.009], [72, 0.5, 2.2, 0.021], [76, 3, 0.9, 0.018]],
      [[43, 0, 3.7, 0.014], [55, 0, 3.7, 0.009], [74, 0.75, 1.9, 0.021], [71, 3, 0.9, 0.018]]
    ]
  },
  waltz: {
    name: 'Waltz', description: 'A lilting three-beat dance with alternating bass notes and bright chordal turns.',
    bpm: 96, beatsPerBar: 3, partials: [[1, 1], [2, 0.32], [3, 0.08]], attack: 0.018, level: 0.024,
    bars: [
      [[48, 0, 0.75, 0.03], [60, 1, 0.65, 0.014], [64, 1, 0.65, 0.012], [67, 1, 0.65, 0.012], [67, 2, 0.65, 0.017], [72, 2, 0.65, 0.014], [76, 2, 0.65, 0.012]],
      [[45, 0, 0.75, 0.03], [60, 1, 0.65, 0.014], [64, 1, 0.65, 0.012], [69, 1, 0.65, 0.012], [69, 2, 0.65, 0.017], [72, 2, 0.65, 0.014], [76, 2, 0.65, 0.012]],
      [[41, 0, 0.75, 0.03], [57, 1, 0.65, 0.014], [60, 1, 0.65, 0.012], [65, 1, 0.65, 0.012], [65, 2, 0.65, 0.017], [69, 2, 0.65, 0.014], [72, 2, 0.65, 0.012]],
      [[43, 0, 0.75, 0.03], [59, 1, 0.65, 0.014], [62, 1, 0.65, 0.012], [67, 1, 0.65, 0.012], [67, 2, 0.65, 0.017], [71, 2, 0.65, 0.014], [74, 2, 0.65, 0.012]]
    ]
  },
  blues: {
    name: 'Blues', description: 'A relaxed shuffle with blue notes, bent-feeling thirds, and a walking I-IV-V phrase.',
    bpm: 82, partials: [[1, 1], [2, 0.42], [3, 0.16], [4, 0.04]], attack: 0.012, level: 0.024,
    bars: [
      [[41, 0, 0.72, 0.03], [45, 1, 0.68, 0.024], [48, 2, 0.68, 0.024], [49, 3, 0.55, 0.021], [60, 2 / 3, 0.34, 0.019], [63, 1 + 2 / 3, 0.34, 0.018], [65, 2 + 2 / 3, 0.34, 0.02], [67, 3 + 2 / 3, 0.34, 0.018]],
      [[46, 0, 0.72, 0.03], [50, 1, 0.68, 0.024], [53, 2, 0.68, 0.024], [54, 3, 0.55, 0.021], [65, 2 / 3, 0.34, 0.019], [68, 1 + 2 / 3, 0.34, 0.018], [70, 2 + 2 / 3, 0.34, 0.02], [72, 3 + 2 / 3, 0.34, 0.018]],
      [[48, 0, 0.72, 0.03], [52, 1, 0.68, 0.024], [55, 2, 0.68, 0.024], [56, 3, 0.55, 0.021], [60, 2 / 3, 0.34, 0.019], [63, 1 + 2 / 3, 0.34, 0.018], [65, 2 + 2 / 3, 0.34, 0.02], [66, 3 + 2 / 3, 0.34, 0.018]],
      [[41, 0, 0.72, 0.03], [45, 1, 0.68, 0.024], [48, 2, 0.68, 0.024], [40, 3, 0.55, 0.021], [60, 2 / 3, 0.34, 0.019], [63, 1 + 2 / 3, 0.34, 0.018], [65, 2 + 2 / 3, 0.34, 0.02], [67, 3 + 2 / 3, 0.34, 0.018]]
    ]
  },
  bossa: {
    name: 'Bossa', description: 'A mellow syncopated bossa nova with warm extended chords and a gently pulsing bass.',
    bpm: 112, partials: [[1, 1], [2, 0.25], [3, 0.055]], attack: 0.014, level: 0.021,
    bars: [
      [[48, 0, 0.9, 0.024], [60, 0.75, 0.5, 0.01], [64, 0.75, 0.5, 0.009], [67, 0.75, 0.5, 0.009], [71, 0.75, 0.5, 0.008], [55, 2, 0.75, 0.018], [60, 2.5, 0.45, 0.009], [64, 2.5, 0.45, 0.008], [67, 2.5, 0.45, 0.008]],
      [[45, 0, 0.9, 0.024], [60, 1, 0.45, 0.01], [64, 1, 0.45, 0.009], [67, 1, 0.45, 0.009], [71, 1, 0.45, 0.008], [52, 2.5, 0.65, 0.018], [60, 3, 0.45, 0.009], [64, 3, 0.45, 0.008], [69, 3, 0.45, 0.008]],
      [[41, 0, 0.9, 0.024], [57, 0.75, 0.5, 0.01], [60, 0.75, 0.5, 0.009], [65, 0.75, 0.5, 0.009], [69, 0.75, 0.5, 0.008], [48, 2, 0.75, 0.018], [57, 2.5, 0.45, 0.009], [60, 2.5, 0.45, 0.008], [65, 2.5, 0.45, 0.008]],
      [[43, 0, 0.9, 0.024], [59, 1, 0.45, 0.01], [62, 1, 0.45, 0.009], [67, 1, 0.45, 0.009], [71, 1, 0.45, 0.008], [50, 2.5, 0.65, 0.018], [59, 3, 0.45, 0.009], [62, 3, 0.45, 0.008], [67, 3, 0.45, 0.008]]
    ]
  },
  ragtime: {
    name: 'Ragtime', description: 'A bright syncopated parlor tune with a bouncing left hand and jaunty right-hand phrases.',
    bpm: 116, partials: [[1, 1], [2, 0.5], [3, 0.22], [4, 0.08]], attack: 0.008, level: 0.025,
    bars: [
      [[36, 0, 0.65, 0.033], [48, 0, 0.65, 0.012], [67, 0.5, 0.28, 0.022], [72, 1.25, 0.3, 0.02], [76, 2, 0.55, 0.022], [79, 2.75, 0.28, 0.021], [72, 3.5, 0.35, 0.02], [43, 2, 0.65, 0.03], [55, 2, 0.65, 0.011]],
      [[43, 0, 0.65, 0.033], [55, 0, 0.65, 0.012], [71, 0.5, 0.28, 0.022], [74, 1.25, 0.3, 0.02], [79, 2, 0.55, 0.022], [83, 2.75, 0.28, 0.021], [74, 3.5, 0.35, 0.02], [38, 2, 0.65, 0.03], [50, 2, 0.65, 0.011]],
      [[41, 0, 0.65, 0.033], [53, 0, 0.65, 0.012], [69, 0.5, 0.28, 0.022], [72, 1.25, 0.3, 0.02], [76, 2, 0.55, 0.022], [81, 2.75, 0.28, 0.021], [72, 3.5, 0.35, 0.02], [36, 2, 0.65, 0.03], [48, 2, 0.65, 0.011]],
      [[38, 0, 0.65, 0.033], [50, 0, 0.65, 0.012], [67, 0.5, 0.28, 0.022], [71, 1.25, 0.3, 0.02], [74, 2, 0.55, 0.022], [79, 2.75, 0.28, 0.021], [71, 3.5, 0.35, 0.02], [43, 2, 0.65, 0.03], [55, 2, 0.65, 0.011]]
    ]
  }
};

function makePiece(score, ctx, destination, options) {
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(destination);
  const voices = new Set();
  const beat = 60 / score.bpm;
  const barLength = beat * (score.beatsPerBar || 4);
  let active = false;
  let timer = null;
  let releaseTimer = null;
  let nextBar = 0;
  let barIndex = 0;

  function play(midi, at, duration, level) {
    const fundamental = 440 * 2 ** ((midi - 69) / 12);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(level, at + score.attack);
    envelope.gain.linearRampToValueAtTime(level * 0.32, at + Math.min(0.22, duration * 0.45));
    envelope.gain.linearRampToValueAtTime(0.0001, at + duration);
    envelope.connect(output);
    const partials = [];
    for (const [harmonic, amplitude] of score.partials) {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = fundamental * harmonic;
      const gain = ctx.createGain();
      gain.gain.value = amplitude;
      oscillator.connect(gain).connect(envelope);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.03);
      partials.push({ oscillator, gain });
    }
    const voice = { envelope, partials };
    voices.add(voice);
    partials[0].oscillator.onended = () => {
      for (const { oscillator, gain } of partials) {
        oscillator.disconnect();
        gain.disconnect();
      }
      envelope.disconnect();
      voices.delete(voice);
    };
  }

  function scheduleBar(at) {
    const notes = score.bars[barIndex++ % score.bars.length];
    for (const [pitch, offset, duration, volume] of notes) {
      play(pitch, at + offset * beat, duration * beat, volume);
    }
  }

  function tick() {
    if (!active) return;
    if (options.mayAdvance?.() === false || ctx.currentTime + 0.25 < nextBar) {
      timer = setTimeout(tick, 200);
      return;
    }
    if (ctx.currentTime > nextBar + barLength) nextBar = ctx.currentTime + 0.06;
    scheduleBar(nextBar);
    nextBar += barLength;
    timer = setTimeout(tick, Math.max(120, (nextBar - ctx.currentTime - 0.2) * 1000));
  }

  function release() {
    for (const { envelope, partials } of voices) {
      for (const { oscillator, gain } of partials) {
        try { oscillator.stop(); } catch { /* already stopped */ }
        oscillator.disconnect();
        gain.disconnect();
      }
      envelope.disconnect();
    }
    voices.clear();
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = null;
    output.disconnect();
  }

  return {
    start() {
      if (active) return;
      if (releaseTimer) clearTimeout(releaseTimer);
      active = true;
      nextBar = ctx.currentTime + 0.06;
      output.gain.cancelScheduledValues(ctx.currentTime);
      output.gain.setValueAtTime(Math.max(0.0001, output.gain.value), ctx.currentTime);
      output.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 1);
      tick();
    },
    stop(instant = false) {
      if (!active) {
        if (instant) release();
        return;
      }
      active = false;
      if (timer) clearTimeout(timer);
      if (instant) release();
      else {
        output.gain.cancelScheduledValues(ctx.currentTime);
        output.gain.setValueAtTime(output.gain.value, ctx.currentTime);
        output.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.1);
        releaseTimer = setTimeout(release, 1250);
      }
    }
  };
}

export const ACOUSTIC_SOUNDSCAPES = Object.fromEntries(
  Object.entries(PIECES).map(([id, score]) => [id, {
    name: score.name,
    description: score.description,
    create: (ctx, destination, options = {}) => makePiece(score, ctx, destination, options)
  }])
);
