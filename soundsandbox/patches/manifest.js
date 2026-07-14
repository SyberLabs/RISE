/**
 * SoundSandbox patch registry.
 * Adding a sound = create patches/<id>.js exporting the patch
 * descriptor, then add one line here. Order = rack display order.
 * Convention: app-* are faithful ports of the live engine (do not
 * modify); lab-* is where new work happens.
 */
import entrainment from './app-binaural.js';
import harmonics from './app-harmonics.js';
import noise from './app-noise.js';
import drone from './app-drone.js';
import presets from './app-presets.js';
import fmTide from './lab-fm-tide.js';

export const PATCHES = [
    presets,
    entrainment,
    harmonics,
    noise,
    drone,
    fmTide
];
