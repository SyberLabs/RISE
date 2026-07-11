/**
 * Semantic Conductor
 * Scores a session's atom timeline for emotional valence and arousal,
 * producing a smoothed control track that presentation subsystems can
 * subscribe to ("Living Text" is the first subscriber).
 *
 * Design principles:
 * - Pure functions, no DOM, no network. The lexicon is embedded and local.
 * - Sessions are precomputed, so the whole text is scored at session start —
 *   the forward-backward smoothing pass gives the track anticipation
 *   (the signal begins turning *before* the passage does).
 * - Coarse but smooth: a compact hand-curated VAD lexicon. Precision is less
 *   important than continuity; the smoothing window absorbs noise.
 * - Deterministic: the same text always produces the same track.
 *
 * Signal shape per atom: { valence: -1..1, arousal: 0..1, confidence: 0..1 }
 */

// ─────────────────────────────────────────────────────────────
// VAD LEXICON — word: [valence -1..1, arousal 0..1]
// Curated for the registers RISE actually plays: literary, sacred,
// contemplative, scientific. Coarse values; smoothing does the rest.
// ─────────────────────────────────────────────────────────────

const LEXICON = {
    // ─ Love, joy, warmth ─
    love: [0.9, 0.6], loves: [0.9, 0.6], beloved: [0.9, 0.5], lover: [0.8, 0.6],
    joy: [0.9, 0.7], joyful: [0.9, 0.7], joyous: [0.9, 0.7], rejoice: [0.9, 0.8],
    happy: [0.8, 0.6], happiness: [0.8, 0.6], glad: [0.7, 0.5], delight: [0.8, 0.7],
    bliss: [0.9, 0.5], blissful: [0.9, 0.5], ecstasy: [0.9, 0.9], euphoria: [0.9, 0.9],
    smile: [0.7, 0.4], laugh: [0.8, 0.7], laughter: [0.8, 0.7], play: [0.6, 0.6],
    warm: [0.6, 0.3], warmth: [0.7, 0.3], tender: [0.7, 0.3], tenderness: [0.7, 0.3],
    sweet: [0.7, 0.3], sweetness: [0.7, 0.3], gentle: [0.6, 0.2], gently: [0.6, 0.2],
    kind: [0.7, 0.3], kindness: [0.8, 0.3], embrace: [0.7, 0.5], kiss: [0.8, 0.6],
    friend: [0.7, 0.4], friendship: [0.7, 0.4], companion: [0.6, 0.3],
    cherish: [0.8, 0.4], adore: [0.8, 0.6], affection: [0.7, 0.4], caress: [0.7, 0.4],
    comfort: [0.7, 0.2], soothe: [0.6, 0.2], console: [0.5, 0.3],
    home: [0.6, 0.2], hearth: [0.6, 0.2], welcome: [0.6, 0.4], belong: [0.6, 0.3],
    gratitude: [0.8, 0.3], grateful: [0.8, 0.3], thank: [0.6, 0.3], thanks: [0.6, 0.3],
    release: [0.3, 0.3], relief: [0.6, 0.2], forgive: [0.6, 0.3], forgiveness: [0.7, 0.3],
    mercy: [0.6, 0.3], compassion: [0.8, 0.3], generous: [0.7, 0.3], generosity: [0.7, 0.3],

    // ─ Hope, growth, triumph ─
    hope: [0.7, 0.5], hopeful: [0.7, 0.5], promise: [0.6, 0.5], faith: [0.6, 0.4],
    trust: [0.6, 0.3], courage: [0.7, 0.6], brave: [0.7, 0.6], bravery: [0.7, 0.6],
    strength: [0.6, 0.5], strong: [0.5, 0.5], power: [0.4, 0.7], powerful: [0.4, 0.7],
    triumph: [0.8, 0.8], victory: [0.8, 0.8], win: [0.7, 0.7], succeed: [0.7, 0.6],
    success: [0.7, 0.6], achieve: [0.6, 0.6], overcome: [0.6, 0.6], conquer: [0.5, 0.7],
    grow: [0.6, 0.4], growth: [0.6, 0.4], bloom: [0.8, 0.4], blossom: [0.8, 0.4],
    flourish: [0.8, 0.5], thrive: [0.8, 0.5], heal: [0.7, 0.3], healing: [0.7, 0.3],
    renew: [0.7, 0.4], renewal: [0.7, 0.4], reborn: [0.7, 0.6], rebirth: [0.7, 0.6],
    awaken: [0.6, 0.6], awakening: [0.6, 0.6], rise: [0.6, 0.6], rising: [0.6, 0.6],
    ascend: [0.6, 0.6], soar: [0.7, 0.7], fly: [0.6, 0.6], freedom: [0.8, 0.6],
    free: [0.7, 0.5], liberate: [0.7, 0.6], liberation: [0.7, 0.6],
    create: [0.6, 0.5], creation: [0.6, 0.5], creative: [0.6, 0.5], build: [0.5, 0.5],
    inspire: [0.7, 0.6], inspiration: [0.7, 0.6], dream: [0.6, 0.4], dreams: [0.6, 0.4],
    wonder: [0.7, 0.5], wondrous: [0.8, 0.6], marvel: [0.7, 0.6], awe: [0.6, 0.7],
    gift: [0.7, 0.4], blessing: [0.8, 0.4], blessed: [0.8, 0.4], grace: [0.8, 0.3],
    abundance: [0.7, 0.4], harvest: [0.6, 0.4], feast: [0.7, 0.6],

    // ─ Beauty, light, sacred ─
    beauty: [0.8, 0.4], beautiful: [0.8, 0.4], lovely: [0.7, 0.3], radiant: [0.8, 0.5],
    light: [0.6, 0.4], luminous: [0.7, 0.4], bright: [0.6, 0.5], brilliance: [0.7, 0.5],
    shine: [0.6, 0.5], shining: [0.6, 0.5], glow: [0.6, 0.3], glowing: [0.6, 0.3],
    dawn: [0.6, 0.4], sunrise: [0.7, 0.4], morning: [0.4, 0.4], spring: [0.6, 0.4],
    sun: [0.5, 0.4], sunlight: [0.6, 0.4], star: [0.5, 0.3], stars: [0.5, 0.3],
    golden: [0.6, 0.3], gold: [0.5, 0.4], silver: [0.4, 0.3], jewel: [0.5, 0.4],
    sacred: [0.6, 0.4], holy: [0.6, 0.4], divine: [0.7, 0.5], heaven: [0.7, 0.4],
    heavenly: [0.7, 0.4], paradise: [0.8, 0.4], eternal: [0.4, 0.3], infinite: [0.4, 0.4],
    soul: [0.4, 0.4], spirit: [0.4, 0.4], angel: [0.6, 0.4], miracle: [0.8, 0.6],
    prayer: [0.4, 0.3], temple: [0.4, 0.3], altar: [0.3, 0.3],
    pure: [0.6, 0.3], purity: [0.6, 0.3], innocent: [0.5, 0.3], innocence: [0.5, 0.3],
    truth: [0.5, 0.4], wisdom: [0.6, 0.3], wise: [0.6, 0.3], enlighten: [0.7, 0.5],
    glory: [0.7, 0.7], glorious: [0.7, 0.7], majesty: [0.6, 0.6], splendor: [0.7, 0.6],
    music: [0.6, 0.4], song: [0.6, 0.4], sing: [0.6, 0.5], dance: [0.7, 0.7],
    garden: [0.6, 0.2], flower: [0.7, 0.3], flowers: [0.7, 0.3], rose: [0.6, 0.3],

    // ─ Peace, stillness (positive, low arousal) ─
    peace: [0.7, 0.1], peaceful: [0.7, 0.1], calm: [0.6, 0.1], serene: [0.7, 0.1],
    serenity: [0.7, 0.1], tranquil: [0.7, 0.1], still: [0.3, 0.1], stillness: [0.4, 0.1],
    quiet: [0.3, 0.1], silence: [0.2, 0.1], silent: [0.2, 0.1], hush: [0.3, 0.1],
    rest: [0.5, 0.1], restful: [0.6, 0.1], repose: [0.5, 0.1], ease: [0.6, 0.2],
    soft: [0.5, 0.2], softly: [0.5, 0.2], slow: [0.2, 0.1],
    slowly: [0.2, 0.1], breathe: [0.4, 0.2], breath: [0.3, 0.2], breathing: [0.4, 0.2],
    sleep: [0.3, 0.1], lull: [0.4, 0.1], drift: [0.2, 0.2],
    float: [0.4, 0.2], floating: [0.4, 0.2], settle: [0.4, 0.2], ground: [0.3, 0.2],
    center: [0.4, 0.2], centered: [0.5, 0.2], balance: [0.5, 0.2], harmony: [0.7, 0.2],
    patience: [0.5, 0.1], patient: [0.4, 0.1], steady: [0.4, 0.2], anchor: [0.4, 0.2],
    meadow: [0.6, 0.2], stream: [0.5, 0.2], river: [0.4, 0.3], water: [0.3, 0.2],
    moon: [0.4, 0.2], moonlight: [0.5, 0.2], evening: [0.3, 0.2], twilight: [0.3, 0.2],

    // ─ Grief, loss, sorrow ─
    grief: [-0.8, 0.4], grieve: [-0.8, 0.4], mourn: [-0.8, 0.4], mourning: [-0.8, 0.4],
    sorrow: [-0.8, 0.4], sorrowful: [-0.8, 0.4], sad: [-0.7, 0.3], sadness: [-0.7, 0.3],
    weep: [-0.7, 0.5], weeping: [-0.7, 0.5], cry: [-0.6, 0.5], tears: [-0.6, 0.4],
    loss: [-0.7, 0.4], lost: [-0.6, 0.4], lose: [-0.6, 0.4], gone: [-0.5, 0.3],
    absence: [-0.5, 0.2], absent: [-0.4, 0.2], empty: [-0.5, 0.2], emptiness: [-0.6, 0.2],
    hollow: [-0.5, 0.2], void: [-0.4, 0.3], abyss: [-0.5, 0.5], vacant: [-0.4, 0.2],
    lonely: [-0.7, 0.3], loneliness: [-0.7, 0.3], alone: [-0.4, 0.2], solitude: [-0.1, 0.1],
    longing: [-0.3, 0.4], yearning: [-0.2, 0.4], ache: [-0.6, 0.4], aching: [-0.6, 0.4],
    heartbreak: [-0.8, 0.5], broken: [-0.7, 0.4], shattered: [-0.7, 0.6], wound: [-0.7, 0.5],
    wounded: [-0.7, 0.5], scar: [-0.5, 0.3], hurt: [-0.7, 0.5], pain: [-0.8, 0.6],
    painful: [-0.8, 0.6], suffer: [-0.8, 0.5], suffering: [-0.8, 0.5], anguish: [-0.8, 0.7],
    despair: [-0.9, 0.5], hopeless: [-0.8, 0.4], misery: [-0.8, 0.4], miserable: [-0.8, 0.4],
    regret: [-0.6, 0.3], remorse: [-0.6, 0.3], shame: [-0.7, 0.5], guilt: [-0.6, 0.4],
    farewell: [-0.4, 0.3], goodbye: [-0.4, 0.3], parting: [-0.4, 0.3], exile: [-0.6, 0.4],
    orphan: [-0.6, 0.3], widow: [-0.5, 0.3], funeral: [-0.7, 0.3], grave: [-0.6, 0.3],
    tomb: [-0.5, 0.3], burial: [-0.6, 0.3], ashes: [-0.5, 0.3], dust: [-0.3, 0.2],

    // ─ Fear, dread, darkness ─
    fear: [-0.7, 0.7], afraid: [-0.7, 0.7], terror: [-0.9, 0.9], terrified: [-0.9, 0.9],
    dread: [-0.8, 0.7], horror: [-0.9, 0.8], horrible: [-0.8, 0.7], horrific: [-0.9, 0.8],
    panic: [-0.8, 0.9], fright: [-0.7, 0.8], frightened: [-0.7, 0.8], scared: [-0.7, 0.7],
    anxiety: [-0.7, 0.7], anxious: [-0.6, 0.7], worry: [-0.6, 0.6], worried: [-0.6, 0.6],
    nervous: [-0.5, 0.6], tremble: [-0.6, 0.7], trembling: [-0.6, 0.7], shudder: [-0.6, 0.7],
    dark: [-0.4, 0.4], darkness: [-0.5, 0.4], shadow: [-0.3, 0.3], shadows: [-0.3, 0.3],
    night: [-0.1, 0.2], midnight: [-0.2, 0.3], gloom: [-0.6, 0.3], gloomy: [-0.6, 0.3],
    bleak: [-0.6, 0.3], grim: [-0.6, 0.4], dismal: [-0.6, 0.3], dreary: [-0.5, 0.2],
    cold: [-0.4, 0.3], freezing: [-0.5, 0.4], frost: [-0.3, 0.3], winter: [-0.2, 0.2],
    storm: [-0.4, 0.7], thunder: [-0.3, 0.7], lightning: [-0.2, 0.8], tempest: [-0.4, 0.8],
    danger: [-0.7, 0.8], dangerous: [-0.7, 0.8], threat: [-0.7, 0.7], menace: [-0.7, 0.7],
    peril: [-0.7, 0.7], doom: [-0.8, 0.6], curse: [-0.7, 0.6], cursed: [-0.7, 0.6],
    haunt: [-0.6, 0.5], haunted: [-0.6, 0.5], ghost: [-0.4, 0.5], demon: [-0.7, 0.7],
    hell: [-0.8, 0.7], nightmare: [-0.8, 0.7], monster: [-0.7, 0.7], serpent: [-0.4, 0.5],
    poison: [-0.8, 0.6], venom: [-0.7, 0.6], plague: [-0.8, 0.6], disease: [-0.8, 0.5],
    sick: [-0.7, 0.4], sickness: [-0.7, 0.4], fever: [-0.6, 0.6], madness: [-0.6, 0.7],

    // ─ Anger, violence, war ─
    anger: [-0.7, 0.8], angry: [-0.7, 0.8], rage: [-0.8, 0.9], fury: [-0.8, 0.9],
    furious: [-0.8, 0.9], wrath: [-0.8, 0.8], hate: [-0.9, 0.8], hatred: [-0.9, 0.8],
    war: [-0.7, 0.8], battle: [-0.5, 0.8], fight: [-0.5, 0.8], fighting: [-0.5, 0.8],
    enemy: [-0.7, 0.7], foe: [-0.6, 0.7], attack: [-0.7, 0.8], strike: [-0.5, 0.7],
    kill: [-0.9, 0.8], killing: [-0.9, 0.8], slay: [-0.8, 0.8], slaughter: [-0.9, 0.8],
    murder: [-0.9, 0.8], blood: [-0.5, 0.6], bleed: [-0.7, 0.6], bleeding: [-0.7, 0.6],
    sword: [-0.3, 0.6], blade: [-0.3, 0.6], weapon: [-0.5, 0.6], gun: [-0.6, 0.7],
    destroy: [-0.8, 0.8], destruction: [-0.8, 0.8], ruin: [-0.7, 0.6], ruins: [-0.5, 0.4],
    burn: [-0.5, 0.7], burning: [-0.5, 0.7], fire: [-0.2, 0.7], flames: [-0.2, 0.7],
    scream: [-0.7, 0.9], screaming: [-0.7, 0.9], shout: [-0.3, 0.8], roar: [-0.2, 0.8],
    violence: [-0.8, 0.8], violent: [-0.8, 0.8], cruel: [-0.8, 0.7], cruelty: [-0.8, 0.7],
    brutal: [-0.8, 0.7], savage: [-0.7, 0.7], fierce: [-0.4, 0.8], wild: [-0.1, 0.7],
    crush: [-0.6, 0.7], break: [-0.5, 0.6], smash: [-0.6, 0.7], tear: [-0.5, 0.6],
    betray: [-0.8, 0.6], betrayal: [-0.8, 0.6], traitor: [-0.8, 0.6], revenge: [-0.6, 0.7],
    conflict: [-0.5, 0.7], struggle: [-0.4, 0.6], strife: [-0.6, 0.7], chaos: [-0.5, 0.8],

    // ─ Death, endings ─
    death: [-0.8, 0.5], dead: [-0.7, 0.4], die: [-0.8, 0.5], dying: [-0.8, 0.5],
    dies: [-0.8, 0.5], perish: [-0.8, 0.5], corpse: [-0.8, 0.5], mortal: [-0.4, 0.4],
    mortality: [-0.4, 0.4], decay: [-0.6, 0.3], rot: [-0.7, 0.4], wither: [-0.6, 0.3],
    fade: [-0.4, 0.2], fading: [-0.4, 0.2], vanish: [-0.4, 0.3], end: [-0.3, 0.3],
    ending: [-0.3, 0.3], final: [-0.2, 0.4], last: [-0.2, 0.3], never: [-0.3, 0.4],
    fall: [-0.4, 0.5], falling: [-0.4, 0.5], fell: [-0.4, 0.5], collapse: [-0.6, 0.6],
    drown: [-0.8, 0.7], drowning: [-0.8, 0.7], suffocate: [-0.8, 0.7], starve: [-0.8, 0.6],

    // ─ Struggle-neutral / effort / urgency (arousal carriers) ─
    urgent: [-0.2, 0.8], urgency: [-0.2, 0.8], hurry: [-0.2, 0.7], rush: [-0.2, 0.7],
    race: [0.0, 0.7], run: [0.0, 0.6], running: [0.0, 0.6], chase: [-0.1, 0.7],
    leap: [0.2, 0.7], jump: [0.1, 0.6], climb: [0.1, 0.6], push: [0.0, 0.6],
    pull: [0.0, 0.5], grip: [-0.1, 0.6], grasp: [0.0, 0.5], seize: [0.0, 0.7],
    sudden: [-0.1, 0.7], suddenly: [-0.1, 0.7], burst: [0.0, 0.8], explode: [-0.3, 0.9],
    crash: [-0.5, 0.8], shock: [-0.5, 0.8], jolt: [-0.3, 0.8], alarm: [-0.5, 0.8],
    wake: [0.1, 0.6], waking: [0.1, 0.5], alert: [0.0, 0.7], watch: [0.0, 0.4],
    hunt: [-0.2, 0.7], hunger: [-0.5, 0.6], thirst: [-0.4, 0.5], desire: [0.3, 0.7],
    passion: [0.5, 0.8], lust: [0.1, 0.8], frenzy: [-0.3, 0.9],
    electric: [0.2, 0.8], spark: [0.3, 0.7], surge: [0.1, 0.8], pulse: [0.1, 0.6],

    // ─ Contemplative / neutral-cool (low arousal carriers) ─
    think: [0.0, 0.3], thought: [0.0, 0.3], mind: [0.0, 0.3], memory: [0.1, 0.3],
    remember: [0.1, 0.3], forget: [-0.3, 0.3], forgotten: [-0.4, 0.2], know: [0.2, 0.3],
    knowledge: [0.3, 0.3], understand: [0.3, 0.3], question: [0.0, 0.4], answer: [0.2, 0.3],
    mystery: [0.1, 0.4], mysterious: [0.1, 0.4], secret: [0.0, 0.4], hidden: [-0.1, 0.3],
    ancient: [0.1, 0.2], old: [-0.1, 0.2], time: [0.0, 0.2], ages: [0.0, 0.2],
    stone: [0.0, 0.2], mountain: [0.2, 0.3], sea: [0.1, 0.3], ocean: [0.2, 0.3],
    sky: [0.3, 0.2], cloud: [0.1, 0.2], clouds: [0.1, 0.2], mist: [0.0, 0.2],
    rain: [-0.1, 0.3], snow: [0.1, 0.2], wind: [0.0, 0.4], earth: [0.2, 0.2],
    tree: [0.3, 0.2], forest: [0.2, 0.3], root: [0.1, 0.2], roots: [0.1, 0.2],
    seed: [0.3, 0.2], path: [0.1, 0.3], journey: [0.3, 0.4], voyage: [0.3, 0.4],
    wander: [0.1, 0.3], return: [0.2, 0.3], begin: [0.3, 0.4], beginning: [0.3, 0.4],
    open: [0.3, 0.3], door: [0.1, 0.3], threshold: [0.1, 0.4], gate: [0.0, 0.3],
    deep: [0.0, 0.3], depth: [0.0, 0.3], vast: [0.1, 0.4], immense: [0.1, 0.4],
    small: [0.0, 0.2], little: [0.1, 0.2], brief: [-0.1, 0.3], moment: [0.1, 0.3],
    body: [0.1, 0.3], heart: [0.3, 0.4], hand: [0.1, 0.3], hands: [0.1, 0.3],
    eyes: [0.1, 0.3], voice: [0.1, 0.3], word: [0.1, 0.3], words: [0.1, 0.3],
    universe: [0.2, 0.4], cosmos: [0.2, 0.4], world: [0.1, 0.3], life: [0.4, 0.4],
    living: [0.4, 0.4], alive: [0.5, 0.5], born: [0.4, 0.4], birth: [0.4, 0.5],
    child: [0.4, 0.4], mother: [0.4, 0.3], father: [0.2, 0.3],

    // ─ Common evaluative adjectives ─
    good: [0.6, 0.3], great: [0.6, 0.5], wonderful: [0.8, 0.5], perfect: [0.7, 0.4],
    best: [0.7, 0.4], better: [0.4, 0.3], fine: [0.3, 0.2], noble: [0.6, 0.4],
    true: [0.4, 0.3], right: [0.4, 0.3], honest: [0.5, 0.3], honor: [0.6, 0.4],
    bad: [-0.6, 0.4], worse: [-0.6, 0.4], worst: [-0.7, 0.5], evil: [-0.8, 0.6],
    wicked: [-0.7, 0.6], wrong: [-0.5, 0.4], false: [-0.4, 0.3], lie: [-0.6, 0.4],
    lies: [-0.6, 0.4], ugly: [-0.6, 0.4], foul: [-0.7, 0.5], vile: [-0.8, 0.6],
    bitter: [-0.6, 0.4], harsh: [-0.5, 0.5], heavy: [-0.3, 0.3], weary: [-0.5, 0.2],
    tired: [-0.4, 0.2], exhausted: [-0.5, 0.3], weak: [-0.5, 0.3], frail: [-0.4, 0.2],
    poor: [-0.5, 0.3], rich: [0.4, 0.4], wealth: [0.3, 0.4], treasure: [0.5, 0.4]
};

// Words that flip the valence of the next few content words
const NEGATORS = new Set([
    'not', 'no', 'never', 'without', 'nothing', 'none', 'neither', 'nor',
    'cannot', 'cant', 'dont', 'wont', 'isnt', 'wasnt', 'arent', 'werent',
    'didnt', 'doesnt', 'hasnt', 'havent', 'shouldnt', 'wouldnt', 'couldnt'
]);

const NEGATION_SCOPE = 3;     // content words affected after a negator
const NEGATION_DAMP = -0.6;   // "not happy" is mildly negative, not fully inverted

// ─────────────────────────────────────────────────────────────
// Word lookup with light suffix fallback
// ─────────────────────────────────────────────────────────────

function lookupWord(raw) {
    const word = raw.toLowerCase().replace(/[^a-z']/g, '').replace(/'/g, '');
    if (!word) return null;
    if (LEXICON[word]) return LEXICON[word];

    // Suffix-stripping fallbacks, cheapest first
    const candidates = [];
    if (word.endsWith('s')) candidates.push(word.slice(0, -1));
    if (word.endsWith('es')) candidates.push(word.slice(0, -2));
    if (word.endsWith('ly')) candidates.push(word.slice(0, -2));
    if (word.endsWith('ed')) candidates.push(word.slice(0, -2), word.slice(0, -1));  // walked→walk, loved→love
    if (word.endsWith('ing')) candidates.push(word.slice(0, -3), word.slice(0, -3) + 'e'); // falling→fall, loving→love
    for (const c of candidates) {
        if (c.length >= 3 && LEXICON[c]) return LEXICON[c];
    }
    return { negator: NEGATORS.has(word) };
}

/**
 * Score a single chunk of text (one atom's content).
 * Returns { valence, arousal, hits } or null when no lexicon words found.
 */
export function scoreChunk(text) {
    if (!text || typeof text !== 'string') return null;
    const tokens = text.split(/\s+/).filter(Boolean);
    let v = 0, a = 0, hits = 0;
    let negationLeft = 0;

    for (const token of tokens) {
        const entry = lookupWord(token);
        if (!entry) continue;
        if (entry.negator !== undefined) {
            if (entry.negator) negationLeft = NEGATION_SCOPE;
            continue;
        }
        let [wv, wa] = entry;
        if (negationLeft > 0) {
            wv = wv * NEGATION_DAMP;
            negationLeft--;
        }
        v += wv;
        a += wa;
        hits++;
    }

    if (hits === 0) return null;
    return { valence: v / hits, arousal: a / hits, hits };
}

// ─────────────────────────────────────────────────────────────
// Track construction: raw scores → gap fill → forward-backward EMA
// ─────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function ema(values, alpha) {
    const out = new Array(values.length);
    let acc = values[0];
    for (let i = 0; i < values.length; i++) {
        acc = acc + alpha * (values[i] - acc);
        out[i] = acc;
    }
    return out;
}

/**
 * Score a full atom timeline into a smoothed control track.
 *
 * @param {Array} atoms - session atoms ({ content, duration, ... }); markers
 *                        and empty atoms are fine, they inherit via smoothing
 * @param {Object} options
 * @param {number} options.alpha - EMA smoothing factor per atom (default 0.12)
 * @returns {Array<{valence:number, arousal:number, confidence:number}>}
 */
export function scoreAtoms(atoms, options = {}) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    const alpha = options.alpha ?? 0.12;
    const n = atoms.length;

    // 1. Raw per-atom scores
    const rawV = new Array(n).fill(null);
    const rawA = new Array(n).fill(null);
    const conf = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        const score = scoreChunk(atoms[i]?.content);
        if (score) {
            rawV[i] = clamp(score.valence, -1, 1);
            rawA[i] = clamp(score.arousal, 0, 1);
            conf[i] = clamp(score.hits / 3, 0, 1);
        }
    }

    // 2. Fill gaps: carry last known value forward (neutral at the very start)
    let lastV = 0, lastA = 0.3;
    for (let i = 0; i < n; i++) {
        if (rawV[i] === null) { rawV[i] = lastV; rawA[i] = lastA; }
        else { lastV = rawV[i]; lastA = rawA[i]; }
    }

    // 3. Forward-backward EMA — zero-lag smoothing with anticipation:
    //    the backward pass lets the signal start turning before a passage does.
    const fwdV = ema(rawV, alpha);
    const bwdV = ema([...rawV].reverse(), alpha).reverse();
    const fwdA = ema(rawA, alpha);
    const bwdA = ema([...rawA].reverse(), alpha).reverse();

    const track = new Array(n);
    for (let i = 0; i < n; i++) {
        track[i] = {
            valence: clamp((fwdV[i] + bwdV[i]) / 2, -1, 1),
            arousal: clamp((fwdA[i] + bwdA[i]) / 2, 0, 1),
            confidence: conf[i]
        };
    }
    return track;
}

/**
 * Session-level summary of a track (mean/peak) — useful for choosing
 * presets or logging. Not required by subscribers.
 */
export function summarizeTrack(track) {
    if (!track || track.length === 0) {
        return { meanValence: 0, meanArousal: 0.3, peakArousal: 0.3 };
    }
    let v = 0, a = 0, peak = 0;
    for (const s of track) {
        v += s.valence;
        a += s.arousal;
        if (s.arousal > peak) peak = s.arousal;
    }
    return {
        meanValence: v / track.length,
        meanArousal: a / track.length,
        peakArousal: peak
    };
}
