/**
 * Turrell Generator v3.0
 * Luminous light fields inspired by James Turrell's installations.
 *
 * Enhanced with: soft gradients, glowing color fields, atmospheric depth,
 * subtle color breathing, horizon lines, and radiant luminosity.
 */
export class Turrell {
    constructor(el) {
        this.el = el;

        // Luminous color palettes - softer, more radiant
        this.palettes = {
            // Twilight: deep blues transitioning to warm horizons
            twilight: [
                { h: 230, s: 55, l: 35 },  // Deep twilight blue
                { h: 260, s: 45, l: 45 },  // Violet dusk
                { h: 280, s: 40, l: 50 },  // Lavender glow
                { h: 320, s: 35, l: 55 },  // Rose horizon
                { h: 25, s: 50, l: 55 },   // Golden edge
            ],
            // Dawn: warm emergence from darkness
            dawn: [
                { h: 35, s: 60, l: 50 },   // Amber glow
                { h: 25, s: 55, l: 55 },   // Soft gold
                { h: 15, s: 50, l: 60 },   // Peach light
                { h: 345, s: 45, l: 55 },  // Rose blush
                { h: 280, s: 30, l: 45 },  // Receding violet
            ],
            // Ethereal: cool transcendent tones
            ethereal: [
                { h: 190, s: 50, l: 50 },  // Cyan glow
                { h: 210, s: 45, l: 55 },  // Sky blue
                { h: 230, s: 40, l: 60 },  // Soft azure
                { h: 250, s: 35, l: 55 },  // Gentle violet
                { h: 180, s: 40, l: 50 },  // Teal depth
            ],
            // Chamber: consciousness-aligned threshold tones
            chamber: [
                { h: 255, s: 35, l: 45 },  // Threshold violet
                { h: 240, s: 30, l: 50 },  // Chamber blue
                { h: 220, s: 35, l: 55 },  // Soft indigo
                { h: 200, s: 40, l: 50 },  // Deep teal
                { h: 270, s: 25, l: 55 },  // Mist violet
            ],
            // Ember: warm interior glow
            ember: [
                { h: 30, s: 50, l: 45 },   // Deep amber
                { h: 20, s: 55, l: 50 },   // Warm orange
                { h: 10, s: 45, l: 55 },   // Soft coral
                { h: 350, s: 40, l: 50 },  // Rose warmth
                { h: 40, s: 45, l: 55 },   // Golden tone
            ],
            // Void: minimal luminous grays with subtle color
            void: [
                { h: 240, s: 8, l: 45 },   // Cool gray
                { h: 0, s: 0, l: 50 },     // Neutral
                { h: 220, s: 10, l: 55 },  // Blue-gray mist
                { h: 260, s: 5, l: 48 },   // Violet-gray
                { h: 200, s: 8, l: 52 },   // Steel blue
            ],
        };
    }

    choose(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    hslToString(hsl, alpha = 1) {
        return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha})`;
    }

    // Shift a color slightly for harmonic variation
    shiftColor(hsl, hueShift = 0, satShift = 0, lightShift = 0) {
        return {
            h: (hsl.h + hueShift + 360) % 360,
            s: Math.max(0, Math.min(100, hsl.s + satShift)),
            l: Math.max(0, Math.min(100, hsl.l + lightShift))
        };
    }

    // Create soft luminous field (Turrell's signature style)
    createLuminousField() {
        const paletteKeys = Object.keys(this.palettes);
        const paletteKey = this.choose(paletteKeys);
        const palette = this.palettes[paletteKey];

        const primary = this.choose(palette);
        const secondary = this.choose(palette);

        // Create softer, more luminous versions
        const primaryGlow = this.shiftColor(primary, 0, -10, 15);
        const secondaryGlow = this.shiftColor(secondary, 0, -10, 15);

        // Soft radial field emanating from center or offset position
        const posX = this.rand(30, 70);
        const posY = this.rand(30, 70);

        return `radial-gradient(
            ellipse 120% 100% at ${posX}% ${posY}%,
            ${this.hslToString(primaryGlow, 1)} 0%,
            ${this.hslToString(primary, 0.95)} 25%,
            ${this.hslToString(secondary, 0.9)} 60%,
            ${this.hslToString(secondaryGlow, 0.85)} 100%
        )`;
    }

    // Create horizon effect (light field with edge)
    createHorizon() {
        const paletteKeys = Object.keys(this.palettes);
        const paletteKey = this.choose(paletteKeys);
        const palette = this.palettes[paletteKey];

        const skyColor = this.choose(palette);
        const horizonColor = this.choose(palette);
        const groundColor = this.shiftColor(horizonColor, 10, -15, -20);

        // Horizon position varies slightly
        const horizonPos = this.rand(35, 65);
        const glowIntensity = this.rand(0.6, 0.9);

        // Soft horizon with glow
        return `linear-gradient(
            180deg,
            ${this.hslToString(skyColor, 1)} 0%,
            ${this.hslToString(skyColor, 0.95)} ${horizonPos - 15}%,
            ${this.hslToString(horizonColor, glowIntensity)} ${horizonPos}%,
            ${this.hslToString(groundColor, 0.9)} ${horizonPos + 10}%,
            ${this.hslToString(groundColor, 1)} 100%
        )`;
    }

    // Create aperture effect (Turrell's famous rectangle of light)
    createAperture() {
        const paletteKeys = Object.keys(this.palettes);
        const paletteKey = this.choose(paletteKeys);
        const palette = this.palettes[paletteKey];

        const innerColor = this.choose(palette);
        const outerColor = this.shiftColor(innerColor, 20, -20, -25);

        // Inner glow more luminous
        const innerGlow = this.shiftColor(innerColor, 0, 5, 20);

        // Create layered radial that simulates aperture
        return `radial-gradient(
            ellipse 80% 70% at 50% 50%,
            ${this.hslToString(innerGlow, 1)} 0%,
            ${this.hslToString(innerColor, 0.98)} 40%,
            ${this.hslToString(this.shiftColor(innerColor, 5, -5, -5), 0.9)} 65%,
            ${this.hslToString(outerColor, 0.85)} 85%,
            ${this.hslToString(this.shiftColor(outerColor, 0, -10, -15), 1)} 100%
        )`;
    }

    // Create dual-tone split (soft Rothko-like division)
    createDualField() {
        const paletteKeys = Object.keys(this.palettes);
        const paletteKey = this.choose(paletteKeys);
        const palette = this.palettes[paletteKey];

        const colorA = this.choose(palette);
        const colorB = this.choose(palette);

        // Ensure colors are different enough
        const colorBShifted = Math.abs(colorA.h - colorB.h) < 20
            ? this.shiftColor(colorB, 30, 0, 0)
            : colorB;

        // Soft transition zone
        const splitPos = this.rand(40, 60);
        const transitionWidth = this.rand(5, 15);

        const angle = this.choose([0, 90, 180, 270]);

        return `linear-gradient(
            ${angle}deg,
            ${this.hslToString(colorA, 1)} 0%,
            ${this.hslToString(colorA, 0.98)} ${splitPos - transitionWidth}%,
            ${this.hslToString(colorBShifted, 0.98)} ${splitPos + transitionWidth}%,
            ${this.hslToString(colorBShifted, 1)} 100%
        )`;
    }

    // Create atmospheric glow (soft ambient light)
    createAtmosphericGlow() {
        const paletteKeys = Object.keys(this.palettes);
        const paletteKey = this.choose(paletteKeys);
        const palette = this.palettes[paletteKey];

        const centerColor = this.choose(palette);
        const edgeColor = this.shiftColor(centerColor, 15, -20, -30);

        // Very soft radial with luminous center
        const centerGlow = this.shiftColor(centerColor, 0, 10, 25);

        return `radial-gradient(
            circle at 50% 50%,
            ${this.hslToString(centerGlow, 1)} 0%,
            ${this.hslToString(centerColor, 0.95)} 30%,
            ${this.hslToString(this.shiftColor(centerColor, 5, -5, -10), 0.85)} 60%,
            ${this.hslToString(edgeColor, 0.8)} 100%
        )`;
    }

    // Create subtle luminous overlay
    createLuminousOverlay() {
        const intensity = this.rand(0.05, 0.15);
        const hue = this.rand(200, 280); // Cool luminous cast

        return `radial-gradient(
            ellipse 150% 100% at 50% 30%,
            hsla(${hue}, 30%, 70%, ${intensity}) 0%,
            transparent 70%
        )`;
    }

    // Create gentle vignette (softer than before)
    createVignette() {
        const intensity = this.rand(0.15, 0.35);
        return `radial-gradient(
            ellipse 120% 120% at 50% 50%,
            transparent 40%,
            rgba(5, 5, 10, ${intensity}) 100%
        )`;
    }

    generate() {
        // Choose composition type
        const compositionType = Math.floor(this.rand(0, 5));

        let primaryGradient;
        switch (compositionType) {
            case 0:
                primaryGradient = this.createLuminousField();
                break;
            case 1:
                primaryGradient = this.createHorizon();
                break;
            case 2:
                primaryGradient = this.createAperture();
                break;
            case 3:
                primaryGradient = this.createDualField();
                break;
            case 4:
                primaryGradient = this.createAtmosphericGlow();
                break;
        }

        // Layer composition
        const layers = [primaryGradient];

        // 40% chance of luminous overlay
        if (Math.random() < 0.4) {
            layers.unshift(this.createLuminousOverlay());
        }

        // 50% chance of gentle vignette
        if (Math.random() < 0.5) {
            layers.unshift(this.createVignette());
        }

        // Apply combined background
        this.el.style.background = layers.join(', ');
        this.el.style.transition = 'none';
        this.el.style.boxShadow = 'none';
    }
}
