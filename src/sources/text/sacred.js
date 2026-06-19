/**
 * R.I.S.E. Source System
 * Sacred Text Provider
 * 
 * Provides curated verses and passages from sacred/wisdom texts.
 * These are bundled locally for reliability and consistent access.
 */

import { SourceProvider } from '../provider.js';

/**
 * Sacred text collection - curated verses from wisdom traditions
 */
export const SACRED_TEXTS = {
    'tao-te-ching': {
        title: 'Tao Te Ching',
        author: 'Lao Tzu',
        tradition: 'Taoist',
        tags: ['wisdom', 'nature', 'paradox', 'stillness'],
        verses: [
            "The Tao that can be told is not the eternal Tao. The name that can be named is not the eternal name.",
            "The Tao is like a well: used but never used up. It is like the eternal void: filled with infinite possibilities.",
            "Empty your mind of all thoughts. Let your heart be at peace. Watch the turmoil of beings, but contemplate their return.",
            "The highest good is like water. Water gives life to the ten thousand things and does not strive.",
            "Do you have the patience to wait till your mud settles and the water is clear?",
            "The Master does nothing, yet he leaves nothing undone.",
            "When I let go of what I am, I become what I might be.",
            "Those who know do not speak. Those who speak do not know.",
            "A good traveler has no fixed plans and is not intent on arriving.",
            "Nature does not hurry, yet everything is accomplished.",
            "Be content with what you have; rejoice in the way things are. When you realize there is nothing lacking, the whole world belongs to you.",
            "Knowing others is intelligence; knowing yourself is true wisdom. Mastering others is strength; mastering yourself is true power.",
            "Stop thinking, and end your problems. What difference between yes and no?",
            "The Tao nourishes all things. It gives them life without claiming authority."
        ]
    },

    'bhagavad-gita': {
        title: 'Bhagavad Gita',
        author: 'Vyasa',
        tradition: 'Hindu',
        tags: ['action', 'duty', 'self', 'liberation'],
        verses: [
            "You have the right to work, but never to the fruit of work.",
            "The mind is restless and difficult to restrain, but it is subdued by practice.",
            "When meditation is mastered, the mind is unwavering like the flame of a lamp in a windless place.",
            "There was never a time when I did not exist, nor you, nor any of these kings. Nor is there any future in which we shall cease to be.",
            "The soul can never be cut into pieces by any weapon, nor can he be burned by fire, nor moistened by water, nor withered by the wind.",
            "Whatever happened, happened for the good. Whatever is happening, is happening for the good. Whatever will happen, will also happen for the good.",
            "Change is the law of the universe. What you think of as death, is indeed life.",
            "Set your heart upon your work, but never on its reward.",
            "A person can rise through the efforts of his own mind; or draw himself down, in the same manner. Because each person is his own friend or enemy.",
            "Reshape yourself through the power of your will. Those who have conquered themselves live in peace.",
            "The wise see that there is action in the midst of inaction and inaction in the midst of action.",
            "Through selfless service, you will always be fruitful and find the fulfillment of your desires."
        ]
    },

    'dhammapada': {
        title: 'Dhammapada',
        author: 'Buddha',
        tradition: 'Buddhist',
        tags: ['mind', 'suffering', 'liberation', 'wisdom'],
        verses: [
            "What we are today comes from our thoughts of yesterday, and our present thoughts build our life of tomorrow. Our life is the creation of our mind.",
            "There is no path to happiness: happiness is the path.",
            "In the end, only three things matter: how much you loved, how gently you lived, and how gracefully you let go of things not meant for you.",
            "Holding on to anger is like grasping a hot coal with the intent of throwing it at someone else; you are the one who gets burned.",
            "No one saves us but ourselves. No one can and no one may. We ourselves must walk the path.",
            "The mind is everything. What you think you become.",
            "Peace comes from within. Do not seek it without.",
            "Thousands of candles can be lighted from a single candle, and the life of the candle will not be shortened.",
            "An idea that is developed and put into action is more important than an idea that exists only as an idea.",
            "You yourself must strive. The Buddhas only point the way.",
            "Better than a thousand hollow words, is one word that brings peace.",
            "Hatred does not cease through hatred at any time. Hatred ceases through love."
        ]
    },

    'rumi': {
        title: 'Selected Poems',
        author: 'Jalal ad-Din Rumi',
        tradition: 'Sufi',
        tags: ['love', 'mystical', 'poetry', 'ecstatic'],
        verses: [
            "What you seek is seeking you.",
            "The wound is the place where the Light enters you.",
            "You are not a drop in the ocean. You are the entire ocean in a drop.",
            "Let yourself be silently drawn by the strange pull of what you really love. It will not lead you astray.",
            "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.",
            "Out beyond ideas of wrongdoing and rightdoing, there is a field. I'll meet you there.",
            "Stop acting so small. You are the universe in ecstatic motion.",
            "Silence is the language of God, all else is poor translation.",
            "Don't grieve. Anything you lose comes round in another form.",
            "Be empty of worrying. Think of who created thought.",
            "Set your life on fire. Seek those who fan your flames.",
            "This being human is a guest house. Every morning a new arrival. Welcome and entertain them all.",
            "Raise your words, not your voice. It is rain that grows flowers, not thunder.",
            "Wear gratitude like a cloak and it will feed every corner of your life."
        ]
    },

    'i-ching': {
        title: 'I Ching',
        author: 'Ancient Chinese',
        tradition: 'Chinese',
        tags: ['change', 'wisdom', 'balance', 'nature'],
        verses: [
            "Heaven and Earth determine the direction. The forces of mountain and lake are united.",
            "The Creative knows the great beginnings. The Receptive completes the finished things.",
            "Nature creates all beings and does not hold possession of them.",
            "Perseverance furthers. Everything serves to further.",
            "All movement is accomplished in six stages, and the seventh brings return.",
            "The superior person understands the transitory in the light of the eternity of the end.",
            "The mountain rests on the earth: the image of Modesty.",
            "Fire rises, water sinks down. The forces of nature work together.",
            "The superior person acts before speaking and speaks according to their actions.",
            "In the midst of danger, the superior person develops character."
        ]
    },

    'upanishads': {
        title: 'Upanishads',
        author: 'Ancient Sages',
        tradition: 'Hindu',
        tags: ['self', 'consciousness', 'reality', 'liberation'],
        verses: [
            "Tat tvam asi. That thou art.",
            "As is the human body, so is the cosmic body. As is the human mind, so is the cosmic mind.",
            "From the unreal lead me to the real. From darkness lead me to light. From death lead me to immortality.",
            "The Self is one. Unmoving, it moves faster than the mind.",
            "He who sees all beings in the Self and the Self in all beings, never turns away from It.",
            "The Self, smaller than the smallest, greater than the greatest, is hidden in the heart of each creature.",
            "When all the knots of the heart are cut asunder, then the mortal becomes immortal.",
            "In the beginning there was Existence alone - One only, without a second.",
            "The eye cannot see it; the mind cannot grasp it. The deathless Self has neither caste nor race.",
            "The Self is the lord of all, inhabitant of the hearts of all."
        ]
    },

    'marcus-aurelius': {
        title: 'Meditations (Selected)',
        author: 'Marcus Aurelius',
        tradition: 'Stoic',
        tags: ['stoic', 'virtue', 'acceptance', 'wisdom'],
        verses: [
            "The happiness of your life depends upon the quality of your thoughts.",
            "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.",
            "Waste no more time arguing about what a good man should be. Be one.",
            "You have power over your mind - not outside events. Realize this, and you will find strength.",
            "Never let the future disturb you. You will meet it, if you have to, with the same weapons of reason.",
            "The universe is change; our life is what our thoughts make it.",
            "Accept the things to which fate binds you, and love the people with whom fate brings you together.",
            "Look back over the past, with its changing empires that rose and fell, and you can foresee the future too.",
            "When you arise in the morning, think of what a precious privilege it is to be alive.",
            "If it is not right, do not do it; if it is not true, do not say it.",
            "The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane.",
            "How much more grievous are the consequences of anger than the causes of it."
        ]
    },

    'zen-koans': {
        title: 'Zen Koans',
        author: 'Various Masters',
        tradition: 'Zen Buddhist',
        tags: ['paradox', 'awakening', 'mind', 'zen'],
        verses: [
            "What is the sound of one hand clapping?",
            "Show me your original face, the face you had before your parents were born.",
            "If you meet the Buddha on the road, kill him.",
            "What is the Buddha? Three pounds of flax.",
            "When you can do nothing, what can you do?",
            "Sitting quietly, doing nothing, spring comes, and the grass grows by itself.",
            "The moon does not fight. It attacks no one. And yet it can take away your breath.",
            "To study the Buddha Way is to study the self. To study the self is to forget the self.",
            "Before enlightenment, chop wood, carry water. After enlightenment, chop wood, carry water.",
            "When thoughts arise, then do all things arise. When thoughts vanish, then do all things vanish.",
            "The wild geese do not intend to cast their reflection. The water has no mind to receive their image.",
            "Move and the way will open."
        ]
    }
};

/**
 * Provider for bundled sacred/wisdom texts
 */
export class SacredTextProvider extends SourceProvider {
    constructor() {
        super({
            id: 'sacred-texts',
            name: 'Sacred Texts',
            contentType: 'text',
            tier: 2, // Sacred tier
            description: 'Curated verses from wisdom traditions',
            supportsSearch: true,
            supportsPreload: false
        });

        // Index for fast lookup
        this._textIndex = new Map();
        this._verseIndex = [];
    }

    /**
     * @override
     */
    async _doInit() {
        // Build indexes
        for (const [id, text] of Object.entries(SACRED_TEXTS)) {
            this._textIndex.set(id, text);

            // Index each verse for random access
            for (let i = 0; i < text.verses.length; i++) {
                this._verseIndex.push({
                    textId: id,
                    verseIndex: i,
                    text: text.verses[i],
                    metadata: {
                        title: text.title,
                        author: text.author,
                        tradition: text.tradition
                    }
                });
            }
        }

        console.log(`[SacredTextProvider] Indexed ${this._textIndex.size} texts, ${this._verseIndex.length} verses`);
    }

    /**
     * @override
     * List available sacred texts
     */
    async list(filter = {}) {
        let texts = Object.entries(SACRED_TEXTS);

        // Filter by tradition
        if (filter.tradition) {
            texts = texts.filter(([_, text]) =>
                text.tradition.toLowerCase() === filter.tradition.toLowerCase()
            );
        }

        // Filter by tags
        if (filter.tags && filter.tags.length > 0) {
            texts = texts.filter(([_, text]) =>
                filter.tags.some(tag => text.tags.includes(tag))
            );
        }

        return texts.map(([id, text]) => ({
            id,
            type: 'text',
            name: text.title,
            data: text.verses,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: text.author,
                tradition: text.tradition,
                tags: text.tags,
                verseCount: text.verses.length
            }
        }));
    }

    /**
     * @override
     * Get all verses from a text
     */
    async get(textId) {
        const text = SACRED_TEXTS[textId];
        if (!text) return null;

        return {
            id: textId,
            type: 'text',
            name: text.title,
            data: text.verses,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: text.author,
                tradition: text.tradition,
                tags: text.tags,
                verseCount: text.verses.length
            }
        };
    }

    /**
     * Get a random verse from a specific text or any text
     * @param {string} [textId] - Specific text, or random if not specified
     * @returns {Object}
     */
    getRandomVerse(textId = null) {
        if (textId) {
            const text = SACRED_TEXTS[textId];
            if (!text) return null;

            const verseIdx = Math.floor(Math.random() * text.verses.length);
            return {
                id: `${textId}-${verseIdx}`,
                type: 'text',
                name: `${text.title} (verse)`,
                data: text.verses[verseIdx],
                providerId: this.id,
                tier: this.tier,
                metadata: {
                    textId,
                    title: text.title,
                    author: text.author,
                    tradition: text.tradition,
                    isVerse: true
                }
            };
        }

        // Random from all verses
        const verse = this._verseIndex[Math.floor(Math.random() * this._verseIndex.length)];
        return {
            id: `${verse.textId}-${verse.verseIndex}`,
            type: 'text',
            name: `${verse.metadata.title} (verse)`,
            data: verse.text,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                textId: verse.textId,
                ...verse.metadata,
                isVerse: true
            }
        };
    }

    /**
     * @override
     */
    async getRandom(filter = {}) {
        return this.getRandomVerse(filter.textId);
    }

    /**
     * @override
     * Search through verses
     */
    async search(query, filter = {}) {
        const lowerQuery = query.toLowerCase();

        const matches = this._verseIndex
            .filter(verse => verse.text.toLowerCase().includes(lowerQuery))
            .slice(0, 20) // Limit results
            .map(verse => ({
                id: `${verse.textId}-${verse.verseIndex}`,
                type: 'text',
                name: `${verse.metadata.title}`,
                data: verse.text,
                providerId: this.id,
                tier: this.tier,
                metadata: {
                    textId: verse.textId,
                    ...verse.metadata,
                    isVerse: true
                }
            }));

        return matches;
    }

    /**
     * Get all traditions available
     * @returns {string[]}
     */
    getTraditions() {
        const traditions = new Set();
        for (const text of Object.values(SACRED_TEXTS)) {
            traditions.add(text.tradition);
        }
        return Array.from(traditions);
    }

    /**
     * Get texts by tradition
     * @param {string} tradition
     * @returns {Object[]}
     */
    getByTradition(tradition) {
        return Object.entries(SACRED_TEXTS)
            .filter(([_, text]) => text.tradition === tradition)
            .map(([id, text]) => ({
                id,
                title: text.title,
                author: text.author,
                verseCount: text.verses.length
            }));
    }
}

// Toltec/Shamanic Wisdom - Castaneda-inspired
SACRED_TEXTS['wheel-of-time'] = {
    title: 'The Wheel of Time',
    author: 'Toltec Tradition',
    tradition: 'Shamanic',
    tags: ['perception', 'intent', 'dreaming', 'awareness'],
    verses: [
        "We are perceivers. We are awareness; we are not objects; we have no solidity. We are boundless.",
        "The world is such-and-such or so-and-so only because we tell ourselves that that is the way it is.",
        "A warrior takes his lot, whatever it may be, and accepts it in ultimate humbleness.",
        "Death is the only wise adviser that we have. Whenever you feel that everything is going wrong, turn to your death and ask if that is so.",
        "The trick is in what one emphasizes. We either make ourselves miserable, or we make ourselves happy. The amount of work is the same.",
        "Intent is not a thought, or an object, or a wish. Intent is what can make a man succeed when his thoughts tell him that he is defeated.",
        "We talk to ourselves incessantly about our world. In fact we maintain our world with our internal talk.",
        "A warrior must focus his attention on the link between himself and his death, without remorse or sadness or worrying.",
        "The basic difference between an ordinary man and a warrior is that a warrior takes everything as a challenge, while an ordinary man takes everything as a blessing or a curse.",
        "Self-importance is our greatest enemy. Think about it - what weakens us is feeling offended by the deeds and misdeeds of our fellow men.",
        "To seek freedom is the only driving force I know. Freedom to fly off into that infinity out there.",
        "Power rests on the kind of knowledge one holds. What is the sense of knowing things that are useless?",
        "Things don't change. You change your way of looking, that's all.",
        "We either make ourselves miserable or we make ourselves strong. The amount of work is the same.",
        "The world doesn't yield to us directly. The world yields to us only in the wake of our intent."
    ]
};

SACRED_TEXTS['emerald-tablet'] = {
    title: 'The Emerald Tablet',
    author: 'Hermes Trismegistus',
    tradition: 'Hermetic',
    tags: ['alchemy', 'correspondence', 'transmutation', 'unity'],
    verses: [
        "As above, so below; as below, so above. As within, so without; as without, so within.",
        "The Sun is its father, the Moon its mother, the Wind has carried it in its belly, the Earth is its nurse.",
        "Separate the Earth from Fire, the subtle from the gross, gently and with great ingenuity.",
        "It rises from Earth to Heaven and descends again to Earth, thereby combining within itself the powers of both the Above and the Below.",
        "This is the strong force of all forces, overcoming every subtle and penetrating every solid thing.",
        "In this way was the world created. From this come many wondrous applications, because this is the pattern.",
        "What I have to tell is the greatest of all secrets. I have told you the whole operation of the Sun.",
        "Its power is complete when it is turned towards the Earth.",
        "The father of all perfection in the whole world is here. Its force is above all force.",
        "Thou shalt separate the earth from the fire, the subtle from the gross, suavely, and with great ingenuity."
    ]
};

SACRED_TEXTS['corpus-hermeticum'] = {
    title: 'Corpus Hermeticum',
    author: 'Hermes Trismegistus',
    tradition: 'Hermetic',
    tags: ['gnosis', 'divine', 'mind', 'cosmos'],
    verses: [
        "The Mind, O Tat, is of the very essence of God. What that essence is, God alone knows exactly.",
        "God is not a mind, but the cause that the mind exists; not a spirit, but the cause that spirit exists; not light, but the cause that light exists.",
        "If then you do not make yourself equal to God, you cannot apprehend God; for like is known by like.",
        "Leap clear of all that is corporeal, and make yourself grow to a like expanse with that greatness which is beyond all measure.",
        "For nothing in the universe is hidden from Mind. All things are clear before it, transparent and unclouded.",
        "The vision of the Good is not like the beam of the sun, which makes the eyes blind by its very brilliance.",
        "I am the light you saw. I am Mind, your God, who existed before the watery substance appeared out of the darkness.",
        "All things are parts of God; therefore God is all things. In creating all things, God created himself.",
        "For God contains all things, and there is nothing that is not in God, and nothing which God is not.",
        "The soul is immortal, and immortality is the continuation of life. Just as the cosmos is eternal, so too is the soul eternal."
    ]
};
