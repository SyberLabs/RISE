/**
 * R.I.S.E. Audio Engine
 * Web Audio API integration for ambient soundscapes and entrainment
 * 
 * Phase 3 Enhancements:
 * - 432Hz carrier option
 * - Harmonic overtones
 * - Pink noise layer 
 * - Solfeggio frequency presets
 * - Layer system with independent controls
 * - Layer presets (Focus, Deep, Drift, Gateway)
 */

/**
 * Entrainment frequency targets (Hz)
 */
export const BRAINWAVE_BANDS = {
    delta: { min: 0.5, max: 4, default: 2, description: 'Deep sleep, healing' },
    theta: { min: 4, max: 8, default: 6, description: 'Hypnagogic, deep meditation' },
    alpha: { min: 8, max: 14, default: 10, description: 'Relaxed, receptive' },
    beta: { min: 14, max: 30, default: 18, description: 'Alert, focused' },
    gamma: { min: 30, max: 100, default: 40, description: 'Peak awareness, insight' }
};

/**
 * Solfeggio frequencies (Hz) - ancient healing tones
 */
export const SOLFEGGIO_FREQUENCIES = {
    ut: { freq: 396, description: 'Liberating guilt and fear' },
    re: { freq: 417, description: 'Undoing situations, facilitating change' },
    mi: { freq: 528, description: 'Transformation, miracles, DNA repair' },
    fa: { freq: 639, description: 'Connecting, relationships' },
    sol: { freq: 741, description: 'Awakening intuition' },
    la: { freq: 852, description: 'Returning to spiritual order' }
};

/**
 * Carrier frequency options
 */
export const CARRIER_TUNINGS = {
    standard: 200,    // Original R.I.S.E. default
    concert: 220,     // A3 in standard tuning
    verdi: 216,       // A3 in 432Hz tuning (432/2)
    sacred: 432       // Full 432Hz
};

/**
 * Layer presets for different session types
 */
export const LAYER_PRESETS = {
    focus: {
        name: 'Focus',
        description: 'Clear concentration',
        binaural: { enabled: true, band: 'alpha', volume: 0.25 },
        harmonics: { enabled: true, volume: 0.15 },
        noise: { enabled: false, volume: 0 },
        drone: { enabled: false, volume: 0 }
    },
    deep: {
        name: 'Deep',
        description: 'Hypnagogic descent',
        binaural: { enabled: true, band: 'theta', volume: 0.3 },
        harmonics: { enabled: true, volume: 0.2 },
        noise: { enabled: true, volume: 0.08 },
        drone: { enabled: true, volume: 0.15 }
    },
    drift: {
        name: 'Drift',
        description: 'Ambient dissolution',
        binaural: { enabled: true, band: 'delta', volume: 0.2 },
        harmonics: { enabled: true, volume: 0.25 },
        noise: { enabled: true, volume: 0.12 },
        drone: { enabled: true, volume: 0.2 }
    },
    gateway: {
        name: 'Gateway',
        description: 'Hemi-sync inspired layering',
        binaural: { enabled: true, band: 'theta', volume: 0.35 },
        harmonics: { enabled: true, volume: 0.15 },
        noise: { enabled: true, volume: 0.1 },
        drone: { enabled: true, volume: 0.18 }
    },
    silent: {
        name: 'Silent',
        description: 'No audio',
        binaural: { enabled: false, volume: 0 },
        harmonics: { enabled: false, volume: 0 },
        noise: { enabled: false, volume: 0 },
        drone: { enabled: false, volume: 0 }
    }
};

import { PersonalSwells } from '../core/personal-swells.js';
import { createSoundscape } from './soundscapes.js';


/**
 * Audio Engine for R.I.S.E.
 * Handles ambient audio, binaural beats, and synchronized triggers
 */
export class AudioEngine {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.isInitialized = false;
        this.initPromise = null;
        this.isPlaying = false;

        // Layer nodes
        this.layers = {
            binaural: null,
            harmonics: null,
            noise: null,
            drone: null,
            ambient: null,
            typing: null,
            ui: null,
            swell: null,
            soundscape: null
        };

        // Layer gains
        this.layerGains = {
            binaural: null,
            harmonics: null,
            noise: null,
            drone: null,
            ambient: null,
            typing: null,
            ui: null,
            swell: null,
            soundscape: null
        };

        this.buffers = {
            typing: null,
            typingConfig: null,
            ui: {
                click: null,
                hiss: null
            },
            drones: [],
            swells: [],
            personalSwells: []
        };

        this.personalPool = null;

        // Configuration
        this.config = {
            masterVolume: 0.7,
            carrierTuning: 'sacred',  // Default to 432Hz
            binauralBeatFreq: 6,      // Theta
            fadeTime: 2.0,            // seconds
            entrainmentMode: 'binaural',  // binaural | monaural | isochronic | spatial
            entrainmentWaveform: 'sine',  // sine | triangle | sawtooth
            entrainmentSpatial: false,
            entrainmentSpatialRate: 0.02,   // rotations per second
            entrainmentSpatialRadius: 1.2,  // meters
            isochronicDepth: 1.0,           // 0-1, pulse depth

            // Layer volumes (0-1)
            layerVolumes: {
                binaural: 0.3,
                harmonics: 0.15,
                noise: 0.1,
                drone: 0.2,
                ambient: 0.5,
                typing: 0.6,
                ui: 0.5,
                swell: 0.4,
                soundscape: 0.85
            },

            // Asset paths
            paths: {
                typingConfig: '/audio/typing-config.json',
                typingSprite: '/audio/typing-sprite.ogg',
                click: '/audio/click.wav',
                hiss: '/audio/hiss.wav',
                drones: [
                    // MP3 at 128k: universal decodeAudioData support (incl.
                    // Safari), ~92% smaller than the original WAVs
                    '/audio/stasis_draken.mp3',
                    '/audio/cosmos_pointpark.mp3',
                    '/audio/nox_drone.mp3'
                ],
                swells: [
                    '/audio/swells/hq_resonate_01.mp3',
                    '/audio/swells/hq_transcend_01.mp3'
                ]
            }
        };

        // Current state
        this.currentPreset = null;
        this.currentBand = 'theta';

        // Voice synthesis (TTS)
        this.voiceEnabled = false;
        this.voiceSynth = window.speechSynthesis || null;
        this.selectedVoice = null;
        this.currentUtterance = null;
        this.voiceRate = 0.9;  // Slightly slower for hypnotic effect
        this.voicePitch = 1.0;
        this.voiceVolume = 0.8;

        // Conflict Management
        this.ambienceActive = false;
        this.sessionActive = false;

        // Spatial motion timer
        this._spatialInterval = null;
        this._isFading = false;
        this.fadeTimeoutId = null;
        this._fadeResolve = null;
        this._sessionStopTimer = null;
        this._sessionStopResolve = null;
        this._sessionGeneration = 0;
        this._destroyed = false;
    }

    /**
     * Initialize the audio context (must be called after user interaction)
     */
    async init() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            if (this.isInitialized) return;

            try {
                this.context = new (window.AudioContext || window.webkitAudioContext)();

                // Create master gain
                this.masterGain = this.context.createGain();
                this.masterGain.gain.value = this.config.masterVolume;
                this.masterGain.connect(this.context.destination);

                // Create layer gain nodes
                for (const layer of Object.keys(this.layerGains)) {
                    if (!this.layerGains[layer]) {
                        this.layerGains[layer] = this.context.createGain();
                        this.layerGains[layer].gain.value = 0;
                        this.layerGains[layer].connect(this.masterGain);
                    }
                }

                await this.loadAssets();

                this.isInitialized = true;
                console.log('[AudioEngine] Initialized with 432Hz support');
            } catch (error) {
                console.error('[AudioEngine] Failed to initialize:', error);
                this.initPromise = null;
                this.context = null;
                this.masterGain = null;
                this.isInitialized = false;
                if (window.rise && typeof window.rise.showToast === 'function') {
                    window.rise.showToast('Audio initialization blocked. Interact to enable.', 4000);
                }
                throw error;
            }
        })();

        return this.initPromise;
    }

    /**
     * Resume audio context if suspended
     */
    async resume() {
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    /**
     * Get carrier frequency based on current tuning
     */
    getCarrierFrequency() {
        return CARRIER_TUNINGS[this.config.carrierTuning] || 432;
    }

    /**
     * Set carrier tuning
     * @param {'standard' | 'concert' | 'verdi' | 'sacred'} tuning
     */
    setCarrierTuning(tuning) {
        if (CARRIER_TUNINGS[tuning]) {
            this.config.carrierTuning = tuning;
            console.log(`[AudioEngine] Carrier tuning: ${tuning} (${CARRIER_TUNINGS[tuning]}Hz)`);

            // Restart entrainment if playing
            if (this.layers.binaural) {
                this.startEntrainment(this.config.binauralBeatFreq, {
                    mode: this.config.entrainmentMode,
                    waveform: this.config.entrainmentWaveform,
                    spatial: this.config.entrainmentSpatial,
                    spatialRate: this.config.entrainmentSpatialRate,
                    spatialRadius: this.config.entrainmentSpatialRadius
                });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER: BINAURAL BEATS
    // ═══════════════════════════════════════════════════════════

    /**
     * Update entrainment configuration
     * @param {Object} config
     */
    setEntrainmentConfig(config = {}) {
        if (config.mode) {
            this.config.entrainmentMode = config.mode;
        }

        if (config.waveform) {
            const allowed = ['sine', 'triangle', 'sawtooth'];
            if (allowed.includes(config.waveform)) {
                this.config.entrainmentWaveform = config.waveform;
            }
        }

        if (typeof config.spatial === 'boolean') {
            this.config.entrainmentSpatial = config.spatial;
        }

        if (typeof config.spatialRate === 'number' && config.spatialRate > 0) {
            this.config.entrainmentSpatialRate = config.spatialRate;
        }

        if (typeof config.spatialRadius === 'number' && config.spatialRadius > 0) {
            this.config.entrainmentSpatialRadius = config.spatialRadius;
        }

        if (typeof config.isochronicDepth === 'number') {
            this.config.isochronicDepth = Math.max(0, Math.min(1, config.isochronicDepth));
        }

        if (this.layers.binaural) {
            this.startEntrainment(this.config.binauralBeatFreq, {
                mode: this.config.entrainmentMode,
                waveform: this.config.entrainmentWaveform,
                spatial: this.config.entrainmentSpatial,
                spatialRate: this.config.entrainmentSpatialRate,
                spatialRadius: this.config.entrainmentSpatialRadius
            });
        }
    }

    _clearSpatialRotation() {
        if (this._spatialInterval) {
            clearInterval(this._spatialInterval);
            this._spatialInterval = null;
        }
    }

    _startSpatialRotation(panner, rate, radius) {
        this._clearSpatialRotation();

        const start = performance.now();
        const update = () => {
            const now = this.context.currentTime;
            const elapsed = (performance.now() - start) / 1000;
            const angle = elapsed * Math.PI * 2 * rate;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            panner.positionX.setValueAtTime(x, now);
            panner.positionY.setValueAtTime(0, now);
            panner.positionZ.setValueAtTime(z, now);
        };

        update();
        this._spatialInterval = setInterval(update, 60);
    }

    /**
     * Start entrainment generator
     * @param {number} beatFrequency - Desired beat frequency in Hz
     * @param {Object} options
     */
    startEntrainment(beatFrequency = 6, options = {}) {
        if (!this.isInitialized) {
            console.warn('[AudioEngine] Not initialized');
            return;
        }

        this.stopEntrainment();

        const requestedMode = options.mode || this.config.entrainmentMode || 'binaural';
        const mode = requestedMode === 'spatial' ? 'monaural' : requestedMode;
        const waveform = options.waveform || this.config.entrainmentWaveform || 'sine';
        const spatialEnabled = requestedMode === 'spatial' || options.spatial === true || this.config.entrainmentSpatial === true;
        const spatialRate = options.spatialRate || this.config.entrainmentSpatialRate;
        const spatialRadius = options.spatialRadius || this.config.entrainmentSpatialRadius;
        const depth = typeof options.isochronicDepth === 'number' ? options.isochronicDepth : this.config.isochronicDepth;

        const oscType = ['sine', 'triangle', 'sawtooth'].includes(waveform) ? waveform : 'sine';

        this.config.binauralBeatFreq = beatFrequency;
        this.config.entrainmentMode = requestedMode;
        this.config.entrainmentWaveform = oscType;

        const baseFrequency = this.getCarrierFrequency();

        const layer = {
            mode: requestedMode,
            oscillators: [],
            leftOsc: null,
            rightOsc: null,
            lfo: null,
            lfoOffset: null,
            mixGain: null,
            pulseGain: null,
            panner: null
        };

        if (mode === 'binaural') {
            const leftOsc = this.context.createOscillator();
            const rightOsc = this.context.createOscillator();

            leftOsc.frequency.value = baseFrequency;
            rightOsc.frequency.value = baseFrequency + beatFrequency;

            leftOsc.type = oscType;
            rightOsc.type = oscType;

            const leftPan = this.context.createStereoPanner();
            const rightPan = this.context.createStereoPanner();

            leftPan.pan.value = -1;
            rightPan.pan.value = 1;

            leftOsc.connect(leftPan);
            rightOsc.connect(rightPan);
            leftPan.connect(this.layerGains.binaural);
            rightPan.connect(this.layerGains.binaural);

            leftOsc.start();
            rightOsc.start();

            layer.leftOsc = leftOsc;
            layer.rightOsc = rightOsc;
            layer.oscillators = [leftOsc, rightOsc];
        } else if (mode === 'monaural') {
            const leftOsc = this.context.createOscillator();
            const rightOsc = this.context.createOscillator();

            leftOsc.frequency.value = baseFrequency;
            rightOsc.frequency.value = baseFrequency + beatFrequency;

            leftOsc.type = oscType;
            rightOsc.type = oscType;

            const mixGain = this.context.createGain();
            leftOsc.connect(mixGain);
            rightOsc.connect(mixGain);

            if (spatialEnabled) {
                const panner = this.context.createPanner();
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'inverse';
                panner.refDistance = 1;
                panner.maxDistance = 10;
                panner.rolloffFactor = 1;
                panner.coneInnerAngle = 360;
                panner.coneOuterAngle = 0;
                panner.coneOuterGain = 0;

                mixGain.connect(panner);
                panner.connect(this.layerGains.binaural);
                this._startSpatialRotation(panner, spatialRate, spatialRadius);
                layer.panner = panner;
            } else {
                mixGain.connect(this.layerGains.binaural);
            }

            leftOsc.start();
            rightOsc.start();

            layer.leftOsc = leftOsc;
            layer.rightOsc = rightOsc;
            layer.oscillators = [leftOsc, rightOsc];
            layer.mixGain = mixGain;
        } else if (mode === 'isochronic') {
            const carrier = this.context.createOscillator();
            carrier.frequency.value = baseFrequency;
            carrier.type = oscType;

            const pulseGain = this.context.createGain();
            pulseGain.gain.value = 0;

            if (spatialEnabled) {
                const panner = this.context.createPanner();
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'inverse';
                panner.refDistance = 1;
                panner.maxDistance = 10;
                panner.rolloffFactor = 1;
                panner.coneInnerAngle = 360;
                panner.coneOuterAngle = 0;
                panner.coneOuterGain = 0;

                pulseGain.connect(panner);
                panner.connect(this.layerGains.binaural);
                this._startSpatialRotation(panner, spatialRate, spatialRadius);
                layer.panner = panner;
            } else {
                pulseGain.connect(this.layerGains.binaural);
            }

            const lfo = this.context.createOscillator();
            lfo.type = 'square';
            lfo.frequency.value = beatFrequency;

            const lfoGain = this.context.createGain();
            const depthClamped = Math.max(0, Math.min(1, depth));
            lfoGain.gain.value = 0.5 * depthClamped;

            const lfoOffset = this.context.createConstantSource();
            lfoOffset.offset.value = 1 - (0.5 * depthClamped);

            lfo.connect(lfoGain);
            lfoGain.connect(pulseGain.gain);
            lfoOffset.connect(pulseGain.gain);

            carrier.connect(pulseGain);

            carrier.start();
            lfo.start();
            lfoOffset.start();

            layer.oscillators = [carrier];
            layer.lfo = lfo;
            layer.lfoOffset = lfoOffset;
            layer.pulseGain = pulseGain;
        }

        this.layers.binaural = layer;

        this.setLayerVolume('binaural', this.config.layerVolumes.binaural, true);

        const modeLabel = requestedMode === 'spatial' ? 'spatial' : mode;
        console.log('[AudioEngine] Entrainment: ' + modeLabel + ' ' + beatFrequency + 'Hz beat @ ' + baseFrequency + 'Hz carrier');
    }

    /**
     * Start binaural beat generator
     * @param {number} beatFrequency - Desired beat frequency in Hz
     */
    startBinaural(beatFrequency = 6) {
        this.startEntrainment(beatFrequency, { mode: 'binaural' });
    }

    /**
     * Stop entrainment generator
     */
    stopEntrainment(instant = false) {
        if (this.layers.binaural) {
            const layer = this.layers.binaural;
            const fadeTime = instant ? 0 : this.config.fadeTime;

            this.setLayerVolume('binaural', 0, !instant);
            this._clearSpatialRotation();

            if (instant) {
                try {
                    if (layer.oscillators) layer.oscillators.forEach(osc => osc.stop());
                    if (layer.lfo) layer.lfo.stop();
                    if (layer.lfoOffset) layer.lfoOffset.stop();
                } catch (e) { }
                this.layers.binaural = null;
            } else {
                setTimeout(() => {
                    try {
                        if (layer.oscillators) layer.oscillators.forEach(osc => osc.stop());
                        if (layer.lfo) layer.lfo.stop();
                        if (layer.lfoOffset) layer.lfoOffset.stop();
                    } catch (e) { }
                    this.layers.binaural = null;
                }, fadeTime * 1000);
            }
        }
    }

    /**
     * Stop binaural beat generator
     */
    stopBinaural(instant = false) {
        this.stopEntrainment(instant);
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER: HARMONIC OVERTONES
    // LAYER: HARMONIC OVERTONES
    // ═══════════════════════════════════════════════════════════

    /**
     * Start harmonic overtone layer
     * Adds subtle upper partials to create richness
     */
    startHarmonics() {
        if (!this.isInitialized) return;
        this.stopHarmonics();

        const baseFreq = this.getCarrierFrequency();
        const oscillators = [];

        // Create harmonic series (fundamental + partials)
        const harmonicRatios = [1, 2, 3, 4, 5];
        const harmonicAmplitudes = [0.5, 0.25, 0.125, 0.0625, 0.03125];

        for (let i = 0; i < harmonicRatios.length; i++) {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.frequency.value = baseFreq * harmonicRatios[i];
            osc.type = 'sine';

            gain.gain.value = harmonicAmplitudes[i];

            osc.connect(gain);
            gain.connect(this.layerGains.harmonics);
            osc.start();

            oscillators.push({ osc, gain });
        }

        this.layers.harmonics = oscillators;
        this.setLayerVolume('harmonics', this.config.layerVolumes.harmonics, true);

        console.log(`[AudioEngine] Harmonics: ${harmonicRatios.length} partials @ ${baseFreq}Hz fundamental`);
    }

    /**
     * Stop harmonic overtones
     */
    stopHarmonics(instant = false) {
        if (this.layers.harmonics) {
            const layers = this.layers.harmonics;
            const fadeTime = instant ? 0 : this.config.fadeTime;

            this.setLayerVolume('harmonics', 0, !instant);

            if (instant) {
                try {
                    layers.forEach(({ osc }) => osc.stop());
                } catch (e) { }
                this.layers.harmonics = null;
            } else {
                setTimeout(() => {
                    try {
                        layers.forEach(({ osc }) => osc.stop());
                    } catch (e) { }
                    this.layers.harmonics = null;
                }, fadeTime * 1000);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER: PINK NOISE
    // ═══════════════════════════════════════════════════════════

    /**
     * Start pink noise layer
     * Pink noise has equal energy per octave (1/f spectrum)
     */
    startNoise() {
        if (!this.isInitialized) return;
        this.stopNoise();

        // Create pink noise using filtered white noise
        const bufferSize = 2 * this.context.sampleRate;
        const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        // Paul Kellet's refined pink noise algorithm
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;

            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;

            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }

        const noiseSource = this.context.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        noiseSource.connect(this.layerGains.noise);
        noiseSource.start();

        this.layers.noise = noiseSource;
        this.setLayerVolume('noise', this.config.layerVolumes.noise, true);

        console.log('[AudioEngine] Pink noise started');
    }

    /**
     * Stop pink noise
     */
    stopNoise(instant = false) {
        if (this.layers.noise) {
            const source = this.layers.noise;
            const fadeTime = instant ? 0 : this.config.fadeTime;

            this.setLayerVolume('noise', 0, !instant);

            if (instant) {
                try { source.stop(); } catch (e) { }
                this.layers.noise = null;
            } else {
                setTimeout(() => {
                    try { source.stop(); } catch (e) { }
                    this.layers.noise = null;
                }, fadeTime * 1000);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER: DRONE (432Hz or Solfeggio)
    // ═══════════════════════════════════════════════════════════

    /**
     * Start drone layer
     * @param {number} frequency - Drone frequency in Hz (default: carrier frequency)
     */
    startDrone(frequency = null) {
        if (!this.isInitialized) return;
        this.stopDrone();

        const droneFreq = frequency || this.getCarrierFrequency();

        const osc = this.context.createOscillator();
        osc.frequency.value = droneFreq;
        osc.type = 'sine';

        // Add subtle detuned oscillator for richness
        const osc2 = this.context.createOscillator();
        osc2.frequency.value = droneFreq * 1.002; // Slight detune
        osc2.type = 'sine';

        const osc2Gain = this.context.createGain();
        osc2Gain.gain.value = 0.5;

        osc.connect(this.layerGains.drone);
        osc2.connect(osc2Gain);
        osc2Gain.connect(this.layerGains.drone);

        osc.start();
        osc2.start();

        this.layers.drone = { main: osc, detune: osc2, detuneGain: osc2Gain };
        this.setLayerVolume('drone', this.config.layerVolumes.drone, true);

        console.log(`[AudioEngine] Drone: ${droneFreq}Hz`);
    }

    /**
     * Start drone with solfeggio frequency
     * @param {'ut' | 're' | 'mi' | 'fa' | 'sol' | 'la'} solfeggio
     */
    startSolfeggioDrone(solfeggio) {
        const info = SOLFEGGIO_FREQUENCIES[solfeggio];
        if (info) {
            this.startDrone(info.freq);
            console.log(`[AudioEngine] Solfeggio ${solfeggio.toUpperCase()}: ${info.freq}Hz - ${info.description}`);
        }
    }

    /**
     * Stop drone
     */
    stopDrone(instant = false) {
        if (this.layers.drone) {
            const drone = this.layers.drone;
            const fadeTime = instant ? 0 : this.config.fadeTime;

            this.setLayerVolume('drone', 0, !instant);

            if (instant) {
                try {
                    drone.main.stop();
                    drone.detune.stop();
                } catch (e) { }
                this.layers.drone = null;
            } else {
                setTimeout(() => {
                    try {
                        drone.main.stop();
                        drone.detune.stop();
                    } catch (e) { }
                    this.layers.drone = null;
                }, fadeTime * 1000);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER: SOUNDSCAPE (Living Compositions)
    // ═══════════════════════════════════════════════════════════

    /**
     * Start a soundscape — a composed, self-evolving piece (see
     * soundscapes.js). Runs alongside the pure-tone layers.
     * @param {string} id - e.g. 'aurora'
     */
    startSoundscape(id) {
        if (!this.isInitialized) return;
        this.stopSoundscape(true);

        const handle = createSoundscape(id, this.context, this.layerGains.soundscape);
        if (!handle) {
            console.warn('[AudioEngine] Unknown soundscape:', id);
            return;
        }

        handle.start();
        this.layers.soundscape = handle;
        this.setLayerVolume('soundscape', this.config.layerVolumes.soundscape, true);

        console.log(`[AudioEngine] Soundscape: ${id}`);
    }

    /**
     * Stop the active soundscape. The handle ramps its own voices out;
     * the layer gain fade covers the same window.
     */
    stopSoundscape(instant = false) {
        if (this.layers.soundscape) {
            const handle = this.layers.soundscape;
            this.layers.soundscape = null;
            // Muting a live node is transport state, not a user mix change.
            // setLayerVolume() also stores its value, so preserve the desired
            // level or the next soundscape session will start at zero gain.
            const configuredVolume = this.config.layerVolumes.soundscape;
            this.setLayerVolume('soundscape', 0, !instant);
            this.config.layerVolumes.soundscape = configuredVolume;
            handle.stop(instant);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER: AMBIENT (External Audio)
    // ═══════════════════════════════════════════════════════════

    /**
     * Load and play ambient audio file
     * @param {string} url - URL or path to audio file
     */
    async playAmbient(url) {
        if (!this.isInitialized) await this.init();
        await this.resume();

        this.stopAmbient();

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

            const source = this.context.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;
            source.connect(this.layerGains.ambient);
            source.start();

            this.layers.ambient = source;
            this.setLayerVolume('ambient', this.config.layerVolumes.ambient, true);

            console.log('[AudioEngine] Ambient playing:', url);
        } catch (error) {
            console.error('[AudioEngine] Failed to load ambient:', error);
        }
    }

    /**
     * Stop ambient audio
     */
    stopAmbient(instant = false) {
        this.ambienceActive = false;
        if (this.layers.ambient) {
            const oldSource = this.layers.ambient;
            this.layers.ambient = null;
            const fadeTime = instant ? 0 : this.config.fadeTime;
            const previousVolume = this.config.layerVolumes.ambient;

            if (this.layerGains.ambient) {
                this.layerGains.ambient.gain.cancelScheduledValues(this.context.currentTime);
                if (instant) {
                    this.layerGains.ambient.gain.setValueAtTime(0, this.context.currentTime);
                } else {
                    this.layerGains.ambient.gain.linearRampToValueAtTime(
                        0,
                        this.context.currentTime + fadeTime
                    );
                }
            }

            if (instant) {
                try { oldSource.stop(); } catch (e) { }
            } else {
                setTimeout(() => {
                    try {
                        oldSource.stop();
                    } catch (e) {
                        /* ignore InvalidStateError */
                    }
                }, fadeTime * 1000);
            }

            this.config.layerVolumes.ambient = previousVolume;
        }
    }

    // ═══════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════
    // ASSET LOADING & HIGH-FIDELITY METHODS
    // ═══════════════════════════════════════════════════════════

    /**
     * Load sound assets for mechanical typing and UI
     */
    async loadAssets() {
        console.log('[AudioEngine] Loading high-fidelity assets...');

        const loadBuffer = async (url) => {
            if (!url) return null;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('[AudioEngine] Asset not found: ' + url);
                    return null;
                }

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    console.warn('[AudioEngine] Expected audio but got HTML for: ' + url);
                    return null;
                }

                const arrayBuffer = await response.arrayBuffer();
                return await this.context.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.error('[AudioEngine] Failed to load buffer: ' + url, e);
                return null;
            }
        };

        try {
            const configResp = await fetch(this.config.paths.typingConfig);
            if (configResp.ok) {
                this.buffers.typingConfig = await configResp.json();
            }
        } catch (e) {
            console.error('[AudioEngine] Failed to load typing config', e);
        }

        const [typingBuffer, clickBuffer, hissBuffer, droneBuffers, swellBuffers] = await Promise.all([
            loadBuffer(this.config.paths.typingSprite),
            loadBuffer(this.config.paths.click),
            loadBuffer(this.config.paths.hiss),
            Promise.all(this.config.paths.drones.map(loadBuffer)),
            Promise.all(this.config.paths.swells.map(loadBuffer))
        ]);

        this.buffers.typing = typingBuffer;
        this.buffers.ui.click = clickBuffer;
        this.buffers.ui.hiss = hissBuffer;
        this.buffers.drones = (droneBuffers || []).filter(b => b !== null);
        this.buffers.swells = (swellBuffers || []).filter(b => b !== null);

        await this.reloadPersonalSwells();

        if (this.buffers.typing && this.buffers.typingConfig) {
            console.log('[AudioEngine] Typing system ready (sprite + config loaded)');
        } else {
            console.warn('[AudioEngine] Typing system failed to load:', {
                sprite: !!this.buffers.typing,
                config: !!this.buffers.typingConfig
            });
        }

        console.log('[AudioEngine] Assets loaded: ' + this.buffers.drones.length + ' drones available');
    }

    /**
     * Reload personal swells from store
     */
    async reloadPersonalSwells() {
        if (!this.context) {
            console.warn('[AudioEngine] reloadPersonalSwells: Audio context not initialized. Skipping decode.');
            return;
        }

        const records = await PersonalSwells.getAll();

        if (!this.personalPool) {
            this.personalPool = new Map();
        } else {
            this.personalPool.clear();
        }

        if (records && records.length > 0) {
            const personalBuffers = await Promise.all(records.map(async (record) => {
                try {
                    const arrayBuffer = await record.data.arrayBuffer();
                    const buffer = await this.context.decodeAudioData(arrayBuffer);
                    this.personalPool.set(record.id, buffer);
                    return buffer;
                } catch (e) {
                    console.error('[AudioEngine] Failed to decode personal swell: ' + record.name, e);
                    return null;
                }
            }));

            this.buffers.personalSwells = personalBuffers.filter(b => b !== null);
            console.log('[AudioEngine] Personal swells reloaded: ' + this.personalPool.size);
        } else {
            this.buffers.personalSwells = [];
            this.personalPool.clear();
        }
    }

    /**
     * Play a high-fidelity synth swell
     * @param {number|string} idOrIndex
     */
    async playSwell(idOrIndex = null) {
        if (!this.isInitialized) await this.init();

        const standardSwells = this.buffers.swells || [];
        const personalSwells = this.buffers.personalSwells || [];
        const allSwells = [...standardSwells, ...personalSwells];

        if (allSwells.length === 0) return;

        try {
            let buffer = null;

            if (typeof idOrIndex === 'string') {
                buffer = this.personalPool ? this.personalPool.get(idOrIndex) : null;
                if (!buffer) {
                    console.warn('[AudioEngine] playSwell: ID ' + idOrIndex + ' not found in personal pool.');
                    buffer = allSwells[Math.floor(Math.random() * allSwells.length)];
                }
            } else if (typeof idOrIndex === 'number' && idOrIndex !== null) {
                buffer = allSwells[idOrIndex % allSwells.length];
            } else {
                buffer = allSwells[Math.floor(Math.random() * allSwells.length)];
            }

            if (!buffer) return;

            const source = this.context.createBufferSource();
            source.buffer = buffer;

            if (!this.layerGains.swell) {
                this.layerGains.swell = this.context.createGain();
                this.layerGains.swell.connect(this.masterGain);
            }

            source.connect(this.layerGains.swell);
            this.layerGains.swell.gain.cancelScheduledValues(this.context.currentTime);
            this.layerGains.swell.gain.setValueAtTime(0, this.context.currentTime);
            this.layerGains.swell.gain.linearRampToValueAtTime(
                this.config.layerVolumes.swell,
                this.context.currentTime + 1.5
            );

            source.start();
            this.layers.swell = source;

            source.onended = () => {
                if (this.layers.swell === source) this.layers.swell = null;
            };
        } catch (error) {
            console.error('[AudioEngine] Swell playback failed:', error);
        }
    }

    /**
     * Stop swell layer
     */
    stopSwell(instant = false) {
        if (this.layers.swell) {
            const source = this.layers.swell;
            const fadeTime = instant ? 0 : 1.0;

            if (this.layerGains.swell) {
                this.layerGains.swell.gain.cancelScheduledValues(this.context.currentTime);
                this.layerGains.swell.gain.setValueAtTime(this.layerGains.swell.gain.value, this.context.currentTime);
                this.layerGains.swell.gain.linearRampToValueAtTime(0, this.context.currentTime + fadeTime);
            }

            if (instant) {
                try { source.stop(); } catch (e) { }
                this.layers.swell = null;
            } else {
                setTimeout(() => {
                    try { source.stop(); } catch (e) { }
                    this.layers.swell = null;
                }, fadeTime * 1000);
            }
        }
    }

    /**
     * Play mechanical key press sound from sprite
     * @param {number} keyCode
     */
    async playKeyPress(keyCode) {
        if (!this.isInitialized) await this.init();
        await this.resume();

        if (!this.buffers.typing || !this.buffers.typingConfig) {
            console.warn('[AudioEngine] playKeyPress ignored: Typing assets not loaded');
            return;
        }

        const definition = this.buffers.typingConfig.defines[keyCode] || this.buffers.typingConfig.defines['32'];
        if (!definition) {
            console.warn('[AudioEngine] No key definition for: ' + keyCode);
            return;
        }

        const offset = definition[0] / 1000;
        const duration = definition[1] / 1000;

        const source = this.context.createBufferSource();
        source.buffer = this.buffers.typing;

        if (!this.layerGains.typing) {
            this.layerGains.typing = this.context.createGain();
            this.layerGains.typing.connect(this.masterGain);
        }

        this.layerGains.typing.gain.value = this.config.layerVolumes.typing;

        source.connect(this.layerGains.typing);
        source.start(this.context.currentTime, offset, duration);
    }

    /**
     * Play UI Click sound
     */
    async playClick() {
        if (!this.isInitialized) await this.init();
        await this.resume();

        if (!this.buffers.ui.click) return;

        const source = this.context.createBufferSource();
        source.buffer = this.buffers.ui.click;

        if (!this.layerGains.ui) {
            this.layerGains.ui = this.context.createGain();
            this.layerGains.ui.connect(this.masterGain);
        }

        this.layerGains.ui.gain.value = this.config.layerVolumes.ui;

        source.connect(this.layerGains.ui);
        source.start();
    }

    /**
     * Play UI Hiss/Transition sound
     */
    async playHiss() {
        if (!this.isInitialized) await this.init();
        await this.resume();

        if (!this.buffers.ui.hiss) return;

        const source = this.context.createBufferSource();
        source.buffer = this.buffers.ui.hiss;

        if (!this.layerGains.ui) {
            this.layerGains.ui = this.context.createGain();
            this.layerGains.ui.connect(this.masterGain);
        }

        this.layerGains.ui.gain.value = this.config.layerVolumes.ui * 0.7;

        source.connect(this.layerGains.ui);
        source.start();
    }

    /**
     * Start randomized ambient drone playlist
     */
    startAmbientPlaylist() {
        if (!this.isInitialized || this.buffers.drones.length === 0) {
            console.log('[AudioEngine] startAmbientPlaylist: skipped (not initialized or no drones)');
            return;
        }
        if (this.sessionActive) {
            console.log('[AudioEngine] startAmbientPlaylist: skipped (session active)');
            return;
        }

        this.ambienceActive = true;
        this.isPlaying = true;

        const playNext = () => {
            if (!this.ambienceActive || this.sessionActive) return;

            const buffer = this.buffers.drones[Math.floor(Math.random() * this.buffers.drones.length)];
            const source = this.context.createBufferSource();
            source.buffer = buffer;

            source.connect(this.layerGains.ambient);
            source.start();
            this.setLayerVolume('ambient', this.config.layerVolumes.ambient, true);

            source.onended = () => {
                if (this.ambienceActive && !this.sessionActive) playNext();
            };

            this.layers.ambient = source;
        };

        playNext();
    }

    // LAYER CONTROL
    // ═══════════════════════════════════════════════════════════

    /**
     * Set individual layer volume
     * @param {'binaural' | 'harmonics' | 'noise' | 'drone' | 'ambient' | 'typing' | 'ui' | 'swell'} layer
     * @param {number} volume - 0.0 to 1.0
     * @param {boolean} fade - Whether to fade to new volume
     */
    setLayerVolume(layer, volume, fade = true) {
        const gain = this.layerGains[layer];
        if (!gain) return;

        this.config.layerVolumes[layer] = Math.max(0, Math.min(1, volume));

        if (fade) {
            gain.gain.cancelScheduledValues(this.context.currentTime);
            gain.gain.setValueAtTime(gain.gain.value, this.context.currentTime);
            gain.gain.linearRampToValueAtTime(
                volume,
                this.context.currentTime + this.config.fadeTime
            );
        } else {
            gain.gain.cancelScheduledValues(this.context.currentTime);
            gain.gain.setValueAtTime(volume, this.context.currentTime);
        }
    }

    /**
     * Get current layer volumes
     */
    getLayerVolumes() {
        return { ...this.config.layerVolumes };
    }

    // ═══════════════════════════════════════════════════════════
    // PRESETS
    // ═══════════════════════════════════════════════════════════

    /**
     * Apply a layer preset
     * @param {'focus' | 'deep' | 'drift' | 'gateway' | 'silent'} presetName
     */
    applyPreset(presetName) {
        const preset = LAYER_PRESETS[presetName];
        if (!preset) {
            console.warn('[AudioEngine] Unknown preset:', presetName);
            return;
        }

        this.currentPreset = presetName;
        console.log(`[AudioEngine] Applying preset: ${preset.name} - ${preset.description}`);

        // Binaural
        if (preset.binaural.enabled) {
            const band = BRAINWAVE_BANDS[preset.binaural.band];
            if (band) {
                this.currentBand = preset.binaural.band;
                this.startEntrainment(band.default, {
                    mode: this.config.entrainmentMode,
                    waveform: this.config.entrainmentWaveform,
                    spatial: this.config.entrainmentSpatial,
                    spatialRate: this.config.entrainmentSpatialRate,
                    spatialRadius: this.config.entrainmentSpatialRadius
                });
                this.config.layerVolumes.binaural = preset.binaural.volume;
            }
        } else {
            this.stopEntrainment();
        }

        // Harmonics
        // Harmonics
        if (preset.harmonics.enabled) {
            this.startHarmonics();
            this.config.layerVolumes.harmonics = preset.harmonics.volume;
        } else {
            this.stopHarmonics();
        }

        // Noise
        if (preset.noise.enabled) {
            this.startNoise();
            this.config.layerVolumes.noise = preset.noise.volume;
        } else {
            this.stopNoise();
        }

        // Drone
        if (preset.drone.enabled) {
            this.startDrone();
            this.config.layerVolumes.drone = preset.drone.volume;
        } else {
            this.stopDrone();
        }

        // Apply volumes
        for (const layer of ['binaural', 'harmonics', 'noise', 'drone']) {
            this.setLayerVolume(layer, this.config.layerVolumes[layer], true);
        }
    }

    /**
     * Set entrainment target by brainwave band name
     * @param {'delta' | 'theta' | 'alpha' | 'beta' | 'gamma'} band
     */
    setEntrainmentBand(band) {
        const bandInfo = BRAINWAVE_BANDS[band];
        if (!bandInfo) {
            console.warn('[AudioEngine] Unknown band:', band);
            return;
        }

        this.currentBand = band;
        this.startEntrainment(bandInfo.default, {
            mode: this.config.entrainmentMode,
            waveform: this.config.entrainmentWaveform,
            spatial: this.config.entrainmentSpatial,
            spatialRate: this.config.entrainmentSpatialRate,
            spatialRadius: this.config.entrainmentSpatialRadius
        });
        console.log(`[AudioEngine] Entrainment: ${band} (${bandInfo.default}Hz) - ${bandInfo.description}`);
    }

    // ═══════════════════════════════════════════════════════════

    _getEntrainmentBeatParam() {
        const layer = this.layers.binaural;
        if (!layer) return null;

        if (layer.lfo && layer.mode === 'isochronic') {
            return { type: 'lfo', param: layer.lfo.frequency };
        }

        if (layer.rightOsc) {
            return { type: 'dual', param: layer.rightOsc.frequency, base: this.getCarrierFrequency() };
        }

        return null;
    }

    /**
     * Apply a dynamic beat-frequency ramp
     * @param {Object} ramp
     */
    applyEntrainmentRamp(ramp = {}) {
        const target = this._getEntrainmentBeatParam();
        if (!target) return;

        let points = [];
        if (Array.isArray(ramp.points) && ramp.points.length >= 2) {
            points = ramp.points;
        } else if (typeof ramp.startHz === 'number' && typeof ramp.endHz === 'number' && typeof ramp.durationSec === 'number') {
            points = [
                { time: 0, beat: ramp.startHz },
                { time: ramp.durationSec, beat: ramp.endHz }
            ];
        }

        points = points
            .map(point => ({ time: Math.max(0, point.time || 0), beat: point.beat }))
            .filter(point => typeof point.beat === 'number');

        if (points.length < 2) return;

        points.sort((a, b) => a.time - b.time);

        const now = this.context.currentTime;
        const curve = ramp.curve || 'exponential';

        target.param.cancelScheduledValues(now);

        const startBeat = points[0].beat;
        if (target.type === 'dual') {
            target.param.setValueAtTime(target.base + startBeat, now);
        } else {
            target.param.setValueAtTime(startBeat, now);
        }

        for (let i = 1; i < points.length; i++) {
            const t = now + points[i].time;
            const beat = points[i].beat;
            const value = target.type === 'dual' ? target.base + beat : beat;
            const prev = target.type === 'dual' ? target.base + points[i - 1].beat : points[i - 1].beat;

            if (curve === 'exponential' && value > 0 && prev > 0) {
                target.param.exponentialRampToValueAtTime(value, t);
            } else {
                target.param.linearRampToValueAtTime(value, t);
            }
        }

        this.config.binauralBeatFreq = points[points.length - 1].beat;
        console.log('[AudioEngine] Entrainment ramp: ' + points[0].beat + 'Hz -> ' + points[points.length - 1].beat + 'Hz');
    }

    /**
     * Build a ramp curve from the session pacing curve
     * @param {string} curve
     * @param {number} durationSec
     */
    buildCurveRamp(curve, durationSec) {
        if (!durationSec || durationSec <= 0) return null;

        const band = (name) => BRAINWAVE_BANDS[name] ? BRAINWAVE_BANDS[name].default : null;

        switch (curve) {
            case 'induction':
                return {
                    curve: 'exponential',
                    points: [
                        { time: 0, beat: band('alpha') },
                        { time: durationSec, beat: band('theta') }
                    ]
                };
            case 'ascent':
                return {
                    curve: 'exponential',
                    points: [
                        { time: 0, beat: band('theta') },
                        { time: durationSec, beat: band('beta') }
                    ]
                };
            case 'wave':
                return {
                    curve: 'linear',
                    points: [
                        { time: 0, beat: band('alpha') },
                        { time: durationSec * 0.5, beat: band('theta') },
                        { time: durationSec, beat: band('alpha') }
                    ]
                };
            case 'climax':
                return {
                    curve: 'exponential',
                    points: [
                        { time: 0, beat: band('beta') },
                        { time: durationSec, beat: band('gamma') }
                    ]
                };
            default:
                return null;
        }
    }

    // TRIGGERS & EFFECTS
    // ═══════════════════════════════════════════════════════════

    /**
     * Play a trigger sound (chime, tone, etc.)
     * @param {'chime' | 'tone' | 'click'} type
     */
    playTrigger(type = 'tone') {
        if (!this.isInitialized) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const now = this.context.currentTime;

        // Use 432Hz tuning for triggers too
        const baseA = this.getCarrierFrequency() >= 432 ? 432 : 440;

        switch (type) {
            case 'chime':
                osc.frequency.value = baseA * 2; // A5
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
                break;

            case 'click':
                osc.frequency.value = 1000;
                osc.type = 'square';
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                break;

            case 'tone':
            default:
                osc.frequency.value = baseA; // A4
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                break;
        }

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 2);
    }

    /**
     * Create a pulse effect synchronized to a frequency
     * @param {number} frequency - Pulse frequency in Hz
     * @param {Function} callback - Called on each pulse
     * @returns {Function} Stop function
     */
    createPulse(frequency, callback) {
        const intervalMs = 1000 / frequency;
        const intervalId = setInterval(callback, intervalMs);
        return () => clearInterval(intervalId);
    }

    // ═══════════════════════════════════════════════════════════
    // SESSION CONTROL
    // ═══════════════════════════════════════════════════════════

    /**
     * Set master volume
     * @param {number} volume - 0.0 to 1.0
     */
    setVolume(volume) {
        this.config.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.linearRampToValueAtTime(
                this.config.masterVolume,
                this.context.currentTime + 0.1
            );
        }
    }

    /**
     * Set master volume (alias)
     * @param {number} volume
     */
    setMasterVolume(volume) {
        this.setVolume(volume);
    }

    /**
     * Fade out the session audio
     * @param {number} duration
     */
    fadeOutSession(duration = 0.5) {
        if (!this.masterGain) return Promise.resolve();
        this._cancelFade();

        this._isFading = true;
        this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.context.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);

        return new Promise(resolve => {
            this.fadeTimeoutId = setTimeout(() => {
                this._isFading = false;
                this.fadeTimeoutId = null;
                this._fadeResolve = null;
                resolve();
            }, duration * 1000);
            this._fadeResolve = resolve;
        });
    }

    /**
     * Fade in the session audio
     * @param {number} duration
     */
    fadeInSession(duration = 0.5) {
        if (!this.masterGain) return Promise.resolve();
        this._cancelFade();

        this._isFading = true;
        const now = this.context.currentTime;
        const targetVolume = this.config.masterVolume;

        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0, now);
        this.masterGain.gain.linearRampToValueAtTime(targetVolume, now + duration);

        return new Promise(resolve => {
            this.fadeTimeoutId = setTimeout(() => {
                this._isFading = false;
                this.fadeTimeoutId = null;
                this._fadeResolve = null;
                resolve();
            }, duration * 1000);
            this._fadeResolve = resolve;
        });
    }

    _cancelFade() {
        if (this.fadeTimeoutId) clearTimeout(this.fadeTimeoutId);
        this.fadeTimeoutId = null;
        this._isFading = false;
        const resolve = this._fadeResolve;
        this._fadeResolve = null;
        resolve?.({ cancelled: true });
    }

    _cancelPendingSessionStop() {
        if (this._sessionStopTimer) clearTimeout(this._sessionStopTimer);
        this._sessionStopTimer = null;
        const resolve = this._sessionStopResolve;
        this._sessionStopResolve = null;
        resolve?.({ cancelled: true });
    }

    /**
     * Start all audio for a session
     * @param {Object} options
     * @param {string} [options.ambientUrl] - URL to ambient audio
     * @param {string} [options.entrainmentBand] - Brainwave band name
     * @param {string} [options.preset] - Layer preset name
     * @param {Object} [options.entrainment] - Entrainment settings
     * @param {string} [options.entrainment.mode] - binaural | monaural | isochronic | spatial
     * @param {string} [options.entrainment.waveform] - sine | triangle | sawtooth
     * @param {Object} [options.entrainment.ramp] - { startHz, endHz, durationSec, curve } or { points: [{time, beat}] }
     * @param {string} [options.entrainment.curve] - Session pacing curve name
     * @param {number} [options.entrainment.durationSec] - Session duration in seconds
     * @param {boolean} [options.entrainment.autoRamp] - Use curve-derived ramp when true
     */
    async startSession(options = {}) {
        if (this._destroyed) throw new Error('AudioEngine has been destroyed');
        this._cancelPendingSessionStop();
        const generation = ++this._sessionGeneration;
        await this.init();
        if (generation !== this._sessionGeneration || this._destroyed) return { cancelled: true };

        if (this.masterGain) {
            this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
            this.masterGain.gain.setValueAtTime(0, this.context.currentTime);
        }
        this._isFading = false;

        await this.resume();
        if (generation !== this._sessionGeneration || this._destroyed) return { cancelled: true };

        // Engine warm-up: allow clock to stabilize after resume
        await new Promise(resolve => setTimeout(resolve, 50));
        if (generation !== this._sessionGeneration || this._destroyed) return { cancelled: true };

        // Prevent overlap: Stop menu ambience before starting session
        this.stopAmbient(true);
        this.sessionActive = true;

        if (options.entrainment) {
            this.setEntrainmentConfig({
                mode: options.entrainment.mode,
                waveform: options.entrainment.waveform,
                spatial: options.entrainment.spatial,
                spatialRate: options.entrainment.spatialRate,
                spatialRadius: options.entrainment.spatialRadius,
                isochronicDepth: options.entrainment.isochronicDepth
            });
        }

        if (options.preset) {
            this.applyPreset(options.preset);
        } else if (options.entrainmentBand) {
            this.setEntrainmentBand(options.entrainmentBand);
        }

        if (options.soundscape) {
            this.startSoundscape(options.soundscape);
        }

        if (options.entrainment) {
            const explicitRamp = options.entrainment.ramp;
            const autoRamp = options.entrainment.autoRamp;
            const curveRamp = autoRamp ? this.buildCurveRamp(options.entrainment.curve, options.entrainment.durationSec) : null;
            const ramp = explicitRamp || curveRamp;
            if (ramp) {
                this.applyEntrainmentRamp(ramp);
            }
        }

        if (options.ambientUrl) {
            await this.playAmbient(options.ambientUrl);
        }

        // Trigger HQ Swell on entry
        this.playSwell(options.swellId);

        this.isPlaying = true;
        return { cancelled: false };
    }

    /**
     * Stop all audio
     */
    /**
     * Stop all audio with a gentle fade-out "echo"
     */
    stopSession({ resumeAmbient = true, immediate = false } = {}) {
        this._cancelPendingSessionStop();
        const generation = ++this._sessionGeneration;
        this.sessionActive = false;
        this.isPlaying = false;

        // Transition time for the "soft" exit
        const transitionTime = immediate ? 0 : 500;

        // Fade out session (already likely done by Chamber, but let's be sure)
        this.fadeOutSession(0.3);

        return new Promise(resolve => {
          this._sessionStopResolve = resolve;
          this._sessionStopTimer = setTimeout(() => {
            this._sessionStopTimer = null;
            this._sessionStopResolve = null;
            if (generation !== this._sessionGeneration || this.sessionActive || this._destroyed) {
                resolve({ cancelled: true });
                return;
            }
            // 1. SILENCE and STOP ALL SESSION LAYERS
            // We use instant=true here because we are already silent from fadeOutSession
            this.stopEntrainment(true);
            this.stopHarmonics(true);
            this.stopNoise(true);
            this.stopDrone(true);
            this.stopSwell(true);
            this.stopSoundscape(true);

            // 2. RESTORE MASTER VOLUME
            // This brings the volume back to config.masterVolume (0.7) for the menu
            if (this.context) this.setVolume(this.config.masterVolume);

            // 3. RE-START MENU AMBIENCE
            // stopAmbient(true) ensures any lingering session ambience is dead
            this.stopAmbient(true);
            if (resumeAmbient) this.startAmbientPlaylist();
            
            console.log(`[AudioEngine] Session stopped${resumeAmbient ? ', menu ambience resumed' : ''}.`);
            resolve({ cancelled: false });
          }, transitionTime);
        });
    }

    /**
     * Pause/resume (for session pause)
     */
    async pause() {
        if (this.context && this.context.state === 'running') {
            await this.context.suspend();
        }
    }

    async unpause() {
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this._destroyed = true;
        this._sessionGeneration++;
        this._cancelPendingSessionStop();
        this._cancelFade();
        this.sessionActive = false;
        this.isPlaying = false;
        this.stopEntrainment(true);
        this.stopHarmonics(true);
        this.stopNoise(true);
        this.stopDrone(true);
        this.stopSwell(true);
        this.stopSoundscape(true);
        this.stopAmbient(true);
        this.stopSpeaking();
        if (this.context) {
            this.context.close().catch(() => {});
            this.context = null;
        }
        this.isInitialized = false;
    }

    /**
     * Get current audio state for UI
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            isPlaying: this.isPlaying,
            currentPreset: this.currentPreset,
            currentBand: this.currentBand,
            carrierTuning: this.config.carrierTuning,
            carrierFrequency: this.getCarrierFrequency(),
            entrainmentMode: this.config.entrainmentMode,
            entrainmentWaveform: this.config.entrainmentWaveform,
            layerVolumes: this.getLayerVolumes(),
            activeLayers: {
                binaural: !!this.layers.binaural,
                harmonics: !!this.layers.harmonics,
                noise: !!this.layers.noise,
                drone: !!this.layers.drone,
                ambient: !!this.layers.ambient,
                typing: !!this.layers.typing,
                ui: !!this.layers.ui,
                swell: !!this.layers.swell
            },
            // Voice state
            voiceEnabled: this.voiceEnabled,
            voiceAvailable: !!this.voiceSynth,
            selectedVoice: this.selectedVoice ? this.selectedVoice.name : null,
            voiceRate: this.voiceRate
        };
    }

    // ═══════════════════════════════════════════════════════════
    // VOICE SYNTHESIS (TTS)
    // ═══════════════════════════════════════════════════════════

    /**
     * Check if voice synthesis is available
     */
    isVoiceAvailable() {
        return !!this.voiceSynth;
    }

    /**
     * Get available voices
     * @returns {Promise<SpeechSynthesisVoice[]>}
     */
    getVoices() {
        return new Promise((resolve) => {
            if (!this.voiceSynth) {
                resolve([]);
                return;
            }

            let voices = this.voiceSynth.getVoices();
            if (voices.length > 0) {
                resolve(voices);
                return;
            }

            // Chrome loads voices async
            this.voiceSynth.onvoiceschanged = () => {
                voices = this.voiceSynth.getVoices();
                resolve(voices);
            };

            // Fallback timeout
            setTimeout(() => {
                resolve(this.voiceSynth.getVoices());
            }, 100);
        });
    }

    /**
     * Set the voice to use
     * @param {SpeechSynthesisVoice | string} voice - Voice object or voice name
     */
    async setVoice(voice) {
        if (typeof voice === 'string') {
            const voices = await this.getVoices();
            this.selectedVoice = voices.find(v => v.name === voice) || null;
        } else {
            this.selectedVoice = voice;
        }
        console.log(`[Voice] Selected: ${this.selectedVoice?.name || 'default'}`);
    }

    /**
     * Set voice rate (speech speed)
     * @param {number} rate - 0.1 to 2.0, default 1.0
     */
    setVoiceRate(rate) {
        this.voiceRate = Math.max(0.1, Math.min(2.0, rate));
    }

    /**
     * Calculate voice rate from WPM setting
     * @param {number} wpm - Words per minute
     */
    setVoiceRateFromWpm(wpm) {
        // Map WPM to speech rate: 120 WPM → 0.7, 220 WPM → 1.0, 300 WPM → 1.3
        this.voiceRate = 0.4 + (wpm / 350);
        this.voiceRate = Math.max(0.5, Math.min(1.5, this.voiceRate));
        console.log(`[Voice] Rate from WPM ${wpm}: ${this.voiceRate.toFixed(2)}`);
    }

    /**
     * Enable/disable voice
     * @param {boolean} enabled
     */
    setVoiceEnabled(enabled) {
        this.voiceEnabled = enabled;
        if (!enabled) {
            this.stopSpeaking();
        }
        console.log(`[Voice] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Speak text
     * @param {string} text - Text to speak
     * @param {Object} options
     * @param {Function} [options.onEnd] - Callback when speech ends
     * @param {Function} [options.onStart] - Callback when speech starts
     * @param {number} [options.rate] - Override rate
     * @returns {SpeechSynthesisUtterance | null}
     */
    speak(text, options = {}) {
        if (!this.voiceSynth || !this.voiceEnabled) {
            // Not available or disabled, call onEnd immediately
            if (options.onEnd) options.onEnd();
            return null;
        }

        // Guard against empty text - use fallback timing instead
        // Also strip phrase break markers (|) and [PAUSE] that shouldn't be spoken
        const cleanText = (text || '')
            .replace(/\|/g, '')        // Remove pipe characters
            .replace(/\[PAUSE\]/gi, '')  // Remove [PAUSE] markers
            .replace(/\s+/g, ' ')       // Normalize whitespace
            .trim();
        if (!cleanText) {
            console.log('[Voice] Skipping empty text, using fallback timing');
            // Use a short delay for pause-like atoms
            setTimeout(() => {
                if (options.onEnd) options.onEnd();
            }, 300); // 300ms for empty/pause atoms
            return null;
        }

        // Cancel any current speech
        this.stopSpeaking();

        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Configure
        utterance.rate = options.rate || this.voiceRate;
        utterance.pitch = this.voicePitch;
        utterance.volume = this.voiceVolume;

        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }

        // Events
        utterance.onstart = () => {
            console.log(`[Voice] Speaking: "${cleanText.substring(0, 40)}..."`);
            if (options.onStart) options.onStart();
        };

        utterance.onend = () => {
            this.currentUtterance = null;
            if (options.onEnd) options.onEnd();
        };

        utterance.onerror = (event) => {
            console.warn('[Voice] Speech error:', event.error);
            this.currentUtterance = null;
            if (options.onEnd) options.onEnd(); // Advance anyway on error
        };

        // Speak
        this.currentUtterance = utterance;
        this.voiceSynth.speak(utterance);

        return utterance;
    }

    /**
     * Stop current speech
     */
    stopSpeaking() {
        if (this.voiceSynth) {
            this.voiceSynth.cancel();
        }
        this.currentUtterance = null;
    }

    /**
     * Check if currently speaking
     */
    isSpeaking() {
        return this.voiceSynth?.speaking || false;
    }
}

// Singleton export
export const audioEngine = new AudioEngine();
