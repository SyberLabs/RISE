/**
 * R.I.S.E. Source System
 * Deep Sacred Text Registry
 * 
 * This file contains high-fidelity, structured versions of sacred texts.
 * Unlike the flattened verses in sacred.js, these include:
 * - Specific [PAUSE] markers for delivery choreography
 * - Per-sequence WPM and state curve configurations
 * - Multi-part "chapters" for longer works
 */

export const SACRED_DEEP = {
    'tao-te-ching': {
        title: 'Tao Te Ching',
        author: 'Lao Tzu',
        translator: 'James Legge (1891)',
        category: 'sacred',
        tradition: 'Taoism',
        description: 'The classic Chinese text on the Way and its power. 81 verses on harmony with the Tao.',
        sequences: [
            {
                id: 'tao-1',
                name: 'Verse 1 — The Way',
                curve: 'induction',
                wpm: 140,
                content: `The Tao that can be told | is not the eternal Tao. | The name that can be named | is not the eternal name. | [PAUSE] | The nameless | is the beginning of heaven and earth. | The named | is the mother of ten thousand things. | [PAUSE] | Ever desireless, | one can see the mystery. | Ever desiring, | one can see the manifestations. | [PAUSE] | These two spring from the same source | but differ in name; | This appears as darkness. | Darkness within darkness. | The gate to all mystery.`
            },
            {
                id: 'tao-2',
                name: 'Verse 2 — Duality',
                curve: 'induction',
                wpm: 140,
                content: `Under heaven | all can see beauty as beauty | only because there is ugliness. | All can know good as good | only because there is evil. | [PAUSE] | Being and non-being | produce each other. | Difficult and easy | complement each other. | Long and short | contrast each other. | High and low | rest upon each other. | Voice and sound | harmonize each other. | Front and back | follow one another. | [PAUSE] | Therefore the sage | goes about doing nothing, | teaching no-talking. | The ten thousand things rise and fall | without cease. | Creating, yet not possessing. | Working, yet not taking credit. | Work is done, then forgotten. | Therefore it lasts forever.`
            },
            {
                id: 'tao-8',
                name: 'Verse 8 — Water',
                curve: 'induction',
                wpm: 140,
                content: `The highest good is like water. | Water gives life to the ten thousand things | and does not strive. | It flows in places men reject | and so is like the Tao. | [PAUSE] | In dwelling, be close to the land. | In meditation, go deep in the heart. | In dealing with others, be gentle and kind. | In speech, be true. | In ruling, be just. | In business, be competent. | In action, watch the timing. | [PAUSE] | No fight: no blame.`
            },
            {
                id: 'tao-11',
                name: 'Verse 11 — Use of Emptiness',
                curve: 'induction',
                wpm: 140,
                content: `Thirty spokes share the wheel's hub; | it is the center hole that makes it useful. | [PAUSE] | Shape clay into a vessel; | it is the space within that makes it useful. | [PAUSE] | Cut doors and windows for a room; | it is the holes which make it useful. | [PAUSE] | Therefore benefit comes from what is there; | usefulness from what is not there.`
            },
            {
                id: 'tao-16',
                name: 'Verse 16 — Stillness',
                curve: 'induction',
                wpm: 140,
                content: `Empty yourself of everything. | Let the mind rest at peace. | [PAUSE] | The ten thousand things rise and fall | while the Self watches their return. | They grow and flourish | and then return to the source. | [PAUSE] | Returning to the source is stillness, | which is the way of nature. | The way of nature is unchanging. | [PAUSE] | Knowing constancy is insight. | Not knowing constancy leads to disaster. | [PAUSE] | Knowing constancy, | the mind is open. | With an open mind, | you will be openhearted. | Being openhearted, | you will act royally. | Being royal, | you will attain the divine. | Being divine, | you will be at one with the Tao. | Being at one with the Tao is eternal. | And though the body dies, | the Tao will never pass away.`
            },
            {
                id: 'tao-81',
                name: 'Verse 81 — The Sage',
                curve: 'induction',
                wpm: 140,
                content: `True words are not beautiful; | beautiful words are not true. | [PAUSE] | Good men do not argue; | those who argue are not good. | [PAUSE] | Those who know are not learned; | the learned do not know. | [PAUSE] | The sage never tries to store things up. | The more he does for others, | the more he has. | The more he gives to others, | the greater his abundance. | [PAUSE] | The Tao of heaven | is pointed but does not harm. | The Tao of the sage | is work without effort.`
            }
        ]
    },

    'upanishads': {
        title: 'The Upanishads',
        author: 'Various Rishis',
        translator: 'Max Müller / Swami Nikhilananda',
        category: 'sacred',
        tradition: 'Hinduism / Vedanta',
        description: 'The philosophical core of the Vedas. Teachings on Brahman, Atman, and reality.',
        sequences: [
            {
                id: 'isha-1',
                name: 'Isha 1 — All This is Brahman',
                curve: 'induction',
                wpm: 100,
                content: `Īśā vāsyam idaṃ sarvaṃ | yat kiñca jagatyāṃ jagat | [PAUSE] | All this, | whatsoever moves in this moving world, | is enveloped by the Lord. | [PAUSE] | Renounce and enjoy. | Do not covet the possessions of others.`
            },
            {
                id: 'katha-razor',
                name: 'Katha — The Razor\'s Edge',
                curve: 'induction',
                wpm: 100,
                content: `Arise! Awake! | Having obtained your boons, | understand them. | [PAUSE] | The path is as sharp as a razor's edge, | difficult to tread and hard to cross — | so the wise say. | [PAUSE] | The Self is not born, | nor does it die. | It did not spring from anything, | nor did anything spring from it. | [PAUSE] | Unborn, | eternal, | everlasting, | ancient — | it is not slain | when the body is slain.`
            },
            {
                id: 'brihadaranyaka-asato-ma',
                name: 'Lead Me from Darkness',
                curve: 'induction',
                wpm: 80,
                content: `Asato mā sad gamaya | Tamaso mā jyotir gamaya | Mṛtyor mā amṛtaṃ gamaya | [PAUSE] | Lead me | from the unreal | to the Real. | Lead me | from darkness | to Light. | Lead me | from death | to Immortality. | [PAUSE] | Om. | Shanti, | shanti, | shanti.`
            }
        ]
    },

    'heart-sutra': {
        title: 'Heart Sutra',
        author: 'Traditional',
        translator: 'Edward Conze (adapted)',
        category: 'sacred',
        tradition: 'Buddhism',
        description: 'The essence of the Perfection of Wisdom teachings. A profound meditation on emptiness (śūnyatā).',
        sequences: [
            {
                id: 'heart-sutra-full',
                name: 'The Complete Heart Sutra',
                curve: 'induction',
                wpm: 120,
                content: `The Bodhisattva of Compassion, | when practicing deeply the Prajñāpāramitā, | perceived that all five skandhas are empty | and was saved from all suffering and distress. | [PAUSE] | Śāriputra, | form does not differ from emptiness, | emptiness does not differ from form. | That which is form is emptiness, | that which is emptiness is form. | [PAUSE] | The same is true of feelings, | perceptions, | impulses, | consciousness. | [PAUSE] | Śāriputra, | all dharmas are marked with emptiness; | they do not appear or disappear, | are not tainted or pure, | do not increase or decrease. | [PAUSE] | Therefore, in emptiness | no form, no feelings, | no perceptions, no impulses, no consciousness. | No eyes, no ears, no nose, no tongue, no body, no mind; | no color, no sound, no smell, no taste, no touch, no object of mind; | no realm of eyes | and so forth until no realm of mind consciousness. | [PAUSE] | No ignorance | and also no extinction of it, | and so forth until no old age and death | and also no extinction of them. | No suffering, no origination, no stopping, no path, | no cognition, | also no attainment | with nothing to attain. | [PAUSE] | The Bodhisattva depends on Prajñāpāramitā | and the mind is no hindrance; | without any hindrance no fears exist. | Far apart from every perverted view | one dwells in Nirvana. | [PAUSE] | In the three worlds | all Buddhas depend on Prajñāpāramitā | and attain Anuttara Samyak Sambodhi. | [PAUSE] | Therefore know that Prajñāpāramitā | is the great transcendent mantra, | is the great bright mantra, | is the utmost mantra, | is the supreme mantra, | which is able to relieve all suffering | and is true, not false. | [PAUSE] | So proclaim the Prajñāpāramitā mantra, | proclaim the mantra which says: | [PAUSE] | Gate gate pāragate pārasaṃgate bodhi svāhā. | [PAUSE] | Gone, gone, | gone beyond, | gone utterly beyond. | Enlightenment. | So be it.`
            },
            {
                id: 'heart-sutra-emptiness',
                name: 'Form is Emptiness',
                curve: 'induction',
                wpm: 100,
                content: `Form does not differ from emptiness, | emptiness does not differ from form. | [PAUSE] | That which is form | is emptiness. | That which is emptiness | is form. | [PAUSE] | The same is true of feelings, | perceptions, | impulses, | consciousness. | [PAUSE] | All dharmas are marked with emptiness; | they do not appear or disappear, | are not tainted or pure, | do not increase or decrease.`
            },
            {
                id: 'heart-sutra-mantra',
                name: 'The Gate Mantra',
                curve: 'induction',
                wpm: 80,
                content: `Gate gate pāragate pārasaṃgate bodhi svāhā. | [PAUSE] | Gone, | gone, | gone beyond, | gone utterly beyond. | [PAUSE] | Enlightenment. | [PAUSE] | So be it.`
            },
            {
                id: 'heart-sutra-no-hindrance',
                name: 'No Hindrance',
                curve: 'induction',
                wpm: 110,
                content: `The Bodhisattva depends on Prajñāpāramitā | and the mind is no hindrance; | [PAUSE] | without any hindrance | no fears exist. | [PAUSE] | Far apart from every perverted view | one dwells in Nirvana. | [PAUSE] | In the three worlds | all Buddhas depend on Prajñāpāramitā | and attain Anuttara Samyak Sambodhi. | [PAUSE] | Supreme perfect enlightenment.`
            }
        ]
    },

    'yoga-sutras': {
        title: 'Yoga Sutras',
        author: 'Patanjali',
        translator: 'Swami Vivekananda (1896)',
        category: 'sacred',
        tradition: 'Hinduism / Yoga',
        description: 'The foundational text of classical yoga. 196 aphorisms on the science of consciousness.',
        sequences: [
            {
                id: 'yoga-1-1',
                name: 'Sutra 1.1 — Now, Yoga',
                curve: 'induction',
                wpm: 100,
                content: `Atha yogānuśāsanam | [PAUSE] | Now, | the teachings of yoga. | [PAUSE] | Now — | not yesterday, | not tomorrow. | Now. | [PAUSE] | The instruction begins | in this moment.`
            },
            {
                id: 'yoga-1-2',
                name: 'Sutra 1.2 — Definition of Yoga',
                curve: 'induction',
                wpm: 100,
                content: `Yogaś citta-vṛtti-nirodhaḥ | [PAUSE] | Yoga is the cessation | of the movements of the mind. | [PAUSE] | The stilling | of the thought waves | in the consciousness. | [PAUSE] | When the lake of the mind | is still, | then the Self | is reflected clearly.`
            },
            {
                id: 'yoga-1-3',
                name: 'Sutra 1.3 — The Seer Abides',
                curve: 'induction',
                wpm: 100,
                content: `Tadā draṣṭuḥ svarūpe 'vasthānam | [PAUSE] | Then | the Seer | abides in its own nature. | [PAUSE] | When the waves are stilled, | who you truly are | becomes evident. | [PAUSE] | Pure awareness. | Unchanging witness.`
            },
            {
                id: 'yoga-1-12',
                name: 'Sutra 1.12 — Practice and Detachment',
                curve: 'induction',
                wpm: 110,
                content: `Abhyāsa-vairāgyābhyāṃ tan-nirodhaḥ | [PAUSE] | The cessation of the thought waves | is brought about | by practice and non-attachment. | [PAUSE] | Two wings. | Practice — | the effort. | Detachment — | the release. | [PAUSE] | Both are needed | to fly.`
            },
            {
                id: 'yoga-1-14',
                name: 'Sutra 1.14 — Firm Practice',
                curve: 'induction',
                wpm: 110,
                content: `Sa tu dīrgha-kāla-nairantarya-satkārāsevito dṛḍha-bhūmiḥ | [PAUSE] | Practice becomes firmly grounded | when well attended to | for a long time, | without break, | and with devotion. | [PAUSE] | Long time. | Without break. | With devotion. | [PAUSE] | This is how roots grow deep.`
            },
            {
                id: 'yoga-2-1',
                name: 'Sutra 2.1 — Kriya Yoga',
                curve: 'induction',
                wpm: 110,
                content: `Tapaḥ-svādhyāyeśvara-praṇidhānāni kriyā-yogaḥ | [PAUSE] | Yoga in action consists of: | Tapas — | discipline, | austerity, | heat. | Svādhyāya — | self-study, | reflection. | Īśvara praṇidhāna — | surrender to the divine. | [PAUSE] | Action. | Inquiry. | Devotion.`
            },
            {
                id: 'yoga-2-29',
                name: 'Sutra 2.29 — The Eight Limbs',
                curve: 'induction',
                wpm: 120,
                content: `Yama-niyamāsana-prāṇāyāma-pratyāhāra-dhāraṇā-dhyāna-samādhayo 'ṣṭāv aṅgāni | [PAUSE] | The eight limbs of yoga are: | Yama — | ethical restraints. | Niyama — | personal observances. | Āsana — | posture. | Prāṇāyāma — | breath control. | Pratyāhāra — | sense withdrawal. | Dhāraṇā — | concentration. | Dhyāna — | meditation. | Samādhi — | absorption. | [PAUSE] | Eight limbs. | One body. | One path.`
            },
            {
                id: 'yoga-2-46',
                name: 'Sutra 2.46 — Sthira Sukham Asanam',
                curve: 'induction',
                wpm: 100,
                content: `Sthira-sukham āsanam | [PAUSE] | Āsana is | a steady, comfortable posture. | [PAUSE] | Sthira — | stable, | firm, | unwavering. | Sukha — | ease, | comfort, | sweetness. | [PAUSE] | Not rigid. Not collapsed. | The middle way | of the body.`
            },
            {
                id: 'yoga-3-1',
                name: 'Sutra 3.1 — Dharana',
                curve: 'induction',
                wpm: 100,
                content: `Deśa-bandhaś cittasya dhāraṇā | [PAUSE] | Concentration is | binding the mind | to one place. | [PAUSE] | One point. | One focus. | All the scattered rays | gathered | into a single beam. | [PAUSE] | This is dhāraṇā.`
            },
            {
                id: 'yoga-3-2',
                name: 'Sutra 3.2 — Dhyana',
                curve: 'induction',
                wpm: 100,
                content: `Tatra pratyayaikatānatā dhyānam | [PAUSE] | Meditation is | the continuous flow | of awareness toward that point. | [PAUSE] | Concentration sustained. | Flow unbroken. | Like oil poured | from one vessel to another. | [PAUSE] | This is dhyāna.`
            },
            {
                id: 'yoga-3-3',
                name: 'Sutra 3.3 — Samadhi',
                curve: 'induction',
                wpm: 100,
                content: `Tad evārtha-mātra-nirbhāsaṃ svarūpa-śūnyam iva samādhiḥ | [PAUSE] | When only the object shines forth, | as if empty of one's own form, | that is samādhi. | [PAUSE] | The meditator dissolves. | Only the meditated remains. | No separation. | [PAUSE] | This is absorption.`
            },
            {
                id: 'yoga-4-34',
                name: 'Sutra 4.34 — Liberation',
                curve: 'induction',
                wpm: 100,
                content: `Puruṣārtha-śūnyānāṃ guṇānāṃ pratiprasavaḥ kaivalyaṃ svarūpa-pratiṣṭhā vā citi-śaktir iti | [PAUSE] | Liberation | is the return of the guṇas to their source, | having no further purpose to serve for the Self. | [PAUSE] | Or: | it is the power of pure awareness | established in its own nature. | [PAUSE] | The journey is complete. | Puruṣa rests in Puruṣa. | Awareness | aware of itself. | [PAUSE] | Kaivalya. | Aloneness. | Wholeness. | [PAUSE] | Iti. | Thus ends the teaching.`
            }
        ]
    },

    'hermetica': {
        title: 'The Hermetica',
        author: 'Hermes Trismegistus',
        translator: 'G.R.S. Mead / Brian Copenhaver',
        category: 'sacred',
        tradition: 'Hermeticism',
        description: 'Egyptian-Greek wisdom texts on the nature of the divine, cosmos, mind, and humanity. The foundation of Western esoteric tradition.',
        sequences: [
            {
                id: 'hermes-poimandres-1',
                name: 'Poimandres — The Vision',
                curve: 'induction',
                wpm: 110,
                content: `Once, when thought came to me | of the things that are, | and my thinking soared high | and my bodily senses were restrained, | [PAUSE] | I seemed to see a vast being | of boundless magnitude, | who called my name and said: | "What do you wish to hear and see, | and having seen, to learn and know?" | [PAUSE] | I said, | "Who are you?" | "I am Poimandres," he said, | "Mind of the Sovereignty. | I know what you wish, | and I am with you everywhere."`
            },
            {
                id: 'hermes-poimandres-2',
                name: 'Poimandres — Light and Darkness',
                curve: 'induction',
                wpm: 110,
                content: `I saw an endless vision | in which everything became light — | serene and joyful — | and I fell in love with it. | [PAUSE] | After a little while, | darkness arose separately | and descended — | fearful and gloomy, | coiling like a snake. | [PAUSE] | Then the darkness changed | into a watery nature, | unspeakably agitated, | giving off smoke as from fire | and producing an indescribable sound of groaning. | [PAUSE] | And from the light | a holy word came forth, | and untempered fire leapt up | out of the watery nature.`
            },
            {
                id: 'hermes-poimandres-3',
                name: 'Poimandres — The Human and the Divine',
                curve: 'induction',
                wpm: 110,
                content: `Mind, the Father of all, | being life and light, | gave birth to a human being | equal to himself. | [PAUSE] | This human was beautiful, | bearing the image of the Father. | For god fell in love | with his own form | and handed over to it | all his own creations. | [PAUSE] | And when humanity observed | what the craftsman had created, | it also wished to create. | And it entered | the craftsman's sphere.`
            },
            {
                id: 'hermes-key',
                name: 'The Key — As Above, So Below',
                curve: 'induction',
                wpm: 100,
                content: `That which is above | is like that which is below, | and that which is below | is like that which is above, | to accomplish the miracles of the One Thing. | [PAUSE] | And as all things arose | from the One by mediation of the One, | so all things were born | from this One Thing | by adaptation. | [PAUSE] | Its father is the Sun; | its mother is the Moon. | The Wind carried it in its womb; | its nurse is the Earth.`
            },
            {
                id: 'hermes-asclepius-1',
                name: 'Asclepius — The Great Miracle',
                curve: 'induction',
                wpm: 110,
                content: `A great miracle, Asclepius, | is humanity. | [PAUSE] | A being worthy of reverence and honor. | For humanity passes | into the nature of a god | as though it were itself a god. | [PAUSE] | Humanity knows the demonic kind | because it recognizes | that it shares their origin. | It despises the part of it | that is merely human, | for it has put its hope | in the divinity of its other part.`
            },
            {
                id: 'hermes-asclepius-2',
                name: 'Asclepius — Knowing God',
                curve: 'induction',
                wpm: 100,
                content: `Therefore, Asclepius, | attend to the one who speaks, | and understand. | [PAUSE] | For to reason about god | is not to speak, | but to know. | [PAUSE] | To know god | is to be silent about god. | Every other thing can be known, | expressed, and spoken of. | [PAUSE] | But the One | cannot be spoken or heard | except by silence and understanding.`
            },
            {
                id: 'hermes-mind-xi',
                name: 'Mind to Hermes — The All is Mind',
                curve: 'induction',
                wpm: 100,
                content: `Hermes, understand this: | God, | Eternity, | Cosmos, | Time, | Becoming. | [PAUSE] | God makes Eternity; | Eternity makes Cosmos; | Cosmos makes Time; | Time makes Becoming. | [PAUSE] | The essence of God | is, so to speak, | Mind. | The essence of Eternity | is permanence. | The essence of Cosmos | is order. | The essence of Time | is change. | The essence of Becoming | is life and death. | [PAUSE] | Energy of god is mind and soul; | energy of eternity | is permanence and immortality.`
            },
            {
                id: 'hermes-crater',
                name: 'The Crater — The Mixing Bowl',
                curve: 'induction',
                wpm: 110,
                content: `God filled a great bowl with mind | and sent it down, | appointing a herald | and commanding him to proclaim | to the hearts of humans: | [PAUSE] | "Baptize yourself in this bowl, | you who can, | you who believe | that you shall rise up again | to the one who sent down the bowl, | you who know why you came to be." | [PAUSE] | Those who heeded the proclamation | and were baptized in mind | came to share in knowledge | and became complete, | having received mind.`
            },
            {
                id: 'hermes-rebirth',
                name: 'On Rebirth — The Secret Teaching',
                curve: 'induction',
                wpm: 100,
                content: `Father, in the general teachings | you spoke in riddles | about divinity, | and you did not reveal yourself. | [PAUSE] | You said, | "No one can be saved | before rebirth." | [PAUSE] | When I asked to learn | the discourse on rebirth, | you said you would give it to me | when I was ready | to become a stranger to the world. | [PAUSE] | I have now made myself ready. | Father, complete my deficiency. | Teach me about rebirth.`
            },
            {
                id: 'hermes-rebirth-2',
                name: 'On Rebirth — The New Birth',
                curve: 'induction',
                wpm: 100,
                content: `Child, this wisdom | is to be understood in silence, | and the seed is the true good. | [PAUSE] | Who sows the seed? | The will of god, my child. | And who is the one begotten? | [PAUSE] | A child different from the father: | a god, | the son of god, | the All that is in All, | possessing all the powers. | [PAUSE] | Father, | I see the All, | and I see myself | in Mind. | This, my child, | is rebirth.`
            }
        ]
    },

    'gospel-of-thomas': {
        title: 'Gospel of Thomas',
        author: 'Didymos Judas Thomas',
        translator: 'Thomas O. Lambdin',
        category: 'sacred',
        tradition: 'Gnostic Christianity',
        description: '114 secret sayings of Jesus from the Nag Hammadi library. Gnostic wisdom on the inner kingdom.',
        sequences: [
            {
                id: 'thomas-1',
                name: 'Saying 1 — The Living Words',
                curve: 'induction',
                wpm: 120,
                content: `These are the secret sayings | which the living Jesus spoke | and which Didymos Judas Thomas wrote down. | [PAUSE] | And he said: | "Whoever finds the interpretation of these sayings | will not experience death."`
            },
            {
                id: 'thomas-2',
                name: 'Saying 2 — Seek and Find',
                curve: 'induction',
                wpm: 110,
                content: `Jesus said: | "Let him who seeks | continue seeking | until he finds. | [PAUSE] | When he finds, | he will become troubled. | When he becomes troubled, | he will be astonished. | And he will rule over all things."`
            },
            {
                id: 'thomas-3',
                name: 'Saying 3 — The Kingdom Within',
                curve: 'induction',
                wpm: 110,
                content: `Jesus said: | "If those who lead you say to you, | 'See, the Kingdom is in the sky,' | then the birds of the sky will precede you. | [PAUSE] | If they say to you, | 'It is in the sea,' | then the fish will precede you. | [PAUSE] | Rather, | the Kingdom is inside of you, | and it is outside of you. | [PAUSE] | When you come to know yourselves, | then you will become known, | and you will realize that it is you | who are the sons of the living Father."`
            },
            {
                id: 'thomas-5',
                name: 'Saying 5 — Nothing Hidden',
                curve: 'induction',
                wpm: 100,
                content: `Jesus said: | "Recognize what is in your sight, | and that which is hidden from you | will become plain to you. | [PAUSE] | For there is nothing hidden | which will not become manifest."`
            },
            {
                id: 'thomas-22',
                name: 'Saying 22 — Making the Two One',
                curve: 'induction',
                wpm: 110,
                content: `Jesus said: | "When you make the two one, | and when you make the inside like the outside | and the outside like the inside, | and the above like the below, | [PAUSE] | and when you make the male and the female | one and the same... | [PAUSE] | then you will enter the Kingdom."`
            },
            {
                id: 'thomas-42',
                name: 'Saying 42 — Become Passers-By',
                curve: 'induction',
                wpm: 80,
                content: `Jesus said: | [PAUSE] | "Become passers-by." | [PAUSE] | Become passers-by.`
            },
            {
                id: 'thomas-70',
                name: 'Saying 70 — What You Have Within',
                curve: 'induction',
                wpm: 100,
                content: `Jesus said: | "That which you have | will save you | if you bring it forth from yourselves. | [PAUSE] | That which you do not have within you | will kill you | if you do not have it within you."`
            },
            {
                id: 'thomas-77',
                name: 'Saying 77 — I Am the Light',
                curve: 'induction',
                wpm: 100,
                content: `Jesus said: | "It is I who am the light | which is above them all. | It is I who am the All. | [PAUSE] | From me did the All come forth, | and unto me did the All extend. | [PAUSE] | Split a piece of wood, | and I am there. | Lift up the stone, | and you will find me there."`
            },
            {
                id: 'thomas-108',
                name: 'Saying 108 — Drinking from My Mouth',
                curve: 'induction',
                wpm: 100,
                content: `Jesus said: | "He who will drink from my mouth | will become like me. | [PAUSE] | I myself shall become he, | and the things that are hidden | will be revealed to him."`
            },
            {
                id: 'thomas-113',
                name: 'Saying 113 — When Will the Kingdom Come',
                curve: 'induction',
                wpm: 110,
                content: `His disciples said to him: | "When will the Kingdom come?" | [PAUSE] | Jesus said: | "It will not come by waiting for it. | It will not be a matter of saying | 'Here it is' or 'There it is.' | [PAUSE] | Rather, | the Kingdom of the Father | is spread out upon the earth, | and men do not see it."`
            }
        ]
    }
};
