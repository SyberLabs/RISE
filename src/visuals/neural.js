/**
 * Neural Network Visualization Engine
 *
 * Procedurally generated neural network visualizations featuring:
 * - Layered node structures with varying densities
 * - Weighted connections with glow and opacity
 * - Animated "activation" pulses flowing through the network
 * - Color gradients representing information flow
 * - Multiple network topologies (feedforward, recurrent, attention)
 *
 * Designed for R.I.S.E. visual interlocution - subliminal flashes
 * of beautiful, contemplative network structures.
 */

export class NeuralNetwork {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;

        // Network structure
        this.nodes = [];
        this.connections = [];
        this.activations = [];

        // Color palettes - deep, contemplative tones
        this.palettes = {
            // Deep violet/blue - consciousness theme
            consciousness: {
                background: [12, 12, 18],
                nodeCore: [139, 127, 212],      // Threshold violet
                nodeGlow: [180, 170, 235],
                connectionBase: [80, 70, 140],
                activationPulse: [220, 210, 255],
                accent: [100, 180, 220]
            },
            // Electric blue/cyan - digital cognition
            digital: {
                background: [8, 12, 20],
                nodeCore: [60, 180, 220],
                nodeGlow: [120, 220, 255],
                connectionBase: [40, 100, 140],
                activationPulse: [180, 240, 255],
                accent: [255, 200, 100]
            },
            // Warm amber/gold - organic intelligence
            organic: {
                background: [18, 14, 10],
                nodeCore: [220, 160, 80],
                nodeGlow: [255, 200, 120],
                connectionBase: [140, 100, 50],
                activationPulse: [255, 230, 180],
                accent: [180, 120, 200]
            },
            // Emerald/teal - growth and learning
            growth: {
                background: [10, 18, 16],
                nodeCore: [80, 200, 160],
                nodeGlow: [140, 240, 200],
                connectionBase: [50, 120, 100],
                activationPulse: [200, 255, 220],
                accent: [200, 140, 220]
            },
            // Minimal grayscale with subtle color
            minimal: {
                background: [14, 14, 16],
                nodeCore: [180, 180, 190],
                nodeGlow: [220, 220, 230],
                connectionBase: [80, 80, 90],
                activationPulse: [255, 255, 255],
                accent: [139, 127, 212]
            }
        };

        // Network topology types
        this.topologies = ['feedforward', 'recurrent', 'attention', 'convolutional', 'sparse'];

        // Current state
        this.currentPalette = null;
        this.animationFrame = 0;
    }

    /**
     * Generate a random neural network visualization
     */
    generate() {
        if (!this.canvas || !this.ctx) return false;

        // Select random palette and topology
        const paletteKeys = Object.keys(this.palettes);
        const paletteKey = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
        this.currentPalette = this.palettes[paletteKey];

        const topology = this.topologies[Math.floor(Math.random() * this.topologies.length)];

        // Generate network structure
        this._generateNetwork(topology);

        // Generate activation states
        this._generateActivations();

        // Render the network
        this._render();

        return true;
    }

    /**
     * Generate network structure based on topology
     * @private
     */
    _generateNetwork(topology) {
        this.nodes = [];
        this.connections = [];

        const width = this.canvas.width;
        const height = this.canvas.height;
        // Larger padding to keep network centered when canvas is scaled with object-fit: cover
        const padding = Math.min(width, height) * 0.22;

        switch (topology) {
            case 'feedforward':
                this._generateFeedforward(width, height, padding);
                break;
            case 'recurrent':
                this._generateRecurrent(width, height, padding);
                break;
            case 'attention':
                this._generateAttention(width, height, padding);
                break;
            case 'convolutional':
                this._generateConvolutional(width, height, padding);
                break;
            case 'sparse':
                this._generateSparse(width, height, padding);
                break;
        }
    }

    /**
     * Generate feedforward network (classic layered structure)
     * @private
     */
    _generateFeedforward(width, height, padding) {
        const numLayers = 3 + Math.floor(Math.random() * 4); // 3-6 layers
        const layerSpacing = (width - 2 * padding) / (numLayers - 1);

        // Generate layer sizes (hourglass or expanding)
        const pattern = Math.random() < 0.5 ? 'hourglass' : 'expanding';
        const maxNodes = 6 + Math.floor(Math.random() * 6); // 6-11 max nodes per layer

        const layers = [];
        for (let i = 0; i < numLayers; i++) {
            let size;
            if (pattern === 'hourglass') {
                // Narrow in middle
                const mid = (numLayers - 1) / 2;
                const distFromMid = Math.abs(i - mid) / mid;
                size = Math.ceil(3 + (maxNodes - 3) * distFromMid);
            } else {
                // Gradually expand then contract
                const progress = i / (numLayers - 1);
                size = Math.ceil(3 + (maxNodes - 3) * Math.sin(progress * Math.PI));
            }
            layers.push(size);
        }

        // Create nodes
        const layerNodes = [];
        for (let l = 0; l < numLayers; l++) {
            const x = padding + l * layerSpacing;
            const nodeCount = layers[l];
            const nodeSpacing = (height - 2 * padding) / (nodeCount + 1);

            const currentLayer = [];
            for (let n = 0; n < nodeCount; n++) {
                const y = padding + (n + 1) * nodeSpacing;
                const node = {
                    x,
                    y,
                    radius: 4 + Math.random() * 4,
                    layer: l,
                    activation: Math.random(),
                    importance: 0.3 + Math.random() * 0.7
                };
                this.nodes.push(node);
                currentLayer.push(this.nodes.length - 1);
            }
            layerNodes.push(currentLayer);
        }

        // Create connections between adjacent layers
        for (let l = 0; l < numLayers - 1; l++) {
            const fromLayer = layerNodes[l];
            const toLayer = layerNodes[l + 1];

            for (const fromIdx of fromLayer) {
                // Connect to subset of next layer (not all-to-all for visual clarity)
                const connectionCount = Math.ceil(toLayer.length * (0.4 + Math.random() * 0.4));
                const shuffled = [...toLayer].sort(() => Math.random() - 0.5);

                for (let i = 0; i < connectionCount; i++) {
                    const toIdx = shuffled[i];
                    this.connections.push({
                        from: fromIdx,
                        to: toIdx,
                        weight: 0.2 + Math.random() * 0.8,
                        active: Math.random() > 0.3
                    });
                }
            }
        }
    }

    /**
     * Generate recurrent network (with loops back)
     * @private
     */
    _generateRecurrent(width, height, padding) {
        // Start with feedforward base
        this._generateFeedforward(width, height, padding);

        // Add recurrent connections (loops back to previous layers)
        const numRecurrent = 3 + Math.floor(Math.random() * 5);

        for (let i = 0; i < numRecurrent; i++) {
            const fromIdx = Math.floor(Math.random() * this.nodes.length);
            const toIdx = Math.floor(Math.random() * this.nodes.length);

            // Only add if going "backwards" (or same layer)
            if (this.nodes[fromIdx].layer >= this.nodes[toIdx].layer) {
                this.connections.push({
                    from: fromIdx,
                    to: toIdx,
                    weight: 0.3 + Math.random() * 0.5,
                    active: true,
                    recurrent: true
                });
            }
        }
    }

    /**
     * Generate attention-style network (all-to-all with varying weights)
     * @private
     */
    _generateAttention(width, height, padding) {
        const numNodes = 8 + Math.floor(Math.random() * 8); // 8-15 nodes
        const radius = Math.min(width, height) / 2 - padding * 1.5;
        const centerX = width / 2;
        const centerY = height / 2;

        // Arrange nodes in a circle or ellipse
        for (let i = 0; i < numNodes; i++) {
            const angle = (i / numNodes) * Math.PI * 2 - Math.PI / 2;
            const r = radius * (0.8 + Math.random() * 0.4);

            this.nodes.push({
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r,
                radius: 5 + Math.random() * 5,
                layer: 0,
                activation: Math.random(),
                importance: 0.4 + Math.random() * 0.6
            });
        }

        // Create attention connections (all-to-all with varying weights)
        for (let i = 0; i < numNodes; i++) {
            for (let j = 0; j < numNodes; j++) {
                if (i !== j && Math.random() > 0.4) {
                    this.connections.push({
                        from: i,
                        to: j,
                        weight: Math.random(),
                        active: Math.random() > 0.5,
                        attention: true
                    });
                }
            }
        }
    }

    /**
     * Generate convolutional-style grid pattern
     * @private
     */
    _generateConvolutional(width, height, padding) {
        const gridSize = 4 + Math.floor(Math.random() * 3); // 4x4 to 6x6
        const cellWidth = (width - 2 * padding) / gridSize;
        const cellHeight = (height - 2 * padding) / gridSize;

        // Create grid of nodes
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const x = padding + (col + 0.5) * cellWidth;
                const y = padding + (row + 0.5) * cellHeight;

                this.nodes.push({
                    x,
                    y,
                    radius: 6 + Math.random() * 4,
                    layer: row,
                    activation: Math.random(),
                    importance: 0.5 + Math.random() * 0.5
                });
            }
        }

        // Connect with kernel-like patterns (local connectivity)
        const kernelSize = 3;
        const halfKernel = Math.floor(kernelSize / 2);

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const fromIdx = row * gridSize + col;

                // Connect to neighbors within kernel
                for (let kr = -halfKernel; kr <= halfKernel; kr++) {
                    for (let kc = -halfKernel; kc <= halfKernel; kc++) {
                        if (kr === 0 && kc === 0) continue;

                        const toRow = row + kr;
                        const toCol = col + kc;

                        if (toRow >= 0 && toRow < gridSize && toCol >= 0 && toCol < gridSize) {
                            const toIdx = toRow * gridSize + toCol;

                            if (Math.random() > 0.3) {
                                this.connections.push({
                                    from: fromIdx,
                                    to: toIdx,
                                    weight: 0.3 + Math.random() * 0.7,
                                    active: Math.random() > 0.4
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Generate sparse random network
     * @private
     */
    _generateSparse(width, height, padding) {
        const numNodes = 15 + Math.floor(Math.random() * 15); // 15-29 nodes

        // Scatter nodes randomly
        for (let i = 0; i < numNodes; i++) {
            this.nodes.push({
                x: padding + Math.random() * (width - 2 * padding),
                y: padding + Math.random() * (height - 2 * padding),
                radius: 4 + Math.random() * 6,
                layer: Math.floor(Math.random() * 4),
                activation: Math.random(),
                importance: Math.random()
            });
        }

        // Create sparse connections based on distance
        for (let i = 0; i < numNodes; i++) {
            const connectionCount = 1 + Math.floor(Math.random() * 3);

            // Find nearest neighbors
            const distances = [];
            for (let j = 0; j < numNodes; j++) {
                if (i !== j) {
                    const dx = this.nodes[j].x - this.nodes[i].x;
                    const dy = this.nodes[j].y - this.nodes[i].y;
                    distances.push({ idx: j, dist: Math.sqrt(dx * dx + dy * dy) });
                }
            }
            distances.sort((a, b) => a.dist - b.dist);

            // Connect to nearest few
            for (let c = 0; c < Math.min(connectionCount, distances.length); c++) {
                if (Math.random() > 0.2) {
                    this.connections.push({
                        from: i,
                        to: distances[c].idx,
                        weight: 0.4 + Math.random() * 0.6,
                        active: Math.random() > 0.3
                    });
                }
            }
        }
    }

    /**
     * Generate activation pulse states
     * @private
     */
    _generateActivations() {
        this.activations = [];

        // Create several activation "pulses" traveling through connections
        const numPulses = 3 + Math.floor(Math.random() * 5);

        for (let i = 0; i < numPulses; i++) {
            if (this.connections.length > 0) {
                const connIdx = Math.floor(Math.random() * this.connections.length);
                this.activations.push({
                    connectionIndex: connIdx,
                    progress: Math.random(), // Position along the connection (0-1)
                    speed: 0.01 + Math.random() * 0.02,
                    intensity: 0.5 + Math.random() * 0.5
                });
            }
        }
    }

    /**
     * Render the neural network
     * @private
     */
    _render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const palette = this.currentPalette;

        // Clear with background
        ctx.fillStyle = `rgb(${palette.background.join(',')})`;
        ctx.fillRect(0, 0, width, height);

        // Add subtle vignette
        const gradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) * 0.7
        );
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw connections
        this._renderConnections(ctx, palette);

        // Draw activation pulses
        this._renderActivations(ctx, palette);

        // Draw nodes
        this._renderNodes(ctx, palette);
    }

    /**
     * Render network connections
     * @private
     */
    _renderConnections(ctx, palette) {
        ctx.lineCap = 'round';

        for (const conn of this.connections) {
            const fromNode = this.nodes[conn.from];
            const toNode = this.nodes[conn.to];

            const alpha = conn.active ? 0.15 + conn.weight * 0.35 : 0.05;

            // Bezier curve for organic feel
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;

            // Add some curve
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const perpX = -dy * 0.15 * (Math.random() - 0.5);
            const perpY = dx * 0.15 * (Math.random() - 0.5);

            const ctrlX = midX + perpX;
            const ctrlY = midY + perpY;

            // Connection line
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.quadraticCurveTo(ctrlX, ctrlY, toNode.x, toNode.y);

            const [r, g, b] = palette.connectionBase;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.lineWidth = 1 + conn.weight * 1.5;
            ctx.stroke();

            // Glow effect for active connections
            if (conn.active && conn.weight > 0.5) {
                ctx.strokeStyle = `rgba(${palette.nodeGlow.join(',')}, ${alpha * 0.3})`;
                ctx.lineWidth = 3 + conn.weight * 2;
                ctx.stroke();
            }
        }
    }

    /**
     * Render activation pulses
     * @private
     */
    _renderActivations(ctx, palette) {
        for (const pulse of this.activations) {
            const conn = this.connections[pulse.connectionIndex];
            if (!conn) continue;

            const fromNode = this.nodes[conn.from];
            const toNode = this.nodes[conn.to];

            // Calculate pulse position
            const t = pulse.progress;
            const x = fromNode.x + (toNode.x - fromNode.x) * t;
            const y = fromNode.y + (toNode.y - fromNode.y) * t;

            // Pulse glow
            const glowRadius = 8 + pulse.intensity * 12;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);

            const [pr, pg, pb] = palette.activationPulse;
            gradient.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${0.6 * pulse.intensity})`);
            gradient.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, ${0.2 * pulse.intensity})`);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Pulse core
            ctx.beginPath();
            ctx.arc(x, y, 2 + pulse.intensity * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * pulse.intensity})`;
            ctx.fill();
        }
    }

    /**
     * Render network nodes
     * @private
     */
    _renderNodes(ctx, palette) {
        for (const node of this.nodes) {
            const glowRadius = node.radius * 3;

            // Outer glow
            const gradient = ctx.createRadialGradient(
                node.x, node.y, node.radius * 0.5,
                node.x, node.y, glowRadius
            );

            const [gr, gg, gb] = palette.nodeGlow;
            const glowAlpha = 0.1 + node.importance * 0.2;
            gradient.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${glowAlpha})`);
            gradient.addColorStop(0.5, `rgba(${gr}, ${gg}, ${gb}, ${glowAlpha * 0.3})`);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Node body with radial gradient
            const bodyGradient = ctx.createRadialGradient(
                node.x - node.radius * 0.3, node.y - node.radius * 0.3, 0,
                node.x, node.y, node.radius
            );

            const [cr, cg, cb] = palette.nodeCore;
            const coreAlpha = 0.7 + node.activation * 0.3;
            bodyGradient.addColorStop(0, `rgba(${Math.min(255, cr + 60)}, ${Math.min(255, cg + 60)}, ${Math.min(255, cb + 60)}, ${coreAlpha})`);
            bodyGradient.addColorStop(0.7, `rgba(${cr}, ${cg}, ${cb}, ${coreAlpha})`);
            bodyGradient.addColorStop(1, `rgba(${cr * 0.7}, ${cg * 0.7}, ${cb * 0.7}, ${coreAlpha})`);

            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = bodyGradient;
            ctx.fill();

            // Subtle highlight
            if (node.importance > 0.6) {
                ctx.beginPath();
                ctx.arc(node.x - node.radius * 0.3, node.y - node.radius * 0.3, node.radius * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + node.importance * 0.15})`;
                ctx.fill();
            }
        }
    }

    /**
     * Get a pregenerated frame from a pool (similar to fractal.js pattern)
     * For now, just regenerate - can add pooling later if needed
     */
    getFrame() {
        this.generate();
        return this.canvas;
    }
}
