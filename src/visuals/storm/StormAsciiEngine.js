/**
 * STORM OF STEEL — ENGINE 8: ASCII SOLDIER & BARBED WIRE LANDSCAPE
 * (ASCII / Unicode Art Engine)
 * 
 * Visualizes Ernst Jünger's iconic front-line soldier in a procedurally generated
 * No Man's Land landscape composed entirely of ASCII/Unicode character matrices,
 * complete with barbed wire entanglements, bare shattered trees, sandbags, and shell sparks.
 */

import { createSeededRandom } from '../lib/klee-core.js';

// Exact user-provided soldier model lines (29 lines)
const SOLDIER_ASCII = [
    "                            ⢀⣠⣴⣶⣶⣶⣶⣦⣄                                                      ",
    "                         ⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆                                                     ",
    "                      ⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆                                                    ",
    "                      ⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠃                                                   ",
    "                      ⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿          ⣼⣷⡶⠶⠶⠶⠦⠤⣄                           ⢀⡴⡆        ",
    "           ⢀⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣀⣠⣾⣿⣿⣶⣶⣶⣶⣶⣶⣿⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣿⣶⣧⣤⣤⣤⣤⣤⣤⣤⣶",
    "       ⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⠟⠉⠁          ",
    "      ⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⢿⣿⣿⣿⡿⠿⠛⠋⣩⣿⣿⣿⡿⠛⠉                            ",
    "      ⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠓⠚⣿⣿⣿    ⢠⣾⣿⣿⠟⠁                              ",
    "      ⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟       ⠿⠛⠋⣀⣶⣿⣿⣿⠟                                 ",
    "      ⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣤⣀⣤⣶⣿⣿⣿⣿⣿⡟                                    ",
    "     ⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠏                                     ",
    "     ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠛⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏                                      ",
    " ⢀⣤⣀ ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿   ⣠⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠋                                         ",
    " ⣸⣿⣿⣲⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏⠁                                           ",
    "⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇                                            ",
    "⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇                                            ",
    "⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿                                             ",
    "⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿                                             ",
    " ⠹⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⢸⣿⣿⣿⣿⣿⣿⡏                                             ",
    "    ⠈⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠋   ⢀⣿⣿⣿⣿⣿⣿⣿⠁                                             ",
    "    ⠰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠋⠁       ⠘⣿⣿⣿⣿⣿⣿⡏                                              ",
    "      ⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⠉            ⢹⣿⣿⣿⣿⠏                                               ",
    "      ⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃              ⣾⣿⣿⣿⣿                                                ",
    "     ⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏              ⣸⣿⣿⣿⣿⣿⣄                                              ",
    "     ⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇              ⢿⣿⣿⣿⣿⣿⣿⣦⣀                                            ",
    "      ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟                ⠉⠉⠛⠻⢿⣿⣿⣿ⷷ⣶                                           ",
    "      ⠸⣿⣿⣿⣿⣿⣿⣿⣿⡟                                                                       ",
    "       ⠈⠻⢿⣿⣿⣿⠿⠋                                                                        "
];

export class StormAsciiEngine {
    constructor() {
        this.name = "Storm ASCII Soldier & Landscape";
        this.category = "SYMBOLIC / NOTATIONAL";
        this.seed = "storm-ascii-01";
        this.time = 0;
        this.sparks = [];

        this.params = {
            fontSize: 12,
            speed: 0.8,
            colorPalette: 'iron_amber' // 'iron_amber', 'terminal_green', 'steel_cyan', 'monochrome'
        };
    }

    generate(signal = {}, seed = 'ascii-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        this.sparks = [];

        // Seed 20 shell sparks in the sky
        for (let i = 0; i < 24; i++) {
            this.sparks.push({
                x: rng(),
                y: rng() * 0.4,
                vx: (rng() - 0.5) * 0.02,
                vy: 0.01 + rng() * 0.03,
                char: ['*', '+', '°', '•', 'x', ':'][Math.floor(rng() * 6)]
            });
        }

        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt * this.params.speed;

        // Animate falling sparks & drifting smoke
        for (let i = 0; i < this.sparks.length; i++) {
            const s = this.sparks[i];
            s.x += s.vx;
            s.y += s.vy;
            if (s.y > 0.65 || s.x < 0 || s.x > 1) {
                s.x = Math.random();
                s.y = 0;
            }
        }
    }

    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        const bg = options.backgroundColor || '#080706';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Color palettes
        const palettes = {
            iron_amber: {
                main: '#ffaa44',
                soldier: '#ff7722',
                wire: '#d48833',
                tree: '#aa5522',
                ground: '#773311',
                sky: '#663311'
            },
            terminal_green: {
                main: '#55ff77',
                soldier: '#33ff55',
                wire: '#22bb44',
                tree: '#11aa33',
                ground: '#007722',
                sky: '#005511'
            },
            steel_cyan: {
                main: '#88ddff',
                soldier: '#55ccff',
                wire: '#3399cc',
                tree: '#2277aa',
                ground: '#114477',
                sky: '#002255'
            },
            monochrome: {
                main: '#e6e6e6',
                soldier: '#ffffff',
                wire: '#b3b3b3',
                tree: '#808080',
                ground: '#4d4d4d',
                sky: '#333333'
            }
        };

        const pal = palettes[options.colorPalette || this.params.colorPalette] || palettes.iron_amber;

        // Grid dimensions
        const charW = 7;
        const charH = 13;
        const cols = Math.floor(w / charW);
        const rows = Math.floor(h / charH);

        ctx.font = `${charH - 1}px "JetBrains Mono", "Courier New", monospace`;

        // 1. Render Sky Shell Sparks
        ctx.fillStyle = pal.main;
        this.sparks.forEach(sp => {
            const sc = Math.floor(sp.x * cols);
            const sr = Math.floor(sp.y * rows);
            ctx.fillText(sp.char, sc * charW, sr * charH);
        });

        // 2. Render Bare Shattered Trees (Left & Right Flanks)
        const treeLeft = [
            "       /\\       ",
            "      /  \\      ",
            "     / /\\ \\     ",
            "    | |  | |    ",
            "    | |  | |    ",
            "   / /  / /     ",
            "  /_/  /_/      "
        ];

        ctx.fillStyle = pal.tree;
        treeLeft.forEach((line, idx) => {
            ctx.fillText(line, 2 * charW, (rows - 20 + idx) * charH);
            ctx.fillText(line, (cols - 20) * charW, (rows - 22 + idx) * charH);
        });

        // 3. Render Barbed Wire Entanglements (Procedural Lines)
        ctx.fillStyle = pal.wire;
        const wireRow1 = rows - 14;
        const wireRow2 = rows - 8;

        for (let c = 0; c < cols; c++) {
            // Barbed wire pattern
            const animShift = Math.floor(this.time * 4 + c) % 8;
            const wChar1 = (c + animShift) % 6 === 0 ? '┿' : (c % 2 === 0 ? 'x' : '═');
            const wChar2 = (c - animShift) % 5 === 0 ? '╋' : (c % 3 === 0 ? '╱' : '─');

            ctx.fillText(wChar1, c * charW, wireRow1 * charH);
            ctx.fillText(wChar2, c * charW, wireRow2 * charH);
        }

        // 4. Render Soldier ASCII Model
        const soldierStartCol = Math.max(2, Math.floor((cols - 75) / 2));
        const soldierStartRow = Math.max(2, Math.floor((rows - SOLDIER_ASCII.length) / 2));

        // Pulsing breath tilt
        const breathY = Math.sin(this.time * 2) * 2;

        ctx.fillStyle = pal.soldier;
        SOLDIER_ASCII.forEach((line, idx) => {
            const py = (soldierStartRow + idx) * charH + breathY;
            ctx.fillText(line, soldierStartCol * charW, py);
        });

        // 5. Render Trench Sandbag Ground Base
        ctx.fillStyle = pal.ground;
        const groundRow = rows - 4;
        for (let r = groundRow; r < rows; r++) {
            let lineStr = "";
            for (let c = 0; c < cols; c++) {
                lineStr += (r % 2 === 0 ? "▓" : "█");
            }
            ctx.fillText(lineStr, 0, r * charH);
        }

        return true;
    }
}
