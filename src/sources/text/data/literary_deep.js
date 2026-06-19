/**
 * R.I.S.E. Source System
 * Local Literary Deep Registry
 *
 * Curated passages from classic literature and philosophy.
 * Self-contained, no external requests — premium excerpts
 * pre-formatted with [PAUSE] choreography for chamber sessions.
 */

export const LITERARY_DEEP = {

    'meditations': {
        title: 'Meditations',
        author: 'Marcus Aurelius',
        translator: 'George Long (1862)',
        category: 'literary',
        tradition: 'Stoic Philosophy',
        description: 'Private journals of a Roman emperor. Stoic practice applied to the demands of power and mortality.',
        sequences: [
            {
                id: 'med-begin',
                name: 'Book II \u2014 Begin the Morning',
                curve: 'induction',
                wpm: 130,
                content: `Begin the morning | by saying to yourself: | I shall encounter | meddling, | ungrateful, | violent, | treacherous, | envious, | unsociable people. | [PAUSE] | But all of this arises | from their ignorance | of good and evil. | [PAUSE] | I, however, | who have seen the nature of good | and its beauty, | and evil | and its ugliness, | can neither be injured | by any of them, | for no one can implicate me | in what is degrading, | nor can I be angry | with my kinsman, | nor hate them. | [PAUSE] | For we are made for cooperation, | like feet, | like hands, | like eyelids, | like the rows | of the upper and lower teeth.`
            },
            {
                id: 'med-present',
                name: 'Book VIII \u2014 This Moment',
                curve: 'induction',
                wpm: 120,
                content: `Do not disturb yourself | by picturing your life as a whole. | Do not assemble | many troubles, | past and future, | into one view. | [PAUSE] | Ask yourself: | what is there in this | that is unbearable | and beyond endurance? | You would be ashamed | to confess it. | [PAUSE] | Remind yourself too | that it is neither the future | nor the past | that weighs on you, | but always the present alone \u2014 | and the present's burden | grows less when considered alone | and contained.`
            },
            {
                id: 'med-change',
                name: 'Book IX \u2014 All Things Pass',
                curve: 'induction',
                wpm: 110,
                content: `Loss is nothing else | but change. | And change is Nature's delight. | [PAUSE] | In the morning | when you rise unwillingly, | let this thought be present: | I am rising to the work | of a human being. | [PAUSE] | Why then am I dissatisfied | if I am going to do | the things for which I exist | and for which I was brought into the world? | [PAUSE] | Or is this the purpose | of my creation: | to lie in the bed covers | and keep myself warm? | It is so much more pleasant. | Were you born for pleasure? | In general, | were you born for feeling | or for exertion?`
            },
            {
                id: 'med-opinion',
                name: 'Book IV \u2014 Remove the Opinion',
                curve: 'induction',
                wpm: 110,
                content: `Remove the opinion | and the complaint, | "I have been harmed," | and the harm is removed. | [PAUSE] | The impediment to action | advances action. | What stands in the way | becomes the way. | [PAUSE] | The universe is change; | our life is what | our thoughts make it.`
            },
            {
                id: 'med-flame',
                name: 'Book VI \u2014 Flame',
                curve: 'induction',
                wpm: 100,
                content: `Loss is nothing else | but change, | and change is Nature's delight. | [PAUSE] | Look within. | Within is the fountain of good | and it will always spring | if you always look there. | [PAUSE] | Confine yourself to the present. | [PAUSE] | You have power over your mind, | not outside events. | Realize this, | and you will find strength.`
            }
        ]
    },

    'leaves-of-grass': {
        title: 'Leaves of Grass',
        author: 'Walt Whitman',
        translator: null,
        category: 'literary',
        tradition: 'American Poetry',
        description: 'Radical self-assertion and cosmic unity. Whitman singing to the body electric and the open road.',
        sequences: [
            {
                id: 'grass-myself',
                name: 'Song of Myself \u2014 I Celebrate',
                curve: 'induction',
                wpm: 130,
                content: `I celebrate myself, | and sing myself, | and what I assume | you shall assume, | for every atom belonging to me | as good belongs to you. | [PAUSE] | I loafe | and invite my soul, | I lean and loafe | at my ease | observing a spear | of summer grass. | [PAUSE] | Stop this day and night | with me | and you shall possess | the origin of all poems, | you shall possess | the good of the earth and sun, | there are millions of suns left.`
            },
            {
                id: 'grass-multitudes',
                name: 'Song of Myself \u2014 I Contain Multitudes',
                curve: 'induction',
                wpm: 120,
                content: `Do I contradict myself? | Very well then I contradict myself. | [PAUSE] | I am large. | I contain multitudes. | [PAUSE] | The past and present wilt \u2014 | I have filled them, | emptied them, | and proceed to fill | my next fold of the future. | [PAUSE] | I am not contained | between my hat and boots. | [PAUSE] | I exist as I am, | that is enough. | If no other in the world | be aware I sit content, | And if each and all | be aware I sit content.`
            },
            {
                id: 'grass-road',
                name: 'Song of the Open Road',
                curve: 'induction',
                wpm: 140,
                content: `Afoot and light-hearted | I take to the open road, | healthy, free, | the world before me, | the long brown path before me | leading wherever I choose. | [PAUSE] | Henceforth I ask not | good-fortune, | I myself am good-fortune. | Henceforth I whimper no more, | postpone no more, | need nothing, | done with indoor complaints, | libraries, | querulous criticisms, | strong and content | I travel the open road. | [PAUSE] | The earth \u2014 that is sufficient. | I do not want the constellations | any nearer, | I know they are very well | where they are.`
            },
            {
                id: 'grass-body',
                name: 'I Sing the Body Electric',
                curve: 'induction',
                wpm: 130,
                content: `I sing the body electric, | the armies of those I love | engirth me | and I engirth them. | [PAUSE] | They will not let me off | till I go with them, | respond to them, | and discorrupt them, | and charge them full | with the charge of the soul. | [PAUSE] | Was it doubted | that those who corrupt | their own bodies | conceal themselves? | And if those who defile | the living are as bad | as they who defile the dead? | [PAUSE] | And if the body does not do fully | as much as the soul? | And if the body were not the soul, | what is the soul?`
            }
        ]
    },

    'thus-spoke-zarathustra': {
        title: 'Thus Spoke Zarathustra',
        author: 'Friedrich Nietzsche',
        translator: 'Thomas Common (1909)',
        category: 'literary',
        tradition: 'Philosophy',
        description: 'Zarathustra descends from isolation to teach the Overman, eternal return, and the will to power.',
        sequences: [
            {
                id: 'zara-prologue',
                name: 'Prologue \u2014 The Sun',
                curve: 'induction',
                wpm: 120,
                content: `When Zarathustra was thirty years old | he left his home | and the lake of his home, | and went into the mountains. | [PAUSE] | Here he enjoyed his spirit and his solitude | and for ten years | did not tire of it. | [PAUSE] | But at last | a change came over his heart \u2014 | and one morning | he rose with the dawn, | stepped before the sun, | and spoke to it. | [PAUSE] | Thou great star! | What would be thy happiness | if thou hadst not | those for whom thou shinest! | [PAUSE] | I am weary of my wisdom | like the bee | that hath gathered too much honey; | I need hands | outstretched | to take it.`
            },
            {
                id: 'zara-three',
                name: 'Three Metamorphoses',
                curve: 'induction',
                wpm: 120,
                content: `Three metamorphoses of the spirit | do I designate to you: | how the spirit becometh a camel, | the camel a lion, | and the lion at last | a child. | [PAUSE] | Much is heavy to the spirit, | to the strong, | reverent spirit that would bear much: | and the heavy, | the heaviest, | it seeketh. | [PAUSE] | But in the loneliest wilderness | happeneth the second metamorphosis: | here the spirit becometh a lion; | freedom will it capture, | and lordship | in its own wilderness. | [PAUSE] | But why must the preying lion | still become a child? | Innocence is the child, | and forgetfulness, | a new beginning, | a game, | a self-rolling wheel, | a first movement, | a holy Yea.`
            },
            {
                id: 'zara-dance',
                name: 'The Dancing Song',
                curve: 'induction',
                wpm: 130,
                content: `Into thine eyes gazed I lately | O Life! | And into the unfathomable | did I there seem to sink. | [PAUSE] | But thou pulledst me out with a golden angle; | derisively didst thou laugh | when I called thee unfathomable. | [PAUSE] | Such is the language | of all fish, saidst thou; | what they do not fathom | is unfathomable. | [PAUSE] | But changeable am I only, | and wild, | and altogether a woman, | and no virtuous one. | [PAUSE] | Though ye call me | the deep one, | or the faithful one, | the eternal one, | the mysterious one \u2014 | ye men | always give unto us | your own virtues.`
            }
        ]
    },

    'walden': {
        title: 'Walden',
        author: 'Henry David Thoreau',
        translator: null,
        category: 'literary',
        tradition: 'American Transcendentalism',
        description: 'Two years alone by a pond. Simplicity, nature, and the examined life as radical act.',
        sequences: [
            {
                id: 'walden-deliberate',
                name: 'Why I Went to the Woods',
                curve: 'induction',
                wpm: 130,
                content: `I went to the woods | because I wished to live deliberately, | to front only the essential facts of life, | and see if I could not learn | what it had to teach, | and not, when I came to die, | discover that I had not lived. | [PAUSE] | I did not wish to live | what was not life, | living is so dear; | nor did I wish to practice resignation, | unless it was quite necessary. | [PAUSE] | I wanted to live deep | and suck out all the marrow of life, | to live so sturdily | and Spartan-like | as to put to rout | all that was not life, | and not, when I had come to dying, | discover that I had not lived.`
            },
            {
                id: 'walden-morning',
                name: 'Morning \u2014 Awakening',
                curve: 'induction',
                wpm: 110,
                content: `Every morning | was a cheerful invitation | to make my life | of equal simplicity, | and I may say innocence, | with Nature herself. | [PAUSE] | I have been as sincere | a worshipper of Aurora | as the Greeks. | I got up early and bathed in the pond; | that was a religious exercise | and one of the best things | I did. | [PAUSE] | The morning, | which is the most memorable season of the day, | is the awakening hour. | Then there is least somnolence in us; | and for an hour, | at least, | some part of us | awakes which slumbers | all the rest of the day and night.`
            },
            {
                id: 'walden-simplify',
                name: 'Where I Lived \u2014 Simplify',
                curve: 'induction',
                wpm: 120,
                content: `Simplicity, | simplicity, | simplicity! | I say, | let your affairs be as two or three, | and not a hundred or a thousand; | instead of a million, | count half a dozen. | [PAUSE] | In the midst of this chopping sea | of civilized life, | such are the clouds and storms | and quicksands | and thousand-and-one items | to be allowed for, | that a man has to live, | if he would not founder and go to the bottom, | and not make his port at all, | by dead reckoning, | keeping his way by the stars. | [PAUSE] | Let him simplify. | [PAUSE] | Let us settle ourselves, | and work and wedge our feet | downward through the mud and slush | of opinion | and prejudice | and tradition | and delusion | and appearance, | till we come to a hard bottom | and rocks in place, | which we can call reality.`
            }
        ]
    },

    'poems-blake': {
        title: 'Songs & Visions',
        author: 'William Blake',
        translator: null,
        category: 'literary',
        tradition: 'Visionary Poetry',
        description: "Tiger burning bright, infinite in a grain of sand. Blake's visionary poetry on innocence, experience, and the divine imagination.",
        sequences: [
            {
                id: 'blake-tiger',
                name: 'The Tiger',
                curve: 'induction',
                wpm: 110,
                content: `Tiger, tiger, | burning bright | in the forests of the night, | what immortal hand or eye | could frame | thy fearful symmetry? | [PAUSE] | In what distant deeps or skies | burnt the fire of thine eyes? | On what wings dare he aspire? | What the hand dare seize the fire? | [PAUSE] | When the stars threw down their spears, | and watered heaven with their tears, | did he smile his work to see? | Did he who made the Lamb | make thee? | [PAUSE] | Tiger, tiger, | burning bright | in the forests of the night, | what immortal hand or eye | dare frame | thy fearful symmetry?`
            },
            {
                id: 'blake-grain',
                name: 'Auguries of Innocence \u2014 Opening',
                curve: 'induction',
                wpm: 100,
                content: `To see a world in a grain of sand, | and a heaven in a wild flower, | hold infinity in the palm of your hand, | and eternity in an hour. | [PAUSE] | A robin redbreast in a cage | puts all heaven in a rage. | A dove-house filled with doves and pigeons | shudders hell through all its regions. | [PAUSE] | A dog starved at his master's gate | predicts the ruin of the state. | Each outcry of the hunted hare | a fibre from the brain does tear. | [PAUSE] | He who shall hurt the little wren | shall never be beloved by men. | He who the ox to wrath has moved | shall never be by woman loved.`
            },
            {
                id: 'blake-lamb',
                name: 'The Lamb',
                curve: 'induction',
                wpm: 90,
                content: `Little Lamb, | who made thee? | Dost thou know | who made thee? | [PAUSE] | Gave thee life, | and bid thee feed | by the stream | and o'er the mead; | Gave thee clothing | of delight, | softest clothing, | woolly, bright; | [PAUSE] | Little Lamb, | I'll tell thee: | He is called | by thy name, | for he calls himself a Lamb. | He is meek, | and he is mild; | he became | a little child. | [PAUSE] | I a child, | and thou a lamb, | we are called | by his name. | Little Lamb, | God bless thee!`
            },
            {
                id: 'blake-london',
                name: 'London',
                curve: 'induction',
                wpm: 110,
                content: `I wander through each chartered street, | near where the chartered Thames does flow, | and mark in every face I meet | marks of weakness, | marks of woe. | [PAUSE] | In every cry of every man, | in every infant's cry of fear, | in every voice, | in every ban, | the mind-forged manacles | I hear. | [PAUSE] | How the chimney-sweeper's cry | every blackening church appalls; | and the hapless soldier's sigh | runs in blood | down palace walls. | [PAUSE] | But most through midnight streets I hear | how the youthful harlot's curse | blasts the new-born infant's tear, | and blights with plagues | the marriage hearse.`
            }
        ]
    },

    'letters-young-poet': {
        title: 'Letters to a Young Poet',
        author: 'Rainer Maria Rilke',
        translator: 'M.D. Herter Norton (1934)',
        category: 'literary',
        tradition: 'Literary Philosophy',
        description: 'Ten letters of counsel on solitude, creativity, patience, and the necessity of living the questions.',
        sequences: [
            {
                id: 'rilke-questions',
                name: 'Letter IV \u2014 Live the Questions',
                curve: 'induction',
                wpm: 110,
                content: `I would like to beg you, | dear Sir, | as well as I can, | to have patience | with everything that remains unsolved | in your heart. | [PAUSE] | Try to love the questions themselves | as if they were locked rooms | or books written in a very foreign language. | [PAUSE] | Do not search for the answers, | which could not be given to you now, | because you would not be able | to live them. | And the point is, | to live everything. | [PAUSE] | Live the questions now. | Perhaps then, | someday far in the future, | you will gradually, | without even noticing it, | live your way | into the answer.`
            },
            {
                id: 'rilke-solitude',
                name: 'Letter II \u2014 Solitude',
                curve: 'induction',
                wpm: 100,
                content: `The only journey | is the one within. | [PAUSE] | It is good to be solitary, | for solitude is difficult; | that something is difficult | must be a reason the more | for us to do it. | [PAUSE] | It is also good to love; | because love is difficult. | For one human being to love another human being: | that is perhaps the most difficult task | that has been entrusted to us, | the ultimate task, | the final test and proof, | the work for which | all other work | is merely preparation.`
            },
            {
                id: 'rilke-birth',
                name: 'Letter VIII \u2014 Courage',
                curve: 'induction',
                wpm: 110,
                content: `We must assume | our existence | as broadly as we in any way can; | everything, | even the unheard-of, | must be possible in it. | [PAUSE] | That is at bottom | the only courage | that is demanded of us: | to have courage for the most strange, | the most singular | and the most inexplicable | that we may encounter. | [PAUSE] | That mankind has in this sense | been cowardly | has done life endless harm; | the experiences | that are called visions, | the whole so-called spirit-world, | death, | all those things | that are so closely akin to us, | have by daily parrying | been so crowded out of life | that the senses | with which we could have grasped them | are atrophied.`
            }
        ]
    },

    'essays-emerson': {
        title: 'Essays',
        author: 'Ralph Waldo Emerson',
        translator: null,
        category: 'literary',
        tradition: 'American Transcendentalism',
        description: "Self-Reliance, Nature, The Over-Soul. Emerson's transcendentalist manifesto of individuality and cosmic connection.",
        sequences: [
            {
                id: 'emerson-reliance',
                name: 'Self-Reliance \u2014 Trust Thyself',
                curve: 'induction',
                wpm: 130,
                content: `Trust thyself: | every heart vibrates | to that iron string. | [PAUSE] | Accept the place | the divine providence | has found for you, | the society of your contemporaries, | the connection of events. | [PAUSE] | Great men have always done so, | and confided themselves childlike | to the genius of their age, | betraying their perception | that the absolutely trustworthy | was seated at their heart, | working through their hands, | predominating in all their being. | [PAUSE] | And we are now men, | and must accept in the highest mind | the same transcendent destiny; | not cowards | fleeing before a revolution, | but guides, redeemers, | and benefactors, | obeying the Almighty effort | and advancing on Chaos and the Dark.`
            },
            {
                id: 'emerson-nature',
                name: 'Nature \u2014 The Transparent Eyeball',
                curve: 'induction',
                wpm: 110,
                content: `Standing on the bare ground \u2014 | my head bathed by the blithe air, | and uplifted into infinite space \u2014 | all mean egotism vanishes. | [PAUSE] | I become a transparent eyeball; | I am nothing; | I see all; | the currents of the Universal Being | circulate through me; | I am part or parcel of God. | [PAUSE] | The name of the nearest friend | sounds then foreign and accidental: | to be brothers, | to be acquaintances, | master or servant, | is then a trifle | and a disturbance. | [PAUSE] | I am the lover of uncontained | and immortal beauty. | In the wilderness, | I find something more dear and connate | than in streets or villages.`
            },
            {
                id: 'emerson-oversoul',
                name: 'The Over-Soul',
                curve: 'induction',
                wpm: 110,
                content: `We live in succession, | in division, | in parts, | in particles. | Meantime within man | is the soul of the whole; | the wise silence; | the universal beauty, | to which every part | and particle is equally related; | the eternal One. | [PAUSE] | And this deep power | in which we exist | and whose beatitude | is all accessible to us, | is not only self-sufficing | and perfect in every hour, | but the act of seeing | and the thing seen, | the seer and the spectacle, | the subject and the object, | are one.`
            },
            {
                id: 'emerson-compensation',
                name: 'Compensation',
                curve: 'induction',
                wpm: 120,
                content: `The same dualism | underlies the nature and condition of man. | Every excess causes a defect; | every defect an excess. | [PAUSE] | Every sweet hath its sour; | every evil its good. | Every faculty which is a receiver of pleasure | has an equal penalty put on its abuse. | [PAUSE] | For every grain of wit | there is a grain of folly. | For everything you have missed, | you have gained something else; | and for everything you gain, | you lose something else. | [PAUSE] | It is impossible to receive | or to bestow a book | and not read it; | to give a service | and not receive it.`
            }
        ]
    },

    'poems-dickinson': {
        title: 'Selected Poems',
        author: 'Emily Dickinson',
        translator: null,
        category: 'literary',
        tradition: 'American Poetry',
        description: "Compressed lightning. Dickinson's dashes fracture time. Death, infinity, dread, and exaltation in 8 lines.",
        sequences: [
            {
                id: 'dickinson-brain',
                name: 'The Brain \u2014 Is Wider Than the Sky',
                curve: 'induction',
                wpm: 90,
                content: `The Brain | \u2014 is wider than the Sky \u2014 | for \u2014 put them side by side \u2014 | the one the other will contain | with ease \u2014 | and You \u2014 beside \u2014 | [PAUSE] | The Brain is deeper than the sea \u2014 | for \u2014 hold them | \u2014 Blue to Blue \u2014 | the one the other will absorb \u2014 | as Sponges \u2014 | Buckets \u2014 do \u2014 | [PAUSE] | The Brain is just the weight of God \u2014 | for \u2014 Heft them \u2014 | Pound for Pound \u2014 | and they will differ \u2014 | if they do \u2014 | as Syllable from Sound \u2014`
            },
            {
                id: 'dickinson-death',
                name: 'Because I Could Not Stop for Death',
                curve: 'induction',
                wpm: 90,
                content: `Because I could not stop for Death \u2014 | He kindly stopped for me \u2014 | the Carriage held | but just Ourselves \u2014 | and Immortality. | [PAUSE] | We slowly drove \u2014 | He knew no haste | and I had put away | my labor | and my leisure too, | for His Civility \u2014 | [PAUSE] | We passed the School, | where Children strove | at Recess \u2014 in the Ring \u2014 | We passed the Fields | of Gazing Grain \u2014 | We passed the Setting Sun \u2014 | [PAUSE] | Since then \u2014 | 'tis Centuries \u2014 | and yet | Feels shorter | than the Day | I first surmised | the Horses' Heads | were toward Eternity \u2014`
            },
            {
                id: 'dickinson-hope',
                name: 'Hope Is the Thing with Feathers',
                curve: 'induction',
                wpm: 90,
                content: `Hope is the thing with feathers \u2014 | that perches in the soul \u2014 | and sings the tune without the words \u2014 | and never stops \u2014 at all \u2014 | [PAUSE] | And sweetest \u2014 in the Gale \u2014 | is heard \u2014 | and sore must be the storm \u2014 | that could abash the little Bird | that kept so many warm \u2014 | [PAUSE] | I've heard it in the chillest land \u2014 | and on the strangest Sea \u2014 | yet \u2014 never \u2014 in Extremity, | it asked a crumb \u2014 of me.`
            },
            {
                id: 'dickinson-narrow',
                name: 'Zero at the Bone',
                curve: 'induction',
                wpm: 100,
                content: `A narrow Fellow in the Grass | Occasionally rides \u2014 | You may have met Him \u2014 did you not | His notice sudden is \u2014 | [PAUSE] | The Grass divides | as with a Comb \u2014 | A spotted shaft is seen \u2014 | And then it closes | at your feet | and opens further on \u2014 | [PAUSE] | Several of Nature's People | I know, | and they know me \u2014 | I feel for them a transport | of cordiality \u2014 | [PAUSE] | But never met this Fellow | Attended, | or alone | without a tighter Breathing | and Zero at the Bone \u2014`
            }
        ]
    }
};
