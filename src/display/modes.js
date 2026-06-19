/**
 * R.I.S.E. Display Modes
 * Chamber, Orbital, and Focal display renderers
 */

/**
 * Display mode types
 * @typedef {'focal' | 'orbital' | 'chamber'} DisplayMode
 */

/**
 * Base renderer interface
 */
class BaseRenderer {
    constructor(container) {
        this.container = container;
        this.isActive = false;
    }

    activate() { this.isActive = true; }
    deactivate() { this.isActive = false; }
    render(atom) { throw new Error('Not implemented'); }
    clear() { throw new Error('Not implemented'); }
    update(deltaTime) { /* Optional animation update */ }
}

/**
 * Focal Point Renderer
 * Classic RSVP: single word/phrase, center screen
 */
export class FocalRenderer extends BaseRenderer {
    constructor(container) {
        super(container);
        this.display = null;
        this.init();
    }

    init() {
        this.display = this.container.querySelector('.atom-display');
        if (!this.display) {
            this.display = document.createElement('div');
            this.display.className = 'atom-display';
            this.container.appendChild(this.display);
        }
    }

    render(atom) {
        if (!this.display) return;

        // Fade out
        this.display.classList.remove('visible');
        this.display.classList.add('fade-out');

        setTimeout(() => {
            this.display.textContent = atom.content;
            this.display.classList.remove('fade-out');
            if (atom.content) {
                this.display.classList.add('visible');
            }
        }, 150);
    }

    clear() {
        if (this.display) {
            this.display.textContent = '';
            this.display.classList.remove('visible', 'fade-out');
        }
    }

    setBreathing(enabled) {
        if (this.display) {
            this.display.classList.toggle('breathing', enabled);
        }
    }
}

/**
 * Chamber Renderer
 * Immersive: full-field texture with content emerging
 */
export class ChamberRenderer extends BaseRenderer {
    constructor(container) {
        super(container);
        this.canvas = null;
        this.ctx = null;
        this.display = null;
        this.particles = [];
        this.animationId = null;
        this.breathPhase = 0;
        this.entrainmentFreq = 0.1; // Hz - breathing rate

        this.config = {
            particleCount: 80,
            particleSpeed: 0.3,
            particleSize: 2,
            glowIntensity: 0.3,
            breathAmplitude: 0.15
        };

        this.init();
    }

    init() {
        // Create canvas for particle field
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'chamber-canvas';
        this.container.insertBefore(this.canvas, this.container.firstChild);

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        // Get or create display element
        this.display = this.container.querySelector('.atom-display');
        if (!this.display) {
            this.display = document.createElement('div');
            this.display.className = 'atom-display chamber-text';
            this.container.appendChild(this.display);
        }
        this.display.classList.add('chamber-text');

        // Initialize particles
        this.initParticles();

        // Handle resize
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * this.config.particleSpeed,
                vy: (Math.random() - 0.5) * this.config.particleSpeed,
                size: Math.random() * this.config.particleSize + 1,
                alpha: Math.random() * 0.5 + 0.1,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
    }

    activate() {
        super.activate();
        this.container.classList.add('chamber-mode');
        this.canvas.style.display = 'block';
        this.startAnimation();
    }

    deactivate() {
        super.deactivate();
        this.container.classList.remove('chamber-mode');
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }
        this.stopAnimation();
    }

    startAnimation() {
        const animate = () => {
            if (!this.isActive) return;

            this.update();
            this.drawParticles();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    update() {
        const now = Date.now() / 1000;
        this.breathPhase = Math.sin(now * this.entrainmentFreq * Math.PI * 2);

        // Update particles
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around
            if (p.x < 0) p.x = window.innerWidth;
            if (p.x > window.innerWidth) p.x = 0;
            if (p.y < 0) p.y = window.innerHeight;
            if (p.y > window.innerHeight) p.y = 0;
        }

        // Update glow intensity based on breath
        const glowMod = 1 + this.breathPhase * this.config.breathAmplitude;
        document.documentElement.style.setProperty('--chamber-glow', glowMod);
    }

    drawParticles() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear with slight fade for trails
        ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
        ctx.fillRect(0, 0, w, h);

        // Draw particles
        for (const p of this.particles) {
            const pulse = Math.sin(Date.now() / 1000 + p.pulseOffset) * 0.3 + 0.7;
            const alpha = p.alpha * pulse * (1 + this.breathPhase * 0.2);

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(74, 158, 255, ${alpha * 0.6})`;
            ctx.fill();

            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgba(74, 158, 255, ${alpha * 0.3})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    render(atom) {
        if (!this.display) return;

        // Fade out
        this.display.classList.remove('visible');
        this.display.classList.add('fade-out');

        setTimeout(() => {
            this.display.textContent = atom.content;
            this.display.classList.remove('fade-out');
            if (atom.content) {
                this.display.classList.add('visible');
            }
        }, 150);
    }

    clear() {
        if (this.display) {
            this.display.textContent = '';
            this.display.classList.remove('visible', 'fade-out');
        }
    }

    setBreathing(enabled) {
        // Chamber always breathes when active
    }

    /**
     * Set entrainment frequency (affects breath rate)
     * @param {number} freq - Frequency in Hz
     */
    setEntrainmentFrequency(freq) {
        this.entrainmentFreq = freq;
    }
}

/**
 * Orbital Renderer
 * Primary content center, symbols orbit periphery
 */
export class OrbitalRenderer extends BaseRenderer {
    constructor(container) {
        super(container);
        this.display = null;
        this.orbitContainer = null;
        this.orbits = [];
        this.animationId = null;
        this.angle = 0;

        this.config = {
            orbitRadius: 0.35, // Percentage of min(width, height)
            orbitCount: 5,
            rotationSpeed: 0.0005, // Radians per ms
            symbolSize: 24
        };

        this.symbols = ['◇', '○', '△', '□', '◈', '◎', '✦', '⬡'];
        this.activeSymbols = [];

        this.init();
    }

    init() {
        // Central display
        this.display = this.container.querySelector('.atom-display');
        if (!this.display) {
            this.display = document.createElement('div');
            this.display.className = 'atom-display';
            this.container.appendChild(this.display);
        }

        // Orbit container
        this.orbitContainer = document.createElement('div');
        this.orbitContainer.className = 'orbit-container';
        this.container.appendChild(this.orbitContainer);

        // Create orbit elements
        this.createOrbits();
    }

    createOrbits() {
        this.orbits = [];
        for (let i = 0; i < this.config.orbitCount; i++) {
            const orbit = document.createElement('div');
            orbit.className = 'orbit-symbol';
            orbit.textContent = this.symbols[i % this.symbols.length];
            this.orbitContainer.appendChild(orbit);
            this.orbits.push({
                element: orbit,
                angle: (Math.PI * 2 / this.config.orbitCount) * i,
                radiusMod: 0.9 + Math.random() * 0.2,
                speedMod: 0.8 + Math.random() * 0.4
            });
        }
    }

    activate() {
        super.activate();
        this.container.classList.add('orbital-mode');
        this.orbitContainer.style.display = 'block';
        this.startAnimation();
    }

    deactivate() {
        super.deactivate();
        this.container.classList.remove('orbital-mode');
        if (this.orbitContainer) {
            this.orbitContainer.style.display = 'none';
        }
        this.stopAnimation();
    }

    startAnimation() {
        let lastTime = Date.now();

        const animate = () => {
            if (!this.isActive) return;

            const now = Date.now();
            const delta = now - lastTime;
            lastTime = now;

            this.updateOrbits(delta);
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    updateOrbits(deltaMs) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const baseRadius = Math.min(window.innerWidth, window.innerHeight) * this.config.orbitRadius;

        for (const orbit of this.orbits) {
            orbit.angle += this.config.rotationSpeed * deltaMs * orbit.speedMod;

            const radius = baseRadius * orbit.radiusMod;
            const x = centerX + Math.cos(orbit.angle) * radius;
            const y = centerY + Math.sin(orbit.angle) * radius;

            orbit.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;

            // Fade based on position (dimmer at edges)
            const distFromCenter = Math.sqrt(
                Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
            );
            const maxDist = Math.min(window.innerWidth, window.innerHeight) / 2;
            const alpha = 0.3 + 0.5 * (1 - distFromCenter / maxDist);
            orbit.element.style.opacity = alpha;
        }
    }

    render(atom) {
        if (!this.display) return;

        // Fade out
        this.display.classList.remove('visible');
        this.display.classList.add('fade-out');

        setTimeout(() => {
            this.display.textContent = atom.content;
            this.display.classList.remove('fade-out');
            if (atom.content) {
                this.display.classList.add('visible');
            }
        }, 150);
    }

    clear() {
        if (this.display) {
            this.display.textContent = '';
            this.display.classList.remove('visible', 'fade-out');
        }
    }

    setBreathing(enabled) {
        if (this.display) {
            this.display.classList.toggle('breathing', enabled);
        }
    }

    /**
     * Set custom symbols for orbits
     * @param {string[]} symbols 
     */
    setSymbols(symbols) {
        this.symbols = symbols;
        this.orbits.forEach((orbit, i) => {
            orbit.element.textContent = symbols[i % symbols.length];
        });
    }
}

/**
 * Display Manager
 * Coordinates between display modes
 */
export class DisplayManager {
    constructor(container) {
        this.container = container;
        this.renderers = {
            focal: new FocalRenderer(container),
            chamber: new ChamberRenderer(container),
            orbital: new OrbitalRenderer(container)
        };
        this.activeMode = 'focal';
        this.activeRenderer = this.renderers.focal;
        this.imageElement = null;
        this.initImageElement();
    }

    /**
     * Initialize image display element
     */
    initImageElement() {
        this.imageElement = document.createElement('img');
        this.imageElement.className = 'atom-image';
        this.imageElement.style.cssText = `
            max-width: 80vw;
            max-height: 70vh;
            object-fit: contain;
            opacity: 0;
            transition: opacity 300ms ease-out;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 5;
            border-radius: 12px;
            box-shadow: 0 0 60px rgba(74, 158, 255, 0.3);
        `;
        this.container.appendChild(this.imageElement);
    }

    /**
     * Set display mode
     * @param {'focal' | 'chamber' | 'orbital'} mode 
     */
    setMode(mode) {
        if (mode === this.activeMode) return;

        // Deactivate current
        this.activeRenderer.deactivate();

        // Activate new
        this.activeMode = mode;
        this.activeRenderer = this.renderers[mode];
        this.activeRenderer.activate();

        console.log(`[DisplayManager] Mode: ${mode}`);
    }

    /**
     * Render an atom based on its modality
     * @param {import('../core/models.js').Atom} atom 
     */
    render(atom) {
        // Handle different modalities
        switch (atom.modality) {
            case 'image':
                this.renderImage(atom);
                break;
            case 'symbol':
                this.renderSymbol(atom);
                break;
            case 'text':
            default:
                // Hide image if showing
                this.hideImage();
                this.activeRenderer.render(atom);
                break;
        }
    }

    /**
     * Render an image atom
     * @param {Object} atom 
     */
    renderImage(atom) {
        // Hide text display
        const textDisplay = this.container.querySelector('.atom-display');
        if (textDisplay) {
            textDisplay.classList.remove('visible');
        }

        // Show image
        this.imageElement.src = atom.url || atom.content;
        this.imageElement.style.opacity = '0';

        // Fade in after load
        this.imageElement.onload = () => {
            this.imageElement.style.opacity = '1';
        };

        // Handle error
        this.imageElement.onerror = () => {
            console.warn('[DisplayManager] Failed to load image:', atom.url);
            // Show placeholder text
            this.activeRenderer.render({ content: '[ image ]', modality: 'text' });
        };
    }

    /**
     * Render a symbol atom (large, centered)
     * @param {Object} atom 
     */
    renderSymbol(atom) {
        this.hideImage();

        // Render as text but the CSS will style symbols differently
        const textDisplay = this.container.querySelector('.atom-display');
        if (textDisplay) {
            textDisplay.classList.add('symbol-mode');
        }

        this.activeRenderer.render({
            ...atom,
            content: atom.content
        });

        // Remove symbol mode after render
        setTimeout(() => {
            if (textDisplay) {
                textDisplay.classList.remove('symbol-mode');
            }
        }, atom.duration || 400);
    }

    /**
     * Hide image element
     */
    hideImage() {
        if (this.imageElement) {
            this.imageElement.style.opacity = '0';
        }
    }

    /**
     * Clear display
     */
    clear() {
        this.hideImage();
        this.activeRenderer.clear();
    }

    /**
     * Set breathing animation
     * @param {boolean} enabled 
     */
    setBreathing(enabled) {
        this.activeRenderer.setBreathing(enabled);
    }

    /**
     * Get current mode
     * @returns {DisplayMode}
     */
    getMode() {
        return this.activeMode;
    }

    /**
     * Access specific renderer for configuration
     * @param {'focal' | 'chamber' | 'orbital'} mode 
     */
    getRenderer(mode) {
        return this.renderers[mode];
    }

    /**
     * Cleanup
     */
    destroy() {
        Object.values(this.renderers).forEach(r => {
            if (r.deactivate) r.deactivate();
            if (r.stopAnimation) r.stopAnimation();
        });
    }
}

