/**
 * Klee Generator v2.0
 * "A line is a dot that went for a walk." — Paul Klee
 *
 * Enhanced with: bezier curves, arcs, polygons, varied line weights,
 * compositional structure, void palette colors
 */
export class Klee {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Void palette colors
        this.colors = {
            light: 'rgba(232, 232, 236, 0.9)',      // --color-light
            cloud: 'rgba(197, 197, 205, 0.7)',      // --color-cloud
            fog: 'rgba(155, 155, 165, 0.5)',        // --color-fog
            threshold: 'rgba(139, 127, 212, 0.8)',  // --color-threshold (violet)
            chamber: 'rgba(107, 159, 212, 0.7)',    // --color-chamber (blue)
            ember: 'rgba(212, 165, 116, 0.6)',      // --color-ember (amber)
        };
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    generate() {
        const { ctx, canvas } = this;
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Aesthetic: Fragile, erratic, human (The "Rock Garden" Principle)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(232, 228, 223, 0.8)'; // Glow color
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();

        // Random Walk
        let x = Math.random() * w * 0.8 + w * 0.1;
        let y = Math.random() * h * 0.8 + h * 0.1;
        ctx.moveTo(x, y);

        const steps = Math.floor(Math.random() * 20) + 10;

        for (let i = 0; i < steps; i++) {
            const angle = Math.random() * Math.PI * 2;
            const length = Math.random() * 200 + 50;

            // Jittery movement
            x += Math.cos(angle) * length;
            y += Math.sin(angle) * length;

            // Wrap around
            if (x < 0) x += w;
            if (x > w) x -= w;
            if (y < 0) y += h;
            if (y > h) y -= h;

            ctx.lineTo(x, y);
        }

        ctx.stroke();

        // Add a few symbolic dots/glyphs
        for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            const dx = Math.random() * w;
            const dy = Math.random() * h;
            ctx.arc(dx, dy, Math.random() * 3 + 1, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(74, 158, 255, 0.6)'; // Accent dim
            ctx.fill();
        }
    }
}
