# RISE in ChatGPT and Claude

**Last updated: 8 October 2026**

RISE turns an answer from your assistant into a short reading you watch and
listen to. Ask ChatGPT or Claude to explain something and present it in RISE:
the answer is spoken aloud by your device's voice, its words appear as they
are spoken, and a moving image plays behind them, chosen to suit the subject.
You press **Play**, and you can pause, resume, and play it again.

---

## What RISE does, and what it does not

- **The words are your assistant's.** Your assistant writes the reading:
  its passages, a title, and optionally a theme (its colours) and a look (its
  imagery, typeface and colours together).
- **The voice is your device's.** RISE uses the speech voice built into your
  browser or operating system. If your device has no voice installed, the
  reading still plays, paced for reading, with every word shown.
- **The imagery is drawn, not generated.** RISE draws it live with its own
  procedural engines: line drawings that grow, a strange-attractor filament,
  soft fields of light, fractal flames, harmonic line figures, and spectral
  plates. RISE does not use AI models to make images, video or audio.
- **A picture your assistant writes is kept apart.** When your assistant
  writes a small program to draw a picture for the reading, RISE checks it
  first and runs it in its own worker, with no network and no access to your
  data.
- **RISE keeps nothing.** It receives only the reading your assistant writes
  for it, plays it, and stores none of it. See the
  [Privacy Policy](privacy.html).

## Add RISE

- **Claude:** open **Customize > Connectors** and add RISE from the directory,
  or add a custom connector with the address
  `https://rise.syberlabs.io/api/mcp`. No account or key is needed.
- **ChatGPT:** add RISE from the ChatGPT apps directory once it is listed.

## Try it

These prompts work well:

- "Explain how black holes bend light, and present it in RISE."
- "Give me a two-minute RISE reading on why the sky is blue."
- "Walk me through how vaccines train the immune system, as a RISE reading."
- "Present a short reflection on Marcus Aurelius and the inner citadel in RISE, in the Garden look."
- "Explain how a bill becomes law in the US as a RISE reading in the Signal look."

RISE is not the right tool for these, and your assistant should answer them
itself:

- "Book me a table for two tomorrow night." (RISE presents readings; it takes no actions.)
- "Generate a picture of a cat." (RISE draws its own imagery; it makes no pictures to order.)
- "Write a 10,000-word report and read it in RISE." (A reading holds at most 16 passages and 20,000 characters.)

## The looks

A look sets a reading's imagery, typeface and colours together. Your
assistant chooses one to suit the answer, or you can ask for one by name:
**Plain** (the words alone), **Gallery** (soft light dissolving behind the
words), **Nocturne** (soft light and fine traced lines, slowly), **Garden** (a
line drawing growing behind the words), **Flame** (a living flame), **Signal**
(a strange attractor circling the words), **Iris** (spectral plates),
**Revel** (fractal flames at a lively pace), **Vigil** (one quiet image, held)
and **Inlay** (fractal flames behind the words, in a heavy face).

## If something is not right

- **No sound.** Your device has no speech voice installed, or its sound is off.
  The reading plays paced, with every word shown; install a voice in your
  operating system's settings to hear it.
- **The imagery is still.** Your device asks for reduced motion, or RISE's
  photosensitivity setting is on. The imagery holds one frame so the reading
  stays comfortable.
- **The reading was refused.** It was longer than RISE takes (16 passages,
  20,000 characters). Ask your assistant for a shorter version.

## Contact

For help, questions about your data, or to report a problem, write to
**syberlabs.software@gmail.com**.
