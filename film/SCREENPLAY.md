# RISE — "Through the Vortex"

A four-minute film for YouTube. Animated prologue, real pitch, cinematic demo.
Written 2026-10-05. Runtime target 4:00 at 1920×1080, 24 fps, stereo.

Everything in this document is either **rendered here** (from RISE's own
engines and the real app, by `film/scripts/record.mjs`), **generated in
Runway** (prompts below, one per shot), or **supplied** (real footage of
Syko). `film/edl.json` is the timed edit that `film/scripts/assemble.mjs`
cuts. Where a Runway or supplied clip is missing, the assembler cuts a slate
that shows the shot's prompt, so the review cut always runs the full
four minutes.

---

## 1. The idea in one paragraph

Two readers fall through a vortex made of every book they never finished. A
phoenix made of burning type lifts them out and carries them to SyberLabs, a
laboratory the size of a city block, where they sneak past the machines that
make reading move. Behind the last hidden door is the person who built it,
Mateo Robles. The animation gives way to the real man pitching SyberLabs and
RISE, and then to RISE itself, read the way it is meant to be read: words
arriving in time, light moving with them.

## 2. Look and continuity (paste into every Runway prompt)

**STYLE BLOCK (verbatim, every animated shot):**

> Painterly 3D animation in the manner of Arcane and Spider-Verse, visible
> brush texture on surfaces, volumetric light, anamorphic lens flare,
> cinematic 16:9 framing, deep void-blue shadows (#080d16), teal mid-tones
> (#6e9397), amber highlights (#f5b687), subtle film grain, 24 fps motion
> blur, no text, no watermark.

**CHARACTER BLOCK (generate once as a reference image, then attach the
reference to every shot so faces hold):**

- **INES**, early twenties, dark curly hair tied up, oversized amber field
  jacket, carries a small paper book that glows from inside like a lantern.
  Curious. Always one step ahead.
- **TEO**, late twenties, tall and lean, round glasses, grey hoodie, big
  headphones around his neck. Sceptical. Follows, then believes.
- **THE PHOENIX**, the size of a cathedral door, ember-and-gold, and every
  trailing feather burns into drifting letters of type before it goes out.
  It never speaks. It leads.
- **MATEO ROBLES (animated)**, seen from behind until the reveal: dark lab
  coat over a black tee, standing at a long console. Do not generate a real
  face. The reveal is a cut to the real man.

**Runway settings:** Gen-4 Turbo for motion, 10 s clips unless a shot says
5 s, 16:9 at 1920×1080, seed locked per act. For each shot, first make a
keyframe image (Gen-4 Image or a frame from the previous shot) and drive the
video from it, so the handoff between shots holds. Use Aleph only to fix
continuity (swap a jacket colour, remove a stray object), never to invent a
shot.

---

## 3. The film, shot by shot

Times are the cut's running time. "Source" says where the clip comes from.

### Act 0 — Cold open (0:00–0:06)

| # | Time | Source | Shot |
|---|------|--------|------|
| 0.1 | 0:00–0:06 | Rendered here (title card) | Black. The SyberLabs mark fades up in teal, then the single word **RISE** in Instrument Serif. A low drone. The mark drifts a few pixels, as if breathing. |

### Act 1 — The Vortex (0:06–0:46)

Sound: the drone opens into the song's intro. No voice.

| # | Time | Source | Shot and Runway prompt |
|---|------|--------|------------------------|
| 1.1 | 0:06–0:16 | Runway, 10 s | **A bedroom at night, books everywhere.** INES reading in bed, the lantern-book open on her knees. TEO asleep in a chair, headphones on. The pages of every book in the room begin to lift and turn by themselves. Slow push in on Ines as she looks up. *Prompt:* "Night bedroom crowded with stacked paperbacks, a young woman with dark curly hair in an amber jacket reads a small glowing book in bed, a tall man with round glasses sleeps in an armchair with headphones on, pages of every book start lifting and turning on their own, slow dolly push in toward her face as she looks up, warm lamp light turning teal. [STYLE BLOCK]" |
| 1.2 | 0:16–0:26 | Runway, 10 s | **The floor opens into a spiral of pages.** Camera tilts down past the bed; the floorboards peel back into a whirlpool of swirling paper, ink streaming off the pages into light. Ines grabs Teo's sleeve. Both fall. *Prompt:* "Camera tilts down as a bedroom floor peels away into a vast spiral whirlpool of swirling book pages, black ink lifting off the pages and turning into ribbons of teal and amber light, a young woman grabs a sleeping man's sleeve and both tumble into the vortex, wide shot, slow motion. [STYLE BLOCK]" |
| 1.3 | 0:26–0:36 | Rendered here (RISE Wormhole, transit) + optional Runway plate | **Inside the vortex.** RISE's own Wormhole transit: a starfield that streaks into tunnel light while the craft crosses. Cut in two Runway inserts of Ines and Teo falling through it if the pacing wants faces. *Runway insert prompt (5 s):* "Two figures tumbling through a psychedelic tunnel of streaking light and swirling letters, a young woman in an amber jacket holding a glowing book, a tall man in a grey hoodie reaching for her hand, kaleidoscopic teal and magenta refraction, extreme wide shot, 24 fps motion blur. [STYLE BLOCK]" |
| 1.4 | 0:36–0:46 | Rendered here (RISE attractor engine) + Runway insert | **The vortex becomes a strange attractor.** The tunnel's streaks resolve into one luminous filament curling in on itself, which is RISE's attractor field, rendered from the app. Over it, a 5 s Runway insert: Ines opens the lantern-book in free fall and its light steadies them. *Runway insert prompt (5 s):* "A young woman in free fall inside a glowing filament of light opens a small book and its light flares, steadying her and the man beside her, their hair and jackets drift as if underwater, close on their faces lit from below by the book. [STYLE BLOCK]" |

### Act 2 — The Phoenix (0:46–1:10)

Sound: the song's first lift. One line of voice-over if the VO track is used.

| # | Time | Source | Shot and Runway prompt |
|---|------|--------|------------------------|
| 2.1 | 0:46–0:56 | Runway, 10 s | **The letters catch fire.** Drifting letters around them ignite, gather, and take the shape of wings. Reverse angle on the two readers as the Phoenix forms above them. *Prompt:* "Thousands of drifting letters of type ignite into embers and gather into the shape of a colossal phoenix with ember-and-gold feathers, each trailing feather burning into letters as it falls, two small figures below look up in awe, low angle, volumetric fire light. [STYLE BLOCK]" |
| 2.2 | 0:56–1:02 | Runway, 5 s | **It turns.** The Phoenix looks at them, then banks away, tracing a path of burning type. *Prompt:* "A colossal phoenix made of embers and burning letters turns its head toward camera, eyes like two reading lamps, then banks away leaving a spiral trail of glowing type, medium shot, slow motion. [STYLE BLOCK]" |
| 2.3 | 1:02–1:10 | Runway, 10 s (cut to 8) | **They ride the trail.** Ines and Teo are carried in the Phoenix's wake, the vortex thinning into clear night sky. Ahead, far below, a lit grid: SyberLabs. *Prompt:* "Two figures carried along in the glowing wake of a phoenix, the swirling vortex thins into clear night sky, far below a vast illuminated laboratory campus of glass and steel glows teal on a dark coast, aerial wide shot, parallax clouds. [STYLE BLOCK]" |

### Act 3 — SyberLabs (1:10–1:56)

Sound: the song pulls back to pulse and footsteps. Sneaking.

| # | Time | Source | Shot and Runway prompt |
|---|------|--------|------------------------|
| 3.1 | 1:10–1:18 | Runway, 10 s (cut to 8) | **Arrival.** The Phoenix sets them down on a landing pad and dissolves into a single glowing letter that drifts toward a service door. A sign on the wall: a geometric mark (not text). *Prompt:* "A phoenix of embers lands two figures on a rooftop landing pad of a massive laboratory at night, then dissolves into one glowing ember that drifts toward a steel service door, teal floodlights, light rain, wide shot. [STYLE BLOCK]" |
| 3.2 | 1:18–1:26 | Runway, 10 s (cut to 8) | **The freight elevator.** Inside a cavernous freight elevator; floor numbers climb; through the cage they glimpse halls of machines (reading tables with moving light, walls of rotating slides). Teo presses against the wall. Ines grins. *Prompt:* "Inside a huge industrial freight elevator with an open cage, two figures press against the wall as floors slide past revealing vast laboratory halls full of glowing instruments and rotating glass plates, teal and amber light sweeping through the cage, medium shot. [STYLE BLOCK]" |
| 3.3 | 1:26–1:34 | Runway, 10 s (cut to 8) | **The corridor of doors.** A long corridor; every door is different (brass, glass, paper). A patrol drone's light sweeps. They duck behind a cart of books. The lantern-book pulses toward one unmarked panel. *Prompt:* "A long laboratory corridor lined with mismatched doors of brass, glass and paper, a patrol drone's searchlight sweeps past, two figures duck behind a cart stacked with books, a small glowing book in the woman's hands pulses toward an unmarked wall panel, tracking shot, suspense. [STYLE BLOCK]" |
| 3.4 | 1:34–1:40 | Runway, 5 s | **The hidden door.** Ines holds the book to the panel; the wall irises open like an eye. *Prompt:* "A young woman presses a small glowing book against a blank wall panel and the wall irises open like an aperture, revealing warm light behind, close up on her hands and face, shallow depth of field. [STYLE BLOCK]" |
| 3.5 | 1:40–1:48 | Runway, 10 s (cut to 8) | **The room where reading moves.** A vast dim room. At the far end, a long console; a figure stands with his back to them, dark lab coat, hands on the controls. Above him, a wall of light: words arriving one at a time, each with its own colour and motion. *Prompt:* "A vast dim laboratory room, at the far end a lone figure in a dark lab coat stands with his back to camera at a long console, above him an enormous wall of light where single words appear one at a time with shifting colour and motion, two figures step in from the foreground, wide shot, reverent. [STYLE BLOCK]" |
| 3.6 | 1:48–1:56 | Runway, 5 s + Rendered here (match cut) | **He turns.** Over the shoulder, the figure begins to turn. Before his face is clear, a hard cut on the turn to the real footage. *Prompt (5 s):* "Over-the-shoulder shot of a man in a dark lab coat at a glowing console starting to turn toward camera, his face still in shadow, teal rim light, slow motion. [STYLE BLOCK]" The cut lands on the first frame of Act 4 where Syko is already facing camera. |

### Act 4 — Syko, for real (1:56–2:56)

**Source: supplied.** Real video of Syko pitching SyberLabs and RISE, 60 s.
Not found in the repository, Drive or Gmail on 2026-10-05, so the review cut
carries a slate here. When the footage exists, drop it at
`film/supplied/syko-pitch.mp4` and re-run the assembler; nothing else
changes.

Record it like this so it cuts against the animation:

- Framing: medium shot, centred, dark background, one warm key light from
  the left, a cool teal edge from behind. Start already facing camera
  (the animated turn lands on this frame).
- Sound: lavalier or a close mic, no music under it; the assembler ducks the
  song to -18 dB beneath the voice.
- Length: three beats, about 20 s each. Say it, do not read it.

Suggested beats (the words are his to change):

1. **Who.** "I'm Mateo Robles. I built SyberLabs because reading is the
   oldest technology we have, and we stopped improving it."
2. **What.** "RISE is an audiovisual reader. Words arrive in time, with
   light and sound that move with them. It runs in your browser, your
   data stays on your device, and if you want a model to compose a
   reading, you bring your own."
3. **Why now.** "Readers are leaving books for screens. RISE makes the
   screen a better place to read, not a worse one. It's open source, it's
   live, and you can read something right now."

The assembler adds lower-thirds: `MATEO ROBLES · Founder, SyberLabs` at
1:58 and `rise.syberlabs.io` at 2:48.

### Act 5 — RISE, read (2:56–3:46)

**Source: rendered here**, from the real app build, by `record.mjs`.
Cinematic grade applied in the assembler (slight contrast and saturation
lift, a vignette); no letterbox, so the app's own chrome stays whole.

| # | Time | Clip | What the viewer sees |
|---|------|------|----------------------|
| 5.1 | 2:56–3:04 | `home.mp4` | Home. The day's poem streaming in the stage; the words arrive on their own. Lower-third: *Every day, one reading.* |
| 5.2 | 3:04–3:12 | `keystones.mp4` | The Keystones rail at `/try-rise`: Metamorphoses, Meditations, Tintern Abbey. The reader centres Meditations. Lower-third: *Three readings to begin with.* |
| 5.3 | 3:12–3:28 | `reading.mp4` | Enter reading. The Chamber: Marcus Aurelius arriving one phrase at a time over a living field. Hold it; this is the product. Lower-third at 3:14: *Words in time. Light that moves with them.* |
| 5.4 | 3:28–3:36 | `page.mp4` | The Page control. The same reading as a paginated text with its figures. Lower-third: *Or read it as a page.* |
| 5.5 | 3:36–3:46 | `lab.mp4` | Make → Visual Lab: a Living Flame scene mutating under the sliders. Lower-third: *Make your own light.* |

### Act 6 — Out (3:46–4:00)

| # | Time | Source | Shot |
|---|------|--------|------|
| 6.1 | 3:46–3:54 | Rendered here (title card) | The attractor filament dims to one glowing letter. **RISE** · *An audiovisual reader.* · **rise.syberlabs.io** |
| 6.2 | 3:54–4:00 | Rendered here (title card) | **SyberLabs** mark. Small type: *Open source · Apache 2.0 · Your data stays with you.* Fade to black on the song's last note. |

---

## 4. Voice-over (optional track)

If a voice track is wanted, it is four lines, spoken slowly, placed where the
song breathes. Record dry; the assembler positions and ducks.

| Time | Line |
|------|------|
| 0:48 | "Every book you ever put down is still open somewhere." |
| 1:05 | "Something was waiting to show us the way back." |
| 1:42 | "This is where reading learned to move." |
| 3:46 | "RISE. Read it the way it was meant to be read." |

## 5. What Runway must produce

Fourteen clips, in this order, each from a locked keyframe:

```
1.1  bedroom-pages.mp4        10 s
1.2  floor-vortex.mp4         10 s
1.3i tunnel-insert.mp4         5 s
1.4i book-steadies.mp4         5 s
2.1  letters-ignite.mp4       10 s
2.2  phoenix-turns.mp4         5 s
2.3  wake-to-syberlabs.mp4    10 s
3.1  rooftop-landing.mp4      10 s
3.2  freight-elevator.mp4     10 s
3.3  corridor-of-doors.mp4    10 s
3.4  hidden-door.mp4           5 s
3.5  room-where-reading-moves 10 s
3.6  he-turns.mp4              5 s
```

Save them under `film/runway/` with those names. The assembler picks them
up by name; a missing one becomes a slate showing its prompt.
