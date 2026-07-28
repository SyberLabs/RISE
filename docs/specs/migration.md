R.I.S.E. V2 Migration Roadmap
Complete Feature Parity Plan
Based on the comprehensive audit, here's the prioritized migration plan:
PHASE 1: CORE ORBITAL MODAL CONTENT ⚡ (2-3 weeks)
1.1 Temporal Orbit Modal
Status: Partially complete (WPM exists, curves/chunking missing)
Priority: CRITICAL Missing Features:
✅ WPM Slider (EXISTS)
❌ Pacing Curves (5 options: Flat, Induction, Arousal, Wave, Climax)
❌ Chunking Mode (Word, Phrase, Sentence with voice-lock behavior)
Files to Port:
src/core/pacing.js lines 31-114 → Temporal modal
src/core/chunker.js → Temporal modal
Voice-lock logic from main.js lines 664-679
Complexity: LOW
Est. Time: 2-3 hours
1.2 Audio Orbit Modal
Status: Partially complete (preset buttons exist, no functionality)
Priority: CRITICAL Missing Features:
❌ Audio Preset Implementation (Silent, Focus, Deep, Gateway)
Focus: Alpha 10Hz, binaural + harmonics
Deep: Theta 6Hz, full stack (binaural + harmonics + noise + drone)
Gateway: Theta 6Hz, Hemi-Sync inspired
❌ Individual Layer Toggles (4 layers):
Binaural Beats (∿)
Harmonics (≋)
Pink Noise (▒)
432Hz Drone (◉)
❌ Voice/TTS System:
Toggle with photosensitivity-style warning
Voice selection dropdown (system voices)
Auto rate calculation from WPM
Chunk mode lock to "Phrase"
Files to Port:
src/audio/engine.js lines 50-91 (presets) → Audio modal
src/audio/engine.js lines 216-472 (layers) → Audio modal
src/audio/engine.js lines 799-963 (voice) → Audio modal
main.js lines 315-364, 620-693 (UI logic)
Complexity: MEDIUM
Est. Time: 1-2 days
1.3 Visual Orbit Modal
Status: Partially complete (display modes + VI toggle exist, patterns missing)
Priority: CRITICAL Missing Features:
✅ Display Mode Toggle (Focal, Chamber, Orbital) - EXISTS
✅ Visual Interlocution Toggle - EXISTS
✅ Frequency Slider - EXISTS
✅ Duration Slider - EXISTS
❌ Pattern Selection Grid (5 patterns with checkboxes):
Klee (with 6 preset dropdown: Random, Corporeal, Structural, Mythic, Volatile, Centered)
Turrell
Fractal Flame
Rock Garden
Diagrams (Wikimedia)
❌ Photosensitivity Safety Modal (reusable component)
Warning content
Risk list
Protection list
Accept/Cancel buttons
sessionStorage consent tracking
Files to Port:
index.html lines 281-333 (pattern grid) → Visual modal
main.js lines 719-820 (safety modal logic)
index.html lines 474-520 (safety modal HTML)
Complexity: MEDIUM
Est. Time: 1 day
PHASE 2: TEXT LOADING SYSTEM 📚 (1-2 weeks)
2.1 Library Modal - Core
Status: Component exists but incomplete
Priority: CRITICAL Current State:
Library.js component built
Basic structure in place
Missing: verse picker, category implementation, metadata display
Missing Features:
❌ Category Tab System (5 categories):
Sacred (☯): 15+ texts with verse pickers
Literary (📜): Gutenberg integration
Research (🔬): ArXiv async fetching
Declassified (👁️): Pre-loaded intelligence docs
Private (📂): User uploads + paste
❌ Verse/Chapter Picker (sub-view):
Grid of verse/chapter numbers
Back button to text list
Auto-apply recommended WPM + curve per text
❌ Text Card Metadata:
Author, tradition, date
Verse/chapter count
Estimated duration at current WPM
Recommended curve indicator
Files to Port:
src/content/library.js (complete registry)
main.js lines 936-1177 (library UI logic)
index.html lines 28-45 (library modal structure)
Complexity: HIGH
Est. Time: 3-4 days
2.2 Library Modal - Private Tab
Status: Not started
Priority: HIGH Features to Build:
❌ Upload Button (file picker)
❌ Paste Button (textarea modal)
❌ User Text Management:
Text cards showing user uploads
Delete button per card
Rename functionality
localStorage persistence
Metadata (date added, word count, last used)
Files to Create:
PrivateLibrary.js (new component)
localStorage schema for user texts
Complexity: MEDIUM
Est. Time: 1-2 days
2.3 Starters Sidebar
Status: Not started
Priority: MEDIUM Features to Build:
❌ Slide-out Sidebar (left edge)
❌ Starter Card List:
Name, description
Category icon
Curve type indicator
Pre-configured WPM
❌ Auto-Configuration: Load text + apply starter's curve + WPM
Files to Port:
src/content/starters.js (curated sequences)
main.js lines 902-926, 1199-1258 (sidebar logic)
index.html lines 17-25 (sidebar structure)
Complexity: MEDIUM
Est. Time: 1 day
PHASE 3: DISPLAY MODES 🎨 (1-2 weeks)
3.1 Chamber Display Mode
Status: Not started
Priority: HIGH Features:
❌ Particle Field System (80 particles)
❌ Entrainment Frequency Breathing:
Sync with binaural frequency
CSS variable --chamber-glow modulation
Particle velocity affected by frequency
❌ Canvas-Based Animation Loop
Files to Port:
src/display/modes.js lines 80-266 (Chamber renderer)
Integration with audio engine frequency
Complexity: HIGH
Est. Time: 2-3 days
3.2 Orbital Display Mode
Status: Not started
Priority: MEDIUM Features:
❌ 5 Orbiting Symbols around center text
❌ Customizable Rotation Speed
❌ Peripheral Fade (distance-based opacity)
❌ Symbol Customization via settings
Files to Port:
src/display/modes.js lines 272-430 (Orbital renderer)
Complexity: MEDIUM
Est. Time: 1-2 days
3.3 Visual Interlocution Engine
Status: Not started
Priority: HIGH Features to Port:
❌ Visual Cortex Orchestrator (visuals/visual-cortex.js):
Pattern queue management
Frequency-based triggering (per atom)
Duration control (16-200ms)
Canvas overlay system
❌ Pattern Engines (4 engines):
Klee: visuals/klee-enhanced.js (6 presets)
Turrell: visuals/turrell.js (light fields)
Fractal: visuals/fractal.js (DeepLightning algorithm)
Rock Garden: visuals/rockgarden.js (Zen stones)
❌ Wikimedia Provider (sources/visual/wikimedia.js):
4 categories (Cajal, Fractals, Geometry, Haeckel)
Preload queue (5-10 images)
Background fetching
Complexity: HIGH
Est. Time: 3-5 days
PHASE 4: SESSION MANAGEMENT ⏯️ (3-5 days)
4.1 Enhanced Player Controls
Status: Basic play/pause exists, missing advanced features
Priority: HIGH Missing Features:
❌ Volume Control:
Mouse wheel on volume button
Vertical slider popup
Master volume (0-100%)
Per-layer volume (audio)
❌ Session Review Screen:
Stats display (duration, atoms, WPM, session name)
Repeat button
New Session button
View transition
Files to Port:
main.js lines 871-877 (volume control)
main.js lines 484-496, index.html lines 382-408 (review screen)
Complexity: LOW
Est. Time: 1 day
4.2 Toast Notifications
Status: Not started
Priority: LOW Features:
❌ Toast Component (bottom-center)
❌ Auto-dismiss (3s default)
❌ Fade animations
❌ Use Cases:
Voice mode enabled notification
Frequency selection feedback
Error messages
Files to Port:
main.js lines 165-176 (toast system)
Complexity: LOW
Est. Time: 1-2 hours
PHASE 5: SOURCE PROVIDERS 🌐 (1 week)
5.1 Text Source Providers
Status: Sacred texts exist, others missing
Priority: MEDIUM Providers to Port:
✅ Sacred Texts - EXISTS
❌ ArXiv (sources/text/arxiv.js):
Async category fetching
Metadata extraction (author, date, abstract)
Loading spinner in library modal
❌ Gutenberg (sources/text/gutenberg.js):
Predefined catalog
Async book fetching
❌ Declassified (sources/text/declassified.js):
Pre-loaded document library
❌ Private (sources/text/private.js):
Local document cache
University docs
Complexity: MEDIUM
Est. Time: 2-3 days
5.2 Visual Source Provider
Status: Not started
Priority: MEDIUM Provider:
❌ Wikimedia (sources/visual/wikimedia.js):
Category filtering
Random image fetching
Preload queue integration
Error handling
Complexity: MEDIUM
Est. Time: 1 day
PHASE 6: ADVANCED FEATURES 🚀 (1-2 weeks)
6.1 Audio Sundial (Frequency Selector)
Status: Not started
Priority: MEDIUM Features:
❌ Circular Sundial UI:
6 Solfeggio nodes (396, 417, 528, 639, 741, 852 Hz)
Center node (432 Hz)
Visual active state
Click to activate frequency
❌ Carrier Tuning Options:
Standard (200Hz)
Concert (220Hz)
Verdi (216Hz)
Sacred (432Hz, default)
Files to Port:
index.html lines 420-454 (sundial structure)
main.js lines 1339-1377 (sundial logic)
audio/engine.js lines 192-211 (frequency application)
Complexity: HIGH
Est. Time: 2-3 days
6.2 Active Sources Modal
Status: Component exists but not integrated
Priority: LOW Features:
❌ Source Management UI:
List of active visual sources
Exclude/include toggles
Category indicators
Files to Integrate:
components/ActiveSourcesModal.js (already built)
Complexity: LOW
Est. Time: 1-2 hours
PHASE 7: POLISH & OPTIMIZATION ✨ (3-5 days)
7.1 State Persistence
Priority: MEDIUM
❌ localStorage Implementation:
User preferences (last WPM, curve, display mode)
Private library texts
Visual interlocution consent
Audio preset preference
Complexity: LOW
Est. Time: 1 day
7.2 Keyboard Shortcuts
Priority: LOW
❌ Global Shortcuts:
Spacebar: Play/Pause
Escape: Exit session / Close modals
Arrow keys: Navigate library / starters
Enter: Select item
Complexity: LOW
Est. Time: 1 day
7.3 Accessibility
Priority: MEDIUM
❌ ARIA Labels on all interactive elements
❌ Keyboard Navigation for orbital nodes
❌ Screen Reader announcements for state changes
❌ Focus Management in modals
Complexity: MEDIUM
Est. Time: 1-2 days
7.4 Mobile Optimizations
Priority: HIGH
❌ Touch Targets (minimum 44×44px)
❌ Modal Scroll behavior on mobile
❌ Pattern Grid responsive layout
❌ Orbital Geometry mobile scaling (already implemented)
Complexity: LOW
Est. Time: 1 day
TIMELINE SUMMARY
Phase	Duration	Priority	Dependencies
Phase 1: Orbital Modals	2-3 weeks	CRITICAL	None
Phase 2: Text Loading	1-2 weeks	CRITICAL	Phase 1
Phase 3: Display Modes	1-2 weeks	HIGH	Phase 1, 2
Phase 4: Session Mgmt	3-5 days	HIGH	Phase 1
Phase 5: Source Providers	1 week	MEDIUM	Phase 2
Phase 6: Advanced Features	1-2 weeks	MEDIUM	Phase 1, 3
Phase 7: Polish	3-5 days	MEDIUM	All phases
Total Estimated Timeline: 8-12 weeks for full feature parity
RECOMMENDED LAUNCH STRATEGY
MVP Launch (4-5 weeks):
Include:
Phase 1: Complete orbital modals (all 3)
Phase 2.1: Library with Sacred + Private only
Phase 4.1: Session management basics
Focal display mode only
Defer:
Chamber/Orbital display modes
Visual interlocution
ArXiv/Gutenberg providers
Audio sundial
Starters sidebar
V2.1 Update (2-3 weeks later):
Visual interlocution engine
Chamber/Orbital display modes
Starters sidebar
V2.2 Update (2-3 weeks later):
ArXiv/Gutenberg integration
Audio sundial
Advanced audio controls
CRITICAL PATH ITEMS (Must-Have for MVP)
✅ Temporal Modal Complete (WPM + Curves + Chunking)
✅ Audio Modal Complete (Presets + Voice/TTS)
✅ Visual Modal Complete (Display modes + basic VI)
✅ Library → Private (Upload + Paste functionality)
✅ Session Review Screen (Stats + actions)
✅ Voice/TTS Integration (Full implementation with chunk-lock)
Without these 6 features, V2 cannot replace V1.