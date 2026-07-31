/**
 * PARADISE LOST — ENGINE 3: ST. MICHAEL'S FLAMING SWORD
 * (3D Detailed Sword & Faithful Latin Inscriptions Engine)
 * 
 * "Michael's sword nor stayed, nor stood, but with huge two-handed sway
 *  Brandished aloft the sword of God... given him tempered so,
 *  That neither keen nor solid might resist that edge." — John Milton, Paradise Lost (Book VI)
 * 
 * Visual Architecture:
 * 1. 3D Solid Shaded Sword Mesh: Octagonal pommel, wire-wrapped leather grip, intricate winged archangel crossguard quillons
 *    with central sapphire escutcheon & 3D pas-d'âne side rings, central fuller, and double-edged tapered steel blade.
 * 2. Faithful Inscriptions: Classical Latin & Biblical inscriptions etched vertically along the 3D blade fuller with sacred cross runes:
 *    - "✠ QUIS UT DEUS ✠" ("Who is like unto God?" — the literal Hebrew meaning of Mi-ka-el)
 *    - "✠ GLADIUS DEI ✠" ("Sword of God")
 *    - "✠ NON PRAEVALEBUNT ✠" ("They Shall Not Prevail")
 * 3. Divine Flaming Aura & Energy: 160+ rising incandescent flame ribbons, swirling golden embers,
 *    fuller energy channel pulse, and holy electric lightning crackles.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class ParadiseFlamingSwordEngine {
    constructor() {
        this.name = "St. Michael's Flaming Sword (3D Inscribed)";
        this.category = "DIMENSIONAL / SPATIAL";
        this.seed = "michael-sword-01";
        this.time = 0;

        // 3D Sword Mesh Vertices, Edges & Faces
        this.swordMesh = null;
        this.inscriptions = [
            { text: "✠  Q U I S   U T   D E U S  ✠", yPos: 0.28, size: 13 },
            { text: "✠  G L A D I U S   D E I  ✠", yPos: -0.12, size: 11 },
            { text: "✠  N O N   P R A E V A L E B U N T  ✠", yPos: -0.42, size: 10 }
        ];

        // Divine Flame Tendrils & Embers
        this.flames = [];
        this.embers = [];

        this.params = {
            rotSpeedYaw: 0.4,
            rotSpeedPitch: 0.15,
            flameIntensity: 1.0,
            bladeScale: 1.0,
            colorPalette: 'archangel_flame'
        };

        this._initSwordMesh();
    }

    _initSwordMesh() {
        const vertices = [];
        const edges = [];
        const faces = [];

        // 1. Pommel (Octagonal 3D ring at base with central jewel apex)
        const pommelRadius = 0.06;
        const pommelY = -0.85;
        const pommelStartIdx = vertices.length;

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            vertices.push([Math.cos(angle) * pommelRadius, pommelY, Math.sin(angle) * pommelRadius, 'pommel']);
            vertices.push([Math.cos(angle) * (pommelRadius * 0.7), pommelY - 0.05, Math.sin(angle) * (pommelRadius * 0.7), 'pommel']);
        }
        // Pommel bottom apex tip
        const pommelTipIdx = vertices.length;
        vertices.push([0.0, pommelY - 0.09, 0.0, 'pommelTip']);

        // Connect pommel edges & faces
        for (let i = 0; i < 8; i++) {
            const curr = pommelStartIdx + i * 2;
            const next = pommelStartIdx + ((i + 1) % 8) * 2;
            edges.push([curr, next, 'pommel']);
            edges.push([curr + 1, next + 1, 'pommel']);
            edges.push([curr, curr + 1, 'pommel']);
            edges.push([curr + 1, pommelTipIdx, 'pommel']);

            faces.push({ indices: [curr, next, next + 1, curr + 1], type: 'pommel' });
            faces.push({ indices: [curr + 1, next + 1, pommelTipIdx], type: 'pommel' });
        }

        // 2. Grip (Leather / Wire-Wrapped Cylinder)
        const gripRadius = 0.035;
        const gripBottomY = -0.85;
        const gripTopY = -0.55;
        const gripRings = 6;

        const gripStartIdx = vertices.length;
        for (let r = 0; r <= gripRings; r++) {
            const ry = gripBottomY + (r / gripRings) * (gripTopY - gripBottomY);
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                vertices.push([Math.cos(angle) * gripRadius, ry, Math.sin(angle) * gripRadius, 'grip']);
            }
        }

        for (let r = 0; r < gripRings; r++) {
            for (let i = 0; i < 6; i++) {
                const curr = gripStartIdx + r * 6 + i;
                const next = gripStartIdx + r * 6 + ((i + 1) % 6);
                const above = gripStartIdx + (r + 1) * 6 + i;
                const aboveNext = gripStartIdx + (r + 1) * 6 + ((i + 1) % 6);
                edges.push([curr, next, 'grip']);
                edges.push([curr, above, 'grip']);

                faces.push({ indices: [curr, next, aboveNext, above], type: 'grip' });
            }
        }

        // 3. INTRICATE ARCHANGEL WINGED CROSSGUARD & PAS-D'ÂNE RINGS
        const guardY = -0.55;
        const guardStartIdx = vertices.length;

        // A. Central Sacred Escutcheon Shield (Diamond Gem Hub)
        // 8 hub vertices forming a 3D faceted central shield
        vertices.push([-0.07, guardY - 0.04, 0.05, 'guardHub']); // 0: Front-Left-Bottom
        vertices.push([0.07, guardY - 0.04, 0.05, 'guardHub']);  // 1: Front-Right-Bottom
        vertices.push([0.07, guardY + 0.04, 0.05, 'guardHub']);  // 2: Front-Right-Top
        vertices.push([-0.07, guardY + 0.04, 0.05, 'guardHub']); // 3: Front-Left-Top

        vertices.push([-0.07, guardY - 0.04, -0.05, 'guardHub']); // 4: Back-Left-Bottom
        vertices.push([0.07, guardY - 0.04, -0.05, 'guardHub']);  // 5: Back-Right-Bottom
        vertices.push([0.07, guardY + 0.04, -0.05, 'guardHub']);  // 6: Back-Right-Top
        vertices.push([-0.07, guardY + 0.04, -0.05, 'guardHub']); // 7: Back-Left-Top

        // Mounted 3D Sapphire Gem Center Points
        const gemFrontIdx = vertices.length;
        vertices.push([0.0, guardY, 0.095, 'guardGem']);
        const gemBackIdx = vertices.length;
        vertices.push([0.0, guardY, -0.095, 'guardGem']);

        // Front Hub Faces (Faceted Gem Escutcheon)
        const h = guardStartIdx;
        faces.push({ indices: [h + 0, h + 1, gemFrontIdx], type: 'guardGem' });
        faces.push({ indices: [h + 1, h + 2, gemFrontIdx], type: 'guardGem' });
        faces.push({ indices: [h + 2, h + 3, gemFrontIdx], type: 'guardGem' });
        faces.push({ indices: [h + 3, h + 0, gemFrontIdx], type: 'guardGem' });

        // Back Hub Faces
        faces.push({ indices: [h + 5, h + 4, gemBackIdx], type: 'guardGem' });
        faces.push({ indices: [h + 6, h + 5, gemBackIdx], type: 'guardGem' });
        faces.push({ indices: [h + 7, h + 6, gemBackIdx], type: 'guardGem' });
        faces.push({ indices: [h + 4, h + 7, gemBackIdx], type: 'guardGem' });

        // Top & Bottom Hub Faces
        faces.push({ indices: [h + 3, h + 2, h + 6, h + 7], type: 'guard' });
        faces.push({ indices: [h + 4, h + 5, h + 1, h + 0], type: 'guard' });

        // B. Intricate Sweeping Archangel Feathered Wing Quillons (Left & Right Arms)
        const wingSegments = 6;
        const wingWidthMax = 0.52;

        const buildWingArm = (isRight) => {
            const side = isRight ? 1 : -1;
            const armStartIdx = vertices.length;

            for (let s = 0; s <= wingSegments; s++) {
                const p = s / wingSegments; // Progress along wing span (0..1)
                const wx = side * (0.07 + p * (wingWidthMax - 0.07));
                
                // Upward parabolic feather curve
                const wy = guardY + Math.pow(p, 1.6) * 0.18;
                
                // Flared wing width profile (widens near middle, tapers into sharp quillon tip)
                const height = 0.035 * (1 + Math.sin(p * Math.PI) * 0.9);
                const thickness = 0.045 * (1 - p * 0.6);

                // Feathered crest tip extension on upper ridge
                const crestY = wy + height + (p > 0.3 && p < 0.8 ? 0.03 : 0);

                // 4 vertices per wing section: [Top crest, Front, Bottom, Back]
                vertices.push([wx, crestY, 0.0, 'guardWing']);
                vertices.push([wx, wy, thickness, 'guardWing']);
                vertices.push([wx, wy - height, 0.0, 'guardWing']);
                vertices.push([wx, wy, -thickness, 'guardWing']);
            }

            // Connect wing segment quads
            for (let s = 0; s < wingSegments; s++) {
                const c0 = armStartIdx + s * 4;
                const a0 = armStartIdx + (s + 1) * 4;

                for (let i = 0; i < 4; i++) {
                    const curr = c0 + i;
                    const next = c0 + ((i + 1) % 4);
                    const above = a0 + i;
                    const aboveNext = a0 + ((i + 1) % 4);

                    edges.push([curr, next, 'guardWing']);
                    edges.push([curr, above, 'guardWing']);

                    faces.push({ indices: [curr, next, aboveNext, above], type: 'guard' });
                }
            }

            // Terminal Wingtip Quillon Tip
            const wingtipIdx = vertices.length;
            vertices.push([side * (wingWidthMax + 0.05), guardY + 0.22, 0.0, 'guardTip']);

            const lastSec = armStartIdx + wingSegments * 4;
            for (let i = 0; i < 4; i++) {
                const curr = lastSec + i;
                const next = lastSec + ((i + 1) % 4);
                edges.push([curr, wingtipIdx, 'guardTip']);
                faces.push({ indices: [curr, next, wingtipIdx], type: 'guard' });
            }
        };

        buildWingArm(true);  // Right Golden Wing Quillon
        buildWingArm(false); // Left Golden Wing Quillon

        // C. Pas-d'âne 3D Side Guard Loops (Front & Back Protection Rings around Ricasso)
        const buildPasDaneRing = (isFront) => {
            const zSign = isFront ? 1 : -1;
            const ringStartIdx = vertices.length;
            const ringPoints = 7;
            const radius = 0.095;

            for (let i = 0; i <= ringPoints; i++) {
                const angle = (i / ringPoints) * Math.PI; // Semi-circle loop
                const rx = Math.cos(angle) * radius;
                const ry = guardY + 0.02 + Math.sin(angle) * 0.08;
                const rz = zSign * (0.05 + Math.sin(angle) * 0.07);

                vertices.push([rx, ry, rz, 'pasDane']);
            }

            for (let i = 0; i < ringPoints; i++) {
                const curr = ringStartIdx + i;
                const next = ringStartIdx + i + 1;
                edges.push([curr, next, 'pasDane']);
            }
        };

        buildPasDaneRing(true);  // Front Side Guard Ring
        buildPasDaneRing(false); // Back Side Guard Ring

        // 4. Double-Edged Blade (Tapered 3D diamond profile with Fuller)
        const bladeStartIdx = vertices.length;
        const bladeBottomY = -0.52;
        const bladeTipY = 0.85;
        const bladeSegments = 12;

        for (let s = 0; s <= bladeSegments; s++) {
            const progress = s / bladeSegments;
            const by = bladeBottomY + progress * (bladeTipY - bladeBottomY);
            
            // Taper blade width towards tip
            const width = (1 - progress * 0.82) * 0.11;
            const thickness = (1 - progress * 0.85) * 0.03;

            // 4 vertices per cross section (Left edge, Front ridge, Right edge, Back ridge)
            vertices.push([-width, by, 0.0, 'bladeEdge']);
            vertices.push([0.0, by, thickness, 'bladeRidge']);
            vertices.push([width, by, 0.0, 'bladeEdge']);
            vertices.push([0.0, by, -thickness, 'bladeRidge']);
        }

        // Connect blade segments & build quad faces
        for (let s = 0; s < bladeSegments; s++) {
            const c0 = bladeStartIdx + s * 4;
            const a0 = bladeStartIdx + (s + 1) * 4;

            for (let i = 0; i < 4; i++) {
                const curr = c0 + i;
                const next = c0 + ((i + 1) % 4);
                const above = a0 + i;
                const aboveNext = a0 + ((i + 1) % 4);

                edges.push([curr, next, 'blade']);
                edges.push([curr, above, 'blade']);

                // 3D Blade Facets
                const facetType = (i === 0) ? 'bladeFrontLeft' : (i === 1) ? 'bladeFrontRight' : (i === 2) ? 'bladeBackRight' : 'bladeBackLeft';
                faces.push({ indices: [curr, next, aboveNext, above], type: facetType, segment: s });
            }
        }

        // Blade Tip Apex Point
        const tipIdx = vertices.length;
        vertices.push([0.0, bladeTipY + 0.08, 0.0, 'bladeTip']);

        const lastSegIdx = bladeStartIdx + bladeSegments * 4;
        for (let i = 0; i < 4; i++) {
            const curr = lastSegIdx + i;
            const next = lastSegIdx + ((i + 1) % 4);
            edges.push([curr, tipIdx, 'bladeTip']);

            const facetType = (i === 0) ? 'bladeFrontLeft' : (i === 1) ? 'bladeFrontRight' : (i === 2) ? 'bladeBackRight' : 'bladeBackLeft';
            faces.push({ indices: [curr, next, tipIdx], type: facetType, segment: bladeSegments });
        }

        this.swordMesh = { vertices, edges, faces };
    }

    generate(signal = {}, seed = 'sword-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        this.time = 0;

        // Build 160+ Rising Divine Flame Tendrils
        this.flames = [];
        const flameCount = 160;

        for (let i = 0; i < flameCount; i++) {
            const normY = -0.5 + rng() * 1.38;
            const side = (rng() > 0.5) ? 1 : -1;
            const width = (1 - (normY + 0.5) / 1.38 * 0.7) * 0.12;

            this.flames.push({
                x: side * width * (0.8 + rng() * 0.5),
                y: normY,
                z: (rng() - 0.5) * 0.06,
                vx: (rng() - 0.5) * 0.08,
                vy: 0.45 + rng() * 0.85,
                life: rng(),
                maxLife: 0.4 + rng() * 0.6,
                size: 3 + rng() * 7,
                temp: rng()
            });
        }

        // Swirling Golden Embers
        this.embers = [];
        for (let i = 0; i < 70; i++) {
            this.embers.push({
                x: (rng() - 0.5) * 0.6,
                y: -0.8 + rng() * 1.7,
                z: (rng() - 0.5) * 0.4,
                vy: 0.2 + rng() * 0.5,
                wobble: rng() * Math.PI * 2,
                size: 1 + rng() * 2.5,
                alpha: 0.3 + rng() * 0.7
            });
        }

        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt;

        // Update rising divine flames
        for (let i = 0; i < this.flames.length; i++) {
            const f = this.flames[i];
            f.life += dt;
            f.y += f.vy * dt;
            f.x += f.vx * dt + Math.sin(this.time * 4 + f.y * 10) * 0.012;

            if (f.life >= f.maxLife || f.y > 0.95) {
                f.life = 0;
                f.y = -0.5 + Math.random() * 0.3;
                f.x = (Math.random() > 0.5 ? 1 : -1) * (0.04 + Math.random() * 0.08);
                f.temp = Math.random();
            }
        }

        // Update swirling embers
        if (this.embers) {
            for (let i = 0; i < this.embers.length; i++) {
                const e = this.embers[i];
                e.y += e.vy * dt;
                e.wobble += dt * 3;
                e.x += Math.sin(e.wobble) * 0.003;
                if (e.y > 1.1) {
                    e.y = -0.85;
                    e.x = (Math.random() - 0.5) * 0.6;
                }
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

        if (!this.swordMesh) {
            this.generate({}, this.seed);
        }

        const cx = w / 2;
        const cy = h / 2;

        // 1. Cosmic Empyrean Abyss Background Gradient
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
        bgGrad.addColorStop(0, '#0d0f28');
        bgGrad.addColorStop(0.45, '#050614');
        bgGrad.addColorStop(1, '#010105');

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const scale = Math.min(w, h) * 0.48;

        // 3D Rotations (Yaw around Y, Pitch around X)
        const yaw = this.time * this.params.rotSpeedYaw;
        const pitch = Math.sin(this.time * 0.4) * this.params.rotSpeedPitch;

        const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
        const cosX = Math.cos(pitch), sinX = Math.sin(pitch);

        const project3D = (vx, vy, vz) => {
            // Y rotation
            let rx = vx * cosY + vz * sinY;
            let rz = -vx * sinY + vz * cosY;
            let ry = vy;

            // X rotation
            let ry2 = ry * cosX - rz * sinX;
            let rz2 = ry * sinX + rz * cosX;

            const pScale = 1 / (2.2 - rz2 * 0.4);
            const px = cx + rx * scale * pScale;
            const py = cy - ry2 * scale * pScale;

            return [px, py, pScale, rz2, rx, ry2];
        };

        // 2. Render SWIRLING GOLDEN ATMOSPHERIC EMBERS
        if (this.embers) {
            for (let i = 0; i < this.embers.length; i++) {
                const e = this.embers[i];
                const [px, py, pScale] = project3D(e.x, e.y, e.z);
                const eSize = Math.max(0.8, e.size * pScale);

                ctx.fillStyle = `rgba(255, 215, 100, ${e.alpha.toFixed(2)})`;
                ctx.beginPath();
                ctx.arc(px, py, eSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 3. Render RISING DIVINE FLAME RIBBONS & SPARKS
        for (let i = 0; i < this.flames.length; i++) {
            const f = this.flames[i];
            const [px, py, pScale] = project3D(f.x, f.y, f.z);
            const normLife = 1 - (f.life / f.maxLife);
            const alpha = (normLife * 0.85).toFixed(2);
            const fSize = Math.max(1.5, f.size * pScale);

            // Flame ribbon trail
            const tailLen = 0.12 + Math.random() * 0.08;
            const [tailX, tailY] = project3D(f.x - f.vx * tailLen, f.y - f.vy * tailLen, f.z);

            // Incandescent gradient along line path
            const grad = ctx.createLinearGradient(px, py, tailX, tailY);
            grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`); 

            if (f.temp > 0.7) {
                grad.addColorStop(0.4, `rgba(255, 230, 100, ${alpha})`);
                grad.addColorStop(1, `rgba(255, 120, 20, 0)`);
            } else if (f.temp > 0.35) {
                grad.addColorStop(0.4, `rgba(255, 140, 30, ${alpha})`);
                grad.addColorStop(1, `rgba(180, 40, 0, 0)`);
            } else {
                grad.addColorStop(0.4, `rgba(100, 200, 255, ${alpha})`);
                grad.addColorStop(1, `rgba(20, 60, 180, 0)`);
            }

            ctx.strokeStyle = grad;
            ctx.lineWidth = fSize;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(px, py);
            ctx.stroke();
        }

        // Project all 3D mesh vertices
        const rawVerts = this.swordMesh.vertices;
        const projVertices = rawVerts.map(v => project3D(v[0], v[1], v[2]));

        // 4. Render SHADED 3D POLYGON FACES (Back-to-front sorting)
        if (this.swordMesh.faces) {
            const sortedFaces = this.swordMesh.faces.map(f => {
                let avgZ = 0;
                f.indices.forEach(idx => { avgZ += projVertices[idx][3]; });
                avgZ /= f.indices.length;
                return { face: f, avgZ };
            }).sort((a, b) => a.avgZ - b.avgZ);

            sortedFaces.forEach(({ face }) => {
                const pts = face.indices.map(idx => projVertices[idx]);
                ctx.beginPath();
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (let k = 1; k < pts.length; k++) {
                    ctx.lineTo(pts[k][0], pts[k][1]);
                }
                ctx.closePath();

                // Compute normal facing direction for lighting
                const v0 = pts[0], v1 = pts[1], v2 = pts[2];
                const dx1 = v1[0] - v0[0], dy1 = v1[1] - v0[1];
                const dx2 = v2[0] - v0[0], dy2 = v2[1] - v0[1];
                const crossZ = dx1 * dy2 - dy1 * dx2;

                const lightFactor = Math.max(0.15, Math.min(1.0, 0.45 + (crossZ / (scale * 20)) * 0.55));

                if (face.type.startsWith('blade')) {
                    // Tempered steel with incandescent divine core glow
                    const isFront = face.type.includes('Front');
                    const fillAlpha = isFront ? 0.85 : 0.6;

                    if (isFront) {
                        const r = Math.round(200 + lightFactor * 55);
                        const g = Math.round(215 + lightFactor * 40);
                        const b = Math.round(245 + lightFactor * 10);
                        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha})`;
                    } else {
                        const r = Math.round(120 + lightFactor * 50);
                        const g = Math.round(130 + lightFactor * 50);
                        const b = Math.round(160 + lightFactor * 50);
                        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha})`;
                    }
                } else if (face.type === 'guardGem') {
                    // Sapphire Center Gem Facet
                    const r = Math.round(40 + lightFactor * 60);
                    const g = Math.round(180 + lightFactor * 75);
                    const b = Math.round(255);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
                } else if (face.type === 'guard' || face.type === 'pommel') {
                    // Imperial Gold shading
                    const r = Math.round(210 + lightFactor * 45);
                    const g = Math.round(165 + lightFactor * 40);
                    const b = Math.round(20 + lightFactor * 30);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
                } else if (face.type === 'grip') {
                    // Dark wire-wrapped leather
                    const r = Math.round(80 + lightFactor * 40);
                    const g = Math.round(60 + lightFactor * 30);
                    const b = Math.round(20 + lightFactor * 15);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
                } else {
                    ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
                }

                ctx.fill();
            });
        }

        // 5. Render 3D SWORD MESH EDGES (Wireframe Bevel Overlay)
        // Pass 1 - Wide Radiant Golden Aura Understroke
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
        ctx.lineWidth = 4.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();

        this.swordMesh.edges.forEach(([v1, v2, type]) => {
            const p1 = projVertices[v1];
            const p2 = projVertices[v2];
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
        });
        ctx.stroke();

        // Pass 2 - Sharp Core Edges
        this.swordMesh.edges.forEach(([v1, v2, type]) => {
            const p1 = projVertices[v1];
            const p2 = projVertices[v2];

            if (type === 'guard' || type === 'guardTip' || type === 'guardWing') {
                ctx.strokeStyle = '#ffd700'; // Imperial Gold
                ctx.lineWidth = 2.4;
            } else if (type === 'pasDane') {
                ctx.strokeStyle = '#ffb700'; // Side guard rings
                ctx.lineWidth = 1.8;
            } else if (type === 'pommel') {
                ctx.strokeStyle = '#ffcc00'; // Gold Pommel
                ctx.lineWidth = 2.0;
            } else if (type === 'grip') {
                ctx.strokeStyle = '#b8860b'; // Leather Grip
                ctx.lineWidth = 1.4;
            } else {
                ctx.strokeStyle = '#ffffff'; // Divine Tempered Steel Edge
                ctx.lineWidth = 1.8;
            }

            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.stroke();
        });

        // 6. PULSING FULLER DIVINE ENERGY CHANNEL
        const fullerPulsing = Math.sin(this.time * 5) * 0.5 + 0.5;
        const [fBottomX, fBottomY] = project3D(0.0, -0.50, 0.02);
        const [fTipX, fTipY] = project3D(0.0, 0.82, 0.02);

        const fullerGrad = ctx.createLinearGradient(fBottomX, fBottomY, fTipX, fTipY);
        fullerGrad.addColorStop(0, 'rgba(80, 200, 255, 0.8)');
        fullerGrad.addColorStop(0.5, `rgba(255, 235, 150, ${0.7 + fullerPulsing * 0.3})`);
        fullerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');

        ctx.strokeStyle = fullerGrad;
        ctx.lineWidth = 3.0;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(fBottomX, fBottomY);
        ctx.lineTo(fTipX, fTipY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 7. HOLY LIGHTNING ARCS ALONG BLADE & CROSSGUARD WINGS
        const arcCount = 5;
        ctx.strokeStyle = 'rgba(180, 230, 255, 0.95)';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#80e0ff';
        ctx.shadowBlur = 10;

        for (let a = 0; a < arcCount; a++) {
            const startY = -0.4 + ((this.time * 1.5 + a * 0.35) % 1.2);
            const [ax1, ay1] = project3D((Math.random() > 0.5 ? 1 : -1) * 0.05, startY, 0.02);
            const [ax2, ay2] = project3D((Math.random() > 0.5 ? 1 : -1) * 0.06, startY + 0.15, 0.02);

            const midX = (ax1 + ax2) / 2 + (Math.random() - 0.5) * 16;
            const midY = (ay1 + ay2) / 2 + (Math.random() - 0.5) * 16;

            ctx.beginPath();
            ctx.moveTo(ax1, ay1);
            ctx.lineTo(midX, midY);
            ctx.lineTo(ax2, ay2);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // 8. Render FAITHFUL LATIN INSCRIPTIONS along 3D Blade Fuller
        ctx.save();
        
        this.inscriptions.forEach((insc, idx) => {
            const [px, py, pScale, rz] = project3D(0.0, insc.yPos, 0.02);

            // Compute 3D rotation angle of blade at inscription point
            const [pTopX, pTopY] = project3D(0.0, insc.yPos + 0.1, 0.02);
            const angle = Math.atan2(pTopY - py, pTopX - px);

            ctx.save();
            ctx.translate(px, py);
            
            // Rotate string along the blade fuller length
            ctx.rotate(angle);

            // Scale font size by 3D depth scale
            const fontSize = Math.max(4, insc.size * pScale);
            ctx.font = `bold ${fontSize}px 'Cinzel', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Pulsing rune glow
            const runePulse = Math.sin(this.time * 4 + idx * 1.5) * 0.2 + 0.8;

            // Glow understroke
            ctx.fillStyle = `rgba(255, 215, 0, ${runePulse.toFixed(2)})`;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = parseFloat((14 * pScale * runePulse).toFixed(1));
            ctx.fillText(insc.text, 0, 0);

            // Sharp white-hot text core
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.fillText(insc.text, 0, 0);

            ctx.restore();
        });
        ctx.restore();

        // 9. Central Sapphire Core Starburst Bloom at Hilt Center
        const guardCenterY = -0.55;
        const [hiltX, hiltY] = project3D(0.0, guardCenterY, 0.0);
        const starGrad = ctx.createRadialGradient(hiltX, hiltY, 0, hiltX, hiltY, scale * 0.22);
        starGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        starGrad.addColorStop(0.25, 'rgba(100, 220, 255, 0.9)');
        starGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = starGrad;
        ctx.beginPath();
        ctx.arc(hiltX, hiltY, scale * 0.22, 0, Math.PI * 2);
        ctx.fill();

        return true;
    }
}
