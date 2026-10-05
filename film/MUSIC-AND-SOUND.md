# Music, voice and sound for "Through the Vortex"

One song carries the whole four minutes. It is made in Suno (prompts below),
or, if the existing **RISE UP** track from Drive is preferred, that file is
cut to the same marks. Save the chosen track as
`film/music/through-the-vortex.mp3` and the assembler picks it up; without
it, the assembler lays a quiet synthesised temp bed so the review cut has
pulse and the picture can be judged.

## 1. What the music has to do

The film has six movements. The song must turn at these marks (±2 s), so
write it to a click at **96 BPM**, which puts a bar every 2.5 s and lets the
cut land on downbeats.

| Mark | Movement | What the picture does | What the music does |
|------|----------|------------------------|----------------------|
| 0:00 | Cold open | Mark and title fade up | A single low drone, a breath of air, one struck note |
| 0:06 | The Vortex | Bedroom, pages lift, the floor opens, the fall | Intro builds from drone to a pulsing arpeggio; first percussion at 0:16 as the floor opens; by 0:26 (inside the vortex) the beat is full, wide and psychedelic, with a filtered sweep rising through 0:36–0:46 |
| 0:46 | The Phoenix | Letters ignite, the Phoenix forms and turns | First lift: a choir-like pad and a melodic hook enter; brass or saw lead on the turn at 0:56; the lift resolves and opens out at 1:02 as they ride the wake |
| 1:10 | SyberLabs | Landing, elevator, corridor, hidden door, the room | Pull back to pulse and sub; muted, sneaking, ticking hats; a hush at 1:34 (the hidden door) and a slow reverent swell from 1:40 to the turn at 1:52 |
| 1:56 | Syko, for real | He speaks, 60 s | Drop to a bed: sustained pad and sparse pulse at -18 dB under the voice. No melody competing with speech. |
| 2:56 | RISE, read | Home, Keystones, the Chamber, the Page, the Lab | The hook returns, confident and warm; full arrangement from 3:12 (the Chamber) with the melody at its clearest; thin out at 3:36 for the Lab |
| 3:46 | Out | Two title cards | Final statement of the hook, then one held chord decaying to silence by 4:00 |

Total 4:00. A song that runs long is cut at 4:00 with a 2 s fade; one that
runs short is padded with its own tail, so write to the length.

## 2. Suno prompts

Suno makes two tracks per generation; run the prompt twice and keep the
take whose turns land nearest the marks. Use the model's longest length
setting and **instrumental** unless the vocal version below is wanted.

**Style prompt (instrumental):**

> Cinematic electronic score, 96 BPM, psychedelic synthwave meets orchestral
> trailer. Opens with a low drone and a single struck note, builds through a
> pulsing arpeggio into a wide kaleidoscopic beat with filtered sweeps, lifts
> into a choral pad and a soaring melodic hook, pulls back to a sneaking
> pulse with ticking hi-hats and sub bass, holds a sparse ambient bed for a
> spoken section, then returns the hook warm and confident before one held
> chord decays to silence. Analog synths, taiko hits, strings, no vocals,
> wide stereo, clean low end, mastered for video. Duration four minutes.

**Vocal version (optional), same style with these lyrics; the chorus is the
film's claim and must land at 0:46 and again at 2:56:**

```
[Intro - drone]

[Verse 1]
Every page you ever closed
is open somewhere in the dark
the floor gives way, the ink lets go
and we fall through what we never finished

[Chorus]
Rise, through the vortex, rise
let the letters catch the light
something made of fire knows the way
read it like the first time, rise

[Verse 2 - hushed, sneaking]
Steel and glass, a thousand doors
a lantern made of what we know
it opens like an eye

[Bridge - bed for spoken section, no vocal]

[Chorus - full]
Rise, through the vortex, rise
let the letters catch the light
words arrive in time, and move with light
read it like the first time, rise

[Outro - one held chord]
```

If the lyrics fight the voice-over, use the instrumental; the words are on
the screen.

## 3. Using the existing RISE UP song instead

`RISE_MFM_RISE_UP_full_song_1080p.mp4` is in Drive. To use it: export the
audio (`ffmpeg -i RISE_MFM_RISE_UP_full_song_1080p.mp4 -vn -c:a libmp3lame
-q:a 2 film/music/through-the-vortex.mp3`), then set `music.offset` in
`film/edl.json` so its first drop lands at 0:26. The assembler cuts and
ducks it like any other track.

## 4. Voice-over

Four lines, in `film/SCREENPLAY.md` §4. Record dry, 48 kHz, no music
under; save as `film/voice/vo-01.wav` … `vo-04.wav`. The assembler
positions them at 0:48, 1:05, 1:42, 3:46 and ducks the song. If no voice
files exist the film runs without voice-over and loses nothing structural.

## 5. Sound design (in the assembler, no extra sources)

- A 200 ms air-tone riser under each act boundary, generated.
- The Wormhole and Chamber segments carry no app audio: the song is the bed.
- Loudness: integrated -14 LUFS, true peak -1 dBTP, YouTube's target.
