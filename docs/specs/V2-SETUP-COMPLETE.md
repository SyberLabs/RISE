# V2 Portal Architecture — Setup Complete

**Date**: 2026-01-23
**Status**: ✅ Ready for testing

---

## What Was Built

### 1. **Dual-Entry Architecture**

R.I.S.E. now supports two parallel interfaces:

| Entry | Path | Purpose | Status |
|-------|------|---------|--------|
| **V1** | `index.html` | Production Builder (monolithic) | ✅ Stable |
| **V2** | `app.html` | Portal-based spatial interface | ✅ Ready |

**Access Points**:
- V1: http://localhost:5175/
- V2: http://localhost:5175/app.html

---

### 2. **V2 File Structure**

```
app.html                    # V2 entry point
src/
├── app.js                  # V2 orchestrator (already existed)
├── core/
│   └── router.js          # View navigation with crossfade
├── components/
│   ├── Portal.js          # Landing experience
│   ├── Chamber.js         # Immersive reading
│   ├── Library.js         # Text browsing
│   ├── Workshop.js        # Session configuration
│   └── Settings.js        # User preferences
└── [shared resources]     # Visuals, audio, content (used by both V1 & V2)
```

---

### 3. **V2 User Experience Flow**

```
Portal (Landing)
    ↓
    ├── Chamber → Direct immersive reading
    ├── Library → Browse texts → Chamber
    ├── Workshop → Configure session → Chamber
    └── Settings → Preferences
```

**Key Differences from V1**:

| Aspect | V1 Builder | V2 Portal |
|--------|-----------|-----------|
| **Entry** | Drop zone + config accordion | Breathing sigil + 3 paths |
| **Config** | All controls visible upfront | Progressive disclosure (Workshop) |
| **Navigation** | Modal overlays | Spatial routing with crossfade |
| **Aesthetic** | Utility-first, cluttered | Consciousness-first, stillness |

---

## Design Philosophy Alignment

### V1 Problems (Why we built V2):
- ❌ **Overloaded interface**: 20+ controls visible immediately
- ❌ **Utility-first**: Doesn't communicate R.I.S.E.'s consciousness ethos
- ❌ **Cluttered**: Drop zone + 3 toggle buttons + 7 accordion controls

### V2 Solutions:
- ✅ **Darkness first**: Portal emerges from void with sequential fade-in
- ✅ **Stillness as default**: Only breathing sigil + 3 navigation paths
- ✅ **Progressive disclosure**: Configuration hidden in Workshop space
- ✅ **Spatial metaphor**: Chamber, Library, Workshop as distinct rooms

---

## Testing Checklist

### Portal
- [ ] Sequential fade-in (sigil → title → navigation)
- [ ] Sigil click triggers quick access
- [ ] Navigation to Chamber/Library/Workshop/Settings
- [ ] Escape key returns to Portal

### Chamber
- [ ] Pre-session state (session info + begin button)
- [ ] Visual cortex integration (subliminal flashes)
- [ ] Audio engine integration
- [ ] Hidden controls (appear on mouse movement)
- [ ] Progress indicator
- [ ] Exit returns to Portal

### Library
- [ ] Section navigation (Archive, Sequences, Personal, History)
- [ ] Text selection → Chamber flow
- [ ] Back to Portal

### Workshop
- [ ] Visual Interlocution Panel integration
- [ ] Source Browser integration
- [ ] Session configuration → Chamber flow
- [ ] Back to Portal

### Settings
- [ ] Component exists (basic placeholder ready)
- [ ] Accessibility settings
- [ ] Audio preferences
- [ ] Back to Portal

---

## Shared Systems (V1 & V2)

Both versions use the same underlying engines:

- **Visual Cortex**: Klee, Turrell, Fractal, Rock Garden, Wikimedia diagrams
- **Audio Engine**: Binaural beats, harmonics, pink noise, 432Hz drone
- **Content Library**: Sacred texts, literary works, research papers, declassified docs
- **Source Providers**: Text and visual source systems

---

## Next Steps

### Immediate Testing
1. Open http://localhost:5175/app.html
2. Verify Portal sequential fade-in
3. Test navigation to each space
4. Verify Escape key returns to Portal
5. Test Chamber session flow

### Integration Work Needed
- [ ] **Chamber**: Connect V1 chamber logic to V2 Chamber component
- [ ] **Library**: Wire up actual text data from `src/content/library.js`
- [ ] **Workshop**: Complete VisualInterlocutionPanel integration
- [ ] **Settings**: Expand placeholder into full component

### Pre-Release Polish
- [ ] Add loading states for async operations
- [ ] Test session persistence (localStorage)
- [ ] Verify visual cortex preloading
- [ ] Test audio layer crossfading
- [ ] Accessibility audit (keyboard nav, ARIA, screen readers)

---

## Deployment Decision

When V2 is stable and tested:

**Option A: Soft Launch (Recommended)**
- Keep V1 at `/` for current users
- Promote V2 at `/app.html` with "Try the new interface" link
- Gather feedback, iterate

**Option B: Hard Switch**
- Redirect `/` → V2
- Archive V1 to `/legacy/` for fallback
- Update all documentation

**Option C: A/B Test**
- 50% traffic to V1, 50% to V2
- Measure engagement, session completion
- Promote winner

---

## File Changes Summary

### Created
- [app.html](app.html) - V2 entry point with view containers

### Modified
- None (app.js already existed, no changes needed)

### Unchanged (Working as-is)
- [src/app.js](src/app.js) - V2 orchestrator with Router integration
- [src/core/router.js](src/core/router.js) - View navigation system
- All components (Portal, Chamber, Library, Workshop, Settings)
- All shared resources (visuals, audio, content, sources)

---

## Development Workflow

### Working on V1 (Production Fixes)
```bash
npm run dev
# Navigate to http://localhost:5175/
# Edit: index.html, src/main.js, src/style.css
```

### Working on V2 (New Interface)
```bash
npm run dev
# Navigate to http://localhost:5175/app.html
# Edit: src/app.js, src/components/*, src/design-system.css
```

### Shared Resources (Affects Both)
```bash
# Changes to these affect V1 AND V2:
src/visuals/*
src/audio/*
src/content/*
src/sources/*
src/core/*
```

---

## Success Criteria

V2 is ready for release when:
- ✅ Portal → Chamber → completion flow works end-to-end
- ✅ Library text browsing → Chamber flow works
- ✅ Workshop session building → Chamber flow works
- ✅ Visual cortex preloading doesn't block navigation
- ✅ Audio engine crossfades smoothly between views
- ✅ Keyboard navigation (Tab, Enter, Escape) works throughout
- ✅ Session state persists across browser refresh
- ✅ Interface communicates R.I.S.E.'s consciousness-first ethos

---

*"Darkness first, light emerges. Stillness as default, movement with intention."*

— R.I.S.E. Design Philosophy
