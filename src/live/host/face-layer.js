/**
 * The face's layer: RISE's face (src/scenes/engines/oracle.js) drawn on a canvas the venue owns, by the same scene
 * layer, runtime and worker a generated scene uses (docs/plans/LIVE-CURRENT.md §22). Loaded only by the venue, and
 * only once it is on screen, so neither the engine nor the worker is in the first load.
 *
 * It is not a reading's scene: nothing here reaches a reading's Current, its journal or its perception. The engine
 * hears the reader's pointer over the face for its gaze and says nothing back. It is held to the same frame budget
 * (a slow face fails, and the still face stays), and to the flash gate (a face that would flash is frozen).
 */
import source from '../../scenes/engines/oracle.js?raw';
import { createFlashWatch, createSceneRuntime } from '../../scenes/scene-runtime.js';
import { TO_HOST } from '../../scenes/scene-protocol.js';
import { VisualFlashGate } from '../../core/visual-safety.js';
import { mountSceneLayer } from '../../components/read/scene-layer.js';

/** Frame times kept for ?measure=1, the latest. */
const KEPT = 240;

const defaultWorker = () => import('../../scenes/create-scene-worker.js').then(module => module.createSceneWorker());

/** The most pixels the face draws: a 1440 by 900 room at 1.5 (docs/plans/LIVE-CURRENT.md §23). */
const FACE_PIXELS = 1440 * 900 * 1.5 * 1.5;

/**
 * The face's pixel ratio for a canvas of this size: the device's, at most 2 as every scene's, and in a room so large
 * that it would draw more than FACE_PIXELS, as many as that allows; never under 1.
 */
export function facePixelRatio(width, height, device) {
    const ratio = Math.min(2, device || 1);
    if (!(width > 0 && height > 0)) return ratio;
    return Math.max(1, Math.min(ratio, Math.sqrt(FACE_PIXELS / (width * height))));
}

/**
 * @param {object} options
 * @param {HTMLElement} options.host the face's element; the canvas is put in it
 * @param {string} options.skin
 * @param {string} options.state
 * @param {boolean} [options.reducedMotion]
 * @param {() => void} [options.onFirstFrame] the engine has drawn: the still face may go
 * @param {(diagnostic: object) => void} [options.onFailure] the engine failed or was frozen: the still face stays
 */
export function mountFace({
    host, skin, state, reducedMotion = false, onFirstFrame = () => {}, onFailure = () => {},
    createWorker = defaultWorker, requestFrame, cancelFrame
}) {
    const times = [];
    const lumas = [];
    let drawn = false;
    // The last geometry the engine was given: the same room again is not sent, so a room at rest keeps its trails.
    let placed = null;
    let frozen = false;
    let runtime = null;
    const layer = mountSceneLayer({
        field: host,
        insertBehindReading: (parent, node) => parent.append(node),
        onResize: ({ width, height }) => runtime?.resize(width, height, facePixelRatio(width, height, host.ownerDocument.defaultView?.devicePixelRatio))
    });
    // The face's own class only: it is not a reading's scene, and nothing that looks for one may find it.
    layer.canvas.className = 'live-face__canvas';

    /** The worker, its frame answers counted on the way in: the first says the engine has drawn. */
    async function measured() {
        const worker = await createWorker();
        let heard = null;
        worker.onmessage = event => {
            if (event?.data?.type === TO_HOST.frameDone && Number.isFinite(event.data.ms)) {
                times.push(event.data.ms);
                if (times.length > KEPT) times.shift();
            }
            heard?.(event);
            if (!drawn && times.length > 0) {
                drawn = true;
                onFirstFrame();
            }
        };
        return {
            postMessage: (...args) => worker.postMessage(...args),
            terminate: () => worker.terminate(),
            set onmessage(fn) { heard = fn; },
            set onerror(fn) { worker.onerror = fn; }
        };
    }

    const watch = createFlashWatch(new VisualFlashGate({ minIntervalMs: 0, burstWindowMs: 1000, maxBurst: 3 }));
    runtime = createSceneRuntime({
        createWorker: measured,
        canvas: layer.canvas,
        theme: { skin, state },
        reducedMotion,
        onFailure,
        onLuma: (value, t) => {
            lumas.push(value);
            if (lumas.length > KEPT) lumas.shift();
            if (!watch(value, t)) return;
            frozen = true;
            runtime.freeze();
            onFailure({ sceneId: 'oracle', phase: 'flash', message: 'Frozen: the face would flash more than three times a second', where: null });
        },
        ...(requestFrame ? { requestFrame, cancelFrame } : {})
    });

    const modifiers = event => ({ shift: event.shiftKey === true, alt: event.altKey === true, ctrl: event.ctrlKey === true, meta: event.metaKey === true });
    const pointed = event => {
        const box = layer.canvas.getBoundingClientRect();
        runtime.input({ type: event.type, x: event.clientX - box.left, y: event.clientY - box.top, buttons: event.buttons ?? 0, key: null, modifiers: modifiers(event) });
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) layer.canvas.addEventListener(type, pointed);
    // The engine is given no leave: a cancel at the centre says the pointer is gone, and the eye looks ahead again.
    layer.canvas.addEventListener('pointerleave', event => {
        runtime.input({ type: 'pointercancel', x: layer.canvas.clientWidth / 2, y: layer.canvas.clientHeight / 2, buttons: 0, key: null, modifiers: modifiers(event) });
    });

    layer.resize();
    const started = runtime.start({ id: 'oracle', code: source });

    return {
        started,
        canvas: layer.canvas,
        cue: (name, { instant = false } = {}) => runtime.cue(name, { instant }),
        /**
         * The room's geometry for this animation frame (frames.js frameGeometry), or null for the face's own square.
         * Sent only once the engine draws (a runtime that is not ready would queue one a frame), and only when it changed.
         */
        place(geometry) {
            if (!drawn || frozen) return;
            const name = `aperture:${JSON.stringify(geometry)}`;
            if (name === placed) return;
            placed = name;
            runtime.cue(name);
        },
        /** The reader's pointer anywhere in the room, in the page's pixels: where the eye looks. */
        point(clientX, clientY) {
            const box = layer.canvas.getBoundingClientRect();
            runtime.input({ type: 'pointermove', x: clientX - box.left, y: clientY - box.top, buttons: 0, key: null, modifiers: { shift: false, alt: false, ctrl: false, meta: false } });
        },
        setSkin: name => runtime.cue(`set:skin=${name}`),
        play: () => runtime.play(),
        pause: () => runtime.pause(),
        resize: () => layer.resize(),
        frameTimes: () => [...times],
        lumas: () => [...lumas],
        frozen: () => frozen,
        destroy() {
            runtime.dispose();
            layer.destroy();
        }
    };
}
