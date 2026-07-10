# Visual Interlocution System - Evaluation & Refinement

## System Evaluation

### Architecture Assessment

**Visual Cortex Core** (`src/visuals/visual-cortex.js`)
- ✅ **Clean singleton pattern** - Single instance, lazy initialization
- ✅ **Modular generator system** - Klee and Turrell as separate classes
- ✅ **Configuration-driven** - Frequency, duration, active patterns all configurable
- ✅ **Non-intrusive overlay** - Fixed position, `pointer-events: none`, hidden by default

**Generators**

1. **Klee** (`src/visuals/klee.js`) - "A line is a dot that went for a walk"
   - Random walk algorithm with 10-30 steps
   - Organic, erratic, human aesthetic
   - Canvas-based rendering with stroke and dot primitives
   - Uses `--glow` color palette for lines
   - Assessment: ✅ Philosophically aligned, ⚠️ Could benefit from more varied primitives

2. **Turrell** (`src/visuals/turrell.js`) - Luminous light fields
   - Generates random HSL gradients (hue, saturation, lightness)
   - Linear gradients at random angles
   - Instant transition (no ease) for flash effect
   - Assessment: ✅ Effective, ⚠️ Could incorporate void palette colors for deeper integration

**Integration**
- Triggers on sentence breaks (punctuation: `.!?`)
- Probability-based (default 30%)
- Duration: 33ms default (configurable 16-200ms)
- Assessment: ✅ Well-integrated with Player atom stream

---

## Critical Safety Considerations

### Current Gaps
1. ❌ **No photosensitivity warnings** - System can flash repeatedly with no user consent
2. ❌ **No frequency caps** - Could theoretically flash faster than 3Hz (seizure threshold)
3. ❌ **No user consent flow** - Should require explicit acknowledgment before enabling

### Recommendations
1. Add maximum flash frequency cap (never exceed 3Hz / 333ms between flashes)
2. Add photosensitivity warning on first enable (with explicit consent checkbox)
3. Integrate with global photosensitivity mode (disable all oscillations)
4. Add visual flash history tracking to prevent accidental rapid-fire sequences

---

## UX Refinement: Visual Controls Panel

### Problems Identified
1. **Spatial disharmony** - Inconsistent spacing, misaligned elements
2. **Visual hierarchy unclear** - All controls given equal weight
3. **Toggle pattern inconsistent** - Using custom toggle-switch instead of design system
4. **Pattern selection clunky** - Checkboxes without clear visual feedback
5. **No progressive disclosure** - All controls visible even when disabled
6. **Missing safety warnings** - No photosensitivity notice

### Solutions Implemented

#### 1. Renamed Section
- **Old:** "Visuals"
- **New:** "Interlocution"
- Rationale: More precise, philosophically aligned with "interrupts between streams"

#### 2. Progressive Disclosure
```html
<div class="visuals-primary-control">
  <label class="toggle">
    <input type="checkbox" id="visuals-toggle">
    <span class="toggle-switch"></span>
    <span class="toggle-label">Enable Visual Interrupts</span>
  </label>
</div>

<div class="visuals-config" id="visuals-config">
  <!-- Configuration only enabled when toggle is on -->
</div>
```

CSS:
```css
.visuals-config {
  opacity: 0.4;
  pointer-events: none;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.visuals-config.enabled {
  opacity: 1;
  pointer-events: all;
}
```

JavaScript:
```javascript
const updateConfigState = (enabled) => {
  if (visualConfig) {
    visualConfig.classList.toggle('enabled', enabled);
  }
};
```

#### 3. Refined Input Labels
- **Before:** Generic labels with separate value display
- **After:** Flexbox label with inline value display

```html
<label class="input-label">
  <span>Frequency</span>
  <span class="input-label-value font-mono" id="visual-freq-val">30%</span>
</label>
```

#### 4. Pattern Grid System
- **Before:** Stacked checkboxes with minimal visual feedback
- **After:** Card-based grid with clear selection states

```html
<div class="pattern-grid">
  <label class="pattern-option">
    <input type="checkbox" name="visual-pattern" value="klee" checked>
    <span class="pattern-card">
      <span class="pattern-icon">╱</span>
      <span class="pattern-name">Klee</span>
      <span class="pattern-desc text-mist">Organic lines</span>
    </span>
  </label>
  <!-- More patterns... -->
</div>
```

CSS features:
- Grid layout: `grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))`
- Hidden checkbox input (visually hidden, keyboard accessible)
- Card transitions on hover and selection
- Icon color changes on selection
- Disabled state with reduced opacity

#### 5. Input Hints
Added contextual help text below each slider:
```html
<small class="input-hint text-mist">Probability of flash per atom</small>
<small class="input-hint text-mist">Single-frame exposure (16-200ms)</small>
```

#### 6. Safety Warning
Added photosensitivity notice:
```html
<div class="visuals-warning">
  <span class="warning-icon">⚠</span>
  <p class="warning-text text-mist">
    Visual interrupts may not be suitable for photosensitive individuals.
    Disable if you experience discomfort.
  </p>
</div>
```

Styled with subtle ember accent:
```css
.visuals-warning {
  background: rgba(212, 164, 116, 0.05); /* Ember, very subtle */
  border: 1px solid rgba(212, 164, 116, 0.2);
  padding: var(--space-md);
}
```

---

## Design System Alignment

### UX Specification Adherence

✅ **Darkness First** - Background remains void (#0A0A0C), elements emerge
✅ **Stillness as Default** - No decorative animations, only meaningful transitions
✅ **Sharp Corners** - `border-radius: 0` (intention over friendliness)
✅ **8px Grid** - All spacing uses base-8 multiples
✅ **Progressive Disclosure** - Config hidden until needed
✅ **Typography Hierarchy** - Labels use Inter 400, values use JetBrains Mono
✅ **Color Palette** - Uses fog/cloud/light/mist from luminosity scale
✅ **Accent Usage** - Threshold violet for active states
✅ **Accessibility** - Focus indicators, keyboard navigation, reduced opacity for disabled

### Spacing Harmony

**Before:**
```css
gap: var(--space-lg);          /* 32px - too large */
padding: var(--space-xs) 0;     /* 8px - too small */
margin-bottom: var(--space-xs); /* Inconsistent */
```

**After:**
```css
gap: var(--space-md);           /* 24px - balanced */
padding: var(--space-md) 0;     /* 24px - consistent */
margin-bottom: var(--space-xs); /* 8px - within labels only */
```

### Visual Weight

**Before:** All elements same weight, no hierarchy
**After:**
1. **Primary** - Toggle switch (48px height, bold border)
2. **Secondary** - Slider controls (standard spacing)
3. **Tertiary** - Pattern cards (grid, subtle borders)
4. **Quaternary** - Warning notice (background tint, small text)

---

## Future Enhancements

### 1. Additional Generators
- **Apophysis** - Fractal flame patterns (already planned)
- **Rothko** - Color field rectangles (soft, meditative)
- **Kandinsky** - Geometric primitives (circles, triangles, lines)
- **Mondrian** - Grid-based compositions (primary colors + black)

### 2. Advanced Configuration
- Per-pattern probability weighting
- Atom-type specific triggering (flash only on certain word types)
- Synchronization with audio layers (flash on binaural phase changes)
- Adaptive frequency (reduce if user shows signs of discomfort)

### 3. Safety Improvements
- Flash rate limiter (max 3Hz hard cap)
- User consent modal on first enable
- Session flash counter (display "X flashes this session")
- Auto-disable after N consecutive flashes

### 4. Aesthetic Tuning
- **Klee:** Add more primitives (arcs, bezier curves, polygons)
- **Turrell:** Use void palette colors (threshold, chamber, ember)
- **Both:** Respect session intent (induction = cool colors, arousal = warm colors)
- **Both:** Integrate with pacing curve (flash intensity follows curve)

---

## Technical Debt

1. **Player Integration** - Currently triggers on sentence breaks; should integrate more deeply with Player event system
2. **Performance** - Canvas rendering could be optimized with OffscreenCanvas
3. **Testing** - No unit tests for generators or cortex logic
4. **Documentation** - Need JSDoc comments throughout

---

## Summary

The Visual Interlocution system is **conceptually excellent** and **architecturally sound**, with clean separation of concerns and modular generator design. The refined control panel now achieves **spatial harmony** through:

- Progressive disclosure (disabled controls are visually suppressed)
- Consistent spacing using 8px grid
- Clear visual hierarchy (primary toggle → sliders → pattern grid → warning)
- Card-based pattern selection with immediate visual feedback
- Accessibility-first keyboard navigation
- Safety warnings integrated inline

The system is ready for production with the caveat that **photosensitivity safeguards** should be implemented before release to general users.

---

## Files Modified

1. **index.html** - Restructured visual controls section
2. **src/style.css** - Added/refined CSS for visual options panel
3. **src/main.js** - Added config section enable/disable logic

## Files Evaluated (No Changes)

1. **src/visuals/visual-cortex.js** - Core system (architecture approved)
2. **src/visuals/klee.js** - Generator (effective, minor enhancements possible)
3. **src/visuals/turrell.js** - Generator (effective, minor enhancements possible)
4. **src/visuals/visuals.css** - Overlay styles (minimal, correct)
