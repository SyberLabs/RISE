# Chamber Orbital Interface — Complete

**Date**: 2026-01-23
**Status**: ✅ Ready for testing
**Design**: Fidget spinner interface with 3 orbits around central TEXT

---

## What Was Built

### **New Component: ChamberOrbital**

The Chamber now has a two-phase architecture:

1. **Phase 1: Orbital Preparation** ([ChamberOrbital.js](src/components/ChamberOrbital.js))
   - Fidget spinner interface
   - TEXT at center (drop/paste/library)
   - 3 orbit nodes: Visual, Audio, Temporal
   - Click orbits → open configuration modals
   - Drag handles → spin the structure (aesthetic)
   - "Begin Session" → Phase 2

2. **Phase 2: Immersion** (existing [Chamber.js](src/components/Chamber.js))
   - Fullscreen atom playback
   - Hidden controls on mouse movement
   - Exit → returns to Orbital (Phase 1)

---

## Geometric Design

```
         ┌─────────┐
         │ VISUAL  │ ◎ Focal
         │  Display│   Interlocution
         └────┬────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───┴───┐  ┌─┴───┐  ┌──┴────┐
│AUDIO  │──│ TEXT│──│TEMPORAL
│       │  │  ◇  │  │       │
│Silent │  │     │  │220 WPM│
└───────┘  └──┬──┘  └───────┘
              │                Flat curve
         ┌────┴────┐          Word mode
         │   ⋮     │ ← Handle (drag to spin)
         └─────────┘
```

### **Triadic Structure**

**Visual Orbit** (top):
- Display Mode (Focal, Chamber, Orbital)
- Visual Interlocution toggle
- Frequency & Duration sliders

**Audio Orbit** (bottom-left):
- Audio Preset (Silent, Focus, Deep, Gateway)
- Voice (TTS) toggle

**Temporal Orbit** (bottom-right):
- Pacing (100-500 WPM slider)
- Curve (Flat, Induction, Arousal, Wave, Climax)
- Chunking (Word, Phrase, Sentence)

**TEXT Center**:
- Drop file
- Paste text
- Browse Library (TODO)
- Shows word count when loaded

---

## User Flow

```
Portal
  ↓ Click "Chamber"
ChamberOrbital (Preparation)
  ↓
Load Text:
  - Drop file.txt
  - Paste from clipboard
  - Browse Library (starters, sacred texts, etc.)
  ↓
Configure (optional):
  - Click Visual orbit → set display mode, enable interlocution
  - Click Audio orbit → choose preset, enable voice
  - Click Temporal orbit → adjust WPM, curve, chunking
  ↓
Click "Begin Session"
  ↓
Chamber Session (Immersion)
  - Fullscreen atoms
  - Visual cortex flashes (if enabled)
  - Audio layers (if enabled)
  - Hidden controls (appear on mousemove)
  ↓
Press Escape or complete session
  ↓
Returns to ChamberOrbital (iterate or exit)
```

---

## Router Changes

### Before
```javascript
chamber: loads Chamber with session atoms immediately
```

### After
```javascript
chamber: loads ChamberOrbital (preparation interface)
chamber-session: loads Chamber (immersion playback)

Flow: portal → chamber (orbital) → chamber-session (playback)
```

---

## File Structure

```
src/components/
├── ChamberOrbital.js      # Fidget spinner interface (1000+ lines)
├── ChamberOrbital.css     # Orbital styling + modals
├── Chamber.js             # Immersion playback (unchanged)
└── Chamber.css            # Immersion styling (unchanged)
```

---

## Key Features

### ✅ Geometric Metaphor
- "Everything orbits the text"
- Triadic balance (3 orbits = Visual/Audio/Temporal)
- Center = content, orbits = configuration
- Spin mechanic = playful interaction

### ✅ Collapsed/Expanded States
- Each orbit shows summary when collapsed
- Click to expand modal with full controls
- No accordions, no scrolling through nested menus
- All params visible at glance

### ✅ Progressive Disclosure
- Start with empty TEXT center
- Orbits show defaults (Silent audio, 220 WPM, Focal display)
- Only configure what you need
- "Begin Session" disabled until text loaded

### ✅ Rotation Mechanic
- Drag small handles at bottom of each orbit
- Spins entire structure around TEXT center
- Pure aesthetic delight (no functional purpose)
- Reinforces "orbit" metaphor

### ✅ Modal Configuration
- Click orbit → opens fullscreen modal
- Click outside or X → closes, returns to orbital view
- Changes reflected immediately in orbit summary
- No navigation away from main interface

---

## Configuration Summary

The orbital interface captures ALL session parameters:

**From TEXT**:
- `text`: actual content
- `textSource`: filename or "Pasted Text"

**From Visual Orbit**:
- `displayMode`: 'focal' | 'chamber' | 'orbital'
- `visualConfig.enabled`: boolean
- `visualConfig.frequency`: 0-100%
- `visualConfig.duration`: 16-200ms
- `visualConfig.patterns`: ['klee', 'turrell', 'fractal']

**From Audio Orbit**:
- `audioPreset`: 'silent' | 'focus' | 'deep' | 'gateway'
- `voiceEnabled`: boolean
- `voiceId`: selected voice (if enabled)

**From Temporal Orbit**:
- `wpm`: 100-500
- `curve`: 'flat' | 'induction' | 'arousal' | 'wave' | 'climax'
- `chunkMode`: 'word' | 'phrase' | 'sentence'

All of this gets passed to `app.handleBeginSession()` which:
1. Chunks text into atoms
2. Creates Session object
3. Navigates to `chamber-session` (immersion)

---

## Integration Points

### App.js Changes

**New import**:
```javascript
import { ChamberOrbital } from './components/ChamberOrbital.js';
import './components/ChamberOrbital.css';
```

**New route**:
```javascript
this.router.registerView('chamber', {
  container: document.getElementById('view-chamber'),
  init: (container) => {
    return new ChamberOrbital(container, {
      onBeginSession: (sessionConfig) => this.handleBeginSession(sessionConfig),
      onNavigate: this.handleNavigate
    });
  }
});
```

**New handler**:
```javascript
async handleBeginSession(sessionConfig) {
  // Chunk text
  const atoms = chunkText(sessionConfig.text, {
    mode: sessionConfig.chunkMode,
    wpm: sessionConfig.wpm
  });

  // Create session
  const session = new Session({
    title: sessionConfig.textSource,
    atoms, wpm, curve, displayMode, audioPreset, visualConfig
  });

  // Navigate to immersion
  this.router.navigate('chamber-session', { data: session });
}
```

---

## Testing Checklist

### Portal → Chamber Flow
- [ ] Portal loads with breathing sigil
- [ ] Click "Chamber" → navigates to orbital interface
- [ ] TEXT center shows empty state (sigil, 3 buttons)
- [ ] 3 orbits visible with default summaries
- [ ] Rotation handles visible at bottom of orbits

### Text Loading
- [ ] Click "Drop File" → opens file picker
- [ ] Select .txt file → loads text, updates TEXT center
- [ ] Shows filename + word count
- [ ] "Begin Session" button becomes enabled
- [ ] Click "✕" → clears text, resets to empty state
- [ ] Click "Paste Text" → reads clipboard (or prompts)

### Orbit Configuration
- [ ] Click Visual orbit → opens modal
- [ ] Display mode buttons work (Focal, Chamber, Orbital)
- [ ] Visual Interlocution toggle works
- [ ] Frequency/Duration sliders work
- [ ] Click X or outside → closes modal
- [ ] Orbit summary updates with selection

- [ ] Click Audio orbit → opens modal
- [ ] Audio preset buttons work (Silent, Focus, Deep, Gateway)
- [ ] Voice toggle works
- [ ] Close modal → orbit summary updates

- [ ] Click Temporal orbit → opens modal
- [ ] WPM slider works (100-500)
- [ ] Curve buttons work (Flat, Induction, etc.)
- [ ] Chunking buttons work (Word, Phrase, Sentence)
- [ ] Close modal → orbit summary shows WPM

### Rotation Mechanic
- [ ] Drag handle on Visual orbit → structure spins
- [ ] Drag handle on Audio orbit → structure spins
- [ ] Drag handle on Temporal orbit → structure spins
- [ ] Release mouse → rotation stops smoothly
- [ ] Orbits maintain position relative to each other

### Begin Session
- [ ] With text loaded + defaults → click "Begin Session"
- [ ] Navigates to chamber-session (immersion)
- [ ] Atoms display with correct timing
- [ ] Display mode applied (Focal/Chamber/Orbital)
- [ ] Audio preset applied (if not Silent)
- [ ] Visual interlocution flashes (if enabled)
- [ ] Press Escape → returns to orbital prep

---

## Next Steps

### Immediate
1. Test full flow: Portal → Chamber Orbital → load text → configure → Begin → Immersion → Escape → Orbital
2. Verify rotation mechanic feels smooth
3. Test with different text sizes (short/long)
4. Test all 3 display modes work in immersion

### Short-term
1. **Library Integration** — "Browse Library" button in TEXT center
   - Opens Library modal (not full-screen nav)
   - Shows Starters, Archive, Personal
   - Select sequence → loads text + defaults into orbital
   - User can tweak before "Begin"

2. **Visual Polish**
   - Orbit glow effects on hover
   - Smooth modal transitions
   - Better empty state design for TEXT center
   - Orbit icons (instead of just text)

3. **Accessibility**
   - Keyboard navigation (Tab through orbits, Enter to open)
   - Screen reader labels
   - Focus states

### Medium-term
1. **Save Configurations** — "Save as Preset" in modals
2. **Quick Presets** — Buttons below orbital: "Quick Session", "Deep Work", "Hypnagogic"
3. **Session History** — "Recent" tab in Library shows past sessions with configs

---

## Design Wins

✅ **No more scrolling through accordions** — everything visible at once
✅ **Geometric clarity** — 3 orbits = 3 param categories
✅ **Playful interaction** — spin mechanic makes config feel less clinical
✅ **Iterative workflow** — Exit session → back to orbital → tweak → retry
✅ **Progressive disclosure** — Defaults shown, full config hidden until needed
✅ **Text-centric** — Content literally at the center, config orbits around it

---

## Test URL

http://localhost:5175/app.html

**Flow to test**:
1. Portal → click "Chamber"
2. Orbital → click "Paste Text", paste some text
3. Click Temporal orbit → set WPM to 300, close
4. Click "Begin Session"
5. Watch atoms play at 300 WPM
6. Press Escape → back to orbital
7. Change WPM to 150 → Begin again
8. Compare pacing

---

*"From stillness, intention emerges. From intention, configuration orbits. From configuration, experience unfolds."*

— Chamber Orbital Philosophy
