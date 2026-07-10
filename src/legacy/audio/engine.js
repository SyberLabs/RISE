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

/**
 * Audio Engine for R.I.S.E.
 * Handles ambient audio, binaural beats, and synchronized triggers
 */
export class AudioEngine {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.isInitialized = false;
        this.isPlaying = false;

        // Layer nodes
        this.layers = {
            binaural: null,
            harmonics: null,
            noise: null,
            drone: null,
            ambient: null
        };

        // Layer gains
        this.layerGains = {
            binaural: null,
            harmonics: null,
            noise: null,
            drone: null,
            ambient: null
        };

        // Configuration
        this.config = {
            masterVolume: 0.7,
            carrierTuning: 'sacred',  // Default to 432Hz
            binauralBeatFreq: 6,      // Theta
            fadeTime: 2.0,            // seconds

            // Layer volumes (0-1)
            layerVolumes: {
                binaural: 0.3,
                harmonics: 0.15,
                noise: 0.1,
                drone: 0.2,
                ambient: 0.5
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
    }

    /**
     * Initialize the audio context (must be called after user interaction)
     */
    async init() {
        if (this.isInitialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();

            // Create master gain
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.config.masterVolume;
            this.masterGain.connect(this.context.destination);

            // Create layer gain nodes
            for (const layer of Object.keys(this.layerGains)) {
                this.layerGains[layer] = this.context.createGain();
                this.layerGains[layer].gain.value = 0;
                this.layerGains[layer].connect(this.masterGain);
            }

            this.isInitialized = true;
            console.log('[AudioEngine] Initialized with 432Hz support');
        } catch (error) {
            console.error('[AudioEngine] Failed to initialize:', error);
        }
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

            // Restart binaural if playing
            if (this.layers.binaural) {
                this.startBinaural(this.config.binauralBeatFreq);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER: BINAURAL BEATS
    // ═══════════════════════════════════════════════════════════

    /**
     * Start binaural beat generator
     * @param {number} beatFrequency - Desired beat frequency in Hz
     */
    startBinaural(beatFrequency = 6) {
        if (!this.isInitialized) {
            console.warn('[AudioEngine] Not initialized');
            return;
        }

        this.stopBinaural();
        this.config.binauralBeatFreq = beatFrequency;

        const baseFrequency = this.getCarrierFrequency();

        // Create oscillators for left and right
        const leftOsc = this.context.createOscillator();
        const rightOsc = this.context.createOscillator();

        leftOsc.frequency.value = baseFrequency;
        rightOsc.frequency.value = baseFrequency + beatFrequency;

        leftOsc.type = 'sine';
        rightOsc.type = 'sine';

        // Create stereo panner
        const leftPan = this.context.createStereoPanner();
        const rightPan = this.context.createStereoPanner();

        leftPan.pan.value = -1;
        rightPan.pan.value = 1;

        // Connect to binaural layer gain
        leftOsc.connect(leftPan);
        rightOsc.connect(rightPan);
        leftPan.connect(this.layerGains.binaural);
        rightPan.connect(this.layerGains.binaural);

        // Start oscillators
        leftOsc.start();
        rightOsc.start();

        this.layers.binaural = { left: leftOsc, right: rightOsc };

        // Fade in
        this.setLayerVolume('binaural', this.config.layerVolumes.binaural, true);

        console.log(`[AudioEngine] Binaural: ${beatFrequency}Hz beat @ ${baseFrequency}Hz carrier`);
    }

    /**
     * Stop binaural beat generator
     */
    stopBinaural() {
        if (this.layers.binaural) {
            const { left, right } = this.layers.binaural;

            // Fade out
            this.setLayerVolume('binaural', 0, true);

            setTimeout(() => {
                try {
                    left.stop();
                    right.stop();
                } catch (e) { }
                this.layers.binaural = null;
            }, this.config.fadeTime * 1000);
        }
    }

    // ═══════════════════════════════════════════════════════════
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
    stopHarmonics() {
        if (this.layers.harmonics) {
            this.setLayerVolume('harmonics', 0, true);

            setTimeout(() => {
                try {
                    this.layers.harmonics.forEach(({ osc }) => osc.stop());
                } catch (e) { }
                this.layers.harmonics = null;
            }, this.config.fadeTime * 1000);
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
    stopNoise() {
        if (this.layers.noise) {
            this.setLayerVolume('noise', 0, true);

            setTimeout(() => {
                try {
                    this.layers.noise.stop();
                } catch (e) { }
                this.layers.noise = null;
            }, this.config.fadeTime * 1000);
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
    stopDrone() {
        if (this.layers.drone) {
            this.setLayerVolume('drone', 0, true);

            setTimeout(() => {
                try {
                    this.layers.drone.main.stop();
                    this.layers.drone.detune.stop();
                } catch (e) { }
                this.layers.drone = null;
            }, this.config.fadeTime * 1000);
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
    stopAmbient() {
        if (this.layers.ambient) {
            this.setLayerVolume('ambient', 0, true);

            setTimeout(() => {
                try {
                    this.layers.ambient.stop();
                } catch (e) { }
                this.layers.ambient = null;
            }, this.config.fadeTime * 1000);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER CONTROL
    // ═══════════════════════════════════════════════════════════

    /**
     * Set individual layer volume
     * @param {'binaural' | 'harmonics' | 'noise' | 'drone' | 'ambient'} layer
     * @param {number} volume - 0.0 to 1.0
     * @param {boolean} fade - Whether to fade to new volume
     */
    setLayerVolume(layer, volume, fade = true) {
        const gain = this.layerGains[layer];
        if (!gain) return;

        this.config.layerVolumes[layer] = Math.max(0, Math.min(1, volume));

        if (fade) {
            gain.gain.linearRampToValueAtTime(
                volume,
                this.context.currentTime + this.config.fadeTime
            );
        } else {
            gain.gain.value = volume;
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
            this.startBinaural(band.default);
            this.config.layerVolumes.binaural = preset.binaural.volume;
        } else {
            this.stopBinaural();
        }

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
        this.startBinaural(bandInfo.default);
        console.log(`[AudioEngine] Entrainment: ${band} (${bandInfo.default}Hz) - ${bandInfo.description}`);
    }

    // ═══════════════════════════════════════════════════════════
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
     * Start all audio for a session
     * @param {Object} options
     * @param {string} [options.ambientUrl] - URL to ambient audio
     * @param {string} [options.entrainmentBand] - Brainwave band name
     * @param {string} [options.preset] - Layer preset name
     */
    async startSession(options = {}) {
        await this.init();
        await this.resume();

        if (options.preset) {
            this.applyPreset(options.preset);
        } else if (options.entrainmentBand) {
            this.setEntrainmentBand(options.entrainmentBand);
        }

        if (options.ambientUrl) {
            await this.playAmbient(options.ambientUrl);
        }

        this.isPlaying = true;
    }

    /**
     * Stop all audio
     */
    stopSession() {
        this.stopAmbient();
        this.stopBinaural();
        this.stopHarmonics();
        this.stopNoise();
        this.stopDrone();
        this.isPlaying = false;
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
        this.stopSession();
        if (this.context) {
            this.context.close();
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
            layerVolumes: this.getLayerVolumes(),
            activeLayers: {
                binaural: !!this.layers.binaural,
                harmonics: !!this.layers.harmonics,
                noise: !!this.layers.noise,
                drone: !!this.layers.drone,
                ambient: !!this.layers.ambient
            },
            // Voice state
            voiceEnabled: this.voiceEnabled,
            voiceAvailable: !!this.voiceSynth,
            selectedVoice: this.selectedVoice?.name || null,
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
