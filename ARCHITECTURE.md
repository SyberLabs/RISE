# R.I.S.E. Architecture

> **Recursive Installation of Symbolic Experience**
> Version Control & Migration Roadmap

---

## Spatial Structure

```
                          ┌─────────────┐
                          │   PORTAL    │
                          │  (launch)   │
                          └──────┬──────┘
                                 │
               ┌─────────────────┼─────────────────┐
               │                 │                 │
               ▼                 ▼                 ▼
        ┌──────────┐      ┌──────────┐      ┌──────────┐
        │ CHAMBER  │      │ LIBRARY  │      │ WORKSHOP │
        └──────────┘      └─────┬────┘      └──────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ ARCHIVE  │     │SEQUENCES │     │ PERSONAL │
        └──────────┘     └──────────┘     └──────────┘

                          ┌──────────┐
                          │ SETTINGS │
                          └──────────┘
```

---

## Version Architecture

### V1: Builder (Current Production)
The monolithic, single-page experience currently served to users.

| Entry | File | Description |
|-------|------|-------------|
| HTML | `index.html` | Single-page with Builder, Chamber, Review views |
| JS | `src/main.js` | All logic in one ~1400 line file |
| CSS | `src/style.css` | All styles in one ~2600 line file |

**Status**: ✅ Production-ready, actively used

---

### V2: Spatial (Future Architecture)
Modular component-based architecture with proper routing.

| Entry | File | Description |
|-------|------|-------------|
| HTML | `app.html` *(to create)* | Minimal shell for V2 |
| JS | `src/app.js` | App orchestrator with Router |
| CSS | `src/design-system.css` | Design tokens + utilities |

**Components** (`src/components/`):
| Component | File | Status |
|-----------|------|--------|
| Portal | `Portal.js` + `.css` | ⚡ Built, not integrated |
| Chamber | `Chamber.js` + `.css` | ⚡ Built, not integrated |
| Library | `Library.js` + `.css` | ⚡ Built, not integrated |
| Workshop | `Workshop.js` + `.css` | ⚡ Built, not integrated |
| Settings | `Settings.js` + `.css` | ⚡ Built, not integrated |
| SourceBrowser | `SourceBrowser.js` + `.css` | ⚡ Built |
| VisualInterlocutionPanel | `VisualInterlocutionPanel.js` + `.css` | ⚡ Built |
| ActiveSourcesModal | `ActiveSourcesModal.js` + `.css` | ⚡ Built |

**Status**: 🔧 Components exist, needs integration testing

---

## Shared Resources

These modules are **version-agnostic** and used by both V1 and V2:

```
src/
├── visuals/                  # Visual engines
│   ├── visual-cortex.js      # Flash orchestrator
│   ├── klee-enhanced.js      # Klee with R.I.S.E. presets
│   ├── turrell.js            # Light fields
│   ├── fractal.js            # DeepLightning flames
│   └── rockgarden.js         # Zen rock garden
│
├── audio/                    # Audio engines
│   └── audio-engine.js       # Binaural, harmonics, noise
│
├── content/                  # Content management
│   ├── library.js            # Text registry
│   └── starters.js           # Starter sequences
│
├── sources/                  # Source providers
│   ├── text/                 # Sacred, Gutenberg, Research, Declassified
│   └── visual/               # Wikimedia categories
│
└── core/                     # Core utilities
    ├── router.js             # View navigation (V2)
    ├── player.js             # Playback engine
    ├── chunker.js            # Text tokenization
    ├── pacing.js             # WPM curves
    ├── sequencer.js          # Session sequencing
    └── models.js             # Data models
```

---

## Migration Roadmap

### Phase 1: Dual-Entry Setup *(Recommended First)*
Create `app.html` to enable V2 testing without disrupting V1.

```html
<!-- app.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>R.I.S.E. v2</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/app.js"></script>
</body>
</html>
```

- [ ] Create `app.html`
- [ ] Update Vite config for multiple entry points
- [ ] Test V2 route: `localhost:5173/app.html`

---

### Phase 2: Portal Integration
The landing view - animating sigil, quick access, navigation.

- [ ] Verify Portal component renders
- [ ] Connect Portal navigation to Router
- [ ] Test quick-access functionality

---

### Phase 3: Chamber Integration
The immersive reading experience.

- [ ] Port V1 chamber logic to V2 Chamber component
- [ ] Connect visual cortex
- [ ] Connect audio engine
- [ ] Test full session playback

---

### Phase 4: Library Integration
Browse and select texts.

- [ ] Connect Library to shared `content/library.js`
- [ ] Port category tabs (Sacred, Literary, Research, Declassified)
- [ ] Test text selection → Workshop flow

---

### Phase 5: Workshop Integration
Session configuration.

- [ ] Connect VisualInterlocutionPanel
- [ ] Connect SourceBrowser
- [ ] Port pacing/chunking/curve controls
- [ ] Test session creation → Chamber flow

---

### Phase 6: Settings Integration
User preferences.

- [ ] Connect to localStorage persistence
- [ ] Port accessibility settings
- [ ] Port audio preferences

---

### Phase 7: V2 Promotion
When V2 is stable, promote it to default.

- [ ] Redirect `index.html` → V2
- [ ] Move V1 to `legacy/`
- [ ] Update documentation

---

## File Ownership Quick Reference

| File | Owner | Notes |
|------|-------|-------|
| `index.html` | V1 | Current production entry |
| `src/main.js` | V1 | Monolithic logic |
| `src/style.css` | V1 | All-in-one styles |
| `src/app.js` | V2 | Orchestrator |
| `src/design-system.css` | V2 | Tokens + utilities |
| `src/components/*` | V2 | Modular components |
| `src/core/*` | Shared | Routing, playback, models |
| `src/visuals/*` | Shared | Visual engines |
| `src/audio/*` | Shared | Audio engines |
| `src/content/*` | Shared | Library, starters |
| `src/sources/*` | Shared | Text/visual providers |
| `src/legacy/*` | Archive | Historical reference |

---

## Development Workflow

### Working on V1 (Production Fixes)
```bash
npm run dev          # Opens index.html
# Edit: main.js, style.css, index.html
```

### Working on V2 (New Features)
```bash
npm run dev          # Then navigate to /app.html
# Edit: app.js, components/*, design-system.css
```

### Shared Resources
Changes to `visuals/`, `audio/`, `content/`, `sources/`, `core/` affect **both versions**.
Always test in both V1 and V2 after modifying shared code.

---

*Last updated: 2026-01-23*
